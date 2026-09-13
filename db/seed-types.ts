import type { Stage } from "../contracts/constants";

export interface QuestionSeed {
  type: "choice" | "fill";
  stage: "check" | "practice" | "variant";
  difficulty: 1 | 2 | 3;
  stem: string;
  options?: string[];
  answer: string; // 多个等价答案用 | 分隔
  hint: string;
  explanation: string;
}

export interface KPSeed {
  code: string;
  // 深度种子（G7）历史数据不带学段字段，落库时由 runSeed 默认 初中/初一
  stage?: Stage;
  grade?: string;
  /** 学科，缺省「数学」。如 语文/英语/道德与法治/科学 */
  subject?: string;
  chapter: string;
  title: string;
  sortOrder: number;
  summary: { heading: string; body: string }[];
  example: { stem: string; analysis: string; answer: string };
  prereqCodes: string[];
  commonErrors: { cause: string; detail: string }[];
  socratic: { keyConcepts: string[]; probes: string[]; hints: string[] };
  questions: QuestionSeed[];
}

/** 骨架章：人教版目录的一章 + 4-5 个知识点标题，展开为占位知识点。 */
export interface SkeletonChapter {
  /** 章编码前缀，如 "G1-1"、"G7-5"，知识点 code 自动补 -01/-02… */
  code: string;
  stage: Stage;
  /** 规范年级值（contracts/constants.ts 的 GRADES） */
  grade: string;
  /** 章名，如 "第一章 有理数"、"准备课" */
  chapter: string;
  /** 本章知识点标题（4-5 个），按教学顺序 */
  titles: string[];
  /** 章级前置：前置章编码（如 ["G6-5"]），缺省为同文件内的上一章 */
  prereq?: string[];
}

/** 展开后的骨架知识点（精讲/例题/题库留空，第二期填充）。 */
export interface SkeletonKP {
  code: string;
  stage: Stage;
  grade: string;
  chapter: string;
  title: string;
  prereqCodes: string[];
  sortOrder: number;
}
