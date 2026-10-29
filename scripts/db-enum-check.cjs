/**
 * 查某列的定义（用于部署前核对 enum 值，避免 MODIFY COLUMN 把未知值悄悄删掉）。
 *
 * 服务器上没有 mysql 客户端，只能借应用自己的 mysql2 与 .env：
 *   cd /www/wwwroot/sanhao-test
 *   NODE_PATH=./node_modules node /tmp/db-enum-check.cjs assessment_results kind
 *
 * 输出一行：列类型原文（如 enum('mbti','disc',...) 或 varchar(16)）。
 * 读不到 .env / 连不上库时退出码非 0，调用方据此中止部署。
 */
const fs = require("node:fs");
const path = require("node:path");

const [table, column] = process.argv.slice(2);
if (!table || !column) {
  console.error("usage: node db-enum-check.cjs <table> <column>");
  process.exit(64);
}

const envPath = path.join(process.cwd(), ".env");
if (!fs.existsSync(envPath)) {
  console.error(`NOENV ${envPath}`);
  process.exit(2);
}
const m = fs.readFileSync(envPath, "utf8").match(/^DATABASE_URL=(.*)$/m);
if (!m) {
  console.error("NOENV DATABASE_URL 未配置");
  process.exit(2);
}

const raw = m[1].trim().replace(/^["']|["']$/g, "");
const u = new URL(raw);
const mysql = require("mysql2/promise");

(async () => {
  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password ?? ""),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")),
  });
  const [rows] = await conn.query("SHOW COLUMNS FROM ?? LIKE ?", [table, column]);
  if (!rows.length) {
    console.log("NOCOLUMN");
  } else {
    console.log(rows[0].Type);
  }
  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(3);
});
