import { useEffect, useMemo, useState } from "react";
import { BookOpen, ClipboardCheck, Compass, FileText, Plus, Target, Trash2, TrendingUp, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { COACHING_SCENARIOS, coachingScenarioLabel, type CoachingScenarioKey } from "@contracts/orgService";
import { isE3V37Result } from "@contracts/e3v37";
import { PURPOSE_OPTIONS, ABILITY_TO_COURSE, COURSE_FORMATS, COURSE_OUTLINE, composeGoalText, composePlanText, defaultCoursePlan, emptyGrowPlan, parseGrowForm, type GrowPlanForm } from "./growPlan";

const RAG: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  red: { label: "问题明显", dot: "#DD3534", text: "#A82524", bg: "#F9E4E1", border: "#DD3534" },
  yellow: { label: "有待关注", dot: "#E3B53A", text: "#8A6500", bg: "#FAF0CC", border: "#E3B53A" },
  green: { label: "健康", dot: "#52A965", text: "#2F7A41", bg: "#E9F3E6", border: "#52A965" },
};
const LEVEL_TO_RAG: Record<string, string> = { 卡点: "red", 待提升: "yellow", 正常: "green" };

function dateAfter(days: number): string {
  const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10);
}
const KIND: Record<string, string> = { mbti: "MBTI", disc: "DISC", e3: "E3 学习力", multi5: "多元智能", mentalsdq: "心理健康 A 版", mentalpa: "心理健康 B 版", scl90: "SCL-90", mental: "心理健康通用版", subject4d: "学科四维", holland: "霍兰德", anchor: "职业锚", subject: "学科能力", e3parent: "家长认知", discparent: "家长 DISC", familystudent: "家庭关系·学生", familyparent: "家庭关系·家长" };
const SUBJECT_NAMES = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "政治"];

