/* v173 部署核对：gd_scores 新列、career_lib 总数、university_lib 省份+标签组合查询 */
const fs = require("fs");
const envFile = fs.readFileSync("/www/wwwroot/sanhao-test/.env", "utf-8");
const databaseUrl = envFile.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const mysql = require("/www/wwwroot/sanhao-test/node_modules/mysql2/promise");

(async () => {
  const db = await mysql.createConnection(databaseUrl);
  const cols = await db.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='gd_scores' AND column_name IN ('g_count','y1_count','y1_batch','y1_plan','y2_count','y2_batch','y2_plan','y3_count','y3_max','y3_max_rank','y3_batch','y3_plan')`
  );
  console.log("gd_scores 新列命中:", cols[0][0].c, "/ 12");
  const careers = await db.query("SELECT COUNT(*) c FROM career_lib");
  console.log("career_lib 总数:", careers[0][0].c);
  const uni = await db.query(
    `SELECT COUNT(*) c FROM university_lib WHERE province='广东' AND tags LIKE '%985%'`
  );
  console.log("广东+985 院校数:", uni[0][0].c);
  const scores = await db.query("SELECT COUNT(*) c FROM gd_scores");
  console.log("gd_scores 当前行数:", scores[0][0].c);
  await db.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
