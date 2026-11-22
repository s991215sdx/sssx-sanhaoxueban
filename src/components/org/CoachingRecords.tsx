import { useMemo, useState } from "react";
import { Check, ClipboardList, Eye, FileClock, History, LockKeyhole, Save, ShieldCheck, UserRoundCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import type { CoachingDetail } from "./coachingTypes";
import { invalidateCoachingOperations } from "./coachingRefresh";
import { PayloadView, RecordPayloadEditor } from "./CoachingRecordForms";
import {
  FULLTIME_FIELDS, PLANNING_STEPS, RECORD_LABELS, localDateTime, num, text,
  type CoachingRecordType, type RecordPayload,
} from "./coachingRecordSchema";

const TYPES = Object.keys(RECORD_LABELS) as CoachingRecordType[];
const STATUS: Record<string, string> = { draft: "草稿", pending: "待办理", completed: "待核验／已完成提交", verified: "已核验", missed: "未达成", closed: "已关闭", cancelled: "已取消" };
const DESCRIPTIONS: Record<CoachingRecordType, string> = {
  planning: "18 步逐项记录完成依据和待补位，不用一次访谈代替全部规划。",
  parent_cycle: "亲子美言课按月度周期记录，聚焦亲密关系与家庭练习。",
  family_action: "逐份授权给责任人；提交结果和伴学师核验是两个独立步骤。",
  home_visit: "地址、联系方式与正文敏感加密，仅管理员主动授权查看。",
  fulltime: "上午、下午、晚上均记录任务、困难、补漏、验收与明日第一件事。",
  holiday: "假期总计划、每日证据、成果和开学交接形成连续档案。",
  subject_review: "以同口径考试事实拆分知识、方法与执行差距，安排复验。",
  four_line_review: "结课必需的目标、学科、执行、家庭四线复盘。",
  mindset_action: "记录学生自己的觉察、成长行动和实际证据。",
  pause: "记录暂停原因、恢复条件与家庭沟通，主档同步暂停。",
  resume: "记录恢复原因和补齐计划，主档同步恢复服务。",
  renewal: "明确下一阶段范围与家庭确认，主档同步恢复服务。",
  termination: "记录终止原因、未尽事项和家庭沟通，作为结课去向之一。",
  closure_assessment: "结课必需的前后对照，不能用签到或课时推断提分。",
  closure_interview: "结课必需的访谈结论、家庭问题和材料交接。",
  transfer_export: "管理员登记家庭授权与最小必要转交范围。",
  disposal: "管理员核验保留期限后销毁媒体，保留最小审计索引。",
};
const input = "mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] font-normal text-olive outline-none focus:border-[#0C7064]";
const label = "block text-[11px] font-semibold text-olive";
const primary = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0C7064] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#095C53] disabled:opacity-40";

