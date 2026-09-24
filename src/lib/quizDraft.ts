import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * 测评作答草稿（防误退出重测）：
 * - 作答过程实时写入 localStorage（每答一题/每改一项都保存）；
 * - 误点导航、刷新、退出后重新进入同一测评，自动恢复到上次进度；
 * - 提交成功后清除草稿；想重测可点「重新开始」。
 * - v67：草稿按账号隔离（key 含 user.id），同一浏览器换账号登录互不串草稿。
 */

const PREFIX = "sanhao.quizDraft.";

function draftKey(uid: string | null | undefined, kind: string) {
  return `${PREFIX}${uid ?? "anon"}.${kind}`;
}

/** 读取某账号某测评的草稿（无草稿或解析失败返回 null）。 */
export function loadQuizDraft<T extends Record<string, unknown> = Record<string, unknown>>(uid: string | null | undefined, kind: string): Partial<T> | null {
  try {
    const raw = localStorage.getItem(draftKey(uid, kind));
    return raw ? (JSON.parse(raw) as Partial<T>) : null;
  } catch {
    return null;
  }
}

/** 合并写入草稿的若干字段。 */
export function patchQuizDraft(uid: string | null | undefined, kind: string, patch: Record<string, unknown>) {
  try {
    const cur = loadQuizDraft(uid, kind) ?? {};
    localStorage.setItem(draftKey(uid, kind), JSON.stringify({ ...cur, ...patch }));
  } catch {
    /* 存储不可用时静默降级为不保存 */
  }
}

/** 清除某账号某测评的草稿（提交成功后调用）。 */
export function clearQuizDraft(uid: string | null | undefined, kind: string) {
  try {
    localStorage.removeItem(draftKey(uid, kind));
  } catch {
    /* ignore */
  }
}

/**
 * 带草稿持久化的 useState：初值优先取草稿中同名字段，之后每次变更自动写回草稿。
 * 草稿按当前登录账号隔离；uid 迟到（会话加载完才拿到）时自动改读对应账号的草稿。
 * 用法与 useState 一致：`const [answers, setAnswers] = useDraftState("multi5", "answers", [] as number[])`
 */
export function useDraftState<S>(kind: string, key: string, initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>] {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [value, setValue] = useState<S>(() => {
    const draft = loadQuizDraft<Record<string, S>>(uid, kind);
    if (draft && key in draft && draft[key] !== undefined && draft[key] !== null) return draft[key] as S;
    return typeof initial === "function" ? (initial as () => S)() : initial;
  });
  // uid 迟到（会话恢复前初始化了 state）：账号明确后按该账号草稿重读一次
  const [seenUid, setSeenUid] = useState<string | null>(uid);
  useEffect(() => {
    if (uid === seenUid) return;
    setSeenUid(uid);
    const draft = loadQuizDraft<Record<string, S>>(uid, kind);
    if (draft && key in draft && draft[key] !== undefined && draft[key] !== null) {
      setValue(draft[key] as S);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);
  useEffect(() => {
    patchQuizDraft(uid, kind, { [key]: value });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, uid]);
  return [value, setValue];
}

/** 判断某账号某测评是否存在「有实质进度」的草稿（用于展示恢复提示条）。 */
export function hasMeaningfulDraft(uid: string | null | undefined, kind: string, answeredCountKey = "answers"): boolean {
  const d = loadQuizDraft(uid, kind);
  if (!d) return false;
  const answers = d[answeredCountKey];
  if (Array.isArray(answers)) return answers.some((a) => a !== undefined && a !== null);
  return Object.keys(d).length > 0;
}
