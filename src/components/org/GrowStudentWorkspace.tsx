import { useMemo, useState } from "react";
import { ArrowLeft, Check, Search, Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import GrowEditor from "./GrowEditor";
import GrowSnapshot from "./GrowSnapshot";

export type GrowStudent = { userId: number; name: string; grade: string | null };

/** 左学员、右 GROW 的统一工作视图；发起测评时保留复选，其他入口只切换学员。 */
export default function GrowStudentWorkspace({ students, studentId, resultId, onSelect, onBack, selectedIds, onToggle, onOpenReport, onOpenCoaching }: {
  students: GrowStudent[];
  studentId: number;
  resultId?: number;
  onSelect: (id: number) => void;
  onBack: () => void;
  selectedIds?: number[];
  onToggle?: (id: number) => void;
  onOpenReport: (id: number) => void;
  onOpenCoaching: (caseId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => students.filter((student) => !query.trim() || student.name.includes(query.trim())), [students, query]);
  return <div className="space-y-4">
    <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-[12px] font-semibold text-olive"><ArrowLeft size={15} />返回上一页</button>
    <div className="grid items-start gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-border bg-white p-4 shadow-sm xl:sticky xl:top-4">
        <div className="flex items-center justify-between"><h2 className="text-[16px] font-bold text-olive">我的学员</h2><span className="text-[10.5px] text-olive-mute">{students.length} 人</span></div>
        <p className="mt-1 text-[10.5px] leading-relaxed text-olive-mute">{onToggle ? "勾选用于批量推送；点击姓名查看 GROW" : "点击姓名切换学员，右侧同步更新"}</p>
        <div className="relative mt-3"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-olive-mute" /><input aria-label="搜索 GROW 学员" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索学员姓名" className="w-full rounded-lg border border-border bg-cream py-2.5 pl-9 pr-3 text-[12px] outline-none focus:border-[#0C7064]" /></div>
        <div className="mt-3 max-h-[560px] space-y-1.5 overflow-y-auto pr-1">{filtered.map((student) => {
          const checked = selectedIds?.includes(student.userId);
          return <div key={student.userId} className={`flex items-center gap-2 rounded-xl border p-2.5 transition ${studentId === student.userId ? "border-[#0C7064]/40 bg-mint-pale/45" : "border-transparent hover:bg-cream/60"}`}>
            {onToggle && <button type="button" role="checkbox" aria-checked={checked} aria-label={`选择${student.name}`} onClick={() => onToggle(student.userId)} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${checked ? "border-[#0C7064] bg-[#0C7064] text-white" : "border-border bg-white"}`}>{checked && <Check size={13} />}</button>}
            <button type="button" onClick={() => onSelect(student.userId)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-mint-pale text-[13px] font-bold text-[#0C7064]">{student.name.slice(0, 1)}</span><span className="min-w-0 flex-1"><b className="block truncate text-[12.5px] text-olive">{student.name}</b><span className="mt-0.5 block text-[10px] text-olive-mute">{student.grade || "年级待补全"}</span></span></button>
          </div>;
        })}{!filtered.length && <div className="py-8 text-center"><Users size={24} className="mx-auto text-olive-mute/60" /><p className="mt-2 text-[11.5px] text-olive-mute">没有匹配的学员</p></div>}</div>
        {onToggle && <div className="mt-3 rounded-xl bg-cream/60 p-3 text-[11px] leading-relaxed text-olive-soft">当前选中 <b className="text-[#0C7064]">{selectedIds?.length ?? 0} 人</b><br />返回推送清单后选择仍会保留</div>}
      </aside>
      <div className="min-w-0">{studentId ? <StudentGrowPane key={`${studentId}:${resultId ?? 0}`} studentUserId={studentId} resultId={resultId} onOpenReport={() => onOpenReport(studentId)} onOpenCoaching={onOpenCoaching} /> : <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center text-[13px] text-olive-mute">请选择一位学员查看 GROW 伴学</div>}</div>
    </div>
  </div>;
}

/** 学员已有陪跑主档时，测评中心右侧降级为 GROW 摘要（冰山+成长路径+本周安排），完整编辑在陪跑工作台。 */
function StudentGrowPane({ studentUserId, resultId, onOpenReport, onOpenCoaching }: { studentUserId: number; resultId?: number; onOpenReport: () => void; onOpenCoaching: (caseId: number) => void }) {
  const { data: cases = [] } = trpc.coaching.cases.useQuery();
  const caseId = cases.find((row) => row.coachingCase.studentUserId === studentUserId)?.coachingCase.id ?? 0;
  const { data: detail, isLoading } = trpc.coaching.detail.useQuery({ caseId }, { enabled: caseId > 0 });
  if (!caseId) return <GrowEditor key={`${studentUserId}:${resultId ?? 0}`} studentUserId={studentUserId} initialResultId={resultId} onOpenReport={onOpenReport} onOpenCoaching={onOpenCoaching} />;
  if (isLoading || !detail) return <div className="rounded-2xl border border-border bg-white p-10 text-center text-[13px] text-olive-mute">正在读取陪跑主档…</div>;
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-olive-mute">此处仅展示当前 GROW 快照与冰山现状。陪跑中心已迁移至独立系统，历史数据仍保留在原系统，未自动迁移。</p>
      <button type="button" onClick={() => onOpenCoaching(caseId)} className="min-h-10 rounded-xl border border-[#0C7064]/25 bg-white px-4 py-2 text-[12px] font-semibold text-[#0C7064] hover:bg-mint-pale">查看陪跑迁移说明</button>
    </div>
    <GrowSnapshot data={detail} onOpenCoaching={onOpenCoaching} />
  </div>;
}
