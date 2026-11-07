import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpenCheck, Check, ChevronDown, CircleDollarSign, ClipboardList, FileText, Info, RotateCcw, Search, Send, Users, X, XCircle } from "lucide-react";
import { trpc } from "@/providers/trpc";
import GrowEditor from "@/components/org/GrowEditor";
import { createRequestKey } from "@/lib/requestKey";
import type { AssessmentSelection } from "@contracts/orgService";

const STATUS: Record<string, string> = { pending: "待开始", in_progress: "作答中", completed: "已完成", cancelled: "已取消", expired: "已过期" };
const ACTIVITY_STATUS: Record<string, string> = { open: "进行中", cancelled: "已取消", expired: "已到期", completed: "已完成" };
const KIND: Record<string, string> = { mbti: "MBTI", disc: "DISC", e3: "E3 学习力", multi5: "多元智能", mentalsdq: "心理健康 A 版", mentalpa: "心理健康 B 版", scl90: "SCL-90", mental: "心理健康通用版", subject4d: "学科四维", holland: "霍兰德", anchor: "职业锚", subject: "学科能力", e3parent: "家长认知", discparent: "家长 DISC", familystudent: "家庭关系·学生", familyparent: "家庭关系·家长" };
type View = "launch" | "activities" | "reports";

export default function OrgAssessmentCenter({ onOpenReport, onOpenCoaching }: {
  onOpenReport: (studentUserId: number) => void;
  onOpenCoaching: (caseId: number) => void;
}) {
  const utils = trpc.useUtils();
  const { data: students = [], isLoading: studentsLoading } = trpc.coach.myStudents.useQuery();
  const { data: catalog, isLoading: catalogLoading } = trpc.orgService.catalog.useQuery();
  const { data: wallet } = trpc.orgService.myWallet.useQuery();
  const { data: activities = [], isLoading: activitiesLoading } = trpc.orgService.activities.useQuery();
  const [view, setView] = useState<View>("launch");
  const [studentIds, setStudentIds] = useState<number[]>([]);
  const [activeStudentId, setActiveStudentId] = useState<number>(0);
  const [selections, setSelections] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("伴学测评");
  const [dueDate, setDueDate] = useState("");
  const [expiryPolicy, setExpiryPolicy] = useState<"auto_refund" | "manual_review">("auto_refund");
  const [note, setNote] = useState("");
  const [confirmFees, setConfirmFees] = useState(false);
  const [info, setInfo] = useState<AssessmentSelection | null>(null);
  const [retest, setRetest] = useState<{ assignmentId: number; studentName: string; title: string } | null>(null);
  const [expandedActivity, setExpandedActivity] = useState<number | null>(null);
  const [reportStudent, setReportStudent] = useState(0);
  const [reportActivity, setReportActivity] = useState(0);
  const [reportKind, setReportKind] = useState("");
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportStatus, setReportStatus] = useState("");
  const [reportQuery, setReportQuery] = useState("");
  const [appliedReportQuery, setAppliedReportQuery] = useState("");
  const requestKey = useRef<string | null>(null);

  useEffect(() => {
    if (!activeStudentId && students.length) setActiveStudentId(students[0]!.userId);
  }, [students, activeStudentId]);

  const options = useMemo(() => [...(catalog?.packages ?? []), ...(catalog?.singles ?? [])], [catalog]);
  const selectedOptions = options.filter((item) => selections.includes(item.key));
  const duplicate = useMemo(() => {
    const seen = new Set<string>();
    for (const item of selectedOptions) {
      for (const kind of item.kinds) {
        if (seen.has(kind)) return `${item.title}与其他已选项包含重复测评`;
        seen.add(kind);
      }
    }
    return "";
  }, [selectedOptions]);
  const total = selectedOptions.reduce((sum, item) => sum + item.price, 0) * studentIds.length;
  const grades = useMemo(() => [...new Set(students.map((s) => s.grade).filter((v): v is string => !!v))].sort(), [students]);
  const filteredStudents = students.filter((s) => (!grade || s.grade === grade) && (!query.trim() || s.name.includes(query.trim()) || (s.phone ?? "").includes(query.trim())));
  const filteredOptions = options.filter((item) => !category || item.category === category);
  const visibleSelected = filteredStudents.filter((s) => studentIds.includes(s.userId)).length;
  const reports = trpc.orgService.reports.useQuery({
    studentUserId: reportStudent || undefined,
    activityId: reportActivity || undefined,
    kind: reportKind || undefined,
    from: reportFrom ? new Date(`${reportFrom}T00:00:00`) : undefined,
    to: reportTo ? new Date(`${reportTo}T23:59:59.999`) : undefined,
    query: appliedReportQuery || undefined,
  }, { enabled: view === "reports" });
  const visibleReports = (reports.data ?? []).filter((r) => !reportStatus || r.activityStatus === reportStatus);

  const refresh = async () => {
    await Promise.all([utils.orgService.myWallet.invalidate(), utils.orgService.activities.invalidate(), utils.orgService.reports.invalidate(), utils.orgService.points.invalidate()]);
  };
  const create = trpc.orgService.createActivity.useMutation({
    onSuccess: async () => {
      requestKey.current = null;
      setSelections([]); setStudentIds([]); setNote(""); setRetest(null); setConfirmFees(false);
      await refresh();
    },
  });
  const cancel = trpc.orgService.cancelItem.useMutation({ onSuccess: refresh });
  const cancelStudent = trpc.orgService.cancelStudent.useMutation({ onSuccess: refresh });

  const submit = () => {
    requestKey.current ??= createRequestKey();
    create.mutate({ requestKey: requestKey.current, studentIds, selections, title,
      note: note.trim() || undefined, dueAt: dueDate ? new Date(`${dueDate}T23:59:59`) : null,
      expiryPolicy, retestOfAssignmentId: retest?.assignmentId ?? null });
  };
  const toggleSelection = (key: string) => {
    requestKey.current = null;
    setSelections((old) => old.includes(key) ? old.filter((v) => v !== key) : [...old, key]);
  };
  const beginRetest = (assignmentId: number, studentUserId: number, studentName: string, selectionKey: string, itemTitle: string) => {
    requestKey.current = null;
    setRetest({ assignmentId, studentName, title: itemTitle });
    setActiveStudentId(studentUserId); setStudentIds([studentUserId]); setSelections([selectionKey]);
    setTitle(`复测·${itemTitle}`); setDueDate(""); setView("launch"); setConfirmFees(false);
    create.reset();
  };
  const openGrow = (studentUserId: number) => { setActiveStudentId(studentUserId); setView("launch"); };
  const openReport = (studentUserId: number) => { setActiveStudentId(studentUserId); onOpenReport(studentUserId); };
  const feeError = create.error?.message ?? "";

  return <div className="space-y-4">
    <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-white p-3 shadow-sm">
      <nav aria-label="测评中心视图" className="flex flex-1 flex-wrap gap-1 rounded-xl bg-cream p-1">
        {([{ key: "launch", label: "发起测评", icon: Send }, { key: "activities", label: "测评活动", icon: ClipboardList }, { key: "reports", label: "报告记录", icon: FileText }] as const).map((item) => <button type="button" key={item.key} onClick={() => setView(item.key)} className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold ${view === item.key ? "bg-white text-[#0C7064] shadow-sm" : "text-olive-mute hover:text-olive"}`}><item.icon size={15} />{item.label}</button>)}
      </nav>
      <div className="rounded-xl bg-mint-pale/60 px-3 py-1.5 text-right text-[10.5px] text-olive-mute">我的可用积分<div className="mono text-[19px] font-bold text-[#0C7064]">{(wallet?.balance ?? 0).toLocaleString()}</div></div>
    </header>

    <section className="grid items-start gap-4 2xl:grid-cols-[minmax(0,7fr)_minmax(340px,5fr)]">
      <div className="min-w-0">
        {view === "launch" && <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 text-[17px] font-bold text-olive"><ClipboardList size={18} />点选测评，发起给学员</h2><p className="mt-1 text-[12px] text-olive-mute">小测按实际单价收费；学习力综合诊断 199；MBTI、DISC 与家长 DISC 免费。</p></div><span className="text-[11px] text-olive-mute">每次 1～50 人</span></div>
            {retest && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-[#7866A9]/20 bg-[#F2EFFA] px-3 py-2 text-[12px] text-[#5C477F]"><RotateCcw size={15} /><span className="flex-1"><b>复测模式：</b>{retest.studentName} · {retest.title}；旧报告保留，新任务按当前单价重新扣费。</span><button type="button" onClick={() => { setRetest(null); setSelections([]); setStudentIds([]); requestKey.current = null; }} className="inline-flex items-center gap-1 font-semibold hover:underline"><X size={13} />退出复测</button></div>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-[12px] font-semibold text-olive">活动名称<input value={title} onChange={(e) => { setTitle(e.target.value); requestKey.current = null; }} maxLength={128} className="mt-1 w-full rounded-lg border border-border bg-cream px-3 py-2 font-normal outline-none focus:border-[#0C7064]" /></label>
              <label className="text-[12px] font-semibold text-olive">完成期限（可选）<input type="date" value={dueDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => { setDueDate(e.target.value); requestKey.current = null; }} className="mt-1 w-full rounded-lg border border-border bg-cream px-3 py-2 font-normal outline-none focus:border-[#0C7064]" /></label>
            </div>
            <label className="mt-3 block text-[12px] font-semibold text-olive">到期处理<select value={expiryPolicy} onChange={(e) => setExpiryPolicy(e.target.value as typeof expiryPolicy)} className="mt-1 w-full rounded-lg border border-border bg-cream px-3 py-2 font-normal"><option value="auto_refund">自动过期：整包全部未开始才原路退款</option><option value="manual_review">保留待人工处理：不自动退款</option></select></label>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-1.5 text-[13px] font-bold text-olive"><Users size={15} />1. 选择学员 <span className="font-normal text-olive-mute">已选 {studentIds.length} 人</span></h3>{filteredStudents.length > 0 && <button type="button" disabled={!!retest} onClick={() => setStudentIds(visibleSelected === filteredStudents.length ? studentIds.filter((id) => !filteredStudents.some((s) => s.userId === id)) : [...new Set([...studentIds, ...filteredStudents.map((s) => s.userId)])])} className="text-[11px] font-semibold text-[#0C7064] hover:underline disabled:opacity-40">{visibleSelected === filteredStudents.length ? "取消当前筛选全选" : "全选当前筛选结果"}</button>}</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_130px]"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-olive-mute" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索姓名或手机号" className="w-full rounded-lg border border-border bg-cream py-2 pl-8 pr-3 text-[12px] outline-none focus:border-[#0C7064]" /></div><select aria-label="按年级筛选" value={grade} onChange={(e) => setGrade(e.target.value)} className="rounded-lg border border-border bg-cream px-2.5 py-2 text-[12px]"><option value="">全部年级</option>{grades.map((g) => <option key={g}>{g}</option>)}</select></div>
              <div className="mt-2 grid max-h-56 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
                {filteredStudents.map((student) => <div key={student.userId} className={`flex items-center rounded-lg border ${activeStudentId === student.userId ? "border-[#0C7064]/35 bg-mint-pale/45" : "border-transparent hover:bg-cream"}`}><button type="button" onClick={() => setActiveStudentId(student.userId)} className="min-w-0 flex-1 px-2.5 py-2 text-left"><span className="block truncate text-[12.5px] font-semibold text-olive">{student.name}</span><span className="block text-[10.5px] text-olive-mute">{student.grade || "年级待补全"}</span></button><label className="flex min-h-11 cursor-pointer items-center px-2.5" aria-label={`选择${student.name}`}><input type="checkbox" disabled={!!retest && !studentIds.includes(student.userId)} checked={studentIds.includes(student.userId)} onChange={() => { if (retest) return; setActiveStudentId(student.userId); setStudentIds((old) => old.includes(student.userId) ? old.filter((v) => v !== student.userId) : [...old, student.userId]); requestKey.current = null; }} className="h-4 w-4 accent-[#0C7064]" /></label></div>)}
                {!studentsLoading && !filteredStudents.length && <p className="col-span-full py-5 text-center text-[12px] text-olive-mute">没有匹配的学员。</p>}
              </div>
            </div>

            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2"><h3 className="flex flex-1 items-center gap-1.5 text-[13px] font-bold text-olive"><BookOpenCheck size={15} />2. 点选测评目录</h3><select aria-label="按目录分类筛选" value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-border bg-cream px-2.5 py-1.5 text-[11px]"><option value="">全部分类</option>{["学习力", "选科升学", "亲子沟通", "心理状态"].map((c) => <option key={c}>{c}</option>)}</select></div>
              {catalogLoading ? <p className="py-4 text-[12px] text-olive-mute">正在读取目录…</p> : <div className="mt-2 grid gap-2 lg:grid-cols-2">{filteredOptions.map((item) => <SelectionRow key={item.key} item={item} checked={selections.includes(item.key)} disabled={!!retest && selections[0] !== item.key} onToggle={() => toggleSelection(item.key)} onInfo={() => setInfo(item)} />)}</div>}
            </div>
            <label className="mt-4 block text-[12px] font-semibold text-olive">给学员的说明（可选）<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="例：请本周日晚自习前完成，下一次到店一起解读。" className="mt-1 w-full resize-y rounded-lg border border-border bg-cream px-3 py-2 font-normal outline-none focus:border-[#0C7064]" /></label>
            {duplicate && <p role="alert" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">{duplicate}，请调整后再发起。</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3"><div className="flex-1 text-[12px] text-olive-mute">本次预计扣费 <span className={`mono text-[18px] font-bold ${total > (wallet?.balance ?? 0) ? "text-red-700" : "text-olive"}`}>{total.toLocaleString()}</span> 积分<span className="block text-[10.5px]">下一步逐项核对人数、单价、总价与发起后余额。</span></div><button type="button" onClick={() => { create.reset(); setConfirmFees(true); }} disabled={!studentIds.length || !selections.length || !title.trim() || !!duplicate || total > (wallet?.balance ?? 0)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#0C7064] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#095C53] disabled:opacity-40"><CircleDollarSign size={15} />核对费用并发起</button></div>
            {create.isSuccess && <p className="mt-2 text-right text-[11px] text-[#2F7A41]">已发起，学员端已出现对应任务。</p>}
          </div>
          <div className="rounded-xl border border-[#0C7064]/15 bg-mint-pale/35 px-4 py-3 text-[11.5px] leading-relaxed text-olive-soft"><CircleDollarSign size={15} className="mr-1 inline text-[#0C7064]" />新机构默认首次发放 <b>{(catalog?.defaultPoints ?? 10000).toLocaleString()}</b> 积分，已有机构余额不变，超管可调整。完整理论覆盖每人 <b>{catalog?.fullCoverageCredits ?? 299}</b> 积分；200 人共 <b>{((catalog?.fullCoverageCredits ?? 299) * 200).toLocaleString()}</b>，取整测算参考 {(catalog?.recommendedPoints ?? 60000).toLocaleString()}。测评只扣伴学师个人钱包，机构池只在分配时减少，不会双扣。</div>
        </div>}

        {view === "activities" && <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><div><h2 className="text-[16px] font-bold text-olive">测评活动与逐生任务</h2><p className="mt-1 text-[11px] text-olive-mute">综合包按一位学员的整包处理；已开始或完成的子项不会被退款。</p></div><span className="text-[11px] text-olive-mute">最近 {activities.length} 场</span></div>
          {activitiesLoading ? <p className="py-5 text-[12px] text-olive-mute">正在读取活动…</p> : <div className="mt-3 space-y-2">
            {activities.map((activity) => <div key={activity.id} className="overflow-hidden rounded-xl border border-border">
              <button type="button" onClick={() => setExpandedActivity(expandedActivity === activity.id ? null : activity.id)} className="flex w-full flex-wrap items-center gap-2 px-3.5 py-3 text-left hover:bg-cream/70"><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-olive">{activity.title}</span><span className="mt-0.5 block text-[10.5px] text-olive-mute">{new Date(activity.createdAt).toLocaleString("zh-CN")}{activity.dueAt ? ` · 截止 ${new Date(activity.dueAt).toLocaleDateString("zh-CN")}` : ""} · {activity.expiryPolicy === "auto_refund" ? "到期自动结算" : "到期人工复核"}</span></span><span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${activity.status === "open" ? "bg-mint-pale text-[#0C7064]" : "bg-cream-deep/60 text-olive-mute"}`}>{ACTIVITY_STATUS[activity.status] ?? activity.status}</span><ChevronDown size={15} className={`text-olive-mute transition-transform ${expandedActivity === activity.id ? "rotate-180" : ""}`} /></button>
              {expandedActivity === activity.id && <div className="space-y-3 border-t border-border bg-cream/40 p-3.5">
                {activity.note && <p className="text-[12px] text-olive-soft">{activity.note}</p>}
                {activity.items.map((item) => {
                  const groups = [...new Set(item.assignments.map((a) => a.studentUserId))].map((studentUserId) => item.assignments.filter((a) => a.studentUserId === studentUserId));
                  const allPending = item.assignments.length > 0 && item.assignments.every((a) => a.status === "pending");
                  return <div key={item.id} className="rounded-lg bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2"><div className="min-w-0 flex-1"><div className="text-[12.5px] font-semibold text-olive">{item.title}</div><div className="text-[10.5px] text-olive-mute">{item.priceSnapshot} 积分／人 · {item.includedKinds.length} 份问卷 · 完成 {item.assignments.filter((a) => a.status === "completed").length}/{item.assignments.length}</div></div>{allPending && activity.status === "open" && <button type="button" disabled={cancel.isPending} onClick={() => { const reason = window.prompt("请输入整项取消原因；全部未开始的付费任务将沿原流水退款。", "未开始，取消本次发起"); if (reason?.trim()) cancel.mutate({ itemId: item.id, reason }); }} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-40"><XCircle size={13} />整项取消</button>}</div>
                    <div className="mt-2 space-y-2">{groups.map((group) => {
                      const first = group[0]!;
                      const untouched = group.every((a) => ["pending", "expired"].includes(a.status) && !a.startedAt && !a.completedAt);
                      const completed = group.length > 0 && group.every((a) => a.status === "completed");
                      return <div key={first.studentUserId} className="rounded-lg border border-border/70 bg-cream/35 p-2.5"><div className="flex flex-wrap items-center gap-1.5"><button type="button" onClick={() => setActiveStudentId(first.studentUserId)} className="mr-auto text-[12px] font-semibold text-olive hover:text-[#0C7064]">{first.studentName}</button>{group.map((a) => <span key={a.id} title={`${KIND[a.kind] ?? a.kind} · ${STATUS[a.status] ?? a.status}`} className={`rounded-full px-2 py-1 text-[10px] ${a.status === "completed" ? "bg-mint-pale text-[#0C7064]" : ["cancelled", "expired"].includes(a.status) ? "bg-cream-deep/50 text-olive-mute" : "bg-butter-pale text-olive"}`}>{KIND[a.kind] ?? a.kind} · {STATUS[a.status] ?? a.status}</span>)}</div><div className="mt-2 flex flex-wrap gap-2">{untouched && <button type="button" disabled={cancelStudent.isPending} onClick={() => { const reason = window.prompt(`取消${first.studentName}的整包任务并处理退款，请输入原因。`, "学员不再参加本次测评"); if (reason?.trim()) cancelStudent.mutate({ itemId: item.id, studentUserId: first.studentUserId, reason }); }} className="rounded-lg border border-red-200 px-2 py-1 text-[10.5px] text-red-700 hover:bg-red-50">取消该生整包</button>}{completed && <button type="button" onClick={() => beginRetest(first.id, first.studentUserId, first.studentName, item.selectionKey, item.title)} className="inline-flex items-center rounded-lg border border-[#0C7064]/20 px-2 py-1 text-[10.5px] font-semibold text-[#0C7064] hover:bg-mint-pale"><RotateCcw size={12} className="mr-1" />新建复测</button>}{group.some((a) => a.status === "completed") && <button type="button" onClick={() => openReport(first.studentUserId)} className="rounded-lg border border-border px-2 py-1 text-[10.5px] text-olive hover:bg-white">查看报告</button>}</div></div>;
                    })}</div>
                  </div>;
                })}
              </div>}
            </div>)}
            {!activities.length && <p className="py-7 text-center text-[12px] text-olive-mute">还没有活动。先在「发起测评」选择学员和测评。</p>}
          </div>}
          {(cancel.error ?? cancelStudent.error) && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{(cancel.error ?? cancelStudent.error)?.message}</p>}
          {(cancel.isSuccess || cancelStudent.isSuccess) && <p className="mt-3 text-[11px] text-[#2F7A41]"><Check size={13} className="mr-1 inline" />已处理；符合退款条件的任务沿原扣费流水退回，重复操作不会双退。</p>}
        </section>}

        {view === "reports" && <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div><h2 className="text-[16px] font-bold text-olive">报告记录与后续伴学</h2><p className="mt-1 text-[11px] text-olive-mute">只显示当前账号有权限的报告；历史来源与新活动统一留痕。</p></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-[11px] font-semibold text-olive">学员<select value={reportStudent} onChange={(e) => setReportStudent(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-2 font-normal"><option value={0}>全部学员</option>{students.map((s) => <option key={s.userId} value={s.userId}>{s.name}</option>)}</select></label>
            <label className="text-[11px] font-semibold text-olive">活动<select value={reportActivity} onChange={(e) => setReportActivity(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-2 font-normal"><option value={0}>全部活动</option>{activities.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label>
            <label className="text-[11px] font-semibold text-olive">测评项目<select value={reportKind} onChange={(e) => setReportKind(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-2 font-normal"><option value="">全部项目</option>{Object.entries(KIND).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
            <label className="text-[11px] font-semibold text-olive">完成开始日<input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-2 font-normal" /></label>
            <label className="text-[11px] font-semibold text-olive">完成截止日<input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-2 font-normal" /></label>
            <label className="text-[11px] font-semibold text-olive">活动状态<select value={reportStatus} onChange={(e) => setReportStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-2 font-normal"><option value="">全部状态</option>{Object.entries(ACTIVITY_STATUS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
          </div>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); setAppliedReportQuery(reportQuery.trim()); }}><input value={reportQuery} onChange={(e) => setReportQuery(e.target.value)} placeholder="搜索学员、活动或项目" className="min-w-0 flex-1 rounded-lg border border-border bg-cream px-3 py-2 text-[12px]" /><button className="rounded-lg bg-[#0C7064] px-4 text-[12px] font-semibold text-white" type="submit">查询</button></form>
          {reports.error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{reports.error.message}</p>}
          <div className="mt-3 space-y-2">{visibleReports.map((r) => <article key={r.id} className="rounded-xl border border-border bg-cream/35 p-3"><div className="flex flex-wrap items-center gap-2"><div className="min-w-0 flex-1"><b className="text-[12.5px] text-olive">{r.studentName ?? `学员 ${r.studentUserId}`} · {KIND[r.kind] ?? r.kind}</b><p className="mt-1 text-[10.5px] text-olive-mute">{r.activityTitle ?? "历史测评"} / {r.packageTitle ?? "旧版结果"} · {new Date(r.createdAt).toLocaleString("zh-CN")} · 已完成{r.durationSeconds != null ? ` · 作答 ${Math.max(1, Math.round(r.durationSeconds / 60))} 分钟` : ""}</p></div><span className="rounded-full bg-white px-2 py-1 text-[10px] text-olive-mute">{r.source === "legacy" ? "历史结果" : (ACTIVITY_STATUS[r.activityStatus ?? ""] ?? "已出报告")}</span></div><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => openReport(r.studentUserId)} className="rounded-lg bg-[#0C7064] px-2.5 py-1.5 text-[10.5px] font-semibold text-white">查看报告</button><button type="button" onClick={() => openGrow(r.studentUserId)} className="rounded-lg border border-[#0C7064]/20 px-2.5 py-1.5 text-[10.5px] font-semibold text-[#0C7064]">纳入 GROW</button>{r.assignmentId && r.selectionKey && <button type="button" onClick={() => beginRetest(r.assignmentId!, r.studentUserId, r.studentName ?? `学员 ${r.studentUserId}`, r.selectionKey!, r.packageTitle ?? (KIND[r.kind] ?? r.kind))} className="inline-flex items-center rounded-lg border border-border px-2.5 py-1.5 text-[10.5px] text-olive"><RotateCcw size={12} className="mr-1" />复测</button>}</div></article>)}{reports.isLoading && <p className="py-8 text-center text-[12px] text-olive-mute">正在读取报告记录…</p>}{!reports.isLoading && !visibleReports.length && <p className="py-8 text-center text-[12px] text-olive-mute">当前筛选条件下没有可见报告。权限到期或未开放的报告不会出现在这里。</p>}</div>
        </section>}
      </div>
      <aside className="min-w-0 2xl:sticky 2xl:top-4">{activeStudentId ? <GrowEditor key={activeStudentId} studentUserId={activeStudentId} onOpenReport={() => onOpenReport(activeStudentId)} onOpenCoaching={onOpenCoaching} /> : <div className="rounded-2xl border border-dashed border-border p-10 text-center text-[13px] text-olive-mute">先选择一位学员，这里会显示测评结果与 GROW 伴学路径。</div>}</aside>
    </section>

    {info && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="测评信息与报告入口"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-start gap-3"><div className="flex-1"><h3 className="text-[17px] font-bold text-olive">{info.title}</h3><p className="mt-1 text-[11px] text-olive-mute">{info.category} · {info.price} 积分／人</p></div><button type="button" aria-label="关闭" onClick={() => setInfo(null)} className="text-olive-mute"><X size={18} /></button></div><p className="mt-4 text-[12.5px] leading-relaxed text-olive-soft">{info.description}</p><div className="mt-3 flex flex-wrap gap-1.5">{info.kinds.map((k) => <span key={k} className="rounded-full bg-cream px-2 py-1 text-[10.5px] text-olive">{KIND[k] ?? k}</span>)}</div><p className="mt-4 rounded-lg bg-mint-pale/35 p-3 text-[11px] leading-relaxed text-olive-soft">报告内容由现有量表与报告生成规则产生。选择学员后可进入完整报告；测评结果可继续纳入 GROW 目标、现状、计划与督学。</p><button type="button" disabled={!activeStudentId} onClick={() => { if (activeStudentId) openReport(activeStudentId); setInfo(null); }} className="mt-4 w-full rounded-xl bg-[#0C7064] py-2.5 text-[12px] font-semibold text-white disabled:opacity-40">查看当前学员已有报告</button></div></div>}

    {confirmFees && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="发起测评费用确认"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-center gap-3"><div><h3 className="text-[17px] font-bold text-olive">确认测评与积分扣费</h3><p className="mt-1 text-[11px] text-olive-mute">{studentIds.length} 位学员 · 按当前目录价格形成活动快照</p></div><button type="button" aria-label="关闭费用确认" disabled={create.isPending} onClick={() => setConfirmFees(false)} className="ml-auto text-olive-mute"><X size={18} /></button></div><div className="mt-4 overflow-hidden rounded-xl border border-border"><table className="w-full text-left text-[12px]"><thead className="bg-cream text-[10.5px] text-olive-mute"><tr><th className="p-2.5 font-medium">测评</th><th className="p-2.5 text-right font-medium">单价／人</th><th className="p-2.5 text-right font-medium">小计</th></tr></thead><tbody>{selectedOptions.map((item) => <tr key={item.key} className="border-t border-border"><td className="p-2.5 font-semibold text-olive">{item.title}</td><td className="mono p-2.5 text-right">{item.price} 积分</td><td className="mono p-2.5 text-right">{(item.price * studentIds.length).toLocaleString()} 积分</td></tr>)}</tbody></table></div><div className="mt-4 space-y-2 rounded-xl bg-mint-pale/40 p-3 text-[12px] text-olive"><p className="flex justify-between"><span>本次扣费</span><b className="mono text-[18px]">{total.toLocaleString()} 积分</b></p><p className="flex justify-between"><span>当前个人余额</span><span className="mono">{(wallet?.balance ?? 0).toLocaleString()} 积分</span></p><p className="flex justify-between border-t border-[#0C7064]/15 pt-2"><span>发起后余额</span><b className="mono">{((wallet?.balance ?? 0) - total).toLocaleString()} 积分</b></p></div><p className="mt-3 text-[11px] leading-relaxed text-olive-mute">每位学员的每个所选项目按上述单价合计；组合不免费。免费项目显示 0。历史活动继续保留原价格快照。</p>{feeError && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{feeError}</p>}<div className="mt-4 flex gap-2"><button type="button" disabled={create.isPending} onClick={() => setConfirmFees(false)} className="min-h-11 flex-1 rounded-xl border border-border text-[12px] font-semibold text-olive">返回修改</button><button type="button" disabled={create.isPending} onClick={submit} className="inline-flex min-h-11 flex-[1.4] items-center justify-center gap-1.5 rounded-xl bg-[#0C7064] text-[12px] font-semibold text-white disabled:opacity-40"><Send size={14} />{create.isPending ? "正在创建任务并扣费…" : "确认扣费并发起"}</button></div></div></div>}
  </div>;
}

function SelectionRow({ item, checked, disabled, onToggle, onInfo }: {
  item: AssessmentSelection; checked: boolean; disabled?: boolean; onToggle: () => void; onInfo: () => void;
}) {
  return <div className={`flex items-start gap-2.5 rounded-xl border p-3 ${checked ? "border-[#0C7064] bg-mint-pale/45" : "border-border bg-white hover:border-[#0C7064]/35"} ${disabled ? "opacity-45" : ""}`}>
    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5"><input type="checkbox" disabled={disabled} checked={checked} onChange={onToggle} className="mt-0.5 h-4 w-4 shrink-0 accent-[#0C7064]" /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5"><span className="text-[12.5px] font-semibold text-olive">{item.title}</span><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${item.price ? "bg-butter-pale text-olive" : "bg-mint-pale text-[#0C7064]"}`}>{item.price ? `${item.price} 积分` : "免费"}</span></span><span className="mt-1 block text-[10.5px] leading-relaxed text-olive-mute">{item.description}</span><span className="mt-0.5 block text-[10px] text-olive-mute">{item.category} · {item.kinds.length} 份问卷</span></span></label><button type="button" aria-label={`了解${item.title}`} onClick={onInfo} className="rounded-lg p-1 text-olive-mute hover:bg-cream hover:text-[#0C7064]"><Info size={15} /></button>
  </div>;
}
