import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpenCheck, Check, ChevronDown, CircleDollarSign, ClipboardList, Search, Send, Users, XCircle } from "lucide-react";
import { trpc } from "@/providers/trpc";
import GrowEditor from "@/components/org/GrowEditor";
import { createRequestKey } from "@/lib/requestKey";

const STATUS: Record<string, string> = { pending: "待开始", in_progress: "作答中", completed: "已完成", cancelled: "已取消" };

export default function OrgAssessmentCenter({ onOpenReport, onOpenCoaching }: {
  onOpenReport: (studentUserId: number) => void;
  onOpenCoaching: (caseId: number) => void;
}) {
  const utils = trpc.useUtils();
  const { data: students = [], isLoading: studentsLoading } = trpc.coach.myStudents.useQuery();
  const { data: catalog, isLoading: catalogLoading } = trpc.orgService.catalog.useQuery();
  const { data: wallet } = trpc.orgService.myWallet.useQuery();
  const { data: activities = [], isLoading: activitiesLoading } = trpc.orgService.activities.useQuery();
  const [studentIds, setStudentIds] = useState<number[]>([]);
  const [activeStudentId, setActiveStudentId] = useState<number>(0);
  const [selections, setSelections] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("伴学测评");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [showSingles, setShowSingles] = useState(true);
  const [expandedActivity, setExpandedActivity] = useState<number | null>(null);
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
  const filteredStudents = students.filter((s) => !query.trim() || s.name.includes(query.trim()) || (s.phone ?? "").includes(query.trim()));

  const refresh = async () => {
    await Promise.all([utils.orgService.myWallet.invalidate(), utils.orgService.activities.invalidate(), utils.orgService.points.invalidate()]);
  };
  const create = trpc.orgService.createActivity.useMutation({
    onSuccess: async () => {
      requestKey.current = null;
      setSelections([]); setStudentIds([]); setNote("");
      await refresh();
    },
  });
  const cancel = trpc.orgService.cancelItem.useMutation({ onSuccess: refresh });

  const submit = () => {
    requestKey.current ??= createRequestKey();
    create.mutate({ requestKey: requestKey.current, studentIds, selections, title,
      note: note.trim() || undefined, dueAt: dueDate ? new Date(`${dueDate}T23:59:59`) : null });
  };
  const toggleStudent = (id: number) => {
    setActiveStudentId(id);
    setStudentIds((old) => old.includes(id) ? old.filter((v) => v !== id) : [...old, id]);
  };

  return <div className="space-y-5">
    <section className="grid gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-[17px] font-bold text-olive"><ClipboardList size={18} /> 点选测评，发起给学员</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-olive-mute">小测默认 10 积分；学习力综合诊断 199；MBTI、DISC 与家长 DISC 免费。</p>
            </div>
            <div className="rounded-xl bg-mint-pale/60 px-3 py-2 text-right text-[11px] text-olive-mute">我的可用积分<div className="mono text-[20px] font-bold text-[#0C7064]">{(wallet?.balance ?? 0).toLocaleString()}</div></div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-[12px] font-semibold text-olive">活动名称<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={128} className="mt-1 w-full rounded-lg border border-border bg-cream px-3 py-2 font-normal outline-none focus:border-[#0C7064]" /></label>
            <label className="text-[12px] font-semibold text-olive">完成期限（可选）<input type="date" value={dueDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-cream px-3 py-2 font-normal outline-none focus:border-[#0C7064]" /></label>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-olive"><Users size={15} /> 1. 选择学员 <span className="font-normal text-olive-mute">{studentIds.length} 人</span></h3>
              {students.length > 0 && <button type="button" onClick={() => setStudentIds(studentIds.length === students.length ? [] : students.map((s) => s.userId))} className="text-[11px] font-semibold text-[#0C7064] hover:underline">{studentIds.length === students.length ? "清空" : "全选"}</button>}
            </div>
            <div className="relative mt-2"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-olive-mute" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索姓名或手机号" className="w-full rounded-lg border border-border bg-cream py-2 pl-8 pr-3 text-[12px] outline-none focus:border-[#0C7064]" /></div>
            <div className="mt-2 grid max-h-56 gap-1 overflow-y-auto pr-1 sm:grid-cols-2">
              {filteredStudents.map((student) => <div key={student.userId} className={`flex items-center rounded-lg border text-left transition-colors ${activeStudentId === student.userId ? "border-[#0C7064]/35 bg-mint-pale/45" : "border-transparent hover:bg-cream"}`}>
                <button type="button" onClick={() => setActiveStudentId(student.userId)} className="min-w-0 flex-1 px-2.5 py-2 text-left"><span className="block truncate text-[12.5px] font-semibold text-olive">{student.name}</span><span className="block text-[10.5px] text-olive-mute">{student.grade || "年级待补全"}</span></button>
                <label className="flex min-h-11 cursor-pointer items-center px-2.5" aria-label={`选择${student.name}`}><input type="checkbox" checked={studentIds.includes(student.userId)} onChange={() => toggleStudent(student.userId)} className="h-4 w-4 accent-[#0C7064]" /></label>
              </div>)}
              {!studentsLoading && filteredStudents.length === 0 && <p className="col-span-full py-5 text-center text-[12px] text-olive-mute">没有匹配的学员。</p>}
            </div>
          </div>

          <div className="mt-4">
            <h3 className="flex items-center gap-1.5 text-[13px] font-bold text-olive"><BookOpenCheck size={15} /> 2. 点选测评目录</h3>
            {catalogLoading ? <p className="py-4 text-[12px] text-olive-mute">正在读取目录…</p> : <>
              <div className="mt-2 space-y-2">{(catalog?.packages ?? []).map((item) => <SelectionRow key={item.key} item={item} checked={selections.includes(item.key)} onToggle={() => setSelections((old) => old.includes(item.key) ? old.filter((v) => v !== item.key) : [...old, item.key])} />)}</div>
              <button type="button" onClick={() => setShowSingles((v) => !v)} className="mt-3 flex w-full items-center justify-between rounded-lg bg-cream px-3 py-2 text-[12px] font-semibold text-olive hover:bg-cream-deep/50">单项测评（{(catalog?.singles ?? []).length}）<ChevronDown size={15} className={`transition-transform ${showSingles ? "rotate-180" : ""}`} /></button>
              {showSingles && <div className="mt-2 grid gap-2 sm:grid-cols-2">{(catalog?.singles ?? []).map((item) => <SelectionRow key={item.key} item={item} checked={selections.includes(item.key)} onToggle={() => setSelections((old) => old.includes(item.key) ? old.filter((v) => v !== item.key) : [...old, item.key])} compact />)}</div>}
            </>}
          </div>

          <label className="mt-4 block text-[12px] font-semibold text-olive">给学员的说明（可选）<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="例：请本周日晚自习前完成，下一次到店一起解读。" className="mt-1 w-full resize-y rounded-lg border border-border bg-cream px-3 py-2 font-normal outline-none focus:border-[#0C7064]" /></label>
          {duplicate && <p role="alert" className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">{duplicate}，请调整后再发起。</p>}
          {create.error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{create.error.message}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <div className="flex-1 text-[12px] text-olive-mute">本次预计扣费 <span className={`mono text-[18px] font-bold ${total > (wallet?.balance ?? 0) ? "text-red-700" : "text-olive"}`}>{total.toLocaleString()}</span> 积分<span className="block text-[10.5px]">按当前价格快照计算；历史活动不随后续调价变化。</span></div>
            <button type="button" onClick={submit} disabled={create.isPending || !studentIds.length || !selections.length || !title.trim() || !!duplicate || total > (wallet?.balance ?? 0)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#0C7064] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#095C53] disabled:cursor-not-allowed disabled:opacity-40"><Send size={15} />{create.isPending ? "正在发起…" : "确认发起"}</button>
          </div>
          {create.isSuccess && <p className="mt-2 text-right text-[11px] text-[#2F7A41]">已发起，学员端已出现对应任务。</p>}
        </div>
        <div className="rounded-xl border border-[#0C7064]/15 bg-mint-pale/35 px-4 py-3 text-[11.5px] leading-relaxed text-olive-soft"><CircleDollarSign size={15} className="mr-1 inline text-[#0C7064]" />新机构默认首次发放 <b>{(catalog?.defaultPoints ?? 10000).toLocaleString()}</b> 积分，已有机构余额不变，超管可调整。完整理论覆盖每人 <b>{catalog?.fullCoverageCredits ?? 299}</b> 积分；200 人共 <b>{((catalog?.fullCoverageCredits ?? 299) * 200).toLocaleString()}</b>，取整测算参考 {(catalog?.recommendedPoints ?? 60000).toLocaleString()}。测评只扣伴学师个人钱包，机构池只在分配时减少，不会双扣。</div>
      </div>

      <div className="min-w-0">
        {activeStudentId ? <GrowEditor key={activeStudentId} studentUserId={activeStudentId} onOpenReport={() => onOpenReport(activeStudentId)} onOpenCoaching={onOpenCoaching} /> : <div className="rounded-2xl border border-dashed border-border p-10 text-center text-[13px] text-olive-mute">先选择一位学员，这里会显示测评结果与 GROW 伴学路径。</div>}
      </div>
    </section>

    <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between"><h2 className="text-[16px] font-bold text-olive">测评活动与任务状态</h2><span className="text-[11px] text-olive-mute">最近 {activities.length} 场</span></div>
      {activitiesLoading ? <p className="py-5 text-[12px] text-olive-mute">正在读取活动…</p> : <div className="mt-3 space-y-2">
        {activities.map((activity) => <div key={activity.id} className="overflow-hidden rounded-xl border border-border">
          <button type="button" onClick={() => setExpandedActivity(expandedActivity === activity.id ? null : activity.id)} className="flex w-full flex-wrap items-center gap-2 px-3.5 py-3 text-left hover:bg-cream/70">
            <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-olive">{activity.title}</span><span className="mt-0.5 block text-[10.5px] text-olive-mute">{new Date(activity.createdAt).toLocaleString("zh-CN")}{activity.dueAt ? ` · 截止 ${new Date(activity.dueAt).toLocaleDateString("zh-CN")}` : ""}</span></span>
            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${activity.status === "open" ? "bg-mint-pale text-[#0C7064]" : "bg-cream-deep/60 text-olive-mute"}`}>{activity.status === "open" ? "进行中" : "已取消"}</span><ChevronDown size={15} className={`text-olive-mute transition-transform ${expandedActivity === activity.id ? "rotate-180" : ""}`} />
          </button>
          {expandedActivity === activity.id && <div className="space-y-3 border-t border-border bg-cream/40 p-3.5">
            {activity.note && <p className="text-[12px] text-olive-soft">{activity.note}</p>}
            {activity.items.map((item) => {
              const allPending = item.assignments.length > 0 && item.assignments.every((a) => a.status === "pending");
              const completed = item.assignments.filter((a) => a.status === "completed").length;
              return <div key={item.id} className="rounded-lg bg-white p-3">
                <div className="flex flex-wrap items-center gap-2"><div className="min-w-0 flex-1"><div className="text-[12.5px] font-semibold text-olive">{item.title}</div><div className="text-[10.5px] text-olive-mute">{item.priceSnapshot} 积分／人 · {item.includedKinds.length} 份问卷 · 完成 {completed}/{item.assignments.length}</div></div>
                  {allPending && activity.status === "open" && <button type="button" disabled={cancel.isPending} onClick={() => { const reason = window.prompt("请输入取消原因；未开始的付费任务将沿原流水退款。", "未开始，取消本次发起"); if (reason?.trim()) cancel.mutate({ itemId: item.id, reason }); }} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-[11px] text-red-700 hover:bg-red-50 disabled:opacity-40"><XCircle size={13} />取消并退款</button>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">{item.assignments.map((a) => <span key={a.id} title={`${a.studentName} · ${a.kind}`} className={`rounded-full px-2 py-1 text-[10px] ${a.status === "completed" ? "bg-mint-pale text-[#0C7064]" : a.status === "cancelled" ? "bg-cream-deep/50 text-olive-mute line-through" : "bg-butter-pale text-olive"}`}>{a.studentName} · {STATUS[a.status] ?? a.status}</span>)}</div>
              </div>;
            })}
          </div>}
        </div>)}
        {!activities.length && <p className="py-7 text-center text-[12px] text-olive-mute">还没有活动。先在上方选择学员和测评，发起后会在这里追踪进度。</p>}
      </div>}
      {cancel.error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{cancel.error.message}</p>}
      {cancel.isSuccess && <p className="mt-3 text-[11px] text-[#2F7A41]"><Check size={13} className="mr-1 inline" />已取消；付费任务已退回原钱包。</p>}
    </section>
  </div>;
}

function SelectionRow({ item, checked, onToggle, compact = false }: {
  item: { key: string; title: string; description: string; price: number; kinds: string[]; category: string };
  checked: boolean; onToggle: () => void; compact?: boolean;
}) {
  return <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors ${checked ? "border-[#0C7064] bg-mint-pale/45" : "border-border bg-white hover:border-[#0C7064]/35"}`}>
    <input type="checkbox" checked={checked} onChange={onToggle} className="mt-0.5 h-4 w-4 shrink-0 accent-[#0C7064]" />
    <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1.5"><span className="text-[12.5px] font-semibold text-olive">{item.title}</span><span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${item.price ? "bg-butter-pale text-olive" : "bg-mint-pale text-[#0C7064]"}`}>{item.price ? `${item.price} 积分` : "免费"}</span></span>{!compact && <span className="mt-1 block text-[10.5px] leading-relaxed text-olive-mute">{item.description}</span>}<span className="mt-0.5 block text-[10px] text-olive-mute">{item.category} · {item.kinds.length} 份问卷</span></span>
  </label>;
}
