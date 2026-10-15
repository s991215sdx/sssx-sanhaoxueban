/* 智慧生涯数据底座 · 测试库一次性导入：major_lib / gd_scores / university_lib
   用法：node scripts/import-libs.cjs <库名:majors|scores|universities> <json路径> [clear]
   连接串取自 /www/wwwroot/sanhao-test/.env 的 DATABASE_URL。 */
const fs = require("fs");
const path = require("path");

const [, , lib, file, clearFlag] = process.argv;
if (!lib || !file) {
  console.error("usage: node import-libs.cjs <majors|scores|universities> <json> [clear]");
  process.exit(1);
}

const envFile = fs.readFileSync("/www/wwwroot/sanhao-test/.env", "utf-8");
const m = envFile.match(/^DATABASE_URL=(.+)$/m);
if (!m) throw new Error(".env 里找不到 DATABASE_URL");
const databaseUrl = m[1].trim();

const mysql = require("/www/wwwroot/sanhao-test/node_modules/mysql2/promise");

const CONFIG = {
  majors: {
    table: "major_lib",
    fields: ["menlei_code","menlei","cat_code","cat","code","name","level","added_year","one_liner","jobs","intro","goal","require","knowledge","kaoyan","courses","famous","employment","male_pct","female_pct","degree","regions","industries","occupations","salary","schools","internship","certs"],
    keys: ["menlei_code","menlei","cat_code","cat","code","name","level","added_year","one_liner","jobs","intro","goal","require","knowledge","kaoyan","courses","famous","employment","male_pct","female_pct","degree","regions","industries","occupations","salary","schools","internship","certs"],
    update: "name=VALUES(name)",
  },
  scores: {
    table: "gd_scores",
    fields: ["year","kelei","batch","school_code","school","group_code","group_name","major_code","major_full","major","req","plan","years","fee","menlei","cat","g_count","g_min","g_rank","y1_count","y1_min","y1_rank","y1_batch","y1_plan","y2_count","y2_min","y2_rank","y2_batch","y2_plan","y3_count","y3_min","y3_rank","y3_max","y3_max_rank","y3_batch","y3_plan","est_rank26","city","tier","tags"],
    keys: ["year","kelei","batch","school_code","school","group_code","group_name","major_code","major_full","major","req","plan","years","fee","menlei","cat","g_count","g_min","g_rank","y1_count","y1_min","y1_rank","y1_batch","y1_plan","y2_count","y2_min","y2_rank","y2_batch","y2_plan","y3_count","y3_min","y3_rank","y3_max","y3_max_rank","y3_batch","y3_plan","est_rank26","city","tier","tags"],
    update: null, // 纯插入（导入前 clear）
  },
  universities: {
    table: "university_lib",
    fields: ["zs_id","name","province","city","district","school_type","level","nature","tags","page_tags","found_year","area","supervisor","zs_website","zs_phone","website","motto","alias","former_names","intro","intro_short","doctor","doctor_detail","master","master_detail","key_disciplines","dfc","departments","campus","canteen","dorm","scholarship","aid","male_pct","female_pct","logo_url","campus_photos","dorm_photos","history","ranking","subject_eval","academicians","library_books","labs","baoyan","video_url","address","zs_code","detail_url"],
    keys: ["zs_id","name","province","city","district","school_type","level","nature","tags","page_tags","found_year","area","supervisor","zs_website","zs_phone","website","motto","alias","former_names","intro","intro_short","doctor","doctor_detail","master","master_detail","key_disciplines","dfc","departments","campus","canteen","dorm","scholarship","aid","male_pct","female_pct","logo_url","campus_photos","dorm_photos","history","ranking","subject_eval","academicians","library_books","labs","baoyan","video_url","address","zs_code","detail_url"],
    update: "name=VALUES(name)",
  },
};

const cfg = CONFIG[lib];
if (!cfg) throw new Error("未知库名: " + lib);

// 各表 varchar 列长度（text 列不截断），超长数据截断防止报错
const MAXLEN = {
  "major_lib": { menlei_code:8, menlei:16, cat_code:16, cat:32, code:16, name:128, level:16, added_year:8, male_pct:16, female_pct:16, degree:64 },
  "gd_scores": { kelei:16, batch:32, school_code:16, school:128, group_code:32, group_name:255, major_code:16, major_full:255, major:128, req:64, years:16, fee:32, menlei:16, cat:64, y1_batch:32, y2_batch:32, y3_batch:32, city:32, tier:16, tags:255 },
  "university_lib": { zs_id:16, name:128, province:16, city:32, district:32, school_type:32, level:16, nature:16, tags:255, page_tags:255, found_year:16, area:32, supervisor:64, zs_website:255, zs_phone:255, website:255, motto:255, alias:128, former_names:255, doctor:64, master:64, key_disciplines:128, ranking:255, subject_eval:128, academicians:64, library_books:64, labs:64, baoyan:64, video_url:512, address:255, zs_code:16, detail_url:512 },
};
const strOf = (table) => (v, k) => {
  const x = v == null ? "" : String(v);
  const lim = (MAXLEN[table] || {})[k];
  return lim ? x.slice(0, lim) : x;
};
const num = (v) => {
  const x = Number(v);
  return Number.isFinite(x) && v !== "" && v != null ? Math.trunc(x) : null;
};
const NUMERIC = new Set(["year","plan","g_count","g_min","g_rank","y1_count","y1_min","y1_rank","y1_plan","y2_count","y2_min","y2_rank","y2_plan","y3_count","y3_min","y3_rank","y3_max","y3_max_rank","y3_plan","est_rank26"]);

(async () => {
  const conn = await mysql.createConnection(databaseUrl);
  const rows = JSON.parse(fs.readFileSync(file, "utf-8"));
  if (!Array.isArray(rows)) throw new Error("JSON 必须是数组");
  console.log(`导入 ${cfg.table}: ${rows.length} 行`);

  if (clearFlag === "clear") {
    await conn.query(`DELETE FROM \`${cfg.table}\``);
    console.log("已清空旧数据");
  }

  const BATCH = 200;
  const oneRow = "(" + cfg.fields.map(() => "?").join(",") + ")";
  const updateClause = cfg.update ? ` ON DUPLICATE KEY UPDATE ${cfg.fields.map((f) => `\`${f}\`=VALUES(\`${f}\`)`).join(",")}` : "";

  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map((r) =>
      cfg.keys.map((k) => (NUMERIC.has(k) ? num(r[k]) : strOf(cfg.table)(r[k], k)))
    );
    const sql = `INSERT INTO \`${cfg.table}\` (\`${cfg.fields.join("`,`")}\`) VALUES ` +
      Array.from({ length: batch.length }, () => oneRow).join(",") + updateClause;
    await conn.query(sql, batch.flat());
    done += batch.length;
    if (done % 2000 === 0 || done === rows.length) console.log(`  ${done}/${rows.length}`);
  }
  const [[{ c }]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${cfg.table}\``);
  console.log(`完成，表里现有 ${c} 行`);
  await conn.end();
})().catch((e) => {
  console.error("导入失败:", e.message);
  process.exit(1);
});
