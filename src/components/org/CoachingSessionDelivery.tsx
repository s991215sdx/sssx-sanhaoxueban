import { useMemo, useState } from "react";
import { BookOpenCheck, CalendarClock, CheckCircle2, Download, FileAudio, FileImage, History, Plus, Save, Trash2, Upload, UserPlus, Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { phaseForVisit } from "@contracts/orgService";
import { saveCoachingFile } from "@/lib/coachingDownload";
import type { CoachingDetail } from "./coachingTypes";
import { invalidateCoachingOperations } from "./coachingRefresh";

const FORMAT_LABEL: Record<string, string> = { one_to_one: "一对一", salon: "小组沙龙", workshop: "学习坊", mixed: "混合小组", supervision: "纯督学" };
const ATTENDANCE_LABEL = { present: "出席", late: "迟到", absent: "缺席", leave: "请假" } as const;
const STATUS_LABEL: Record<string, string> = { scheduled: "预约", draft: "草稿", completed: "已完成", cancelled: "已取消" };
const input = "mt-1 min-h-10 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] font-normal text-olive outline-none focus:border-[#0C7064]";
const button = "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[#0C7064]/25 px-3 py-2 text-[11.5px] font-semibold text-[#0C7064] hover:bg-mint-pale disabled:cursor-not-allowed disabled:opacity-40";

type Format = "one_to_one" | "salon" | "workshop" | "mixed";
type DeliveryStatus = "scheduled" | "draft" | "completed";
type Unit = { courseKey: string; lessonNo: number | null; title: string; learningPoints: string; practiceEvidence: string };
type Participant = {
  studentUserId: number; guardianUserId: number | null; guardianLabel: string;
  attendance: keyof typeof ATTENDANCE_LABEL; personalObservation: string; privateNote: string; feedbackText: string;
  actionTitle: string; actionDetail: string; dueDate: string;
};
type SupervisionForm = {
  selfStudyMinutes: number; alignment: string; checks: string; exitCheck: string; followUp: string;
  signInAt: Date | null; signOutAt: Date | null; leaveReason: string; makeupPlan: string; handoffNote: string;
};

function localDateTime(value: Date | string = new Date()): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function dateAfter(days: number): string {
  const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10);
}
function emptySupervision(): SupervisionForm {
  return { selfStudyMinutes: 60, alignment: "", checks: "", exitCheck: "", followUp: "", signInAt: null, signOutAt: null, leaveReason: "", makeupPlan: "", handoffNote: "" };
}

