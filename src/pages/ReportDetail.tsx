import { trpc } from "@/providers/trpc";
import ReportView from "@/components/reports/ReportView";
import ReportLockedGate from "@/components/ReportLockedGate";
import type { ReportAssessmentData, ReportProfileInfo } from "@/components/reports/ReportView";

/** 测评详细报告页（学生端数据壳）：/report-detail?tab=combined|e3|mbti|disc|...
 *  渲染逻辑全部在 ReportView（与伴学师端共用）；这里只负责取数与加载骨架。
 *  V54：报告由伴学师把关，未推送时家长端不可见。 */
export default function ReportDetail() {
  const { data, isLoading } = trpc.assessment.latest.useQuery();
  const { data: profile } = trpc.profile.get.useQuery();

  if (isLoading) {
    return <div className="paper-card h-40 animate-pulse bg-cream-deep/50" />;
  }
  return (
    <ReportLockedGate>
      <ReportView
        data={data as unknown as ReportAssessmentData | undefined}
        profile={profile as unknown as ReportProfileInfo | undefined}
        viewer="student"
      />
    </ReportLockedGate>
  );
}
