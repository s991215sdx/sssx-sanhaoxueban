import { useMemo, useState } from "react";
import { ArrowRight, BellRing, CalendarClock, CheckCircle2, ChevronRight, ClipboardList, Plus, Settings2, UserRoundCheck, Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { COACHING_SCENARIOS, coachingScenarioLabel, type CoachingScenarioKey } from "@contracts/orgService";
import type { CoachingCases } from "./coachingTypes";

const STATUS: Record<string, string> = { active: "服务中", paused: "已暂停", closed: "已结课", archived: "已归档" };
const KIND: Record<string, string> = { task: "行动验收", handoff: "服务交接", quality: "质量检查", exception: "服务异常", session: "课堂交付", supervision: "督学交付", record: "过程记录", plan: "家庭会签", crisis: "危机跟进" };

export default function CoachingDashboard({ cases, students, isLoading, onOpenCase, onOpenOperations, onNewStudent }: {
  cases: CoachingCases;
  students: { userId: number; name: string; grade: string | null }[];
  isLoading: boolean;
  onOpenCase: (caseId: number, kind?: string) => void;
  onOpenOperations: () => void;
  onNewStudent: (studentUserId: number) => void;
}) {
  const [scenario, setScenario] = useState<"all" | CoachingScenarioKey>("all");
  const [newStudent, setNewStudent] = useState(0);
  const { data: operations } = trpc.coaching.operations.useQuery();
  const { data: staff = [] } = trpc.coaching.staff.useQuery();
  const filtered = useMemo(() => scenario === "all" ? cases : cases.filter((row) => row.serviceScenarios.includes(scenario)), [cases, scenario]);
  const available = students.filter((student) => !cases.some((row) => row.coachingCase.studentUserId === student.userId));
  const openItems = operations?.items ?? [];
  const upcoming = [...openItems].filter((item) => item.dueAt).sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt))).slice(0, 4);
  const staffName = (id: number) => staff.find((person) => person.id === id)?.name ?? `员工 #${id}`;
  const active = cases.filter((row) => row.coachingCase.status === "active").length;
  return <div className="space-y-5">
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <Metric label="名下学员" value={cases.length} unit="人" icon={<Users size={16} />} />
      <Metric label="今日待办" value={operations?.summary.today ?? 0} unit="项" icon={<CalendarClock size={16} />} />
      <Metric label="近 7 天交付" value={operations?.summary.upcoming ?? 0} unit="项" icon={<ClipboardList size={16} />} />
      <Metric label="开放风险" value={operations?.summary.risks ?? 0} unit="项" icon={<BellRing size={16} />} />
      <Metric label="服务中主档" value={active} unit="人" icon={<CheckCircle2 size={16} />} />
    </section>
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className="min-w-0 rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-2"><div className="min-w-0 flex-1"><h2 className="text-[17px] font-bold text-olive">学员陪跑主档</h2><p className="mt-1 text-[11px] text-olive-mute">从学员进入目标、计划、课堂、验收与家庭反馈</p></div><button type="button" onClick={onOpenOperations} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#0C7064]/25 px-3 text-[11px] font-semibold text-[#0C7064]"><Settings2 size={13} />运营与交接</button></div>
        <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1"><button type="button" onClick={() => setScenario("all")} className={`min-h-9 shrink-0 rounded-full px-3 text-[11px] font-semibold ${scenario === "all" ? "bg-[#0C7064] text-white" : "bg-cream text-olive-mute"}`}>全部 {cases.length}</button>{COACHING_SCENARIOS.map((item) => <button type="button" key={item.key} onClick={() => setScenario(item.key)} className={`min-h-9 shrink-0 rounded-full px-3 text-[11px] font-semibold ${scenario === item.key ? "bg-[#0C7064] text-white" : "bg-cream text-olive-mute"}`}>{item.key} {item.shortName} {cases.filter((row) => row.serviceScenarios.includes(item.key)).length}</button>)}</div>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[780px] text-left text-[12px]"><thead className="border-b border-border text-[10.5px] text-olive-mute"><tr><th className="py-3 font-medium">学员／场景</th><th className="py-3 font-medium">服务阶段</th><th className="py-3 font-medium">待办执行</th><th className="py-3 font-medium">下次交付</th><th className="py-3 font-medium">主责</th><th className="py-3 text-right font-medium">操作</th></tr></thead><tbody>{filtered.map((row) => {
          const own = openItems.filter((item) => item.caseId === row.coachingCase.id);
          const next = [...own].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
          return <tr key={row.coachingCase.id} className="border-b border-border/60 last:border-0 hover:bg-cream/25"><td className="py-4"><div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-mint-pale text-[12px] font-bold text-[#0C7064]">{row.studentName?.slice(0, 1) ?? "学"}</span><div><button type="button" onClick={() => onOpenCase(row.coachingCase.id)} className="font-semibold text-olive hover:text-[#0C7064]">{row.studentName}<span className="ml-1.5 font-normal text-olive-mute">· {row.grade || "年级待补全"}</span></button><div className="mt-1 flex flex-wrap gap-1">{row.serviceScenarios.length ? row.serviceScenarios.map((key) => <span key={key} className="rounded-full bg-cream px-1.5 py-0.5 text-[9.5px] text-olive-mute">{coachingScenarioLabel(key)}</span>) : <span className="text-[9.5px] text-amber-800">待设置场景</span>}</div></div></div></td><td className="py-4"><span className="font-semibold text-[#0C7064]">{STATUS[row.coachingCase.status] ?? row.coachingCase.status}</span><span className="mt-1 block text-[10px] text-olive-mute">主档 V{row.coachingCase.version}</span></td><td className="py-4"><b className="mono text-olive">{own.length}</b><span className="ml-1 text-olive-mute">项待处理</span>{own.some((item) => operations && item.dueDate < operations.today) && <span className="mt-1 block text-[10px] text-amber-800">含逾期事项</span>}</td><td className="py-4 text-olive-soft">{next ? <><span>{next.dueDate}</span><span className="mt-1 block max-w-40 truncate text-[10px] text-olive-mute">{KIND[next.kind]} · {next.title}</span></> : "暂无待办"}</td><td className="py-4 text-olive-soft">{staffName(row.coachingCase.coachId)}</td><td className="py-4 text-right"><button type="button" onClick={() => onOpenCase(row.coachingCase.id, next?.kind)} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#0C7064] px-3 text-[11px] font-semibold text-[#0C7064] hover:bg-mint-pale">进入陪跑<ChevronRight size={13} /></button></td></tr>;
        })}</tbody></table></div>
        {isLoading && <p className="py-10 text-center text-[12px] text-olive-mute">正在读取陪跑主档…</p>}
        {!isLoading && !filtered.length && <div className="rounded-xl border border-dashed border-border py-10 text-center"><Users size={28} className="mx-auto text-olive-mute/60" /><p className="mt-2 text-[12px] text-olive-mute">{cases.length ? "当前场景下没有主档" : "还没有陪跑主档，可从下方为学员建档"}</p></div>}
        <div className="mt-4 flex flex-col gap-2 rounded-xl bg-mint-pale/30 p-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><b className="text-[12px] text-olive">为新学员建立 GROW 主档</b><p className="mt-0.5 text-[10px] text-olive-mute">先记录真实目标、现状与计划，再进入课堂和督学</p></div><select aria-label="选择新建陪跑学员" value={newStudent} onChange={(event) => setNewStudent(Number(event.target.value))} className="min-h-10 rounded-lg border border-border bg-white px-2.5 text-[11.5px] text-olive"><option value={0}>请选择学员</option>{available.map((student) => <option key={student.userId} value={student.userId}>{student.name} · {student.grade || "年级待补全"}</option>)}</select><button type="button" disabled={!newStudent} onClick={() => onNewStudent(newStudent)} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg bg-[#0C7064] px-3 text-[11px] font-semibold text-white disabled:opacity-40"><Plus size={13} />开始建档</button></div>
      </section>
      <aside className="space-y-4">
        <section className="rounded-2xl border border-border bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><h2 className="min-w-0 flex-1 text-[16px] font-bold text-olive">近期服务节拍</h2><button type="button" onClick={onOpenOperations} className="text-[10.5px] font-semibold text-[#0C7064]">全部待办</button></div><div className="mt-4 space-y-0">{upcoming.map((item, index) => <button type="button" key={item.key} onClick={() => onOpenCase(item.caseId, item.kind)} className="relative flex w-full gap-3 pb-5 text-left last:pb-0"><span className="relative flex w-3 shrink-0 justify-center"><span className="z-10 mt-1 h-2.5 w-2.5 rounded-full bg-[#0C9B82]" />{index < upcoming.length - 1 && <span className="absolute bottom-[-4px] top-3 w-px bg-[#0C7064]/15" />}</span><span className="min-w-0 flex-1"><span className="text-[10px] text-olive-mute">{item.dueDate} · {KIND[item.kind]}</span><b className="mt-0.5 block text-[12px] text-olive">{item.studentName}</b><span className="mt-0.5 block text-[10.5px] leading-relaxed text-olive-mute">{item.title}</span></span><ArrowRight size={13} className="mt-1 shrink-0 text-olive-mute" /></button>)}{!upcoming.length && <p className="rounded-xl bg-cream/50 py-7 text-center text-[11.5px] text-olive-mute">当前没有近期交付待办</p>}</div></section>
        <section className="rounded-2xl border border-border bg-white p-5 shadow-sm"><h2 className="flex items-center gap-1.5 text-[15px] font-bold text-olive"><UserRoundCheck size={16} className="text-[#0C7064]" />教练—督学协同</h2><div className="mt-3 space-y-2 text-[11px]"><p><b className="mr-3 text-[#5265A7]">陪跑教练</b><span className="text-olive-mute">定方向 · 规划课 · 阶段修订</span></p><p><b className="mr-3 text-[#0C7064]">督学师</b><span className="text-olive-mute">抓落实 · 日检验 · 周月复盘</span></p></div><div className="mt-4 rounded-xl bg-mint-pale/35 p-3 text-[10.5px] leading-relaxed text-olive-soft">同一学员、同一档案；内部异常与敏感记录不向家长、学生公开。</div></section>
      </aside>
    </div>
  </div>;
}
function Metric({ label, value, unit, icon }: { label: string; value: number; unit: string; icon: React.ReactNode }) {
  return <div className="rounded-2xl border border-border bg-white p-4 shadow-sm"><div className="flex items-center gap-1.5 text-[11px] text-olive-mute">{icon}{label}</div><div className="mono mt-2 text-[25px] font-bold text-[#0C7064]">{value.toLocaleString()}<small className="ml-1.5 text-[11px] font-normal text-olive-mute">{unit}</small></div></div>;
}
