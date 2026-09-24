/* 全量备份 TiDB → 单文件 SQL（结构+数据，UTF8MB4）。
   用法：node scripts/dump-db.cjs <输出.sql> */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const outFile = process.argv[2] || "backup.sql";
const env = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
const url = env.match(/DATABASE_URL="?([^"\n]+)/)[1];

/** 值 → SQL 字面量（Date/Buffer/JSON 对象/null 均安全）。 */
function lit(v) {
  if (v === null || v === undefined) return "NULL";
  if (v instanceof Date) {
    const p = (n) => String(n).padStart(2, "0");
    return `'${v.getUTCFullYear()}-${p(v.getUTCMonth() + 1)}-${p(v.getUTCDate())} ${p(v.getUTCHours())}:${p(v.getUTCMinutes())}:${p(v.getUTCSeconds())}'`;
  }
  if (Buffer.isBuffer(v)) return `X'${v.toString("hex")}'`;
  if (typeof v === "object") return `'${esc(JSON.stringify(v))}'`;
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  return `'${esc(String(v))}'`;
}
function esc(s) {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\0/g, "\\0");
}

(async () => {
  const conn = await mysql.createConnection({ uri: url, connectTimeout: 15000 });
  const [tables] = await conn.query("SHOW TABLES");
  const names = tables.map((r) => Object.values(r)[0]);
  const w = fs.createWriteStream(outFile, { encoding: "utf8" });
  w.write("-- 三好学伴 数据库全量备份\n");
  w.write(`-- 生成时间: ${new Date().toISOString()}\n`);
  w.write("SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n");
  let totalRows = 0;
  for (const name of names) {
    const [[ddlRow]] = await conn.query(`SHOW CREATE TABLE \`${name}\``);
    const ddl = ddlRow["Create Table"];
    w.write(`-- ----------------------------\n-- 表结构: ${name}\n-- ----------------------------\n`);
    w.write(`DROP TABLE IF EXISTS \`${name}\`;\n${ddl};\n\n`);
    const [rows] = await conn.query(`SELECT * FROM \`${name}\``);
    totalRows += rows.length;
    w.write(`-- 数据: ${name} (${rows.length} 行)\n`);
    if (rows.length > 0) {
      const cols = Object.keys(rows[0]).map((c) => `\`${c}\``).join(", ");
      const CHUNK = 200;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const vals = rows.slice(i, i + CHUNK).map((r) => `(${Object.values(r).map(lit).join(", ")})`).join(",\n");
        w.write(`INSERT INTO \`${name}\` (${cols}) VALUES\n${vals};\n`);
      }
    }
    w.write("\n");
  }
  w.write("SET FOREIGN_KEY_CHECKS = 1;\n");
  await new Promise((resolve, reject) => {
    w.end((err) => (err ? reject(err) : resolve()));
  });
  await conn.end();
  console.log(`DUMP_OK tables=${names.length} rows=${totalRows} -> ${outFile}`);
  process.exit(0);
})().catch((e) => {
  console.error("DUMP_FAIL", e.message);
  process.exit(1);
});
