/**
 * 部署后校验：某张表是否真的多了某一列。
 *
 * 为什么需要它：迁移是服务启动时自动跑的，`ping` 只证明进程活着，不证明 DDL 落库了。
 * 新代码一旦 SELECT 一个还不存在的列，整个接口会报错（学生端页面直接白掉），
 * 而部署脚本会以为成功。所以每次发版把「本次迁移新增的列」读出来核对一遍。
 *
 * 用法：node db-column-check.cjs <table> <column>
 * 退出码：0 存在；3 不存在或读不到库（调用方按失败处理）
 */
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

(async () => {
  const [table, column] = process.argv.slice(2);
  if (!table || !column) {
    console.error("用法: node db-column-check.cjs <table> <column>");
    process.exit(3);
  }
  const envText = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
  const url = new URL(envText.match(/^DATABASE_URL=(.*)$/m)[1].trim());
  const c = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password || ""),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
  });
  const [rows] = await c.query("SHOW COLUMNS FROM ?? LIKE ?", [table, column]);
  await c.end();
  if (rows.length === 0) {
    console.error(`✘ ${table}.${column} 不存在（迁移没落库，检查启动日志 / dbMigrate 探针）`);
    process.exit(3);
  }
  console.log(`✔ ${table}.${column} 已落库（${rows[0].Type}）`);
})().catch((e) => {
  console.error("✘ 列校验失败: " + e.message);
  process.exit(3);
});
