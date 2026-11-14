/**
 * 造一份「高分样本」报告（v253，演示与回归用）。
 *
 * 为什么要这份脚本：随便乱答出来的卷子，匹配度都在 50 上下，
 * 看不出报告在「匹配」和「不匹配」两种情况下分别怎么说话。
 * 这里按目标岗位的权重表反推作答——核心维尽量答满，弱项维度留低——
 * 得到一份像「真的适合这个岗」的答卷，用来检查报告的正向分支。
 *
 * 用法：npx tsx scripts/talent-sample.ts [岗位] [姓名]
 */
import "dotenv/config";
import { BIGFIVE_ITEMS, DUTY_PACKS, EQ_ITEMS, VALUE_ITEMS, WORK_DISC_GROUPS } from "../contracts/talent/bank";
import { JOB_DUTY_PACK, JOB_WEIGHTS, type JobKey, type TalentDim } from "../contracts/talent/score";
import { JOB_EQ_FOCUS } from "../contracts/talent/report";

const BASE = process.argv[4] ?? "http://[::1]:3000/api/trpc";
const JOB = (process.argv[2] ?? "mgmt") as JobKey;
const NAME = process.argv[3] ?? "李静";
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
  if (body.error) throw new Error(`${path}: ${JSON.stringify(body.error).slice(0, 300)}`);
  return body.result?.data?.json;
}

/**
 * 目标岗位要的维度给「很像我」，不要的给「不太像我」——不是全选满分，那样反而失真。
 *
 * SAMPLE_MODE=low 时反过来：把这一岗最看重的几维答低，用来生成一份「暂不匹配」的
 * 对照样本。报告只有在「不合适」的时候说的话最需要被审——不能只留好看的样例。
 */
const LOW = process.env.SAMPLE_MODE === "low";
const w = JOB_WEIGHTS[JOB];
const want = Object.fromEntries(
  (Object.keys(w) as TalentDim[]).map((d) => [d, LOW ? w[d] === 0 : w[d] >= 2]),
) as Record<TalentDim, boolean>;

/* 维度 → 大五题：只给「要的维度」对应的题打高分 */
const BF_TARGET: Record<string, TalentDim[]> = { N: ["stable"], C: ["duty", "detail"], E: ["influence"], A: ["empathy"], O: ["achieve"] };
function bigfiveAnswers() {
  const out: Record<string, number> = {};
  for (const it of BIGFIVE_ITEMS) {
    const vals = BF_TARGET[it.dim] ?? [];
    const high = vals.some((d) => want[d]);
    const target = high ? 5 : 2;
    out[it.id] = it.reverse ? 6 - target : target;
  }
  return out;
}

const VALUE_TARGET: Record<string, TalentDim[]> = { G: ["achieve"], P: ["rule"], M: [], S: [], R: [], A: [] };
function valueAnswers() {
  const out: Record<string, number> = {};
  for (const it of VALUE_ITEMS) {
    const high = (VALUE_TARGET[it.dim] ?? []).some((d) => want[d]);
    out[it.id] = high ? 5 : 3;
  }
  return out;
}

/**
 * 情商：各维给不同水平，岗位焦点维偏高。
 *
 * 全答同一个选项会得到「15 维齐平在 83」的假剖面——真人没有这种事，
 * 报告里的「最低三维」也会因此失去意义。这里用维度名做确定性哈希，
 * 让每一维落在不同档位，同一份脚本每次生成同一个剖面。
 */
function eqAnswers() {
  const out: Record<string, number> = {};
  const focus = new Set<string>(JOB_EQ_FOCUS[JOB] ?? []);
  for (const it of EQ_ITEMS) {
    const seed = [...it.dim].reduce((a, c) => a + c.charCodeAt(0), 0);
    const wave = ((seed * 37) % 100) / 100;
    const base = focus.has(it.dim)
      ? (LOW ? 1.8 + wave * 1.6 : 5.4 + wave)
      : (LOW ? 4.4 + wave * 2.2 : 3.2 + wave * 3);
    const likert = Math.max(1, Math.min(7, Math.round(base)));
    out[it.id] = it.reverse ? 8 - likert : likert;
  }
  return out;
}

/**
 * DISC：按岗位原型给两个「最像」的字母、两个「最不像」的字母，交替投。
 *
 * 全投一个字母会得到 100/50/0/50 这种畸形剖面——那不是一个人，那是一张答题卡。
 * 真实的人总有一两个主导、一两个靠后，所以这里用 2 主 2 次的交替投法。
 */
const DISC_PERSONA: Record<JobKey, { like: ["D" | "I" | "S" | "C", "D" | "I" | "S" | "C"]; unlike: ["D" | "I" | "S" | "C", "D" | "I" | "S" | "C"] }> = {
  sales: { like: ["D", "I"], unlike: ["S", "C"] },
  service: { like: ["S", "C"], unlike: ["D", "I"] },
  admin: { like: ["C", "S"], unlike: ["I", "D"] },
  mgmt: { like: ["D", "S"], unlike: ["I", "C"] },
};

function discAnswers() {
  /* low 模式把原型反过来：这个岗需要的 D/I，他恰好最不像 */
  const base = DISC_PERSONA[JOB];
  const persona = LOW
    ? { like: base.unlike, unlike: base.like }
    : base;
  const most: number[] = [];
  const least: number[] = [];
  WORK_DISC_GROUPS.forEach((g, i) => {
    const want = persona.like[i % 2];
    const avoid = persona.unlike[i % 2];
    const mi = g.types.indexOf(want);
    const li = g.types.indexOf(avoid);
    const m = mi >= 0 ? mi : 0;
    const l = li >= 0 && li !== m ? li : (m + 1) % 4;
    most.push(m);
    least.push(l);
  });
  return { most, least };
}

/** 岗位加测：情境题选最优项，量表题按方向给分 */
function dutyAnswers() {
  const pack = DUTY_PACKS[JOB_DUTY_PACK[JOB]];
  const out: Record<string, number> = {};
  for (const it of pack.items) {
    if (it.kind === "likert") out[it.id] = it.reverse ? 2 : 5;
    else {
      /* low 模式挑最差项：这一岗的情境判断，他每次都选错的那个 */
      const pick = it.options.reduce(
        (bi, o, i) => ((LOW ? o.score < it.options[bi].score : o.score > it.options[bi].score) ? i : bi),
        0,
      );
      out[it.id] = pick;
    }
  }
  return out;
}

await call("auth.loginPhone", { phone: "13900000001", password: "123456" }, "POST");
const r = await call(
  "talent.submit",
  { position: JOB, name: NAME, answers: { bigfive: bigfiveAnswers(), value: valueAnswers(), eq: eqAnswers(), duty: dutyAnswers(), discwork: discAnswers() } },
  "POST",
);
const rep = r.report;
console.log(`报告 #${r.id} · ${rep.meta.name} · ${rep.meta.positionLabel}`);
console.log(`匹配 ${rep.current.score}（${rep.currentBand.label}），完成 ${rep.completeness.pct}%`);
console.log(`四岗：${rep.fits.map((f: { label: string; score: number }) => `${f.label} ${f.score}`).join(" / ")}`);
console.log(`十维：${rep.dims.map((d: { label: string; score: number }) => `${d.label}${d.score}`).join(" ")}`);
console.log(`情商 ${rep.eq?.overall}，强项 ${rep.strengths.length} 条，风险 ${rep.risks.length} 条，缺口 ${rep.current.gaps.length} 个`);
console.log(`报告页：/talent/report/${r.id}`);
