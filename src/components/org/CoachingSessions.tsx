import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, CheckCircle2, Download, FileAudio, FileImage, Plus, Save, Trash2, Upload, UserPlus, Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { phaseForVisit } from "@contracts/orgService";
import { saveCoachingFile } from "@/lib/coachingDownload";
import type { CoachingDetail } from "./coachingTypes";
import { invalidateCoachingOperations } from "./coachingRefresh";

const FORMAT_LABEL: Record<string, string> = { one_to_one: "一对一", salon: "小组沙龙", workshop: "学习坊", mixed: "混合小组", supervision: "纯督学" };
const ATTENDANCE_LABEL: Record<string, string> = { present: "出席", late: "迟到", absent: "缺席", leave: "请假" };

type Unit = { courseKey: string; lessonNo: number | null; title: string; learningPoints: string; practiceEvidence: string };
type Participant = { studentUserId: number; guardianLabel: string; attendance: "present" | "late" | "absent" | "leave"; personalObservation: string; privateNote: string; feedbackText: string; actionTitle: string; actionDetail: string; dueDate: string };

function localDateTime(date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function dateAfter(days: number): string {
  const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10);
}

export default function CoachingSessions({ data }: { data: CoachingDetail }) {
  const utils = trpc.useUtils();
  const caseId = data.coachingCase.id;
  const { data: cases = [] } = trpc.coaching.cases.useQuery();
  const [mode, setMode] = useState<"session" | "supervision">("session");
  const [startAt, setStartAt] = useState(localDateTime());
  const [format, setFormat] = useState<"one_to_one" | "salon" | "workshop" | "mixed">("one_to_one");
  const [status, setStatus] = useState<"draft" | "completed">("completed");
  const [changeReason, setChangeReason] = useState("");
  const [lateChangeConfirmed, setLateChangeConfirmed] = useState(false);
  const [sharedSummary, setSharedSummary] = useState("");
  const [supervision, setSupervision] = useState({ selfStudyMinutes: 60, alignment: "", checks: "", exitCheck: "", followUp: "" });
  const [units, setUnits] = useState<Unit[]>([{ courseKey: "mindset", lessonNo: null, title: "心法课·心智成长", learningPoints: "", practiceEvidence: "" }]);
  const mainParticipant = useMemo<Participant>(() => ({ studentUserId: data.coachingCase.studentUserId, guardianLabel: "", attendance: "present", personalObservation: "", privateNote: "", feedbackText: "", actionTitle: "", actionDetail: "", dueDate: dateAfter(7) }), [data.coachingCase.studentUserId]);
  const [participants, setParticipants] = useState<Participant[]>([mainParticipant]);
  const [addingStudent, setAddingStudent] = useState(0);
  const phase = phaseForVisit(data.coachingCase.serviceStart, new Date(startAt));
  const early = phase === "early";
  const groupFormat = format !== "one_to_one";
  const refresh = async () => { await Promise.all([utils.coaching.detail.invalidate({ caseId }), utils.coaching.cases.invalidate(), invalidateCoachingOperations(utils)]); };
  const saveSession = trpc.coaching.saveSession.useMutation({ onSuccess: async () => {
    setSharedSummary(""); setSupervision({ selfStudyMinutes: 60, alignment: "", checks: "", exitCheck: "", followUp: "" });
    setUnits([{ courseKey: "mindset", lessonNo: null, title: "心法课·心智成长", learningPoints: "", practiceEvidence: "" }]);
    setParticipants([mainParticipant]); setLateChangeConfirmed(false); setChangeReason("");
    await refresh();
  } });
  const saveSupervision = trpc.coaching.saveSupervision.useMutation({ onSuccess: async () => {
    setSupervision({ selfStudyMinutes: 60, alignment: "", checks: "", exitCheck: "", followUp: "" }); await refresh();
  } });

  useEffect(() => {
    if (early) { setFormat("one_to_one"); setParticipants([mainParticipant]); }
  }, [early, mainParticipant]);

  const availableStudents = cases.filter((c) => !participants.some((p) => p.studentUserId === c.coachingCase.studentUserId));
  const updateUnit = (index: number, patch: Partial<Unit>) => setUnits((old) => old.map((unit, i) => i === index ? { ...unit, ...patch } : unit));
  const updateParticipant = (index: number, patch: Partial<Participant>) => setParticipants((old) => old.map((p, i) => i === index ? { ...p, ...patch } : p));
  const save = () => {
    const visit = new Date(startAt);
    if (mode === "supervision") {
      saveSupervision.mutate({ caseId, visitAt: visit, status, ...supervision });
      return;
    }
    saveSession.mutate({ caseId, startAt: visit, format, status, changeReason: changeReason || undefined, lateChangeConfirmed,
      sharedSummary, supervision,
      units: units.map((u) => ({ ...u, lessonNo: u.courseKey === "method" ? u.lessonNo : null })),
      participants: participants.map((p) => ({ studentUserId: p.studentUserId, guardianLabel: p.guardianLabel || undefined, attendance: p.attendance,
        personalObservation: p.personalObservation || undefined, privateNote: p.privateNote || undefined, feedbackText: p.feedbackText || undefined,
        action: p.actionTitle.trim() ? { title: p.actionTitle, detail: p.actionDetail || undefined, dueDate: p.dueDate } : undefined })) });
  };
  const saving = saveSession.isPending || saveSupervision.isPending;
  const error = saveSession.error?.message ?? saveSupervision.error?.message;

  return <div className="space-y-5">
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{data.catalog.map((course) => <div key={course.id} className="rounded-xl border border-[#0C7064]/15 bg-white p-3">
      <div className="text-[13px] font-bold text-olive">{course.title}</div><div className="mt-0.5 text-[11px] font-semibold text-[#0C7064]">{course.audience} · {course.purpose}</div><p className="mt-1 text-[10.5px] leading-relaxed text-olive-mute">{course.description}</p><p className="mt-1.5 text-[10px] leading-relaxed text-olive-soft">{course.rhythm}</p>
      {course.courseKey === "method" && <details className="mt-2 text-[10.5px] text-olive-soft"><summary className="cursor-pointer font-semibold text-[#0C7064]">查看十二次技法大纲</summary><ol className="mt-1 list-decimal space-y-1 pl-4">{course.outline.map((raw, index) => { const item = raw as { title?: string; content?: string }; return <li key={index}><b>{item.title}</b><span className="block text-olive-mute">{item.content}</span></li>; })}</ol></details>}
    </div>)}</section>

    <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div><h2 className="text-[16px] font-bold text-olive">记录本次到店</h2><p className={`mt-1 text-[11px] ${early ? "text-olive-mute" : "text-[#0C7064]"}`}>{early ? "前三个月：每次均为一对一教练课＋督学" : "后三个月：可评估继续一对一或改小组沙龙／学习坊，督学必有"}</p></div>
        <div className="ml-auto flex rounded-lg bg-cream p-1"><button type="button" onClick={() => setMode("session")} className={`rounded-md px-3 py-1.5 text-[11.5px] font-semibold ${mode === "session" ? "bg-[#0C7064] text-white" : "text-olive"}`}>教练课＋督学</button><button type="button" onClick={() => setMode("supervision")} disabled={early} title={early ? "前三个月不能纯督学" : "后三个月可纯督学"} className={`rounded-md px-3 py-1.5 text-[11.5px] font-semibold disabled:opacity-40 ${mode === "supervision" ? "bg-[#0C7064] text-white" : "text-olive"}`}>纯督学</button></div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[11.5px] font-semibold text-olive">到店时间<input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-2 font-normal outline-none focus:border-[#0C7064]" /></label>
        <label className="text-[11.5px] font-semibold text-olive">记录状态<select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-2 font-normal"><option value="completed">已完成</option><option value="draft">签到草稿</option></select></label>
        {mode === "session" && <label className="text-[11.5px] font-semibold text-olive">课堂形式<select value={format} disabled={early} onChange={(e) => setFormat(e.target.value as typeof format)} className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-2 font-normal disabled:opacity-60"><option value="one_to_one">一对一</option><option value="salon">小组沙龙</option><option value="workshop">学习坊</option><option value="mixed">混合小组</option></select></label>}
        <label className="text-[11.5px] font-semibold text-olive">自习督学（分钟）<input type="number" min={0} max={1440} value={supervision.selfStudyMinutes} onChange={(e) => setSupervision((s) => ({ ...s, selfStudyMinutes: Number(e.target.value) }))} className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-2 font-normal" /></label>
      </div>
      {!early && groupFormat && mode === "session" && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><label className="block text-[11.5px] font-semibold text-olive">形式变更原因（必填）<input value={changeReason} onChange={(e) => setChangeReason(e.target.value)} maxLength={500} placeholder="例：已具备小组协作与自主学习能力，经阶段评估进入学习坊。" className="mt-1 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 font-normal" /></label><label className="mt-2 flex cursor-pointer items-center gap-2 text-[11.5px] text-olive"><input type="checkbox" checked={lateChangeConfirmed} onChange={(e) => setLateChangeConfirmed(e.target.checked)} className="accent-[#0C7064]" />我已完成阶段评估，并确认本次形式调整</label></div>}

      {mode === "session" && <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between"><h3 className="text-[13px] font-bold text-olive">教练内容单元 <span className="font-normal text-olive-mute">可穿插 1～5 个</span></h3><button type="button" disabled={units.length >= 5} onClick={() => setUnits((old) => [...old, { courseKey: "method", lessonNo: 1, title: "技法课·综合测评与立志", learningPoints: "", practiceEvidence: "" }])} className="inline-flex items-center gap-1 rounded-lg border border-[#0C7064]/25 px-2.5 py-1.5 text-[11px] font-semibold text-[#0C7064] hover:bg-mint-pale disabled:opacity-40"><Plus size={13} />添加内容</button></div>
        {units.map((unit, index) => <div key={index} className="rounded-xl border border-border bg-cream/50 p-3">
          <div className="grid gap-2 sm:grid-cols-[160px_130px_minmax(0,1fr)_auto]">
            <select aria-label="课程类型" value={unit.courseKey} onChange={(e) => { const courseKey = e.target.value; const course = data.catalog.find((c) => c.courseKey === courseKey); updateUnit(index, { courseKey, title: `${course?.title ?? "课程"}·${course?.purpose ?? "课堂"}`, lessonNo: courseKey === "method" ? 1 : null }); }} className="rounded-lg border border-border bg-white px-2.5 py-2 text-[12px]">{data.catalog.filter((c) => c.courseKey !== "supervision").map((c) => <option key={c.id} value={c.courseKey}>{c.title} · {c.purpose}</option>)}</select>
            {unit.courseKey === "method" ? <select aria-label="技法课节次" value={unit.lessonNo ?? 1} onChange={(e) => { const lessonNo = Number(e.target.value); const outline = data.catalog.find((c) => c.courseKey === "method")?.outline as { lessonNo: number; title: string }[] | undefined; const lesson = outline?.find((o) => o.lessonNo === lessonNo); updateUnit(index, { lessonNo, title: `技法课·${lesson?.title ?? `第 ${lessonNo} 次`}` }); }} className="rounded-lg border border-border bg-white px-2.5 py-2 text-[12px]">{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>第 {i + 1} 次</option>)}</select> : <span className="flex items-center px-2 text-[11px] text-olive-mute">按学员实际需要</span>}
            <input aria-label="内容单元标题" value={unit.title} onChange={(e) => updateUnit(index, { title: e.target.value })} className="rounded-lg border border-border bg-white px-2.5 py-2 text-[12px]" />
            <button type="button" aria-label="删除内容单元" disabled={units.length === 1} onClick={() => setUnits((old) => old.filter((_, i) => i !== index))} className="rounded-lg p-2 text-olive-mute hover:bg-red-50 hover:text-red-700 disabled:opacity-30"><Trash2 size={15} /></button>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2"><textarea aria-label="学习要点" value={unit.learningPoints} onChange={(e) => updateUnit(index, { learningPoints: e.target.value })} rows={2} placeholder="学习要点：孩子理解了什么、能复述什么" className="rounded-lg border border-border bg-white px-2.5 py-2 text-[12px]" /><textarea aria-label="现场练习证据" value={unit.practiceEvidence} onChange={(e) => updateUnit(index, { practiceEvidence: e.target.value })} rows={2} placeholder="现场练习证据：作品、讲解、限时任务或行为观察" className="rounded-lg border border-border bg-white px-2.5 py-2 text-[12px]" /></div>
        </div>)}
        <label className="block text-[11.5px] font-semibold text-olive">共享课堂总结<textarea value={sharedSummary} onChange={(e) => setSharedSummary(e.target.value)} rows={3} placeholder="本次目标、课堂过程、共同结论与后续衔接" className="mt-1 w-full rounded-lg border border-border bg-cream px-3 py-2 font-normal" /></label>
      </div>}

      <div className="mt-4 rounded-xl border border-[#0C7064]/20 bg-mint-pale/25 p-3">
        <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-olive"><CheckCircle2 size={15} className="text-[#0C7064]" />督学主线（每次必填）</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2"><textarea value={supervision.alignment} onChange={(e) => setSupervision((s) => ({ ...s, alignment: e.target.value }))} rows={2} placeholder="任务对齐：本次要完成什么、标准是什么" className="rounded-lg border border-border bg-white px-2.5 py-2 text-[12px]" /><textarea value={supervision.checks} onChange={(e) => setSupervision((s) => ({ ...s, checks: e.target.value }))} rows={2} placeholder="过程检查：自习巡查、费曼输出、补位记录" className="rounded-lg border border-border bg-white px-2.5 py-2 text-[12px]" /><textarea value={supervision.exitCheck} onChange={(e) => setSupervision((s) => ({ ...s, exitCheck: e.target.value }))} rows={2} placeholder="离店验收：用什么证据证明掌握，而不只是签到" className="rounded-lg border border-border bg-white px-2.5 py-2 text-[12px]" /><textarea value={supervision.followUp} onChange={(e) => setSupervision((s) => ({ ...s, followUp: e.target.value }))} rows={2} placeholder="后续补位：未完成项、责任人与期限" className="rounded-lg border border-border bg-white px-2.5 py-2 text-[12px]" /></div>
      </div>

      {mode === "session" && <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2"><h3 className="flex items-center gap-1.5 text-[13px] font-bold text-olive"><Users size={15} />参与学员与个人行动</h3>{!early && groupFormat && <div className="ml-auto flex gap-2"><select aria-label="选择要加入的小组成员" value={addingStudent} onChange={(e) => setAddingStudent(Number(e.target.value))} className="rounded-lg border border-border bg-cream px-2 py-1.5 text-[11px]"><option value={0}>选择有陪跑主档的学员</option>{availableStudents.map((c) => <option key={c.coachingCase.id} value={c.coachingCase.studentUserId}>{c.studentName}</option>)}</select><button type="button" disabled={!addingStudent} onClick={() => { if (!addingStudent) return; setParticipants((old) => [...old, { ...mainParticipant, studentUserId: addingStudent }]); setAddingStudent(0); }} className="inline-flex items-center gap-1 rounded-lg border border-[#0C7064]/25 px-2 py-1.5 text-[11px] text-[#0C7064] disabled:opacity-40"><UserPlus size={13} />加入</button></div>}</div>
        {participants.map((participant, index) => { const student = cases.find((c) => c.coachingCase.studentUserId === participant.studentUserId); return <div key={participant.studentUserId} className="rounded-xl border border-border bg-cream/40 p-3">
          <div className="flex flex-wrap items-center gap-2"><span className="text-[13px] font-bold text-olive">{student?.studentName ?? `学员 ${participant.studentUserId}`}</span><select aria-label="出勤状态" value={participant.attendance} onChange={(e) => updateParticipant(index, { attendance: e.target.value as Participant["attendance"] })} className="rounded-lg border border-border bg-white px-2 py-1 text-[11px]">{Object.entries(ATTENDANCE_LABEL).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><label className="text-[11px] text-olive-mute">监护人身份（亲子美言课必填）<input value={participant.guardianLabel} onChange={(e) => updateParticipant(index, { guardianLabel: e.target.value })} placeholder="例：妈妈" className="ml-1 rounded-lg border border-border bg-white px-2 py-1 text-olive" /></label>{index > 0 && <button type="button" onClick={() => setParticipants((old) => old.filter((_, i) => i !== index))} className="ml-auto rounded-lg p-1.5 text-olive-mute hover:text-red-700" aria-label="移出小组成员"><Trash2 size={14} /></button>}</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2"><textarea value={participant.personalObservation} onChange={(e) => updateParticipant(index, { personalObservation: e.target.value })} rows={2} placeholder="该学员个人观察（仅本学员主档可见）" className="rounded-lg border border-border bg-white px-2.5 py-2 text-[12px]" /><textarea value={participant.privateNote} onChange={(e) => updateParticipant(index, { privateNote: e.target.value })} rows={2} placeholder="内部备注（不推送给家长）" className="rounded-lg border border-border bg-white px-2.5 py-2 text-[12px]" /></div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]"><input value={participant.actionTitle} onChange={(e) => updateParticipant(index, { actionTitle: e.target.value })} placeholder="课后可验证行动，例：三天内完成两张错题三刷卡" className="rounded-lg border border-border bg-white px-2.5 py-2 text-[12px]" /><input aria-label="行动完成期限" type="date" value={participant.dueDate} onChange={(e) => updateParticipant(index, { dueDate: e.target.value })} className="rounded-lg border border-border bg-white px-2.5 py-2 text-[12px]" /></div>
          <textarea value={participant.actionDetail} onChange={(e) => updateParticipant(index, { actionDetail: e.target.value })} rows={1} placeholder="行动标准与验收方式" className="mt-2 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px]" />
          <textarea value={participant.feedbackText} onChange={(e) => updateParticipant(index, { feedbackText: e.target.value })} rows={2} placeholder="给这位学员家长的反馈草稿；保存后可在下方课堂记录中上传录音／图片并正式推送" className="mt-2 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px]" />
        </div>; })}
      </div>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>}
      <div className="mt-4 flex items-center gap-3"><button type="button" onClick={save} disabled={saving || !startAt} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#0C7064] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#095C53] disabled:opacity-40"><Save size={15} />{saving ? "正在保存…" : mode === "session" ? "保存课堂与逐生督学" : "保存到店督学"}</button>{(saveSession.isSuccess || saveSupervision.isSuccess) && <span className="text-[11px] text-[#2F7A41]">已保存，行动任务与交接记录同步生成。</span>}</div>
    </section>

    <section className="space-y-3"><h2 className="text-[16px] font-bold text-olive">课堂、反馈与附件</h2>{data.sessions.map((session) => <SessionCard key={session.id} data={data} session={session} />)}{!data.sessions.length && <p className="rounded-xl border border-dashed border-border py-6 text-center text-[12px] text-olive-mute">还没有课堂记录。</p>}</section>
    <section className="space-y-3"><h2 className="text-[16px] font-bold text-olive">到店督学记录</h2><div className="grid gap-2 lg:grid-cols-2">{data.supervisions.map((record) => <div key={record.id} className="rounded-xl border border-border bg-white p-3 text-[12px]"><div className="flex items-center gap-2"><b className="text-olive">{new Date(record.visitAt).toLocaleString("zh-CN")}</b><span className="rounded-full bg-mint-pale px-2 py-0.5 text-[10px] text-[#0C7064]">{record.phase === "early" ? "前三个月" : "后三个月"} · {record.mode === "mixed" ? "课程穿插督学" : "直接督学"}</span></div><p className="mt-2 text-olive-soft">离店验收：{record.exitCheck || "待完成"}</p><p className="mt-1 text-olive-mute">自习 {record.selfStudyMinutes} 分钟 · {record.status === "completed" ? "已完成" : "草稿"}</p></div>)}</div>{!data.supervisions.length && <p className="rounded-xl border border-dashed border-border py-6 text-center text-[12px] text-olive-mute">还没有督学记录。</p>}</section>
  </div>;
}

function SessionCard({ data, session }: { data: CoachingDetail; session: CoachingDetail["sessions"][number] }) {
  const participant = session.participants[0];
  return <article className="rounded-2xl border border-border bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center gap-2"><BookOpenCheck size={17} className="text-[#0C7064]" /><h3 className="text-[14px] font-bold text-olive">{new Date(session.startAt).toLocaleString("zh-CN")}</h3><span className="rounded-full bg-mint-pale px-2 py-0.5 text-[10.5px] text-[#0C7064]">{FORMAT_LABEL[session.format] ?? session.format}</span><span className="text-[10.5px] text-olive-mute">{session.phase === "early" ? "前三个月" : "后三个月"} · {session.status === "completed" ? "已完成" : "草稿"}</span></div>
    <div className="mt-3 space-y-2">{session.units.map((unit) => <div key={unit.id} className="rounded-lg bg-cream/60 p-3"><div className="text-[12.5px] font-semibold text-olive">{unit.title}{unit.lessonNo ? `（第 ${unit.lessonNo} 次）` : ""}</div><p className="mt-1 text-[11.5px] text-olive-soft">学习要点：{unit.learningPoints || "待补充"}</p><p className="mt-0.5 text-[11.5px] text-olive-mute">现场证据：{unit.practiceEvidence || "待补充"}</p></div>)}</div>
    {session.sharedSummary && <p className="mt-3 text-[12px] leading-relaxed text-olive-soft"><b className="text-olive">课堂总结：</b>{session.sharedSummary}</p>}
    {session.changeReason && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">形式变更：{session.changeReason}</p>}
    {participant ? <FeedbackBox data={data} sessionId={session.id} participant={participant} /> : <p className="mt-3 text-[11px] text-olive-mute">本学员参与记录待补充。</p>}
  </article>;
}

function FeedbackBox({ data, sessionId, participant }: { data: CoachingDetail; sessionId: number; participant: CoachingDetail["sessions"][number]["participants"][number] }) {
  const utils = trpc.useUtils();
  const caseId = data.coachingCase.id;
  const [text, setText] = useState(participant.participant.feedbackText);
  const [file, setFile] = useState<File | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const refresh = () => utils.coaching.detail.invalidate({ caseId });
  const push = trpc.coaching.pushFeedback.useMutation({ onSuccess: refresh });
  const upload = trpc.coaching.upload.useMutation({ onSuccess: async () => { setFile(null); await refresh(); } });
  const attachments = data.deliverables.filter((d) => d.participantId === participant.participant.id);
  const uploadFile = async () => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return;
    const mediaData = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
    upload.mutate({ caseId, sessionId, participantId: participant.participant.id, kind: file.type.startsWith("audio/") ? "audio" : "image", mediaData, mimeType: file.type });
  };
  const download = async (deliverableId: number) => {
    setDownloadError("");
    try { const file = await utils.coaching.download.fetch({ deliverableId }); await saveCoachingFile(file); } catch (error) { setDownloadError(error instanceof Error ? error.message : "下载失败"); }
  };
  return <div className="mt-4 rounded-xl border border-[#0C7064]/15 bg-mint-pale/20 p-3">
    <div className="flex items-center justify-between gap-2"><h4 className="text-[12.5px] font-bold text-olive">给家长的个人反馈</h4>{participant.participant.feedbackVersion > 0 && <span className="text-[10.5px] text-[#2F7A41]">已推送 V{participant.participant.feedbackVersion}</span>}</div>
    <p className="mt-1 text-[10.5px] text-olive-mute">支持文字、录音和图片；内部备注不会推送。每次推送生成新版本，历史记录保留。</p>
    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="本次表现、掌握证据、家庭配合建议与下一步行动" className="mt-2 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px]" />
    <div className="mt-2 flex flex-wrap items-center gap-2"><label className="cursor-pointer rounded-lg border border-border bg-white px-3 py-2 text-[11px] text-olive hover:bg-cream">选择录音／图片<input type="file" accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/mp4,audio/wav,audio/webm,audio/ogg" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label><span className="text-[10.5px] text-olive-mute">{file ? `${file.name}（${(file.size / 1024 / 1024).toFixed(2)} MB）` : "单个不超过 4 MB"}</span><button type="button" disabled={!file || file.size > 4 * 1024 * 1024 || upload.isPending} onClick={uploadFile} className="inline-flex items-center gap-1 rounded-lg border border-[#0C7064]/25 px-2.5 py-1.5 text-[11px] text-[#0C7064] disabled:opacity-40"><Upload size={13} />{upload.isPending ? "上传中…" : "上传附件"}</button><button type="button" disabled={push.isPending || (!text.trim() && !attachments.length)} onClick={() => push.mutate({ participantId: participant.participant.id, feedbackText: text })} className="ml-auto rounded-lg bg-[#0C7064] px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-40">{push.isPending ? "推送中…" : "正式推送家长"}</button></div>
    {(upload.error || push.error || downloadError) && <p role="alert" className="mt-2 text-[11px] text-red-700">{upload.error?.message ?? push.error?.message ?? downloadError}</p>}
    {attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{attachments.map((attachment) => <button type="button" key={attachment.id} onClick={() => download(attachment.id)} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10.5px] text-olive hover:bg-cream">{attachment.kind === "audio" ? <FileAudio size={12} /> : attachment.kind === "image" ? <FileImage size={12} /> : <Download size={12} />}{attachment.kind === "feedback" ? `文字反馈 V${attachment.version}` : attachment.kind === "audio" ? "录音" : attachment.kind === "image" ? "图片" : "文字"}<Download size={11} /></button>)}</div>}
  </div>;
}
