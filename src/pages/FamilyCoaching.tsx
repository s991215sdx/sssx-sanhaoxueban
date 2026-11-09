import { useState } from "react";
import { BookOpenCheck, CalendarCheck, CheckCircle2, ClipboardCheck, Download, FileAudio, FileImage, FileText, MessageSquareText, Target, Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { saveCoachingFile } from "@/lib/coachingDownload";
import { COACHING_MONTHLY_DIMENSIONS } from "@contracts/orgService";
import type { FamilyFeedback } from "@/components/org/coachingTypes";
import { CoachingNotificationCenter } from "@/components/org/CoachingOperations";
import { FamilyActionList, FamilyPlanConfirmations } from "@/components/org/FamilyCoachingActions";

const LEVEL: Record<string, string> = { term: "学期计划", month: "月计划", week: "周计划", day: "日计划" };
const FORMAT: Record<string, string> = { one_to_one: "一对一教练课＋督学", salon: "小组沙龙＋督学", workshop: "学习坊＋督学", mixed: "混合课堂＋督学" };

/** 学员及获授权监护人的公开陪跑视图；心理原始答案与伴学师内部备注不进入该接口。 */
export default function FamilyCoaching() {
  const utils = trpc.useUtils();
  const { data: cases = [], isLoading: casesLoading } = trpc.coaching.familyCases.useQuery();
  const [selectedCaseId, setCaseId] = useState(0);
  const caseId = cases.some((item) => item.caseId === selectedCaseId) ? selectedCaseId : cases[0]?.caseId ?? 0;
  const [downloadError, setDownloadError] = useState("");
  const { data, isLoading, error } = trpc.coaching.familyFeedback.useQuery({ caseId }, { enabled: caseId > 0 });
  const studentName = cases.find((item) => item.caseId === caseId)?.studentName;
  const download = async (deliverableId: number) => {
    setDownloadError("");
    try { const file = await utils.coaching.download.fetch({ deliverableId }); await saveCoachingFile(file); }
    catch (reason) { setDownloadError(reason instanceof Error ? reason.message : "附件下载失败"); }
  };

  if (!casesLoading && !cases.length) return <div className="mx-auto max-w-xl space-y-4 py-10"><CoachingNotificationCenter family /><div className="paper-card p-8 text-center"><Users className="mx-auto text-olive-mute" size={32} /><h1 className="mt-3 text-[19px] font-bold text-olive">陪跑反馈</h1><p className="mt-2 text-[13px] leading-relaxed text-olive-mute">当前账号还没有可查看的陪跑主档。学员建立主档后会自动可见；监护人需由伴学师逐位授权。</p></div></div>;
  return <div className="space-y-5">
    <header className="rounded-2xl bg-[#0C7064] p-5 text-white shadow-sm">
      <div className="text-[10px] font-semibold tracking-[.18em] text-white/60">GROW · 家校同频</div>
      <div className="mt-1 flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><h1 className="text-[22px] font-bold">{studentName ? `${studentName}的陪跑反馈` : "我的陪跑反馈"}</h1><p className="mt-1 text-[12px] text-white/75">看见目标与计划，了解每次课堂的真实表现，一起落实下一步行动。</p></div>{cases.length > 1 && <label className="text-[11px] font-semibold">选择学员<select value={caseId} onChange={(e) => setCaseId(Number(e.target.value))} className="mt-1 block rounded-lg border border-white/20 bg-white px-3 py-2 text-[12px] font-normal text-olive">{cases.map((item) => <option key={item.caseId} value={item.caseId}>{item.studentName}</option>)}</select></label>}</div>
    </header>
    <CoachingNotificationCenter family />
    {isLoading && <div className="paper-card h-36 animate-pulse bg-cream-deep/40" />}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-[12px] text-red-700">{error.message}</p>}
    {data && <>
      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#0C7064]/15 bg-white p-5 shadow-sm"><h2 className="flex items-center gap-2 text-[16px] font-bold text-olive"><Target size={18} className="text-[#0C7064]" />明确目标</h2><p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-olive-soft">{data.coachingCase.goal}</p><p className="mt-3 text-[11px] text-olive-mute">服务周期：{data.coachingCase.serviceStart} 至 {data.coachingCase.serviceEnd}</p></div>
        <div className="rounded-2xl border border-[#0C7064]/15 bg-mint-pale/30 p-5 shadow-sm"><h2 className="flex items-center gap-2 text-[16px] font-bold text-olive"><ClipboardCheck size={18} className="text-[#0C7064]" />定制计划</h2><p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-olive-soft">{data.coachingCase.planSummary}</p></div>
      </section>

      <FamilyPlanConfirmations caseId={caseId} />

      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm"><h2 className="flex items-center gap-2 text-[16px] font-bold text-olive"><CalendarCheck size={17} />当前计划与历史版本</h2><div className="mt-3 space-y-2">{data.plans.map((plan, index) => <details key={`${plan.title}-${plan.version}-${index}`} open={index === 0} className="rounded-xl border border-border bg-cream/40 p-3"><summary className="cursor-pointer text-[12.5px] font-semibold text-olive">{LEVEL[plan.level] ?? plan.level} · {plan.title} <span className="font-normal text-olive-mute">V{plan.version} · {plan.startDate}～{plan.endDate}</span></summary><p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-olive-soft">{plan.content}</p></details>)}{!data.plans.length && <p className="py-5 text-center text-[12px] text-olive-mute">确认后的计划会显示在这里。</p>}</div></section>

      <MonthlyReports reports={data.monthlyReports} />
      <FamilyActionList caseId={caseId} />

      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-[16px] font-bold text-olive"><CheckCircle2 size={17} />下一步行动</h2><span className="text-[11px] text-olive-mute">完成不只看签到，要有实际证据</span></div><div className="mt-3 grid gap-2 md:grid-cols-2">{data.tasks.map((task) => <article key={task.id} className="rounded-xl border border-border bg-cream/40 p-3"><div className="flex items-center gap-2"><h3 className="min-w-0 flex-1 text-[13px] font-semibold text-olive">{task.title}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] ${task.status === "verified" ? "bg-mint-pale text-[#0C7064]" : "bg-butter-pale text-olive"}`}>{task.status === "verified" ? "已验收" : `截止 ${task.dueDate}`}</span></div>{task.detail && <p className="mt-2 whitespace-pre-wrap text-[11.5px] leading-relaxed text-olive-mute">{task.detail}</p>}{task.result && <p className="mt-2 rounded-lg bg-white p-2 text-[11.5px] text-[#0C7064]">验收结果：{task.result}</p>}</article>)}{!data.tasks.length && <p className="col-span-full py-5 text-center text-[12px] text-olive-mute">伴学师布置行动后会显示在这里。</p>}</div></section>

      <section className="space-y-3"><h2 className="flex items-center gap-2 text-[17px] font-bold text-olive"><BookOpenCheck size={18} />每次课堂反馈</h2>{data.sessions.map((session) => { const feedback = session.feedback[0]; const files = data.attachments.filter((file) => file.sessionId === session.id); return <article key={session.id} className="rounded-2xl border border-border bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center gap-2"><time className="text-[13px] font-bold text-olive">{new Date(session.startAt).toLocaleString("zh-CN")}</time><span className="rounded-full bg-mint-pale px-2 py-0.5 text-[10.5px] text-[#0C7064]">{FORMAT[session.format] ?? "到店课堂＋督学"}</span>{feedback && <span className="ml-auto text-[10.5px] text-[#2F7A41]">反馈 V{feedback.feedbackVersion}</span>}</div>{session.sharedSummary && <p className="mt-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-olive-soft"><b className="text-olive">课堂总结：</b>{session.sharedSummary}</p>}{feedback ? <div className="mt-3 rounded-xl bg-mint-pale/25 p-3"><h3 className="flex items-center gap-1.5 text-[12.5px] font-bold text-olive"><MessageSquareText size={14} />伴学师给家庭的反馈</h3><p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-olive-soft">{feedback.feedbackText || "本次反馈以录音或图片形式推送，请下载查看。"}</p></div> : <p className="mt-3 text-[11.5px] text-olive-mute">本次个人反馈尚未正式推送。</p>}{files.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{files.map((file) => <button type="button" key={file.id} onClick={() => download(file.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-cream px-3 py-2 text-[11px] text-olive hover:bg-mint-pale/40">{file.kind === "audio" ? <FileAudio size={14} /> : file.kind === "image" ? <FileImage size={14} /> : <Download size={14} />}{file.kind === "audio" ? "课堂录音" : file.kind === "image" ? "课堂图片" : `文字反馈 V${file.version}`}<Download size={12} /></button>)}</div>}</article>; })}{!data.sessions.length && <p className="rounded-xl border border-dashed border-border py-8 text-center text-[12px] text-olive-mute">完成课堂并推送反馈后，会在这里形成连续记录。</p>}</section>
      {downloadError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-[12px] text-red-700">{downloadError}</p>}
      <p className="text-center text-[11px] leading-relaxed text-olive-mute">这里仅展示伴学师正式推送的家庭内容；内部备注、其他学员信息与心理测评原始答案不会显示。</p>
    </>}
  </div>;
}

