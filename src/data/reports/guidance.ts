/**
 * V73：升学指导综合报告 2.0——参考市面主流升学/生涯规划报告结构，接入真实成绩因子。
 * 结构：学业现状（得分率+趋势）→ 选科四象限（兴趣×学业）→ 推荐组合（含专业覆盖提示）
 *      → 兴趣/性格/能力解读 → 专业方向（带选科要求与成绩门槛）→ 行业方向
 *      → 升学路径适配 → 行动计划（分阶段）→ 给家长的话。
 * 与学习力综合报告分离：那边管「怎么学得更好」，这边管「往哪里去」。
 */
import type { MbtiResult, DiscResult } from "@contracts/assessments";
import type { Multi5Result, Multi5Key } from "@contracts/multi5";
import type { AcademicsData } from "@contracts/academics";
import { defaultFullScore } from "@contracts/academics";
import type { HollandResult, HollandKey } from "@contracts/holland";
import { HOLLAND_LABEL, buildHollandReport } from "@contracts/holland";
import type { AnchorResult } from "@contracts/careerAnchor";
import { ANCHOR_LABEL, buildAnchorReport } from "@contracts/careerAnchor";
import { MBTI_REPORTS } from "@/data/reports";
import { DISC_REPORTS } from "@/data/reports/disc";
import { buildMulti5Report } from "@contracts/multi5";
import { DISCIPLINE_CATS, SUBJECT_COVERAGE_SCORE, pickSchoolTiers } from "@/data/reports/guidanceData";
import type { SchoolTier } from "@/data/reports/guidanceData";
import { getMajorDetail, getCareerDetail } from "@/data/reports/careerData";
import type { MajorDetail, CareerDetail } from "@/data/reports/careerData";

/* ---------------------------------- 类型 ---------------------------------- */

export type GuidanceRecord = {
  id?: number;
  examName: string;
  subjects: { name: string; fullScore: number | null; lastScore: number | null }[];
  createdAt: string | Date;
};

type Quadrant = "优势学科" | "潜能学科" | "稳健学科" | "谨慎学科" | "待观察";
type PathCat = "主力路径" | "拔尖升学" | "特长升学" | "定向就业" | "国际路线" | "务实备选";
type PathFit = "主力" | "适配" | "关注" | "参考";
export const PATHWAY_CATS: readonly PathCat[] = ["主力路径", "拔尖升学", "特长升学", "定向就业", "国际路线", "务实备选"];

export type GuidanceReport = {
  /** 报告生成依据（已完成的测评）。 */
  basedOn: string[];
  /** 还缺的测评（报告会更准）。 */
  missing: string[];
  headline: string;
  /** 学业现状：成绩因子（得分率/目标差距/趋势）。无成绩为 null。 */
  academicsBlock: {
    examName: string;
    rows: {
      name: string;
      pct: number;
      raw: number;
      full: number;
      targetPct: number | null;
      gap: number | null;
      selfLevel: number | null;
      trend: "up" | "down" | "flat" | null;
      trendPct: number | null;
    }[];
    avgPct: number | null;
  } | null;
  /** 选科四象限：兴趣 × 学业表现。 */
  matrix: { name: string; interest: number; scorePct: number | null; quadrant: Quadrant; note: string }[] | null;
  /** 推荐选科组合（高中=3+1+2 组合；初中=中考发力组合）。 */
  combos: { title: string; stars: 1 | 2 | 3; reason: string; risk?: string }[];
  /** 选科建议总述（兼容旧版字段）。 */
  subjectAdvice: string[];
  mbtiBlock: { type: string; name: string; fieldSlant: string; studyStyle: string[] } | null;
  discBlock: { primary: string; name: string; roleStyle: string; scene: string } | null;
  multi5Block: { label: string; score: number; feature: string; career: string[] }[] | null;
  anchorBlock: { label: string; score: number; workStyle: string; careerFields: string[] }[] | null;
  hollandBlock: { code: string; top3: { key: HollandKey; label: string; score: number; careers: string[]; majors: string[] }[] } | null;
  /** 推荐专业方向（含选科要求与成绩门槛提示）。 */
  majors: { name: string; why: string; req: string | null; gateNote: string | null }[];
  /** 推荐行业方向。 */
  industries: { name: string; why: string }[];
  /** 升学路径适配（六大类全路径，按数据触发 + 条件提示）。 */
  pathway: { cat: PathCat; name: string; fit: PathFit; cond: string | null; note: string }[];
  /** 多测评决策平衡卡（选科打分表）。 */
  scorecard: {
    weights: { name: string; pct: number }[];
    rows: { subject: string; score: number; interest: number; ability: number; coverage: number; total: number; verdict: "强烈推荐" | "推荐" | "可选" | "慎重" }[];
  } | null;
  /** 12 大学科门类匹配度（Top 推荐）。 */
  disciplines: { key: string; name: string; matchPct: number; groups: string[]; majors: string[]; req: string; note: string; why: string }[];
  /** 目标院校规划（预估分 + 冲稳保，仅高中有成绩时）。 */
  schoolPlan: { estScore: number; first: "物理" | "历史"; tier: string; chong: string[]; wen: string[]; bao: string[]; chongNote: string | null; baoNote: string | null } | null;
  /** 首选决策（广东 3+1+2：物理/历史 2 选 1，仅高中）。 */
  firstDecision: { pick: "物理" | "历史"; physScore: number; histScore: number; margin: number; text: string } | null;
  /** 再选决策（化学/生物/道法/地理 4 选 2，仅高中）。 */
  secondDecision: { picks: string[]; dropped: string[]; text: string } | null;
  /** 给家长的话。 */
  parentTips: string[];
  /** 分阶段行动建议。 */
  actionTips: { phase: string; text: string }[];
  /* ---- V84：模仿《智慧生涯测评报告》新增板块 ---- */
  /** 测评结果概览（Part1 风格：每项测评一行结论 + 完成态）。 */
  overview: { label: string; value: string; status: "done" | "todo"; note: string }[];
  /** 霍兰德深度解读：个人侧写 + 各型特征 bullet。 */
  hollandDeep: {
    code: string;
    keywords: string;
    relationNote: string;
    types: { key: HollandKey; label: string; score: number; trait: string; studyImpact: string[] }[];
  } | null;
  /** 距离目标差距表（录了目标分数才生成）。 */
  gapTable: {
    rows: {
      name: string;
      raw: number;
      full: number;
      pct: number;
      targetRaw: number | null;
      targetPct: number | null;
      gapRaw: number | null;
      gapPct: number | null;
    }[];
  } | null;
  /** 学科表现分析：每科一张画像卡（分数/兴趣/能力/趋势/评语）。 */
  subjectCards: {
    name: string;
    pct: number;
    raw: number;
    full: number;
    trend: "up" | "down" | "flat" | null;
    trendPct: number | null;
    interest: number;
    interestFrom: string;
    ability: number;
    tone: "优势" | "良好" | "稳分" | "潜能" | "待提升";
    comment: string;
  }[] | null;
  /** 未来期望：目标大学/专业/职业填空卡（自动预填建议值）。 */
  futureExpect: { uniHint: string | null; majorHints: string[]; careerHints: string[] } | null;
  /** 给未来自己的一封信（自动生成）。 */
  letterParas: string[];
  /** 推荐专业详情（含课程/应用领域/就业方向）。 */
  majorDetails: MajorDetail[];
  /** 推荐职业详情（含工作内容/技能/前景/路径）。 */
  careerDetails: CareerDetail[];
};

/* ---------------------------------- 选科要求知识库 ---------------------------------- */

/** 新高考主流专业选科要求（2024 版通用口径；各校有差异，仅作方向提示）。 */
const MAJOR_SUBJECT_REQ: Record<string, string> = {
  临床医学: "物理+化学",
  口腔医学: "物理+化学",
  护理学: "化学/生物",
  生物科学: "化学/生物",
  农学: "化学/生物",
  数学: "物理（+化学更佳）",
  物理学: "物理（+化学更佳）",
  计算机科学与技术: "物理+化学",
  机械工程: "物理+化学",
  土木工程: "物理+化学",
  电气工程: "物理+化学",
  车辆工程: "物理+化学",
  统计学: "物理/化学",
  信息管理与信息系统: "物理/化学",
  建筑学: "物理",
  数字媒体艺术: "不限",
  视觉传达设计: "不限",
  音乐学: "不限",
  汉语言文学: "不限",
  教育学: "不限",
  心理学: "不限（生物/数学好更吃香）",
  社会工作: "不限",
  学前教育: "不限",
  工商管理: "不限",
  市场营销: "不限",
  法学: "不限",
  金融学: "不限（数学好更吃香）",
  公共管理: "不限",
  会计学: "不限",
  审计学: "不限",
  财务管理: "不限",
};

