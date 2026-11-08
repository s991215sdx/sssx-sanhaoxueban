import { useEffect, useMemo, useState } from "react";
import { Archive, ArrowRightLeft, BookOpenCheck, CalendarDays, Check, ClipboardCheck, Download, FileAudio, FileImage, History, MessageSquareText, Plus, ShieldCheck, UserCheck, Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { saveCoachingFile } from "@/lib/coachingDownload";
import GrowEditor from "./GrowEditor";
import CoachingSessions from "./CoachingSessions";
import CoachingCheckins from "./CoachingCheckins";
import CoachingExceptions from "./CoachingExceptions";
import CoachingHandoffInbox from "./CoachingHandoffInbox";
import type { CoachingDetail } from "./coachingTypes";
import { COACHING_SCENARIOS, coachingScenarioLabel, type CoachingScenarioKey } from "@contracts/orgService";

const STATUS: Record<string, string> = { active: "服务中", paused: "已暂停", closed: "已结课", archived: "已归档" };
const LEVEL: Record<string, string> = { term: "学期", month: "月", week: "周", day: "日" };
const PERIOD: Record<string, string> = { day: "日复盘", week: "周复盘", month: "月复盘", term: "学期复盘" };
const KIND: Record<string, string> = { mbti: "MBTI", disc: "DISC", e3: "E3 学习力", multi5: "多元智能", mentalsdq: "心理健康 A 版", mentalpa: "心理健康 B 版", scl90: "SCL-90", mental: "心理健康通用版", subject4d: "学科四维", holland: "霍兰德", anchor: "职业锚", subject: "学科能力", e3parent: "家长认知", discparent: "家长 DISC", familystudent: "家庭关系·学生", familyparent: "家庭关系·家长" };
function today(offset = 0): string { const date = new Date(); date.setDate(date.getDate() + offset); return date.toISOString().slice(0, 10); }

export default function CoachingWorkspace({ initialCaseId }: { initialCaseId?: number }) {
  const { data: cases = [], isLoading } = trpc.coaching.cases.useQuery();
  const { data: students = [] } = trpc.coach.myStudents.useQuery();
  const [caseId, setCaseId] = useState(initialCaseId ?? 0);
  const [newStudentId, setNewStudentId] = useState(0);
  const [scenarioFilter, setScenarioFilter] = useState<"all" | CoachingScenarioKey>("all");
  const [tab, setTab] = useState<"plan" | "sessions" | "review" | "family">("plan");
  const filteredCases = useMemo(() => scenarioFilter === "all" ? cases : cases.filter((row) => row.serviceScenarios.includes(scenarioFilter)), [cases, scenarioFilter]);
  const scenarioPersonTimes = useMemo(() => cases.reduce((sum, row) => sum + row.serviceScenarios.length, 0), [cases]);
  useEffect(() => { if (initialCaseId) { setCaseId(initialCaseId); setNewStudentId(0); } }, [initialCaseId]);
  useEffect(() => {
    if (newStudentId) return;
    if (!filteredCases.length) { if (caseId) setCaseId(0); return; }
    if (!caseId || !filteredCases.some((row) => row.coachingCase.id === caseId)) setCaseId(filteredCases[0].coachingCase.id);
  }, [caseId, newStudentId, filteredCases]);
  const { data: detail, isLoading: detailLoading, error } = trpc.coaching.detail.useQuery({ caseId }, { enabled: caseId > 0 });
  const activeCase = filteredCases.find((row) => row.coachingCase.id === caseId);
  const availableStudents = useMemo(() => students.filter((s) => !cases.some((c) => c.coachingCase.studentUserId === s.userId)), [students, cases]);

  return <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
    <aside className="space-y-3 xl:sticky xl:top-4 xl:self-start">
      <section className="rounded-2xl border border-border bg-white p-3 shadow-sm">
        <h2 className="flex items-center gap-1.5 px-1 text-[14px] font-bold text-olive"><Users size={15} />陪跑主档</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center"><div className="rounded-lg bg-mint-pale/45 p-2"><b className="block text-[18px] text-olive">{cases.length}</b><span className="text-[10px] text-olive-mute">去重学员</span></div><div className="rounded-lg bg-mint-pale/45 p-2"><b className="block text-[18px] text-olive">{scenarioPersonTimes}</b><span className="text-[10px] text-olive-mute">场景人次</span></div></div>
        <label className="mt-3 block text-[11px] font-semibold text-olive">按服务场景筛选<select aria-label="按服务场景筛选" value={scenarioFilter} onChange={(e) => setScenarioFilter(e.target.value as typeof scenarioFilter)} className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-2 text-[12px] font-normal text-olive"><option value="all">全部场景 · {cases.length} 人</option>{COACHING_SCENARIOS.map((item) => <option key={item.key} value={item.key}>{item.key} {item.name} · {cases.filter((row) => row.serviceScenarios.includes(item.key)).length} 人</option>)}</select></label>
        <div className="mt-2 max-h-[420px] space-y-1 overflow-y-auto">
          {filteredCases.map((row) => <button type="button" key={row.coachingCase.id} onClick={() => { setCaseId(row.coachingCase.id); setNewStudentId(0); }} className={`w-full rounded-xl border px-3 py-2.5 text-left ${caseId === row.coachingCase.id ? "border-[#0C7064]/30 bg-mint-pale/55" : "border-transparent hover:bg-cream"}`}>
            <span className="flex items-center gap-2"><b className="min-w-0 flex-1 truncate text-[12.5px] text-olive">{row.studentName}</b><span className="text-[10px] text-olive-mute">{STATUS[row.coachingCase.status] ?? row.coachingCase.status}</span></span>
            <span className="mt-0.5 block text-[10.5px] text-olive-mute">{row.grade || "年级待补全"}</span>
            <span className="mt-1.5 flex flex-wrap gap-1">{row.serviceScenarios.length ? row.serviceScenarios.map((key) => <span key={key} className="rounded-full bg-mint-pale px-1.5 py-0.5 text-[9.5px] text-[#0C7064]">{coachingScenarioLabel(key)}</span>) : <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9.5px] text-amber-800">待设置场景</span>}</span>
          </button>)}
          {isLoading && <p className="p-4 text-center text-[12px] text-olive-mute">正在读取主档…</p>}
          {!isLoading && !cases.length && <p className="p-4 text-center text-[12px] text-olive-mute">还没有陪跑主档。</p>}
          {!isLoading && cases.length > 0 && !filteredCases.length && <p className="p-4 text-center text-[12px] text-olive-mute">当前场景没有服务中的主档。</p>}
        </div>
      </section>
      <section className="rounded-2xl border border-[#0C7064]/15 bg-mint-pale/30 p-3">
        <label className="block text-[12px] font-bold text-olive">为另一位学员建档<select value={newStudentId} onChange={(e) => { setNewStudentId(Number(e.target.value)); setCaseId(0); setTab("plan"); }} className="mt-2 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] font-normal"><option value={0}>请选择学员</option>{availableStudents.map((student) => <option key={student.userId} value={student.userId}>{student.name} · {student.grade || "年级待补全"}</option>)}</select></label>
        <p className="mt-2 text-[10.5px] leading-relaxed text-olive-mute">先保存明确目标、评估现状与定制计划，再进入课堂和督学。</p>
      </section>
    </aside>

    <div className="min-w-0 space-y-4">
      <CoachingHandoffInbox />
      {newStudentId > 0 ? <GrowEditor key={newStudentId} studentUserId={newStudentId} onOpenCoaching={(id) => { setCaseId(id); setNewStudentId(0); }} /> : activeCase ? <>
        <header className="rounded-2xl bg-[#0C7064] px-5 py-4 text-white shadow-sm">
          <div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><div className="text-[10px] tracking-[.16em] text-white/60">独立陪跑 · 学员 {activeCase.coachingCase.studentUserId}</div><h2 className="mt-1 text-[20px] font-bold">{activeCase.studentName}的学业生涯陪跑</h2><p className="mt-1 text-[11.5px] text-white/75">{activeCase.coachingCase.serviceStart} 至 {activeCase.coachingCase.serviceEnd} · {STATUS[activeCase.coachingCase.status]}</p></div><span className="rounded-full bg-white/12 px-3 py-1.5 text-[11px]">主档 V{activeCase.coachingCase.version}</span></div>
          <div className="mt-2 flex flex-wrap gap-1.5">{activeCase.serviceScenarios.length ? activeCase.serviceScenarios.map((key) => <span key={key} className="rounded-full bg-white/12 px-2.5 py-1 text-[10.5px] text-white/90">{coachingScenarioLabel(key)}</span>) : <span className="rounded-full bg-amber-100/20 px-2.5 py-1 text-[10.5px] text-amber-50">待设置服务场景</span>}</div>
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-white/10 p-1 sm:grid-cols-4">{([{ key: "plan", label: "目标与计划", icon: ClipboardCheck }, { key: "sessions", label: "到店与五课", icon: BookOpenCheck }, { key: "review", label: "复盘与交接", icon: ArrowRightLeft }, { key: "family", label: "家长反馈", icon: MessageSquareText }] as const).map((item) => <button type="button" key={item.key} onClick={() => setTab(item.key)} className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11.5px] font-semibold ${tab === item.key ? "bg-white text-[#0C7064] shadow" : "text-white/80 hover:bg-white/10"}`}><item.icon size={14} />{item.label}</button>)}</div>
        </header>
        {detailLoading && <div className="rounded-2xl border border-border bg-white p-8 text-center text-[13px] text-olive-mute">正在读取计划、课堂与反馈…</div>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-[12px] text-red-700">{error.message}</p>}
        {detail && tab === "plan" && <div className="grid items-start gap-4 2xl:grid-cols-[minmax(300px,4fr)_minmax(0,6fr)]"><GrowEditor studentUserId={detail.coachingCase.studentUserId} /><div className="space-y-4"><PlanPanel data={detail} /><TaskPanel data={detail} /></div></div>}
        {detail && tab === "sessions" && <CoachingSessions data={detail} />}
        {detail && tab === "review" && <ReviewWorkspace data={detail} />}
        {detail && tab === "family" && <GuardianPanel data={detail} />}
      </> : !isLoading && <div className="rounded-2xl border border-dashed border-border bg-white/50 p-12 text-center"><Users className="mx-auto text-olive-mute" size={30} /><h2 className="mt-3 text-[16px] font-bold text-olive">{cases.length && !filteredCases.length ? "当前筛选没有对应主档" : "选择主档，或先为学员建立 GROW 方案"}</h2><p className="mt-2 text-[12px] text-olive-mute">课堂、督学、验收、复盘和家校反馈都会归入同一个学员主档。</p></div>}
    </div>
  </div>;
}

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border bg-white p-4 shadow-sm"><h3 className="flex items-center gap-1.5 text-[15px] font-bold text-olive">{icon}{title}</h3><div className="mt-3">{children}</div></section>;
}
function MutationMessage({ error, success }: { error?: { message: string } | null; success?: boolean }) {
  return <>{error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] text-red-700">{error.message}</p>}{success && <p className="mt-2 text-[11px] text-[#2F7A41]">已保存并同步刷新。</p>}</>;
}
const input = "mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-2 text-[12px] font-normal text-olive outline-none focus:border-[#0C7064]";
const label = "text-[11.5px] font-semibold text-olive";
const primary = "min-h-10 rounded-xl bg-[#0C7064] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#095C53] disabled:opacity-40";

function PlanPanel({ data }: { data: CoachingDetail }) {
  const utils = trpc.useUtils();
  const [level, setLevel] = useState<"term" | "month" | "week" | "day">("week");
  const [title, setTitle] = useState("本周行动计划");
  const [content, setContent] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today(7));
  const [parentId, setParentId] = useState(0);
  const [sourceResultId, setSourceResultId] = useState(0);
  const [confirmed, setConfirmed] = useState(true);
  const save = trpc.coaching.savePlan.useMutation({ onSuccess: async () => { setContent(""); await utils.coaching.detail.invalidate({ caseId: data.coachingCase.id }); } });
  const changeLevel = (value: typeof level) => { setLevel(value); setTitle(`${LEVEL[value]}陪跑计划`); setEndDate(today(value === "day" ? 0 : value === "week" ? 7 : value === "month" ? 30 : 180)); };
  return <Panel title="学期／月／周／日计划版本" icon={<CalendarDays size={16} />}>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><label className={label}>层级<select value={level} onChange={(e) => changeLevel(e.target.value as typeof level)} className={input}>{Object.entries(LEVEL).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label className={label}>计划名称<input value={title} onChange={(e) => setTitle(e.target.value)} className={input} /></label><label className={label}>开始<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={input} /></label><label className={label}>结束<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={input} /></label></div>
    <div className="mt-2 grid gap-2 sm:grid-cols-2"><label className={label}>上级计划（可选）<select value={parentId} onChange={(e) => setParentId(Number(e.target.value))} className={input}><option value={0}>不关联</option>{data.plans.map((p) => <option key={p.id} value={p.id}>{LEVEL[p.level]} · {p.title} V{p.version}</option>)}</select></label><label className={label}>来源测评（可选）<select value={sourceResultId} onChange={(e) => setSourceResultId(Number(e.target.value))} className={input}><option value={0}>不关联</option>{data.results.map((r) => <option key={r.id} value={r.id}>{KIND[r.kind] ?? r.kind} · {new Date(r.createdAt).toLocaleDateString("zh-CN")}</option>)}</select></label></div>
    <textarea aria-label="计划内容" value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="写清目标、频率、责任人、验证证据与复盘时间；每次保存生成新版本，不覆盖历史。" className={`${input} mt-2 resize-y`} />
    <div className="mt-2 flex flex-wrap items-center gap-3"><label className="flex items-center gap-1.5 text-[11.5px] text-olive"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="accent-[#0C7064]" />确认执行（否则保存为内部草稿）</label><button type="button" disabled={save.isPending || title.trim().length < 2 || content.trim().length < 2 || endDate < startDate} onClick={() => save.mutate({ caseId: data.coachingCase.id, level, parentId: parentId || null, title, content, startDate, endDate, sourceResultId: sourceResultId || null, confirmed })} className={`${primary} ml-auto`}>{save.isPending ? "保存中…" : "保存新计划版本"}</button></div>
    <MutationMessage error={save.error} success={save.isSuccess} />
    <div className="mt-4 space-y-2">{data.plans.map((p) => <details key={p.id} className="rounded-xl border border-border bg-cream/45 p-3"><summary className="cursor-pointer text-[12px] font-semibold text-olive">{LEVEL[p.level]} · {p.title} <span className="font-normal text-olive-mute">V{p.version} · {p.status === "confirmed" ? "已确认" : "草稿"} · {p.startDate}～{p.endDate}</span></summary><p className="mt-2 whitespace-pre-wrap text-[11.5px] leading-relaxed text-olive-soft">{p.content}</p>{p.sourceResultId && <p className="mt-2 text-[10.5px] text-[#0C7064]">来源测评：{KIND[data.results.find((r) => r.id === p.sourceResultId)?.kind ?? ""] ?? `结果 #${p.sourceResultId}`}</p>}</details>)}</div>
  </Panel>;
}

function TaskPanel({ data }: { data: CoachingDetail }) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState(""); const [detail, setDetail] = useState(""); const [dueDate, setDueDate] = useState(today(7)); const [planId, setPlanId] = useState(0);
  const add = trpc.coaching.addTask.useMutation({ onSuccess: async () => { setTitle(""); setDetail(""); await utils.coaching.detail.invalidate({ caseId: data.coachingCase.id }); } });
  return <Panel title="行动任务与证据验收" icon={<ClipboardCheck size={16} />}>
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]"><input aria-label="行动标题" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：连续三天完成错题三刷并能讲解" className={input} /><input aria-label="行动期限" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={input} /></div>
    <textarea aria-label="行动标准" value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} placeholder="完成标准、证据形式与家庭配合方式" className={`${input} mt-2`} />
    <div className="mt-2 flex gap-2"><select aria-label="关联计划" value={planId} onChange={(e) => setPlanId(Number(e.target.value))} className={input}><option value={0}>不关联计划</option>{data.plans.filter((p) => p.status === "confirmed").map((p) => <option key={p.id} value={p.id}>{p.title} V{p.version}</option>)}</select><button type="button" disabled={add.isPending || title.trim().length < 2 || !dueDate} onClick={() => add.mutate({ caseId: data.coachingCase.id, planId: planId || null, title, detail: detail || undefined, dueDate })} className={`${primary} shrink-0`}><Plus size={14} className="mr-1 inline" />创建行动</button></div>
    <MutationMessage error={add.error} success={add.isSuccess} />
    <div className="mt-4 space-y-2">{data.tasks.map((task) => <TaskCard key={task.id} data={data} task={task} />)}</div>
  </Panel>;
}
function TaskCard({ data, task }: { data: CoachingDetail; task: CoachingDetail["tasks"][number] }) {
  const utils = trpc.useUtils(); const [evidence, setEvidence] = useState(""); const [result, setResult] = useState("");
  const history = data.verificationHistory.filter((v) => v.taskId === task.id);
  const latestVersion = history.reduce((max, v) => Math.max(max, v.version), 0);
  const verify = trpc.coaching.verifyTask.useMutation({ onSuccess: async () => { setEvidence(""); setResult(""); await utils.coaching.detail.invalidate({ caseId: data.coachingCase.id }); } });
  return <article className="rounded-xl border border-border bg-cream/40 p-3">
    <div className="flex flex-wrap items-center gap-2"><b className="min-w-0 flex-1 text-[12.5px] text-olive">{task.title}</b><span className={`rounded-full px-2 py-0.5 text-[10px] ${task.status === "verified" ? "bg-mint-pale text-[#0C7064]" : "bg-butter-pale text-olive"}`}>{task.status === "verified" ? "已验收" : `截止 ${task.dueDate}`}</span></div>
    {task.detail && <p className="mt-1 whitespace-pre-wrap text-[11.5px] text-olive-mute">{task.detail}</p>}
    {task.status === "verified" && <div className="mt-2 space-y-2">
      {history.length ? history.map((v) => <details key={v.id} open={v.version === latestVersion} className="rounded-lg bg-white p-2.5 text-[11.5px] leading-relaxed text-olive-soft"><summary className="cursor-pointer font-semibold text-olive">验收 V{v.version}{v.version === 1 ? " · 首次验收" : " · 补录／更正"}<span className="ml-2 text-[10px] font-normal text-olive-mute">{new Date(v.createdAt).toLocaleString("zh-CN")}</span></summary><p className="mt-2 whitespace-pre-wrap"><b>证据：</b>{v.evidence}</p><p className="mt-1 whitespace-pre-wrap"><b>结果：</b>{v.result}</p></details>) : <div className="rounded-lg bg-white p-2.5 text-[11.5px] leading-relaxed text-olive-soft"><p><b>首次证据：</b>{task.evidence}</p><p className="mt-1"><b>首次结果：</b>{task.result}</p></div>}
    </div>}
    <div className="mt-2 grid gap-2 sm:grid-cols-2"><textarea aria-label={task.status === "verified" ? "补录或更正证据" : "行动证据"} value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={2} placeholder={task.status === "verified" ? "补充新证据或说明更正依据；不覆盖首次记录" : "实际作品、输出或行为证据"} className={input} /><textarea aria-label={task.status === "verified" ? "补录或更正结果" : "验收结果"} value={result} onChange={(e) => setResult(e.target.value)} rows={2} placeholder="掌握程度、未达标处及后续补位" className={input} /><button type="button" disabled={verify.isPending || evidence.trim().length < 2 || result.trim().length < 2} onClick={() => verify.mutate({ taskId: task.id, evidence, result })} className={`${primary} sm:col-span-2`}><Check size={14} className="mr-1 inline" />{task.status === "verified" ? `提交补录／更正，生成 V${latestVersion + 1}` : "确认证据并验收"}</button></div>
    <MutationMessage error={verify.error} success={verify.isSuccess} />
  </article>;
}

