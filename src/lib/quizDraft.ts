import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * 测评作答草稿（防误退出重测）：
 * - 作答过程实时写入 localStorage（每答一题/每改一项都保存）；
 * - 误点导航、刷新、退出后重新进入同一测评，自动恢复到上次进度；
 * - 提交成功后清除草稿；想重测可点「重新开始」。
 */

const PREFIX = "sanhao.quizDraft.";

/** 读取某测评的草稿（无草稿或解析失败返回 null）。 */
export function loadQuizDraft<T extends Record<string, unknown> = Record<string, unknown>>(kind: string): Partial<T> | null {
  try {
    const raw = localStorage.getItem(PREFIX + kind);
    return raw ? (JSON.parse(raw) as Partial<T>) : null;
  } catch {
    return null;
  }
}

/** 合并写入草稿的若干字段。 */
export function patchQuizDraft(kind: string, patch: Record<string, unknown>) {
  try {
    const cur = loadQuizDraft(kind) ?? {};
    localStorage.setItem(PREFIX + kind, JSON.stringify({ ...cur, ...patch }));
  } catch {
    /* 存储不可用时静默降级为不保存 */
  }
}

/** 清除某测评的草稿（提交成功后调用）。 */
export function clearQuizDraft(kind: string) {
  try {
    localStorage.removeItem(PREFIX + kind);
  } catch {
    /* ignore */
  }
}

/**
 * 带草稿持久化的 useState：初值优先取草稿中同名字段，之后每次变更自动写回草稿。
 * 用法与 useState 完全一致：`const [answers, setAnswers] = useDraftState("multi5", "answers", [] as number[])`
 */
export function useDraftState<S>(kind: string, key: string, initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>] {
  const [value, setValue] = useState<S>(() => {
    const draft = loadQuizDraft<Record<string, S>>(kind);
    if (draft && key in draft && draft[key] !== undefined && draft[key] !== null) return draft[key] as S;
    return typeof initial === "function" ? (initial as () => S)() : initial;
  });
  useEffect(() => {
    patchQuizDraft(kind, { [key]: value });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return [value, setValue];
}

/** 判断某测评是否存在「有实质进度」的草稿（用于展示恢复提示条）。 */
export function hasMeaningfulDraft(kind: string, answeredCountKey = "answers"): boolean {
  const d = loadQuizDraft(kind);
  if (!d) return false;
  const answers = d[answeredCountKey];
  if (Array.isArray(answers)) return answers.some((a) => a !== undefined && a !== null);
  return Object.keys(d).length > 0;
}
