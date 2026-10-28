#!/usr/bin/env bash
# =============================================================================
# 三好学伴 v236 · 测试环境部署（本地执行）
#
# 把已构建的 dist 推到 106.52.8.20:3001，先在服务器上核对 assessment_results.kind
# 的现有枚举值，一致才切换 dist 并重启（重启时自动跑 0043 迁移）。
#
# 为什么要核对：0043 是 `ALTER TABLE ... MODIFY COLUMN kind enum(...)`，
# 迁移里没列出的历史枚举值会被静默删掉，存量记录对应的 kind 会变成空字符串。
#
# 用法：
#   bash scripts/deploy-test-v236.sh            # 预检 + 部署
#   bash scripts/deploy-test-v236.sh --check    # 只预检，不动 dist、不重启
#
# 前置：
#   pnpm run build
#   tar -czf /tmp/sanhao-test-dist.tgz -C dist .
#   私钥可登录 root@106.52.8.20（默认 ~/.ssh/id_ed25519_sdx，可用 DEPLOY_KEY 覆盖）
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="root@106.52.8.20"
TARBALL="${TARBALL:-/tmp/sanhao-test-dist.tgz}"
SSH_KEY="${DEPLOY_KEY:-$HOME/.ssh/id_ed25519_sdx}"
SSH="ssh -i $SSH_KEY -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null"
SCP="scp -i $SSH_KEY -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null"

# 0043 迁移写入的完整值集（与 db/migrations/0043_family_assess.sql 逐字一致）
EXPECT_ENUM="mbti,disc,e3,e3parent,multi,multi5,anchor,holland,mental,mentalsdq,mentalpa,scl90,discparent,subject,subject4d,familystudent,familyparent"

MODE="apply"
[ "${1:-}" = "--check" ] && MODE="check"

log()  { echo -e "\033[32m[deploy-test]\033[0m $*"; }
fail() { echo -e "\033[31m[deploy-test] $*\033[0m" >&2; exit 1; }

[ -f "$SSH_KEY" ] || fail "找不到私钥 $SSH_KEY（可用 DEPLOY_KEY 指定）"
if [ "$MODE" = "apply" ]; then
  [ -f "$TARBALL" ] || fail "找不到构建产物 $TARBALL（pnpm run build 后 tar -czf $TARBALL -C dist .）"
  log "① 上传 dist 包（$(du -h "$TARBALL" | cut -f1)）"
  $SCP "$TARBALL" "$HOST:/tmp/sanhao-test-dist.tgz" >/dev/null
fi

log "② 上传预检/部署脚本"
$SCP scripts/db-enum-check.cjs "$HOST:/tmp/db-enum-check.cjs" >/dev/null
$SCP scripts/deploy-test-remote.sh "$HOST:/tmp/deploy-test-remote.sh" >/dev/null

log "③ 服务器端执行（MODE=$MODE）"
$SSH "$HOST" "MODE=$MODE EXPECT_ENUM='$EXPECT_ENUM' bash /tmp/deploy-test-remote.sh"

if [ "$MODE" = "check" ]; then
  log "预检通过（未切换 dist、未重启）"
else
  echo ""
  echo "=============================================="
  echo " 测试环境 http://106.52.8.20:3001"
  echo " 版本号应为 v236-2026-10-28（ping 探活已在服务器上校验过）"
  echo " 验收路径：测评中心 → 家庭关系测评 · 学生卷 → 答完 → 报告页「家庭教育报告」"
  echo "=============================================="
fi
