/**
 * 一条命令模拟「一个学生 + 两位家长」走完整条家庭测评链路（本地联调用）。
 *
 * 为什么要这个脚本：报告页是最后才被打开的东西，扫码补填又是最容易漏数据的一环——
 * 只点页面看不出来「妈妈那份到底进没进库」，等真机发现问题时已经找不到是哪一步丢的。
 * 这里不点 UI，直接把三条写入路径各走一遍，再用报告接口把结果读回来核对。
 *
 * 前提：本地有可用的 MySQL/MariaDB，`.env` 里 DATABASE_URL 指向它，dev server 已起。
 * 用法：npx tsx scripts/fam-sim.ts            完整跑一遍（会重置该手机号的测试账号）
 *       npx tsx scripts/fam-sim.ts --keep     保留已有答卷，只补一份妈妈卷
 *
 * 它只读写测试账号（默认 13900000001），不碰任何真实学员数据。
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import { randomBytes, scryptSync } from "node:crypto";

const BASE = process.env.SIM_BASE ?? "http://[::1]:3000/api/trpc";
const PHONE = process.env.SIM_PHONE ?? "13900000001";
const PASSWORD = "123456";
const KEEP = process.argv.includes("--keep");

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `s1$${salt}$${scryptSync(password, salt, 32).toString("hex")}`;
}

let cookie = "";
async function call(path: string, input?: unknown, method: "GET" | "POST" = "GET"): Promise<any> {
  const url =
    method === "GET"
      ? `${BASE}/${path}${input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`}`
      : `${BASE}/${path}`;
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    ...(method === "POST" ? { body: JSON.stringify({ json: input }) } : {}),
  });
  const sc = res.headers.getSetCookie?.() ?? [];
  if (sc.length) cookie = sc.map((c) => c.split(";")[0]).join("; ");
  const body = JSON.parse(await res.text());
  if (body.error) throw new Error(`${path}: ${body.error.json?.message ?? JSON.stringify(body.error).slice(0, 200)}`);
  return body.result?.data?.json;
}

/* ---------- 1. 测试账号（重置 → 建号 → 放行报告） ---------- */
const conn = await mysql.createConnection(process.env.DATABASE_URL!);
if (!KEEP) {
  await conn.query("DELETE FROM assessment_results WHERE user_id IN (SELECT id FROM users WHERE phone = ?)", [PHONE]);
  await conn.query("DELETE FROM student_profile WHERE user_id IN (SELECT id FROM users WHERE phone = ?)", [PHONE]);
  await conn.query("DELETE FROM users WHERE phone = ?", [PHONE]);
  const [ins] = await conn.query(
    "INSERT INTO users (unionId, name, phone, password_hash, role) VALUES (?,?,?,?, 'user')",
    [`sim-${Date.now()}`, "陈小明", PHONE, hashPassword(PASSWORD)],
  );
  const uid = (ins as { insertId: number }).insertId;
  /* onboarded + report_released：不放开这两项，登录会被引导页拦住、报告页是上锁的 */
  await conn.query("INSERT INTO student_profile (user_id, name, grade, onboarded, report_released) VALUES (?,?,?,1,1)", [
    uid,
    "陈小明",
    "初二",
  ]);
  console.log(`测试学生已建：userId=${uid} 手机号=${PHONE} 密码=${PASSWORD}`);
}

await call("auth.loginPhone", { phone: PHONE, password: PASSWORD }, "POST");

/* ---------- 2. 家长卷作答（爸爸偏 D、妈妈偏 I，故意错开） ---------- */
const paper = await call("assessment.familyParentPaper");

function answerParent(shift: number) {
  const items: Record<string, number> = {};
  let scene = "homework";
  (paper.items as any[]).forEach((q, i) => {
    if (q.kind === "scene") {
      scene = ["homework", "phone", "sleep", "score", "friend", "privacy"][(shift + i) % 6]!;
      return;
    }
    if (q.kind === "scale5") items[q.id] = 1 + ((shift + i * 3) % 5);
    else if (q.kind === "mirror") items[q.id] = (shift + i * 2) % 6;
    else items[q.id] = 1 + ((shift + i) % 4);
  });
  const most = (paper.disc as unknown[]).map((_, i) => (shift + i) % 4);
  const least = most.map((m) => (m + shift + 1) % 4);
  return { items, scene, disc: { most, least } };
}

