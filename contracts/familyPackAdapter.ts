/**
 * v250 题包 → v236 计分器的编号适配
 *
 * 完整版换了编号（家长 P01—P55、孩子 S01—S10），但 `buildFamilyParentProfile` /
 * `buildFamilyStudentProfile` 那两套计分器是按旧编号（AP/BP/EP/FP/GP、FS01—FS14）写的。
 * 与其把计分器重写一遍、让老答卷的复算口径跟着变，不如在这里做一层**只翻号、不改义**的映射：
 *
 * - 旧卷仍在库里的历史答卷，按旧号直接算，不需要迁移；
 * - 新卷按新号交上来，先翻成旧号再算，算出来的台阶 / 要求 / 回应与旧卷同尺可比。
 *
 * 只映射**语义一一对应**的题。新卷多出来的（家里支持 9 题、条件观察 7 题、认知对照 16 题、
 * 投入 2 题、自身 2 题）在旧计分器里没有对应槽位，直接丢弃——它们只在完整版报告里用，
 * 由 contracts/familyFullReport.ts 单独取。
 */

/** 孩子卷：S01—S10 → FS01—FS13（FS09 是 0—10 打分题，新卷不再问，缺就缺） */
const STUDENT_MAP: Record<string, string> = {
  S01: "FS01",
  S02: "FS02",
  S03: "FS03",
  S04: "FS04",
  S05: "FS05",
  S06: "FS06",
  S07: "FS07",
  S08: "FS08",
  S09: "FS12",
  S10: "FS13",
};

/** 家长卷：P33—P54 → AP/BP/FP/GP 旧号 */
const PARENT_MAP: Record<string, string> = {
  P33: "AP01",
  P34: "AP02",
  P35: "AP03",
  P36: "AP04",
  P37: "AP05",
  P38: "BP01",
  P39: "BP02",
  P40: "BP03",
  P41: "BP04",
  P42: "BP05",
  P43: "BP06",
  P44: "BP07",
  P45: "BP08",
  P46: "FP01",
  P47: "FP02",
  P48: "FP03",
  P49: "FP04",
  P50: "FP05",
  P51: "GP01",
  P52: "GP02",
  P53: "GP04",
  P54: "GP05",
};

/** 是不是 v250 新卷（有 S01 或 P33 就是新的）。 */
export const isV250Student = (items: Record<string, number>) => items.S01 != null || items.S10 != null;
export const isV250Parent = (items: Record<string, number>) => items.P33 != null || items.P55 != null;

export function toV236StudentItems(items: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [from, to] of Object.entries(STUDENT_MAP)) {
    if (items[from] != null) out[to] = items[from];
  }
  /* 旧号也一并保留：兼容混答（老用户增量补答）的情况 */
  for (const [k, v] of Object.entries(items)) if (k.startsWith("FS")) out[k] = v;
  return out;
}

export function toV236ParentItems(items: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [from, to] of Object.entries(PARENT_MAP)) {
    if (items[from] != null) out[to] = items[from];
  }
  for (const [k, v] of Object.entries(items)) if (/^(AP|BP|EP|FP|GP|HP)/.test(k)) out[k] = v;
  return out;
}
