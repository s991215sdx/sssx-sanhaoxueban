import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { RefreshCw } from "lucide-react";

/** 构建时注入的服务端版本号（vite define，源是 api/router.ts 的 BUILD_TAG）。 */
const CLIENT_TAG = (import.meta.env.VITE_BUILD_TAG as string | undefined) ?? "dev";

/**
 * v71：新版本提示条。后台每 60s 对比一次服务器版本号，发现服务端已发新版
 * （典型场景：微信/webview 缓存了旧 index.html，页面跑的还是旧包）→ 弹出提示，
 * 用户点一下刷新即上新版，避免旧包的 bug 被当成"刚修的没生效"。
 */
export default function UpdateToast() {
  const [visible, setVisible] = useState(false);
  const ping = trpc.ping.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 15_000,
    retry: false,
  });
  const serverV = (ping.data as { v?: string } | undefined)?.v;
  useEffect(() => {
    if (!serverV || CLIENT_TAG === "dev" || serverV === CLIENT_TAG) return;
    setVisible(true);
  }, [serverV]);
  if (!visible || !serverV) return null;
  return (
    <div className="fixed inset-x-0 bottom-20 z-[90] flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-2xl border border-lime/60 bg-olive px-4 py-2.5 shadow-xl">
        <RefreshCw size={15} className="shrink-0 text-lime" />
        <span className="text-[13px] text-cream">
          发现新版本（{serverV}），刷新后生效
        </span>
        <button
          onClick={() => window.location.reload()}
          className="shrink-0 rounded-lg bg-lime px-3 py-1 text-[12.5px] font-bold text-olive transition-colors hover:bg-lime-deep hover:text-cream"
        >
          立即刷新
        </button>
      </div>
    </div>
  );
}