/** 五课交付：整组续写、逐生家庭接收人、预约与历史事实分开管理。 */
export default function CoachingSessionDelivery({ data }: { data: CoachingDetail }) {
  const utils = trpc.useUtils();
  const caseId = data.coachingCase.id;
  const { data: cases = [] } = trpc.coaching.cases.useQuery();
  const [mode, setMode] = useState<"session" | "supervision">("session");
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingSupervisionId, setEditingSupervisionId] = useState<number | null>(null);
  const [startAt, setStartAt] = useState(localDateTime());
  const [format, setFormat] = useState<Format>("one_to_one");
  const [status, setStatus] = useState<DeliveryStatus>("completed");
  const [changeReason, setChangeReason] = useState("");
  const [lateChangeConfirmed, setLateChangeConfirmed] = useState(false);
  const [sharedSummary, setSharedSummary] = useState("");
  const [supervision, setSupervision] = useState<SupervisionForm>(emptySupervision);
  const [units, setUnits] = useState<Unit[]>([{ courseKey: "mindset", lessonNo: null, title: "心法课·心智成长", learningPoints: "", practiceEvidence: "" }]);
  const mainParticipant = useMemo<Participant>(() => ({ studentUserId: data.coachingCase.studentUserId, guardianUserId: null, guardianLabel: "", attendance: "present", personalObservation: "", privateNote: "", feedbackText: "", actionTitle: "", actionDetail: "", dueDate: dateAfter(7) }), [data.coachingCase.studentUserId]);
  const [participants, setParticipants] = useState<Participant[]>([mainParticipant]);
  const [addingStudent, setAddingStudent] = useState(0);
  const phase = phaseForVisit(data.coachingCase.serviceStart, new Date(startAt));
  const early = phase === "early";
  const groupFormat = format !== "one_to_one";
  const studentIds = useMemo(() => participants.map((row) => row.studentUserId), [participants]);
  const editQuery = trpc.coaching.sessionForEdit.useQuery({ sessionId: editingSessionId ?? 0 }, { enabled: editingSessionId != null, retry: false });
  const [appliedEdit, setAppliedEdit] = useState<typeof editQuery.data>();
  const recipientsQuery = trpc.coaching.sessionRecipients.useQuery({ caseId, studentUserIds: studentIds }, { enabled: studentIds.length > 0, retry: false });
  const refresh = async () => {
    await Promise.all([utils.coaching.detail.invalidate({ caseId }), utils.coaching.cases.invalidate(), utils.coaching.sessionForEdit.invalidate(), utils.coaching.sessionHistory.invalidate(), invalidateCoachingOperations(utils)]);
  };
  const reset = () => {
    setEditingSessionId(null); setEditingSupervisionId(null); setAppliedEdit(undefined); setStartAt(localDateTime()); setFormat("one_to_one"); setStatus("completed");
    setChangeReason(""); setLateChangeConfirmed(false); setSharedSummary(""); setSupervision(emptySupervision());
    setUnits([{ courseKey: "mindset", lessonNo: null, title: "心法课·心智成长", learningPoints: "", practiceEvidence: "" }]);
    setParticipants([mainParticipant]); setAddingStudent(0);
  };
  // 异步查询返回新课堂快照时只恢复一次；先清空未提交子界面，避免重复应用同一快照。
  const restored = editQuery.data;
  if (restored && restored !== appliedEdit) {
    setAppliedEdit(restored);
    setMode("session"); setEditingSupervisionId(null); setStartAt(localDateTime(restored.session.startAt));
    setFormat(restored.session.format as Format); setStatus(restored.session.status as DeliveryStatus); setChangeReason(""); setLateChangeConfirmed(false);
    setSharedSummary(restored.session.sharedSummary);
    setSupervision(restored.supervision ? { selfStudyMinutes: restored.supervision.selfStudyMinutes, alignment: restored.supervision.alignment,
      checks: restored.supervision.checks, exitCheck: restored.supervision.exitCheck, followUp: restored.supervision.followUp,
      signInAt: restored.supervision.signInAt, signOutAt: restored.supervision.signOutAt, leaveReason: restored.supervision.leaveReason ?? "",
      makeupPlan: restored.supervision.makeupPlan ?? "", handoffNote: restored.supervision.handoffNote ?? "" } : emptySupervision());
    setUnits(restored.units.map((unit) => ({ courseKey: unit.courseKey, lessonNo: unit.lessonNo, title: unit.title, learningPoints: unit.learningPoints, practiceEvidence: unit.practiceEvidence })));
    setParticipants(restored.participants.map(({ participant, action }) => ({ studentUserId: participant.studentUserId,
      guardianUserId: participant.guardianUserId, guardianLabel: participant.guardianLabel,
      attendance: (participant.attendance in ATTENDANCE_LABEL ? participant.attendance : "present") as Participant["attendance"],
      personalObservation: participant.personalObservation, privateNote: participant.privateNote, feedbackText: participant.feedbackText,
      actionTitle: action?.title ?? "", actionDetail: action?.detail ?? "", dueDate: action?.dueDate ?? dateAfter(7) })));
  }
  const saveSession = trpc.coaching.saveSession.useMutation({ onSuccess: async () => { reset(); await refresh(); } });
  const saveSupervision = trpc.coaching.saveSupervision.useMutation({ onSuccess: async () => { reset(); await refresh(); } });
  const updateUnit = (index: number, patch: Partial<Unit>) => setUnits((old) => old.map((unit, i) => i === index ? { ...unit, ...patch } : unit));
  const updateParticipant = (index: number, patch: Partial<Participant>) => setParticipants((old) => old.map((row, i) => i === index ? { ...row, ...patch } : row));
  const availableStudents = cases.filter((item) => !studentIds.includes(item.coachingCase.studentUserId));
  const recipientGroup = (studentUserId: number) => recipientsQuery.data?.find((row) => row.studentUserId === studentUserId)?.recipients ?? [];
  const parentRequired = units.some((unit) => unit.courseKey === "parent");
  const reasonRequired = Boolean(editingSessionId) || (!early && groupFormat && mode === "session");
  const save = () => {
    const visit = new Date(startAt);
    const supervisionInput = { ...supervision, leaveReason: supervision.leaveReason || undefined, makeupPlan: supervision.makeupPlan || undefined, handoffNote: supervision.handoffNote || undefined };
    if (mode === "supervision") {
      saveSupervision.mutate({ caseId, supervisionId: editingSupervisionId ?? undefined, visitAt: visit, status, ...supervisionInput });
      return;
    }
    saveSession.mutate({ caseId, sessionId: editingSessionId ?? undefined, startAt: visit, format, status,
      changeReason: changeReason || undefined, lateChangeConfirmed, sharedSummary, supervision: supervisionInput,
      units: units.map((unit) => ({ ...unit, lessonNo: unit.courseKey === "method" ? unit.lessonNo : null })),
      participants: participants.map((row) => ({ studentUserId: row.studentUserId, guardianUserId: row.guardianUserId,
        guardianLabel: row.guardianLabel || undefined, attendance: row.attendance, personalObservation: row.personalObservation || undefined,
        privateNote: row.privateNote || undefined, feedbackText: row.feedbackText || undefined,
        action: row.actionTitle.trim() ? { title: row.actionTitle, detail: row.actionDetail || undefined, dueDate: row.dueDate } : undefined })) });
  };
  const loadSupervision = (record: CoachingDetail["supervisions"][number]) => {
    reset(); setMode("supervision"); setEditingSupervisionId(record.id); setStartAt(localDateTime(record.visitAt));
    setStatus(record.status as DeliveryStatus); setSupervision({ selfStudyMinutes: record.selfStudyMinutes, alignment: record.alignment,
      checks: record.checks, exitCheck: record.exitCheck, followUp: record.followUp, signInAt: record.signInAt, signOutAt: record.signOutAt,
      leaveReason: record.leaveReason ?? "", makeupPlan: record.makeupPlan ?? "", handoffNote: record.handoffNote ?? "" });
  };
  const saving = saveSession.isPending || saveSupervision.isPending;
  const error = saveSession.error ?? saveSupervision.error ?? editQuery.error ?? recipientsQuery.error;
  const formDisabled = saving || (editingSessionId != null && editQuery.isLoading);

  return <div className="space-y-5">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{data.catalog.map((course) => <div key={course.id} className="rounded-xl border border-[#0C7064]/15 bg-white p-3">
      <div className="text-[13px] font-bold text-olive">{course.title}</div><div className="mt-0.5 text-[11px] font-semibold text-[#0C7064]">{course.audience} · {course.purpose}</div>
      <p className="mt-1 text-[10.5px] leading-relaxed text-olive-mute">{course.description}</p><p className="mt-1.5 text-[10px] leading-relaxed text-olive-soft">{course.rhythm}</p>
      {course.courseKey === "method" && <details className="mt-2 text-[10.5px] text-olive-soft"><summary className="cursor-pointer font-semibold text-[#0C7064]">查看十二次技法大纲</summary><ol className="mt-1 list-decimal space-y-1 pl-4">{course.outline.map((raw, index) => { const item = raw as { title?: string; content?: string }; return <li key={index}><b>{item.title}</b><span className="block text-olive-mute">{item.content}</span></li>; })}</ol></details>}
    </div>)}</section>

    <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3"><div><h2 className="text-[16px] font-bold text-olive">{editingSessionId ? `续写课堂 #${editingSessionId}` : editingSupervisionId ? `续写督学 #${editingSupervisionId}` : "记录本次到店"}</h2>
        <p className={`mt-1 text-[11px] ${early ? "text-olive-mute" : "text-[#0C7064]"}`}>{early ? "前三个月：每次均为一对一教练课＋督学" : "后三个月：可评估继续一对一或改小组沙龙／学习坊，督学必有"}</p></div>
        <div className="ml-auto flex flex-wrap gap-2"><div className="flex rounded-lg bg-cream p-1"><button type="button" disabled={formDisabled} onClick={() => { reset(); setMode("session"); }} className={`min-h-9 rounded-md px-3 text-[11.5px] font-semibold ${mode === "session" ? "bg-[#0C7064] text-white" : "text-olive"}`}>教练课＋督学</button><button type="button" onClick={() => { reset(); setMode("supervision"); }} disabled={early || formDisabled} title={early ? "前三个月不能纯督学" : "后三个月可纯督学"} className={`min-h-9 rounded-md px-3 text-[11.5px] font-semibold disabled:opacity-40 ${mode === "supervision" ? "bg-[#0C7064] text-white" : "text-olive"}`}>纯督学</button></div>
          {(editingSessionId || editingSupervisionId) && <button type="button" className={button} onClick={reset}>放弃续写，新建记录</button>}</div></div>
      {editingSessionId != null && editQuery.isLoading && <p className="mt-3 rounded-lg bg-cream p-3 text-[12px] text-olive-mute">正在读取整组成员、各自行动与督学记录…</p>}
      <fieldset disabled={formDisabled} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[11.5px] font-semibold text-olive">到店时间<input type="datetime-local" value={startAt} onChange={(event) => {
          const nextStartAt = event.target.value;
          setStartAt(nextStartAt);
          if (phaseForVisit(data.coachingCase.serviceStart, new Date(nextStartAt)) === "early") {
            setFormat("one_to_one");
            setParticipants([mainParticipant]);
            if (mode === "supervision") setMode("session");
          }
        }} className={input} /></label>
        <label className="text-[11.5px] font-semibold text-olive">记录状态<select value={status} onChange={(event) => setStatus(event.target.value as DeliveryStatus)} className={input}><option value="scheduled">预约</option><option value="draft">草稿</option><option value="completed">已完成</option></select></label>
        {mode === "session" && <label className="text-[11.5px] font-semibold text-olive">课堂形式<select value={format} disabled={early} onChange={(event) => setFormat(event.target.value as Format)} className={`${input} disabled:opacity-60`}><option value="one_to_one">一对一</option><option value="salon">小组沙龙</option><option value="workshop">学习坊</option><option value="mixed">混合小组</option></select></label>}
        <label className="text-[11.5px] font-semibold text-olive">自习督学（分钟）<input type="number" min={0} max={1440} value={supervision.selfStudyMinutes} onChange={(event) => setSupervision((old) => ({ ...old, selfStudyMinutes: Number(event.target.value) }))} className={input} /></label>
        <label className="text-[11.5px] font-semibold text-olive">实际到店<input type="datetime-local" value={supervision.signInAt ? localDateTime(supervision.signInAt) : ""} onChange={(event) => setSupervision((old) => ({ ...old, signInAt: event.target.value ? new Date(event.target.value) : null }))} className={input} /></label>
        <label className="text-[11.5px] font-semibold text-olive">实际离店<input type="datetime-local" value={supervision.signOutAt ? localDateTime(supervision.signOutAt) : ""} onChange={(event) => setSupervision((old) => ({ ...old, signOutAt: event.target.value ? new Date(event.target.value) : null }))} className={input} /></label>
      </fieldset>
      {reasonRequired && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><label className="block text-[11.5px] font-semibold text-olive">{editingSessionId ? "续写／完成说明（必填）" : "形式变更原因（必填）"}<input value={changeReason} onChange={(event) => setChangeReason(event.target.value)} maxLength={500} placeholder={editingSessionId ? "说明本次补充、完成交付或调整的内容；原课堂快照会保留。" : "例：已具备小组协作与自主学习能力，经阶段评估进入学习坊。"} className={`${input} border-amber-200`} /></label>
        {!early && groupFormat && mode === "session" && <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 text-[11.5px] text-olive"><input type="checkbox" checked={lateChangeConfirmed} onChange={(event) => setLateChangeConfirmed(event.target.checked)} className="accent-[#0C7064]" />我已完成阶段评估，并确认本次形式调整</label>}</div>}

      {mode === "session" && <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-[13px] font-bold text-olive">教练内容单元 <span className="font-normal text-olive-mute">可穿插 1～5 个</span></h3><button type="button" disabled={formDisabled || units.length >= 5} onClick={() => setUnits((old) => [...old, { courseKey: "method", lessonNo: 1, title: "技法课·综合测评与立志", learningPoints: "", practiceEvidence: "" }])} className={button}><Plus size={13} />添加内容</button></div>
        {units.map((unit, index) => <div key={index} className="rounded-xl border border-border bg-cream/50 p-3">
          <div className="grid gap-2 sm:grid-cols-[160px_130px_minmax(0,1fr)_auto]"><select aria-label="课程类型" disabled={formDisabled} value={unit.courseKey} onChange={(event) => { const courseKey = event.target.value; const course = data.catalog.find((row) => row.courseKey === courseKey); updateUnit(index, { courseKey, title: `${course?.title ?? "课程"}·${course?.purpose ?? "课堂"}`, lessonNo: courseKey === "method" ? 1 : null }); }} className={input}>{data.catalog.filter((row) => row.courseKey !== "supervision").map((course) => <option key={course.id} value={course.courseKey}>{course.title} · {course.purpose}</option>)}</select>
            {unit.courseKey === "method" ? <select aria-label="技法课节次" value={unit.lessonNo ?? 1} onChange={(event) => { const lessonNo = Number(event.target.value); const outline = data.catalog.find((row) => row.courseKey === "method")?.outline as { lessonNo: number; title: string }[] | undefined; updateUnit(index, { lessonNo, title: `技法课·${outline?.find((row) => row.lessonNo === lessonNo)?.title ?? `第 ${lessonNo} 次`}` }); }} className={input}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>第 {index + 1} 次</option>)}</select> : <span className="flex items-center px-2 text-[11px] text-olive-mute">按学员实际需要</span>}
            <input aria-label="内容单元标题" value={unit.title} onChange={(event) => updateUnit(index, { title: event.target.value })} className={input} /><button type="button" aria-label="删除内容单元" disabled={formDisabled || units.length === 1} onClick={() => setUnits((old) => old.filter((_, i) => i !== index))} className="min-h-10 rounded-lg px-3 text-olive-mute hover:bg-red-50 hover:text-red-700 disabled:opacity-30"><Trash2 size={15} /></button></div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2"><textarea aria-label="学习要点" value={unit.learningPoints} onChange={(event) => updateUnit(index, { learningPoints: event.target.value })} rows={2} placeholder="学习要点：孩子理解了什么、能复述什么" className={input} /><textarea aria-label="现场练习证据" value={unit.practiceEvidence} onChange={(event) => updateUnit(index, { practiceEvidence: event.target.value })} rows={2} placeholder="现场练习证据：作品、讲解、限时任务或行为观察" className={input} /></div>
        </div>)}
        <label className="block text-[11.5px] font-semibold text-olive">共享课堂总结<textarea value={sharedSummary} onChange={(event) => setSharedSummary(event.target.value)} rows={3} placeholder="本次目标、课堂过程、共同结论与后续衔接；个人观察请在每位学员处单独填写。" className={input} /></label>
      </div>}

      <div className="mt-4 rounded-xl border border-[#0C7064]/20 bg-mint-pale/25 p-3"><h3 className="flex items-center gap-1.5 text-[13px] font-bold text-olive"><CheckCircle2 size={15} className="text-[#0C7064]" />督学主线（每次必填）</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2"><textarea value={supervision.alignment} onChange={(event) => setSupervision((old) => ({ ...old, alignment: event.target.value }))} rows={2} placeholder="任务对齐：本次要完成什么、标准是什么" className={input} /><textarea value={supervision.checks} onChange={(event) => setSupervision((old) => ({ ...old, checks: event.target.value }))} rows={2} placeholder="过程检查：自习巡查、费曼输出、补位记录" className={input} /><textarea value={supervision.exitCheck} onChange={(event) => setSupervision((old) => ({ ...old, exitCheck: event.target.value }))} rows={2} placeholder="离店验收：用什么证据证明掌握，而不只是签到" className={input} /><textarea value={supervision.followUp} onChange={(event) => setSupervision((old) => ({ ...old, followUp: event.target.value }))} rows={2} placeholder="后续补位：未完成项、责任人与期限" className={input} /><textarea value={supervision.leaveReason} onChange={(event) => setSupervision((old) => ({ ...old, leaveReason: event.target.value }))} rows={2} placeholder="请假／早退原因（如适用）" className={input} /><textarea value={supervision.makeupPlan} onChange={(event) => setSupervision((old) => ({ ...old, makeupPlan: event.target.value }))} rows={2} placeholder="补学安排（如适用）" className={input} /></div>
        <textarea aria-label="督学交接备注" value={supervision.handoffNote} onChange={(event) => setSupervision((old) => ({ ...old, handoffNote: event.target.value }))} rows={2} placeholder="需要交接给下一位督学的事项" className={`${input} mt-2`} /></div>

      {mode === "session" && <div className="mt-4 space-y-3"><div className="flex flex-wrap items-center gap-2"><h3 className="flex items-center gap-1.5 text-[13px] font-bold text-olive"><Users size={15} />参与学员与个人行动</h3>{!early && groupFormat && <div className="ml-auto flex flex-wrap gap-2"><select aria-label="选择要加入的小组成员" value={addingStudent} onChange={(event) => setAddingStudent(Number(event.target.value))} className={input}><option value={0}>选择有陪跑主档的学员</option>{availableStudents.map((item) => <option key={item.coachingCase.id} value={item.coachingCase.studentUserId}>{item.studentName}</option>)}</select><button type="button" className={button} disabled={!addingStudent || formDisabled} onClick={() => { if (!addingStudent) return; setParticipants((old) => [...old, { ...mainParticipant, studentUserId: addingStudent }]); setAddingStudent(0); }}><UserPlus size={13} />加入</button></div>}</div>
        {parentRequired && <p className="rounded-lg bg-mint-pale/40 p-2.5 text-[11px] text-olive-soft">亲子美言课须为每位学员分别选择其主档下的有效监护人；不能填写任意姓名代替账号校验。</p>}
        {participants.map((participant, index) => { const student = cases.find((item) => item.coachingCase.studentUserId === participant.studentUserId); const guardianOptions = recipientGroup(participant.studentUserId).filter((person) => person.label !== "学生"); return <div key={participant.studentUserId} className="rounded-xl border border-border bg-cream/40 p-3">
          <div className="flex flex-wrap items-center gap-2"><span className="text-[13px] font-bold text-olive">{student?.studentName ?? recipientsQuery.data?.find((row) => row.studentUserId === participant.studentUserId)?.studentName ?? `学员 ${participant.studentUserId}`}</span><select aria-label={`${participant.studentUserId} 出勤状态`} value={participant.attendance} onChange={(event) => updateParticipant(index, { attendance: event.target.value as Participant["attendance"] })} className={input}>{Object.entries(ATTENDANCE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            {parentRequired && <><select aria-label={`${participant.studentUserId} 亲子课监护人`} value={participant.guardianUserId ?? 0} onChange={(event) => { const guardianUserId = Number(event.target.value) || null; const guardian = guardianOptions.find((row) => row.id === guardianUserId); updateParticipant(index, { guardianUserId, guardianLabel: guardian?.label ?? "" }); }} className={input}><option value={0}>选择本主档有效监护人</option>{guardianOptions.map((person) => <option key={person.id} value={person.id}>{person.name ?? `账号 #${person.id}`} · {person.label}</option>)}</select><span className="text-[11px] text-olive-mute">{participant.guardianLabel || "尚未选择"}</span></>}
            {participant.studentUserId !== data.coachingCase.studentUserId && <button type="button" disabled={formDisabled} onClick={() => setParticipants((old) => old.filter((_, i) => i !== index))} className="ml-auto min-h-10 rounded-lg px-2 text-olive-mute hover:text-red-700" aria-label="移出小组成员"><Trash2 size={14} /></button>}</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2"><textarea value={participant.personalObservation} onChange={(event) => updateParticipant(index, { personalObservation: event.target.value })} rows={2} placeholder="该学员个人观察（仅本学员主档可见）" className={input} /><textarea value={participant.privateNote} onChange={(event) => updateParticipant(index, { privateNote: event.target.value })} rows={2} placeholder="内部备注（不推送给家长）" className={input} /></div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]"><input value={participant.actionTitle} onChange={(event) => updateParticipant(index, { actionTitle: event.target.value })} placeholder="课后可验证行动，例：三天内完成两张错题三刷卡" className={input} /><input aria-label="行动完成期限" type="date" value={participant.dueDate} onChange={(event) => updateParticipant(index, { dueDate: event.target.value })} className={input} /></div>
          <textarea value={participant.actionDetail} onChange={(event) => updateParticipant(index, { actionDetail: event.target.value })} rows={1} placeholder="行动标准与验收方式；已有行动不会因续写重复创建。" className={`${input} mt-2`} />
          <textarea value={participant.feedbackText} onChange={(event) => updateParticipant(index, { feedbackText: event.target.value })} rows={2} placeholder="给这位学员家长的反馈草稿；完成课堂后可上传录音／图片并正式推送" className={`${input} mt-2`} />
        </div>; })}</div>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{error.message}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={save} disabled={formDisabled || !startAt || (reasonRequired && changeReason.trim().length < 2)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#0C7064] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#095C53] disabled:opacity-40"><Save size={15} />{saving ? "正在保存…" : mode === "session" ? "保存课堂与逐生督学" : "保存到店督学"}</button>{(saveSession.isSuccess || saveSupervision.isSuccess) && <span className="text-[11px] text-[#2F7A41]">已保存；草稿可续写，预约可改期，完成后再逐人推送反馈。</span>}</div>
    </section>

    <section className="space-y-3"><h2 className="text-[16px] font-bold text-olive">课堂、反馈与附件</h2>{data.sessions.map((session) => <SessionCard key={session.id} data={data} session={session} onEdit={() => { reset(); setEditingSessionId(session.id); }} onChanged={refresh} />)}{!data.sessions.length && <p className="rounded-xl border border-dashed border-border py-6 text-center text-[12px] text-olive-mute">还没有课堂记录。</p>}</section>
    <section className="space-y-3"><h2 className="text-[16px] font-bold text-olive">到店督学记录</h2><div className="grid items-start gap-2 lg:grid-cols-2">{data.supervisions.map((record) => <SupervisionCard key={record.id} record={record} onEdit={() => loadSupervision(record)} onChanged={refresh} />)}</div>{!data.supervisions.length && <p className="rounded-xl border border-dashed border-border py-6 text-center text-[12px] text-olive-mute">还没有督学记录。</p>}</section>
  </div>;
}

function SessionCard({ data, session, onEdit, onChanged }: { data: CoachingDetail; session: CoachingDetail["sessions"][number]; onEdit: () => void; onChanged: () => Promise<unknown> }) {
  const participant = session.participants[0];
  const editable = ["draft", "scheduled"].includes(session.status);
  const cancelled = session.status === "cancelled";
  return <article className={`rounded-2xl border bg-white p-4 shadow-sm ${cancelled ? "border-border opacity-75" : "border-border"}`}>
    <div className="flex flex-wrap items-center gap-2"><BookOpenCheck size={17} className="text-[#0C7064]" /><h3 className="text-[14px] font-bold text-olive">{new Date(session.startAt).toLocaleString("zh-CN")}</h3><span className="rounded-full bg-mint-pale px-2 py-0.5 text-[10.5px] text-[#0C7064]">{FORMAT_LABEL[session.format] ?? session.format}</span><span className="text-[10.5px] text-olive-mute">{session.phase === "early" ? "前三个月" : "后三个月"} · {STATUS_LABEL[session.status] ?? session.status}</span></div>
    <div className="mt-3 space-y-2">{session.units.map((unit) => <div key={unit.id} className="rounded-lg bg-cream/60 p-3"><div className="text-[12.5px] font-semibold text-olive">{unit.title}{unit.lessonNo ? `（第 ${unit.lessonNo} 次）` : ""}</div><p className="mt-1 text-[11.5px] text-olive-soft">学习要点：{unit.learningPoints || "待补充"}</p><p className="mt-0.5 text-[11.5px] text-olive-mute">现场证据：{unit.practiceEvidence || "待补充"}</p></div>)}</div>
    {session.sharedSummary && <p className="mt-3 text-[12px] leading-relaxed text-olive-soft"><b className="text-olive">课堂总结：</b>{session.sharedSummary}</p>}
    {session.changeReason && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">变更说明：{session.changeReason}</p>}
    {cancelled && <p className="mt-2 rounded-lg bg-cream p-2.5 text-[11.5px] text-olive-mute">本课堂已取消，只读保留；取消原因：{session.cancelReason || "未填写"}</p>}
    {editable && <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" className={button} onClick={onEdit}><Save size={13} />续写{session.status === "scheduled" ? "预约" : "草稿"}</button><ScheduleActions kind="session" id={session.id} originalAt={session.startAt} onChanged={onChanged} /></div>}
    <SessionHistory sessionId={session.id} />
    {session.status === "completed" && (participant ? <FeedbackBox data={data} sessionId={session.id} participant={participant} /> : <p className="mt-3 text-[11px] text-olive-mute">本学员参与记录待补充。</p>)}
  </article>;
}

function ScheduleActions({ kind, id, originalAt, onChanged }: { kind: "session" | "supervision"; id: number; originalAt: Date | string; onChanged: () => Promise<unknown> }) {
  const [action, setAction] = useState<"reschedule" | "cancel" | null>(null);
  const [at, setAt] = useState(localDateTime(originalAt));
  const [reason, setReason] = useState("");
  const rescheduleSession = trpc.coaching.rescheduleSession.useMutation({ onSuccess: async () => { setAction(null); setReason(""); await onChanged(); } });
  const cancelSession = trpc.coaching.cancelSession.useMutation({ onSuccess: async () => { setAction(null); setReason(""); await onChanged(); } });
  const rescheduleSupervision = trpc.coaching.rescheduleSupervision.useMutation({ onSuccess: async () => { setAction(null); setReason(""); await onChanged(); } });
  const cancelSupervision = trpc.coaching.cancelSupervision.useMutation({ onSuccess: async () => { setAction(null); setReason(""); await onChanged(); } });
  const pending = rescheduleSession.isPending || cancelSession.isPending || rescheduleSupervision.isPending || cancelSupervision.isPending;
  const error = rescheduleSession.error ?? cancelSession.error ?? rescheduleSupervision.error ?? cancelSupervision.error;
  const submit = () => {
    if (action === "reschedule") {
      if (kind === "session") rescheduleSession.mutate({ sessionId: id, startAt: new Date(at), reason });
      else rescheduleSupervision.mutate({ supervisionId: id, visitAt: new Date(at), reason });
    } else if (action === "cancel") {
      if (kind === "session") cancelSession.mutate({ sessionId: id, reason });
      else cancelSupervision.mutate({ supervisionId: id, reason });
    }
  };
  return <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => { setAction("reschedule"); setReason(""); }}><CalendarClock size={13} />改期</button><button type="button" className={`${button} border-red-200 text-red-700 hover:bg-red-50`} onClick={() => { setAction("cancel"); setReason(""); }}>取消</button></div>
    {action && <div className="mt-2 w-full rounded-xl bg-cream p-3"><div className="grid gap-2 sm:grid-cols-2">{action === "reschedule" && <label className="text-[11px] font-semibold text-olive">新时间<input type="datetime-local" value={at} onChange={(event) => setAt(event.target.value)} className={input} /></label>}<label className="text-[11px] font-semibold text-olive">{action === "cancel" ? "取消原因" : "改期原因"}<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} placeholder="具体原因会与原时间、原状态和操作人一起留痕" className={input} /></label></div><div className="mt-2 flex gap-2"><button type="button" disabled={pending || reason.trim().length < 2 || (action === "reschedule" && !at)} onClick={submit} className={button}>{pending ? "处理中…" : action === "cancel" ? "确认取消并保留历史" : "确认改期"}</button><button type="button" className={button} onClick={() => setAction(null)}>返回</button></div>{error && <p role="alert" className="mt-2 text-[11px] text-red-700">{error.message}</p>}</div>}
  </div>;
}

function SessionHistory({ sessionId }: { sessionId: number }) {
  const [open, setOpen] = useState(false);
  const history = trpc.coaching.sessionHistory.useQuery({ sessionId }, { enabled: open, retry: false });
  const actionLabel: Record<string, string> = { rescheduled: "改期", cancelled: "取消", revised: "续写", completed: "完成归档" };
  return <div className="mt-3"><button type="button" className="inline-flex min-h-9 items-center gap-1 text-[11px] font-semibold text-olive-mute hover:text-[#0C7064]" onClick={() => setOpen((value) => !value)}><History size={13} />{open ? "收起变更历史" : "查看变更历史"}</button>
    {open && <div className="mt-2 space-y-2 rounded-xl bg-cream/60 p-3">{history.isLoading && <p className="text-[11px] text-olive-mute">正在读取历史…</p>}{history.error && <p role="alert" className="text-[11px] text-red-700">{history.error.message}</p>}{history.data?.map((event) => <div key={event.id} className="border-b border-border/70 pb-2 text-[11px] leading-relaxed text-olive-soft last:border-0"><b>{actionLabel[event.action] ?? event.action}</b> · {STATUS_LABEL[event.previousStatus] ?? event.previousStatus} → {STATUS_LABEL[event.nextStatus] ?? event.nextStatus}<br />{event.previousStartAt && `原时间 ${new Date(event.previousStartAt).toLocaleString("zh-CN")}；`}{event.nextStartAt && `新时间 ${new Date(event.nextStartAt).toLocaleString("zh-CN")}；`}操作人 {event.actorName || `账号 #${event.actorUserId}`}<p className="mt-1 text-olive-mute">{event.reason} · {new Date(event.createdAt).toLocaleString("zh-CN")}</p></div>)}{history.data && !history.data.length && <p className="text-[11px] text-olive-mute">暂无改期、取消或续写历史。</p>}</div>}
  </div>;
}

function SupervisionCard({ record, onEdit, onChanged }: { record: CoachingDetail["supervisions"][number]; onEdit: () => void; onChanged: () => Promise<unknown> }) {
  const linked = record.mode === "mixed";
  const editable = !linked && ["draft", "scheduled"].includes(record.status);
  return <article className="rounded-xl border border-border bg-white p-3 text-[12px]"><div className="flex flex-wrap items-center gap-2"><b className="text-olive">{new Date(record.visitAt).toLocaleString("zh-CN")}</b><span className="rounded-full bg-mint-pale px-2 py-0.5 text-[10px] text-[#0C7064]">{record.phase === "early" ? "前三个月" : "后三个月"} · {linked ? "课程穿插督学" : "直接督学"}</span><span className="text-[10.5px] text-olive-mute">{STATUS_LABEL[record.status] ?? record.status}</span></div>
    <p className="mt-2 text-olive-soft">离店验收：{record.exitCheck || "待完成"}</p><p className="mt-1 text-olive-mute">自习 {record.selfStudyMinutes} 分钟</p>
    {record.status === "cancelled" && <p className="mt-2 text-[11px] text-olive-mute">取消原因：{record.cancelReason || "未填写"}；记录只读保留。</p>}
    {linked && <p className="mt-2 rounded-lg bg-cream p-2 text-[11px] text-olive-mute">该督学属于教练课堂，请从对应课堂统一续写、改期或取消。</p>}
    {editable && <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={button} onClick={onEdit}>续写督学</button><ScheduleActions kind="supervision" id={record.id} originalAt={record.visitAt} onChanged={onChanged} /></div>}
  </article>;
}

function FeedbackBox({ data, sessionId, participant }: { data: CoachingDetail; sessionId: number; participant: CoachingDetail["sessions"][number]["participants"][number] }) {
  const utils = trpc.useUtils();
  const caseId = data.coachingCase.id;
  const [text, setText] = useState(participant.participant.feedbackText);
  const [file, setFile] = useState<File | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const [recipientUserIds, setRecipientUserIds] = useState<number[]>([data.coachingCase.studentUserId]);
  const refresh = () => utils.coaching.detail.invalidate({ caseId });
  const push = trpc.coaching.pushFeedback.useMutation({ onSuccess: refresh });
  const upload = trpc.coaching.upload.useMutation({ onSuccess: async () => { setFile(null); await refresh(); } });
  const attachments = data.deliverables.filter((row) => row.participantId === participant.participant.id && !row.disposedAt);
  const uploadFile = async () => {
    if (!file || file.size > 4 * 1024 * 1024) return;
    const mediaData = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
    upload.mutate({ caseId, sessionId, participantId: participant.participant.id, kind: file.type.startsWith("audio/") ? "audio" : "image", mediaData, mimeType: file.type });
  };
  const download = async (deliverableId: number) => {
    setDownloadError("");
    try { const file = await utils.coaching.download.fetch({ deliverableId }); await saveCoachingFile(file); } catch (error) { setDownloadError(error instanceof Error ? error.message : "下载失败"); }
  };
  return <div className="mt-4 rounded-xl border border-[#0C7064]/15 bg-mint-pale/20 p-3"><div className="flex items-center justify-between gap-2"><h4 className="text-[12.5px] font-bold text-olive">给家庭的个人反馈</h4>{participant.participant.feedbackVersion > 0 && <span className="text-[10.5px] text-[#2F7A41]">已推送 V{participant.participant.feedbackVersion}</span>}</div>
    <p className="mt-1 text-[10.5px] text-olive-mute">支持文字、录音和图片；内部备注不会推送。再次推送会收回上一批接收人对本参与记录最新反馈的读取权。</p>
    <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} placeholder="本次表现、掌握证据、家庭配合建议与下一步行动" className={`${input} mt-2`} />
    <fieldset className="mt-2 rounded-lg border border-border bg-white p-2.5"><legend className="px-1 text-[10.5px] font-semibold text-olive">本次指定接收人（必选）</legend><div className="flex flex-wrap gap-x-4 gap-y-2">{data.recipients.map((person) => <label key={person.id} className="flex min-h-9 items-center gap-1.5 text-[11px] text-olive"><input type="checkbox" className="accent-[#0C7064]" checked={recipientUserIds.includes(person.id)} onChange={() => setRecipientUserIds((old) => old.includes(person.id) ? old.filter((id) => id !== person.id) : [...old, person.id])} />{person.name ?? `账号 #${person.id}`} · {person.label}</label>)}</div></fieldset>
    <div className="mt-2 flex flex-wrap items-center gap-2"><label className="min-h-10 cursor-pointer rounded-lg border border-border bg-white px-3 py-2 text-[11px] text-olive hover:bg-cream">选择录音／图片<input type="file" accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/mp4,audio/wav,audio/webm,audio/ogg" className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><span className="text-[10.5px] text-olive-mute">{file ? `${file.name}（${(file.size / 1024 / 1024).toFixed(2)} MB）` : "单个不超过 4 MB"}</span><button type="button" disabled={!file || file.size > 4 * 1024 * 1024 || upload.isPending} onClick={uploadFile} className={button}><Upload size={13} />{upload.isPending ? "上传中…" : "上传附件"}</button><button type="button" disabled={push.isPending || !recipientUserIds.length || (!text.trim() && !attachments.length)} onClick={() => push.mutate({ participantId: participant.participant.id, feedbackText: text, recipientUserIds })} className="ml-auto min-h-10 rounded-lg bg-[#0C7064] px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-40">{push.isPending ? "推送中…" : `推送给 ${recipientUserIds.length} 人`}</button></div>
    {(upload.error || push.error || downloadError) && <p role="alert" className="mt-2 text-[11px] text-red-700">{upload.error?.message ?? push.error?.message ?? downloadError}</p>}
    {attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{attachments.map((attachment) => <button type="button" key={attachment.id} onClick={() => download(attachment.id)} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10.5px] text-olive hover:bg-cream">{attachment.kind === "audio" ? <FileAudio size={12} /> : attachment.kind === "image" ? <FileImage size={12} /> : <Download size={12} />}{attachment.kind === "feedback" ? `文字反馈 V${attachment.version}` : attachment.kind === "audio" ? "录音" : attachment.kind === "image" ? "图片" : "文字"}<Download size={11} /></button>)}</div>}
  </div>;
}
