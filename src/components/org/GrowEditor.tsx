import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Compass, FileText, Target, TrendingUp } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { COACHING_SCENARIOS, coachingScenarioLabel, type CoachingScenarioKey } from "@contracts/orgService";

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
  const [scenarios, setScenarios] = useState<CoachingScenarioKey[]>([]);
  const [scenarioChangeReason, setScenarioChangeReason] = useState("");
  const [start, setStart] = useState(dateAfter(0)); const [end, setEnd] = useState(dateAfter(180));
  useEffect(() => {
    setCreatedCaseId(null);
  }, [studentUserId]);
  useEffect(() => {
    setGoal(data?.coachingCase.goal ?? ""); setSituation(data?.coachingCase.currentSituation ?? ""); setPlan(data?.coachingCase.planSummary ?? "");
    setScenarios(data?.serviceScenarios ?? []);
    setScenarioChangeReason("");
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
  const removingScenario = Boolean(data?.serviceScenarios.some((item) => !scenarios.includes(item)));
  const formValid = scenarios.length > 0 && goal.trim().length >= 2 && situation.trim().length >= 2 && plan.trim().length >= 2 && end >= start && (!removingScenario || scenarioChangeReason.trim().length >= 2);
  const toggleScenario = (key: CoachingScenarioKey) => setScenarios((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  const save = () => {
    if (!formValid) return;
    if (data) update.mutate({ caseId: data.coachingCase.id, scenarios, scenarioChangeReason: scenarioChangeReason || undefined, goal, currentSituation: situation, planSummary: plan, serviceStart: start, serviceEnd: end });
    else create.mutate({ studentUserId, scenarios, goal, currentSituation: situation, planSummary: plan, serviceStart: start, serviceEnd: end });
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
      <div className="flex items-center justify-between gap-3">
        <div><h3 className="text-[13px] font-bold text-olive">陪跑服务场景</h3><p className="mt-0.5 text-[10.5px] text-olive-mute">可按实际服务叠加选择，至少一项</p></div>
        <div className="shrink-0 rounded-lg bg-mint-pale/60 px-3 py-2 text-[11px] text-olive-soft">测评结果 <b className="ml-1 text-[15px] text-olive">{data?.reportAllowed === false ? "未开放" : `${data?.results.length ?? 0} 份`}</b></div>
      </div>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">选择陪跑服务场景</legend>
        {COACHING_SCENARIOS.map((item) => <label key={item.key} className={`cursor-pointer rounded-xl border p-3 transition-colors ${scenarios.includes(item.key) ? "border-[#0C7064]/45 bg-mint-pale/55" : "border-border bg-cream/50 hover:border-[#0C7064]/25"}`}>
          <span className="flex items-center gap-2"><input type="checkbox" checked={scenarios.includes(item.key)} onChange={() => toggleScenario(item.key)} className="h-4 w-4 accent-[#0C7064]" /><b className="text-[12px] text-olive">{item.key} {item.name}</b></span>
          <span className="mt-1.5 block pl-6 text-[10.5px] leading-relaxed text-olive-mute">{item.description}</span>
        </label>)}
      </fieldset>
      {!scenarios.length && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">{data ? "该主档尚未设置服务场景，请根据实际陪跑方式补选，系统不会自行猜测归类。" : "请至少选择一种服务场景，可叠加选择。"}</p>}
      {removingScenario && <label className="block rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11.5px] font-semibold text-amber-900">场景调整原因（停用已有场景时必填）<textarea aria-label="场景调整原因" value={scenarioChangeReason} onChange={(e) => setScenarioChangeReason(e.target.value)} rows={2} maxLength={500} placeholder="例：晚自习服务结束，保留周末督学并新增假期集训。" className="mt-2 w-full resize-y rounded-lg border border-amber-200 bg-white px-3 py-2 text-[12px] font-normal text-olive outline-none focus:border-amber-500" /><span className="mt-1 block text-[10.5px] font-normal text-amber-800">停用不会删除历史；原场景周期和调整原因将完整保留。</span></label>}
      <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-olive-mute"><label>服务开始日期<input aria-label="服务开始日期" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-[12px]" /></label><label>服务结束日期<input aria-label="服务结束日期" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-[12px]" /></label></div>
      {end < start && <p role="alert" className="text-[11px] text-red-700">服务结束日期不能早于开始日期。</p>}
      {data && <details className="rounded-xl border border-border bg-cream/40 p-3"><summary className="cursor-pointer text-[12px] font-semibold text-olive">服务场景历史 <span className="font-normal text-olive-mute">（{data.scenarioHistory.length} 个周期，使用中 {data.serviceScenarios.length} 项）</span></summary><div className="mt-3 space-y-2">{data.scenarioHistory.map((item) => <div key={item.id} className="rounded-lg bg-white p-2.5 text-[11px] leading-relaxed"><div className="flex flex-wrap items-center gap-2"><b className="text-olive">{coachingScenarioLabel(item.scenario)}</b><span className={`rounded-full px-2 py-0.5 text-[10px] ${item.endedAt ? "bg-cream text-olive-mute" : "bg-mint-pale text-[#0C7064]"}`}>{item.endedAt ? "已停用" : "使用中"}</span></div><p className="mt-1 text-olive-mute">开始：{new Date(item.startedAt).toLocaleString("zh-CN")}{item.endedAt ? ` · 停用：${new Date(item.endedAt).toLocaleString("zh-CN")}` : ""}</p>{item.changeReason && <p className="mt-1 whitespace-pre-wrap text-olive-soft">原因：{item.changeReason}</p>}</div>)}{!data.scenarioHistory.length && <p className="text-[11px] text-olive-mute">尚无场景周期记录，保存补选后开始留痕。</p>}</div></details>}
      {data?.reportAllowed === false && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] leading-relaxed text-amber-800">该学员的报告权限未开放或已到期。这里不会把空列表当作“没有测评”；请联系机构管理员确认报告授权，已有 GROW 计划和督学记录不受影响。</p>}
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
      <button type="button" onClick={save} disabled={saving || !formValid} className="w-full rounded-xl bg-[#0C7064] py-2.5 text-[13px] font-semibold text-white hover:bg-[#095c53] disabled:opacity-40">{saving ? "正在保存…" : data ? "保存 GROW 并生成新计划版本" : "确认方案，建立陪跑主档"}</button>
      {(create.isSuccess || update.isSuccess) && <p className="text-center text-[11px] text-[#2F7A41]">已保存；历史计划版本与服务场景周期均保留。</p>}
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
