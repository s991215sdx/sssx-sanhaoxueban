import { useMemo, useState } from "react";
import { BookOpenCheck, CalendarClock, Check, FileSearch, Plus, Target, Trash2, UserRoundCheck, Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { CoachingDetail } from "./coachingTypes";
import { invalidateCoachingOperations } from "./coachingRefresh";

const input = "mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] font-normal text-olive outline-none focus:border-[#0C7064]";
const label = "block text-[11.5px] font-semibold text-olive";
const button = "min-h-10 rounded-xl bg-[#0C7064] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#095C53] disabled:opacity-40";
const KIND: Record<string, string> = { mbti: "MBTI", disc: "DISC", e3: "E3 学习力", multi5: "多元智能", mentalsdq: "心理健康 A 版", mentalpa: "心理健康 B 版", scl90: "SCL-90", mental: "心理健康通用版", subject4d: "学科四维", holland: "霍兰德", anchor: "职业锚", subject: "学科能力", e3parent: "家长认知", discparent: "家长 DISC", familystudent: "家庭关系·学生", familyparent: "家庭关系·家长" };
const PLAN_STATUS: Record<string, string> = { draft: "内部草稿", awaiting_family: "待家庭会签", confirmed: "三方已生效", cancelled: "已停用" };
type Subject = { subject: string; baseline: string; target: string };
type ReportLink = { resultId: number; conclusion: string; evidence: string; trainingSuggestion: string; cycle: string; ownerId: number; reviewAt: string };
type GrowProfile = CoachingDetail["planning"]["growProfiles"][number];

function localDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
function localDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function defaultReviewAt(): string {
  const date = new Date(); date.setDate(date.getDate() + 30);
  return localDateTime(date);
}
function asSubjects(value: unknown): Subject[] {
  return Array.isArray(value) ? value.filter((row): row is Subject => typeof row === "object" && row !== null)
    .map((row) => ({ subject: String(row.subject ?? ""), baseline: String(row.baseline ?? ""), target: String(row.target ?? "") })) : [];
}
function asReportLinks(profile: GrowProfile | undefined, data: CoachingDetail): ReportLink[] {
  if (!profile) return [];
  return data.planning.growReportLinks.filter((row) => row.profileId === profile.id)
    .map((row) => ({ resultId: row.resultId, conclusion: row.conclusion, evidence: row.evidence,
      trainingSuggestion: row.trainingSuggestion, cycle: row.cycle, ownerId: row.ownerId, reviewAt: localDateTime(row.reviewAt) }));
}

/** 结构化目标、测评证据和三方确认状态；计划生效仍以服务端会签结果为准。 */
export default function CoachingPlanning({ data, view = "full" }: { data: CoachingDetail; view?: "full" | "details" | "signatures" }) {
  const utils = trpc.useUtils();
  const caseId = data.coachingCase.id;
  const { data: staff = [] } = trpc.coaching.staff.useQuery();
  const latest = data.planning.growProfiles[0];
  const [studentGoal, setStudentGoal] = useState(latest?.studentGoal ?? data.coachingCase.goal);
  const [parentExpectation, setParentExpectation] = useState(latest?.parentExpectation ?? "");
  const [targetSchool, setTargetSchool] = useState(latest?.targetSchool ?? "");
  const [targetDate, setTargetDate] = useState(latest?.targetDate ?? "");
  const [subjects, setSubjects] = useState<Subject[]>(() => asSubjects(latest?.targetSubjects));
  const [currentSituation, setCurrentSituation] = useState(latest?.currentSituation ?? data.coachingCase.currentSituation);
  const [evidence, setEvidence] = useState(latest?.evidence ?? "");
  const [followUpActions, setFollowUpActions] = useState(latest?.followUpActions ?? "");
  const [nextContactAt, setNextContactAt] = useState(localDateTime(latest?.nextContactAt));
  const [retestDueAt, setRetestDueAt] = useState(localDate(latest?.retestDueAt));
  const [changeReason, setChangeReason] = useState("");
  const [links, setLinks] = useState<ReportLink[]>(() => asReportLinks(latest, data));
  const [resultId, setResultId] = useState(0);
  const owners = useMemo(() => [...new Set([data.coachingCase.coachId, data.coachingCase.supervisorId])], [data.coachingCase.coachId, data.coachingCase.supervisorId]);

  const refresh = async () => { await Promise.all([utils.coaching.detail.invalidate({ caseId }), invalidateCoachingOperations(utils)]); };
  const save = trpc.coaching.saveGrowProfile.useMutation({ onSuccess: async () => { setChangeReason(""); await refresh(); } });
  const confirm = trpc.coaching.confirmPlan.useMutation({ onSuccess: refresh });
  const nameOf = (id: number) => staff.find((person) => person.id === id)?.name ?? data.recipients.find((person) => person.id === id)?.name ?? `账号 #${id}`;
  const updateSubject = (index: number, patch: Partial<Subject>) => setSubjects((old) => old.map((row, i) => i === index ? { ...row, ...patch } : row));
  const updateLink = (index: number, patch: Partial<ReportLink>) => setLinks((old) => old.map((row, i) => i === index ? { ...row, ...patch } : row));
  const addLink = () => {
    const result = data.results.find((row) => row.id === resultId);
    if (!result || links.some((row) => row.resultId === resultId)) return;
    setLinks((old) => [...old, { resultId, conclusion: "", evidence: "", trainingSuggestion: "", cycle: "4 周", ownerId: owners[0], reviewAt: defaultReviewAt() }]);
    setResultId(0);
  };
  const linksValid = links.every((row) => [row.conclusion, row.evidence, row.trainingSuggestion, row.cycle].every((value) => value.trim().length >= 2) && owners.includes(row.ownerId) && Boolean(row.reviewAt));
  const valid = [studentGoal, parentExpectation, currentSituation, evidence, followUpActions].every((value) => value.trim().length >= 2)
    && subjects.every((row) => [row.subject, row.baseline, row.target].every((value) => value.trim().length > 0)) && linksValid && (!latest || changeReason.trim().length >= 2);

  return <div className="space-y-4">
    {view !== "signatures" && <section className="rounded-2xl border border-[#E7E2D0] bg-white p-4 shadow-[0_1px_2px_rgba(69,80,58,.06)]">
      <div className="flex flex-wrap items-center gap-2"><Target size={18} className="text-[#0C7064]" /><div className="min-w-0 flex-1"><h2 className="text-[16px] font-bold text-olive">学生目标、家长期待与现状证据</h2><p className="mt-1 text-[11px] leading-relaxed text-olive-mute">两类目标分别访谈、分别保存，不用家长期待代替学生自己的目标。每次更正生成新版本。</p></div><span className="rounded-full bg-mint-pale px-2.5 py-1 text-[10.5px] text-[#0C7064]">{latest ? `GROW V${latest.version}` : "尚未结构化"}</span></div>
      <div className="mt-4 grid gap-3 md:grid-cols-2"><label className={label}>学生自己的目标<textarea aria-label="学生自己的目标" value={studentGoal} onChange={(event) => setStudentGoal(event.target.value)} rows={4} placeholder="学生希望达到什么，何时以什么证据验证" className={input} /></label><label className={label}>家长期待<textarea aria-label="家长期待" value={parentExpectation} onChange={(event) => setParentExpectation(event.target.value)} rows={4} placeholder="家长关注什么；分歧可在复盘中继续对齐" className={input} /></label></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2"><label className={label}>目标院校／方向（可选）<input value={targetSchool} onChange={(event) => setTargetSchool(event.target.value)} maxLength={180} className={input} /></label><label className={label}>目标日期（可选）<input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className={input} /></label></div>
      <div className="mt-4 rounded-xl bg-cream/45 p-3"><div className="flex items-center gap-2"><h3 className="min-w-0 flex-1 text-[12.5px] font-bold text-olive">学科起点与目标</h3><button type="button" onClick={() => setSubjects((old) => [...old, { subject: "", baseline: "", target: "" }])} className="inline-flex items-center gap-1 rounded-lg border border-[#0C7064]/25 px-2 py-1 text-[10.5px] font-semibold text-[#0C7064]"><Plus size={12} />添加学科</button></div>
        <div className="mt-2 space-y-2">{subjects.map((row, index) => <div key={index} className="grid gap-2 rounded-lg bg-white p-2.5 sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_auto]"><input aria-label={`学科 ${index + 1}`} value={row.subject} onChange={(event) => updateSubject(index, { subject: event.target.value })} placeholder="学科" className={input} /><input aria-label={`学科 ${index + 1} 起点`} value={row.baseline} onChange={(event) => updateSubject(index, { baseline: event.target.value })} placeholder="同口径起点／现状" className={input} /><input aria-label={`学科 ${index + 1} 目标`} value={row.target} onChange={(event) => updateSubject(index, { target: event.target.value })} placeholder="目标与验证方式" className={input} /><button type="button" aria-label={`删除学科 ${index + 1}`} onClick={() => setSubjects((old) => old.filter((_, i) => i !== index))} className="self-center rounded-lg p-2 text-olive-mute hover:bg-red-50 hover:text-red-700"><Trash2 size={14} /></button></div>)}{!subjects.length && <p className="py-2 text-[11px] text-olive-mute">可按需添加学科；未填写时不会虚构分数或排名。</p>}</div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2"><label className={label}>现状评估<textarea aria-label="结构化现状评估" value={currentSituation} onChange={(event) => setCurrentSituation(event.target.value)} rows={4} className={input} /></label><label className={label}>现状证据<textarea aria-label="现状证据" value={evidence} onChange={(event) => setEvidence(event.target.value)} rows={4} placeholder="同口径考试、作业、课堂观察或测评结论；不根据签到推断提分" className={input} /></label></div>
      <label className={`${label} mt-3`}>后续沟通与行动<textarea aria-label="后续沟通与行动" value={followUpActions} onChange={(event) => setFollowUpActions(event.target.value)} rows={3} placeholder="行动、责任人、完成标准与复盘节点" className={input} /></label>
      <div className="mt-3 grid gap-2 sm:grid-cols-2"><label className={label}>下次沟通时间<input type="datetime-local" value={nextContactAt} onChange={(event) => setNextContactAt(event.target.value)} className={input} /></label><label className={label}>复测评估日期<input type="date" value={retestDueAt} onChange={(event) => setRetestDueAt(event.target.value)} className={input} /></label></div>

      <div className="mt-4 rounded-xl border border-border p-3"><div className="flex flex-wrap items-center gap-2"><FileSearch size={15} className="text-[#0C7064]" /><h3 className="min-w-0 flex-1 text-[12.5px] font-bold text-olive">测评结论—训练建议—责任—复盘链</h3><select aria-label="选择要关联的测评" value={resultId} onChange={(event) => setResultId(Number(event.target.value))} className="rounded-lg border border-border bg-cream px-2 py-1.5 text-[11px]"><option value={0}>选择本学员测评</option>{data.results.filter((row) => !links.some((link) => link.resultId === row.id)).map((row) => <option key={row.id} value={row.id}>{KIND[row.kind] ?? row.kind} · {localDate(row.createdAt)}</option>)}</select><button type="button" disabled={!resultId} onClick={addLink} className="rounded-lg border border-[#0C7064]/25 px-2.5 py-1.5 text-[11px] font-semibold text-[#0C7064] disabled:opacity-40">关联</button></div>
        <p className="mt-1 text-[10.5px] text-olive-mute">只引用伴学师核对过的结论与证据，不展示或二次推断心理原始答案。</p>
        <div className="mt-2 space-y-3">{links.map((row, index) => <article key={row.resultId} className="rounded-xl bg-cream/45 p-3"><div className="flex items-center gap-2"><b className="min-w-0 flex-1 text-[12px] text-olive">{KIND[data.results.find((result) => result.id === row.resultId)?.kind ?? ""] ?? `测评 #${row.resultId}`}</b><button type="button" onClick={() => setLinks((old) => old.filter((_, i) => i !== index))} className="text-[10.5px] text-red-700">取消关联</button></div><div className="mt-2 grid gap-2 md:grid-cols-2"><label className={label}>测评结论<textarea value={row.conclusion} onChange={(event) => updateLink(index, { conclusion: event.target.value })} rows={2} className={input} /></label><label className={label}>结论依据<textarea value={row.evidence} onChange={(event) => updateLink(index, { evidence: event.target.value })} rows={2} className={input} /></label><label className={label}>训练建议<textarea value={row.trainingSuggestion} onChange={(event) => updateLink(index, { trainingSuggestion: event.target.value })} rows={2} className={input} /></label><div className="grid gap-2 sm:grid-cols-2"><label className={label}>训练周期<input value={row.cycle} onChange={(event) => updateLink(index, { cycle: event.target.value })} className={input} /></label><label className={label}>跟进责任人<select value={row.ownerId} onChange={(event) => updateLink(index, { ownerId: Number(event.target.value) })} className={input}>{owners.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}</select></label><label className={`${label} sm:col-span-2`}>复盘时间<input type="datetime-local" value={row.reviewAt} onChange={(event) => updateLink(index, { reviewAt: event.target.value })} className={input} /></label></div></div></article>)}</div>
      </div>
      {latest && <label className={`${label} mt-3`}>本次更正原因（必填）<input aria-label="GROW 更正原因" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} maxLength={500} placeholder="说明新增事实或更正依据，旧版本不会被覆盖" className={input} /></label>}
      <div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" disabled={save.isPending || !valid} onClick={() => save.mutate({ caseId, studentGoal, parentExpectation, targetSchool: targetSchool || undefined, targetDate: targetDate || null, targetSubjects: subjects, currentSituation, evidence, followUpActions, nextContactAt: nextContactAt ? new Date(nextContactAt) : null, retestDueAt: retestDueAt ? new Date(`${retestDueAt}T12:00:00`) : null, changeReason: changeReason || undefined, reportLinks: links.map((row) => ({ ...row, reviewAt: new Date(row.reviewAt) })) })} className={button}>{save.isPending ? "保存中…" : latest ? "保存结构化 GROW 新版本" : "保存结构化 GROW"}</button>{save.isSuccess && <span className="text-[11px] text-[#2F7A41]">已保存 V{save.data.version}，历史版本保留。</span>}</div>
      {save.error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-[11.5px] text-red-700">{save.error.message}</p>}
      {data.planning.growProfiles.length > 1 && <details className="mt-3 rounded-lg bg-cream/45 p-2.5 text-[11px] text-olive-soft"><summary className="cursor-pointer font-semibold text-olive">查看历史 GROW 版本</summary><div className="mt-2 space-y-2">{data.planning.growProfiles.slice(1).map((profile) => <div key={profile.id} className="rounded-lg bg-white p-2"><b>V{profile.version} · {new Date(profile.createdAt).toLocaleString("zh-CN")}</b><p className="mt-1">学生目标：{profile.studentGoal}</p><p className="mt-1">家长期待：{profile.parentExpectation}</p>{profile.changeReason && <p className="mt-1 text-olive-mute">更正原因：{profile.changeReason}</p>}</div>)}</div></details>}
    </section>}

    {view !== "details" && <section className="rounded-2xl border border-[#E7E2D0] bg-white p-4 shadow-[0_1px_2px_rgba(69,80,58,.06)]"><h2 className="flex items-center gap-2 text-[15px] font-bold text-olive"><UserRoundCheck size={17} className="text-[#0C7064]" />计划三方会签</h2><p className="mt-1 text-[11px] leading-relaxed text-olive-mute">教练确认只代表进入待会签状态；学生本人和至少一位有效监护人分别确认后，计划才正式生效并记录 issuedAt。</p>
      <div className="mt-3 space-y-2">{data.plans.map((plan) => { const signatures = data.planning.planConfirmations.filter((row) => row.confirmation.planId === plan.id); const coachSigned = signatures.some((row) => row.confirmation.role === "coach"); const studentSigned = signatures.some((row) => row.confirmation.role === "student"); const guardianSigned = signatures.some((row) => row.confirmation.role === "guardian"); return <article key={plan.id} className="rounded-xl border border-[#E7E2D0] bg-[#F6F3E8]/45 p-3"><div className="flex flex-wrap items-center gap-2"><BookOpenCheck size={14} className="text-[#0C7064]" /><b className="min-w-0 flex-1 text-[12.5px] text-olive">{plan.title} V{plan.version}</b><span className="rounded-full bg-white px-2 py-1 text-[10px] text-olive-soft">{PLAN_STATUS[plan.status] ?? plan.status}</span></div><div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[10px]">{[["教练", coachSigned], ["学生", studentSigned], ["监护人", guardianSigned]].map(([name, signed]) => <span key={String(name)} className={`rounded-lg px-2 py-1.5 ${signed ? "bg-mint-pale text-[#0C7064]" : "bg-white text-olive-mute"}`}>{signed && <Check size={11} className="mr-0.5 inline" />}{name}{signed ? "已签" : "待签"}</span>)}</div>{plan.status === "awaiting_family" && <p className="mt-2 text-[10.5px] text-amber-800"><Users size={12} className="mr-1 inline" />等待家庭在家庭端“陪跑反馈”中本人会签，工作人员不能代签。</p>}{plan.status === "confirmed" && plan.issuedAt && <p className="mt-2 text-[10.5px] text-[#2F7A41]"><CalendarClock size={12} className="mr-1 inline" />正式生效：{new Date(plan.issuedAt).toLocaleString("zh-CN")}</p>}{plan.status === "draft" && <button type="button" disabled={confirm.isPending} onClick={() => confirm.mutate({ planId: plan.id })} className="mt-2 rounded-lg border border-[#0C7064]/25 bg-white px-3 py-2 text-[11px] font-semibold text-[#0C7064] disabled:opacity-40">教练核对并提交家庭会签</button>}<div className="mt-2 space-y-1">{signatures.map((row) => <p key={row.confirmation.id} className="text-[10px] text-olive-mute">{row.name ?? nameOf(row.confirmation.userId)} · {{ coach: "教练", student: "学生", guardian: "监护人" }[row.confirmation.role] ?? row.confirmation.role} · {new Date(row.confirmation.createdAt).toLocaleString("zh-CN")} · {row.confirmation.comment}</p>)}</div></article>; })}</div>
      {confirm.error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] text-red-700">{confirm.error.message}</p>}
    </section>}
  </div>;
}
