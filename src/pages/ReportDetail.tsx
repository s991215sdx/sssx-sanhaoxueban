import { useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import ReportView from "@/components/reports/ReportView";
import { ReportLockedPanel } from "@/components/ReportLockedPanel";
import type { ReportAssessmentData, ReportProfileInfo } from "@/components/reports/ReportView";

/** 测评详细报告页（学生端数据壳）：/report-detail?tab=combined|e3|mbti|disc|...
 *  渲染逻辑全部在 ReportView（与伴学师端共用）；这里只负责取数与加载骨架。
 *  V55：MBTI / DISC（含家长 DISC，位于家长报告页内）家长端直接可看，
 *  其余报告需伴学师推送；未开放时可一键请伴学师推送。 */
const OPEN_TABS = ["mbti", "disc", "parent", "discparent"];

export default function ReportDetail() {
  const { data, isLoading } = trpc.assessment.latest.useQuery();
  const { data: profile } = trpc.profile.get.useQuery();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "combined";
  const released = !!profile && !!profile.reportReleased;
  const locked = !released && !OPEN_TABS.includes(tab);

  if (isLoading) {
    return <div className="paper-card h-40 animate-pulse bg-cream-deep/50" />;
  }
  if (locked) {
    return <ReportLockedPanel what="这份测评报告" />;
  }
  return (
    <ReportView
      data={data as unknown as ReportAssessmentData | undefined}
      profile={profile as unknown as ReportProfileInfo | undefined}
      viewer="student"
    />
  );
}
