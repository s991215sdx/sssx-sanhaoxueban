import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, CircleDollarSign, Clock, FileText, Plus, RotateCcw, Search, Send, Target, Trash2, Users as UsersIcon, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import GrowStudentWorkspace from "@/components/org/GrowStudentWorkspace";
import { createRequestKey } from "@/lib/requestKey";
import { XUANKE_ASSESSMENT, type AssessmentSelection } from "@contracts/orgService";
import { CATALOG, KIND_LABEL, ShotSwitch, type CatalogItem } from "@/components/admin/AssessCenter";
import { Card, G, Pill } from "@/components/admin/SchoolConsole";

const KIND: Record<string, string> = { mbti: "MBTI", disc: "DISC", e3: "E3 学习力", multi5: "多元智能", mentalsdq: "心理健康 A 版", mentalpa: "心理健康 B 版", scl90: "SCL-90", mental: "心理健康通用版", subject4d: "学科四维", holland: "霍兰德", anchor: "职业锚", subject: "学科能力", e3parent: "家长认知", discparent: "家长 DISC", familystudent: "家庭关系·学生", familyparent: "家庭关系·家长" };

const CATALOG_ALIAS: Record<string, string> = {
  learning_comprehensive: "xueli",
  xuanke_free: "xuanke",
  learning_suite: "xueli",
  family_support: "jiating",
  family_relation: "jiating-relation",
  familystudent: "jiating-relation",
  familyparent: "jiating-relation",
  mentalsdq: "mental-a",
  mentalpa: "mental-b",
  mental: "mental-c",
  scl90: "mental-d",
};
const CATEGORY_TABS = [
  { key: "", label: "全部" },
  { key: "学习力", label: "学习力测评" },
  { key: "选科升学", label: "选科及升学测评" },
  { key: "亲子沟通", label: "家庭测评" },
  { key: "心理状态", label: "心理健康测评" },
] as const;

/** 使用校园版同一份目录物料；机构版的名称、计价与问卷范围仍以服务端目录为准。 */
function catalogFor(item: AssessmentSelection): CatalogItem {
  const source = CATALOG.find((entry) => entry.key === (CATALOG_ALIAS[item.key] ?? item.key));
  if (source) return { ...source, key: item.key, name: item.title, kinds: item.kinds };
  return {
    key: item.key,
    combo: item.kinds.length > 1,
    cat: item.category === "选科升学" ? "shengxue" : item.category === "亲子沟通" ? "jiating" : item.category === "心理状态" ? "xinli" : "xueli",
    name: item.title,
    kinds: item.kinds,
    tags: [item.category],
    purpose: item.description,
    crowd: "按量表适用学段",
    minutes: item.kinds.length * 5,
    imgs: ["/assess/e3-cover.png", "/assess/e3.png"],
    why: [item.description],
    gain: ["完成对应问卷后生成测评报告，作为后续伴学与计划制定的参考。"],
    theory: "按系统当前量表版本与报告生成规则执行。",
  };
}

export type LaunchPreset = { assignmentId: number | null; studentUserId: number; studentName: string; selectionKey: string; title: string; mode: "retest" | "restart" };

