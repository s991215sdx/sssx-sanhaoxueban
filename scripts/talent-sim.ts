/**
 * 人才测评全链路模拟（v253）。
 *
 * 一条命令跑完两条入口：
 *  1) 登录态本人自测（销售咨询师）；
 *  2) HR 出一张码 → 候选人扫码作答（教学服务）。
 * 然后把报告、名单读回来，确认分数、完成度、来源都对。
 *
 * 用法：npx tsx scripts/talent-sim.ts [本机 trpc 地址]
 * 前置：开发服务器已起，库里有账号 13800000001 / 123456（fam-sim.ts 造的）。
 */
import "dotenv/config";

const BASE = process.argv[2] ?? "http://[::1]:3000/api/trpc";
let cookie = "";

async function call(path: string, input?: unknown, method: "GET" | "POST" = "GET") {
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
  const body = await res.json();
  if (body.error) throw new Error(`${path}: ${JSON.stringify(body.error).slice(0, 400)}`);
  return body.result?.data?.json;
}

type Paper = {
  position: string;
  positionLabel: string;
  parts: { key: string; kind: string; items?: { id: string; kind?: string; options?: string[] }[]; groups?: unknown[] }[];
};

/** 造一份「像人答的」卷子：不用全 5 分，也不全选最优项——全优的卷子测不出任何东西。 */
function buildAnswers(paper: Paper, seed: number) {
  const bigfive: Record<string, number> = {};
  const value: Record<string, number> = {};
  const eq: Record<string, number> = {};
  const duty: Record<string, number> = {};
  let discGroups = 0;

  for (const p of paper.parts) {
    if (p.key === "discwork") {
      discGroups = p.groups?.length ?? 0;
      continue;
    }
    (p.items ?? []).forEach((it, i) => {
      const k = (i + seed) % 7;
      if (p.key === "bigfive") bigfive[it.id] = [3, 4, 5, 2, 4, 5, 3][k];
      else if (p.key === "value") value[it.id] = [4, 3, 5, 2, 4, 3, 5][k];
      else if (p.key === "eq") eq[it.id] = [4, 5, 6, 3, 5, 4, 6][k];
      else if (p.key === "duty") {
        const n = it.options?.length ?? 1;
        duty[it.id] = it.options ? Math.min(n - 1, (i + seed) % 3) : [3, 4, 5, 2, 4][k];
      }
    });
  }

  const most = Array.from({ length: discGroups }, (_, i) => (i + seed) % 4);
  const least = most.map((m, i) => (m + 1 + (i % 2)) % 4);
  return { bigfive, value, eq, duty, discwork: { most, least } };
}

const log = (s: string) => console.log(s);

async function main() {
  log("== 0. 登录（讲师账号）");
  /* 用讲师账号：出码、看名单都要 tutor/admin */
  await call("auth.loginPhone", { phone: "13900000001", password: "123456" }, "POST");
  log("   已登录");

  log("== 1. 岗位目录");
  const cat = await call("talent.catalog");
  log(`   四个岗位：${cat.jobs.map((j: { label: string; minutes: number }) => `${j.label}(${j.minutes}分)`).join("、")}`);

  log("== 2. 本人自测（销售咨询师）");
  const paper1 = (await call("talent.paper", { position: "sales" })) as Paper;
  const a1 = buildAnswers(paper1, 1);
  const total1 =
    Object.keys(a1.bigfive).length + Object.keys(a1.value).length + Object.keys(a1.eq).length + Object.keys(a1.duty).length + a1.discwork.most.length;
  log(`   卷子：${paper1.parts.map((p) => `${p.key}${(p.items ?? p.groups ?? []).length}`).join(" / ")}，共答 ${total1} 题`);
  const r1 = await call(
    "talent.submit",
    { position: "sales", name: "唐海陵", answers: { bigfive: a1.bigfive, value: a1.value, eq: a1.eq, duty: a1.duty, discwork: a1.discwork } },
    "POST",
  );
  const rep1 = r1.report;
  log(`   报告 #${r1.id}：匹配 ${rep1.current.score}（${rep1.currentBand.label}），完成 ${rep1.completeness.pct}%`);
  log(`   四岗：${rep1.fits.map((f: { label: string; score: number }) => `${f.label} ${f.score}`).join(" / ")}`);
  log(`   十维：${rep1.dims.map((d: { label: string; score: number }) => `${d.label}${d.score}`).join(" ")}`);
  log(`   情商总分 ${rep1.eq?.overall}（${rep1.eq?.level}）`);
  const discSum = rep1.bigger.disc ? rep1.bigger.disc.D + rep1.bigger.disc.I + rep1.bigger.disc.S + rep1.bigger.disc.C : null;
  log(`   DISC 四维：${rep1.bigger.disc?.D}/${rep1.bigger.disc?.I}/${rep1.bigger.disc?.S}/${rep1.bigger.disc?.C}，合计 ${discSum}`);
  log(`   建议 ${rep1.coaching.length} 条，追问 ${rep1.interview.length} 条，缺口 ${rep1.current.gaps.length} 个`);

  log("== 3. 读回报告（权限：本人）");
  const back = await call("talent.report", { id: r1.id });
  log(`   读回成功：${back.candidateName} · ${back.report.meta.positionLabel} · ${back.source}`);

  log("== 4. HR 出邀请码（教学服务）");
  const inv = await call("talent.invite", { position: "service" }, "POST");
  log(`   码 ${inv.code}（${inv.positionLabel}，7 天）`);

  log("== 5. 候选人扫码（无账号）");
  const savedCookie = cookie;
  cookie = "";
  const info = await call("talent.inviteInfo", { code: inv.code });
  log(`   扫码页看到：${info.inviterName}${info.orgName ? " · " + info.orgName : ""} / ${info.positionLabel} / 约 ${info.minutes} 分钟`);
  const paper2 = (await call("talent.paper", { position: info.position })) as Paper;
  const a2 = buildAnswers(paper2, 3);
  const r2 = await call(
    "talent.submit",
    { code: inv.code, name: "王小雨", position: "sales", answers: { bigfive: a2.bigfive, value: a2.value, eq: a2.eq, duty: a2.duty, discwork: a2.discwork } },
    "POST",
  );
  log(`   交卷成功 #${r2.id}：岗位被锁成 ${r2.report.meta.positionLabel}（请求里塞的 sales 无效），匹配 ${r2.report.current.score}`);
  cookie = savedCookie;

  log("== 6. 名单");
  const list = await call("talent.list", { limit: 10 });
  log(`   共 ${list.total} 份`);
  for (const r of list.rows) log(`   · ${r.candidateName} / ${r.position} / ${r.source} / 匹配 ${r.fitScore} / 完成 ${r.completeness}%`);

  log("== 7. 我的记录");
  const mine = await call("talent.mine");
  log(`   ${mine.length} 条：${mine.map((m: { position: string; fitScore: number }) => `${m.position} ${m.fitScore}`).join("、")}`);

  log("\n全部通过。报告页：/talent/report/" + r1.id + " ，扫码页：/t/" + inv.code);
}

main().catch((e) => {
  console.error("失败：", e.message ?? e);
  process.exit(1);
});