type MonthlyReport = FamilyFeedback["monthlyReports"][number];
type SnapshotMetrics = {
  checkinDays: number;
  averageCompletion: number | null;
  averageAccuracy: number | null;
  tasksDue: number;
  tasksVerified: number;
  taskVerificationRate: number | null;
  completedSessions: number;
  feedbackSessions: number;
  feedbackRate: number | null;
};
type MetricSnapshot = { baselineMonth?: string; current?: SnapshotMetrics; previous?: SnapshotMetrics; baseline?: SnapshotMetrics };

function percent(value: number | null | undefined) {
  return value == null ? "暂无数据" : `${value}%`;
}
function SnapshotCard({ title, metrics }: { title: string; metrics?: SnapshotMetrics }) {
  return <div className="rounded-xl bg-cream/55 p-3"><h4 className="text-[11.5px] font-bold text-olive">{title}</h4>{metrics ? <dl className="mt-2 space-y-1.5 text-[10.5px] text-olive-soft">
    <div className="flex justify-between gap-2"><dt>日检验／平均完成率</dt><dd className="text-right font-semibold">{metrics.checkinDays} 天／{percent(metrics.averageCompletion)}</dd></div>
    <div className="flex justify-between gap-2"><dt>平均准确率</dt><dd className="font-semibold">{percent(metrics.averageAccuracy)}</dd></div>
    <div className="flex justify-between gap-2"><dt>任务验收</dt><dd className="text-right font-semibold">{metrics.tasksVerified}/{metrics.tasksDue}／{percent(metrics.taskVerificationRate)}</dd></div>
    <div className="flex justify-between gap-2"><dt>完成课堂／反馈率</dt><dd className="text-right font-semibold">{metrics.completedSessions} 场／{percent(metrics.feedbackRate)}</dd></div>
  </dl> : <p className="mt-2 text-[10.5px] text-olive-mute">暂无数据</p>}</div>;
}

