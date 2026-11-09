import { useState } from "react";
import { ClipboardList, FileText, RotateCcw, Send, WalletCards } from "lucide-react";
import { trpc } from "@/providers/trpc";
import GrowStudentWorkspace from "@/components/org/GrowStudentWorkspace";
import AssessmentLaunch, { type LaunchPreset } from "./AssessmentLaunch";
import AssessmentActivities from "./AssessmentActivities";

const ACTIVITY_STATUS: Record<string, string> = { open: "进行中", cancelled: "已取消", expired: "已到期", completed: "已完成" };
const KIND: Record<string, string> = { mbti: "MBTI", disc: "DISC", e3: "E3 学习力", multi5: "多元智能", mentalsdq: "心理健康 A 版", mentalpa: "心理健康 B 版", scl90: "SCL-90", mental: "心理健康通用版", subject4d: "学科四维", holland: "霍兰德", anchor: "职业锚", subject: "学科能力", e3parent: "家长认知", discparent: "家长 DISC", familystudent: "家庭关系·学生", familyparent: "家庭关系·家长" };
type View = "launch" | "activities" | "reports";

export default function OrgAssessmentCenter({ onOpenReport, onOpenCoaching }: {
  onOpenReport: (studentUserId: number) => void; onOpenCoaching: (caseId: number) => void;
}) {
  const { data: wallet } = trpc.orgService.myWallet.useQuery();
  const { data: students = [] } = trpc.coach.myStudents.useQuery();
  const { data: activities = [] } = trpc.orgService.activities.useQuery();
  const [view, setView] = useState<View>("launch");
  const [retest, setRetest] = useState<LaunchPreset | null>(null);
  const [growStudent, setGrowStudent] = useState(0); const [growResult, setGrowResult] = useState<number | undefined>();
  const [growOpen, setGrowOpen] = useState(false);
  const [studentId, setStudentId] = useState(0); const [activityId, setActivityId] = useState(0);
  const [kind, setKind] = useState(""); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [status, setStatus] = useState(""); const [query, setQuery] = useState(""); const [appliedQuery, setAppliedQuery] = useState("");
  const reports = trpc.orgService.reports.useQuery({ studentUserId: studentId || undefined, activityId: activityId || undefined,
    kind: kind || undefined, from: from ? new Date(`${from}T00:00:00+08:00`) : undefined, to: to ? new Date(`${to}T23:59:59.999+08:00`) : undefined, query: appliedQuery || undefined }, { enabled: view === "reports" });
  const visibleReports = (reports.data ?? []).filter((r) => !status || r.activityStatus === status);
  const openGrow = (id: number, resultId?: number) => { setGrowStudent(id); setGrowResult(resultId); setGrowOpen(true); };
  const openReport = (id: number) => { setGrowStudent(id); onOpenReport(id); };
  const startRetest = (request: LaunchPreset) => { setRetest(request); setView("launch"); setGrowOpen(false); };
  const input = "mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-2 text-[12px] font-normal text-olive";
  return <div className="space-y-5">
    <header className="rounded-2xl border border-border bg-white px-4 pt-3 shadow-sm sm:px-5">
      <div className="flex justify-end">
        <div className="flex items-center gap-2 rounded-xl bg-mint-pale/50 px-3.5 py-2 text-[#0C7064]"><WalletCards size={17} /><div><span className="block text-[10px] text-olive-mute">我的可用积分</span><b className="mono text-[19px]">{(wallet?.balance ?? 0).toLocaleString()}</b></div></div>
      </div>
      <nav aria-label="测评中心视图" className="mt-1 flex gap-6 overflow-x-auto">{([{ key: "launch", label: "发起测评", icon: Send }, { key: "activities", label: "测评活动", icon: ClipboardList }, { key: "reports", label: "报告记录", icon: FileText }] as const).map((item) => <button type="button" key={item.key} onClick={() => { setView(item.key); setGrowOpen(false); }} className={`relative flex min-h-11 shrink-0 items-center gap-1.5 px-1 text-[12.5px] font-semibold after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full ${view === item.key ? "text-[#0C7064] after:bg-[#0C7064]" : "text-olive-mute after:bg-transparent hover:text-olive"}`}><item.icon size={15} />{item.label}</button>)}</nav>
    </header>
    {view === "launch" && <AssessmentLaunch key={retest ? `${retest.assignmentId}:${retest.studentUserId}:${retest.title}` : "new"} retest={retest} onClearRetest={() => setRetest(null)} onOpenReport={openReport} onOpenCoaching={onOpenCoaching} />}
    {view !== "launch" && (growOpen ? <GrowStudentWorkspace students={students} studentId={growStudent} resultId={growResult} onSelect={(id) => { setGrowStudent(id); setGrowResult(undefined); }} onBack={() => setGrowOpen(false)} onOpenReport={onOpenReport} onOpenCoaching={onOpenCoaching} /> : view === "activities" ? <AssessmentActivities onRetest={startRetest} onOpenGrow={openGrow} onOpenReport={openReport} /> : <section className="rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5">
      <div><h2 className="text-[17px] font-bold text-olive">报告记录与后续伴学</h2><p className="mt-1 text-[11px] text-olive-mute">报告按学员、活动、测评项归档；历史结果不会被复测覆盖。</p></div>
      <div className="mt-4 grid gap-2 rounded-xl bg-cream/45 p-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <label className="text-[11px] font-semibold text-olive">学员<select value={studentId} onChange={(e) => setStudentId(Number(e.target.value))} className={input}><option value={0}>全部学员</option>{students.map((s) => <option key={s.userId} value={s.userId}>{s.name}</option>)}</select></label>
        <label className="text-[11px] font-semibold text-olive">活动<select value={activityId} onChange={(e) => setActivityId(Number(e.target.value))} className={input}><option value={0}>全部活动</option>{activities.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
        <label className="text-[11px] font-semibold text-olive">测评项目<select value={kind} onChange={(e) => setKind(e.target.value)} className={input}><option value="">全部项目</option>{Object.entries(KIND).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
        <label className="text-[11px] font-semibold text-olive">完成开始日<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={input} /></label>
        <label className="text-[11px] font-semibold text-olive">完成截止日<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={input} /></label>
        <label className="text-[11px] font-semibold text-olive">活动状态<select value={status} onChange={(e) => setStatus(e.target.value)} className={input}><option value="">全部状态</option>{Object.entries(ACTIVITY_STATUS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setAppliedQuery(query.trim()); }}><input aria-label="搜索报告" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索学员、活动或项目" className="min-w-0 flex-1 rounded-lg border border-border bg-cream px-3 py-2 text-[12px]" /><button className="rounded-lg bg-[#0C7064] px-4 text-[12px] font-semibold text-white" type="submit">查询</button></form>
      {reports.error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-[12px] text-red-700">{reports.error.message}</p>}
      <div className="mt-4 overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[980px] text-left text-[11.5px]"><thead className="bg-cream/60 text-[10.5px] text-olive-mute"><tr><th className="px-3 py-3 font-medium">学员</th><th className="px-3 py-3 font-medium">测评项目</th><th className="px-3 py-3 font-medium">所属活动</th><th className="px-3 py-3 font-medium">完成时间</th><th className="px-3 py-3 font-medium">状态</th><th className="px-3 py-3 text-right font-medium">报告与伴学</th></tr></thead><tbody>{visibleReports.map((r) => <tr key={r.id} className="border-t border-border/70 hover:bg-mint-pale/15"><td className="px-3 py-3.5"><button type="button" onClick={() => openGrow(r.studentUserId, r.id)} className="font-semibold text-olive hover:text-[#0C7064]">{r.studentName ?? `学员 ${r.studentUserId}`}</button></td><td className="px-3 py-3.5"><b className="text-olive">{KIND[r.kind] ?? r.kind}</b><span className="mt-0.5 block text-[10px] text-olive-mute">{r.packageTitle ?? "旧版结果"}{r.durationSeconds != null ? ` · ${Math.max(1, Math.round(r.durationSeconds / 60))} 分钟` : ""}</span></td><td className="max-w-48 truncate px-3 py-3.5 text-olive-soft">{r.activityTitle ?? "历史测评"}</td><td className="whitespace-nowrap px-3 py-3.5 text-olive-mute">{new Date(r.createdAt).toLocaleString("zh-CN")}</td><td className="px-3 py-3.5"><span className="rounded-full bg-mint-pale/60 px-2 py-1 text-[10px] text-[#0C7064]">{r.source === "legacy" ? "历史结果" : (ACTIVITY_STATUS[r.activityStatus ?? ""] ?? "已出报告")}</span></td><td className="px-3 py-3.5"><div className="flex justify-end gap-1.5"><button type="button" onClick={() => openReport(r.studentUserId)} className="rounded-lg bg-[#0C7064] px-2.5 py-1.5 text-[10.5px] font-semibold text-white">查看报告</button><button type="button" onClick={() => openGrow(r.studentUserId, r.id)} className="rounded-lg border border-[#0C7064]/25 px-2.5 py-1.5 text-[10.5px] font-semibold text-[#0C7064]">纳入 GROW</button>{r.assignmentId && r.selectionKey && <button type="button" onClick={() => startRetest({ assignmentId: r.assignmentId!, studentUserId: r.studentUserId, studentName: r.studentName ?? `学员 ${r.studentUserId}`, selectionKey: r.selectionKey!, title: r.packageTitle ?? (KIND[r.kind] ?? r.kind), mode: "retest" })} className="inline-flex items-center rounded-lg border border-border px-2.5 py-1.5 text-[10.5px] text-olive"><RotateCcw size={12} className="mr-1" />复测</button>}</div></td></tr>)}{reports.isLoading && <tr><td colSpan={6} className="py-10 text-center text-olive-mute">正在读取报告记录…</td></tr>}{!reports.isLoading && !visibleReports.length && <tr><td colSpan={6} className="py-10 text-center text-olive-mute">当前筛选条件下没有可见报告。</td></tr>}</tbody></table></div>
    </section>)}
  </div>;
}
