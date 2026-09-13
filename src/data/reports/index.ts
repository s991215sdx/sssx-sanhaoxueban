import type { MbtiTypeReport } from "./types";
import { MBTI_REPORTS_A } from "./mbti-a";
import { MBTI_REPORTS_B } from "./mbti-b";
import { MBTI_REPORTS_C } from "./mbti-c";
import { MBTI_REPORTS_D } from "./mbti-d";

export * from "./types";
export { DISC_REPORTS, DISC_THEORY } from "./disc";
export { buildCombinedReport, buildE3Report, getDiscCombo, buildDiscComboBlend, DISC_ANIMAL } from "./combined";
export type { CombinedReportOptions } from "./combined";

/** MBTI 16 型详细报告汇总。 */
export const MBTI_REPORTS: Record<string, MbtiTypeReport> = {
  ...MBTI_REPORTS_A,
  ...MBTI_REPORTS_B,
  ...MBTI_REPORTS_C,
  ...MBTI_REPORTS_D,
};
