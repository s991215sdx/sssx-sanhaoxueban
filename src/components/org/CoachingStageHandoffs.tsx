import { useState } from "react";
import { ArrowRight, CheckCircle2, Download, FileText, Send, Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { saveCoachingFile } from "@/lib/coachingDownload";
import type { CoachingDetail } from "./coachingTypes";
import { readFamilyStageSnapshot } from "./coachingStageSnapshot";

const input = "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[12px] font-normal text-olive outline-none focus:border-[#0C7064]";
const label = "block text-[11.5px] font-semibold text-olive";
const primary = "min-h-10 rounded-xl bg-[#0C7064] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#095C53] disabled:opacity-40";

function localDateInput(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function defaultDueAt() {
  const date = new Date(); date.setDate(date.getDate() + 7); return localDateInput(date);
}

/** H5 主管→家庭阶段交接；与员工 H1—H4、REASSIGN 完全分开办理。 */
export default function CoachingStageHandoffs({ data }: { data: CoachingDetail }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const caseId = data.coachingCase.id;
  const { data: reports = [], isLoading: reportsLoading, error: reportsError } = trpc.coaching.monthlyReports.useQuery({ caseId });
  const [monthlyReportId, setMonthlyReportId] = useState(0);
  const [nextPlanId, setNextPlanId] = useState(0);
  const [recipientUserId, setRecipientUserId] = useState(0);
  const [title, setTitle] = useState("阶段总结与下阶段交接");
  const [familyAction, setFamilyAction] = useState("");
  const [dueAt, setDueAt] = useState(defaultDueAt);
  const [downloadError, setDownloadError] = useState("");
  const handoffs = data.handoffs.filter((row) => row.type === "H5" && row.nextSupervisorId == null);
  const plans = data.plans.filter((row) => row.status === "confirmed" && row.issuedAt && !row.cancelledAt);
  const selectedReport = reports.find((row) => row.id === monthlyReportId);
  const create = trpc.coaching.createStageHandoff.useMutation({ onSuccess: async () => {
    setFamilyAction(""); setMonthlyReportId(0); setNextPlanId(0); setRecipientUserId(0);
    await Promise.all([
      utils.coaching.detail.invalidate({ caseId }), utils.coaching.monthlyReports.invalidate({ caseId }),
      utils.coaching.operations.invalidate(), utils.coaching.staffWorkloads.invalidate(),
    ]);
  } });
  const download = async (deliverableId: number) => {
    setDownloadError("");
    try { const file = await utils.coaching.download.fetch({ deliverableId }); await saveCoachingFile(file); }
    catch (reason) { setDownloadError(reason instanceof Error ? reason.message : "交接单下载失败"); }
  };
  const canSubmit = monthlyReportId > 0 && nextPlanId > 0 && recipientUserId > 0 && title.trim().length >= 2
    && familyAction.trim().length >= 2 && Boolean(dueAt) && !Number.isNaN(new Date(dueAt).getTime());

  return <section className="rounded-2xl border border-[#0C7064]/15 bg-white p-4 shadow-sm">
    <header className="flex flex-wrap items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-pale text-[#0C7064]"><Users size={18} /></span><div className="min-w-0 flex-1"><h2 className="text-[16px] font-bold text-olive">H5 主管→家庭阶段交接</h2><p className="mt-1 text-[11px] leading-relaxed text-olive-mute">把本阶段月报、下阶段正式计划和家庭配合事交给指定学生或监护人。这里不改变伴学师负责人，也不进入员工改派待办。</p></div></header>

    {user?.role === "admin" && <div className="mt-4 rounded-xl border border-[#0C7064]/15 bg-mint-pale/20 p-3">
      <h3 className="text-[12.5px] font-bold text-olive">发起新的家庭阶段交接</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className={label}>本阶段月报<select aria-label="阶段交接月报" value={monthlyReportId} onChange={(event) => { const id = Number(event.target.value); setMonthlyReportId(id); const report = reports.find((row) => row.id === id); if (report && !familyAction.trim()) setFamilyAction(report.familyAction); }} className={input}><option value={0}>{reportsLoading ? "正在读取月报…" : "请选择月报版本"}</option>{reports.map((report) => <option key={report.id} value={report.id}>{report.month} · V{report.version} · {report.pushedAt ? "已推送" : "随交接正式推送"}</option>)}</select></label>
        <label className={label}>下阶段正式计划<select aria-label="阶段交接下阶段计划" value={nextPlanId} onChange={(event) => setNextPlanId(Number(event.target.value))} className={input}><option value={0}>请选择已三方会签并生效的计划</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.title} · V{plan.version} · {plan.startDate}～{plan.endDate}</option>)}</select></label>
        <label className={label}>指定接收人<select aria-label="阶段交接接收人" value={recipientUserId} onChange={(event) => setRecipientUserId(Number(event.target.value))} className={input}><option value={0}>请选择本主档学生或有效监护人</option>{data.recipients.map((person) => <option key={person.id} value={person.id}>{person.name ?? `账号 #${person.id}`} · {person.label}</option>)}</select></label>
        <label className={label}>家庭行动办理期限<input aria-label="阶段交接办理期限" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className={input} /></label>
      </div>
      <label className={`${label} mt-3`}>交接标题<input aria-label="阶段交接标题" value={title} maxLength={180} onChange={(event) => setTitle(event.target.value)} className={input} /></label>
      <label className={`${label} mt-3`}>下一阶段家庭配合事<textarea aria-label="阶段交接家庭配合事" value={familyAction} onChange={(event) => setFamilyAction(event.target.value)} rows={3} maxLength={4000} placeholder="写清责任人、具体动作、完成证据和复盘节点；确认交接后仍需单独提交完成证据。" className={input} /></label>
      {selectedReport && <p className="mt-2 rounded-lg bg-white px-3 py-2 text-[10.5px] leading-relaxed text-olive-soft">将关联 {selectedReport.month} 月报 V{selectedReport.version}{selectedReport.pushedAt ? "（已推送）" : "（目前未推送，将在本次事务中正式推送给指定接收人）"}；同时逐份授权计划、家庭行动和文字交接单。</p>}
      <button type="button" disabled={create.isPending || !canSubmit} onClick={() => create.mutate({ caseId, monthlyReportId, nextPlanId, recipientUserId, title, familyAction, dueAt: new Date(dueAt) })} className={`${primary} mt-3 w-full`}><Send size={14} className="mr-1 inline" />{create.isPending ? "正在生成并授权…" : "生成 H5 交接，等待本人确认"}</button>
      {create.error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2.5 text-[11px] text-red-700">{create.error.message}</p>}
      {create.isSuccess && <p className="mt-2 text-[11px] text-[#2F7A41]">交接 #{create.data.id}、家庭行动 #{create.data.familyActionId} 和交接单 #{create.data.attachmentId} 已生成；等待指定接收人本人确认。</p>}
    </div>}
    {reportsError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-[11px] text-red-700">{reportsError.message}</p>}
    {user?.role === "admin" && (!reports.length || !plans.length) && !reportsLoading && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">{!reports.length ? "请先在“月报与质量”保存至少一份月报。" : ""}{!plans.length ? " 下阶段计划须先完成学生、监护人和伴学师三方会签并正式生效。" : ""}</p>}

    <div className="mt-4 space-y-3">{handoffs.map((handoff) => {
      const snapshot = readFamilyStageSnapshot(handoff.familySnapshot);
      return <article key={handoff.id} className="rounded-xl border border-border bg-cream/35 p-3">
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-mint-pale px-2 py-1 text-[10px] font-bold text-[#0C7064]">H5</span><h3 className="min-w-0 flex-1 break-words text-[13px] font-bold text-olive">{handoff.title}</h3><span className={`rounded-full px-2 py-0.5 text-[10px] ${handoff.status === "accepted" ? "bg-mint-pale text-[#0C7064]" : handoff.status === "pending" ? "bg-amber-50 text-amber-800" : "bg-gray-100 text-gray-600"}`}>{handoff.status === "accepted" ? "本人已确认" : handoff.status === "pending" ? "待本人确认" : handoff.status}</span></div>
        <div className="mt-2 grid gap-2 text-[11px] sm:grid-cols-2"><div className="rounded-lg bg-white p-2.5 text-olive-soft"><b className="text-olive">阶段月报</b><p className="mt-1">{snapshot ? `${snapshot.monthlyReport.month} · V${snapshot.monthlyReport.version}` : `月报 #${handoff.monthlyReportId ?? "未关联"}`}</p></div><div className="rounded-lg bg-white p-2.5 text-olive-soft"><b className="text-olive">下阶段计划</b><p className="mt-1">{snapshot ? `${snapshot.nextPlan.title} · V${snapshot.nextPlan.version}` : `计划 #${handoff.nextPlanId ?? "未关联"}`}</p></div></div>
        <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-white p-2.5 text-[11.5px] leading-relaxed text-olive-soft"><b className="text-olive">家庭配合事：</b>{handoff.content}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-olive-mute"><span>接收人：{data.recipients.find((person) => person.id === handoff.toUserId)?.name ?? `账号 #${handoff.toUserId}`}</span><span>家庭行动 #{handoff.familyActionId ?? "未关联"}</span>{handoff.dueAt && <span>期限 {new Date(handoff.dueAt).toLocaleString("zh-CN")}</span>}</div>
        {handoff.status === "accepted" ? <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-mint-pale/35 p-2.5 text-[11px] leading-relaxed text-[#0C7064]"><CheckCircle2 size={14} className="mt-0.5 shrink-0" />{handoff.acceptedAt ? new Date(handoff.acceptedAt).toLocaleString("zh-CN") : "已"}由指定接收人本人账号站内确认{handoff.acceptedComment ? `；意见：${handoff.acceptedComment}` : "。"}</p> : <p className="mt-2 text-[10.5px] text-amber-800">等待指定学生或监护人在家庭端阅读并确认，伴学师不能代办。</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">{handoff.attachmentId && <button type="button" onClick={() => download(handoff.attachmentId!)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-[11px] font-semibold text-olive hover:bg-mint-pale/30"><Download size={13} />下载文字交接单 #{handoff.attachmentId}</button>}<span className="text-[10px] text-olive-mute">确认交接 <ArrowRight size={11} className="inline" /> 提交家庭行动 <ArrowRight size={11} className="inline" /> 伴学师核验</span></div>
      </article>;
    })}{!handoffs.length && <div className="rounded-xl border border-dashed border-border py-6 text-center"><FileText size={22} className="mx-auto text-olive-mute" /><p className="mt-2 text-[11.5px] text-olive-mute">暂无家庭阶段交接。发起后，材料版本与本人确认状态会在这里留痕。</p></div>}</div>
    {downloadError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2.5 text-[11px] text-red-700">{downloadError}</p>}
  </section>;
}
