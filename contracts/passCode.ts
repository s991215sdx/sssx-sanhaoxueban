/**
 * 测评码（v239）：伴学师在后台点一项测评，出一张码，孩子或家长扫码当场作答。
 *
 * 和家庭码（v238）是同一套思路的第二步：家庭码只解决「家长卷落到哪个孩子」，
 * 测评码要解决「这份测评落到哪个孩子、由谁答」。两者的共同前提是——
 * 伴学师手上的这台电脑登不进孩子的手机，而让孩子/家长现场装 App、找回密码，
 * 十次有八次会变成「下次再说」，测评就永远缺一份。
 *
 * 码仍然是算出来的，不落表：`<孩子编号>-<测评代号>-<时段>-<签名>`，签名用应用密钥派生。
 * 时段是 6 小时一格的滚动窗口，只认当前与前一个窗口，所以一张码最多活 12 小时——
 * 它本质上是一张「允许以这个孩子身份提交这一份问卷」的通行证，寿命必须有尽头。
 *
 * 两种模式，差别只在一件事：答卷要不要挂在某个登录态上。
 *  - student：孩子本人答。扫码页给一个 2 小时的短会话，之后走完整的学生端流程，
 *    测评中心、答题、报告都和平时一样，不会因为「扫码来的」少了什么。
 *  - parent：家长答。扫码页就地渲染问卷，提交走公开接口，答案直接落到孩子名下，
 *    全程不给家长任何账号态——家长不该看到孩子的心理筛查和自评。
 */

/** 签名字母表：与家庭码、邀请码一致，剔除 0/o、1/l/i 这类易混字符。 */
export const PASS_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** 签名位数。6 位约 1e9 种，配 12 小时寿命，试不出来。 */
export const PASS_SIG_LEN = 6;

/** 时段长度（小时）：6 小时一格，只认当前与上一格，故一张码最多活 12 小时。 */
export const PASS_SLOT_HOURS = 6;

/** 一张码允许活多久（毫秒），用于前端提示「几点前有效」。 */
export const PASS_TTL_MS = PASS_SLOT_HOURS * 2 * 60 * 60 * 1000;

/** 孩子扫码后拿到的短会话时长：够答完最长的一套（SCL-90 约 20 分钟），不够干别的。 */
export const PASS_SESSION_MINUTES = 120;

/**
 * 合法码形状：`<孩子编号>-<测评代号>-<时段>-<签名>`，如 `a1-mb-8f3k-qw7xd2`。
 * 编号最长 12 位（36 进制 12 位远超 int 范围），代号 1—2 位，时段 1—6 位，签名固定 6 位。
 */
export const PASS_CODE_RE = /^[a-z0-9]{1,12}-[a-z0-9]{1,2}-[a-z0-9]{1,6}-[a-z0-9]{6}$/;

export type PassKind =
  | "mbti"
  | "disc"
  | "e3"
  | "e3parent"
  | "multi5"
  | "discparent"
  | "anchor"
  | "holland"
  | "mental"
  | "subject"
  | "subject4d"
  | "familystudent"
  | "familyparent";

export type PassDef = {
  kind: PassKind;
  /** 码里用的两字母代号，越短越好扫（手输也不费劲） */
  slug: string;
  /** 扫码页上给答题人看的名字：用日常叫法，不用内部术语 */
  name: string;
  /** 一句话说清要答多久、答什么 */
  brief: string;
  /** student = 孩子本人；parent = 家长 */
  who: "student" | "parent";
  /** 预计分钟数，扫码页上直接写出来，家长好判断现在有没有空 */
  minutes: number;
};

/**
 * 能出码的测评。断言 required 之外的选做项也都在——伴学师现场最常缺的恰恰是选做项。
 * 心理健康只有一项：四套量表在答题页内部自选，出四张码反而让伴学师不知道给哪张。
 */