export default function AssessmentLaunch({ retest, onClearRetest, onOpenReport, onOpenCoaching }: {
  retest: LaunchPreset | null; onClearRetest: () => void;
  onOpenReport: (studentUserId: number) => void; onOpenCoaching: (caseId: number) => void;
}) {
  const utils = trpc.useUtils();
  const { data: students = [], isLoading: studentsLoading } = trpc.coach.myStudents.useQuery();
  const { data: catalog, isLoading: catalogLoading } = trpc.orgService.catalog.useQuery();
  const { data: wallet } = trpc.orgService.myWallet.useQuery();
  const [studentIds, setStudentIds] = useState<number[]>([]);
  const [activeStudentId, setActiveStudentId] = useState(0);
  const [growOpen, setGrowOpen] = useState(false);
  const [mobilePush, setMobilePush] = useState(false);
  const [resultId, setResultId] = useState<number | undefined>();
  const [selections, setSelections] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState(""); const [grade, setGrade] = useState("");
  const [title, setTitle] = useState("伴学测评"); const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState(""); const [expiryPolicy, setExpiryPolicy] = useState<"auto_refund" | "manual_review">("auto_refund");
  const [confirmFees, setConfirmFees] = useState(false); const [info, setInfo] = useState<AssessmentSelection | null>(null);
  const requestKey = useRef<string | null>(null);
  useEffect(() => {
    if (!retest) return;
    setStudentIds([retest.studentUserId]); setActiveStudentId(retest.studentUserId); setSelections([retest.selectionKey]);
    setTitle(retest.mode === "retest" ? `复测·${retest.title}` : retest.title); setDueDate(""); setGrowOpen(false); setResultId(undefined); requestKey.current = null;
  }, [retest]);
  useEffect(() => { if (!activeStudentId && students.length) setActiveStudentId(students[0]!.userId); }, [students, activeStudentId]);
  const options = useMemo(() => [...(catalog?.packages ?? []), ...(catalog?.singles ?? [])], [catalog]);
  const selectedOptions = options.filter((item) => selections.includes(item.key));
  const duplicate = useMemo(() => { const seen = new Set<string>(); for (const item of selectedOptions) for (const kind of item.kinds) { if (seen.has(kind)) return `${item.title}与其他已选项包含重复测评`; seen.add(kind); } return ""; }, [selectedOptions]);
  const total = selectedOptions.reduce((sum, item) => sum + item.price, 0) * studentIds.length;
  const totalKinds = new Set(selectedOptions.flatMap((item) => item.kinds)).size;
  const estimatedMinutes = totalKinds * 5;
  const grades = useMemo(() => [...new Set(students.map((s) => s.grade).filter((v): v is string => !!v))].sort(), [students]);
  const filteredStudents = students.filter((s) => (!grade || s.grade === grade) && (!query.trim() || s.name.includes(query.trim()) || (s.phone ?? "").includes(query.trim())));
  const filteredOptions = options.filter((item) => !category || item.category === category);
  const allFiltered = filteredStudents.length > 0 && filteredStudents.every((s) => studentIds.includes(s.userId));
  const create = trpc.orgService.createActivity.useMutation({ onSuccess: async () => {
    requestKey.current = null; setSelections([]); setStudentIds([]); setNote(""); setConfirmFees(false); onClearRetest();
    await Promise.all([utils.orgService.myWallet.invalidate(), utils.orgService.activities.invalidate(), utils.orgService.reports.invalidate(), utils.orgService.points.invalidate()]);
  } });
  const toggleSelection = (key: string) => { requestKey.current = null; setSelections((old) => old.includes(key) ? old.filter((v) => v !== key) : [...old, key]); };
  const toggleStudent = (id: number) => { if (retest) return; requestKey.current = null; setStudentIds((old) => old.includes(id) ? old.filter((value) => value !== id) : [...old, id]); };
  const openGrow = (studentUserId: number, report?: number) => { setActiveStudentId(studentUserId); setResultId(report); setGrowOpen(true); setMobilePush(false); };
  const submit = () => {
    requestKey.current ??= createRequestKey();
    create.mutate({ requestKey: requestKey.current, studentIds, selections, title, note: note.trim() || undefined,
      dueAt: dueDate ? new Date(`${dueDate}T23:59:59+08:00`) : null, expiryPolicy, retestOfAssignmentId: retest?.assignmentId ?? null });
  };
  const infoMeta = info ? catalogFor(info) : null;
  return <>
    {growOpen ? <GrowStudentWorkspace students={students} studentId={activeStudentId} resultId={resultId} selectedIds={studentIds} onToggle={retest ? undefined : toggleStudent} onSelect={(id) => { setActiveStudentId(id); setResultId(undefined); }} onBack={() => setGrowOpen(false)} onOpenReport={onOpenReport} onOpenCoaching={onOpenCoaching} /> : <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(340px,5fr)]">
      <div className="min-w-0">
        <div><h2 className="text-[18px] font-bold text-olive">选择测评，开始一次有目标的了解</h2><p className="mt-1 text-[11.5px] text-olive-mute">先点选组合或单项，再在右侧勾选学员并核对积分。</p></div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {CATEGORY_TABS.map((tab) => <Pill key={tab.key} active={category === tab.key} onClick={() => setCategory(tab.key)}>{tab.label}</Pill>)}
          <span className="ml-auto text-[11.5px] text-olive-mute">勾选测评 → 右侧选择学员 → 核对积分并推送</span>
        </div>
        {retest && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#7866A9]/20 bg-[#F2EFFA] px-3 py-2 text-[12px] text-[#5C477F]"><RotateCcw size={15} /><span className="flex-1"><b>{retest.mode === "retest" ? "复测模式" : "重新安排"}：</b>{retest.studentName} · {retest.title}。{retest.mode === "retest" ? "旧报告保留，关联原任务复测。" : "创建全新活动，不关联未完成任务。"}新任务按当前价格重新计费。</span><button type="button" onClick={() => { onClearRetest(); setSelections([]); setStudentIds([]); }} className="inline-flex items-center gap-1 font-semibold"><X size={13} />退出</button></div>}
        {catalogLoading ? <p className="py-12 text-center text-[12px] text-olive-mute">正在读取测评目录…</p> : <div className="mt-5 space-y-3">{filteredOptions.map((item) => <SelectionCard key={item.key} item={item} checked={selections.includes(item.key)} disabled={!!retest && selections[0] !== item.key} onToggle={() => toggleSelection(item.key)} onInfo={() => setInfo(item)} />)}</div>}
        <div className="mt-5 rounded-xl border border-[#0C7064]/10 bg-mint-pale/30 px-4 py-3 text-[11px] leading-relaxed text-olive-soft"><b className="text-olive">积分说明：</b>新机构首次默认 {(catalog?.defaultPoints ?? 15000).toLocaleString()} 积分；选科及升学规划组合按实际 {catalog?.packages.find((p) => p.key === XUANKE_ASSESSMENT)?.price ?? 20} 积分／人。完整理论覆盖 {catalog?.fullCoverageCredits ?? 299} 积分／人，不作为集中施测建议。</div>
        <button type="button" onClick={() => setMobilePush(true)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0C7064] text-[12px] font-semibold text-white xl:hidden"><Send size={15} />选择学员与推送清单（{studentIds.length} 人 · {selections.length} 项）</button>
      </div>

      <aside className={`${mobilePush ? "fixed inset-0 z-40 overflow-y-auto bg-cream p-3" : "hidden"} min-w-0 xl:sticky xl:top-4 xl:block xl:bg-transparent xl:p-0`}>
        <button type="button" onClick={() => setMobilePush(false)} className="mb-2 inline-flex min-h-10 items-center gap-1 rounded-lg border border-border bg-white px-3 text-[12px] font-semibold text-olive xl:hidden"><X size={15} />返回测评目录</button>
        <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <header className="bg-[#0C7064] px-4 py-4 text-white"><div className="flex items-center gap-2"><Send size={17} /><h2 className="text-[16px] font-bold">推送清单</h2><span className="ml-auto rounded-full bg-white/12 px-2 py-0.5 text-[10.5px]">{studentIds.length} 人 · {selections.length} 项</span></div><p className="mt-1 text-[11px] text-white/70">复选框用于推送；点击姓名查看 GROW。</p></header>
          <div className="space-y-4 p-4">
            <div><div className="flex items-center justify-between"><h3 className="text-[12.5px] font-bold text-olive">已选测评</h3><span className="text-[10.5px] text-olive-mute">共 {totalKinds} 份问卷 · 约 {estimatedMinutes} 分钟</span></div><div className="mt-2 space-y-1.5">{selectedOptions.map((item) => <div key={item.key} className="flex items-center gap-2 rounded-lg bg-mint-pale/40 px-2.5 py-2"><span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-olive">{item.title}</span><span className="mono text-[11px] text-[#0C7064]">{item.price} 积分／人</span><button type="button" aria-label={`移除${item.title}`} disabled={!!retest} onClick={() => toggleSelection(item.key)} className="text-olive-mute hover:text-red-700 disabled:opacity-30"><Trash2 size={13} /></button></div>)}{!selectedOptions.length && <p className="rounded-lg border border-dashed border-border py-4 text-center text-[11px] text-olive-mute">请先在左侧点选测评</p>}</div>{duplicate && <p role="alert" className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">{duplicate}</p>}</div>
            <div><div className="flex items-center justify-between gap-2"><h3 className="text-[12.5px] font-bold text-olive">选择学员 <span className="font-normal text-[#0C7064]">{studentIds.length}/50</span></h3><button type="button" disabled={!!retest || !filteredStudents.length} onClick={() => setStudentIds(allFiltered ? studentIds.filter((id) => !filteredStudents.some((s) => s.userId === id)) : [...new Set([...studentIds, ...filteredStudents.map((s) => s.userId)])])} className="text-[10.5px] font-semibold text-[#0C7064] disabled:opacity-40">{allFiltered ? "取消全选" : "全选筛选结果"}</button></div><div className="relative mt-2"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-olive-mute" /><input aria-label="搜索学员" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="姓名或手机号" className="w-full rounded-lg border border-border bg-cream py-2 pl-8 pr-2 text-[11.5px]" /></div><select aria-label="按年级筛选" value={grade} onChange={(e) => setGrade(e.target.value)} className="mt-2 w-full rounded-lg border border-border bg-cream px-2.5 py-2 text-[11.5px]"><option value="">全部年级</option>{grades.map((g) => <option key={g}>{g}</option>)}</select><div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1">{filteredStudents.map((student) => <div key={student.userId} className={`flex items-center rounded-lg border ${studentIds.includes(student.userId) ? "border-[#0C7064]/30 bg-mint-pale/30" : "border-transparent hover:bg-cream"}`}><label className="flex min-h-10 cursor-pointer items-center px-2.5"><input type="checkbox" aria-label={`选择${student.name}`} disabled={!!retest} checked={studentIds.includes(student.userId)} onChange={() => { setStudentIds((old) => old.includes(student.userId) ? old.filter((v) => v !== student.userId) : [...old, student.userId]); requestKey.current = null; }} className="h-4 w-4 accent-[#0C7064]" /></label><button type="button" onClick={() => openGrow(student.userId)} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-semibold text-olive">{student.name}</span><span className="block text-[10px] text-olive-mute">{student.grade || "年级待补全"}</span></span><ChevronRight size={13} className="mr-1 text-olive-mute" /></button></div>)}{!studentsLoading && !filteredStudents.length && <p className="py-5 text-center text-[11px] text-olive-mute">没有匹配的学员。</p>}</div></div>
            <div className="space-y-2 border-t border-border pt-3"><label className="block text-[11.5px] font-semibold text-olive">活动名称<input value={title} maxLength={128} onChange={(e) => { setTitle(e.target.value); requestKey.current = null; }} className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-2 font-normal" /></label><label className="block text-[11.5px] font-semibold text-olive">截止时间（可选）<input type="date" value={dueDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => { setDueDate(e.target.value); requestKey.current = null; }} className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-2 font-normal" /></label><label className="block text-[11.5px] font-semibold text-olive">到期处理<select value={expiryPolicy} onChange={(e) => setExpiryPolicy(e.target.value as typeof expiryPolicy)} className="mt-1 w-full rounded-lg border border-border bg-cream px-2.5 py-2 font-normal"><option value="auto_refund">全部未开始，自动原路退款</option><option value="manual_review">保留记录，人工处理</option></select></label><label className="block text-[11.5px] font-semibold text-olive">学员说明（可选）<textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="完成时间与解读安排" className="mt-1 w-full resize-y rounded-lg border border-border bg-cream px-2.5 py-2 font-normal" /></label></div>
            <div className="rounded-xl bg-cream p-3"><div className="flex justify-between text-[11px] text-olive-mute"><span>个人可用余额</span><span className="mono">{(wallet?.balance ?? 0).toLocaleString()}</span></div><div className="mt-1 flex items-end justify-between"><span className="text-[12px] font-semibold text-olive">本次合计</span><span className={`mono text-[22px] font-bold ${total > (wallet?.balance ?? 0) ? "text-red-700" : "text-[#0C7064]"}`}>{total.toLocaleString()}<small className="ml-1 text-[11px] font-normal">积分</small></span></div></div>
            <button type="button" disabled={!studentIds.length || !selections.length || !title.trim() || !!duplicate || total > (wallet?.balance ?? 0)} onClick={() => { create.reset(); setConfirmFees(true); }} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0C7064] text-[12.5px] font-semibold text-white disabled:opacity-40"><CircleDollarSign size={15} />核对费用并发起</button>
            {create.isSuccess && <p role="status" className="flex items-center justify-center gap-1 text-[11px] text-[#2F7A41]"><Check size={13} />已发起，请到测评活动跟进。</p>}
          </div>
        </section>
      </aside>
    </section>}
    {info && infoMeta && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="测评说明" onClick={() => setInfo(null)} onKeyDown={(event) => { if (event.key === "Escape") setInfo(null); }}>
        <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6" onClick={(event) => event.stopPropagation()}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2"><h3 className="text-[17px] font-bold text-olive">{info.title}</h3><span className="rounded px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: infoMeta.combo ? G.brandSoft : "#F3F5F0", color: infoMeta.combo ? G.brand : G.mute }}>{infoMeta.combo ? "组合测评" : "单项测评"}</span><span className="rounded-full bg-butter-pale px-2 py-0.5 text-[10.5px] font-bold text-olive">{info.price ? `${info.price} 积分／人` : "免费"}</span></div>
              <p className="mt-1 text-[12px] text-olive-mute">{info.kinds.map((kind) => KIND_LABEL[kind] ?? KIND[kind] ?? kind).join(" + ")} · 约 {infoMeta.minutes} 分钟 · 适用：{infoMeta.crowd}</p>
            </div>
            <button type="button" autoFocus aria-label="关闭" onClick={() => setInfo(null)} className="rounded-lg p-1.5 hover:bg-black/5"><X size={17} /></button>
          </div>
          <div className="mb-5 overflow-hidden rounded-xl border" style={{ borderColor: G.line }}>
            <div className="relative h-[240px] sm:h-[340px]"><ShotSwitch imgs={infoMeta.imgs} name={info.title} /></div>
            <p className="px-3 py-1.5 text-[11px]" style={{ color: G.mute, background: "#FAFBF8" }}>报告效果图 · 点图内箭头切换「封面 / 报告内页」</p>
          </div>
          <p className="mb-4 rounded-xl bg-cream px-4 py-3 text-[12px] leading-relaxed text-olive-soft">{info.description}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border p-4" style={{ borderColor: G.line }}><h4 className="mb-2 text-[13.5px] font-bold" style={{ color: G.brand }}>为什么测</h4><ul className="list-disc space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-olive">{infoMeta.why.map((text) => <li key={text}>{text}</li>)}</ul></div>
            <div className="rounded-xl border p-4" style={{ borderColor: G.line }}><h4 className="mb-2 text-[13.5px] font-bold" style={{ color: G.brand }}>你将获得</h4><ul className="list-disc space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-olive">{infoMeta.gain.map((text) => <li key={text}>{text.replace("粤华五大组合内的", "可报组合中的")}</li>)}</ul></div>
          </div>
          <div className="mt-4 rounded-xl border p-4" style={{ borderColor: G.line, background: "#FAFBF8" }}><h4 className="mb-1.5 text-[13.5px] font-bold" style={{ color: G.brand }}>理论支撑</h4><p className="text-[12.5px] leading-relaxed text-olive">{infoMeta.theory}</p></div>
          <p className="mt-3 text-[11px] leading-relaxed text-olive-mute">报告用于伴学参考；心理筛查不构成医学诊断，也不生成普通学习标签。</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={!!retest && selections[0] !== info.key} onClick={() => { toggleSelection(info.key); setInfo(null); }} className="flex min-h-11 items-center justify-center gap-1 rounded-xl px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-40" style={{ background: selections.includes(info.key) ? G.warn : G.brand }}>{selections.includes(info.key) ? "从推送清单移除" : "加入推送清单"}</button>
            <button type="button" disabled={!activeStudentId} onClick={() => { if (activeStudentId) openGrow(activeStudentId); setInfo(null); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#0C7064]/25 px-3 py-2.5 text-[12px] font-semibold text-[#0C7064] disabled:opacity-40"><Target size={14} />查看当前学员 GROW</button>
          </div>
        </div>
      </div>
    )}
    {confirmFees && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="发起测评费用确认"><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-center gap-3"><div><h3 className="text-[17px] font-bold text-olive">确认测评与积分扣费</h3><p className="mt-1 text-[11px] text-olive-mute">{studentIds.length} 位学员 · 以当前目录价格形成活动快照</p></div><button type="button" aria-label="关闭费用确认" onClick={() => setConfirmFees(false)} className="ml-auto"><X size={18} /></button></div><table className="mt-4 w-full text-left text-[12px]"><thead className="bg-cream text-olive-mute"><tr><th className="p-2.5">测评</th><th className="p-2.5 text-right">单价</th><th className="p-2.5 text-right">小计</th></tr></thead><tbody>{selectedOptions.map((item) => <tr key={item.key} className="border-t border-border"><td className="p-2.5 font-semibold">{item.title}</td><td className="mono p-2.5 text-right">{item.price}</td><td className="mono p-2.5 text-right">{item.price * studentIds.length}</td></tr>)}</tbody></table><div className="mt-4 rounded-xl bg-mint-pale/40 p-3 text-[12px]"><p className="flex justify-between"><span>本次扣费</span><b className="mono text-[18px]">{total.toLocaleString()} 积分</b></p><p className="mt-1 flex justify-between"><span>发起后余额</span><b className="mono">{((wallet?.balance ?? 0) - total).toLocaleString()} 积分</b></p></div>{create.error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-[12px] text-red-700">{create.error.message}</p>}<div className="mt-4 flex gap-2"><button type="button" disabled={create.isPending} onClick={() => setConfirmFees(false)} className="min-h-11 flex-1 rounded-xl border border-border text-[12px] font-semibold">返回修改</button><button type="button" disabled={create.isPending} onClick={submit} className="min-h-11 flex-[1.4] rounded-xl bg-[#0C7064] text-[12px] font-semibold text-white disabled:opacity-40">{create.isPending ? "正在创建并扣费…" : "确认扣费并发起"}</button></div></div></div>}
  </>;
}

function SelectionCard({ item, checked, disabled, onToggle, onInfo }: { item: AssessmentSelection; checked: boolean; disabled: boolean; onToggle: () => void; onInfo: () => void }) {
  const meta = catalogFor(item);
  return (
    <Card style={{ padding: 0, borderColor: checked ? G.brand : G.line, background: checked ? "#F4FAF7" : "#fff" }}>
      <div className={`flex flex-col gap-3 p-4 sm:flex-row ${disabled ? "opacity-45" : ""}`}>
        <div className="relative shrink-0 overflow-hidden rounded-lg border" style={{ borderColor: G.line, width: 176, height: 118 }}>
          <ShotSwitch imgs={meta.imgs} name={item.title} />
          <button type="button" onClick={onInfo} className="absolute inset-0 text-left" title="点击查看报告预览">
            <span className="absolute bottom-1 right-1 rounded px-1.5 py-0.5 text-[10px] text-white" style={{ background: "rgba(30,53,48,.72)" }}>报告预览</span>
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14.5px] font-bold" style={{ color: G.ink }}>{item.title}</span>
            <span className="rounded px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: meta.combo ? G.brandSoft : "#F3F5F0", color: meta.combo ? G.brand : G.mute }}>{meta.combo ? "组合" : "单项"}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.price ? "bg-butter-pale text-olive" : "bg-mint-pale text-[#0C7064]"}`}>{item.price ? `${item.price} 积分／人` : "免费"}</span>
            {meta.tags.filter((tag) => tag !== "粤华必测").map((tag) => <span key={tag} className="rounded-full border px-2 py-0.5 text-[10.5px]" style={{ borderColor: G.line, color: G.mute }}>{tag}</span>)}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: G.ink }}>测评用途：{meta.purpose}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]" style={{ color: G.mute }}>
            <span className="flex items-center gap-1"><UsersIcon size={12} />适用：{meta.crowd}</span>
            <span className="flex items-center gap-1"><Clock size={12} />约 {meta.minutes} 分钟</span>
            <span className="flex items-center gap-1"><FileText size={12} />{item.kinds.map((kind) => KIND_LABEL[kind] ?? KIND[kind] ?? kind).join(" + ")}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 self-center sm:w-28">
          <button type="button" onClick={onInfo} className="rounded-lg border px-3 py-1.5 text-[12px] font-semibold" style={{ borderColor: G.line, color: G.ink }}>查看详情</button>
          <button type="button" disabled={disabled} onClick={onToggle} className="flex items-center justify-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:cursor-not-allowed" style={{ background: checked ? G.warn : G.brand }}>
            {checked ? <><Check size={13} />已加入</> : <><Plus size={13} />加入推送</>}
          </button>
        </div>
      </div>
    </Card>
  );
}