if (!KEEP) {
  /* 学生侧：关系卷 10 题 + DISC + 学业诊断（缺学业诊断，报告第 9 页的盲区表是空的） */
  const dadDisc = answerParent(1).disc;
  await call(
    "assessment.submit",
    {
      kind: "familystudent",
      answers: {
        pack: "standard",
        items: Object.fromEntries(["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10"].map((id, i) => [id, 1 + ((i * 2) % 5)])),
        scene: "homework",
        condition: {},
        disc: dadDisc,
      },
    },
    "POST",
  );
  await call("assessment.submit", { kind: "disc", answers: dadDisc }, "POST");
  await call(
    "assessment.submit",
    {
      kind: "e3",
      answers: {
        stage: "junior",
        ratings: Array.from({ length: 70 }, (_, i) => [3, 4, 2, 3, 5][i % 5]!),
        motivation: "C",
        subjects: [
          { name: "数学", liking: 3, mastery: 3, exam: 3, lastScore: 96, fullScore: 120, weakest: "二次函数" },
          { name: "英语", liking: 4, mastery: 4, exam: 4, lastScore: 108, fullScore: 120, weakest: "完形填空" },
        ],
        lossReasons: ["粗心", "方法不对"],
        scoreTrend: "基本稳定",
        lifeEvents: Array.from({ length: 8 }, () => 0),
        openAnswers: ["数学二次函数老是绕不出来。", "想把错题本真正用起来。", "半年后数学稳定在 105 分以上。"],
      },
    },
    "POST",
  );
  /* 爸爸：登录态提交（学生自己把家长卷拿给爸爸，在孩子的账号里填） */
  const dad = answerParent(1);
  await call("assessment.submit", { kind: "familyparent", answers: { pack: "standard", respondent: "dad", label: "爸爸", ...dad } }, "POST");
}

/* ---------- 3. 妈妈扫码补填（公开接口，和上面那个登录态分属两条写入路径） ---------- */
const fc = await call("assessment.familyCode");
const mom = answerParent(2);
const before = await call("assessment.familyFull");
console.log(`家庭码 ${fc.code} · 补填前 parent2=${before.has.parent2}`);
await call(
  "assessment.submitFamilyParent",
  { code: fc.code, answers: { pack: "standard", respondent: "mom", label: "妈妈", ...mom } },
  "POST",
);

/* ---------- 4. 读回三份报告的取数，核对第二位家长是否真的进去了 ---------- */
const full = await call("assessment.familyFull");
const latest = await call("assessment.latest");
const discLabels = (latest.discParents ?? []).map((p: { label: string }) => p.label);
const parentRows = full.report.appendix.parentRows as { text: string; choice: string; altChoice?: string }[];
const rows = [
  { 检查项: "家庭教育报告 · 识别到第二位家长", 结果: full.has.parent2 ? "是" : "否" },
  { 检查项: "家庭教育报告 · 对照块 alt", 结果: full.report.alt ? `有（${full.report.alt.label}）` : "无" },
  { 检查项: "附录家长表 · 对照列有值", 结果: `${parentRows.filter((r) => r.altChoice != null).length}/${parentRows.length} 行` },
  { 检查项: "冲突报告 / 锦囊 · 家长 DISC 份数", 结果: `${discLabels.length} 份（${discLabels.join("、")}）` },
  { 检查项: "报告主角 DISC 是否仍是爸爸", 结果: full.report.disc?.parent?.primary ?? "—" },
];
console.table(rows);

const [counts] = await conn.query(
  `SELECT kind, JSON_UNQUOTE(JSON_EXTRACT(answers,'$.label')) AS label,
          JSON_UNQUOTE(JSON_EXTRACT(answers,'$.via')) AS via
   FROM assessment_results WHERE user_id = (SELECT id FROM users WHERE phone = ?) ORDER BY id`,
  [PHONE],
);
console.table(counts);
await conn.end();

console.log(`\n打开看：${BASE.replace("/api/trpc", "")}/f/${fc.code}（家长扫码页）`);
console.log(`学生视角：${BASE.replace("/api/trpc", "")}/report-detail?tab=family`);
process.exit(0);
