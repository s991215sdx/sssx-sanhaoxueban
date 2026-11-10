import { useEffect, useMemo, useState } from "react";
import { BookOpen, ClipboardCheck, Compass, FileText, Target, TrendingUp } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { COACHING_SCENARIOS, coachingScenarioLabel, type CoachingScenarioKey } from "@contracts/orgService";
import { isE3V37Result } from "@contracts/e3v37";

/** v273：五大课课纲重点（源自《学业生涯陪跑·五大课程大纲》），用于把测评短板映射到课程落点。 */
const COURSE_OUTLINE: { course: string; aim: string; outline: string }[] = [
  { course: "规划课", aim: "找准方向：看清真实水平与升学路径", outline: "全维度测评 · 考情解读 · 升学目标定位与拆分 · 学业＋升学双方案（每学期滚动修订）" },
  { course: "心法课", aim: "愿学习：点燃内驱、重建恒定评价标准", outline: "立志（修齐治平）· 三观 · 秀塔 · 三个钱袋子 · 三大主义 · 教育选型 · 楼层驱动 · 心力能量训练" },
  { course: "技法课", aim: "会学习：三阶九能与全学科方法策略", outline: "12 次课：综合测评与立志 → 全科学习策略 → 计划与总结 → 复盘与费曼输出 → 高效作业 → 预习与听课 → 笔记与思维导图 → 错题整理 → 试卷分析 → 专注力与时间管理 → 记忆流程与技巧 → 考前心态与考场策略" },
  { course: "督学课", aim: "真学习：把计划变成结果", outline: "周计划落地 · 日检验·周复盘·月家长会 · 费曼输出训练 · 痕迹管理 · 试卷分析" },
  { course: "亲子课", aim: "改善支持系统：亲子沟通与家庭氛围", outline: "YES 模型（接纳→探索→解决）· 亲子美言 · 五型防御机制 · 家访" },
];

/** 九能 → 课程映射：乐学进心法课，会学进技法课，善学进督学课＋技法课，条件系统进亲子课。 */
const ABILITY_TO_COURSE: Record<string, string[]> = {
  动力: ["心法课"], 信心: ["心法课"], 韧劲: ["心法课"],
  学懂: ["技法课"], 记住: ["技法课"], 会用: ["技法课"],
  计划: ["督学课", "技法课"], 复盘: ["督学课", "技法课"], 智学: ["技法课", "督学课"],
  状态: ["亲子课"], 关系: ["亲子课"], 资源: ["亲子课"],
};

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

