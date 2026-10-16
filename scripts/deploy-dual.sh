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
# 环境变量 DEPLOY_KEY 可指定 SSH 私钥，默认 ~/.ssh/id_ed25519_sdx
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

INTERNAL_HOST="root@106.52.8.20"
CHANNEL_HOST="root@114.132.171.31"
APP_DIR="/www/wwwroot/sanhao"
INTERNAL_URL="https://sanhao.sssx.club"
CHANNEL_IP="114.132.171.31"
SSH_KEY="${DEPLOY_KEY:-$HOME/.ssh/id_ed25519_sdx}"
SSH="ssh -i $SSH_KEY -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new"
SCP="scp -i $SSH_KEY -o ConnectTimeout=15"

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

# ---------- 2. 打包源码（不含 node_modules/.git/dist/.env）----------
TARBALL="/tmp/sanhao-deploy-$$.tgz"
trap 'rm -f "$TARBALL"' EXIT
tar --exclude=node_modules --exclude=.git --exclude=dist --exclude=.env \
    --exclude=working\ files -czf "$TARBALL" .
log "源码包: $(du -h "$TARBALL" | cut -f1)"

# ---------- 3. 部署到两台服务器 ----------
deploy_one() {
  local host="$1" name="$2"
  log "→ $name ($host) 上传中…"
  $SCP "$TARBALL" "$host:/tmp/sanhao-deploy.tgz" >/dev/null
  log "→ $name 远程安装/构建/重启…"
  $SSH "$host" "set -e
    ts=\$(date +%Y%m%d_%H%M%S)
    [ -d $APP_DIR/dist ] && cp -r $APP_DIR/dist $APP_DIR/dist.bak_\$ts
    mkdir -p $APP_DIR && cd $APP_DIR
    tar -xzf /tmp/sanhao-deploy.tgz && rm /tmp/sanhao-deploy.tgz
    export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
    ( pnpm --version >/dev/null 2>&1 || corepack enable >/dev/null 2>&1 || true )
    pnpm install --frozen-lockfile >/dev/null
    pnpm run build >/dev/null
    systemctl restart sanhao.service
    sleep 6
    curl -sf http://127.0.0.1:3000/api/trpc/ping | grep -q '\"ok\":true' \
      || { echo '$name 本机探活失败'; journalctl -u sanhao.service -n 15 --no-pager; exit 1; }
    echo '$name 部署完成'" \
  || fail "$name 部署失败（旧版本仍在运行，dist 已备份）"
}

deploy_one "$INTERNAL_HOST" "内部版"
deploy_one "$CHANNEL_HOST" "渠道版"

# ---------- 4. 双通道探活与版本比对 ----------
log "双通道探活…"
sleep 3
V_INTERNAL=$(curl -sf "$INTERNAL_URL/api/trpc/ping" | grep -oE '"v":"[^"]+"' | cut -d'"' -f4)
V_CHANNEL=$(curl -sf -H "Host: 3hao.vip" "http://$CHANNEL_IP/api/trpc/ping" | grep -oE '"v":"[^"]+"' | cut -d'"' -f4)
[ -n "$V_INTERNAL" ] || fail "内部版探活无响应 ($INTERNAL_URL)"
[ -n "$V_CHANNEL" ]  || fail "渠道版探活无响应 ($CHANNEL_IP)"

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