/** 组合专业覆盖率提示（物化双选≈最全）。 */
function coverageNote(first: "物理" | "历史", picks: string[]): string {
  const hasChem = picks.includes("化学");
  if (first === "物理" && hasChem) return "专业覆盖最全：理工农医大门敞开（约 90%+ 本科可报）";
  if (first === "物理") return "工科/计算机大部分可报；临床/化工/材料等要求化学的专业受限";
  return "人文社科、经管法教为主；理工农医专业基本受限";
}

/* ---------------------------------- 兴趣→学科映射 ---------------------------------- */

const HOLLAND_SUBJECTS: Record<HollandKey, string[]> = {
  R: ["物理", "化学", "地理", "科学"],
  I: ["数学", "物理", "化学", "生物"],
  A: ["语文", "英语", "历史"],
  S: ["道德与法治", "生物", "英语", "历史"],
  E: ["道德与法治", "历史", "语文", "地理"],
  C: ["数学", "地理", "英语", "化学"],
};

const MULTI5_SUBJECT_BOOST: Record<Multi5Key, string[]> = {
  reasoning: ["数学", "物理", "化学"],
  detail: ["语文", "英语", "生物"],
  number: ["数学", "物理", "化学"],
  verbal: ["语文", "英语", "历史"],
  spatial: ["地理", "物理", "数学"],
};

/** 科目兴趣分（0-100）：霍兰德前三兴趣映射 + 五项智能加成。 */
function subjectInterest(holland: HollandResult | null | undefined, multi5: Multi5Result | null | undefined): Map<string, number> {
  const m = new Map<string, number>();
  const add = (name: string, v: number) => m.set(name, Math.min(100, Math.max(m.get(name) ?? 0, v)));
  if (holland) {
    holland.top3.forEach((k, i) => {
      const base = [90, 70, 50][i] ?? 40;
      for (const s of HOLLAND_SUBJECTS[k]) add(s, base);
    });
  }
  if (multi5) {
    const top = (Object.entries(multi5.dims) as [Multi5Key, number][]).sort((a, b) => b[1] - a[1]).slice(0, 2);
    for (const [k, score] of top) {
      if (score < 70) continue;
      for (const s of MULTI5_SUBJECT_BOOST[k]) add(s, Math.round(score * 0.6));
    }
  }
  return m;
}

/* ---------------------------------- 学业因子计算 ---------------------------------- */

function pctOf(score: number | null | undefined, full: number | null | undefined, grade?: string | null, name = ""): number | null {
  if (score == null) return null;
  const f = full ?? defaultFullScore(name, grade);
  if (!f) return null;
  return Math.round((score / f) * 1000) / 10;
}

function trendOf(name: string, grade: string | null | undefined, records: GuidanceRecord[]): { trend: "up" | "down" | "flat"; pct: number | null } {
  /* records 已按时间升序（旧→新），直接取最近两次可比记录。 */
  const pts = records
    .map((r) => {
      const s = r.subjects.find((x) => x.name === name);
      return s ? pctOf(s.lastScore, s.fullScore, grade, name) : null;
    })
    .filter((x): x is number => x != null);
  if (pts.length < 2) return { trend: "flat", pct: null };
  const diff = pts[pts.length - 1] - pts[pts.length - 2];
  return { trend: diff >= 5 ? "up" : diff <= -5 ? "down" : "flat", pct: Math.round(diff * 10) / 10 };
}

/* ---------------------------------- MBTI 升学向简表 ---------------------------------- */

type MbtiGuidance = { fieldSlant: string; studyStyle: string[] };

const MBTI_GUIDANCE: Record<string, MbtiGuidance> = {
  ISTJ: { fieldSlant: "适合规则清晰、重准确与责任的领域：财会审计、法律、医学检验、档案/信息管理、工程质量、公务员体系。", studyStyle: ["按清单推进最稳，给每科列「必拿分清单」", "错题本对你性价比极高", "选科优先考虑能稳定积累、评分客观的科目组合"] },
  ISFJ: { fieldSlant: "适合服务与照护导向的领域：护理与康复、师范教育、人力资源、社会保障、行政事务、儿童相关专业。", studyStyle: ["在安静稳定的环境里效率最高", "把大目标拆成每日小任务会少很多焦虑", "擅长长期陪伴式积累，别怕慢"] },
  INFJ: { fieldSlant: "适合意义感强、能影响人的领域：心理学、教育学、文学与传媒、社会学、公共政策、艺术设计。", studyStyle: ["理解式记忆远胜死记硬背", "给自己留整块不被打断的思考时间", "选科可偏向能写、能表达、能探究的科目"] },
  INTJ: { fieldSlant: "适合战略与系统构建的领域：计算机/人工智能、数学与基础科学、金融工程、建筑与城市规划、研究与开发。", studyStyle: ["先搭知识框架再填细节，效率翻倍", "适合自学深水区内容，竞赛/拓展是你的主场", "选科建议保留物理/数学类硬科目，路子最宽"] },
  ISTP: { fieldSlant: "适合动手与实战的领域：机械/电子工程、汽车与飞行器、信息技术运维、临床医学（外科方向）、体育科学、刑侦技术。", studyStyle: ["做题/实验比听课学得快", "把知识点变成「可操作步骤」记得最牢", "选科搭配一门动手型科目（实验/技术类）更出彩"] },
  ISFP: { fieldSlant: "适合审美与体验导向的领域：视觉传达与设计、音乐与表演、动画与游戏美术、园艺与景观、护理与疗愈、手作与工艺。", studyStyle: ["在轻松无压的环境里才有好状态", "用图像/色彩整理笔记效果最好", "选科别硬挤纯理论组合，留一门能表达的"] },
  INFP: { fieldSlant: "适合价值与创作导向的领域：文学与写作、心理咨询、教育、新闻传播、公益与社会创新、艺术策展、游戏叙事。", studyStyle: ["先认同「为什么学」，才学得好", "把知识点编成故事/比喻记得最牢", "选科可发挥语文英语优势，再配一门真爱科目"] },
  INTP: { fieldSlant: "适合探究与理论构建的领域：数学、物理、计算机科学、哲学、生物信息、经济学研究、数据科学。", studyStyle: ["搞懂原理就能一通百通，别死记", "给自己留「乱想时间」，好点子都在这出来", "选科强烈建议保留数理组合，天花板最高"] },
  ESTP: { fieldSlant: "适合行动与应变导向的领域：市场营销、创业与商务、体育与赛事、应急管理、刑侦与安保、工程现场管理。", studyStyle: ["刷题+限时训练提分最快", "把学习目标变成可量化的挑战", "选科挑能快速看到反馈的科目组合"] },
  ESFP: { fieldSlant: "适合人际与活力导向的领域：学前教育、旅游与酒店管理、演艺与主持、医疗美容、销售与客户成功、活动运营。", studyStyle: ["和同学组队学比一个人钻效率高", "把知识点讲给别人听=最好的复习", "选科保留一门能展示表达优势的科目"] },
  ENFP: { fieldSlant: "适合创意与连接导向的领域：广告与创意策划、新媒体、心理咨询、教育创新、人力资源、公共关系、文旅策划。", studyStyle: ["兴趣驱动明显：喜欢的科学得飞快", "多变环境下用「主题月」法聚焦", "选科宜「一稳一热」：一门稳拿分+一门真热爱"] },
  ENTP: { fieldSlant: "适合创新与辩论导向的领域：产品/创业、法律咨询、科技媒体、战略咨询、政治学与外交、科研转化。", studyStyle: ["越练难题越兴奋，别只做基础题", "用思维导图辩论式整理知识", "选科组合越灵活越好，别把路走窄"] },
  ESTJ: { fieldSlant: "适合组织与管理导向的领域：工商管理、会计与审计、法学、公共管理、工程项目管理、军警院校方向。", studyStyle: ["计划表就是你的外挂，严格照表执行", "标准化考试是你的强项，答题规范再抠细一点", "选科选主流硬组合，资源和路径都成熟"] },
  ESFJ: { fieldSlant: "适合协调与服务导向的领域：师范教育、护理与临床、社会工作、人力资源、客户服务管理、文旅服务。", studyStyle: ["有同伴一起学效果最好", "把知识点讲给别人听=最好的复习", "选科选稳妥组合，发挥稳定优势"] },
  ENFJ: { fieldSlant: "适合领导与启发导向的领域：教育管理与师范、组织管理、传媒与播音、政治学与社会运动、品牌与市场、人力资源管理。", studyStyle: ["在「为别人而学」的目标下动力最强", "小组里当小老师，双赢", "选科可发挥语文英语表达优势，再补一门逻辑型科目"] },
  ENTJ: { fieldSlant: "适合决策与开创导向的领域：金融与投资、企业管理、法学、计算机与科技管理、临床医学、公共治理、战略咨询。", studyStyle: ["目标倒推法：先定分数目标再拆到每周", "竞争环境是你的燃料，找个对手", "选科保留数理硬组合，未来选择面最大"] },
};