type ExtendedRecord = CoachingDetail["extendedRecords"][number];
function isoNow(): string { return new Date().toISOString(); }
function today(offset = 0): string { const date = new Date(); date.setDate(date.getDate() + offset); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); }
function month(): string { return today().slice(0, 7); }
function defaultPayload(data: CoachingDetail, type: CoachingRecordType): RecordPayload {
  const guardianId = data.guardians.find((row) => row.grant.active)?.grant.guardianUserId ?? 0;
  const latest = data.planning.growProfiles[0];
  if (type === "planning") return { steps: PLANNING_STEPS.map((_, index) => ({ no: index + 1, done: false, evidence: "", nextAction: "" })), studentGoal: latest?.studentGoal ?? data.coachingCase.goal, parentExpectation: latest?.parentExpectation ?? "", academicBaseline: latest?.currentSituation ?? data.coachingCase.currentSituation, pathway: "", reviewDate: today(30) };
  if (type === "parent_cycle") return { guardianUserId: guardianId, cycleStart: today(), sessions: [{ topic: "亲子美言与积极关注", occurredAt: today(), practice: "", observation: "", nextAction: "" }], relationshipGoal: "", familyFeedback: "" };
  if (type === "family_action") return { guardianUserId: guardianId || null, responsibleUserId: data.coachingCase.studentUserId, action: "", evidence: "", result: "", verifiedBy: null };
  if (type === "home_visit") return { guardianUserId: guardianId, address: "", contact: "", participants: [data.coachingCase.studentUserId, ...(guardianId ? [guardianId] : [])], guardianConfirmed: false, purpose: "", observations: "", nextActions: "" };
  if (type === "fulltime") return { blocks: Array.from({ length: 3 }, () => Object.fromEntries(FULLTIME_FIELDS.map(([key]) => [key, ""]))), signInAt: isoNow(), signOutAt: null, leaveReason: "", makeupPlan: "", handoffNote: "" };
  if (type === "holiday") return { theme: "", overallPlan: "", dailyCheckins: [{ day: today(), task: "", completed: false, evidence: "" }], familyFeedback: "", outcome: "", schoolHandoff: "" };
  if (type === "subject_review") return { subject: "", examName: "", scoreFacts: "", knowledgeGap: "", methodGap: "", executionGap: "", correction: "", nextCheckDate: today(14) };
  if (type === "four_line_review") return { goalLine: "", academicLine: "", executionLine: "", familyLine: "", nextPhase: "", familyCommunicated: false };
  if (type === "mindset_action") return { growthTheme: "", studentReflection: "", action: "", evidence: "", nextStep: "" };
  if (type === "pause") return { effectiveDate: today(), reason: "", resumeCondition: "", familyCommunicated: false };
  if (type === "resume") return { effectiveDate: today(), reason: "", catchUpPlan: "", familyCommunicated: false };
  if (type === "renewal") return { nextStart: data.coachingCase.serviceEnd, nextEnd: "", scope: "", feeAgreement: "", familyConfirmed: false };
  if (type === "termination") return { effectiveDate: today(), reason: "", outstandingItems: "", familyCommunicated: false };
  if (type === "closure_assessment") return { beforeAfter: "", nextSteps: "", familyCommunication: "", continuationIntent: "stop", outcomeEvidence: "" };
  if (type === "closure_interview") return { interviewedAt: isoNow(), participants: [data.coachingCase.studentUserId], conclusion: "", handoffMaterials: "", familyQuestions: "" };
  if (type === "transfer_export") return { destination: "", scope: ["plans"], reason: "", familyAuthorized: false };
  return { deliverableId: 0, reason: "", retentionChecked: false };
}

