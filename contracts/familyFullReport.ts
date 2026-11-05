/**
 * 家庭教育认知报告 · 完整版取数层（v250）
 *
 * 输入是四份原始作答（孩子关系卷 10 题、家长卷 55 题、亲子 DISC 各 24 组、孩子 E3 70 题 + 心理量表 16 题），
 * 输出是 13 页报告要用的全部字段。**渲染层不许再算任何东西**——否则同一份数据在两台机器上
 * 会算出两种说法，这是 v236 那份短报告留下的教训。
 *
 * 四条判定口径（改文案前先看这里）：
 * 1. 台阶「取低不取高」：孩子说通、家长说断，按断算；只有一边作答标 singleSide，不当结论。
 * 2. DISC 折百分制：净分 −24…+24 线性映到 0…100（50 = 中性）。四维合计恒为 200，
 *    所以只能横向比、不能纵向加。
 * 3. 盲区只用「家长猜 vs 孩子答」同题对照算差，差 ≥1.5 才算盲区。
 * 4. 安全感两维只给位置，不给诊断词。
 */
import { E3V37_QUESTIONS, type E3V37Stage } from "./e3v37";
import {
  DISC_PARENT_V2_GROUPS,
  DISC_V2_GROUPS,
  scoreDiscV2,
  type DiscV2Answers,
} from "./assessments";
import {
  FAMILY_SCENE_LABEL,
  FAMILY_PARENT_FULL_ITEMS,
  FAMILY_STUDENT_REL_ITEMS,
  FP5,
} from "./familyFullPaper";

export type Band = "断" | "勉强" | "通" | "稳" | "未测";
export type Disc4 = "D" | "I" | "S" | "C";

const LEVEL_NAME: Record<string, string> = {
  L1: "有事第一个找你",
  L2: "什么都愿意说",
  L3: "吵完还能说话",
  L4: "规矩能商量",
  L5: "他的事他定",
};

const LEVEL_MEANING: Record<string, string> = {
  L1: "求助的默认对象是不是你",
  L2: "主动开口的意愿，不是被动回答",
  L3: "冲突之后能不能修复",
  L4: "规矩是单方下达还是可协商",
  L5: "自主权交出去了没有",
};

const DISC_NAME: Record<Disc4, string> = { D: "支配型", I: "影响型", S: "稳健型", C: "谨慎型" };
const DISC_ORDER: Disc4[] = ["D", "I", "S", "C"];

/* ------------------------------------------------------------------ */
/* 一、输入 / 输出类型                                                 */
/* ------------------------------------------------------------------ */

export type MentalBrief = {
  /** GAD-7 原始分 0—21 */
  anxiety: number;
  /** PHQ-9 原始分 0—27 */
  mood: number;
  /** 第 9 题（自伤念头）原始分 0—3 */
  selfHarm: number;
};

export type FullReportInput = {
  meta: {
    studentName: string;
    grade: string;
    age: number | null;
    respondent: "dad" | "mom" | "other";
    respondentLabel?: string;
    date: Date;
    reportNo?: string;
    consultant?: string;
  };
  /** 孩子关系卷：S01—S10 → 1—5 */
  studentRel: Record<string, number>;
  /** 家长卷：P01—P55 → 选值（mirror 0—5；其余 1—5；choice 为下标 0 起） */
  parentItems: Record<string, number>;
  /** 家长卷场景题（P55）所选场景 key */
  parentScene?: string | null;
  /** 亲子 DISC：优先用原始作答（most/least），没有就直传已算好的四维分 */
  studentDisc?: DiscV2Answers | null;
  parentDisc?: DiscV2Answers | null;
  studentDiscDims?: Record<Disc4, number> | null;
  parentDiscDims?: Record<Disc4, number> | null;
  /** 孩子 E3 70 题原始分（未反向），没做过就传 null */
  e3Ratings?: number[] | null;
  /** 心理量表（PHQ-9 + GAD-7），没做过传 null */
  mental?: MentalBrief | null;
  /** 学段，默认初中 */
  stage?: E3V37Stage;
};

export type LadderRow = {
  level: string;
  name: string;
  meaning: string;
  verdict: Band;
  parentQ: string;
  parentOpt: string;
  childQ: string;
  childOpt: string;
  singleSide: boolean;
  parentScore: number;
  childScore: number;
};

export type DiscSide = {
  dims: Record<Disc4, number>;
  pct: Record<Disc4, number>;
  primary: Disc4;
  second: Disc4;
  label: string;
};

export type DeviationItem = { no: number; text: string; choice: string; score: number; why: string };
export type DeviationGroup = { name: string; items: DeviationItem[] };

export type BlindRow = { key: string; label: string; parentGuess: string; childReal: string; low: boolean };

