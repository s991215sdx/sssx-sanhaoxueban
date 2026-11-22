import { useState } from "react";
import { CheckCircle2, ClipboardCheck, FileCheck2, PenLine } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";

const input = "mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[12px] font-normal text-olive outline-none focus:border-[#0C7064]";
const LEVEL: Record<string, string> = { term: "学期计划", month: "月计划", week: "周计划", day: "日计划" };

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function payloadOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** 家庭只会签本人账号；学生与监护人确认互不代替。 */
export function FamilyPlanConfirmations({ caseId }: { caseId: number }) {
  const utils = trpc.useUtils();
  const [comments, setComments] = useState<Record<number, string>>({});
  const plans = trpc.coaching.familyPendingPlans.useQuery({ caseId }, { enabled: caseId > 0, retry: false });
  const confirm = trpc.coaching.confirmFamilyPlan.useMutation({ onSuccess: async () => {
    await Promise.all([utils.coaching.familyPendingPlans.invalidate({ caseId }), utils.coaching.familyFeedback.invalidate({ caseId })]);
  } });
  return <section className="rounded-2xl border border-[#0C7064]/15 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center gap-2"><h2 className="flex items-center gap-2 text-[16px] font-bold text-olive"><PenLine size={17} />待本人确认的计划</h2><span className="text-[11px] text-olive-mute">学生、监护人分别确认，不能代签</span></div>
    {plans.isLoading && <p className="mt-3 text-[12px] text-olive-mute">正在读取待确认计划…</p>}
    {plans.error && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-[12px] text-amber-900">{plans.error.message}</p>}
    <div className="mt-3 space-y-3">{plans.data?.map((plan) => <article key={plan.id} className="rounded-xl border border-border bg-cream/35 p-3">
      <div className="flex flex-wrap items-center gap-2"><h3 className="text-[13px] font-bold text-olive">{LEVEL[plan.level] ?? plan.level} · {plan.title}</h3><span className="text-[10.5px] text-olive-mute">V{plan.version} · {plan.startDate}～{plan.endDate}</span></div>
      <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-olive-soft">{plan.content}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]"><span className="rounded-full bg-mint-pale px-2.5 py-1 text-[#0C7064]">伴学师已确认</span><span className={`rounded-full px-2.5 py-1 ${plan.studentConfirmed ? "bg-mint-pale text-[#0C7064]" : "bg-butter-pale text-olive"}`}>学生{plan.studentConfirmed ? "已确认" : "待确认"}</span><span className={`rounded-full px-2.5 py-1 ${plan.guardianConfirmed ? "bg-mint-pale text-[#0C7064]" : "bg-butter-pale text-olive"}`}>监护人{plan.guardianConfirmed ? "至少一位已确认" : "待确认"}</span></div>
      {plan.myConfirmed ? <p className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-[#2F7A41]"><CheckCircle2 size={15} />你已完成本人确认；其余角色须使用自己的账号会签。</p> : <div className="mt-3"><label className="block text-[11.5px] font-semibold text-olive">本人确认意见（可选）<textarea aria-label={`计划 #${plan.id} 本人确认意见`} value={comments[plan.id] ?? ""} onChange={(event) => setComments((old) => ({ ...old, [plan.id]: event.target.value }))} rows={2} maxLength={2000} placeholder="我已阅读目标、行动、责任人与复盘节点；有疑问也可写在这里。" className={input} /></label><button type="button" disabled={confirm.isPending} onClick={() => confirm.mutate({ planId: plan.id, comment: comments[plan.id] || undefined })} className="mt-2 min-h-11 rounded-xl bg-[#0C7064] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#095C53] disabled:opacity-40">{confirm.isPending ? "确认中…" : "本人阅读并确认"}</button></div>}
    </article>)}{plans.data && !plans.data.length && !plans.error && <p className="py-4 text-center text-[12px] text-olive-mute">暂无待你确认的计划。三方会签完成后的正式版本会显示在下方计划中。</p>}</div>
    {confirm.error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-[12px] text-red-700">{confirm.error.message}</p>}
  </section>;
}

export function FamilyActionList({ caseId }: { caseId: number }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [drafts, setDrafts] = useState<Record<number, { evidence: string; result: string }>>({});
  const actions = trpc.coaching.familyActions.useQuery({ caseId }, { enabled: caseId > 0, retry: false });
  const submit = trpc.coaching.submitFamilyAction.useMutation({ onSuccess: async () => {
    await Promise.all([utils.coaching.familyActions.invalidate({ caseId }), utils.coaching.familyFeedback.invalidate({ caseId })]);
  } });
  return <section className="rounded-2xl border border-border bg-white p-4 shadow-sm"><div className="flex flex-wrap items-center gap-2"><h2 className="flex items-center gap-2 text-[16px] font-bold text-olive"><ClipboardCheck size={17} />我的家庭行动</h2><span className="text-[11px] text-olive-mute">已提交不等于伴学师已验收</span></div>
    {actions.isLoading && <p className="mt-3 text-[12px] text-olive-mute">正在读取家庭行动…</p>}
    {actions.error && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-[12px] leading-relaxed text-amber-900">暂时无法读取家庭行动：{actions.error.message}。已推送的课堂反馈仍可正常查看。</p>}
    <div className="mt-3 grid items-start gap-3 md:grid-cols-2">{actions.data?.map((record) => {
      const payload = payloadOf(record.payload);
      const responsibleUserId = typeof payload.responsibleUserId === "number" ? payload.responsibleUserId : 0;
      const responsible = responsibleUserId === user?.id;
      const canSubmit = responsible && ["draft", "pending"].includes(record.status);
      const draft = drafts[record.id] ?? { evidence: text(payload.evidence), result: text(payload.result) };
      return <article key={record.id} className="rounded-xl border border-border bg-cream/35 p-3"><div className="flex flex-wrap items-center gap-2"><h3 className="min-w-0 flex-1 text-[13px] font-bold text-olive">{record.title}</h3><span className={`rounded-full px-2 py-0.5 text-[10.5px] ${record.status === "verified" ? "bg-mint-pale text-[#0C7064]" : "bg-butter-pale text-olive"}`}>{record.status === "verified" ? "伴学师已核验" : record.status === "completed" ? "已提交，待核验" : "待提交"}</span></div>
        {text(payload.action) && <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-olive-soft">{text(payload.action)}</p>}
        {!responsible && <p className="mt-2 text-[11px] text-olive-mute">本行动由指定责任人提交；你可以查看授权内容，但不能代填或代交。</p>}
        {responsible && !responsibleUserId && <p className="mt-2 text-[11px] text-red-700">行动责任人信息不完整，请联系伴学师核对。</p>}
        {canSubmit && <div className="mt-3 space-y-2"><label className="block text-[11.5px] font-semibold text-olive">完成证据<textarea aria-label={`家庭行动 #${record.id} 完成证据`} value={draft.evidence} onChange={(event) => setDrafts((old) => ({ ...old, [record.id]: { ...draft, evidence: event.target.value } }))} rows={2} maxLength={10000} placeholder="实际做了什么，附可核验的时间、数量、作品或行为证据" className={input} /></label><label className="block text-[11.5px] font-semibold text-olive">结果与发现<textarea aria-label={`家庭行动 #${record.id} 结果与发现`} value={draft.result} onChange={(event) => setDrafts((old) => ({ ...old, [record.id]: { ...draft, result: event.target.value } }))} rows={2} maxLength={10000} placeholder="结果怎样，遇到了什么困难，下一步需要什么支持" className={input} /></label><button type="button" disabled={submit.isPending || draft.evidence.trim().length < 2 || draft.result.trim().length < 2} onClick={() => submit.mutate({ recordId: record.id, evidence: draft.evidence, result: draft.result })} className="min-h-11 w-full rounded-xl bg-[#0C7064] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#095C53] disabled:opacity-40">{submit.isPending ? "提交中…" : "提交证据，等待伴学师核验"}</button></div>}
        {responsible && record.status === "completed" && <div className="mt-3 rounded-lg bg-white p-2.5 text-[11.5px] leading-relaxed text-olive-soft"><p><b>提交证据：</b>{text(payload.evidence)}</p><p className="mt-1"><b>提交结果：</b>{text(payload.result)}</p><p className="mt-2 text-amber-800">结果已提交，尚待伴学师核验。</p></div>}
        {record.status === "verified" && <div className="mt-3 rounded-lg bg-mint-pale/35 p-2.5 text-[11.5px] leading-relaxed text-olive-soft"><p className="flex items-center gap-1 font-semibold text-[#0C7064]"><FileCheck2 size={14} />伴学师核验结论</p><p className="mt-1 whitespace-pre-wrap">{text(payload.verificationNote) || "已核验"}</p>{text(payload.result) && <p className="mt-1"><b>家庭提交：</b>{text(payload.result)}</p>}</div>}
      </article>;
    })}{actions.data && !actions.data.length && <p className="col-span-full py-5 text-center text-[12px] text-olive-mute">暂无授权给你的家庭行动。伴学师指定责任人并逐份授权后，才会在这里显示。</p>}</div>
    {submit.error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-[12px] text-red-700">{submit.error.message}</p>}
  </section>;
}
