/**
 * 把 db/migrations 里新增的迁移追加进 api/migrationsEmbedded.ts（内嵌迁移数据）。
 * 用法：node scripts/embed-migrations.mjs
 * 背景：部署容器里 db/migrations 文件可能缺失，迁移内容随 esbuild 打入 dist/boot.js。
 * 本脚本只「追加」新条目，绝不重写已有内容（部分历史 sql 文件已不在 db/migrations 里，
 * 但已内嵌的数据必须原样保留）。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const journal = JSON.parse(readFileSync(join(root, "db/migrations/meta/_journal.json"), "utf8"));
const target = join(root, "api/migrationsEmbedded.ts");
let src = readFileSync(target, "utf8");

const existingTags = new Set([...src.matchAll(/"(\d{4}_[a-z0-9_]+)":/g)].map((m) => m[1]));
const missing = journal.entries.filter((e) => !existingTags.has(e.tag));
if (missing.length === 0) {
  console.log("[embed-migrations] 无新增迁移，跳过");
  process.exit(0);
}

/* 校验：每个待追加 tag 必须有对应 sql 文件（防止登记了日志却忘写文件） */
for (const e of missing) {
  if (!existsSync(join(root, "db/migrations", `${e.tag}.sql`))) {
    console.error(`[embed-migrations] 缺迁移文件：db/migrations/${e.tag}.sql`);
    process.exit(1);
  }
}

/* 追加 JOURNAL_ENTRIES（在 "];" 前插入） */
const entryLines = missing
  .map(
    (e) =>
      `, {"idx": ${e.idx}, "when": ${e.when}, "tag": "${e.tag}"}`,
  )
  .join("");
const arrEnd = src.lastIndexOf("];");
if (arrEnd < 0) throw new Error("JOURNAL_ENTRIES 数组结尾未找到");
src = src.slice(0, arrEnd) + entryLines + "\n];\n" + src.slice(arrEnd + 3);

/* 追加 MIGRATION_SQL（在 "};" 前插入；前一条目若缺尾逗号先补上） */
const sqlLines = missing
  .map((e) => {
    const sql = readFileSync(join(root, "db/migrations", `${e.tag}.sql`), "utf8");
    return `  "${e.tag}": ${JSON.stringify(sql)},`;
  })
  .join("\n");
const objEnd = src.lastIndexOf("};");
if (objEnd < 0) throw new Error("MIGRATION_SQL 对象结尾未找到");
src = src.slice(0, objEnd).replace(/(?<![,\s])\n(\s*)\};?\s*$/, ",\n$1") + sqlLines + "\n" + src.slice(objEnd);

writeFileSync(target, src);
console.log(`[embed-migrations] 已追加 ${missing.length} 条：${missing.map((e) => e.tag).join(", ")}`);