export type SceneRow = {
  key: string;
  name: string;
  say: string;
  hold: string;
  mine: string;
  plan: string;
  hot: boolean;
};

export type FamilyFullReport = {
  meta: {
    studentName: string;
    grade: string;
    ageText: string;
    respondentLabel: string;
    dateText: string;
    reportNo: string;
    consultant: string;
    counts: { parentItems: number; studentRel: number; discGroups: number; mentalItems: number; e3: number };
    sourceLine: string;
  };
  ladder: {
    rows: LadderRow[];
    headline: string;
    verdictText: string;
    firstBroken: string | null;
    shaky: string[];
    strong: string[];
  };
  disc: {
    parent: DiscSide | null;
    child: DiscSide | null;
    diffs: Record<Disc4, number> | null;
    cell: { row: Disc4; col: Disc4 } | null;
    headline: string;
    sub: string;
    cellNote: string;
    danger: string;
  };
  stage: {
    age: number | null;
    name: string;
    duties: string[];
    demandPct: number;
    warmthPct: number;
    demand: number;
    warmth: number;
    styleLine: string;
  };
  security: {
    parent: { avoid: number; anxiety: number } | null;
    child: { avoid: number; anxiety: number } | null;
    zone: string;
    gap: string;
  };
  deviation: { groups: DeviationGroup[]; total: number; summary: string; hasData: boolean };
  motive: { rows: { key: string; label: string; now: string; plain: string; ok: boolean }[]; hit: number; verdict: string };
  blind: BlindRow[];
  /** PART00「日常在场」用的那条投入证据：分最高的一项 */
  invest: { q: string; score: number; count: number };
  scenes: SceneRow[];
  plan: {
    firstBroken: string | null;
    childInitiate: string;
    conflictClose: string;
    moodBand: string;
    ladderBand: string;
  };
  appendix: {
    studentRows: { no: number; area: string; text: string; score: number; note: string }[];
    parentRows: { text: string; choice: string; gap: string; bad: boolean }[];
    parentDisc: string;
    childDisc: string;
    mental: string;
    validity: string;
  };
};

/* ------------------------------------------------------------------ */
/* 二、小工具                                                          */
/* ------------------------------------------------------------------ */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const pct5 = (v: number) => Math.round(((clamp(v, 1, 5) - 1) / 4) * 100);

function bandOf(score: number): Band {
  if (score <= 0) return "未测";
  if (score <= 1.5) return "断";
  if (score < 3.5) return "勉强";
  if (score < 4.5) return "通";
  return "稳";
}

function optText(list: readonly string[], v: number | undefined, fallback = "未答"): string {
  if (v == null) return fallback;
  return list[v - 1] ?? list[v] ?? fallback;
}

/** 四道管教题均分（1—5），供附录「要求/回应从哪来」引用。 */
function avg4(items: Record<string, number>, ids: string[]): number {
  const vs = ids.map((id) => items[id] ?? 0).filter((v) => v > 0);
  return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : 0;
}

