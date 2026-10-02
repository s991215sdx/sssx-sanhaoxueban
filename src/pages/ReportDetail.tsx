import { useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import ReportView from "@/components/reports/ReportView";
import { ReportLockedPanel } from "@/components/ReportLockedPanel";
import type { ReportAssessmentData, ReportProfileInfo } from "@/components/reports/ReportView";

/** 测评详细报告页（学生端数据壳）：/report-detail?tab=combined|e3|mbti|disc|...
 *  渲染逻辑全部在 ReportView（与伴学师端共用）；这里只负责取数与加载骨架。
 *  V55：MBTI / DISC（含家长 DISC，位于家长报告页内）家长端直接可看，
 *  其余报告需伴学师推送；未开放时可一键请伴学师推送。
 *  v80：扫码注册学员额外看「发码渠道」勾选的测评报告——
 *  管理员/伴学师发二维码时打开测评报告功能并选择报告种类，注册后即可直接查看。 */
const OPEN_TABS = ["mbti", "disc", "parent", "discparent"];

export default function ReportDetail() {
  const { data, isLoading } = trpc.assessment.latest.useQuery();
  const { data: profile, isLoading: profileLoading } = trpc.profile.get.useQuery();
  const { data: access, isLoading: accessLoading } = trpc.invite.myReportAccess.useQuery();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "combined";
  /* 与 ReportLockedGate 同口径：无档案行视为未推送限制不生效（fail-open），
     避免老学员缺档案行时被永久锁死、推送也无法解除。 */
  const released = !profile || !!profile.reportReleased;
  /* v80 渠道放行：扫码注册 + 渠道开了测评报告 + 勾选了本栏目（"all"=全部） */
  const channelGranted =
    !!access?.enabled && (access.kinds.includes("all") || access.kinds.includes(tab));
  const locked = !released && !channelGranted && !OPEN_TABS.includes(tab);

  if (isLoading || profileLoading || accessLoading) {
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
