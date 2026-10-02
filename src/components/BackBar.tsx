import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

/**
 * v80 全局返回条：每个页面顶部提供「返回」按钮，回到上一步；
 * 无站内历史可退（如扫码/收藏直达的首个页面）时隐藏，避免按钮落空。
 */
export default function BackBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const canGoBack = typeof window !== "undefined" && (window.history.state?.idx ?? 0) > 0;
  /* 首屏且已在首页：没有「上一步」可回，不显示 */
  if (!canGoBack && location.pathname === "/") return null;

  return (
    <div className="mb-3 flex items-center md:mb-4">
      <button
        onClick={() => {
          if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
          else navigate("/");
        }}
        aria-label="返回上一步"
        className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13.5px] font-semibold text-olive-mute transition-colors hover:bg-lime-pale hover:text-olive"
      >
        <ArrowLeft size={16} strokeWidth={2.4} />
        返回
      </button>
    </div>
  );
}
