#!/usr/bin/env bash
# =============================================================================
# 三好学伴 · 测试环境部署（本地执行）
#
# 把已构建的 dist 推到 106.52.8.20:3001，先在服务器上核对 assessment_results.kind
# 的现有枚举值，一致才切换 dist 并重启（重启时自动跑内嵌迁移）。
#
# 为什么要核对：迁移里凡是 `ALTER TABLE ... MODIFY COLUMN kind enum(...)`，
# 没列出的历史枚举值会被静默删掉，存量记录对应的 kind 会变成空字符串。
# 所以 EXPECT_ENUM 直接从 migrations 目录里解析最后一条 MODIFY，而不是手写常量——
# 手写的常量和迁移文件总有一天会对不上。
#
# 用法：
#   bash scripts/deploy-test.sh            # 预检 + 部署
#   bash scripts/deploy-test.sh --check    # 只预检，不动 dist、不重启
#
# 前置：
#   pnpm run build
#   tar -czf /tmp/sanhao-test-dist.tgz -C dist .
#
# 账号：tanghailing（不要用 root）；重启走 sudo systemctl restart sanhao-test
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="tanghailing@106.52.8.20"
TARBALL="${TARBALL:-/tmp/sanhao-test-dist.tgz}"
# 服务器上 /tmp 里的同名文件可能属主是 root，tanghailing 覆盖不了，统一放自己 home 下
REMOTE_DIR=".sanhao-deploy"
SSH_KEY="${DEPLOY_KEY:-$HOME/.ssh/id_ed25519_tanghailing}"
SSH="ssh -i $SSH_KEY -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null"
SCP="scp -i $SSH_KEY -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null"

# 从迁移文件里取最后一条 kind 的 enum 值集（去掉引号，逗号分隔）
EXPECT_ENUM=$(
  grep -hoE "MODIFY COLUMN .kind. enum\([^)]*\)" db/migrations/*.sql 2>/dev/null \
    | tail -1 \
    | sed -E "s/.*enum\(//; s/\)//; s/'//g" || true
)
[ -n "$EXPECT_ENUM" ] || { echo "✘ 没能从 db/migrations 解析出 kind enum 定义" >&2; exit 1; }

MODE="apply"
[ "${1:-}" = "--check" ] && MODE="check"

log()  { echo -e "\033[32m[deploy-test]\033[0m $*"; }
fail() { echo -e "\033[31m[deploy-test] $*\033[0m" >&2; exit 1; }

[ -f "$SSH_KEY" ] || fail "找不到私钥 $SSH_KEY（可用 DEPLOY_KEY 指定）"
if [ "$MODE" = "apply" ]; then
  [ -f "$TARBALL" ] || fail "找不到构建产物 $TARBALL（pnpm run build 后 tar -czf $TARBALL -C dist .）"
  log "① 上传 dist 包（$(du -h "$TARBALL" | cut -f1)）"
  $SSH "$HOST" "mkdir -p \$HOME/$REMOTE_DIR" >/dev/null
  $SCP "$TARBALL" "$HOST:$REMOTE_DIR/dist.tgz" >/dev/null
fi

log "② 上传预检/部署脚本"
$SSH "$HOST" "mkdir -p \$HOME/$REMOTE_DIR" >/dev/null
$SCP scripts/db-enum-check.cjs "$HOST:$REMOTE_DIR/db-enum-check.cjs" >/dev/null
$SCP scripts/deploy-test-remote.sh "$HOST:$REMOTE_DIR/deploy-test-remote.sh" >/dev/null

log "③ 服务器端执行（MODE=$MODE，枚举 $(echo "$EXPECT_ENUM" | tr ',' '\n' | wc -l | tr -d ' ') 个值）"
$SSH "$HOST" "MODE=$MODE EXPECT_ENUM='$EXPECT_ENUM' bash \$HOME/$REMOTE_DIR/deploy-test-remote.sh"

if [ "$MODE" = "check" ]; then
  log "预检通过（未切换 dist、未重启）"
else
  echo ""
  echo "=============================================="
  echo " 测试环境 http://106.52.8.20:3001"
  echo " 版本号应为 $(grep -oE 'const BUILD_TAG = "[^"]+"' api/router.ts | cut -d'"' -f2)（ping 探活已在服务器上校验过）"
  echo " 验收路径：测评中心 → 家庭关系测评 · 学生卷 → 答完 → 报告页「家庭教育报告」"
  echo "=============================================="
fi