const dateCN = (d: Date) => `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;

/* ------------------------------------------------------------------ */
/* 三、分模块计分                                                      */
/* ------------------------------------------------------------------ */

/** 五级台阶：双方各自均分后取低。 */
function buildLadder(studentRel: Record<string, number>, parentItems: Record<string, number>): FamilyFullReport["ladder"] {
  const rows: LadderRow[] = ["L1", "L2", "L3", "L4", "L5"].map((level, i) => {
    const sId = `S0${i + 1}`;
    const pId = `P3${3 + i}`;
    const child = studentRel[sId] ?? 0;
    const parent = parentItems[pId] ?? 0;
    const singleSide = !child || !parent;
    const lower = singleSide ? child || parent : Math.min(child, parent);
    return {
      level,
      name: LEVEL_NAME[level],
      meaning: LEVEL_MEANING[level],
      verdict: singleSide && !lower ? "未测" : bandOf(lower),
      parentQ: FAMILY_PARENT_FULL_ITEMS.find((x) => x.id === pId)?.text ?? "",
      parentOpt: optText(FP5, parent),
      childQ: FAMILY_STUDENT_REL_ITEMS.find((x) => x.id === sId)?.text ?? "",
      childOpt: optText(FP5, child),
      singleSide,
      parentScore: parent,
      childScore: child,
    };
  });

  const broken = rows.filter((r) => r.verdict === "断");
  const shaky = rows.filter((r) => r.verdict === "勉强").map((r) => r.level);
  const strong = rows.filter((r) => r.verdict === "通" || r.verdict === "稳").map((r) => r.level);
  const firstBroken = broken[0]?.level ?? null;

  const headline = broken.length
    ? `五个台阶，你们停在了${cnNum(broken[0].level)}级`
    : shaky.length
      ? `五级都在，但${shaky.map(cnNum).join("、")}级是勉强的`
      : "五级基本都通，底子是好的";

  const verdictText = broken.length
    ? `不是四件事坏了，是第${cnNum(broken[0].level)}级断了。他不说真话，你就只能靠猜；猜错了就去管，一管就吵，吵完没人先开口——第${broken
        .slice(1)
        .map((b) => cnNum(b.level))
        .join("、") || "三、四"}级是被拖下水的。`
    : shaky.length
      ? `没有整级断掉，但第${shaky.map(cnNum).join("、")}级是勉强的——门还开着，推起来费劲。先从最下面那一级开始。`
      : "五级都通，这种情况下一份报告的重点不是修补，是把已经通的那几级用起来。";

  return { rows, headline, verdictText, firstBroken, shaky, strong };
}

function cnNum(level: string): string {
  return ({ L1: "一", L2: "二", L3: "三", L4: "四", L5: "五" } as Record<string, string>)[level] ?? level;
}

/** DISC：dims 0—24（12 为中性）→ 百分制 0—100（50 为中性）。 */
function buildDiscSide(
  ans: DiscV2Answers | null | undefined,
  groups: typeof DISC_V2_GROUPS,
  dimsIn?: Record<Disc4, number> | null,
): DiscSide | null {
  const dims = dimsIn ?? (ans && ans.most?.length === groups.length ? scoreDiscV2(ans, groups).dims : null);
  if (!dims) return null;
  const pct: Record<Disc4, number> = { D: 0, I: 0, S: 0, C: 0 };
  for (const k of DISC_ORDER) pct[k] = Math.round((dims[k] / 24) * 100);
  const ranked = [...DISC_ORDER].sort((a, b) => dims[b] - dims[a] || DISC_ORDER.indexOf(a) - DISC_ORDER.indexOf(b));
  return {
    dims,
    pct,
    primary: ranked[0],
    second: ranked[1],
    label: `${ranked[0]} ${DISC_NAME[ranked[0]]}`,
  };
}

const DISC_TRAIT: Record<Disc4, { fast: string; slow: string }> = {
  D: { fast: "快、定、要结果", slow: "他的「推动」，在你那儿是「压」" },
  I: { fast: "热、说、要回应", slow: "他的「热」，在你那儿是「吵」" },
  S: { fast: "慢、忍、不表态", slow: "他的「沉默」，在你那儿是「同意」" },
  C: { fast: "细、准、要标准", slow: "他的「较真」，在你那儿是「挑剔」" },
};

const CELL_GRID: Record<string, string> = {
  "D-D": "都争说了算|各划一块地盘",
  "D-I": "你打断他|让他说完再反应",
  "D-S": "你催他退|提前说，给缓冲",
  "D-C": "你只要结果|先给理由再给期限",
  "I-D": "你话太多|说重点",
  "I-I": "都热闹没人收尾|定一个人收尾",
  "I-S": "你热他躲|降低强度",
  "I-C": "你随意他较真|先说清标准",
  "S-D": "你忍他逼|说出底线",
  "S-I": "你被带着走|先定节奏",
  "S-S": "谁都不说|轮流开口",
  "S-C": "你回避他追问|正面回答一次",
  "C-D": "你讲理他要快|结论先行",
  "C-I": "你挑错他炸|先说好的",
  "C-S": "标准太高他够不着|降到能开始",
  "C-C": "互相较真|约定「够了」的标准",
};

function buildDisc(child: DiscSide | null, parent: DiscSide | null): FamilyFullReport["disc"] {
  if (!child || !parent) {
    return {
      parent,
      child,
      diffs: null,
      cell: null,
      headline: "两边都答了 DISC，这一页才画得出来",
      sub: "缺一份就先留白，不拿默认值替你填。",
      cellNote: "",
      danger: "",
    };
  }
  const diffs: Record<Disc4, number> = { D: 0, I: 0, S: 0, C: 0 };
  for (const k of DISC_ORDER) diffs[k] = parent.pct[k] - child.pct[k];
  const cell = { row: parent.primary, col: child.primary };
  const cellText = CELL_GRID[`${cell.row}-${cell.col}`] ?? "|";
  const [say, act] = cellText.split("|");
  const headline = `你是 ${parent.primary}，他是 ${child.primary}：一个在催，一个在退`;
  const pFast = DISC_TRAIT[parent.primary];
  const cFast = DISC_TRAIT[child.primary];
  const sub = `差一个维度还能调，差两个维度，同一句话在两边理解完全相反。你们差 ${countDiff(diffs)} 个。`;
  const cellNote = `橙色是你们家：家长 ${parent.primary} × 孩子 ${child.primary}——${say}。${act}，是这一格唯一有效的一句。`;
  const danger =
    child.primary === "S"
      ? "最危险的一条：你把「不吭声」当成了「同意」。他不是同意，是在忍。忍到某天突然爆发，你还会觉得莫名其妙——而那一天，通常离大考不远。"
      : `最危险的一条：${pFast.slow}。${cFast.slow}。这两个误读每天都在发生，而且都不出声。`;
  return { parent, child, diffs, cell, headline, sub, cellNote, danger };
}

function countDiff(d: Record<Disc4, number>): number {
  return DISC_ORDER.filter((k) => Math.abs(d[k]) >= 25).length;
}

const STAGE_BANDS: { max: number; name: string; duties: string[] }[] = [
  { max: 11, name: "习惯建立期", duties: ["把「开始做」变成不用想就会做的动作", "知道做完了是什么样", "有人在旁边，但不用一直盯"] },
  { max: 13, name: "过渡期", duties: ["从「被安排」慢慢走到「参与安排」", "允许他有一次说「我不想」", "把评价和结果分开说"] },
  { max: 17, name: "自我确认期", duties: ["我能自己决定一些事", "我的情绪是被允许的", "我在同伴里有位置"] },
  { max: 99, name: "自主期", duties: ["他的事他自己定", "你从「管」退到「问」", "只在被邀请时给建议"] },
];

function buildStage(age: number | null, parentItems: Record<string, number>): FamilyFullReport["stage"] {
  const band = STAGE_BANDS.find((b) => (age ?? 14) <= b.max) ?? STAGE_BANDS[1];
  const demandItems = ["P38", "P39", "P40", "P41"].map((id) => parentItems[id] ?? 0).filter((v) => v > 0);
  const warmthRaw = [
    parentItems.P42 ?? 0,
    parentItems.P43 ?? 0,
    parentItems.P44 ?? 0,
    parentItems.P45 ? 6 - parentItems.P45 : 0,
  ].filter((v) => v > 0);
  const demand = demandItems.length ? demandItems.reduce((a, b) => a + b, 0) / demandItems.length : 0;
  const warmth = warmthRaw.length ? warmthRaw.reduce((a, b) => a + b, 0) / warmthRaw.length : 0;
  const styleLine =
    demand >= 3.5 && warmth < 3
      ? "规矩多，商量少"
      : demand >= 3.5
        ? "要求高，也留了商量的口子"
        : warmth >= 3
          ? "关系不差，但边界松"
          : "两头都低，你自己也没余量了";
  return {
    age,
    name: band.name,
    duties: band.duties,
    demandPct: Math.round(demand * 20),
    warmthPct: Math.round(warmth * 20),
    demand: Math.round(demand * 20),
    warmth: Math.round(warmth * 20),
    styleLine,
  };
}

function buildSecurity(
  studentRel: Record<string, number>,
  parentItems: Record<string, number>,
): FamilyFullReport["security"] {
  const sAvoid = studentRel.S09 ?? 0;
  const sAnx = studentRel.S10 ?? 0;
  const pAvoid = parentItems.P54 ?? 0;
  const pAnx = parentItems.P53 ?? 0;
  const child = sAvoid || sAnx ? { avoid: pct5(sAvoid), anxiety: pct5(sAnx) } : null;
  const parent = pAvoid || pAnx ? { avoid: pct5(pAvoid), anxiety: pct5(pAnx) } : null;
  const zoneOf = (v: { avoid: number; anxiety: number }) =>
    v.anxiety >= 50 ? (v.avoid >= 50 ? "混乱型" : "焦虑型") : v.avoid >= 50 ? "回避型" : "安全型";
  const zone = child ? zoneOf(child) : "未测";
  const same = child && zoneOf(parent ?? child) === zone;
  const gap = child && parent ? (same ? "同一区域 · 都在回避" : `不在同一片区域：你偏${zoneOf(parent)}，他偏${zone}`) : "";
  return { parent, child, zone, gap };
}

/* ---------------------------- 偏离题（PART05） ---------------------------- */

const DEVIATION_WHY: Record<number, string> = {
  3: "目标是外面给的",
  8: "答不出自己的理由",
  13: "「我能做到」的来源",
  18: "韧劲中等，不是关键项",
  24: "计划落不了地",
  28: "启动要靠人推，不是不会做",
  36: "没有固定节奏",
  40: "手机填的是空档，不是爱好",
  44: "错了不回头看",
  50: "作息不保，是很多项的底层",
  54: "分数等于自我价值",
  55: "情绪持续偏低",
  57: "谈学习＝有压力",
  60: "关系不差，是资源",
  62: "环境项正常",
  65: "一玩就停不下来",
};

/** 表格里只放「节选」，原版就是这么排的：题干太长会把整页撑开。 */
const DEVIATION_SHORT: Record<number, string> = {
  3: "我清楚自己今年要达到的目标",
  8: "我知道自己为什么学习",
  13: "我相信方法对就能学得好",
  18: "考试失利后我能较快调整",
  22: "课前我会预习，带着疑问听课",
  24: "我能按计划完成当天的任务",
  26: "学完一章我会画图或列表串起来",
  28: "我会主动安排复习，不用人催",
  36: "我每天有计划，大部分能完成",
  40: "放下手机就不知道干什么",
  44: "我会写复盘小结优化学习",
  50: "我最近睡眠规律、能睡够",
  51: "我早上起来还是觉得很累",
  52: "我白天上课容易犯困、走神",
  54: "我觉得自己没什么价值",
  55: "我最近经常烦躁、低落",
  57: "父母和我谈学习时情绪稳定",
  60: "朋友同学会常和我谈学习",
  62: "我有安静固定的学习位置",
  65: "一玩起来就停不下来",
};

const DEVIATION_GROUP: Record<number, string> = {
  24: "学习执行", 28: "学习执行", 36: "学习执行", 44: "学习执行", 22: "学习执行", 26: "学习执行",
  50: "情绪与状态", 51: "情绪与状态", 52: "情绪与状态", 53: "情绪与状态", 54: "情绪与状态", 55: "情绪与状态", 40: "情绪与状态", 65: "情绪与状态",
  57: "家庭关系", 58: "家庭关系", 59: "家庭关系", 60: "家庭关系",
  3: "目标与意义", 8: "目标与意义", 4: "目标与意义", 9: "目标与意义",
};

function buildDeviation(ratings: number[] | null | undefined, stage: E3V37Stage): FamilyFullReport["deviation"] {
  if (!ratings || ratings.length < 70) {
    return { groups: [], total: 0, summary: "", hasData: false };
  }
  const bank = E3V37_QUESTIONS[stage] ?? E3V37_QUESTIONS.junior;
  const groups = new Map<string, DeviationItem[]>();
  for (const q of bank) {
    const raw = ratings[q.no - 1];
    if (raw == null) continue;
    /* 偏离口径：2 分及以下、负面表述拿到 4 分，以及「目标与意义」两题拿到 3 分（明显偏弱） */
    const weakThree = raw === 3 && [3, 8].includes(q.no);
    const bad = q.reverse ? raw >= 4 : raw <= 2 || weakThree;
    if (!bad) continue;
    const g = DEVIATION_GROUP[q.no];
    if (!g) continue;
    const arr = groups.get(g) ?? [];
    arr.push({
      no: q.no,
      choice: FP5[raw - 1] ?? "",
      text: DEVIATION_SHORT[q.no] ?? (q.text.length > 14 ? `${q.text.slice(0, 14)}…` : q.text),
      score: raw,
      why: DEVIATION_WHY[q.no] ?? (q.reverse ? "这条是负面表述，答得越高越说明问题" : "这一项明显偏弱"),
    });
    groups.set(g, arr);
  }
  const order = ["学习执行", "情绪与状态", "家庭关系", "目标与意义"];
  const out = order.filter((k) => groups.has(k)).map((k) => ({ name: k, items: groups.get(k)! }));
  const total = out.reduce((a, g) => a + g.items.length, 0);
  const top = out[0];
  const summary = total
    ? `${cnNum2(total)}项偏离里，${cnNum2(top.items.length)}项集中在「${top.name}」${out[1] ? `和「${out[1].name}」` : ""}。这不是态度问题——他现在想动，启动不了；想学，撑不住。`
    : "这一次没有明显偏离的题，说明现在的学习状态在正常区间。";
  return { groups: out, total, summary, hasData: true };
}

function cnNum2(n: number): string {
  return ["零", "一", "两", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十"][n] ?? String(n);
}

/* ---------------------------- 动力四问（PART06） ---------------------------- */

function buildMotive(ratings: number[] | null | undefined, studentRel: Record<string, number>): FamilyFullReport["motive"] {
  const at = (no: number) => (ratings && ratings[no - 1] != null ? ratings[no - 1] : 0);
  const rows = [
    {
      key: "own",
      label: "自己能定",
      now: at(36) <= 2 ? "时间表、补习、作息，全由你们定" : "有些事他自己能说了算",
      plain: at(36) <= 2 ? "时间表、补习、作息，全由你们定" : "有些事他自己能说了算",
      ok: at(36) >= 4,
    },
    {
      key: "can",
      label: "我能做到",
      now: at(13) ? `相信「我能学好」${at(13) * 20}，实际做不动 ${at(24) * 20}` : "未答",
      plain: at(24) <= 2 ? "有自信，没手感——最像「懒」的那种状态" : "信心和方法都在往上走",
      ok: at(24) >= 4,
    },
    {
      key: "with",
      label: "有人跟我一伙",
      now: at(60) ? `${at(60) * 20} 分` : "未答",
      plain: at(60) >= 4 ? "朋友那边有，家里没有" : "学习是他一个人扛，没人陪",
      ok: at(60) >= 4 && (studentRel.S02 ?? 0) >= 4,
    },
    {
      key: "why",
      label: "知道这有什么用",
      now: at(8) <= 3 ? "目标是外面给的，他没参与" : "他自己有答案，不用你给理由",
      plain: at(8) <= 3 ? "问他「为什么学」，只能答「要考试」" : "自己有答案，不用你给理由",
      ok: at(8) >= 4,
    },
  ];
  const hit = rows.filter((r) => r.ok).length;
  const verdict = hit <= 1
    ? "四样里只占一样，就是「推一下动一下」——不是懒，是动力装在别人手里。"
    : hit === 2
      ? "四样里占两样，勉强能自己转，但一遇挫就停。"
      : `四样里占 ${hit} 样，这套动力是能自己转的，别再往里加推力。`;
  return { rows, hit, verdict };
}

/* ---------------------------- 家庭投入（PART00 证据） ---------------------------- */

const INVEST_LABEL: Record<string, string> = {
  P46: "我每天能陪孩子说上话的时间（不谈学习）",
  P47: "家里在孩子学习上的花销",
  P48: "我了解孩子的朋友和日常在做什么",
  P49: "我会跟孩子聊他感兴趣的事，不只是学习",
  P50: "孩子需要的资料和工具，我能及时给他备齐",
};

function buildInvest(items: Record<string, number>): { q: string; score: number; count: number } {
  const answered = Object.keys(INVEST_LABEL).filter((id) => (items[id] ?? 0) > 0);
  let best = { q: "我了解孩子的朋友和日常在做什么", score: 0 };
  for (const id of answered) {
    const v = items[id] ?? 0;
    if (v > best.score) best = { q: INVEST_LABEL[id], score: v };
  }
  return { q: best.q, score: best.score, count: answered.length };
}

/* ---------------------------- 三条盲区（PART06 三） ---------------------------- */

function buildBlind(parentItems: Record<string, number>, ratings: number[] | null | undefined): BlindRow[] {
  if (!ratings || ratings.length < 70) return [];
  const at = (no: number) => ratings[no - 1] ?? 0;
  /* 家长条件观察：0 好 / 1 中 / 2 差 / 3 不了解（P10 状态、P11 亲子、P12 师生、P16 手机） */
  const obs = (id: string) => parentItems[id] ?? 3;
  return [
    {
      key: "phone",
      label: "手机",
      parentGuess: ["用得很少", "娱乐为主，但还可以控", "明显失控", "说不清"][obs("P16")] ?? "说不清",
      childReal: at(40) >= 4 ? "一放下就空得慌，超时也忍不住" : "能自己收住",
      low: at(40) >= 4 && obs("P16") < 2,
    },
    {
      key: "mood",
      label: "情绪",
      parentGuess: ["状态不错", "偶尔疲惫，情绪一般", "经常不好", "说不清"][obs("P10")] ?? "说不清",
      childReal: at(55) >= 4 ? "经常烦躁、低落，不想说话" : "情绪总体平稳",
      low: at(55) >= 4 && obs("P10") < 2,
    },
    {
      key: "friend",
      label: "朋友",
      parentGuess: ["关系促进学习", "同学关系影响不大", "有明显消极影响", "说不清"][obs("P12")] ?? "说不清",
      childReal: at(60) >= 4 ? "身边的朋友常和我谈学习，促进我学习" : "朋友那边帮不上学习",
      low: at(60) >= 4 && obs("P12") >= 1,
    },
  ];
}

/* ---------------------------- 六句话（PART08） ---------------------------- */

const SCENE_SCRIPT: Record<string, Omit<SceneRow, "key" | "name" | "hot">> = {
  homework: {
    say: "「等会儿就写」",
    hold: "是不是一想到要写，就不想开始？",
    mine: "我看你一直没动，心里急，也怕你睡太晚",
    plan: "先从哪科开始？写 15 分钟，到点再看",
  },
  phone: {
    say: "「马上，就一会儿」",
    hold: "是不是一放下，就不知道干什么？",
    mine: "我看你停不下来，有点着急，也怕你睡不够",
    plan: "睡前一小时放客厅，放哪儿你选",
  },
  sleep: {
    say: "「我不困」",
    hold: "是不是躺下也睡不着？",
    mine: "我担心你睡不够，第二天上课撑不住",
    plan: "明天几点起？倒推一下，今晚几点上床",
  },
  score: {
    say: "「反正我也考不好」",
    hold: "这次考成这样，你自己也挺难受的吧",
    mine: "听你这么说，我心里也不好受",
    plan: "哪科最意外？我们一起看看哪儿出的问题",
  },
  friend: {
    say: "「你不懂，别管了」",
    hold: "是不是觉得我一问，就是在查你？",
    mine: "我确实有点担心，但更想听你说",
    plan: "你们最近一起干什么？说一件就行",
  },
  privacy: {
    say: "「别进来，敲门」",
    hold: "是不是觉得我一进来就是在查你？",
    mine: "我有时候确实不放心，会想看看",
    plan: "以后我敲门，你也说一声什么时候方便",
  },
};

function buildScenes(sceneKey: string | null | undefined): SceneRow[] {
  /* 行序固定为「作业 / 手机 / 作息 / 成绩 / 交友 / 关门」，与原版一致；
     家里最常吵的那一件只做高亮，不重排——重排后家长对不上自己刚选的那一项。 */
  const order: string[] = ["homework", "phone", "sleep", "score", "friend", "privacy"];
  void sceneKey;
  return order.map((k) => ({
    key: k,
    name: FAMILY_SCENE_LABEL[k as keyof typeof FAMILY_SCENE_LABEL] ?? k,
    hot: k === sceneKey,
    ...SCENE_SCRIPT[k],
  }));
}

/* ---------------------------- 心理量表分级 ---------------------------- */

export function anxietyBand(score: number): string {
  if (score <= 4) return "正常区间";
  if (score <= 9) return "轻度区间";
  if (score <= 14) return "中度区间";
  return "重度区间";
}
export function moodBand(score: number): string {
  if (score <= 4) return "正常区间";
  if (score <= 9) return "轻度区间";
  if (score <= 14) return "中度区间";
  if (score <= 19) return "中重度区间";
  return "重度区间";
}

/* ------------------------------------------------------------------ */
/* 四、总装                                                            */
/* ------------------------------------------------------------------ */

export function buildFamilyFullReport(input: FullReportInput): FamilyFullReport {
  const stage = input.stage ?? "junior";
  const ladder = buildLadder(input.studentRel, input.parentItems);
  const childDisc = buildDiscSide(input.studentDisc, DISC_V2_GROUPS, input.studentDiscDims);
  const parentDisc = buildDiscSide(input.parentDisc, DISC_PARENT_V2_GROUPS, input.parentDiscDims);
  const disc = buildDisc(childDisc, parentDisc);
  const stageInfo = buildStage(input.meta.age, input.parentItems);
  const security = buildSecurity(input.studentRel, input.parentItems);
  const deviation = buildDeviation(input.e3Ratings, stage);
  const motive = buildMotive(input.e3Ratings, input.studentRel);
  const blind = buildBlind(input.parentItems, input.e3Ratings);
  const invest = buildInvest(input.parentItems);
  const scenes = buildScenes(input.parentScene);

  const respondentLabel =
    input.meta.respondentLabel ?? (input.meta.respondent === "dad" ? "爸爸" : input.meta.respondent === "mom" ? "妈妈" : "家长");

  const mental = input.mental ?? null;
  const counts = {
    parentItems: FAMILY_PARENT_FULL_ITEMS.length,
    studentRel: FAMILY_STUDENT_REL_ITEMS.length,
    discGroups: DISC_V2_GROUPS.length,
    mentalItems: 16,
    e3: input.e3Ratings?.length ?? 0,
  };

  /* 附录：学生卷节选 19 题（有 E3 就取报告引用到的那 19 题，没有就空表） */
  /* 报告正文真正引用到的 16 题（附录只列这 16 道，多列的都是凑数） */
  const citedNo = [3, 8, 13, 18, 24, 28, 36, 44, 57, 60, 62, 40, 54, 65, 50, 55];
  const bank = E3V37_QUESTIONS[stage] ?? E3V37_QUESTIONS.junior;
  const studentRows = input.e3Ratings
    ? citedNo
        .map((no) => bank.find((q) => q.no === no))
        .filter((q): q is NonNullable<typeof q> => !!q)
        .map((q) => ({
          no: q.no,
          area: displayDomain(q.ability),
          text: DEVIATION_SHORT[q.no] ?? (q.text.length > 11 ? `${q.text.slice(0, 11)}…` : q.text),
          score: input.e3Ratings![q.no - 1] ?? 0,
          note: DEVIATION_WHY[q.no] ?? "",
        }))
    : [];

  /* 附录家长表：三条「家长猜 vs 孩子答」的差 + 三条管教的来源，与原版结构一致 */
  const mirrorPairs: { pid: string; sno: number; label: string }[] = [
    { pid: "P17", sno: 1, label: "对某些学科本身感兴趣" },
    { pid: "P20", sno: 13, label: "相信自己努力就能学好" },
    { pid: "P22", sno: 18, label: "考试失利后能较快调整" },
  ];
  const parentRows = [
    ...mirrorPairs.map((m) => {
      const pv = input.parentItems[m.pid] ?? 0;
      const sv = input.e3Ratings?.[m.sno - 1] ?? 0;
      const gap = pv && sv ? Math.abs(pv - sv) : 0;
      return {
        text: `他${m.label}`,
        choice: pv ? String(pv) : "—",
        gap: gap >= 1.5 ? `差 ${gap.toFixed(1)}，最大盲区` : gap > 0 ? `差 ${gap.toFixed(1)}` : "基本一致",
        bad: gap >= 1.5,
      };
    }),
    {
      text: "我会规定每天的学习时间",
      choice: String(input.parentItems.P39 ?? 0) || "—",
      gap: `要求 ${Math.round(avg4(input.parentItems, ["P38", "P39", "P40", "P41"]) * 20)} 的来源`,
      bad: false,
    },
    {
      text: "我会先听他说完再回应",
      choice: String(input.parentItems.P42 ?? 0) || "—",
      gap: `回应 ${Math.round(avg4(input.parentItems, ["P42", "P43", "P44"]) * 20)} 的来源`,
      bad: false,
    },
    {
      text: "成绩一不好，我会立刻给他加任务",
      choice: String(input.parentItems.P40 ?? 0) || "—",
      gap: "「有条件的肯定」",
      bad: false,
    },
  ];

  const reportNo =
    input.meta.reportNo ??
    `SH-${input.meta.date.getFullYear()}-${String(input.meta.date.getMonth() + 1).padStart(2, "0")}${String(
      input.meta.date.getDate(),
    ).padStart(2, "0")}-${String(Math.abs(hash(input.meta.studentName)) % 900 + 100)}`;

  return {
    meta: {
      studentName: input.meta.studentName || "同学",
      grade: input.meta.grade || "",
      ageText: input.meta.age ? `${input.meta.grade}（${input.meta.age} 岁）` : input.meta.grade,
      respondentLabel,
      dateText: dateCN(input.meta.date),
      reportNo,
      consultant: input.meta.consultant ?? "唐老师",
      counts,
      sourceLine: `家长卷 ${counts.parentItems} 题 · 家长 DISC ${counts.discGroups} 组 · 孩子关系 ${counts.studentRel} 题 · 孩子 DISC ${counts.discGroups} 组 · 心理量表 ${counts.mentalItems} 题`,
    },
    ladder,
    disc,
    stage: stageInfo,
    security,
    deviation,
    motive,
    blind,
    invest,
    scenes,
    plan: {
      firstBroken: ladder.firstBroken,
      childInitiate: (input.studentRel.S02 ?? 0) >= 3 ? "每周 1 次以上" : "每周 0 次",
      conflictClose: (input.studentRel.S03 ?? 0) >= 3 ? "当天能收场" : "两三天，没人先开口",
      moodBand: mental ? moodBand(mental.mood) : "未测",
      ladderBand: ladder.rows.find((r) => r.level === "L2")?.verdict === "断" ? "L2 断" : "L2 未断",
    },
    appendix: {
      studentRows,
      parentRows,
      parentDisc: parentDisc ? `D ${parentDisc.pct.D} / I ${parentDisc.pct.I} / S ${parentDisc.pct.S} / C ${parentDisc.pct.C}` : "未答",
      childDisc: childDisc ? `D ${childDisc.pct.D} / I ${childDisc.pct.I} / S ${childDisc.pct.S} / C ${childDisc.pct.C}` : "未答",
      mental: mental ? `焦虑 ${anxietyBand(mental.anxiety)}（${mental.anxiety} 分）／情绪 ${moodBand(mental.mood)}（${mental.mood} 分）；自伤条目 ${mental.selfHarm}` : "未测",
      validity: "全部完成，无极端作答",
    },
  };
}

/** 附录里的「域」按报告口径分：乐学 / 会学 / 善学 / 智学 / 条件（智学单列，不并进善学）。 */
function displayDomain(ability: string): string {
  if (ability === "智学") return "智学";
  if (["动力", "信心", "韧劲"].includes(ability)) return "乐学";
  if (["学懂", "记住", "会用"].includes(ability)) return "会学";
  if (["计划", "复盘"].includes(ability)) return "善学";
  return "条件";
}

/** 报告编号里那一小段，取名字的稳定散列，同一孩子每次一致。 */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
