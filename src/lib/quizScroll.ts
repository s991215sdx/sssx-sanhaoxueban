import { useEffect, useRef } from "react";

/**
 * v181 测评答题「题目定位」：每次换题（题号/依赖变化）时，把 ref 挂载的题目+选项
 * 区域自动滚动到可视区上方（避开移动端顶栏，配合 scroll-mt 使用）——
 * 解决手机微信内打开测评时页面停在顶部、要手动往下翻才看得到题的问题。
 *
 * 用法：
 *   const qRef = useScrollToQuestion(curIdx);
 *   return <div ref={qRef} className="scroll-mt-20">…题目与选项…</div>;
 */
export function useScrollToQuestion<T extends HTMLElement = HTMLDivElement>(dep: unknown) {
  const ref = useRef<T>(null);
  const firstRef = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    /* 首次挂载也定位一次（深链/套餐直达时页面可能停在顶部） */
    if (firstRef.current) {
      firstRef.current = false;
      el.scrollIntoView({ block: "start" });
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);
  return ref;
}