function ReviewWorkspace({ data }: { data: CoachingDetail }) {
  return <div className="space-y-4"><CoachingCheckins data={data} /><CoachingExceptions data={data} /><div className="grid items-start gap-4 2xl:grid-cols-2"><div className="space-y-4"><ReviewPanel data={data} /><HandoffPanel data={data} /></div><div className="space-y-4"><StatusPanel data={data} /><Panel title="主档事件时间线" icon={<History size={16} />}><div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">{data.events.map((event) => <div key={event.id} className="border-l-2 border-[#0C7064]/20 pl-3 text-[11.5px]"><time className="text-[10px] text-olive-mute">{new Date(event.createdAt).toLocaleString("zh-CN")}</time><p className="mt-0.5 whitespace-pre-wrap leading-relaxed text-olive-soft">{event.content}</p></div>)}</div></Panel></div></div></div>;
}
function ReviewPanel({ data }: { data: CoachingDetail }) {
  const utils = trpc.useUtils(); const [period, setPeriod] = useState<"day" | "week" | "month" | "term">("week"); const [periodKey, setPeriodKey] = useState(today().slice(0, 7)); const [content, setContent] = useState(""); const [nextActions, setNextActions] = useState("");
  const save = trpc.coaching.addReview.useMutation({ onSuccess: async () => { setContent(""); setNextActions(""); await utils.coaching.detail.invalidate({ caseId: data.coachingCase.id }); } });
  return <Panel title="日／周／月／学期复盘" icon={<History size={16} />}><div className="grid grid-cols-2 gap-2"><label className={label}>复盘周期<select value={period} onChange={(e) => { const value = e.target.value as typeof period; setPeriod(value); setPeriodKey(value === "month" || value === "term" ? today().slice(0, 7) : today()); }} className={input}>{Object.entries(PERIOD).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label className={label}>周期标识<input value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} placeholder="例：2026-W45" className={input} /></label></div><textarea aria-label="复盘内容" value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="目标完成事实、行动证据、问题根因与需要调整的服务方式" className={`${input} mt-2`} /><textarea aria-label="下一步行动" value={nextActions} onChange={(e) => setNextActions(e.target.value)} rows={2} placeholder="下一步行动、责任人与验证时间" className={`${input} mt-2`} /><button type="button" disabled={save.isPending || periodKey.trim().length < 2 || content.trim().length < 2 || nextActions.trim().length < 2} onClick={() => save.mutate({ caseId: data.coachingCase.id, period, periodKey, content, nextActions })} className={`${primary} mt-2 w-full`}>保存复盘新版本</button><MutationMessage error={save.error} success={save.isSuccess} /><div className="mt-3 space-y-2">{data.reviews.map((r) => <details key={r.id} className="rounded-lg bg-cream/50 p-2.5 text-[11.5px]"><summary className="cursor-pointer font-semibold text-olive">{PERIOD[r.period]} · {r.periodKey} V{r.version}</summary><p className="mt-2 whitespace-pre-wrap text-olive-soft">{r.content}</p><p className="mt-2 whitespace-pre-wrap text-[#0C7064]">下一步：{r.nextActions}</p></details>)}</div></Panel>;
}
function HandoffPanel({ data }: { data: CoachingDetail }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: tutors = [] } = trpc.coaching.staff.useQuery();
  const [type, setType] = useState<"H1" | "H2" | "H3" | "H4">("H2");
  const [toUserId, setToUserId] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [dueAt, setDueAt] = useState("");
  const statusLabel: Record<string, string> = { pending: "待接收", accepted: "已接收", cancelled: "已取消", closed: "已办结" };
  const refresh = () => utils.coaching.detail.invalidate({ caseId: data.coachingCase.id });
  const add = trpc.coaching.addHandoff.useMutation({ onSuccess: async () => { setTitle(""); setContent(""); await refresh(); } });
  const accept = trpc.coaching.acceptHandoff.useMutation({ onSuccess: async () => {
    await Promise.all([refresh(), utils.coaching.cases.invalidate(), utils.coaching.incoming.invalidate()]);
  } });
  return <Panel title="H1—H4 服务交接" icon={<ArrowRightLeft size={16} />}>
    <p className="mb-3 rounded-lg bg-mint-pale/35 px-3 py-2 text-[10.5px] leading-relaxed text-olive-soft">普通交接由指定接收人确认；H5 人员改派须由管理员在右侧发起，不能在这里手工创建。</p>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className={label}>类型<select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={input}>{["H1", "H2", "H3", "H4"].map((key) => <option key={key}>{key}</option>)}</select></label>
      <label className={label}>接收伴学师<select value={toUserId} onChange={(e) => setToUserId(Number(e.target.value))} className={input}><option value={0}>请选择</option>{tutors.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label className={label}>标题<input value={title} onChange={(e) => setTitle(e.target.value)} className={input} /></label>
      <label className={label}>办理期限（可选）<input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={input} /></label>
    </div>
    <textarea aria-label="交接内容" value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="事实、风险、待办、责任边界和必须保留的服务节奏" className={`${input} mt-2`} />
    <button type="button" disabled={add.isPending || !toUserId || title.trim().length < 2 || content.trim().length < 2} onClick={() => add.mutate({ caseId: data.coachingCase.id, type, toUserId, title, content, dueAt: dueAt ? new Date(dueAt) : null })} className={`${primary} mt-2 w-full`}>发起普通交接</button>
    <MutationMessage error={add.error ?? accept.error} success={add.isSuccess || accept.isSuccess} />
    <div className="mt-3 space-y-2">{data.handoffs.map((h) => <article key={h.id} className="rounded-xl border border-border bg-cream/45 p-3 text-[11.5px]">
      <div className="flex flex-wrap items-center gap-2"><b className="min-w-0 flex-1 break-words text-olive">{h.type} · {h.title}</b><span className={`rounded-full px-2 py-0.5 text-[10px] ${h.status === "pending" ? "bg-amber-50 text-amber-800" : h.status === "cancelled" ? "bg-gray-100 text-gray-600" : "bg-mint-pale text-[#0C7064]"}`}>{statusLabel[h.status] ?? h.status}</span></div>
      <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-olive-soft">{h.content}</p>
      {h.type === "H5" && h.status === "pending" && <p className="mt-2 text-[10.5px] text-amber-800">待新督学接收，当前负责人尚未变更。</p>}
      {h.toUserId === user?.id && h.status === "pending" && <button type="button" disabled={accept.isPending} onClick={() => accept.mutate({ handoffId: h.id })} className="mt-2 min-h-9 rounded-lg border border-[#0C7064]/25 px-2.5 py-1.5 text-[11px] font-semibold text-[#0C7064]"><UserCheck size={13} className="mr-1 inline" />{h.type === "H5" ? "接收并使改派生效" : "确认接收"}</button>}
    </article>)}</div>
  </Panel>;
}
function StatusPanel({ data }: { data: CoachingDetail }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: tutors = [] } = trpc.coaching.staff.useQuery();
  const [status, setStatus] = useState<"active" | "paused" | "closed" | "archived">("paused");
  const [reason, setReason] = useState("");
  const [coachId, setCoachId] = useState(data.coachingCase.coachId);
  const [supervisorId, setSupervisorId] = useState(data.coachingCase.supervisorId);
  const [assignReason, setAssignReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  useEffect(() => {
    setCoachId(data.coachingCase.coachId);
    setSupervisorId(data.coachingCase.supervisorId);
    setAssignReason("");
    setCancelReason("");
  }, [data.coachingCase.id, data.coachingCase.coachId, data.coachingCase.supervisorId]);
  const pendingReassignment = data.handoffs.find((h) => h.type === "H5" && h.status === "pending");
  const staffName = (id: number | null | undefined) => tutors.find((t) => t.id === id)?.name ?? (id ? `员工 #${id}` : "未设置");
  const refresh = async () => {
    await Promise.all([
      utils.coaching.detail.invalidate({ caseId: data.coachingCase.id }),
      utils.coaching.cases.invalidate(),
      utils.coaching.incoming.invalidate(),
    ]);
  };
  const change = trpc.coaching.setStatus.useMutation({ onSuccess: async () => { setReason(""); await refresh(); } });
  const reassign = trpc.coaching.reassign.useMutation({ onSuccess: async () => { setAssignReason(""); await refresh(); } });
  const cancel = trpc.coaching.cancelReassignment.useMutation({ onSuccess: async () => { setCancelReason(""); await refresh(); } });
  const closureBlocked = status === "closed" && !data.closureReadiness.ready;
  const sameAssignment = coachId === data.coachingCase.coachId && supervisorId === data.coachingCase.supervisorId;
  return <Panel title="暂停恢复、结课归档与人员改派" icon={<Archive size={16} />}>
    <section aria-label="结课完整性检查" className="rounded-xl border border-border bg-cream/40 p-3">
      <div className="flex flex-wrap items-center gap-2"><h4 className="min-w-0 flex-1 text-[12.5px] font-bold text-olive">结课完整性检查</h4><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${data.closureReadiness.ready ? "bg-mint-pale text-[#0C7064]" : "bg-amber-50 text-amber-800"}`}>{data.closureReadiness.ready ? "已具备结课条件" : `还有 ${data.closureReadiness.blockers.length} 类待办`}</span></div>
      <div className="mt-2 space-y-1.5">{data.closureReadiness.checks.map((check) => <div key={check.code} className={`flex items-start gap-2 rounded-lg px-2.5 py-2 text-[11px] leading-relaxed ${check.ok ? "bg-white text-olive-soft" : "bg-amber-50/70 text-amber-900"}`}>
        {check.ok ? <Check size={14} className="mt-0.5 shrink-0 text-[#0C7064]" /> : <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[9px] font-bold">!</span>}
        <span className="min-w-0 flex-1">{check.label}{!check.ok && <b className="ml-1 font-semibold">{check.count > 0 ? `（${check.count} 项待处理）` : "（尚未完成）"}</b>}</span>
      </div>)}</div>
      {!data.closureReadiness.ready && <p className="mt-2 text-[10.5px] leading-relaxed text-amber-800">请逐项补齐：{data.closureReadiness.blockers.map((item) => item.label).join("；")}。服务端提交时会按同一规则再次检查。</p>}
    </section>
    <div className="mt-3 grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)]">
      <select aria-label="主档状态" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={input}><option value="active">恢复服务</option><option value="paused">暂停</option><option value="closed">结课</option>{user?.role === "admin" && <option value="archived">归档</option>}</select>
      <input aria-label="状态变更原因" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="状态变更原因与后续安排" className={input} />
      <button type="button" disabled={change.isPending || reason.trim().length < 2 || closureBlocked} onClick={() => change.mutate({ caseId: data.coachingCase.id, status, reason })} className={`${primary} sm:col-span-2`}>{status === "closed" ? closureBlocked ? "补齐结课清单后才能结课" : "确认结课" : "确认状态变更"}</button>
    </div>
    <MutationMessage error={change.error} success={change.isSuccess} />
    {user?.role === "admin" && <div className="mt-4 border-t border-border pt-3">
      <h4 className="text-[12.5px] font-bold text-olive">管理员改派</h4>
      <p className="mt-1 text-[10.5px] leading-relaxed text-olive-mute">发起只生成 H5 待接收记录，不立即换负责人；新督学接收后才同时更新主教与督学安排。</p>
      {pendingReassignment && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
        <div className="flex flex-wrap items-center gap-2"><b className="min-w-0 flex-1 text-[12px] text-amber-950">H5 改派 #{pendingReassignment.id} · 待新督学接收</b><span className="text-[10px] text-amber-800">负责人尚未变更</span></div>
        <p className="mt-2 text-[11px] leading-relaxed text-amber-900">原安排：{staffName(pendingReassignment.fromCoachId)}（主教）／{staffName(pendingReassignment.fromSupervisorId)}（督学）<br />新安排：{staffName(pendingReassignment.nextCoachId)}（主教）／{staffName(pendingReassignment.nextSupervisorId)}（督学）</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-[11px] text-amber-900">改派原因：{pendingReassignment.content}</p>
        <label className={`${label} mt-3 block`}>取消原因<textarea aria-label="取消改派原因" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} placeholder="说明为何取消本次待接收改派" className={input} /></label>
        <button type="button" disabled={cancel.isPending || cancelReason.trim().length < 2} onClick={() => cancel.mutate({ handoffId: pendingReassignment.id, reason: cancelReason })} className="mt-2 min-h-10 w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-[11.5px] font-semibold text-amber-900 disabled:opacity-40">取消待接收改派，保留原负责人</button>
        {cancel.isSuccess && <p className="mt-2 text-[11px] text-[#2F7A41]">改派已取消，原负责人保持不变。</p>}
      </div>}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className={label}>新主教伴学师<select value={coachId} disabled={Boolean(pendingReassignment)} onChange={(e) => setCoachId(Number(e.target.value))} className={input}>{tutors.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className={label}>新督学负责人<select value={supervisorId} disabled={Boolean(pendingReassignment)} onChange={(e) => setSupervisorId(Number(e.target.value))} className={input}>{tutors.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      </div>
      <textarea aria-label="改派原因" value={assignReason} disabled={Boolean(pendingReassignment)} onChange={(e) => setAssignReason(e.target.value)} rows={2} placeholder="改派原因、服务连续性与必须交接的事项" className={`${input} mt-2`} />
      <button type="button" disabled={reassign.isPending || Boolean(pendingReassignment) || sameAssignment || !coachId || !supervisorId || assignReason.trim().length < 2} onClick={() => reassign.mutate({ caseId: data.coachingCase.id, coachId, supervisorId, reason: assignReason })} className={`${primary} mt-2 w-full`}>{pendingReassignment ? "已有改派待接收" : "发起改派，待新督学接收"}</button>
      {reassign.isSuccess && !pendingReassignment && <p className="mt-2 text-[11px] text-[#2F7A41]">改派已发起，等待新督学接收。</p>}
      <MutationMessage error={reassign.error ?? cancel.error} />
    </div>}
  </Panel>;
}

function GuardianPanel({ data }: { data: CoachingDetail }) {
  const utils = trpc.useUtils(); const [phone, setPhone] = useState(""); const [guardianUserId, setGuardianUserId] = useState(0); const [relation, setRelation] = useState("妈妈"); const [downloadError, setDownloadError] = useState("");
  const lookup = trpc.coaching.lookupGuardian.useQuery({ phone }, { enabled: /^1\d{10}$/.test(phone), retry: false });
  const refresh = () => utils.coaching.detail.invalidate({ caseId: data.coachingCase.id });
  const grant = trpc.coaching.grantGuardian.useMutation({ onSuccess: async () => { setPhone(""); setGuardianUserId(0); await refresh(); } }); const revoke = trpc.coaching.revokeGuardian.useMutation({ onSuccess: refresh });
  const download = async (deliverableId: number) => { setDownloadError(""); try { const file = await utils.coaching.download.fetch({ deliverableId }); await saveCoachingFile(file); } catch (error) { setDownloadError(error instanceof Error ? error.message : "下载失败"); } };
  const pushed = data.sessions.flatMap((session) => session.participants.filter((p) => p.participant.feedbackVersion > 0).map((p) => ({ session, participant: p.participant })));
  return <div className="grid items-start gap-4 2xl:grid-cols-2"><Panel title="逐位监护人授权" icon={<ShieldCheck size={16} />}><p className="text-[11.5px] leading-relaxed text-olive-mute">父母或其他监护人须各有独立账号。只开放已推送的公开目标、计划、课堂反馈与附件，不开放内部备注和心理原始答案。</p><div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px]"><label className={label}>监护人手机号<input value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 11)); setGuardianUserId(0); }} placeholder="输入已注册的 11 位手机号" className={input} /></label><label className={label}>身份<input value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="妈妈" className={input} /></label></div>{/^1\d{10}$/.test(phone) && <div className="mt-2 rounded-lg bg-cream/60 p-2.5">{lookup.isLoading ? <p className="text-[11px] text-olive-mute">正在查询…</p> : lookup.data?.length ? <label className={label}>选择账号<select value={guardianUserId} onChange={(e) => setGuardianUserId(Number(e.target.value))} className={input}><option value={0}>请选择</option>{lookup.data.map((g) => <option key={g.id} value={g.id}>{g.name} · {g.phone}</option>)}</select></label> : <p className="text-[11px] text-olive-mute">未找到本机构或尚未归属机构的有效学员账号，请先为监护人注册。</p>}</div>}<button type="button" disabled={grant.isPending || !guardianUserId || !relation.trim()} onClick={() => grant.mutate({ caseId: data.coachingCase.id, guardianUserId, label: relation })} className={`${primary} mt-2 w-full`}>授权该监护人</button><MutationMessage error={grant.error ?? revoke.error ?? lookup.error} success={grant.isSuccess || revoke.isSuccess} /><div className="mt-3 space-y-2">{data.guardians.map((g) => <div key={g.grant.id} className="flex items-center gap-2 rounded-lg border border-border bg-cream/45 px-3 py-2 text-[12px]"><span className="min-w-0 flex-1 text-olive"><b>{g.name}</b><span className="ml-2 text-olive-mute">{g.grant.label}</span></span><span className={`text-[10px] ${g.grant.active ? "text-[#2F7A41]" : "text-olive-mute"}`}>{g.grant.active ? "已授权" : "已撤销"}</span>{g.grant.active && <button type="button" disabled={revoke.isPending} onClick={() => revoke.mutate({ grantId: g.grant.id })} className="rounded-lg border border-red-200 px-2 py-1 text-[10.5px] text-red-700">撤销</button>}</div>)}</div></Panel><Panel title="已推送反馈与附件记录" icon={<MessageSquareText size={16} />}><div className="space-y-2">{pushed.map(({ session, participant }) => <article key={participant.id} className="rounded-xl border border-border bg-cream/45 p-3"><div className="text-[11px] text-olive-mute">{new Date(session.startAt).toLocaleString("zh-CN")} · 反馈 V{participant.feedbackVersion}</div><p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-olive-soft">{participant.feedbackText || "本次以录音／图片反馈"}</p></article>)}{!pushed.length && <p className="py-6 text-center text-[12px] text-olive-mute">尚未正式推送课堂反馈。</p>}</div><div className="mt-3 flex flex-wrap gap-2">{data.deliverables.filter((d) => d.visibility === "family" && d.pushedAt).map((file) => <button type="button" key={file.id} onClick={() => download(file.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-2 text-[11px] text-olive hover:bg-cream">{file.kind === "audio" ? <FileAudio size={14} /> : file.kind === "image" ? <FileImage size={14} /> : <Download size={14} />}{file.kind === "feedback" ? `文字反馈 V${file.version}` : file.kind === "audio" ? "录音" : file.kind === "image" ? "图片" : "文字"}<Download size={12} /></button>)}</div>{downloadError && <p role="alert" className="mt-2 text-[11px] text-red-700">{downloadError}</p>}<p className="mt-4 rounded-lg bg-mint-pale/35 p-3 text-[11px] leading-relaxed text-olive-soft">附件下载会再次验证身份与授权；撤销监护人后，新的下载请求立即失效。</p></Panel></div>;
}
