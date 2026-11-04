/**
 * 「出码」请求通道（v239）。
 *
 * 报告里所有「去做测评」的按钮，在伴学师视角下都要变成弹码。要改的点分散在
 * 报告正文、缺数据的提示卡、单份详解里，一路传 props 会污染一大片签名；
 * 用一层 context 让它们自己取即可，学生端没有这层 Provider，行为一字不变。
 */
import { createContext, useContext } from "react";

export const PassCtx = createContext<((kind: string) => void) | null>(null);

/** 没有 Provider 时返回 null —— 调用方据此走原来的跳页逻辑。 */
export function useAssessmentPass() {
  return useContext(PassCtx);
}
