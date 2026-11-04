#!/usr/bin/env bash
# =============================================================================
# 三好学伴 · 双通道正式部署脚本（Git Bash / Linux 通用）
#
# 一条命令把同一份代码同时部署到两个完全隔离的正式环境：
#   内部版  sanhao.sssx.club  → 106.52.8.20   (数据库 10.1.0.3 proj_sanhao)
#   渠道版  3hao.vip          → 114.132.171.31 (本机 MySQL proj_sanhao)
#
# 流程：三连检查(可跳过) → 本地构建 → 打包源码 → 两台服务器并行
#       [备份dist → 解包 → pnpm install → build → 重启 → 本机探活]
#       → 双通道版本号比对，不一致即报错退出。
#
# 用法：
#   bash scripts/deploy-dual.sh              # 完整流程（含 check + test）
#   bash scripts/deploy-dual.sh --skip-checks # 跳过三连，直接构建部署
#
# 账号：两台均为 tanghailing（不要用 root）；重启走 sudo -n /bin/systemctl restart sanhao
# （sudoers 只放行 systemctl restart/status/is-active/is-enabled 这几个，chown 之类没有）
# 环境变量 DEPLOY_KEY 可指定 SSH 私钥，默认 ~/.ssh/id_ed25519_tanghailing
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

INTERNAL_HOST="tanghailing@106.52.8.20"
CHANNEL_HOST="tanghailing@114.132.171.31"
APP_DIR="/www/wwwroot/sanhao"
INTERNAL_URL="https://sanhao.sssx.club"
CHANNEL_IP="114.132.171.31"
SSH_KEY="${DEPLOY_KEY:-$HOME/.ssh/id_ed25519_tanghailing}"
SSH="ssh -i $SSH_KEY -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null"
SCP="scp -i $SSH_KEY -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null"

log()  { echo -e "\033[32m[deploy-dual]\033[0m $*"; }
fail() { echo -e "\033[31m[deploy-dual] $*\033[0m" >&2; exit 1; }

# ---------- 0. 前置 ----------
[ "${1:-}" = "--skip-checks" ] && SKIP_CHECKS=1 || SKIP_CHECKS=0
[ -f package.json ] || fail "请在仓库根目录运行"
command -v pnpm >/dev/null || fail "本机未安装 pnpm"
[ -f "$SSH_KEY" ] || fail "未找到 SSH 私钥 $SSH_KEY（可用 DEPLOY_KEY 指定）"

BUILD_TAG=$(grep -oE 'const BUILD_TAG = "[^"]+"' api/router.ts | cut -d'"' -f2)
[ -n "$BUILD_TAG" ] || fail "api/router.ts 缺 BUILD_TAG"
log "目标版本: $BUILD_TAG"

