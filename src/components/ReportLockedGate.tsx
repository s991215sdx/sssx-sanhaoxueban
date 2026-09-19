import { FileLock2 } from "lucide-react";
import { trpc } from "@/providers/trpc";

/**
 * V54 · 报告查看门禁（学生/家长端）：报告由伴学师把关——默认测评完成后不可直接查看，
 * 伴学师在后台「推送报告」后才能看。已推送（或无档案，向后兼容）时直接渲染 children。
 */
export default function ReportLockedGate({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading } = trpc.profile.get.useQuery();

  if (isLoading) {
    return <div className="paper-card h-40 animate-pulse bg-cream-deep/50" />;
  }
  /* 无档案或已推送 → 放行；未推送 → 拦截 */
  if (!profile || profile.reportReleased) return <>{children}</>;

  return (
    <div className="mx-auto mt-10 max-w-md">
      <div className="paper-card p-8 text-center">
        <FileLock2 className="mx-auto text-olive-mute" size={36} />
        <h1 className="mt-3 text-[19px] font-bold text-olive">报告正在由伴学师整理</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-olive-mute">
          测评完成后，报告会由伴学师先解读把关，再推送给家长。
          <br />
          如需尽快查看，请联系你的伴学师推送报告。
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 rounded-xl border border-olive px-5 py-2.5 text-[13.5px] font-semibold text-olive hover:bg-lime-pale"
        >
          刷新看看是否已推送
        </button>
      </div>
    </div>
  );
}