/** 测评右侧与独立陪跑共用的 GROW 编辑器；v274 起按规划课四要素（目的/目标/策略/衡量）表单化。 */
export default function GrowEditor({ studentUserId, initialResultId, onOpenReport, onOpenCoaching }: { studentUserId: number; initialResultId?: number; onOpenReport?: () => void; onOpenCoaching?: (caseId: number) => void }) {
  const utils = trpc.useUtils();
  const { data: cases } = trpc.coaching.cases.useQuery();
  const [createdCaseId, setCreatedCaseId] = useState<number | null>(null);
  const current = useMemo(() => cases?.find((c) => c.coachingCase.studentUserId === studentUserId), [cases, studentUserId]);
  const caseId = current?.coachingCase.id ?? createdCaseId ?? 0;
  const { data, isLoading } = trpc.coaching.detail.useQuery({ caseId }, { enabled: caseId > 0 });
  /* 取学员档案与测评结果：表单默认值 + 「学习力测评报告参考」（现状基线 = 冰山模型 RAG）。 */
  const { data: studentDetail } = trpc.coach.studentDetail.useQuery({ userId: studentUserId });
  const [form, setForm] = useState<GrowPlanForm>(emptyGrowPlan());
  const [situationNote, setSituationNote] = useState("");
  const [scenarios, setScenarios] = useState<CoachingScenarioKey[]>([]);
  const [scenarioChangeReason, setScenarioChangeReason] = useState("");
  const [start, setStart] = useState(dateAfter(0)); const [end, setEnd] = useState(dateAfter(180));
  useEffect(() => {
    setCreatedCaseId(null);
  }, [studentUserId]);

  /* 报告参考数据（E3 冰山模型 RAG + 档案 + 成绩） */
  const e3v37 = isE3V37Result(studentDetail?.assessments.e3) ? studentDetail.assessments.e3 : null;
  const ragGroups = useMemo(() => {
    const rows: { label: string; score: number; rag: string; system: string }[] = (e3v37?.abilities ?? []).map((a) => ({ label: a.label, score: a.score, rag: LEVEL_TO_RAG[a.level] ?? "green", system: a.system }));
    for (const cell of e3v37?.systems.condition.cells ?? []) rows.push({ label: cell.label, score: cell.score, rag: LEVEL_TO_RAG[cell.level] ?? "green", system: "条件" });
    return { red: rows.filter((r) => r.rag === "red"), yellow: rows.filter((r) => r.rag === "yellow"), green: rows.filter((r) => r.rag === "green") };
  }, [e3v37]);
  const profile = studentDetail?.profile;
  const academics = studentDetail?.academics;
  const weakLabels = useMemo(() => [...ragGroups.red, ...ragGroups.yellow].map((r) => r.label), [ragGroups]);
  /** 依据测评短板自动建议的课程组合 */
  const suggestedCourses = useMemo(() => COURSE_OUTLINE.map((c) => c.course).filter((course) => weakLabels.some((label) => (ABILITY_TO_COURSE[label] ?? []).includes(course))), [weakLabels]);
  /** 学习力学业目标 → 学科目标表默认值 */
  const academicsSubjects = useMemo(() => (academics?.subjects ?? []).filter((s) => s.name).map((s) => ({ name: s.name, baseline: s.lastScore ?? null, target: s.targetScore ?? null })), [academics]);
  const situationAuto = useMemo(() => {
    if (!e3v37) return "";
    const fmt = (list: { label: string; score: number }[]) => list.map((r) => `${r.label} ${r.score.toFixed(1)}`).join("、") || "无";
    return `E3 学习力诊断（${e3v37.stageLabel}，5 分制）：问题明显——${fmt(ragGroups.red)}；有待关注——${fmt(ragGroups.yellow)}；健康——${fmt(ragGroups.green)}。`;
  }, [e3v37, ragGroups]);

  /* 主档数据到达后初始化表单：已有 growForm 用已存结构；否则按档案/学习力目标/短板给默认值 */
  useEffect(() => {
    setScenarios(data?.serviceScenarios ?? []);
    setScenarioChangeReason("");
    setStart(data?.coachingCase.serviceStart ?? dateAfter(0)); setEnd(data?.coachingCase.serviceEnd ?? dateAfter(180));
    const saved = parseGrowForm(data?.coachingCase.growForm);
    if (saved) {
      setForm(saved);
      /* 已存文本里可能有人工补充的现状观察，保留在补充栏 */
      const auto = situationAuto;
      const stored = data?.coachingCase.currentSituation ?? "";
      setSituationNote(auto && stored.startsWith(auto) ? stored.slice(auto.length).replace(/^\s*/, "") : "");
    } else {
      setForm({ ...emptyGrowPlan(), targetSchool: profile?.targetSchool ?? "", subjects: academicsSubjects, courses: suggestedCourses, weekly: [{ item: "", metric: "" }] });
      setSituationNote(data && !situationAuto ? (data.coachingCase.currentSituation ?? "") : "");
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [data, studentUserId]);
  /* studentDetail 后到且表单还是初始空态时，补一次默认值 */
  useEffect(() => {
    if (data?.coachingCase.growForm) return;
    setForm((f) => ({
      ...f,
      targetSchool: f.targetSchool || (profile?.targetSchool ?? ""),
      subjects: f.subjects.length ? f.subjects : academicsSubjects,
      courses: f.courses.length ? f.courses : suggestedCourses,
    }));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [studentDetail]);

  const set = (patch: Partial<GrowPlanForm>) => setForm((f) => ({ ...f, ...patch }));
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

  /* 合成三栏纯文本（既有消费方继续可读） */
  const goalText = useMemo(() => composeGoalText(form), [form]);
  const situationText = useMemo(() => {
    const parts = [situationAuto, situationNote.trim()].filter(Boolean);
    return parts.join(situationNote.trim() && situationAuto ? `\n补充观察：${situationNote.trim()}` : "");
  }, [situationAuto, situationNote]);

  const weeklyFilled = form.weekly.filter((w) => w.item.trim());
  const formValid = scenarios.length > 0
    && form.purpose.length > 0
    && form.subjects.some((s) => s.name.trim() && (s.baseline != null || s.target != null))
    && form.courses.length > 0
    && weeklyFilled.length > 0
    && end >= start && (!removingScenario || scenarioChangeReason.trim().length >= 2);
  const save = () => {
    if (!formValid) return;
    /* 已勾选但未单独设置的课程，按默认频次/形式补齐后再合成与入库 */
    const coursePlans = form.courses.map((c) => form.coursePlans.find((p) => p.course === c) ?? { course: c, ...defaultCoursePlan(c) });
    const payload = { scenarios, goal: goalText || "（待补充目标）", currentSituation: situationText || "（到店观察后补充现状评估）", planSummary: composePlanText({ ...form, coursePlans }, COURSE_OUTLINE) || "（待补充计划）", growForm: { ...form, coursePlans, subjects: form.subjects.filter((s) => s.name.trim()), weekly: weeklyFilled, exams: form.exams.filter((e) => e.name.trim()) }, serviceStart: start, serviceEnd: end };
    if (data) update.mutate({ caseId: data.coachingCase.id, scenarioChangeReason: scenarioChangeReason || undefined, ...payload });
    else create.mutate({ studentUserId, capacityOverrideReason: undefined, ...payload });
  };
  const pending = data?.tasks.filter((t) => t.status !== "verified").length ?? 0;
  const selectedResult = data?.results.find((result) => result.id === initialResultId);
  const latest = selectedResult ? [selectedResult, ...(data?.results.filter((result) => result.id !== initialResultId) ?? [])].slice(0, 4) : data?.results.slice(0, 4) ?? [];

  return <section className="overflow-hidden rounded-2xl border border-[#0C7064]/15 bg-white shadow-sm">
    <header className="bg-[#0C7064] px-5 py-4 text-white">
      <div className="text-[10px] font-semibold tracking-[.18em] text-white/60">GROW · 规划课课程设计</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <h2 className="text-[18px] font-bold">像装修先做设计：定目的、定目标、定策略、定衡量</h2>
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
          <span className="flex items-center gap-2"><input type="checkbox" checked={scenarios.includes(item.key)} onChange={() => setScenarios((cur) => cur.includes(item.key) ? cur.filter((k) => k !== item.key) : [...cur, item.key])} className="h-4 w-4 accent-[#0C7064]" /><b className="text-[12px] text-olive">{item.key} {item.name}</b></span>
          <span className="mt-1.5 block pl-6 text-[10.5px] leading-relaxed text-olive-mute">{item.description}</span>
        </label>)}
      </fieldset>
      {!scenarios.length && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">{data ? "该主档尚未设置服务场景，请根据实际陪跑方式补选，系统不会自行猜测归类。" : "请至少选择一种服务场景，可叠加选择。"}</p>}
      {removingScenario && <label className="block rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11.5px] font-semibold text-amber-900">场景调整原因（停用已有场景时必填）<textarea aria-label="场景调整原因" value={scenarioChangeReason} onChange={(e) => setScenarioChangeReason(e.target.value)} rows={2} maxLength={500} placeholder="例：晚自习服务结束，保留周末督学并新增假期集训。" className="mt-2 w-full resize-y rounded-lg border border-amber-200 bg-white px-3 py-2 text-[12px] font-normal text-olive outline-none focus:border-amber-500" /><span className="mt-1 block text-[10.5px] font-normal text-amber-800">停用不会删除历史；原场景周期和调整原因将完整保留。</span></label>}
      <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-olive-mute"><label>服务开始日期<input aria-label="服务开始日期" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-[12px]" /></label><label>服务结束日期<input aria-label="服务结束日期" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-[12px]" /></label></div>
      {end < start && <p role="alert" className="text-[11px] text-red-700">服务结束日期不能早于开始日期。</p>}
      {data && <details className="rounded-xl border border-border bg-cream/40 p-3"><summary className="cursor-pointer text-[12px] font-semibold text-olive">服务场景历史 <span className="font-normal text-olive-mute">（{data.scenarioHistory.length} 个周期，使用中 {data.serviceScenarios.length} 项）</span></summary><div className="mt-3 space-y-2">{data.scenarioHistory.map((item) => <div key={item.id} className="rounded-lg bg-white p-2.5 text-[11px] leading-relaxed"><div className="flex flex-wrap items-center gap-2"><b className="text-olive">{coachingScenarioLabel(item.scenario)}</b><span className={`rounded-full px-2 py-0.5 text-[10px] ${item.endedAt ? "bg-cream text-olive-mute" : "bg-mint-pale text-[#0C7064]"}`}>{item.endedAt ? "已停用" : "使用中"}</span></div><p className="mt-1 text-olive-mute">开始：{new Date(item.startedAt).toLocaleString("zh-CN")}{item.endedAt ? ` · 停用：${new Date(item.endedAt).toLocaleString("zh-CN")}` : ""}</p>{item.changeReason && <p className="mt-1 whitespace-pre-wrap text-olive-soft">原因：{item.changeReason}</p>}</div>)}{!data.scenarioHistory.length && <p className="text-[11px] text-olive-mute">尚无场景周期记录，保存补选后开始留痕。</p>}</div></details>}
      {data?.reportAllowed === false && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] leading-relaxed text-amber-800">该学员的报告权限未开放或已到期。这里不会把空列表当作“没有测评”；请联系机构管理员确认报告授权，已有 GROW 计划和督学记录不受影响。</p>}

      {/* v274 规划课四要素表单 */}
      <div className="space-y-3">
        {/* ① 目的 */}
        <section className="rounded-xl border border-border bg-cream/60 p-3">
          <h4 className="flex items-center gap-1.5 text-[13px] font-bold text-olive"><Target size={15} />① 目的 <span className="text-[10.5px] font-normal text-olive-mute">这次陪跑为了什么（可多选）</span></h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {PURPOSE_OPTIONS.map((p) => <button key={p} type="button" onClick={() => set({ purpose: form.purpose.includes(p) ? form.purpose.filter((x) => x !== p) : [...form.purpose, p] })} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${form.purpose.includes(p) ? "border-[#0C7064]/50 bg-mint-pale text-[#0C7064]" : "border-border bg-white text-olive-mute hover:border-[#0C7064]/30"}`}>{p}</button>)}
          </div>
          <input value={form.purposeNote} onChange={(e) => set({ purposeNote: e.target.value })} placeholder="补充说明（例：本学期先稳数学，下学期冲总分）" maxLength={500} className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-[12px] text-olive outline-none placeholder:text-olive-mute/60 focus:border-[#0C7064]" />
          {!form.purpose.length && <p className="mt-1 text-[10.5px] text-amber-700">请至少选择一个目的。</p>}
        </section>

        {/* ② 目标 */}
        <section className="rounded-xl border border-border bg-cream/60 p-3">
          <h4 className="flex items-center gap-1.5 text-[13px] font-bold text-olive"><Compass size={15} />② 目标 <span className="text-[10.5px] font-normal text-olive-mute">要达到什么程度（对接学习力「成绩与目标」）</span></h4>
          <label className="mt-2 block text-[11px] font-semibold text-olive-mute">升学目标<input value={form.targetSchool} onChange={(e) => set({ targetSchool: e.target.value })} placeholder="例：三好目标中学" maxLength={60} className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[12px] font-normal text-olive outline-none focus:border-[#0C7064]" /></label>
          <div className="mt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b className="text-[11px] text-olive">学科目标（现状分 → 提升目标）</b>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => set({ subjects: academicsSubjects })} disabled={!academicsSubjects.length} className="rounded-md border border-[#0C7064]/25 bg-white px-2 py-1 text-[10px] font-semibold text-[#0C7064] hover:bg-mint-pale disabled:opacity-40">从学习力成绩目标带出</button>
                <button type="button" onClick={() => set({ subjects: [...form.subjects, { name: SUBJECT_NAMES.find((n) => !form.subjects.some((s) => s.name === n)) ?? "", baseline: null, target: null }] })} className="inline-flex items-center gap-0.5 rounded-md border border-border bg-white px-2 py-1 text-[10px] font-semibold text-olive hover:border-[#0C7064]/30"><Plus size={11} />加学科</button>
              </div>
            </div>
            {form.subjects.length > 0 && <div className="mt-2 space-y-1.5">{form.subjects.map((s, i) => <div key={i} className="grid grid-cols-[minmax(0,1fr)_76px_76px_28px] items-center gap-1.5">
              <input value={s.name} onChange={(e) => set({ subjects: form.subjects.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} placeholder="科目" maxLength={20} className="rounded-lg border border-border bg-white px-2 py-1.5 text-[12px] text-olive outline-none focus:border-[#0C7064]" />
              <input value={s.baseline ?? ""} onChange={(e) => set({ subjects: form.subjects.map((x, j) => j === i ? { ...x, baseline: e.target.value === "" ? null : Number(e.target.value) } : x) })} placeholder="现状分" inputMode="decimal" className="rounded-lg border border-border bg-white px-2 py-1.5 text-[12px] text-olive outline-none focus:border-[#0C7064]" />
              <input value={s.target ?? ""} onChange={(e) => set({ subjects: form.subjects.map((x, j) => j === i ? { ...x, target: e.target.value === "" ? null : Number(e.target.value) } : x) })} placeholder="目标分" inputMode="decimal" className="rounded-lg border border-[#0C7064]/30 bg-white px-2 py-1.5 text-[12px] font-semibold text-[#0C7064] outline-none focus:border-[#0C7064]" />
              <button type="button" onClick={() => set({ subjects: form.subjects.filter((_, j) => j !== i) })} className="flex h-7 w-7 items-center justify-center rounded-lg text-olive-mute hover:bg-red-50 hover:text-red-600" aria-label="删除该学科"><Trash2 size={13} /></button>
            </div>)}</div>}
            {form.subjects.length === 0 && <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-[11px] text-olive-mute">还没有学科目标，点「加学科」或「从学习力成绩目标带出」。</p>}
          </div>

          {/* 现状基线：E3 冰山模型参考（自动） */}
          <div className="mt-3 rounded-lg border border-dashed border-[#0C7064]/25 bg-white/80 p-2.5">
            <span className="flex items-center gap-1 text-[10.5px] font-semibold text-[#0C7064]"><BookOpen size={11} />现状基线 · 学习力测评报告参考（自动带入）</span>
            {e3v37 ? (
              <div className="mt-1.5 space-y-1">
                <div className="flex flex-wrap gap-1">
                  {(["red", "yellow", "green"] as const).map((k) => (
                    <span key={k} className="rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ background: RAG[k].bg, color: RAG[k].text, borderColor: RAG[k].border }}>
                      {RAG[k].label} · {ragGroups[k].length ? ragGroups[k].map((r) => `${r.label}${r.score.toFixed(1)}`).join("、") : "无"}
                    </span>
                  ))}
                </div>
                <p className="text-[10.5px] leading-relaxed text-olive-mute">冰山模型：Above-water 是行为表现，below-water 是动力/信心/关系等根因——红色优先干预，黄色保持关注，绿色维持放大。</p>
              </div>
            ) : <p className="mt-1.5 text-[10.5px] text-olive-mute">完成 E3 学习力诊断后，这里会按红（问题明显）/黄（有待关注）/绿（健康）整理九能与条件系统。</p>}
          </div>
          <textarea value={situationNote} onChange={(e) => setSituationNote(e.target.value)} placeholder="现状补充观察（可选）：到店表现、作业与考试细节等，会与上方测评基线一起存入评估现状。" rows={2} maxLength={4000} className="mt-2 w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-[12px] leading-relaxed text-olive outline-none placeholder:text-olive-mute/60 focus:border-[#0C7064]" />
        </section>

        {/* ③ 策略（v275：表格化，课程/目标/针对问题/课纲/频次/形式） */}
        <section className="rounded-xl border border-border bg-cream/60 p-3">
          <h4 className="flex items-center gap-1.5 text-[13px] font-bold text-olive"><ClipboardCheck size={15} />③ 策略 <span className="text-[10.5px] font-normal text-olive-mute">用哪些课程来指导（五大课表格，勾选并按孩子情况调整频次与形式）</span></h4>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-[10.5px] text-olive-mute">
                  <th className="w-8 py-1.5 font-semibold">选</th>
                  <th className="w-24 py-1.5 font-semibold">课程</th>
                  <th className="w-36 py-1.5 font-semibold">目标</th>
                  <th className="w-32 py-1.5 font-semibold">针对问题</th>
                  <th className="py-1.5 font-semibold">课纲重点</th>
                  <th className="w-32 py-1.5 font-semibold">频次安排</th>
                  <th className="w-28 py-1.5 font-semibold">形式</th>
                </tr>
              </thead>
              <tbody>
                {COURSE_OUTLINE.map((c) => {
                  const matched = weakLabels.filter((label) => (ABILITY_TO_COURSE[label] ?? []).includes(c.course));
                  const checked = form.courses.includes(c.course);
                  const plan = form.coursePlans.find((p) => p.course === c.course) ?? defaultCoursePlan(c.course);
                  const setPlan = (patch: Partial<{ frequency: string; format: string }>) => set({ coursePlans: [...form.coursePlans.filter((p) => p.course !== c.course), { course: c.course, frequency: plan.frequency, format: plan.format, ...patch }] });
                  const toggle = () => set({
                    courses: checked ? form.courses.filter((x) => x !== c.course) : [...form.courses, c.course],
                    coursePlans: checked ? form.coursePlans.filter((p) => p.course !== c.course) : (form.coursePlans.some((p) => p.course === c.course) ? form.coursePlans : [...form.coursePlans, { course: c.course, ...defaultCoursePlan(c.course) }]),
                  });
                  return <tr key={c.course} className={`border-b border-border/60 align-top transition-colors ${checked ? "bg-mint-pale/40" : "hover:bg-white/60"}`}>
                    <td className="py-2"><input type="checkbox" aria-label={`选择${c.course}`} checked={checked} onChange={toggle} className="h-4 w-4 accent-[#0C7064]" /></td>
                    <td className="py-2 pr-2"><b className="text-[12px] text-olive">{c.course}</b><span className="ml-1 rounded-full bg-butter-pale px-1.5 text-[9.5px] font-semibold text-[#9A7622]">{c.system}</span></td>
                    <td className="py-2 pr-2 text-[11px] font-semibold leading-relaxed text-[#0C7064]">{c.goal}</td>
                    <td className="py-2 pr-2">{matched.length > 0 ? <span className="rounded-full bg-[#F9E4E1] px-1.5 py-0.5 text-[9.5px] font-semibold text-[#A82524]">针对 {matched.join("、")}</span> : <span className="text-[10.5px] text-olive-mute">—</span>}</td>
                    <td className="py-2 pr-2 text-[10.5px] leading-relaxed text-olive-mute">{c.outline}</td>
                    <td className="py-2 pr-1"><input value={plan.frequency} onChange={(e) => setPlan({ frequency: e.target.value })} placeholder="如：每周 1 次" maxLength={40} disabled={!checked} className="w-full rounded-md border border-border bg-white px-1.5 py-1 text-[11px] text-olive outline-none focus:border-[#0C7064] disabled:opacity-40" /></td>
                    <td className="py-2"><select value={plan.format} onChange={(e) => setPlan({ format: e.target.value })} disabled={!checked} className="w-full rounded-md border border-border bg-white px-1 py-1 text-[11px] text-olive outline-none focus:border-[#0C7064] disabled:opacity-40">{COURSE_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}</select></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          {!form.courses.length && <p className="mt-2 text-[10.5px] text-amber-700">请至少勾选一门课程；系统已按测评短板给出「针对」建议。</p>}
          <textarea value={form.strategyNote} onChange={(e) => set({ strategyNote: e.target.value })} placeholder="策略补充（可选）：课程组合节奏、一对一/沙龙/督学安排、前三个月与后三个月的过渡等。" rows={2} maxLength={2000} className="mt-2 w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-[12px] leading-relaxed text-olive outline-none placeholder:text-olive-mute/60 focus:border-[#0C7064]" />
        </section>

        {/* ④ 衡量 */}
        <section className="rounded-xl border border-border bg-cream/60 p-3">
          <h4 className="flex items-center gap-1.5 text-[13px] font-bold text-olive"><TrendingUp size={15} />④ 衡量 <span className="text-[10.5px] font-normal text-olive-mute">怎么知道做到了（每周修正项 + 大考分数）</span></h4>
          <b className="mt-2 block text-[11px] text-olive">每周修正项</b>
          <div className="mt-1.5 space-y-1.5">{form.weekly.map((w, i) => <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28px] items-center gap-1.5">
            <input value={w.item} onChange={(e) => set({ weekly: form.weekly.map((x, j) => j === i ? { ...x, item: e.target.value } : x) })} placeholder="本周要修正什么（例：数学错题当天重做）" maxLength={100} className="rounded-lg border border-border bg-white px-2 py-1.5 text-[12px] text-olive outline-none focus:border-[#0C7064]" />
            <input value={w.metric} onChange={(e) => set({ weekly: form.weekly.map((x, j) => j === i ? { ...x, metric: e.target.value } : x) })} placeholder="对应分数/指标（例：周测 ≥85）" maxLength={60} className="rounded-lg border border-border bg-white px-2 py-1.5 text-[12px] text-olive outline-none focus:border-[#0C7064]" />
            <button type="button" onClick={() => set({ weekly: form.weekly.filter((_, j) => j !== i) })} disabled={form.weekly.length <= 1} className="flex h-7 w-7 items-center justify-center rounded-lg text-olive-mute hover:bg-red-50 hover:text-red-600 disabled:opacity-30" aria-label="删除该修正项"><X size={13} /></button>
          </div>)}</div>
          <button type="button" onClick={() => set({ weekly: [...form.weekly, { item: "", metric: "" }] })} className="mt-1.5 inline-flex items-center gap-0.5 rounded-md border border-border bg-white px-2 py-1 text-[10px] font-semibold text-olive hover:border-[#0C7064]/30"><Plus size={11} />加修正项</button>
          {!weeklyFilled.length && <p className="mt-1 text-[10.5px] text-amber-700">请至少填写一条每周修正项。</p>}

          <b className="mt-3 block text-[11px] text-olive">大考成绩追踪</b>
          <div className="mt-1.5 space-y-1.5">{form.exams.map((ex, i) => <div key={i} className="grid grid-cols-[minmax(0,1fr)_118px_minmax(0,1fr)_28px] items-center gap-1.5">
            <input value={ex.name} onChange={(e) => set({ exams: form.exams.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} placeholder="考试名称（例：期中考试）" maxLength={40} className="rounded-lg border border-border bg-white px-2 py-1.5 text-[12px] text-olive outline-none focus:border-[#0C7064]" />
            <input type="date" value={ex.date} onChange={(e) => set({ exams: form.exams.map((x, j) => j === i ? { ...x, date: e.target.value } : x) })} className="rounded-lg border border-border bg-white px-2 py-1.5 text-[12px] text-olive outline-none focus:border-[#0C7064]" />
            <input value={ex.scores} onChange={(e) => set({ exams: form.exams.map((x, j) => j === i ? { ...x, scores: e.target.value } : x) })} placeholder="分数/各科情况" maxLength={200} className="rounded-lg border border-border bg-white px-2 py-1.5 text-[12px] text-olive outline-none focus:border-[#0C7064]" />
            <button type="button" onClick={() => set({ exams: form.exams.filter((_, j) => j !== i) })} className="flex h-7 w-7 items-center justify-center rounded-lg text-olive-mute hover:bg-red-50 hover:text-red-600" aria-label="删除该考试"><Trash2 size={13} /></button>
          </div>)}</div>
          <button type="button" onClick={() => set({ exams: [...form.exams, { name: "", date: "", scores: "" }] })} className="mt-1.5 inline-flex items-center gap-0.5 rounded-md border border-border bg-white px-2 py-1 text-[10px] font-semibold text-olive hover:border-[#0C7064]/30"><Plus size={11} />加大考记录</button>
        </section>
      </div>

      <div className="rounded-xl border border-[#0C7064]/15 bg-mint-pale/40 p-3">
        <div className="flex items-center gap-2 text-[13px] font-bold text-olive"><ClipboardCheck size={15} /> 督学陪跑</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center text-[11px] text-olive-mute sm:grid-cols-4"><span className="rounded-lg bg-white p-2"><b className="block text-[17px] text-olive">{data?.supervisions.length ?? 0}</b>到店督学</span><span className="rounded-lg bg-white p-2"><b className="block text-[17px] text-olive">{data?.checkins.length ?? 0}</b>日检验</span><span className="rounded-lg bg-white p-2"><b className="block text-[17px] text-olive">{data?.sessions.length ?? 0}</b>课堂记录</span><span className="rounded-lg bg-white p-2"><b className="block text-[17px] text-olive">{pending}</b>待验收</span></div>
        {latest.length > 0 && <div className="mt-2 space-y-1">{latest.map((r) => <div key={r.id} className={`flex items-center justify-between rounded-lg px-2 py-1 text-[11px] ${r.id === initialResultId ? "bg-white font-semibold text-[#0C7064]" : "text-olive-soft"}`}><span>{r.id === initialResultId ? "本次纳入 · " : ""}{KIND[r.kind] ?? r.kind}</span><time>{new Date(r.createdAt).toLocaleDateString("zh-CN")}</time></div>)}</div>}
        {data && onOpenCoaching && <button type="button" onClick={() => onOpenCoaching(data.coachingCase.id)} className="mt-3 w-full rounded-lg border border-[#0C7064]/20 bg-white py-2 text-[12px] font-semibold text-[#0C7064] hover:bg-mint-pale">进入独立陪跑：计划、课堂、验收与反馈 →</button>}
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>}
      <button type="button" onClick={save} disabled={saving || !formValid} className="w-full rounded-xl bg-[#0C7064] py-2.5 text-[13px] font-semibold text-white hover:bg-[#095c53] disabled:opacity-40">{saving ? "正在保存…" : data ? "保存课程设计（GROW 草稿与计划版本）" : "保存课程设计草稿，建立陪跑主档"}</button>
      <p className="text-center text-[10.5px] leading-relaxed text-olive-mute">此快捷入口只保存内部草稿；请继续在“计划三方会签”中由教练提交、学生与至少一位监护人本人确认后，计划才正式生效。</p>
      {(create.isSuccess || update.isSuccess) && <p className="text-center text-[11px] text-[#2F7A41]">草稿已保存，历史计划版本与服务场景周期均保留；仍需完成三方会签。</p>}
    </div>}
  </section>;
}