/** 测评右侧与独立陪跑共用的 GROW 编辑器；实际数据来自共享陪跑主档。 */
export default function GrowEditor({ studentUserId, initialResultId, onOpenReport, onOpenCoaching }: { studentUserId: number; initialResultId?: number; onOpenReport?: () => void; onOpenCoaching?: (caseId: number) => void }) {
  const utils = trpc.useUtils();
  const { data: cases } = trpc.coaching.cases.useQuery();
  const [createdCaseId, setCreatedCaseId] = useState<number | null>(null);
  const [, setEditorOpen] = useState(false);
  const current = useMemo(() => cases?.find((c) => c.coachingCase.studentUserId === studentUserId), [cases, studentUserId]);
  const caseId = current?.coachingCase.id ?? createdCaseId ?? 0;
  const { data, isLoading } = trpc.coaching.detail.useQuery({ caseId }, { enabled: caseId > 0 });
  /* v273：取学员档案与测评结果，给 GROW 三栏提供「报告参考」（明确目标=理清现状与目标；
     评估现状=冰山模型 RAG；定制计划=建议进步方案＋五大课落点）。 */
  const { data: studentDetail } = trpc.coach.studentDetail.useQuery({ userId: studentUserId });
  const [goal, setGoal] = useState(""); const [situation, setSituation] = useState(""); const [plan, setPlan] = useState("");
  const [scenarios, setScenarios] = useState<CoachingScenarioKey[]>([]);
  const [scenarioChangeReason, setScenarioChangeReason] = useState("");
  const [start, setStart] = useState(dateAfter(0)); const [end, setEnd] = useState(dateAfter(180));
  useEffect(() => {
    setCreatedCaseId(null);
    setEditorOpen(false);
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
  const selectedResult = data?.results.find((result) => result.id === initialResultId);
  const latest = selectedResult ? [selectedResult, ...(data?.results.filter((result) => result.id !== initialResultId) ?? [])].slice(0, 4) : data?.results.slice(0, 4) ?? [];

  /* v273：报告参考数据 */
  const e3v37 = isE3V37Result(studentDetail?.assessments.e3) ? studentDetail.assessments.e3 : null;
  const ragGroups = useMemo(() => {
    const rows: { label: string; score: number; rag: string; system: string }[] = (e3v37?.abilities ?? []).map((a) => ({ label: a.label, score: a.score, rag: LEVEL_TO_RAG[a.level] ?? "green", system: a.system }));
    for (const cell of e3v37?.systems.condition.cells ?? []) rows.push({ label: cell.label, score: cell.score, rag: LEVEL_TO_RAG[cell.level] ?? "green", system: "条件" });
    return { red: rows.filter((r) => r.rag === "red"), yellow: rows.filter((r) => r.rag === "yellow"), green: rows.filter((r) => r.rag === "green") };
  }, [e3v37]);
  const profile = studentDetail?.profile;
  const academics = studentDetail?.academics;
  /** 明确目标参考：理清现状与目标（档案 + 成绩差距） */
  const goalRef = useMemo(() => {
    if (!profile && !academics?.subjects.length) return "";
    const parts: string[] = [];
    if (profile) parts.push(`${profile.grade ?? "未填年级"} · ${profile.school ?? "未填学校"}${profile.targetSchool ? `，目标：${profile.targetSchool}` : "，尚未填写目标学校"}`);
    const gaps = (academics?.subjects ?? []).filter((s) => s.lastScore != null && s.targetScore != null);
    if (gaps.length) parts.push(`成绩现状与目标：${gaps.map((s) => `${s.name} ${s.lastScore}→${s.targetScore}（差 ${s.targetScore! - s.lastScore!}）`).join("；")}`);
    return parts.join("；");
  }, [profile, academics]);
  /** 评估现状参考：冰山模型 RAG（问题明显红 / 有待关注黄 / 健康绿） */
  const situationRef = useMemo(() => {
    if (!e3v37) return "";
    const fmt = (list: { label: string; score: number }[]) => list.map((r) => `${r.label} ${r.score.toFixed(1)}`).join("、") || "无";
    return `E3 学习力诊断（${e3v37.stageLabel}，5 分制）：问题明显——${fmt(ragGroups.red)}；有待关注——${fmt(ragGroups.yellow)}；健康——${fmt(ragGroups.green)}。`;
  }, [e3v37, ragGroups]);
  /** 定制计划参考：建议进步方案 → 五大课落点 */
  const planRef = useMemo(() => {
    const weakLabels = [...ragGroups.red, ...ragGroups.yellow].map((r) => r.label);
    const hit = (course: string) => weakLabels.filter((label) => (ABILITY_TO_COURSE[label] ?? []).includes(course));
    const lines = COURSE_OUTLINE.map((c) => {
      const matched = hit(c.course);
      const prefix = matched.length ? `针对「${matched.join("、")}」：` : "";
      return `· ${c.course}（${c.aim}）：${prefix}${c.outline}`;
    });
    return `依据测评短板给出的五大课落点（可在下方继续补充细化）：\n${lines.join("\n")}`;
  }, [ragGroups]);
  const applyRef = (setter: (s: string) => void, current: string, ref: string) => {
    if (!ref) return;
    setter(current.trim() ? `${current.replace(/\s+$/, "")}\n${ref}` : ref);
  };
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
      <GrowField icon={<Target size={15} />} title="明确目标" subtitle="Goal · 将期待变成可验证的目标" value={goal} onChange={setGoal} placeholder="例：本学期数学从 82 分提升至 95 分，能独立讲解错题。"
        reference={<GrowReference applyLabel="填入目标参考" onApply={() => applyRef(setGoal, goal, goalRef)} empty={!goalRef}>
          {goalRef ? <p className="text-[10.5px] leading-relaxed text-olive-soft">{goalRef}</p> : <p className="text-[10.5px] text-olive-mute">完成学习力测评并填写档案/成绩目标后，这里会自动带出「理清现状与目标」。</p>}
        </GrowReference>} />
      <GrowField icon={<TrendingUp size={15} />} title="评估现状" subtitle="Reality · 结合报告、成绩与到店观察" value={situation} onChange={setSituation} placeholder="例：基础概念掌握不稳，作业拖延；已完成 E3，需进一步验证执行卡点。"
        reference={<GrowReference applyLabel="填入现状参考" onApply={() => applyRef(setSituation, situation, situationRef)} empty={!situationRef}>
          {e3v37 ? (
            <div className="mt-1 space-y-1">
              <div className="flex flex-wrap gap-1">
                {(["red", "yellow", "green"] as const).map((k) => (
                  <span key={k} className="rounded-full border px-2 py-0.5 text-[10px] font-semibold" style={{ background: RAG[k].bg, color: RAG[k].text, borderColor: RAG[k].border }}>
                    {RAG[k].label} · {ragGroups[k].length ? ragGroups[k].map((r) => `${r.label}${r.score.toFixed(1)}`).join("、") : "无"}
                  </span>
                ))}
              </div>
              <p className="text-[10.5px] leading-relaxed text-olive-mute">冰山模型： Above-water 是行为表现，below-water 是动力/信心/关系等根因——红色优先干预，黄色保持关注，绿色维持放大。</p>
            </div>
          ) : <p className="text-[10.5px] text-olive-mute">完成 E3 学习力诊断后，这里会按红（问题明显）/黄（有待关注）/绿（健康）整理九能与条件系统。</p>}
        </GrowReference>} />
      <GrowField icon={<Compass size={15} />} title="定制计划" subtitle="Options / Will · 形成四级计划与责任分工" value={plan} onChange={setPlan} placeholder="例：前三个月每周一对一教练＋督学，后三个月评估是否进入学习坊；每日检验、每周复盘。"
        reference={<GrowReference applyLabel="填入计划参考" onApply={() => applyRef(setPlan, plan, planRef)} empty={!planRef}>
          <ul className="mt-1 space-y-1">
            {COURSE_OUTLINE.map((c) => {
              const matched = [...ragGroups.red, ...ragGroups.yellow].filter((r) => (ABILITY_TO_COURSE[r.label] ?? []).includes(c.course)).map((r) => r.label);
              return <li key={c.course} className="text-[10.5px] leading-relaxed text-olive-soft">
                <b className="text-olive">{c.course}</b>{matched.length > 0 && <span className="ml-1 rounded-full bg-[#F9E4E1] px-1.5 text-[9.5px] font-semibold text-[#A82524]">针对 {matched.join("、")}</span>}<span className="text-olive-mute"> — {c.outline}</span>
              </li>;
            })}
          </ul>
        </GrowReference>} />
      <div className="rounded-xl border border-[#0C7064]/15 bg-mint-pale/40 p-3">
        <div className="flex items-center gap-2 text-[13px] font-bold text-olive"><ClipboardCheck size={15} /> 督学陪跑</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center text-[11px] text-olive-mute sm:grid-cols-4"><span className="rounded-lg bg-white p-2"><b className="block text-[17px] text-olive">{data?.supervisions.length ?? 0}</b>到店督学</span><span className="rounded-lg bg-white p-2"><b className="block text-[17px] text-olive">{data?.checkins.length ?? 0}</b>日检验</span><span className="rounded-lg bg-white p-2"><b className="block text-[17px] text-olive">{data?.sessions.length ?? 0}</b>课堂记录</span><span className="rounded-lg bg-white p-2"><b className="block text-[17px] text-olive">{pending}</b>待验收</span></div>
        {latest.length > 0 && <div className="mt-2 space-y-1">{latest.map((r) => <div key={r.id} className={`flex items-center justify-between rounded-lg px-2 py-1 text-[11px] ${r.id === initialResultId ? "bg-white font-semibold text-[#0C7064]" : "text-olive-soft"}`}><span>{r.id === initialResultId ? "本次纳入 · " : ""}{KIND[r.kind] ?? r.kind}</span><time>{new Date(r.createdAt).toLocaleDateString("zh-CN")}</time></div>)}</div>}
        {data && onOpenCoaching && <button type="button" onClick={() => onOpenCoaching(data.coachingCase.id)} className="mt-3 w-full rounded-lg border border-[#0C7064]/20 bg-white py-2 text-[12px] font-semibold text-[#0C7064] hover:bg-mint-pale">进入独立陪跑：计划、课堂、验收与反馈 →</button>}
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>}
      <button type="button" onClick={save} disabled={saving || !formValid} className="w-full rounded-xl bg-[#0C7064] py-2.5 text-[13px] font-semibold text-white hover:bg-[#095c53] disabled:opacity-40">{saving ? "正在保存…" : data ? "保存 GROW 草稿与计划版本" : "保存方案草稿，建立陪跑主档"}</button>
      <p className="text-center text-[10.5px] leading-relaxed text-olive-mute">此快捷入口只保存内部草稿；请继续在“计划三方会签”中由教练提交、学生与至少一位监护人本人确认后，计划才正式生效。</p>
      {(create.isSuccess || update.isSuccess) && <p className="text-center text-[11px] text-[#2F7A41]">草稿已保存，历史计划版本与服务场景周期均保留；仍需完成三方会签。</p>}
    </div>}
  </section>;
}