export default function CoachingRecords({ data }: { data: CoachingDetail }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const caseId = data.coachingCase.id;
  const { data: staff = [] } = trpc.coaching.staff.useQuery();
  const [type, setType] = useState<CoachingRecordType>("planning");
  const [payload, setPayload] = useState<RecordPayload>(() => defaultPayload(data, "planning"));
  const [periodKey, setPeriodKey] = useState(month());
  const [title, setTitle] = useState(`规划课·18 步 ${month()}`);
  const [status, setStatus] = useState("completed");
  const [ownerId, setOwnerId] = useState(data.coachingCase.coachId);
  const [dueAt, setDueAt] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [recipients, setRecipients] = useState<number[]>([data.coachingCase.studentUserId]);
  const [revealed, setRevealed] = useState<Record<number, ExtendedRecord>>({});
  const owners = useMemo(() => [...new Set([data.coachingCase.coachId, data.coachingCase.supervisorId])], [data.coachingCase.coachId, data.coachingCase.supervisorId]);
  const records = useMemo(() => data.extendedRecords.map((row) => revealed[row.id] ?? row), [data.extendedRecords, revealed]);
  const history = records.filter((row) => row.recordType === type);
  const refresh = async () => { await Promise.all([utils.coaching.detail.invalidate({ caseId }), utils.coaching.cases.invalidate(), invalidateCoachingOperations(utils)]); };
  const reset = (nextType: CoachingRecordType) => {
    setType(nextType); setPayload(defaultPayload(data, nextType)); setPeriodKey(month()); setTitle(`${RECORD_LABELS[nextType]} ${month()}`);
    setStatus(nextType === "family_action" ? "pending" : "completed"); setOwnerId(data.coachingCase.coachId); setDueAt(""); setChangeReason("");
    setRecipients([data.coachingCase.studentUserId]);
  };
  const save = trpc.coaching.saveRecord.useMutation({ onSuccess: async () => { reset(type); await refresh(); } });
  const reveal = trpc.coaching.revealRecords.useMutation({ onSuccess: (rows) => { setRevealed(Object.fromEntries(rows.map((row) => [row.id, row]))); } });
  const changePayload = (key: string, value: unknown) => {
    setPayload((old) => ({ ...old, [key]: value }));
    if (key === "responsibleUserId" && typeof value === "number" && value > 0) setRecipients([value]);
  };
  const load = (record: ExtendedRecord) => {
    if (!record.payload) return;
    setType(record.recordType as CoachingRecordType); setPayload(structuredClone(record.payload)); setPeriodKey(record.periodKey); setTitle(`${record.title} · 更正`);
    setStatus(record.status === "verified" ? "completed" : record.status); setOwnerId(record.ownerId); setDueAt(localDateTime(record.dueAt ? String(record.dueAt) : "")); setChangeReason("");
    const grants = data.resourceRecipients.filter((grant) => grant.resourceType === "family_action" && grant.resourceId === record.id && grant.active);
    setRecipients(grants.length ? grants.map((grant) => grant.recipientUserId) : [num(record.payload, "responsibleUserId") || data.coachingCase.studentUserId]);
    document.getElementById("coaching-record-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const nameOf = (id: number) => staff.find((person) => person.id === id)?.name ?? data.recipients.find((person) => person.id === id)?.name ?? `账号 #${id}`;
  const familyReady = type !== "family_action" || (num(payload, "responsibleUserId") > 0 && text(payload, "action").trim().length >= 2 && recipients.length > 0);
  const adminReady = !["transfer_export", "disposal"].includes(type) || user?.role === "admin";
  const specialReady = type !== "disposal" || (num(payload, "deliverableId") > 0 && payload.retentionChecked === true && text(payload, "reason").trim().length >= 2);
  const canSave = title.trim().length >= 2 && periodKey.trim().length >= 2 && owners.includes(ownerId) && familyReady && adminReady && specialReady;

  return <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,7fr)_minmax(300px,4fr)]">
    <section id="coaching-record-editor" className="min-w-0 rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start gap-2"><ClipboardList size={18} className="mt-0.5 text-[#0C7064]" /><div className="min-w-0 flex-1"><h2 className="text-[16px] font-bold text-olive">结构化过程记录与服务档案</h2><p className="mt-1 text-[11px] leading-relaxed text-olive-mute">每次保存生成新版本；同周期更正必须填写原因，旧版本不覆盖。负责人和完成证据用于后续复盘，不等于学习效果承诺。</p></div></div>
      <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-4">{TYPES.map((key) => <button type="button" key={key} onClick={() => reset(key)} className={`min-h-10 rounded-lg border px-2 py-2 text-left text-[10.5px] font-semibold ${type === key ? "border-[#0C7064]/35 bg-mint-pale text-[#0C7064]" : "border-border bg-cream/35 text-olive-soft hover:bg-cream"}`}>{RECORD_LABELS[key]}</button>)}</div>
      <div className="mt-4 rounded-xl bg-mint-pale/25 p-3 text-[11px] leading-relaxed text-olive-soft"><b className="text-olive">{RECORD_LABELS[type]}：</b>{DESCRIPTIONS[type]}</div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><label className={`${label} lg:col-span-2`}>记录标题<input aria-label="结构化记录标题" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} className={input} /></label><label className={label}>周期标识<input aria-label="结构化记录周期" value={periodKey} onChange={(event) => setPeriodKey(event.target.value)} maxLength={32} placeholder="例：2026-11 或 2026-W45" className={input} /></label><label className={label}>状态<select aria-label="结构化记录状态" value={status} onChange={(event) => setStatus(event.target.value)} className={input}>{(type === "family_action" ? ["draft", "pending"] : ["draft", "pending", "completed", "closed", "missed", "cancelled"]).map((key) => <option key={key} value={key}>{STATUS[key]}</option>)}</select></label><label className={label}>负责人<select aria-label="结构化记录负责人" value={ownerId} onChange={(event) => setOwnerId(Number(event.target.value))} className={input}>{owners.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}</select></label><label className={label}>办理期限（可选）<input aria-label="结构化记录期限" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className={input} /></label></div>
      <div className="mt-4"><RecordPayloadEditor type={type} payload={payload} data={data} onChange={changePayload} /></div>
      {type === "family_action" && <fieldset className="mt-3 rounded-xl border border-border p-3"><legend className="px-1 text-[11px] font-semibold text-olive">逐份指定接收人</legend><p className="mb-2 text-[10.5px] text-olive-mute">只有勾选的人能读取此份行动；责任人还需与上方选择一致，才能提交结果。</p><div className="flex flex-wrap gap-2">{data.recipients.map((person) => <label key={person.id} className="flex items-center gap-1.5 rounded-lg bg-cream/45 px-2.5 py-2 text-[11px] text-olive"><input type="checkbox" checked={recipients.includes(person.id)} onChange={() => setRecipients((old) => old.includes(person.id) ? old.filter((id) => id !== person.id) : [...old, person.id])} className="accent-[#0C7064]" />{person.name ?? `账号 #${person.id}`} · {person.label}</label>)}</div></fieldset>}
      <label className={`${label} mt-3`}>同周期更正原因（已有同周期版本时必填）<input aria-label="结构化记录更正原因" value={changeReason} onChange={(event) => setChangeReason(event.target.value)} maxLength={500} placeholder="新增事实或更正依据；首次建立同周期记录可留空" className={input} /></label>
      {!adminReady && <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-900">该操作仅机构管理员可办理，请切换管理员账号。</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={save.isPending || !canSave} onClick={() => save.mutate({ caseId, recordType: type, periodKey, title, payload, status: status as "draft" | "pending" | "completed" | "verified" | "missed" | "closed" | "cancelled", ownerId, dueAt: dueAt ? new Date(dueAt) : null, changeReason: changeReason || undefined, recipientUserIds: type === "family_action" ? recipients : undefined })} className={primary}><Save size={14} />{save.isPending ? "保存中…" : "保存结构化记录新版本"}</button>{save.isSuccess && <span className="text-[11px] text-[#2F7A41]">已保存 V{save.data.version}，主档与运营待办已同步刷新。</span>}</div>
      {save.error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2.5 text-[11.5px] text-red-700">{save.error.message}</p>}
    </section>

    <aside className="min-w-0 space-y-3 2xl:sticky 2xl:top-4">
      <section className="rounded-2xl border border-border bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><History size={16} className="text-[#0C7064]" /><h2 className="min-w-0 flex-1 text-[14px] font-bold text-olive">{RECORD_LABELS[type]} · 版本历史</h2><span className="text-[10px] text-olive-mute">{history.length} 份</span></div>
        {type === "home_visit" && user?.role === "admin" && <button type="button" disabled={reveal.isPending} onClick={() => reveal.mutate({ caseId })} className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-900"><Eye size={13} />{reveal.isPending ? "授权查看中…" : "管理员授权查看敏感正文"}</button>}
        {reveal.error && <p role="alert" className="mt-2 text-[11px] text-red-700">{reveal.error.message}</p>}
        <div className="mt-3 max-h-[850px] space-y-2 overflow-y-auto pr-1">{history.map((record) => <RecordHistoryCard key={record.id} record={record} nameOf={nameOf} onLoad={() => load(record)} onChanged={refresh} />)}{!history.length && <p className="rounded-xl border border-dashed border-border py-7 text-center text-[11.5px] text-olive-mute">该类型还没有记录。</p>}</div>
      </section>
    </aside>
  </div>;
}

function RecordHistoryCard({ record, nameOf, onLoad, onChanged }: { record: ExtendedRecord; nameOf: (id: number) => string; onLoad: () => void; onChanged: () => Promise<void> }) {
  return <article className="rounded-xl border border-border bg-cream/35 p-3"><div className="flex flex-wrap items-center gap-2"><FileClock size={13} className="shrink-0 text-[#0C7064]" /><b className="min-w-0 flex-1 break-words text-[11.5px] text-olive">{record.title}</b><span className="rounded-full bg-white px-2 py-0.5 text-[9.5px] text-olive-soft">V{record.version}</span></div><div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[9.5px] text-olive-mute"><span>{record.periodKey}</span><span>{STATUS[record.status] ?? record.status}</span><span>负责人 {nameOf(record.ownerId)}</span><span>{new Date(record.createdAt).toLocaleString("zh-CN")}</span></div>{record.dueAt && <p className="mt-1 text-[9.5px] text-olive-mute">期限：{new Date(record.dueAt).toLocaleString("zh-CN")}</p>}{record.changeReason && <p className="mt-1.5 text-[10px] text-olive-mute">更正原因:{record.changeReason}</p>}{record.restricted && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[10px] text-amber-900"><LockKeyhole size={12} className="mr-1 inline" />敏感正文未随普通详情返回。</p>}
    <details className="mt-2"><summary className="cursor-pointer text-[10.5px] font-semibold text-[#0C7064]">查看结构化内容</summary><div className="mt-2 max-h-[420px] overflow-y-auto"><PayloadView payload={record.payload} /></div></details>
    {record.payload && <button type="button" onClick={onLoad} className="mt-2 rounded-lg border border-[#0C7064]/25 bg-white px-2.5 py-1.5 text-[10.5px] font-semibold text-[#0C7064]">载入并追加更正版本</button>}
    {record.recordType === "family_action" && record.status === "completed" && <FamilyActionVerification recordId={record.id} onChanged={onChanged} />}
    {record.recordType === "family_action" && record.status === "verified" && <p className="mt-2 text-[10.5px] font-semibold text-[#2F7A41]"><ShieldCheck size={13} className="mr-1 inline" />伴学师已核验；{String(record.payload?.verificationNote ?? "")}</p>}
  </article>;
}
function FamilyActionVerification({ recordId, onChanged }: { recordId: number; onChanged: () => Promise<void> }) {
  const [note, setNote] = useState("");
  const verify = trpc.coaching.verifyFamilyAction.useMutation({ onSuccess: async () => { setNote(""); await onChanged(); } });
  return <div className="mt-3 rounded-xl border border-[#0C7064]/20 bg-mint-pale/25 p-2.5"><h4 className="flex items-center gap-1 text-[11px] font-bold text-olive"><UserRoundCheck size={13} />伴学师核验家庭行动</h4><p className="mt-1 text-[10px] text-olive-mute">责任人已提交，不代表已验收。请核对证据和结果后填写结论。</p><textarea aria-label={`家庭行动 ${recordId} 核验结论`} value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="核验事实、达标程度与需要补位的内容" className={input} /><button type="button" disabled={verify.isPending || note.trim().length < 2} onClick={() => verify.mutate({ recordId, verificationNote: note })} className={`${primary} mt-2 w-full`}><Check size={13} />确认证据并验收</button>{verify.error && <p role="alert" className="mt-2 text-[10px] text-red-700">{verify.error.message}</p>}</div>;
}