/** 家庭只见正式推送版本；质量红黄绿、内部评分与整改正文不会进入这里。 */
function MonthlyReports({ reports }: { reports: MonthlyReport[] }) {
  if (!reports.length) return null;
  return <section className="space-y-3"><h2 className="flex items-center gap-2 text-[17px] font-bold text-olive"><FileText size={18} />月度学习报告</h2>
    {reports.map((report, index) => {
      const snapshot = report.metricSnapshot as MetricSnapshot;
      return <details key={report.id} open={index === 0} className="rounded-2xl border border-[#0C7064]/15 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-[14px] font-bold text-olive">{report.month} 月度学习报告 <span className="font-normal text-olive-mute">V{report.version} · 已正式推送</span></summary>
        <div className="mt-4 grid gap-2 lg:grid-cols-3"><SnapshotCard title="本月" metrics={snapshot.current} /><SnapshotCard title="上月" metrics={snapshot.previous} /><SnapshotCard title={`起点月 ${snapshot.baselineMonth ?? ""}`} metrics={snapshot.baseline} /></div>
        <p className="mt-2 text-[10px] leading-relaxed text-olive-mute">以上是本版本保存时的数据快照；没有同口径数据时显示“暂无数据”，不代表 0%。课程、出勤与积分不用于推断提分或录取结果。</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">{COACHING_MONTHLY_DIMENSIONS.map((dimension) => <article key={dimension.key} className="rounded-xl border border-border bg-mint-pale/15 p-3"><h3 className="text-[12px] font-bold text-[#0C7064]">{dimension.label}</h3><p className="mt-1.5 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-olive-soft">{report[dimension.key]}</p></article>)}</div>
        {report.meetingNotes && <div className="mt-3 rounded-xl bg-cream/50 p-3 text-[12px] leading-relaxed text-olive-soft"><b className="text-olive">月度沟通纪要：</b><p className="mt-1 whitespace-pre-wrap">{report.meetingNotes}</p></div>}
        <div className="mt-3 grid gap-2 md:grid-cols-2"><div className="rounded-xl bg-cream/50 p-3"><h3 className="text-[12px] font-bold text-olive">下月最多 3 条行动</h3><ol className="mt-2 list-decimal space-y-1 pl-5 text-[12px] leading-relaxed text-olive-soft">{report.nextActions.map((action, actionIndex) => <li key={`${actionIndex}-${action}`}>{action}</li>)}</ol></div><div className="rounded-xl bg-[#0C7064] p-3 text-white"><h3 className="text-[12px] font-bold">家长本月 1 件配合事</h3><p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-white/90">{report.familyAction}</p></div></div>
      </details>;
    })}
  </section>;
}
