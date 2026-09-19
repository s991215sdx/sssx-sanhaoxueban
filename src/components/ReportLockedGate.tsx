import type { ReactNode } from "react";
import { trpc } from "@/providers/trpc";
import { ReportLockedPanel } from "@/components/ReportLockedPanel";

/**
 * 报告发布门禁：伴学师未推送前，家长/学员端看不到报告（MBTI/DISC 等单独放行的页面除外）。
 * 未开放时展示「请伴学师推送报告」面板。
 */
export function ReportLockedGate({ children }: { children: ReactNode }) {
  const { data: profile, isLoading } = trpc.profile.get.useQuery();
  if (isLoading) return <div className="paper-card h-40 animate-pulse bg-cream-deep/50" />;
  if (!profile || profile.reportReleased) return <>{children}</>;
  return <ReportLockedPanel />;
}

export default ReportLockedGate;
