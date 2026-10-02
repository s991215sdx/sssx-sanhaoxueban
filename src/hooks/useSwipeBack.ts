import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";

/**
 * v80 手机手势返回：在页面（除输入控件外）从左向右滑动 → 返回上一步。
 * - 触发条件：单指、水平位移 > 72px、垂直偏移 < 56px（保证是横划不是滚动）
 * - 防误触：输入框/带 data-swipe-back="off" 的区域不响应；
 *   横向前景可滚动容器且还能继续左滚时让位给容器自身滚动
 * - 无站内历史可退（首屏直达）时回到首页
 */
export function useSwipeBack() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let startEl: EventTarget | null = null;
    let tracking = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        tracking = false;
        return;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startEl = e.target;
      tracking = true;
    };

    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (dx < 72 || Math.abs(dy) > 56) return;

      /* 输入控件与显式豁免区域不触发 */
      const el = startEl as HTMLElement | null;
      if (el && typeof el.closest === "function") {
        if (el.closest('input, textarea, select, [data-swipe-back="off"], [role="slider"]')) return;
        /* 横向可滚祖先还能继续往左滚 → 让位给容器滚动 */
        let p: HTMLElement | null = el;
        while (p) {
          if (p.scrollWidth > p.clientWidth + 8 && p.scrollLeft > 4) return;
          p = p.parentElement;
        }
      }

      /* 站内已有历史 → 后退；否则回首页 */
      if (window.history.state?.idx > 0) navigate(-1);
      else navigate("/");
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, [navigate]);

  /* 返回当前 location，供调用方做按页豁免（如个别页面 data-swipe-back） */
  return location;
}
