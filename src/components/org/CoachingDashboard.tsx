import { useMemo, useState } from "react";
import { BookOpenCheck, ChevronRight, Plus, Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { COACHING_SCENARIOS, coachingScenarioLabel, shiftShanghaiDate, type CoachingScenarioKey } from "@contracts/orgService";
import { V4_BUTTON, V4_CARD, V4_PRIMARY } from "./CoachingV4";
import type { CoachingCases } from "./coachingTypes";

const STATUS: Record<string, string> = { active: "服务中", paused: "已暂停", closed: "已结课", archived: "已归档" };
const KIND: Record<string, string> = { task: "行动验收", handoff: "服务交接", quality: "质量检查", exception: "服务异常", session: "课堂交付", supervision: "督学交付", record: "过程记录", plan: "家庭会签", crisis: "危机跟进" };
const dayLabel = (value: string, today: string) => value === today ? "今天" : value === shiftShanghaiDate(today, 1) ? "明天" : new Date(`${value}T12:00:00`).toLocaleDateString("zh-CN", { weekday: "short", month: "numeric", day: "numeric" });
const timeLabel = (value: string | null) => value ? new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "待定";

export default function CoachingDashboard({ cases, students, isLoading, onOpenCase, onOpenOperations, onNewStudent, onStartIntake }: {
  cases: CoachingCases;
  students: { userId: number; name: string; grade: string | null }[];
  isLoading: boolean;
  onOpenCase: (caseId: number, kind?: string) => void;
  onOpenOperations: () => void;
  onNewStudent: (studentUserId: number) => void;
  onStartIntake: () => void;
}) {
  const { user } = useAuth();
  const [scenario, setScenario] = useState<"all" | CoachingScenarioKey>("all");
  const [newStudent, setNewStudent] = useState(0);
  const { data: operations } = trpc.coaching.operations.useQuery();
  const { data: staff = [] } = trpc.coaching.staff.useQuery();
  const { data: workloads } = trpc.coaching.staffWorkloads.useQuery(undefined, { enabled: user?.role === "admin" });
  const filtered = useMemo(() => scenario === "all" ? cases : cases.filter((row) => row.serviceScenarios.includes(scenario)), [cases, scenario]);
  const available = students.filter((student) => !cases.some((row) => row.coachingCase.studentUserId === student.userId));
  const openItems = operations?.items ?? [];
  const today = operations?.today ?? new Date().toLocaleDateString("en-CA");
  const weekEnd = shiftShanghaiDate(today, 7);
  const upcoming = [...openItems].filter((item) => item.dueAt && item.dueDate >= today && item.dueDate <= weekEnd && ["session", "supervision"].includes(item.kind)).sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt))).slice(0, 6);
  const staffName = (id: number) => staff.find((person) => person.id === id)?.name ?? `员工 #${id}`;
  const active = cases.filter((row) => row.coachingCase.status === "active").length;
  const signatures = openItems.filter((item) => item.kind === "plan").length;
  const handoffs = openItems.filter((item) => item.kind === "handoff").length;
  return <div className="space-y-4">
    <section className="rounded-2xl bg-gradient-to-r from-[#0C7064] to-[#0E8577] p-5 text-white shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="text-[11px] tracking-[.2em] text-white/60">COACHING WORKSPACE</div><h2 className="mt-1 text-[22px] font-bold">陪跑中心 · 工作台</h2><p className="mt-1 text-[12px] text-white/70">我的学员、今日待办和到店安排都在这里</p></div><button type="button" onClick={onStartIntake} className={`${V4_BUTTON} border-white bg-white text-[#0C7064] hover:bg-white/90`}><Plus size={15} />为学员建档</button></div>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4"><HeroMetric label="在读学员" value={active} unit="人" /><HeroMetric label="本周到店／交付" value={upcoming.length} unit="项" /><HeroMetric label="待三方会签" value={signatures} unit="项" /><HeroMetric label="待接收交接" value={handoffs} unit="项" warning /></div>
    </section>

    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold"><button type="button" onClick={onOpenOperations} className="rounded-full bg-[#E5EFE8] px-3 py-1 text-[#0C7064]">今日待办 {operations?.summary.today ?? 0}</button><button type="button" onClick={onOpenOperations} className="rounded-full bg-[#FAF0CC] px-3 py-1 text-[#8A6500]">已逾期 {operations?.summary.overdue ?? 0}</button><button type="button" onClick={onOpenOperations} className="rounded-full bg-[#F9E4E1] px-3 py-1 text-[#A82524]">开放风险 {operations?.summary.risks ?? 0}</button><span className="rounded-full bg-cream px-3 py-1 text-olive-mute">待会签 {signatures}</span></div>
        <div className="flex gap-1.5 overflow-x-auto pb-1"><button type="button" onClick={() => setScenario("all")} className={`min-h-9 shrink-0 rounded-full px-3 text-[11px] font-semibold ${scenario === "all" ? "bg-[#0C7064] text-white" : "bg-cream text-olive-mute"}`}>全部 {cases.length}</button>{COACHING_SCENARIOS.map((item) => <button type="button" key={item.key} onClick={() => setScenario(item.key)} className={`min-h-9 shrink-0 rounded-full px-3 text-[11px] font-semibold ${scenario === item.key ? "bg-[#0C7064] text-white" : "bg-cream text-olive-mute"}`}>{item.key} {item.shortName} {cases.filter((row) => row.serviceScenarios.includes(item.key)).length}</button>)}</div>
        {filtered.map((row, index) => {
          const own = openItems.filter((item) => item.caseId === row.coachingCase.id);
          const next = [...own].filter((item) => item.dueAt).sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)))[0];
          const elapsed = Math.max(0, Date.now() - Date.parse(`${row.coachingCase.serviceStart}T00:00:00`));
          const total = Math.max(1, Date.parse(`${row.coachingCase.serviceEnd}T00:00:00`) - Date.parse(`${row.coachingCase.serviceStart}T00:00:00`));
          const progress = Math.max(0, Math.min(100, Math.round(elapsed / total * 100)));
          return <article key={row.coachingCase.id} className={V4_CARD}>
            <div className="flex flex-wrap items-center gap-3"><span className={`flex h-11 w-11 items-center justify-center rounded-full text-[14px] font-bold ${index % 2 ? "bg-[#F5EBC9] text-[#9A7622]" : "bg-[#E5EFE8] text-[#0C7064]"}`}>{row.studentName?.slice(0, 1) ?? "学"}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-[15px] font-bold text-olive">{row.studentName}</h3><span className="text-[11px] text-olive-mute">{row.grade || "年级待补全"}</span>{row.serviceScenarios.map((key) => <span key={key} className="rounded-full bg-[#EEF1FA] px-2.5 py-0.5 text-[10px] font-semibold text-[#5265A7]">{coachingScenarioLabel(key)}</span>)}</div><p className="mt-0.5 text-[11px] text-olive-mute">{STATUS[row.coachingCase.status] ?? row.coachingCase.status} ｜ 主教：{staffName(row.coachingCase.coachId)} ｜ 督学：{staffName(row.coachingCase.supervisorId)}</p></div><div className="text-right"><div className="text-[10px] text-olive-mute">{next ? KIND[next.kind] : "下次服务"}</div><div className="text-[13px] font-bold text-olive">{next ? `${dayLabel(next.dueDate, today)} ${timeLabel(next.dueAt)}` : "暂无待办"}</div></div></div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]"><span className={`rounded-full px-2.5 py-0.5 ${row.coachingCase.goal.trim() ? "bg-[#E9F3E6] text-[#2F7A41]" : "bg-[#FAF0CC] text-[#8A6500]"}`}>{row.coachingCase.goal.trim() ? "目标已记录" : "目标待补全"}</span><span className={`rounded-full px-2.5 py-0.5 ${own.some((item) => item.kind === "plan") ? "bg-[#FAF0CC] text-[#8A6500]" : row.coachingCase.planSummary.trim() ? "bg-[#E5EFE8] text-[#0C7064]" : "bg-cream text-olive-mute"}`}>{own.some((item) => item.kind === "plan") ? "计划待家庭会签" : row.coachingCase.planSummary.trim() ? "已有计划内容" : "计划待建立"}</span><span className="ml-auto text-olive-mute">{own.length} 项待处理</span></div>
            <div className="mt-2 h-1.5 rounded-full bg-cream"><div className="h-full rounded-full bg-[#0C9B82]" style={{ width: `${progress}%` }} /></div><div className="mt-1 text-[10px] text-olive-mute">服务周期进度 {progress}%（不代表学习效果）</div>
            <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => onOpenCase(row.coachingCase.id)} className={`${V4_PRIMARY} !min-h-9 !py-1.5 text-[11px]`}>进入学员视图 <ChevronRight size={13} /></button><button type="button" onClick={() => onOpenCase(row.coachingCase.id, "session")} className={`${V4_BUTTON} !min-h-9 !py-1.5 text-[11px]`}>记到店</button>{next && <button type="button" onClick={() => onOpenCase(row.coachingCase.id, next.kind)} className={`${V4_BUTTON} !min-h-9 !py-1.5 text-[11px]`}>处理最近待办</button>}</div>
          </article>;
        })}
        {isLoading && <p className={`${V4_CARD} py-10 text-center text-[12px] text-olive-mute`}>正在读取陪跑主档…</p>}
        {!isLoading && !filtered.length && <div className={`${V4_CARD} border-dashed py-10 text-center`}><Users size={28} className="mx-auto text-olive-mute/60" /><p className="mt-2 text-[12px] text-olive-mute">{cases.length ? "当前场景下没有主档" : "还没有陪跑主档，可从下方为学员建档"}</p></div>}
        <section className={`${V4_CARD} flex flex-col gap-2 bg-[#E5EFE8]/40 sm:flex-row sm:items-center`}><div className="min-w-0 flex-1"><b className="text-[12px] text-olive">为新学员建立 GROW 主档</b><p className="mt-0.5 text-[10px] text-olive-mute">先记录真实目标、现状与计划，再进入课堂和督学</p></div><select id="coaching-new-student" aria-label="工作台选择新建陪跑学员" value={newStudent} onChange={(event) => setNewStudent(Number(event.target.value))} className="min-h-10 rounded-lg border border-border bg-white px-2.5 text-[11.5px] text-olive"><option value={0}>请选择学员</option>{available.map((student) => <option key={student.userId} value={student.userId}>{student.name} · {student.grade || "年级待补全"}</option>)}</select><button type="button" disabled={!newStudent} onClick={() => onNewStudent(newStudent)} className={V4_PRIMARY}><Plus size={13} />开始建档</button></section>
      </div>

      <aside className="space-y-3">
        <section className={V4_CARD}><div className="flex items-center gap-2"><h3 className="min-w-0 flex-1 text-[13px] font-bold text-olive">本周到店安排</h3><button type="button" onClick={onOpenOperations} className="text-[10.5px] font-semibold text-[#0C7064]">全部待办</button></div><div className="mt-3 space-y-2">{upcoming.map((item) => <button type="button" key={item.key} onClick={() => onOpenCase(item.caseId, item.kind)} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-1 text-left hover:bg-cream"><span className="rounded-full bg-[#E5EFE8] px-2 py-1 text-[10px] text-[#0C7064]">{dayLabel(item.dueDate, today)}</span><span className="min-w-0 flex-1 text-[11.5px] text-olive">{item.studentName}<span className="mt-0.5 block truncate text-[10px] text-olive-mute">{KIND[item.kind]} · {item.title}</span></span><span className="text-[10.5px] text-olive-mute">{timeLabel(item.dueAt)}</span></button>)}{!upcoming.length && <p className="rounded-xl bg-cream/50 py-7 text-center text-[11.5px] text-olive-mute">本周暂无已排期的课堂或督学</p>}</div></section>
        <section className={V4_CARD}><h3 className="text-[13px] font-bold text-olive">团队负荷</h3><div className="mt-3 space-y-3">{workloads?.staff.slice(0, 5).map((person) => { const pct = Math.min(100, Math.round(person.activeCases / Math.max(1, person.suggestedCaseLoad) * 100)); return <div key={person.userId}><div className="flex justify-between gap-2 text-[11px]"><span className="text-olive">{person.name}</span><span className="text-right text-[10px] text-olive-mute">在读 {person.activeCases} · 逾期 {person.overdueTodos}</span></div><div className="mt-1 h-1.5 rounded-full bg-cream"><div className={`h-full rounded-full ${person.overdue || person.caseOverload ? "bg-[#E3B53A]" : "bg-[#0C9B82]"}`} style={{ width: `${pct}%` }} /></div></div>; })}{!workloads && <div className="space-y-2 text-[11px]"><p className="text-olive-soft">当前账号可查看本人学员与待办；全机构人员负荷仅管理员可见。</p>{staff.slice(0, 4).map((person) => <p key={person.id} className="rounded-lg bg-cream/50 px-2.5 py-2 text-olive">{person.name}</p>)}</div>}</div><p className="mt-3 text-[10px] leading-relaxed text-olive-mute">负荷以在读人数与建议容量计算；逾期和超载会标黄，不自动改派。</p></section>
        <section className={V4_CARD}><h3 className="flex items-center gap-1.5 text-[13px] font-bold text-olive"><BookOpenCheck size={15} className="text-[#0C7064]" />知识底座 · 心路三阶</h3><div className="mt-3 space-y-2 text-[11px]"><KnowledgeRow tag="心理学" text="生命力之塔／成长地图／防御机制／依恋类型" /><KnowledgeRow tag="哲学·社会学" text="陪跑理念与关系定位" /><KnowledgeRow tag="冲突背后有礼物" text="亲子美言课底座 · 18 招小手段" /><KnowledgeRow tag="成长地图" text="九阶段：年龄段 × 心理任务 × 修复建议" /></div><p className="mt-3 rounded-lg bg-[#E5EFE8] p-2.5 text-[10.5px] leading-relaxed text-olive-soft">知识卡片在家校页预览和复制，经既有反馈／月报授权后才会推送。</p></section>
      </aside>
    </div>
  </div>;
}
function HeroMetric({ label, value, unit, warning = false }: { label: string; value: number; unit: string; warning?: boolean }) {
  return <div className={`rounded-xl p-3 ${warning ? "bg-amber-300/20" : "bg-white/10"}`}><div className={`text-[11px] ${warning ? "text-amber-100" : "text-white/70"}`}>{label}</div><div className="mt-0.5 text-[26px] font-bold tabular-nums">{value.toLocaleString()}<small className="ml-1 text-[11px] font-normal text-white/70">{unit}</small></div></div>;
}
function KnowledgeRow({ tag, text }: { tag: string; text: string }) {
  return <div className="flex items-start gap-2"><span className="shrink-0 rounded-full bg-[#E5EFE8] px-2 py-0.5 text-[9.5px] font-semibold text-[#0C7064]">{tag}</span><span className="min-w-0 flex-1 leading-relaxed text-olive-soft">{text}</span></div>;
}