function GrowField({ icon, title, subtitle, value, onChange, placeholder, reference }: { icon: React.ReactNode; title: string; subtitle: string; value: string; onChange: (s: string) => void; placeholder: string; reference?: React.ReactNode }) {
  return <label className="block rounded-xl border border-border bg-cream/60 p-3">
    <span className="flex items-center gap-1.5 text-[13px] font-bold text-olive">{icon}{title}</span>
    <span className="mt-0.5 block text-[10.5px] text-olive-mute">{subtitle}</span>
    {reference}
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="mt-2 w-full resize-y rounded-lg border border-border bg-white px-3 py-2 text-[12px] leading-relaxed text-olive outline-none placeholder:text-olive-mute/60 focus:border-[#0C7064]" />
  </label>;
}

/** v273：报告参考块——学习力测评报告摘要，可一键填入上方输入框后再手动补充。 */
function GrowReference({ children, applyLabel, onApply, empty }: { children: React.ReactNode; applyLabel: string; onApply: () => void; empty?: boolean }) {
  return <div className="mt-2 rounded-lg border border-dashed border-[#0C7064]/25 bg-white/80 p-2.5">
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1 text-[10.5px] font-semibold text-[#0C7064]"><BookOpen size={11} /> 学习力测评报告参考</span>
      <button type="button" onClick={onApply} disabled={!!empty} className="rounded-md bg-[#0C7064]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0C7064] hover:bg-[#0C7064]/20 disabled:cursor-not-allowed disabled:opacity-40">{applyLabel} ↓</button>
    </div>
    <div className="mt-1.5">{children}</div>
  </div>;
}