# ---------- 0.5 迁移前预检：kind 枚举 ----------
# 正式库里可能有开发期留下的历史枚举值；MODIFY COLUMN 会把迁移没列出的值静默删掉，
# 存量记录对应的 kind 变成空字符串。所以先把「库里有」和「迁移要写」两个集合比一遍，
# 不一致直接退出，不构建、不碰 dist。
EXPECT_ENUM=$(grep -hoE "MODIFY COLUMN .kind. enum\([^)]*\)" db/migrations/*.sql 2>/dev/null \
  | tail -1 | sed -E "s/.*enum\(//; s/\)//; s/'//g" || true)
[ -n "$EXPECT_ENUM" ] || fail "没能从 db/migrations 解析出 kind enum 定义"

preflight_enum() {
  local host="$1" name="$2" coltype have want missing extra
  log "预检 $name 的 assessment_results.kind…"
  $SSH "$host" "mkdir -p \$HOME/.sanhao-deploy" >/dev/null
  $SCP scripts/db-enum-check.cjs "$host:.sanhao-deploy/db-enum-check.cjs" >/dev/null
  coltype=$($SSH "$host" "cd $APP_DIR && NODE_PATH=$APP_DIR/node_modules node \$HOME/.sanhao-deploy/db-enum-check.cjs assessment_results kind" 2>&1) \
    || fail "$name 读不到 kind 列定义：$coltype"
  case "$coltype" in
    NOCOLUMN|"") fail "$name 查不到 assessment_results.kind" ;;
  esac
  have=$(echo "$coltype" | grep -oE "'[a-z0-9_]+'" | tr -d "'" | sort)
  want=$(echo "$EXPECT_ENUM" | tr ',' '\n' | sort)
  missing=$(comm -13 <(echo "$have") <(echo "$want") || true)
  extra=$(comm -23 <(echo "$have") <(echo "$want") || true)
  # missing 是本次要新增的值（正常）；extra 会被 MODIFY COLUMN 静默删掉，必须拦
  [ -z "$missing" ] || log "  将新增枚举值：$(echo $missing)"
  [ -z "$extra" ] || fail "$name 库里有、迁移没列出（会被 MODIFY 删掉）：$(echo $extra)"
  log "  $name 枚举核对通过（迁移共 $(echo "$want" | wc -l | tr -d ' ') 个值）"
}

preflight_enum "$INTERNAL_HOST" "内部版"
preflight_enum "$CHANNEL_HOST" "渠道版"

# ---------- 0.6 本次迁移新增的列 ----------
# ADD COLUMN 也走启动时自动迁移，但 ping 只证明进程活着。新代码 SELECT 一个不存在的列，
# 接口会整片报错（学生端白屏），脚本却以为成功——所以把最后一条 ADD COLUMN 读出来，部署后核对。
LAST_ADD=$(grep -hoE "ALTER TABLE \`[a-z_]+\` ADD COLUMN \`[a-z_]+\`" db/migrations/*.sql 2>/dev/null | tail -1 || true)
NEW_TABLE=$(echo "$LAST_ADD" | sed -E 's/.*TABLE `([a-z_]+)`.*/\1/')
NEW_COL=$(echo "$LAST_ADD" | sed -E 's/.*ADD COLUMN `([a-z_]+)`.*/\1/')
if [ -n "$NEW_TABLE" ] && [ -n "$NEW_COL" ]; then
  log "本次迁移新增列: $NEW_TABLE.$NEW_COL（部署后核对是否落库）"
else
  log "本次迁移没有新增列，跳过列核对"
fi

# ---------- 1. 三连 + 构建 ----------
if [ "$SKIP_CHECKS" = "0" ]; then
  log "① pnpm run check"
  pnpm run check >/dev/null || fail "check 未通过"
  log "② pnpm run test"
  pnpm run test >/dev/null || fail "test 未通过"
fi
log "③ pnpm run build"
pnpm run build >/dev/null || fail "build 未通过"
log "构建完成"

# ---------- 2. 打包构建产物 ----------
# 不在服务器上 pnpm install + build：
#   服务器 pnpm 12 默认拒绝执行 esbuild 等包的构建脚本（ERR_PNPM_IGNORED_BUILDS），
#   且 corepack 会临时联网下载 pnpm，生产机上这两件事都不可控。
# 本地构建过一次，两台只传产物（5.5MB），切换窗口从十几分钟压到几秒。
TARBALL="/tmp/sanhao-dist-$$.tgz"
trap 'rm -f "$TARBALL"' EXIT
tar -czf "$TARBALL" -C dist .
log "产物包: $(du -h "$TARBALL" | cut -f1)"

# ---------- 3. 部署到两台服务器 ----------
deploy_one() {
  local host="$1" name="$2"
  log "→ $name ($host) 上传产物…"
  $SSH "$host" "mkdir -p \$HOME/.sanhao-deploy" >/dev/null
  $SCP "$TARBALL" "$host:.sanhao-deploy/dist.tgz" >/dev/null

  log "→ $name 切换 dist 并重启…"
  # 先解到 dist.new 并校验完整，再 mv 换过去：
  # 解包失败时线上 dist 原样不动，不会出现「新目录空着、服务起不来」。
  $SSH "$host" "set -e
    cd $APP_DIR
    ts=\$(date +%Y%m%d_%H%M%S)
    rm -rf dist.new && mkdir -p dist.new
    tar --no-same-owner --no-same-permissions -xzf \$HOME/.sanhao-deploy/dist.tgz -C dist.new 2>/dev/null || true
    rm -f \$HOME/.sanhao-deploy/dist.tgz
    [ -f dist.new/boot.js ] || { echo '$name 产物不完整：缺 boot.js'; exit 1; }
    sz=\$(stat -c %s dist.new/boot.js)
    [ \"\$sz\" -gt 4000000 ] || { echo '$name boot.js 只有 \$sz 字节，疑似解包不全'; exit 1; }
    chmod -R u+rwX,go+rX dist.new
    [ -d dist ] && mv dist dist.bak_\$ts
    mv dist.new dist
    sudo -n /bin/systemctl restart sanhao
    sleep 6
    curl -sf http://127.0.0.1:3000/api/trpc/ping | grep -q '\"ok\":true' \
      || { echo '$name 本机探活失败'; systemctl status sanhao --no-pager -n 15 || true; exit 1; }
    ready=0
    for i in 1 2 3 4 5 6 7 8; do
      if curl -sf http://127.0.0.1:3000/api/trpc/dbHealth | grep -q '\"ready\":true'; then ready=1; break; fi
      sleep 4
    done
    [ \"\$ready\" = 1 ] || { echo '$name 数据库初始化未就绪（迁移可能失败）：'; curl -s http://127.0.0.1:3000/api/trpc/dbHealth; echo; exit 1; }
    echo '$name 部署完成（旧产物在 dist.bak_'\$ts'）'" \
  || fail "$name 部署失败，按上面提示处理（旧 dist 已备份为 dist.bak_*）"

  # 迁移的 DDL 由服务启动时执行，探活成功不代表列已经加上：单独核对一次
  if [ -n "${NEW_TABLE:-}" ] && [ -n "${NEW_COL:-}" ]; then
    $SCP scripts/db-column-check.cjs "$host:.sanhao-deploy/db-column-check.cjs" >/dev/null
    $SSH "$host" "cd $APP_DIR && NODE_PATH=$APP_DIR/node_modules node \$HOME/.sanhao-deploy/db-column-check.cjs $NEW_TABLE $NEW_COL" \
      || fail "$name 迁移未落库：$NEW_TABLE.$NEW_COL 不存在，线上会因缺列报错，立即回滚 dist.bak_* 排查"
  fi
}

deploy_one "$INTERNAL_HOST" "内部版"
deploy_one "$CHANNEL_HOST" "渠道版"

# ---------- 4. 双通道探活与版本比对 ----------
log "双通道探活…"
sleep 3
V_INTERNAL=$(curl -sf "$INTERNAL_URL/api/trpc/ping" | grep -oE '"v":"[^"]+"' | cut -d'"' -f4)
V_CHANNEL=$(curl -sf "https://3hao.vip/api/trpc/ping" | grep -oE '"v":"[^"]+"' | cut -d'"' -f4)
[ -n "$V_INTERNAL" ] || fail "内部版探活无响应 ($INTERNAL_URL)"
[ -n "$V_CHANNEL" ]  || fail "渠道版探活无响应 (https://3hao.vip)"

echo ""
echo "=============================================="
echo " 内部版  $INTERNAL_URL  → $V_INTERNAL"
echo " 渠道版  3hao.vip ($CHANNEL_IP) → $V_CHANNEL"
echo "=============================================="
if [ "$V_INTERNAL" = "$V_CHANNEL" ]; then
  log "✔ 双通道版本一致，部署完成: $V_INTERNAL"
else
  fail "✘ 双通道版本不一致！内部=$V_INTERNAL 渠道=$V_CHANNEL"
fi