const DISC_GUIDANCE: Record<string, { roleStyle: string; scene: string }> = {
  D: { roleStyle: "天然的推进者与决策者：在团队里适合做牵头人、竞赛队长、项目组长。", scene: "升学路径上适合「冲目标型」打法：锁定一所学校/一个分数段，集中火力突破。注意给自己留备选方案，别让冲劲变成孤注一掷。" },
  I: { roleStyle: "氛围制造者与连接者：擅长演讲、答辩、社团组织，在面试类/展示类环节优势明显。", scene: "升学路径上适合「展示型」打法：综合素质评价、面试、自主招生/强基面试都是你的舞台。书面基本功要刻意补，别让表达遮住了扎实度。" },
  S: { roleStyle: "稳定的支撑者：擅长长期陪伴式协作、服务性工作，是团队里最可靠的存在。", scene: "升学路径上适合「稳打稳扎型」打法：按节奏积累，靠稳定输出取胜。可以适当挑战高一点的目标，你的持续力比你自己以为的更强。" },
  C: { roleStyle: "品质守门员：擅长分析、校对、研究型任务，精确性要求高的岗位非你莫属。", scene: "升学路径上适合「精度型」打法：理科/信息类竞赛、研究性学习报告是你的赛道。考试时注意「完成比完美重要」，别在一道题上过度打磨。" },
};

/* ---------------------------------- 报告组装 ---------------------------------- */

export type GuidanceInput = {
  grade?: string | null;
  /** 学生姓名（给未来自己的一封信落款用）。 */
  studentName?: string | null;
  mbti?: MbtiResult | null;
  disc?: DiscResult | null;
  multi5?: Multi5Result | null;
  anchor?: AnchorResult | null;
  holland?: HollandResult | null;
  /** 当前成绩档案。 */
  academics?: AcademicsData | null;
  /** 历史成绩记录（旧→新不限顺序，内部会排序）。 */
  records?: GuidanceRecord[] | null;
};