export const PASS_DEFS: readonly PassDef[] = [
  { kind: "e3", slug: "e3", name: "学习力诊断", brief: "三阶九能 70 题，按学段出卷", who: "student", minutes: 15 },
  { kind: "mbti", slug: "mb", name: "MBTI 性格快测", brief: "28 道二选一", who: "student", minutes: 6 },
  { kind: "disc", slug: "dc", name: "DISC 行为风格", brief: "24 组「最像我 / 最不像我」", who: "student", minutes: 8 },
  { kind: "multi5", slug: "m5", name: "多元智能五项", brief: "40 题客观题，含计时", who: "student", minutes: 10 },
  { kind: "anchor", slug: "an", name: "职业锚测评", brief: "看看心里最看重什么", who: "student", minutes: 8 },
  { kind: "holland", slug: "ho", name: "霍兰德职业兴趣", brief: "RIASEC 六型兴趣", who: "student", minutes: 8 },
  { kind: "subject", slug: "sj", name: "学科能力评估", brief: "9 科「听懂 / 记住 / 运用」自评，可只答几科", who: "student", minutes: 10 },
  { kind: "subject4d", slug: "s4", name: "学科四维测评", brief: "9 科 × 4 维共 108 题", who: "student", minutes: 18 },
  { kind: "mental", slug: "mh", name: "心理健康筛查", brief: "四套国际通用量表，进去自己挑一套", who: "student", minutes: 8 },
  { kind: "familystudent", slug: "fs", name: "家庭关系测评 · 学生卷", brief: "14 题，你和爸妈之间哪一级走不通", who: "student", minutes: 4 },
  { kind: "familyparent", slug: "fp", name: "家庭关系测评 · 家长卷", brief: "29 题，爸爸、妈妈可各填一份", who: "parent", minutes: 7 },
  { kind: "e3parent", slug: "ep", name: "家长卷 · 家庭支持与观察", brief: "家庭环境、对孩子的观察，与孩子的诊断做对照", who: "parent", minutes: 9 },
  { kind: "discparent", slug: "dp", name: "家长 DISC（家庭版）", brief: "24 组词，看家庭里的行为风格", who: "parent", minutes: 6 },
];

const BY_KIND = new Map<PassKind, PassDef>(PASS_DEFS.map((d) => [d.kind, d]));
const BY_SLUG = new Map<string, PassDef>(PASS_DEFS.map((d) => [d.slug, d]));

export function passDefOf(kind: string): PassDef | null {
  return BY_KIND.get(kind as PassKind) ?? null;
}

export function passDefBySlug(slug: string): PassDef | null {
  return BY_SLUG.get(slug) ?? null;
}

export function isPassKind(kind: string): kind is PassKind {
  return BY_KIND.has(kind as PassKind);
}

/** 家长答的三种卷：扫码页就地渲染，提交走公开接口。 */
export function isParentPass(kind: PassKind): boolean {
  return BY_KIND.get(kind)?.who === "parent";
}

/** 归一化：去空白、转小写、去掉粘贴时混进来的全角横线。手输或扫码识别出错时不该卡在大小写上。 */
export function normalizePassCode(raw: string): string {
  return (raw ?? "").trim().toLowerCase().replace(/[—–－]/g, "-");
}

/** 扫码 / 点链接进入的路径。 */
export function passPath(code: string): string {
  return `/p/${normalizePassCode(code)}`;
}

/** 某一时刻属于哪个时段（6 小时一格，从 Unix 纪元起算，全球一致，不依赖时区）。 */
export function passSlotAt(ts: number): number {
  return Math.floor(ts / (PASS_SLOT_HOURS * 3600 * 1000));
}

/** 这个时段的码什么时候彻底作废（下一格结束的时刻）。 */
export function passExpiresAt(slot: number): number {
  return (slot + 2) * PASS_SLOT_HOURS * 3600 * 1000;
}

/**
 * 家长扫码页上「已经收到几份」的措辞。
 * 单数、复数分开写，是因为「已收到 1 份」和「已收到 1 位家长」在家长眼里是两件事。
 */
export function passReceivedText(n: number, total: number): string {
  if (n <= 0) return total > 1 ? "还没收到任何一份" : "还没收到";
  return total > 1 ? `已收到 ${n} 位家长` : "已经收到一份";
}
