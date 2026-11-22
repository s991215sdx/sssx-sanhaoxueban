import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

/**
 * v80 全局返回条：每个页面顶部提供「返回」按钮，回到上一步；
 * 无站内历史可退（如扫码/收藏直达的首个页面）时隐藏，避免按钮落空。
 *
 * v253：带上 no-print 类。报告页要出 PDF 发给用人部门，
 * 这条「返回」留在纸上没有意义，还会被人问「这按钮点了会怎样」。
 */
export default function BackBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = typeof window !== "undefined" && (window.history.state?.idx ?? 0) > 0;
  /* 首屏且已在首页：没有「上一步」可回，不显示 */
  if (!canGoBack && location.pathname === "/") return null;

  return (
    <div className="no-print mb-3 flex items-center md:mb-4">
      <button
        onClick={() => {
          if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
          else navigate("/");
        }}
        aria-label="返回上一步"
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13.5px] font-semibold text-olive-mute transition-colors hover:bg-butter-pale hover:text-brand"
      >
        <ArrowLeft size={16} strokeWidth={2.4} />
        返回
      </button>
    </div>
  );
}