export function buildGuidanceReport(input: GuidanceInput): GuidanceReport | null {
  const grade = input.grade ?? null;
  const highSchool = !grade || /高中|高一|高二|高三/.test(grade);
  const { mbti, disc, multi5, anchor, holland } = input;
  if (!mbti && !disc && !multi5 && !anchor && !holland && !input.academics) return null;

  /* ---- 依据与缺口 ---- */
  const basedOn: string[] = [];
  const missing: string[] = [];
  if (mbti) basedOn.push("MBTI 职业性格");
  else missing.push("职业性格");
  if (disc) basedOn.push("DISC 行为风格");
  else missing.push("DISC");
  if (multi5) basedOn.push("五项智能");
  else missing.push("五项智能");
  if (holland) basedOn.push("霍兰德职业兴趣");
  else missing.push("职业兴趣");
  if (anchor) basedOn.push("职业锚");
  else missing.push("职业锚");
  if (input.academics && input.academics.subjects.some((s) => s.lastScore != null)) basedOn.push("学业成绩");

  /* ---- 学业因子 ---- */
  const academics = input.academics ?? null;
  const records = (input.records ?? [])
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const interestMap = subjectInterest(holland, multi5);

  let academicsBlock: GuidanceReport["academicsBlock"] = null;
  let matrix: GuidanceReport["matrix"] = null;
  let combos: GuidanceReport["combos"] = [];
  let subjectAdvice: string[] = [];
  const majorScores = new Map<string, number>();
  const majorWhys = new Map<string, string[]>();
  const industryScores = new Map<string, number>();
  const industryWhys = new Map<string, string[]>();
  const bump = (map: Map<string, number>, k: string, v: number) => map.set(k, (map.get(k) ?? 0) + v);
  const why = (map: Map<string, string[]>, k: string, v: string) => {
    const arr = map.get(k) ?? [];
    if (!arr.includes(v)) arr.push(v);
    map.set(k, arr);
  };

  /* 成绩因子：各科得分率 + 目标差距 + 趋势。 */
  const scored = (academics?.subjects ?? []).filter((s) => s.lastScore != null);

  /* 多测评决策平衡卡：学业成绩 35% + 学科兴趣 30% + 能力匹配 20% + 专业覆盖 15%（无成绩按中位 55 分兜底）。 */
  const byName = (n: string) => interestMap.get(n) ?? 0;
  const pctMap = new Map<string, number>();
  for (const s of scored) {
    const f = s.fullScore ?? defaultFullScore(s.name, grade);
    const p = pctOf(s.lastScore, f, grade, s.name);
    if (p != null) pctMap.set(s.name, p);
  }
  const pctOfName = (n: string) => pctMap.get(n) ?? null;
  const abilityOf = (n: string): number => {
    if (!multi5) return 55;
    const d = multi5.dims;
    const map: Record<string, number[]> = {
      数学: [d.reasoning ?? 0, d.number ?? 0],
      物理: [d.reasoning ?? 0, d.spatial ?? 0],
      化学: [d.reasoning ?? 0, d.detail ?? 0],
      生物: [d.detail ?? 0],
      历史: [d.verbal ?? 0, d.detail ?? 0],
      道德与法治: [d.verbal ?? 0],
      地理: [d.spatial ?? 0, d.detail ?? 0],
      语文: [d.verbal ?? 0],
      英语: [d.verbal ?? 0],
    };
    const vals = map[n];
    return vals ? Math.max(...vals) : 55;
  };
  const verdictOf = (t: number): "强烈推荐" | "推荐" | "可选" | "慎重" => (t >= 75 ? "强烈推荐" : t >= 65 ? "推荐" : t >= 55 ? "可选" : "慎重");
  const scorecardSubjects = highSchool ? ["物理", "化学", "生物", "历史", "道德与法治", "地理"] : ["语文", "数学", "英语", "物理", "化学", "生物", "道德与法治", "历史", "地理"];
  let scorecard: GuidanceReport["scorecard"] = {
    weights: [
      { name: "学业成绩", pct: 35 },
      { name: "学科兴趣", pct: 30 },
      { name: "能力匹配", pct: 20 },
      { name: "专业覆盖", pct: 15 },
    ],
    rows: scorecardSubjects.map((s) => {
      const score = pctOfName(s) ?? 55;
      const interest = byName(s);
      const ability = abilityOf(s);
      const coverage = SUBJECT_COVERAGE_SCORE[s] ?? 55;
      const total = Math.round(score * 0.35 + interest * 0.3 + ability * 0.2 + coverage * 0.15);
      return { subject: s, score, interest, ability, coverage, total, verdict: verdictOf(total) };
    }).sort((a, b) => b.total - a.total),
  };
  const cardTotal = (n: string) => scorecard!.rows.find((r) => r.subject === n)?.total ?? 55;
  let disciplines: GuidanceReport["disciplines"] = [];
  let schoolPlan: GuidanceReport["schoolPlan"] = null;
  let firstDecision: GuidanceReport["firstDecision"] = null;
  let secondDecision: GuidanceReport["secondDecision"] = null;

  if (scored.length > 0) {
    const rows = scored.map((s) => {
      const full = s.fullScore ?? defaultFullScore(s.name, grade);
      const pct = pctOf(s.lastScore, full, grade, s.name) ?? 0;
      const targetPct = pctOf(s.targetScore, full, grade, s.name);
      const { trend, pct: trendPct } = trendOf(s.name, grade, records);
      return {
        name: s.name,
        pct,
        raw: s.lastScore as number,
        full,
        targetPct,
        gap: targetPct != null ? Math.round((targetPct - pct) * 10) / 10 : null,
        selfLevel: s.selfLevel,
        trend,
        trendPct,
      };
    });
    const avgPct = rows.length ? Math.round((rows.reduce((a, r) => a + r.pct, 0) / rows.length) * 10) / 10 : null;
    academicsBlock = { examName: academics?.examName || "最近一次成绩", rows, avgPct };

    /* 选科四象限：兴趣 × 学业。 */
    const subjMap = new Map<string, (typeof rows)[number]>();
    rows.forEach((r) => subjMap.set(r.name, r));
    const allNames = new Set<string>([...subjMap.keys(), ...interestMap.keys()]);
    const NOTE: Record<Quadrant, (_n: string, _i: number, _p: number | null) => string> = {
      优势学科: () => "既喜欢又擅长，选科与升学的主攻方向，值得投入最多资源。",
      潜能学科: (_n, i) => `兴趣${i >= 75 ? "浓厚" : "不错"}但成绩暂未跟上——先查方法（笔记/错题/请教老师），往往是提分性价比最高的地方。`,
      稳健学科: (_n, _i, p) => `成绩${(p ?? 0) >= 75 ? "扎实" : "尚可"}但兴趣一般，适合作为选科的「稳分组合」，不必强扭成热爱。`,
      谨慎学科: () => "成绩与兴趣双低，选科尽量避开；若为大三门逃不掉，以「保底过关」为目标，别过度消耗。",
      待观察: () => "暂无成绩记录，凭感觉参考：可以先体验相关课程/活动再定。",
    };
    matrix = [...allNames]
      .map((name) => {
        const i = interestMap.get(name) ?? 0;
        const p = subjMap.get(name)?.pct ?? null;
        const q: Quadrant = p == null ? "待观察" : p >= 70 && i >= 60 ? "优势学科" : p < 70 && i >= 60 ? "潜能学科" : p >= 70 && i < 60 ? "稳健学科" : "谨慎学科";
        return { name, interest: i, scorePct: p, quadrant: q, note: NOTE[q](name, i, p) };
      })
      .sort((a, b) => {
        const rank: Record<Quadrant, number> = { 优势学科: 0, 潜能学科: 1, 稳健学科: 2, 谨慎学科: 3, 待观察: 4 };
        return rank[a.quadrant] - rank[b.quadrant] || (b.scorePct ?? -1) - (a.scorePct ?? -1);
      });

    /* 选科组合推荐（广东 3+1+2：首选 = 物理/历史 2 选 1，再选 = 化学生物道法地理 4 选 2，均基于决策平衡卡得分）。 */
    if (highSchool) {
      /* 首选决策：物理 vs 历史直接对比（专业覆盖维度已计入平衡卡，物理侧天然占优时会在 margin 中体现）。 */
      const physScore = cardTotal("物理");
      const histScore = cardTotal("历史");
      const first: "物理" | "历史" = physScore >= histScore ? "物理" : "历史";
      const margin = Math.abs(physScore - histScore);
      firstDecision = {
        pick: first,
        physScore,
        histScore,
        margin,
        text: margin >= 10
          ? `首选${first}（平衡卡 ${first === "物理" ? physScore : histScore} 分 vs ${first === "物理" ? histScore : physScore} 分，领先 ${margin} 分）：${first === "物理" ? "数理兴趣与成绩、专业覆盖（95% 以上专业可报）都指向物理" : "人文兴趣与史政成绩明显占优，历史类是更顺的主场"}，可作为定论推进。`
          : `物理（${physScore} 分）与历史（${histScore} 分）非常接近（差 ${margin} 分）：两科都可立住，建议再对照目标专业——目标理工医农优先物理，目标人文社科两可；也可与老师各谈一次再定。`,
      };

      /* 再选决策：4 科按平衡卡排序，取前 2，后 2 列为可替换项。 */
      const pool = ["化学", "生物", "道德与法治", "地理"].map((n) => ({ n, s: cardTotal(n) })).sort((a, b) => b.s - a.s);
      const [a, b] = pool;
      secondDecision = {
        picks: [a.n, b.n],
        dropped: pool.slice(2).map((p) => p.n),
        text: `再选 ${a.n}（${a.s} 分）+ ${b.n}（${b.s} 分）为最优解；${pool[2].n}（${pool[2].s} 分）、${pool[3].n}（${pool[3].s} 分）作为可替换项——当「学校不开该组合」或「某科高二明显跟不上」时，用高分项替换低分项即可。`,
      };

      const starsOf = (s: number): 1 | 2 | 3 => (s >= 75 ? 3 : s >= 60 ? 2 : 1);
      combos.push({
        title: `${first}+${a.n}+${b.n}`,
        stars: starsOf(Math.round((a.s + b.s) / 2)),
        reason: `${first === "物理" ? "理工兴趣与数理表现更占优" : "人文兴趣与史政表现更占优"}；再选 ${a.n}（${a.s} 分）与 ${b.n}（${b.s} 分）在兴趣与成绩上最平衡。${coverageNote(first, [a.n, b.n])}。`,
        risk: first === "物理" && ![a.n, b.n].includes("化学") ? "注意：未选化学会关上临床、化工、材料等专业的门，若对医学/化工有想法请把化学换进组合。" : undefined,
      });
      const c = pool[2];
      combos.push({
        title: `${first}+${a.n}+${c.n}`,
        stars: starsOf(Math.round((a.s + c.s) / 2)),
        reason: `备选组合：用 ${c.n} 替换 ${b.n}。适合「${b.n} 学起来吃力，或学校不开该组合」的情况。${coverageNote(first, [a.n, c.n])}。`,
      });
      const otherFirst = first === "物理" ? "历史" : "物理";
      combos.push({
        title: `${otherFirst}+${pool[1].n}+${pool[2].n}`,
        stars: 1,
        reason: `拓展参考：若以后想转${otherFirst === "物理" ? "理工" : "人文"}方向，此组合可作跳板；当前兴趣与成绩指针更建议首选 ${first}。${coverageNote(otherFirst, [pool[1].n, pool[2].n])}。`,
      });
    } else {
      const rankRows = rows.slice().sort((x, y) => y.pct - x.pct);
      const top2 = rankRows.slice(0, 2);
      const rising = rows.filter((r) => r.trend === "up").sort((x, y) => (y.trendPct ?? 0) - (x.trendPct ?? 0));
      const potential = (matrix ?? []).filter((m) => m.quadrant === "潜能学科").map((m) => m.name);
      combos.push({
        title: `主攻：${top2.map((r) => r.name).join(" + ")}`,
        stars: 3,
        reason: `当前得分率最高（${top2.map((r) => `${r.name} ${r.pct}%`).join("、")}），是中考拉开差距的拳头科目，配最多的课时与真题训练。`,
      });
      combos.push({
        title: `稳分：语文 + 数学 + 英语`,
        stars: 3,
        reason: "大三门是中考基本盘，分值占比最高；任何组合都先保证大三门不塌——目标不是突出，是稳定少丢分。",
      });
      const lift = [...new Set([...rising.map((r) => r.name), ...potential])].filter((n) => !top2.some((r) => r.name === n)).slice(0, 2);
      if (lift.length > 0) {
        const liftRows = rows.filter((r) => lift.includes(r.name));
        combos.push({
          title: `提分：${lift.join(" + ")}`,
          stars: 2,
          reason: liftRows.some((r) => r.trend === "up")
            ? `${lift.join("、")}最近呈上升趋势，趁热打铁投入，最可能再涨一截。`
            : `${lift.join("、")}兴趣在、成绩未到，换学习方法（错题归因+请教老师）往往见效快。`,
        });
      }
    }

    /* 成绩 → 专业/行业倾向。 */
    const sorted = rows.slice().sort((x, y) => y.pct - x.pct);
    const pick = (n: string) => sorted.find((r) => r.name === n)?.pct;
    const STRONG = 72;
    if ((pick("物理") ?? 0) >= STRONG && (pick("数学") ?? 0) >= STRONG) {
      bump(majorScores, "计算机科学与技术", 3);
      why(majorWhys, "计算机科学与技术", "数理双强");
      bump(majorScores, "数学", 2);
      why(majorWhys, "数学", "数理双强");
    }
    if ((pick("物理") ?? 0) >= STRONG && (pick("化学") ?? 0) >= STRONG) {
      bump(majorScores, "临床医学", 3);
      why(majorWhys, "临床医学", "物化双强");
      bump(majorScores, "机械工程", 2);
      why(majorWhys, "机械工程", "物化双强");
      bump(majorScores, "电气工程", 2);
      why(majorWhys, "电气工程", "物化双强");
    }
    if ((pick("化学") ?? 0) >= STRONG && (pick("生物") ?? 0) >= STRONG) {
      bump(majorScores, "生物科学", 3);
      why(majorWhys, "生物科学", "化生双强");
      bump(majorScores, "农学", 2);
      why(majorWhys, "农学", "化生双强");
      bump(majorScores, "护理学", 1);
      why(majorWhys, "护理学", "化生双强");
    }
    if ((pick("语文") ?? 0) >= STRONG && (pick("英语") ?? 0) >= STRONG) {
      bump(majorScores, "汉语言文学", 3);
      why(majorWhys, "汉语言文学", "文科双强");
      bump(majorScores, "法学", 2);
      why(majorWhys, "法学", "文科双强");
    }
    if ((pick("历史") ?? 0) >= STRONG && (pick("道德与法治") ?? 0) >= STRONG) {
      bump(majorScores, "法学", 2);
      why(majorWhys, "法学", "史政双强");
      bump(majorScores, "公共管理", 2);
      why(majorWhys, "公共管理", "史政双强");
    }
    if ((pick("数学") ?? 0) >= STRONG && (pick("英语") ?? 0) >= STRONG) {
      bump(majorScores, "金融学", 2);
      why(majorWhys, "金融学", "数英双强");
      bump(majorScores, "会计学", 1);
      why(majorWhys, "会计学", "数英双强");
    }
    if (avgPct != null && avgPct >= 75) {
      bump(industryScores, "研究/学术深造", 2);
      why(industryWhys, "研究/学术深造", "整体学业表现优异");
    }

    /* 建议总述。 */
    const mx = matrix ?? [];
    const quadCount = (q: Quadrant) => mx.filter((m) => m.quadrant === q).length;
    subjectAdvice = [
      quadCount("优势学科") > 0
        ? `优势学科（${mx.filter((m) => m.quadrant === "优势学科").map((m) => m.name).join("、")}）应作为选科与升学的主攻方向。`
        : "目前没有完全匹配的「优势学科」，先从「潜能学科」里挑 1-2 门重点突破。",
      highSchool ? "首选科目决定专业大门（物理≈全部门、历史≈人文社科）；再选科目按「兴趣×成绩」取最高两项。" : "中考组合策略：主攻拳头科目 + 稳住大三门 + 给上升科目加一把火。",
      "选科决定建议结合学校实际开班情况与老师意见，本报告提供的是数据视角。",
    ];
  } else {
    /* 无成绩时的通用选科建议（报告仍要可用）。 */
    if (highSchool) {
      combos = [
        { title: "物理+化学+生物", stars: 3, reason: `经典理科组合，${coverageNote("物理", ["化学", "生物"])}；适合理工农医方向的孩子。` },
        { title: "物理+化学+地理", stars: 2, reason: `理科组合变体：地理偏理解记忆、学习负担略轻，${coverageNote("物理", ["化学", "地理"])}。` },
        { title: "历史+政治+地理", stars: 1, reason: `经典文科组合，${coverageNote("历史", ["政治", "地理"])}；适合人文社科方向明确的孩子。` },
      ];
      subjectAdvice = [
        "首选科目决定专业大门：选物理≈90% 以上本科专业可报，选历史≈人文社科经管法教。",
        "再选科目按「兴趣 × 成绩」取最高两项——在「我的档案」里录入成绩后，本报告会给出你的个性化组合。",
        "选科决定建议结合学校实际开班情况与老师意见，本报告提供的是数据视角。",
      ];
    } else {
      subjectAdvice = [
        "中考策略：主攻优势拳头科目 + 稳住语文数学英语基本盘 + 给上升科目加一把火。",
        "在「我的档案」里录入成绩后，本报告会给出你的个性化主攻/稳分/提分组合。",
      ];
    }
  }

  /* ---- 性格/能力/兴趣因子 ---- */
  let mbtiBlock: GuidanceReport["mbtiBlock"] = null;
  let discBlock: GuidanceReport["discBlock"] = null;
  let multi5Block: GuidanceReport["multi5Block"] = null;
  let anchorBlock: GuidanceReport["anchorBlock"] = null;
  let hollandBlock: GuidanceReport["hollandBlock"] = null;

  if (mbti) {
    const t = mbti.type.toUpperCase();
    const g = MBTI_GUIDANCE[t] ?? MBTI_GUIDANCE[t.slice(0, 3) + "J"];
    if (g) mbtiBlock = { type: t, name: MBTI_REPORTS[t]?.name ?? t, fieldSlant: g.fieldSlant, studyStyle: g.studyStyle };
  }
  if (disc) {
    const p = disc.primary.toUpperCase();
    const g = DISC_GUIDANCE[p];
    const dr = DISC_REPORTS[p as keyof typeof DISC_REPORTS];
    if (g) discBlock = { primary: p, name: dr?.name ?? p, roleStyle: g.roleStyle, scene: g.scene };
  }
  if (multi5) {
    const rep = buildMulti5Report(multi5);
    const top = rep.dims
      .filter((d) => d.score >= 55)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((d) => ({ label: d.label, score: d.score, feature: d.feature, career: d.careerAdvice }));
    multi5Block = top.length ? top : null;
    const d = multi5.dims;
    if ((d.reasoning ?? 0) >= 80 && (d.number ?? 0) >= 80) {
      bump(majorScores, "数学", 2);
      why(majorWhys, "数学", "逻辑与数理智能双 80+");
      bump(majorScores, "计算机科学与技术", 1);
      why(majorWhys, "计算机科学与技术", "逻辑与数理智能双 80+");
    }
    if ((d.verbal ?? 0) >= 80) {
      bump(majorScores, "汉语言文学", 1);
      why(majorWhys, "汉语言文学", "语言智能 80+");
      bump(industryScores, "文化传媒", 2);
      why(industryWhys, "文化传媒", "语言智能 80+");
    }
    if ((d.spatial ?? 0) >= 80) {
      bump(majorScores, "建筑学", 2);
      why(majorWhys, "建筑学", "空间智能 80+");
      bump(industryScores, "设计与工程", 2);
      why(industryWhys, "设计与工程", "空间智能 80+");
    }
    if ((d.detail ?? 0) >= 80) {
      bump(majorScores, "会计学", 2);
      why(majorWhys, "会计学", "细节处理智能 80+");
    }
    if ((d.reasoning ?? 0) >= 75) {
      bump(industryScores, "科技/互联网", 2);
      why(industryWhys, "科技/互联网", "逻辑推理强");
    }
    if ((d.spatial ?? 0) >= 75) {
      bump(majorScores, "数字媒体艺术", 1);
      why(majorWhys, "数字媒体艺术", "空间智能突出");
    }
  }
  if (anchor) {
    const rep = buildAnchorReport(anchor);
    anchorBlock = rep.top2
      .filter((x) => x.score >= 55)
      .map((x) => ({ label: x.label, score: x.score, workStyle: x.workStyle, careerFields: x.careerFields }));
  }
  if (holland) {
    const rep = buildHollandReport(holland);
    hollandBlock = {
      code: holland.code,
      top3: rep.top3.map((x) => {
        const dim = rep.dims.find((d) => d.key === x.key);
        return { key: x.key, label: HOLLAND_LABEL[x.key], score: x.score, careers: dim?.careers ?? [], majors: dim?.majors ?? [] };
      }),
    };
    rep.top3.forEach((x, i) => {
      const w = [3, 2, 1][i] ?? 1;
      const dim = rep.dims.find((d) => d.key === x.key);
      (dim?.majors ?? []).slice(0, 5).forEach((m) => {
        bump(majorScores, m, w);
        why(majorWhys, m, `${HOLLAND_LABEL[x.key]}兴趣`);
      });
      (dim?.careers ?? []).slice(0, 4).forEach((c) => {
        bump(industryScores, c, w);
        why(industryWhys, c, `${HOLLAND_LABEL[x.key]}兴趣`);
      });
    });
  }

  /* ---- 汇总专业/行业 ---- */
  const scoreBy = (map: Map<string, number>) => (a: string, b: string) => (map.get(b) ?? 0) - (map.get(a) ?? 0) || a.localeCompare(b, "zh");
  const majors = [...majorScores.keys()]
    .sort(scoreBy(majorScores))
    .slice(0, 6)
    .map((name) => {
      const req = MAJOR_SUBJECT_REQ[name] ?? null;
      let gateNote: string | null = null;
      if (req) {
        const needs = req.match(/物理|化学|生物|历史|道德与法治|地理|数学|英语|语文/g) ?? [];
        const weak = needs.filter((n) => {
          const p = academicsBlock?.rows.find((r) => r.name === n)?.pct;
          return p != null && p < 65;
        });
        if (weak.length > 0) gateNote = `该方向通常要求 ${req}；你目前的 ${weak.join("、")} 得分率不足 65%，若真感兴趣建议尽早补强。`;
        else if (needs.length > 0) gateNote = `该方向通常要求 ${req}，你的相关科目目前达标，保持住。`;
      }
      return { name, why: (majorWhys.get(name) ?? []).slice(0, 2).join("、") || "综合匹配", req, gateNote };
    });
  const industries = [...industryScores.keys()]
    .sort(scoreBy(industryScores))
    .slice(0, 6)
    .map((name) => ({ name, why: (industryWhys.get(name) ?? []).slice(0, 2).join("、") || "综合匹配" }));

  /* ---- 升学路径（六大类全路径：数据触发 + 条件性提示）---- */
  const pathway: GuidanceReport["pathway"] = [];
  const avg = academicsBlock?.avgPct ?? null;
  const rowPct = (n: string) => academicsBlock?.rows.find((r) => r.name === n)?.pct ?? null;
  const engP = rowPct("英语");

  /* 主力路径：普通高考（人人适用，按平均得分率分档话术）。 */
  pathway.push({
    cat: "主力路径",
    name: "普通高考",
    fit: "主力",
    cond: null,
    note:
      avg == null
        ? "无论选哪条路，高考都是主战场；其余路径（综评/强基/专项等）都是锦上添花，先把总分抬上去。"
        : avg >= 78
          ? `当前平均得分率 ${avg}%，具备冲重点校段的实力。建议以「目标校往年录取线 +10 分」为锚，倒推到每科的目标分。`
          : avg >= 65
            ? `当前平均得分率 ${avg}%，处于中上段：把「优势学科」再抬 5-8 分，比面面俱到更有效；同时别让任何一科低于 60%。`
            : `当前平均得分率 ${avg}%，先保基本盘：稳住大三门、逐科消灭低于 60% 的短板——总分抬一档，比攻难题更实际。`,
  });

  /* 拔尖升学。 */
  const reasonScore = multi5 ? Math.max(multi5.dims.reasoning ?? 0, multi5.dims.number ?? 0) : 0;
  if (reasonScore >= 80 && ((rowPct("数学") ?? 0) >= 75 || (rowPct("物理") ?? 0) >= 75)) {
    pathway.push({ cat: "拔尖升学", name: "强基计划（39 所 985 基础学科）", fit: "适配", cond: "数理突出 / 竞赛潜力", note: "逻辑数理双强且数理成绩过硬：强基「高考成绩 85% + 校测 15%」，入围看高考。数/理/化/生/信息学竞赛只选一个深耕，省一以上有望破格入围。" });
  } else if ((avg ?? 0) >= 72) {
    pathway.push({ cat: "拔尖升学", name: "强基计划", fit: "关注", cond: "需数理拔尖或竞赛奖项", note: "平均成绩够看但数理还未到拔尖：若对基础学科真有兴趣，可先接触竞赛内容再定；别为用不上强基而焦虑，它本就是少数人的通道。" });
  }
  if ((disc?.primary ?? "") === "I" || mbti?.type.endsWith("F") || (hollandBlock?.top3.some((t) => t.key === "E") ?? false)) {
    pathway.push({ cat: "拔尖升学", name: "综合评价招生", fit: "适配", cond: "表达 / 面试优势", note: "「高考约 60% + 校测约 30% + 学考约 10%」（各省比例不同）：面试与综合素质档案是你的加分项——从现在起有意识地积累活动、研究性学习成果与获奖记录。" });
  } else if ((avg ?? 0) >= 70) {
    pathway.push({ cat: "拔尖升学", name: "综合评价招生", fit: "关注", cond: "综合素质材料丰富者", note: "综评看高考，也看综合素质档案与校测表达。若考虑这条路，活动记录和研究性学习要趁早攒，高三再补就晚了。" });
  }
  pathway.push({ cat: "拔尖升学", name: "高校专项计划（国家 / 高校专项）", fit: "参考", cond: "农村或脱贫地区户籍", note: "面向农村学生的降分通道（高校专项常见降 10-60 分），单独报名不占统招志愿。若户籍符合条件务必申报——很多人不是不够格，是压根没报。" });

  /* 特长升学。 */
  if (hollandBlock?.top3[0]?.key === "A") {
    pathway.push({ cat: "特长升学", name: "艺术类统考 / 校考", fit: "适配", cond: "艺术兴趣第一", note: "艺考「专业 + 文化」双线过线才算：高三上 12 月省级统考，部分院校另有校考。文化课门槛逐年走高，两手抓才是护城河——千万别 all-in 专业丢了文化。" });
  } else if (hollandBlock?.top3.slice(1).some((t) => t.key === "A")) {
    pathway.push({ cat: "特长升学", name: "艺术类统考 / 校考", fit: "参考", cond: "若另有多年艺术功底", note: "艺术兴趣进前三：若确有绘画/音乐/播音特长且练过多年，艺考值得认真评估；如果只是「有点喜欢」，当作业余爱好更划算。" });
  }
  pathway.push({ cat: "特长升学", name: "体育单招 / 高水平运动队", fit: "参考", cond: "需运动员等级证书", note: "国家一级/二级运动员可报体育单招（文化单独划线，远低于普通高考）；高水平运动队要求一级运动员且专业测试全国统考。若已具备等级证，这是一条被严重低估的捷径。" });
  pathway.push({ cat: "特长升学", name: "三大招飞（空军 / 海军 / 民航）", fit: "参考", cond: "视力、身高、体质达标", note: "身体条件是硬门槛（如 C 字表视力 0.8+、身高约 168cm+），成绩过特殊类型控制线即可。空军/海军招飞免学费且毕业即任职，若身体条件好，值得专门去初检一次。" });

  /* 定向就业。 */
  const seAnchor = anchorBlock?.some((a) => a.label === ANCHOR_LABEL.SE) ?? false;
  if (seAnchor || (hollandBlock?.top3.some((t) => t.key === "S") ?? false)) {
    pathway.push({ cat: "定向就业", name: "公费师范生（部属 / 省属）", fit: "适配", cond: "安稳锚 / 教育兴趣", note: "两免一补 + 毕业即有编有岗：部属 6 所（北师大、华东师大等）面向全省，省属面向本地。代价是任教服务期 6 年——把「确定性」排第一的话，这条路匹配度很高。" });
  }
  if (seAnchor || (disc?.primary ?? "") === "D") {
    pathway.push({ cat: "定向就业", name: "军警院校 / 定向培养军士", fit: seAnchor ? "适配" : "关注", cond: "需通过体检、政审、体测", note: "公安院校公安专业毕业可参加联考入警（入警率普遍 90%+）；定向培养军士入学即定向、毕业入伍授衔。都是「入学≈入职」的路线，纪律性与身体是硬要求。" });
  }
  pathway.push({ cat: "定向就业", name: "订单定向医学生（免费医学生）", fit: "参考", cond: "物化双选 + 接受基层服务 6 年", note: "免学费住宿费另有生活补助，毕业入编到乡镇卫生院服务 6 年。适合想要确定编制、化生成绩不错（或愿意补）的孩子——录取线通常比同校临床低 20-40 分。" });

  /* 国际路线。 */
  if ((engP ?? 0) >= 80 || (multi5 ? (multi5.dims.verbal ?? 0) >= 80 : false)) {
    pathway.push({ cat: "国际路线", name: "港澳高校 / 中外合作办学", fit: "适配", cond: "英语突出", note: "港澳高校独立招生不占内地志愿（可两手准备）；中外合作办学（港中深、上纽、昆杜等）走综评或统招。英语是你的硬通货：保持 130+/150，这条路就一直开着。" });
  }
  if ((engP ?? 0) >= 75) {
    pathway.push({ cat: "国际路线", name: "出国留学（本科）", fit: "参考", cond: "需提前 1-2 年规划语言与申请", note: "若家庭预算允许（每年约 25-50 万），英语优势 + 自主性强的孩子很适合海外本科：高二前考出托福/雅思，活动与文书趁早积累。注意这是「提前分叉」的路——定了就别摇摆。" });
  }

  /* 务实备选。 */
  if (avg != null && avg < 60) {
    pathway.push({ cat: "务实备选", name: "高职单招 / 分类考试", fit: "关注", cond: "春季提前录取", note: `当前平均得分率 ${avg}%，若到高三仍在这个区间，高职单招值得认真了解：3-4 月考试、难度低于高考、提前锁定好专业（轨道交通、护理、电力、口腔医学技术等专业就业很硬）。这不是退路，是另一条赛道——入学后还有专升本、职业本科的上升阶梯。` });
  }

  /* ---- 12 大学科门类匹配度 ---- */
  const topHollandKeys = hollandBlock?.top3.map((t) => t.key) ?? [];
  disciplines = DISCIPLINE_CATS.map((dc) => {
    let score = 50;
    const whys: string[] = [];
    topHollandKeys.forEach((k, i) => {
      if (dc.holland.includes(k)) {
        const add = [30, 20, 12][i] ?? 8;
        score += add;
        whys.push(`${HOLLAND_LABEL[k]}兴趣`);
      }
    });
    const subjPcts = dc.subjects.map((s) => pctOfName(s)).filter((x): x is number => x != null);
    if (subjPcts.length > 0) {
      const avg = subjPcts.reduce((a, b) => a + b, 0) / subjPcts.length;
      score += Math.max(-20, Math.min(25, Math.round((avg - 65) * 0.8)));
      whys.push(`${dc.subjects.slice(0, 2).join("/")}得分率 ${Math.round(avg)}%`);
    }
    if (multi5) {
      const d = multi5.dims;
      if ((dc.key === "science" || dc.key === "engineering") && Math.max(d.reasoning ?? 0, d.number ?? 0) >= 75) { score += 10; whys.push("逻辑/数理智能强"); }
      if ((dc.key === "literature" || dc.key === "arts") && (d.verbal ?? 0) >= 75) { score += 10; whys.push("语言智能强"); }
      if (dc.key === "engineering" && (d.spatial ?? 0) >= 75) { score += 6; whys.push("空间智能强"); }
    }
    return { key: dc.key, name: dc.name, matchPct: Math.max(0, Math.min(98, score)), groups: dc.groups, majors: dc.majors, req: dc.req, note: dc.note, why: whys.slice(0, 3).join(" · ") || "综合匹配" };
  })
    .filter((d) => d.matchPct >= 55)
    .sort((a, b) => b.matchPct - a.matchPct)
    .slice(0, 5);

  /* ---- 5.2 目标院校规划（预估分 → 冲稳保） ---- */
  if (highSchool && academicsBlock?.avgPct != null) {
    const estScore = Math.max(350, Math.min(750, Math.round(academicsBlock.avgPct * 7.5)));
    const first: "物理" | "历史" = cardTotal("物理") >= cardTotal("历史") ? "物理" : "历史";
    const picked = pickSchoolTiers(first, estScore);
    if (picked.wen) {
      const namesOf = (t: SchoolTier | null) => (t?.gaokao ?? []).slice(0, 8);
      schoolPlan = {
        estScore,
        first,
        tier: picked.wen.range,
        chong: namesOf(picked.chong),
        wen: namesOf(picked.wen),
        bao: namesOf(picked.bao),
        chongNote: picked.chong ? `冲一冲：按 ${picked.chong.range} 档准备，需比当前预估再高 15-25 分` : null,
        baoNote: picked.bao ? `保一保：${picked.bao.range} 档院校兜底，确保有学上` : null,
      };
    }
  }

  /* ---- 行动建议（分阶段）---- */
  const actionTips: GuidanceReport["actionTips"] = [];
  if (highSchool) {
    actionTips.push({ phase: "本学期", text: "用本报告的选科组合与老师、家长各谈一次，结合学校开班情况把首选/再选定下来（定完别反复横跳，按新组合排课时）。" });
    actionTips.push({ phase: "本学期", text: "给「优势学科」配最多课时，给「潜能学科」换一次学习方法（错题归因 + 主动请教），一个学期足够看到变化。" });
    if (academicsBlock) {
      const gaps = academicsBlock.rows.filter((r) => (r.gap ?? 0) >= 15).map((r) => r.name);
      if (gaps.length > 0) actionTips.push({ phase: "本月", text: `与目标差距 ≥15 分的科目（${gaps.join("、")}）：每科找出丢分最多的一个题型，本月只攻这一个点。` });
      else actionTips.push({ phase: "本月", text: "各科与目标的差距都在 15 分以内——把近期错题按「粗心/不会/没时间」分类，只攻「不会」的那部分。" });
    }
    actionTips.push({ phase: "本学年末", text: "期末后再录一次成绩（基本信息 → 成绩），本报告与成绩曲线图会自动更新，验证选科与学习策略是否有效。" });
    if (pathway.some((p) => p.name.includes("强基"))) actionTips.push({ phase: "本学期末前", text: "若走强基/竞赛：暑假前确定竞赛科目（数/理/化/生/信息学只选一个），找校内教练或校外体系，暑期是分水岭。" });
  } else if (/小学|一年级|二年级|三年级|四年级|五年级|六年级/.test(grade ?? "")) {
    /* 小学：重习惯与兴趣启蒙，不出中考话术。 */
    actionTips.push({ phase: "本学期", text: "固定作息与作业流程，每天 20-30 分钟课外阅读——习惯比抢跑更重要。" });
    if (multi5Block && multi5Block.length > 0) actionTips.push({ phase: "本学期", text: `顺着最强的智能项（${multi5Block[0].label}）安排体验：参观、社团、小项目，把兴趣先「养」起来。` });
    if (academicsBlock) {
      const weak = academicsBlock.rows.filter((r) => r.pct < 60).map((r) => r.name);
      if (weak.length > 0) actionTips.push({ phase: "本学期", text: `${weak.join("、")}暂时落后：回到课本与基础题，每天补一点比周末突击有效。` });
      else actionTips.push({ phase: "本学期", text: "各科都在及格线以上：保持节奏，把错题本习惯先立起来。" });
    }
    actionTips.push({ phase: "本学期末", text: "期末后录一次成绩看变化，再复测一次兴趣测评——小学阶段的画像越准，初中衔接越顺。" });
  } else {
    actionTips.push({ phase: "本学期", text: "主攻拳头科目保持手感（每周 2 套限时训练），大三门每天不断档——基本盘比偏科突围更重要。" });
    if (academicsBlock) {
      const weak = academicsBlock.rows.filter((r) => r.pct < 60).map((r) => r.name);
      if (weak.length > 0) actionTips.push({ phase: "本学期", text: `低于 60% 的科目（${weak.join("、")}）：先补基础概念再刷题，别直接上难题——基础题才是中考分母。` });
    }
    actionTips.push({ phase: "本学年末", text: "期末后录一次成绩看曲线走向：上升的科目延续方法，下滑的科目下学期开学第一周就换策略。" });
  }
  if (mbtiBlock) actionTips.push({ phase: "长期", text: `按「${mbtiBlock.name}」的学习风格执行（见上方升学打法），比盲目刷题效率高得多。` });

  /* ---- 给家长的话 ---- */
  const parentTips: string[] = highSchool
    ? [
        "选科建议只是数据视角的参考，不是判决：请结合孩子的真实意愿、学校师资与开班情况一起讨论，共同决策。",
        "对「谨慎学科」少批评、多换位——双低往往只是还没遇到对的学法；对「优势学科」多给资源（好老师/好资料/参赛机会）。",
        "每学期复测一次测评并更新成绩，本报告会随数据演化——它是一份「活」的升学地图，不是一次性结论。",
      ]
    : [
        "测评只是孩子当下的一面镜子，不是标签：小学初中的结果还在变化，多观察、多鼓励，少定性。",
        "对暂时落后的学科少批评、多换位——往往只是还没遇到对的学法；对优势方向多给体验资源（参观、社团、好老师）。",
        "每学期复测一次测评并更新成绩，本报告会随数据演化——它是一份「活」的成长地图，不是一次性结论。",
      ];
  if (academicsBlock?.avgPct != null && academicsBlock.avgPct < 60) {
    parentTips.push(`孩子当前平均得分率约 ${academicsBlock.avgPct}%，与其焦虑排名，不如先抓「优势学科」建立信心，再逐个解决目标差距大的科目。`);
  }

  /* ---- V84：测评结果概览 / 霍兰德深度 / 差距表 / 学科卡 / 未来期望 / 信 / 详情库 ---- */

  /* 测评结果概览（Part1 风格）。 */
  const overview: GuidanceReport["overview"] = [
    holland
      ? { label: "霍兰德职业兴趣", value: `${holland.code} 型`, status: "done", note: holland.keywords }
      : { label: "霍兰德职业兴趣", value: "待测评", status: "todo", note: "完成后这里会给出你的兴趣代码（如 SIA）" },
    mbti
      ? { label: "MBTI 职业性格", value: `${mbtiBlock?.type ?? mbti.type.toUpperCase()} · ${mbtiBlock?.name ?? ""}`, status: "done", note: "影响学习打法与适合的专业气质" }
      : { label: "MBTI 职业性格", value: "待测评", status: "todo", note: "完成后补充性格与学习风格分析" },
    disc
      ? { label: "DISC 行为风格", value: `${discBlock?.name ?? disc.primary.toUpperCase()} 型`, status: "done", note: "影响升学路径的打法选择" }
      : { label: "DISC 行为风格", value: "待测评", status: "todo", note: "完成后补充行为风格分析" },
    multi5
      ? { label: "多元智能五项", value: multi5Block?.length ? `最强：${multi5Block[0].label} ${multi5Block[0].score}` : "已测评", status: "done", note: "能力底子的画像" }
      : { label: "多元智能五项", value: "待测评", status: "todo", note: "完成后补充能力优势分析" },
    anchor
      ? { label: "职业锚", value: anchorBlock?.length ? `主导：${anchorBlock[0].label}` : "已测评", status: "done", note: "你最看重的职业回报是什么" }
      : { label: "职业锚", value: "待测评", status: "todo", note: "完成后补充择业价值观分析" },
    academicsBlock
      ? { label: "学业成绩", value: `平均得分率 ${academicsBlock.avgPct}%`, status: "done", note: academicsBlock.examName }
      : { label: "学业成绩", value: "待录入", status: "todo", note: "在「我的档案」录入后报告会更准" },
  ];

  /* 霍兰德深度解读：个人侧写 + 各型特征 bullet（样例报告 Part1·职业兴趣分析）。 */
  const hollandDeep: GuidanceReport["hollandDeep"] = (() => {
    if (!holland || !hollandBlock) return null;
    const rep = buildHollandReport(holland);
    return {
      code: rep.code,
      keywords: rep.keywords,
      relationNote: rep.relationNote,
      types: rep.top3.map((x) => {
        const dim = rep.dims.find((d) => d.key === x.key);
        return { key: x.key, label: x.label, score: x.score, trait: dim?.trait ?? "", studyImpact: dim?.studyImpact ?? [] };
      }),
    };
  })();

  /* 距离目标差距表（样例报告「距离目标大学/专业」表）。 */
  const gapTable: GuidanceReport["gapTable"] = academicsBlock
    ? {
        rows: academicsBlock.rows.map((r) => {
          const targetRaw = r.targetPct != null ? Math.round(((r.targetPct / 100) * r.full) * 10) / 10 : null;
          const gapRaw = targetRaw != null ? Math.round((targetRaw - r.raw) * 10) / 10 : null;
          return { name: r.name, raw: r.raw, full: r.full, pct: r.pct, targetRaw, targetPct: r.targetPct, gapRaw, gapPct: r.gap };
        }),
      }
    : null;

  /* 学科表现分析：每科一张画像卡（样例报告 Part2「学科表现分析」）。 */
  let subjectCards: GuidanceReport["subjectCards"] = null;
  if (academicsBlock) {
    const quadrantOf = (n: string) => matrix?.find((m) => m.name === n)?.quadrant;
    const interestSource = (n: string): string => {
      const fromH =
        !!holland && holland.top3.some((k) => HOLLAND_SUBJECTS[k].includes(n));
      const fromM =
        !!multi5 &&
        (Object.entries(MULTI5_SUBJECT_BOOST) as [Multi5Key, string[]][]).some(([k, arr]) => arr.includes(n) && (multi5!.dims[k] ?? 0) >= 70);
      if (fromH && fromM) return "霍兰德兴趣 + 多元智能";
      if (fromH) return "霍兰德兴趣映射";
      if (fromM) return "多元智能加成";
      return "综合评估";
    };
    subjectCards = academicsBlock.rows
      .slice()
      .sort((a, b) => b.pct - a.pct)
      .map((r) => {
        const interest = interestMap.get(r.name) ?? 0;
        const ability = abilityOf(r.name);
        const q = quadrantOf(r.name);
        const tone: NonNullable<typeof subjectCards>[number]["tone"] =
          r.pct >= 80 ? "优势" : r.pct >= 70 ? "良好" : interest >= 70 && r.pct < 70 ? "潜能" : r.pct >= 60 ? "稳分" : "待提升";
        const parts: string[] = [];
        if (tone === "优势") parts.push(`${r.name}是当前的优势学科：学得顺、考得好，继续配最多的资源，把它打造成升学名片。`);
        else if (tone === "良好") parts.push(`${r.name}基础扎实，再往深走一步（综合题/拓展）就能升级成优势学科。`);
        else if (tone === "潜能") parts.push(`${r.name}兴趣浓厚但成绩还没跟上——先查方法（错题归因 + 主动请教老师），往往是提分性价比最高的地方。`);
        else if (tone === "稳分") parts.push(`${r.name}成绩尚可、兴趣一般，适合作为「稳分组合」，不必强扭成热爱。`);
        else parts.push(`${r.name}暂时落后：先回到课本与基础题，把错题按「粗心/不会/没时间」归因后再逐个击破。`);
        if (q === "潜能学科") parts.push("兴趣×学业四象限把它列为「潜能学科」。");
        if (q === "谨慎学科") parts.push("注意它在四象限中属于「谨慎学科」，投入前先想清楚目标。");
        if (interest >= 75) parts.push(`测评显示你对这门课兴趣浓厚（兴趣分 ${interest}）。`);
        else if (interest <= 30) parts.push("兴趣测评显示它并非你的热情所在，靠方法而非热情驱动。");
        if (r.trend === "up") parts.push(`最近呈上升趋势（+${r.trendPct}%），趁热打铁。`);
        if (r.trend === "down") parts.push(`最近有所下滑（${r.trendPct}%），先找原因再换方法。`);
        if ((r.gap ?? 0) >= 15) parts.push(`距离目标还差 ${r.gap} 个百分点，列为本学期重点攻克项。`);
        return { name: r.name, pct: r.pct, raw: r.raw, full: r.full, trend: r.trend, trendPct: r.trendPct, interest, interestFrom: interestSource(r.name), ability, tone, comment: parts.join("") };
      });
  }

  /* 未来期望填空卡（样例报告「未来期望：___大学___专业___职业」）。 */
  const futureExpect: GuidanceReport["futureExpect"] =
    majors.length > 0 || industries.length > 0 || schoolPlan
      ? {
          uniHint: schoolPlan ? `${schoolPlan.tier} 档（预估 ${schoolPlan.estScore} 分）` : null,
          majorHints: majors.slice(0, 3).map((m) => m.name),
          careerHints: industries.slice(0, 3).map((i) => i.name),
        }
      : null;

  /* 给未来自己的一封信（样例报告 Part3，自动生成 + 留白）。 */
  const letterParas: string[] = [];
  {
    const today = new Date();
    const dateStr = `${today.getFullYear()} 年 ${today.getMonth() + 1} 月 ${today.getDate()} 日`;
    letterParas.push(`亲爱的${input.studentName ?? "未来的我"}：你好！我是 ${dateStr} 的你，正在${grade ? `${grade}的教室里` : "校园里"}写下这封信。`);
    if (academicsBlock?.avgPct != null) {
      const sortedRows = academicsBlock.rows.slice().sort((a, b) => b.pct - a.pct);
      const best = sortedRows[0];
      const worstGap = academicsBlock.rows.filter((r) => r.gap != null).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))[0];
      letterParas.push(
        `此刻的学业画卷是这样：${academicsBlock.examName}平均得分率 ${academicsBlock.avgPct}%，最顺手的是${best.name}（${best.pct}%）` +
          (worstGap ? `，最想攻克的是${worstGap.name}（距离目标还差 ${worstGap.gap} 个百分点）。` : "。"),
      );
    }
    const who: string[] = [];
    if (hollandBlock) who.push(`霍兰德兴趣代码「${hollandBlock.code}」——${hollandBlock.top3.map((t) => t.label).join("、")}`);
    if (mbtiBlock) who.push(`MBTI ${mbtiBlock.type}（${mbtiBlock.name}）`);
    if (multi5Block?.length) who.push(`最强智能是${multi5Block[0].label}`);
    if (who.length) letterParas.push(`关于「我是谁」，测评给出的坐标是：${who.join("；")}。它们不是标签，而是你在认识自己路上留下的脚印。`);
    const where: string[] = [];
    if (majors.length) where.push(`适合的专业方向有${majors.slice(0, 3).map((m) => m.name).join("、")}`);
    if (industries.length) where.push(`向往的职业方向有${industries.slice(0, 3).map((i) => i.name).join("、")}`);
    if (where.length) letterParas.push(`关于「想去哪里」，${where.join("；")}。请把它们当作指南针而不是紧箍咒——路线可以调整，方向感是自己的。`);
    letterParas.push(
      highSchool
        ? "高中的路很长也很快。愿你在每一次选择前多一点从容，在每一次想放弃时多一点坚持；愿选科不人云亦云，努力不负晨光。三年后再打开这封信时，愿你已站在自己选择的风景里。"
        : "成长的路很长也很快。愿你在每一次选择前多一点从容，在每一次想放弃时多一点坚持；愿你眼里的光，比成绩单上的数字更亮。",
    );
    letterParas.push("——来自今天的你");
  }

  /* 推荐专业/职业详情（匹配静态库，样例报告 Part4/Part5）。 */
  const majorDetails = majors.slice(0, 5).map((m) => getMajorDetail(m.name)).filter((x): x is MajorDetail => x != null);
  const careerSeen = new Set<string>();
  const careerDetails = industries
    .slice(0, 6)
    .map((i) => getCareerDetail(i.name))
    .filter((x): x is CareerDetail => x != null && !careerSeen.has(x.name) && (careerSeen.add(x.name), true))
    .slice(0, 5);

  /* ---- 标题 ---- */
  const strongMajors = matrix?.filter((m) => m.quadrant === "优势学科") ?? [];
  const headline = strongMajors.length > 0
    ? `「${strongMajors.slice(0, 2).map((m) => m.name).join(" · ")}」是当前最大的优势区`
    : academicsBlock?.avgPct != null
      ? `当前平均得分率 ${academicsBlock.avgPct}%，潜力仍待挖掘`
      : "兴趣画像清晰，补充成绩后建议会更精准";

  return {
    basedOn,
    missing,
    headline,
    academicsBlock,
    matrix,
    combos,
    subjectAdvice,
    mbtiBlock,
    discBlock,
    multi5Block,
    anchorBlock,
    hollandBlock,
    majors,
    industries,
    pathway,
    scorecard,
    disciplines,
    schoolPlan,
    firstDecision,
    secondDecision,
    parentTips,
    actionTips,
    overview,
    hollandDeep,
    gapTable,
    subjectCards,
    futureExpect,
    letterParas,
    majorDetails,
    careerDetails,
  };
}
