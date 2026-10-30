#!/usr/bin/env bash
# =============================================================================
# 在测试服务器上执行（由 deploy-test-v236.sh 上传到 /tmp 后调用）
#
#   MODE=check  只核对枚举，不动任何东西
#   MODE=apply  核对通过后切换 dist、重启、验证迁移落库
#
# 环境变量 EXPECT_ENUM：迁移要写入的完整值集（逗号分隔，不带引号），由本地脚本解析迁移得到
#
# 账号：tanghailing，重启走 sudo；dist 解包后要 chown 回 sanhao（服务以 sanhao 运行）
# =============================================================================
set -euo pipefail

APP_DIR=/www/wwwroot/sanhao-test
SERVICE=sanhao-test
PORT=3001
MODE="${MODE:-check}"
EXPECT="${EXPECT_ENUM:?EXPECT_ENUM 未传}"
TARBALL="$HOME/.sanhao-deploy/dist.tgz"

cd "$APP_DIR"

TYPE=$(NODE_PATH="$APP_DIR/node_modules" node "$HOME/.sanhao-deploy/db-enum-check.cjs" assessment_results kind)
echo "当前 assessment_results.kind 定义：$TYPE"

case "$TYPE" in
  NOCOLUMN|"") echo "✘ 查不到 kind 列，人工确认后再部署" >&2; exit 1 ;;
esac

# 库里已有的枚举值
HAVE=$(echo "$TYPE" | grep -oE "'[a-z0-9_]+'" | tr -d "'" | sort)
# 迁移要写入的值（同时保证「库里有的」一个都不少）
WANT=$(echo "$EXPECT" | tr ',' '\n' | sort)

MISSING=$(comm -13 <(echo "$HAVE") <(echo "$WANT") || true)
EXTRA=$(comm -23 <(echo "$HAVE") <(echo "$WANT") || true)

if [ -n "$MISSING" ]; then
  echo "✘ 迁移要写入但库里没有的值：$(echo $MISSING)" >&2
  echo "  说明 0043 的 ALTER 与真实库不一致（可能漏了历史 kind），先改迁移再部署。" >&2
  exit 1
fi
if [ -n "$EXTRA" ]; then
  echo "✘ 库里有、但 0043 的 ALTER 没列出的值：$(echo $EXTRA)" >&2
  echo "  MODIFY COLUMN 会把它删掉，历史数据会变成空值。先把它补进迁移再部署。" >&2
  exit 1
fi
echo "✔ 枚举与迁移一致（$(echo "$WANT" | wc -l | tr -d ' ') 个值）"

if [ "$MODE" = "check" ]; then
  exit 0
fi

echo "→ 切换 dist 并重启（重启时会自动执行 0043 迁移）"
ts=$(date +%Y%m%d_%H%M%S)
[ -d dist ] && mv dist "dist.bak_$ts"
mkdir -p dist
tar -xzf "$TARBALL" -C dist
rm -f "$TARBALL"
# 以 tanghailing 解出来的文件属主是 tanghailing，服务以 sanhao 跑，改回去免得读不到
sudo chown -R sanhao:sanhao dist
sudo systemctl restart "$SERVICE"
sleep 5
systemctl is-active "$SERVICE"

echo "→ 探活"
curl -sf "http://127.0.0.1:$PORT/api/trpc/ping" || { echo "✘ 探活失败，看日志：sudo journalctl -u $SERVICE -n 40 --no-pager" >&2; exit 1; }
echo ""

echo "→ 验证迁移已落库"
node -e '
const fs=require("node:fs"),path=require("node:path");
const env=fs.readFileSync(path.join(process.cwd(),".env"),"utf8");
const u=new URL(env.match(/^DATABASE_URL=(.*)$/m)[1].trim());
const m=require("mysql2/promise");
(async()=>{
  const c=await m.createConnection({host:u.hostname,port:Number(u.port||3306),user:decodeURIComponent(u.username),password:decodeURIComponent(u.password??""),database:decodeURIComponent(u.pathname.replace(/^\//,""))});
  const [k]=await c.query("SHOW COLUMNS FROM ?? LIKE ?",["assessment_results","kind"]);
  const [b]=await c.query("SHOW COLUMNS FROM ?? LIKE ?",["student_profile","boarding"]);
  console.log("kind 含 familystudent: "+String(k[0].Type.includes("familystudent")));
  console.log("kind 含 familyparent : "+String(k[0].Type.includes("familyparent")));
  console.log("boarding 列已建     : "+String(b.length>0));
  await c.end();
})().catch(e=>{console.error(e.message);process.exit(3)});
'
