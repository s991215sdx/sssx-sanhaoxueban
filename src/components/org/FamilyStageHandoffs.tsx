import { useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardCheck, Download, FileText, UserCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { saveCoachingFile } from "@/lib/coachingDownload";
import { COACHING_MONTHLY_DIMENSIONS } from "@contracts/orgService";
import { readFamilyStageSnapshot } from "./coachingStageSnapshot";

const input = "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[12px] font-normal text-olive outline-none focus:border-[#0C7064]";

/** 家庭只能确认分配给自己的交接；不代替行动提交或计划会签。 */
export default function FamilyStageHandoffs({ caseId }: { caseId: number }) {
  const utils = trpc.useUtils();
  const handoffs = trpc.coaching.familyStageHandoffs.useQuery({ caseId }, { enabled: caseId > 0, retry: false });
  const [comments, setComments] = useState<Record<number, string>>({});
  const [downloadError, setDownloadError] = useState("");
  const accept = trpc.coaching.acceptFamilyStageHandoff.useMutation({ onSuccess: async () => {
    await utils.coaching.familyStageHandoffs.invalidate({ caseId });
  } });
  const download = async (deliverableId: number) => {
    setDownloadError("");
    try { const file = await utils.coaching.download.fetch({ deliverableId }); await saveCoachingFile(file); }
    catch (reason) { setDownloadError(reason instanceof Error ? reason.message : "交接单下载失败"); }
  };

  return <section className="rounded-2xl border border-[#0C7064]/15 bg-white p-4 shadow-sm">
    <header className="flex flex-wrap items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint-pale text-[#0C7064]"><FileText size={18} /></span><div className="min-w-0 flex-1"><h2 className="text-[16px] font-bold text-olive">阶段交接与本人确认</h2><p className="mt-1 text-[11px] leading-relaxed text-olive-mute">阅读本阶段月报、下阶段计划和家庭配合事，再由当前账号本人确认。</p></div></header>
    <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl bg-mint-pale/25 p-3 text-[10.5px] leading-relaxed text-olive-soft"><span className="font-semibold text-olive">三件独立的事：</span><span>① 确认已收到交接</span><ArrowRight size={12} /><span>② 在“我的家庭行动”提交证据</span><ArrowRight size={12} /><span>③ 伴学师核验；计划会签另行办理</span></div>
    {handoffs.isLoading && <p className="mt-3 text-[12px] text-olive-mute">正在读取阶段交接…</p>}
    {handoffs.error && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-900">暂时无法读取阶段交接：{handoffs.error.message}。其他已推送反馈不受影响。</p>}
    <div className="mt-4 space-y-4">{handoffs.data?.map((handoff, index) => {
      const snapshot = readFamilyStageSnapshot(handoff.familySnapshot);
      const pending = handoff.status === "pending";
      return <details key={handoff.id} open={pending || index === 0} className="rounded-xl border border-border bg-cream/30 p-3">
        <summary className="flex cursor-pointer flex-wrap items-center gap-2"><span className="rounded-lg bg-mint-pale px-2 py-1 text-[10px] font-bold text-[#0C7064]">H5</span><span className="min-w-0 flex-1 break-words text-[13px] font-bold text-olive">{handoff.title}</span><span className={`rounded-full px-2 py-0.5 text-[10px] ${pending ? "bg-amber-50 text-amber-800" : "bg-mint-pale text-[#0C7064]"}`}>{pending ? "待本人确认" : handoff.status === "accepted" ? "本人已确认" : handoff.status}</span></summary>
        {snapshot ? <div className="mt-4 space-y-4">
          <section><h3 className="text-[13px] font-bold text-olive">一、本阶段月报 <span className="font-normal text-olive-mute">{snapshot.monthlyReport.month} · V{snapshot.monthlyReport.version}</span></h3><div className="mt-2 grid gap-2 md:grid-cols-2">{COACHING_MONTHLY_DIMENSIONS.map((dimension) => <article key={dimension.key} className="rounded-lg bg-white p-3"><h4 className="text-[11px] font-bold text-[#0C7064]">{dimension.label}</h4><p className="mt-1 whitespace-pre-wrap break-words text-[11.5px] leading-relaxed text-olive-soft">{snapshot.monthlyReport[dimension.key]}</p></article>)}</div>{snapshot.monthlyReport.meetingNotes && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 text-[11.5px] leading-relaxed text-olive-soft"><b className="text-olive">沟通纪要：</b>{snapshot.monthlyReport.meetingNotes}</p>}<div className="mt-2 rounded-lg bg-white p-3 text-[11.5px] leading-relaxed text-olive-soft"><b className="text-olive">后续行动：</b><ol className="mt-1 list-decimal space-y-1 pl-5">{snapshot.monthlyReport.nextActions.map((action, actionIndex) => <li key={`${actionIndex}-${action}`}>{action}</li>)}</ol></div></section>
          <section className="rounded-xl border border-[#0C7064]/15 bg-mint-pale/20 p-3"><h3 className="text-[13px] font-bold text-olive">二、下阶段正式计划 <span className="font-normal text-olive-mute">{snapshot.nextPlan.title} · V{snapshot.nextPlan.version}</span></h3><p className="mt-1 text-[10.5px] text-olive-mute">执行周期：{snapshot.nextPlan.startDate} 至 {snapshot.nextPlan.endDate} · 已于 {new Date(snapshot.nextPlan.issuedAt).toLocaleString("zh-CN")} 生效</p><p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-white p-3 text-[12px] leading-relaxed text-olive-soft">{snapshot.nextPlan.content}</p></section>
          <section className="rounded-xl bg-[#0C7064] p-3 text-white"><h3 className="flex items-center gap-1.5 text-[13px] font-bold"><ClipboardCheck size={15} />三、家庭配合事</h3><p className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-white/90">{snapshot.familyAction.action}</p><p className="mt-2 text-[10.5px] text-white/70">办理期限：{new Date(snapshot.familyAction.dueAt).toLocaleString("zh-CN")} · 家庭行动 #{snapshot.familyAction.id}</p></section>
        </div> : <div className="mt-3 rounded-lg bg-amber-50 p-3 text-[11.5px] leading-relaxed text-amber-900"><p className="whitespace-pre-wrap">{handoff.content}</p><p className="mt-2 font-semibold">材料快照无法完整读取，请联系伴学师核对后再确认。</p></div>}

        <div className="mt-3 flex flex-wrap items-center gap-2">{handoff.attachmentId && <button type="button" onClick={() => download(handoff.attachmentId!)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-[11.5px] font-semibold text-olive hover:bg-mint-pale/30"><Download size={14} />下载阶段交接单</button>}<span className="text-[10px] text-olive-mute">文字交接单 #{handoff.attachmentId ?? "未关联"}</span></div>
        {pending ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3"><label className="block text-[11.5px] font-semibold text-olive">本人确认意见（可选）<textarea aria-label={`阶段交接 #${handoff.id} 本人确认意见`} value={comments[handoff.id] ?? ""} onChange={(event) => setComments((old) => ({ ...old, [handoff.id]: event.target.value }))} rows={2} maxLength={2000} placeholder="我已阅读月报、下阶段计划和家庭配合事；需要进一步沟通的问题也可写在这里。" className={input} /></label><button type="button" disabled={accept.isPending || !snapshot} onClick={() => accept.mutate({ handoffId: handoff.id, comment: comments[handoff.id]?.trim() || undefined })} className="mt-2 min-h-11 w-full rounded-xl bg-[#0C7064] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#095C53] disabled:opacity-40"><UserCheck size={15} className="mr-1 inline" />{accept.isPending ? "正在确认…" : "本人已阅读并确认收到交接"}</button><p className="mt-2 text-[10px] leading-relaxed text-olive-mute">此处仅记录当前账号的站内确认，不是家庭行动完成凭证，也不代替其他家庭成员或计划会签。</p></div> : handoff.status === "accepted" && <div className="mt-3 rounded-xl bg-mint-pale/35 p-3 text-[11.5px] leading-relaxed text-olive-soft"><p className="flex items-center gap-1.5 font-semibold text-[#0C7064]"><CheckCircle2 size={15} />已由本人账号站内确认{handoff.acceptedAt ? ` · ${new Date(handoff.acceptedAt).toLocaleString("zh-CN")}` : ""}</p>{handoff.acceptedComment && <p className="mt-1 whitespace-pre-wrap">确认意见：{handoff.acceptedComment}</p>}<p className="mt-2">请继续在下方“我的家庭行动”提交实际证据，等待伴学师核验。</p></div>}
        {accept.error && accept.variables?.handoffId === handoff.id && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2.5 text-[11px] text-red-700">{accept.error.message}</p>}
      </details>;
    })}{handoffs.data && !handoffs.data.length && <p className="rounded-xl border border-dashed border-border py-6 text-center text-[12px] text-olive-mute">暂无授权给你的阶段交接。伴学主管发起并逐份授权后，才会在这里显示。</p>}</div>
    {downloadError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-[11px] text-red-700">{downloadError}</p>}
  </section>;
}
