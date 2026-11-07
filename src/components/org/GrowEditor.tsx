import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Compass, FileText, Target, TrendingUp } from "lucide-react";
import { trpc } from "@/providers/trpc";

function dateAfter(days: number): string {
  const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10);
}
const KIND: Record<string, string> = { mbti: "MBTI", disc: "DISC", e3: "E3 学习力", multi5: "多元智能", mentalsdq: "心理健康 A 版", mentalpa: "心理健康 B 版", scl90: "SCL-90", mental: "心理健康通用版", subject4d: "学科四维", holland: "霍兰德", anchor: "职业锚", subject: "学科能力", e3parent: "家长认知", discparent: "家长 DISC", familystudent: "家庭关系·学生", familyparent: "家庭关系·家长" };

/** 测评右侧与独立陪跑共用的 GROW 编辑器；实际数据来自共享陪跑主档。 */
export default function GrowEditor({ studentUserId, onOpenReport, onOpenCoaching }: { studentUserId: number; onOpenReport?: () => void; onOpenCoaching?: (caseId: number) => void }) {
  const utils = trpc.useUtils();
  const { data: cases } = trpc.coaching.cases.useQuery();
  const [createdCaseId, setCreatedCaseId] = useState<number | null>(null);
  const current = useMemo(() => cases?.find((c) => c.coachingCase.studentUserId === studentUserId), [cases, studentUserId]);
  const caseId = current?.coachingCase.id ?? createdCaseId ?? 0;
  const { data, isLoading } = trpc.coaching.detail.useQuery({ caseId }, { enabled: caseId > 0 });
  const [goal, setGoal] = useState(""); const [situation, setSituation] = useState(""); const [plan, setPlan] = useState("");
  const [scenario, setScenario] = useState<"新生接手" | "方案调整" | "结课复盘" | "回访">("新生接手");
  const [start, setStart] = useState(dateAfter(0)); const [end, setEnd] = useState(dateAfter(180));
  useEffect(() => {
    setCreatedCaseId(null);
  }, [studentUserId]);
  useEffect(() => {
    setGoal(data?.coachingCase.goal ?? ""); setSituation(data?.coachingCase.currentSituation ?? ""); setPlan(data?.coachingCase.planSummary ?? "");
    setScenario((data?.coachingCase.scenario as typeof scenario) ?? "新生接手");
    setStart(data?.coachingCase.serviceStart ?? dateAfter(0)); setEnd(data?.coachingCase.serviceEnd ?? dateAfter(180));
  }, [data, studentUserId]);
  const refresh = async (targetCaseId?: number) => {
    await utils.coaching.cases.invalidate();
    const id = targetCaseId ?? caseId;
    if (id) await utils.coaching.detail.invalidate({ caseId: id });
  };
  const create = trpc.coaching.createCase.useMutation({ onSuccess: async (result) => {
    setCreatedCaseId(result.caseId);
    await refresh(result.caseId);
  } });
  const update = trpc.coaching.updateGrow.useMutation({ onSuccess: () => refresh() });
  const saving = create.isPending || update.isPending;
  const error = create.error?.message ?? update.error?.message;
  const save = () => {
    if (data) update.mutate({ caseId: data.coachingCase.id, scenario, goal, currentSituation: situation, planSummary: plan, serviceStart: start, serviceEnd: end });
    else create.mutate({ studentUserId, scenario, goal, currentSituation: situation, planSummary: plan, serviceStart: start, serviceEnd: end });
  };
  const pending = data?.tasks.filter((t) => t.status !== "verified").length ?? 0;
  const latest = data?.results.slice(0, 4) ?? [];
  return <section className="overflow-hidden rounded-2xl border border-[#0C7064]/15 bg-white shadow-sm">
    <header className="bg-[#0C7064] px-5 py-4 text-white">
      <div className="text-[10px] font-semibold tracking-[.18em] text-white/60">GROW · 伴学路径</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <h2 className="text-[18px] font-bold">从测评走向行动</h2>
        {onOpenReport && <button type="button" disabled={data?.reportAllowed === false} title={data?.reportAllowed === false ? "报告权限未开放或已到期" : "查看该学员完整报告"} onClick={onOpenReport} className="inline-flex items-center gap-1 rounded-lg bg-white/12 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"><FileText size={13} /> 完整报告</button>}
      </div>
    </header>
    {caseId > 0 && isLoading ? <div className="p-6 text-sm text-olive-mute">正在读取陪跑主档…</div> : <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11px] font-semibold text-olive-mute">服务场景<select value={scenario} onChange={(e) => setScenario(e.target.value as typeof scenario)} className="mt-1 w-full rounded-lg border border-border bg-cream px-2 py-2 text-[12px] text-olive"><option>新生接手</option><option>方案调整</option><option>结课复盘</option><option>回访</option></select></label>
        <div className="rounded-lg bg-mint-pale/60 px-3 py-2 text-[11px] text-olive-soft">测评结果<div className="mt-1 text-[18px] font-bold text-olive">{data?.reportAllowed === false ? "未开放" : `${data?.results.length ?? 0} 份`}</div></div>
      </div>
      {data?.reportAllowed === false && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] leading-relaxed text-amber-800">该学员的报告权限未开放或已到期。这里不会把空列表当作“没有测评”；请联系机构管理员确认报告授权，已有 GROW 计划和督学记录不受影响。</p>}
      {!data && <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-olive-mute"><label>开始日期<input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-[12px]" /></label><label>结束日期<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-[12px]" /></label></div>}
      <GrowField icon={<Target size={15} />} title="明确目标" subtitle="Goal · 将期待变成可验证的目标" value={goal} onChange={setGoal} placeholder="例：本学期数学从 82 分提升至 95 分，能独立讲解错题。" />
      <GrowField icon={<TrendingUp size={15} />} title="评估现状" subtitle="Reality · 结合报告、成绩与到店观察" value={situation} onChange={setSituation} placeholder="例：基础概念掌握不稳，作业拖延；已完成 E3，需进一步验证执行卡点。" />
      <GrowField icon={<Compass size={15} />} title="定制计划" subtitle="Options / Will · 形成四级计划与责任分工" value={plan} onChange={setPlan} placeholder="例：前三个月每周一对一教练＋督学，后三个月评估是否进入学习坊；每日检验、每周复盘。" />
      <div className="rounded-xl border border-[#0C7064]/15 bg-mint-pale/40 p-3">
        <div className="flex items-center gap-2 text-[13px] font-bold text-olive"><ClipboardCheck size={15} /> 督学陪跑</div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px] text-olive-mute"><span className="rounded-lg bg-white p-2"><b className="block text-[17px] text-olive">{data?.supervisions.length ?? 0}</b>到店督学</span><span className="rounded-lg bg-white p-2"><b className="block text-[17px] text-olive">{data?.sessions.length ?? 0}</b>课堂记录</span><span className="rounded-lg bg-white p-2"><b className="block text-[17px] text-olive">{pending}</b>待验收</span></div>
        {latest.length > 0 && <div className="mt-2 space-y-1">{latest.map((r) => <div key={r.id} className="flex items-center justify-between text-[11px] text-olive-soft"><span>{KIND[r.kind] ?? r.kind}</span><time>{new Date(r.createdAt).toLocaleDateString("zh-CN")}</time></div>)}</div>}
        {data && onOpenCoaching && <button type="button" onClick={() => onOpenCoaching(data.coachingCase.id)} className="mt-3 w-full rounded-lg border border-[#0C7064]/20 bg-white py-2 text-[12px] font-semibold text-[#0C7064] hover:bg-mint-pale">进入独立陪跑：计划、课堂、验收与反馈 →</button>}
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>}
      <button type="button" onClick={save} disabled={saving || goal.trim().length < 2 || situation.trim().length < 2 || plan.trim().length < 2} className="w-full rounded-xl bg-[#0C7064] py-2.5 text-[13px] font-semibold text-white hover:bg-[#095c53] disabled:opacity-40">{saving ? "正在保存…" : data ? "保存 GROW 并生成新计划版本" : "确认方案，建立陪跑主档"}</button>
      {(create.isSuccess || update.isSuccess) && <p className="text-center text-[11px] text-[#2F7A41]">已保存；历史计划版本保留。</p>}
    </div>}
  </section>;
}

function GrowField({ icon, title, subtitle, value, onChange, placeholder }: { icon: React.ReactNode; title: string; subtitle: string; value: string; onChange: (s: string) => void; placeholder: string }) {
  return <label className="block rounded-xl border border-border bg-cream/60 p-3">
    <span className="flex items-center gap-1.5 text-[13px] font-bold text-olive">{icon}{title}</span>
    <span className="mt-0.5 block text-[10.5px] text-olive-mute">{subtitle}</span>
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="mt-2 w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-[12px] leading-relaxed text-olive outline-none placeholder:text-olive-mute/60 focus:border-[#0C7064]" />
  </label>;
}
