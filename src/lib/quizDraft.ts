import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * 测评作答草稿（防误退出重测）：
 * - 作答过程实时写入 localStorage（每答一题/每改一项都保存）；
 * - 误点导航、刷新、退出后重新进入同一测评，自动恢复到上次进度；
 * - 提交成功后清除草稿；想重测可点「重新开始」。
 * - v67：草稿按账号隔离（key 含 user.id），同一浏览器换账号登录互不串草稿。
 */

const PREFIX = "sanhao.quizDraft.";

function draftKey(uid: string | number | null | undefined, kind: string) {
  return `${PREFIX}${uid ?? "anon"}.${kind}`;
}

/**
 * 读取某账号某测评的草稿（无草稿或解析失败返回 null）。
 * v70：草稿带写入者标记 `_w`（= 当时登录账号 id）。出现以下情况一律视为无草稿：
 *  - 旧版草稿没有 `_w`（无法确认归属，直接丢弃，避免把别的账号进度带进本账号）；
 *  - `_w` 与当前 uid 不一致（草稿是别的账号写的，典型的换号污染）。
 */
export function loadQuizDraft<T extends Record<string, unknown> = Record<string, unknown>>(uid: string | number | null | undefined, kind: string): Partial<T> | null {
  try {
    const raw = localStorage.getItem(draftKey(uid, kind));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed._w === undefined || String(parsed._w) !== String(uid ?? "anon")) return null;
    return parsed as Partial<T>;
  } catch {
    return null;
  }
}

/** 合并写入草稿的若干字段（同时盖上写入者标记 `_w`，供换号时识别归属）。 */
export function patchQuizDraft(uid: string | number | null | undefined, kind: string, patch: Record<string, unknown>) {
  try {
    const cur = loadQuizDraft(uid, kind) ?? {};
    localStorage.setItem(draftKey(uid, kind), JSON.stringify({ ...cur, ...patch, _w: String(uid ?? "anon") }));
  } catch {
    /* 存储不可用时静默降级为不保存 */
  }
}

/** 清除某账号某测评的草稿（提交成功后调用）。 */
export function clearQuizDraft(uid: string | number | null | undefined, kind: string) {
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
  const uid = user?.id == null ? null : String(user.id);
  const [initialValue] = useState<S>(() => (typeof initial === "function" ? (initial as () => S)() : initial));
  const [value, setValue] = useState<S>(() => {
    const draft = loadQuizDraft<Record<string, S>>(uid, kind);
    if (draft && key in draft && draft[key] !== undefined && draft[key] !== null) return draft[key] as S;
    return initialValue;
  });
  // uid 迟到（会话恢复前初始化了 state）或换号：一律以「当前 uid 的草稿」为准——
  // 有则恢复，无则回初始值。v70 修：旧逻辑在新账号无草稿时保留旧账号的值，
  // persist 又把旧进度写进新账号草稿（新注册账号"被恢复"别人进度的根因）。
  const [seenUid, setSeenUid] = useState<string | null>(uid);
  const skipPersistRef = useRef(false);
  useEffect(() => {
    if (uid === seenUid) return;
    setSeenUid(uid);
    skipPersistRef.current = true;
    const draft = loadQuizDraft<Record<string, S>>(uid, kind);
    if (draft && key in draft && draft[key] !== undefined && draft[key] !== null) {
      setValue(draft[key] as S);
    } else {
      setValue(initialValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);
  useEffect(() => {
    // uid 刚切换的这一批 effect 里 value 还是旧账号数据，绝不能写进新账号草稿
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    patchQuizDraft(uid, kind, { [key]: value });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, uid]);
  return [value, setValue];
}

/**
 * 「已恢复上次进度」提示条状态：跟随 uid 重算（账号明确/换号后按当前账号草稿决定），
 * 绝不沿用挂载瞬间（可能还是旧账号缓存或匿名态）算出的结论。
 * v70 修：新注册账号因 auth.me 缓存未刷新，挂载时读到旧账号草稿而误显示"已恢复进度"。
 * 用法：const [resumed, setResumed] = useDraftResumed(user?.id, "discv2", "most");
 */
export function useDraftResumed(
  uid: string | number | null | undefined,
  kind: string,
  answeredCountKey = "answers",
): [boolean, Dispatch<SetStateAction<boolean>>] {
  const key = uid == null ? null : String(uid);
  const [resumed, setResumed] = useState<boolean>(() => (key == null ? false : hasMeaningfulDraft(key, kind, answeredCountKey)));
  useEffect(() => {
    setResumed(key == null ? false : hasMeaningfulDraft(key, kind, answeredCountKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, kind]);
  return [resumed, setResumed];
}

/** 判断某账号某测评是否存在「有实质进度」的草稿（用于展示恢复提示条）。
 *  只认作答数组里有没有非空项：刚挂载就写入的 `{idx:0,_w}` 这类初始草稿不算数，
 *  否则新账号第一次进测评就会误显示"已恢复上次进度"。 */
export function hasMeaningfulDraft(uid: string | number | null | undefined, kind: string, answeredCountKey = "answers"): boolean {
  const d = loadQuizDraft(uid, kind);
  if (!d) return false;
  const answers = d[answeredCountKey];
  if (!Array.isArray(answers)) return false;
  return answers.some((a) => a !== undefined && a !== null);
}
