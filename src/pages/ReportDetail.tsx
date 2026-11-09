import { useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import ReportView from "@/components/reports/ReportView";
import { ReportLockedPanel } from "@/components/ReportLockedPanel";
import type { ReportAssessmentData, ReportProfileInfo } from "@/components/reports/ReportView";
import { campusTabAllowed, campusTabsFor } from "@contracts/campusReports";

/** 测评详细报告页（学生端数据壳）：/report-detail?tab=combined|e3|mbti|disc|...
 *  渲染逻辑全部在 ReportView（与伴学师端共用）；这里只负责取数与加载骨架。
 *  V55：MBTI / DISC（含家长 DISC，位于家长报告页内）家长端直接可看，
 *  其余报告需伴学师推送；未开放时可一键请伴学师推送。
 *  v80：扫码注册学员额外看「发码渠道」勾选的测评报告——
 *  管理员/伴学师发二维码时打开测评报告功能并选择报告种类，注册后即可直接查看。 */
const OPEN_TABS = ["mbti", "disc", "parent", "discparent", "family"];

export default function ReportDetail() {
  const { data, isLoading } = trpc.assessment.latest.useQuery();
  const { data: profile, isLoading: profileLoading } = trpc.profile.get.useQuery();
  const { data: access, isLoading: accessLoading } = trpc.invite.myReportAccess.useQuery();
  const [searchParams] = useSearchParams();
  const campusKinds = data?.campusReportKinds;
  const campus = Array.isArray(campusKinds);
  const requestedTab = searchParams.get("tab");
  const tab = requestedTab ?? (campus ? (campusTabsFor(campusKinds)[0] ?? "academics") : "combined");
  /* 机构版继续原 reportReleased + 渠道 + OPEN_TABS；校园版只认逐报告白名单。
     成绩与基本信息不属于测评结果，校园未授权报告时仍可填写。 */
  const released = !profile || !!profile.reportReleased;
  const channelGranted = !!access?.enabled && (access.kinds.includes("all") || access.kinds.includes(tab));
  const locked = campus ? tab !== "academics" && !campusTabAllowed(tab, campusKinds) : !released && !channelGranted && !OPEN_TABS.includes(tab);

  if (isLoading || profileLoading || accessLoading) {
    return <div className="paper-card h-40 animate-pulse bg-cream-deep/50" />;
  }
  if (locked) {
    return <ReportLockedPanel what={campus && !campusKinds.length ? "测评报告（老师开放后即可在这里查看）" : "这份测评报告"} />;
  }
  return (
    <div>
      {(!campus || campusKinds.includes("career")) && <ZhihuiReportCard />}
      <ReportView
        data={data as unknown as ReportAssessmentData | undefined}
        profile={profile as unknown as ReportProfileInfo | undefined}
        viewer="student"
        allowedKinds={campusKinds}
      />
    </div>
  );
}

/** 测评报告区入口：选科及升学规划报告（v175）。完成学科四维测评后可查看完整规划报告。 */
function ZhihuiReportCard() {
  return (
    <a
      href="/zhihui-report"
      className="paper-card mb-4 flex items-center gap-4 px-5 py-4 no-underline"
      style={{ borderLeft: "4px solid #6b7d3a" }}
    >
      <span className="text-3xl">🧭</span>
      <span className="flex-1">
        <span className="block text-base font-bold" style={{ color: "#4c5a28" }}>
          选科及升学规划报告
        </span>
        <span className="block text-sm" style={{ color: "#8a8f78" }}>
          选科 · 专业 · 职业 · 升学路径一站式规划，基于学科四维测评与霍兰德测评
        </span>
      </span>
      <span style={{ color: "#6b7d3a" }}>查看 ›</span>
    </a>
  );
}
