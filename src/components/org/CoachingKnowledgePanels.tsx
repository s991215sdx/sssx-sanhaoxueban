import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, BookOpenCheck, CalendarCheck2, Check, Copy, GitCompareArrows, Lightbulb, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { isE3V37Result } from "@contracts/e3v37";
import { trpc } from "@/providers/trpc";
import type { CoachingDetail } from "./coachingTypes";
import { PARENT_CARDS, cardForDate, compareLatestE3, resolveGrowthStage, stageTipFor } from "./knowledgeBase";

function Panel({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border bg-white p-4 shadow-sm"><h3 className="flex items-center gap-1.5 text-[15px] font-bold text-olive">{icon}{title}</h3><div className="mt-3">{children}</div></section>;
}
const KIND: Record<string, string> = { mentalsdq: "心理健康 A 版", mentalpa: "心理健康 B 版", scl90: "SCL-90", mental: "心理健康通用版" };
const COURSE_GOALS: Record<string, string> = { 规划课: "目标明确、路径清晰", 心法课: "心智成长、认知发展", 技法课: "校内学法优化、校外 AI 学习", 督学课: "高效执行、温度陪伴", 亲子美言课: "学会说话、关系亲密" };

function courseForAbility(label: string) {
  if (/动力|情绪|信心|状态|关系/.test(label)) return "心法课";
  if (/计划|方法|复盘|理解|记忆|思维/.test(label)) return "技法课";
  if (/执行|习惯|行动/.test(label)) return "督学课";
  return "规划课";
}

/** 规划建议只作为草稿，不覆盖任何已会签方案。 */
export function PlanningKnowledgePanel({ data, onUse }: { data: CoachingDetail; onUse: (text: string) => void }) {
  const { data: student } = trpc.coach.studentDetail.useQuery({ userId: data.coachingCase.studentUserId });
  const e3 = isE3V37Result(student?.assessments.e3) ? student.assessments.e3 : null;
  const growth = resolveGrowthStage({ birthDate: data.profile?.birthDate, grade: student?.profile?.grade });
  const suggestions = useMemo(() => {
    const priority = e3?.abilities.filter((ability) => ability.level !== "正常").sort((a, b) => a.score - b.score).slice(0, 3) ?? [];
    const mapped = new Map<string, string[]>();
    for (const ability of priority) {
      const course = courseForAbility(ability.label);
      mapped.set(course, [...(mapped.get(course) ?? []), `${ability.label}（${ability.score.toFixed(1)} 分，${ability.level}）`]);
    }
    if (!mapped.has("规划课")) mapped.set("规划课", ["先核对现状与目标，形成总体规划和首月行动；每月教研动态调整"]);
    if (!mapped.has("亲子美言课")) mapped.set("亲子美言课", ["结合家庭期望与沟通观察安排一个周期，练习具体欣赏、倾听和亲密关系修复"]);
    if (!mapped.has("督学课")) mapped.set("督学课", ["每次到店必有，核对行动证据与明日第一步"]);
    return [...mapped.entries()];
  }, [e3]);
  const draft = [
    "【规划建议草稿 · 须伴学师核对】",
    `阶段参考：${growth ? `${growth.stage.name}，重点支持${growth.stage.quality}；${growth.stage.repairAdvice}` : "生日或年级未补全，先通过访谈确认成长阶段特点。"}`,
    "首月重点：建立关系、核对目标、观察真实执行，先完成总体规划与首月行动设计。",
    ...suggestions.map(([course, reasons]) => `${course}（${COURSE_GOALS[course]}）：${reasons.join("、")}`),
    "服务节奏：前三个月均为一对一教练课＋督学，督学每次必有；后三个月经月度教研评估，可继续一对一，也可调整为沙龙／学习坊，督学继续保留。",
    "每月最后一周教研会：完成月总结、同口径证据复核和下月动态调整；家长通过既有月报流程收到月反馈及下月计划。",
    "说明：由测评与规则生成，不替代真人观察，不自动覆盖已会签计划。",
  ].join("\n");
  return <Panel title="测评 × 成长阶段 · 规划建议" icon={<Lightbulb size={16} />}>
    {!e3 && <p className="mb-2 rounded-lg bg-amber-50 p-2.5 text-[11px] text-amber-900">暂无 V3.7 E3：以下仅提供服务节奏与观察建议，不虚构能力弱项。</p>}
    <div className="grid gap-2 sm:grid-cols-2">{suggestions.map(([course, reasons]) => <article key={course} className="rounded-xl bg-cream/50 p-3"><b className="text-[12px] text-olive">{course}</b><span className="ml-1.5 text-[10px] text-[#0C7064]">{COURSE_GOALS[course]}</span><p className="mt-1.5 text-[11px] leading-relaxed text-olive-soft">{reasons.join("、")}</p></article>)}</div>
    <p className="mt-3 text-[11px] leading-relaxed text-olive-mute">前三个月一对一＋督学；后三个月经教研评估决定一对一或沙龙／学习坊，督学始终保留。首月先建立关系、观察与核对目标。</p>
    <button type="button" onClick={() => onUse(draft)} className="mt-3 min-h-10 rounded-xl border border-[#0C7064]/30 px-3 py-2 text-[11.5px] font-semibold text-[#0C7064]"><ArrowRight size={14} className="mr-1 inline" />填入计划草稿（不自动保存）</button>
  </Panel>;
}

/** 家长正文不带来源、书名或页码，复制后仍走现有反馈／月报授权。 */
export function ParentKnowledgeCard({ data }: { data: CoachingDetail }) {
  const { data: student } = trpc.coach.studentDetail.useQuery({ userId: data.coachingCase.studentUserId });
  const [message, setMessage] = useState("");
  const card = cardForDate();
  const growth = resolveGrowthStage({ birthDate: data.profile?.birthDate, grade: student?.profile?.grade });
  const stageTip = growth ? stageTipFor(growth.stage, card) : "孩子阶段信息未补全，请先按实际年龄判断这条建议是否合适。";
  const text = [`今日家长知识卡片｜${card.title}`, `心路语录：${card.quote}`, `今日知识点：${card.knowledge}`, `可以这样做：\n${card.steps.map((step, index) => `${index + 1}. ${step}`).join("\n")}`, `小提醒：${card.reminder}`, `今晚小练习：${card.practice}`, `给这个阶段家庭的提醒：${stageTip}`].join("\n\n");
  const copy = async () => {
    setMessage("");
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement("textarea"); area.value = text; area.style.position = "fixed"; area.style.opacity = "0";
        document.body.appendChild(area); area.select(); const ok = document.execCommand("copy"); area.remove();
        if (!ok) throw new Error("copy failed");
      }
      setMessage("已复制。请粘贴到既有课堂反馈或月报，核对并确认对象后再发送。");
    } catch { setMessage("复制失败，请手动选择卡片文字复制；系统未推送任何内容。"); }
  };
  return <Panel title="每日家长知识卡片" icon={<BookOpenCheck size={16} />}>
    <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-mint-pale px-2.5 py-1 text-[10px] text-[#0C7064]">{new Date().toLocaleDateString("zh-CN")} · 第 {card.id} / {PARENT_CARDS.length} 张</span>{growth && <span className="rounded-full bg-cream px-2.5 py-1 text-[10px] text-olive-soft">{growth.stage.name}{growth.source === "grade" ? " · 年级估算" : " · 生日"}</span>}<button type="button" onClick={copy} className="ml-auto min-h-9 rounded-lg border border-[#0C7064]/25 px-2.5 py-1.5 text-[11px] font-semibold text-[#0C7064]"><Copy size={13} className="mr-1 inline" />复制引用到反馈</button></div>
    <article className="mt-3 rounded-2xl border border-[#D7C89F] bg-[#FFFCF3] p-4">
      <h4 className="text-[17px] font-bold text-olive">{card.title}</h4><p className="mt-2 border-l-2 border-[#B59752] pl-3 text-[12px] leading-relaxed text-olive-soft">{card.quote}</p>
      <div className="mt-3 text-[12px] leading-relaxed text-olive"><b>今日知识点</b><p className="mt-1">{card.knowledge}</p></div>
      <div className="mt-3 text-[12px] leading-relaxed text-olive"><b>可以这样做</b><ol className="mt-1 list-decimal space-y-1 pl-5">{card.steps.map((step) => <li key={step}>{step}</li>)}</ol></div>
      <p className="mt-3 rounded-lg bg-amber-50 p-2.5 text-[11.5px] leading-relaxed text-amber-900"><b>小提醒：</b>{card.reminder}</p>
      <p className="mt-2 rounded-lg bg-mint-pale/55 p-2.5 text-[11.5px] leading-relaxed text-olive"><b>今晚小练习：</b>{card.practice}</p>
      <p className="mt-2 text-[11.5px] leading-relaxed text-olive-soft"><b>给这个阶段家庭的提醒：</b>{stageTip}</p>
    </article>
    <p className="mt-2 text-[10.5px] leading-relaxed text-olive-mute">当前仅为预览与复制，不会自动推送；须通过既有课堂反馈或月报，经伴学师核对并授权后发送。</p>
    {message && <p role="status" className={`mt-2 text-[11px] ${message.startsWith("已复制") ? "text-green-700" : "text-red-700"}`}>{message}</p>}
  </Panel>;
}

export function buildNextActionAdvice(data: Pick<CoachingDetail, "reviews" | "checkins" | "tasks" | "profile">, today = new Date()) {
  const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 6);
  const recentDates = new Set(data.checkins.filter((row) => new Date(`${row.checkDate}T12:00:00`) >= cutoff).map((row) => row.checkDate));
  const pending = data.tasks.filter((task) => task.status !== "verified");
  const review = data.reviews[0];
  const previous = data.reviews[1];
  const lines = [
    review ? `承接${review.periodKey}复盘：${review.nextActions}` : "先完成一次事实复盘，写清目标、证据、责任人和复验时间。",
    recentDates.size ? `近 7 天已有 ${recentDates.size} 天日检验；先核对最近一次弱项是否已形成订正证据。` : "近 7 天暂无日检验：先补一次真实学习观察，不用补写虚假打卡。",
    pending.length ? `还有 ${pending.length} 项行动未验收，优先处理「${pending[0].title}」（截止 ${pending[0].dueDate}）。` : "当前行动均已验收，可围绕下一个小目标设置可验证的新行动。",
  ];
  if (previous) lines.push(`对照前次 ${previous.periodKey} 复盘，确认旧问题是否重复出现，再决定是否调整课程策略。`);
  if (data.profile?.attention.trim()) lines.push(`结合画像注意事项复核：${data.profile.attention.trim()}`);
  return lines.join("\n");
}

export function GrowthKnowledgePanel({ data, onUse }: { data: CoachingDetail; onUse: (text: string) => void }) {
  const advice = buildNextActionAdvice(data);
  const comparison = compareLatestE3(data.e3Results);
  const months = Math.max(0, (Date.now() - Date.parse(`${data.coachingCase.serviceStart}T00:00:00`)) / (30.44 * 86400000));
  const hasStageReview = data.reviews.some((review) => review.period === "term");
  return <>
    <Panel title="下一步建议 · 历史复盘与画像联动" icon={<Sparkles size={16} />}>
      <p className="whitespace-pre-wrap rounded-xl bg-mint-pale/35 p-3 text-[11.5px] leading-relaxed text-olive-soft">{advice}</p>
      <p className="mt-2 text-[10.5px] text-olive-mute">这是基于现有记录的规则建议，不是自动诊断；只填入复盘草稿，人工保存后才形成新版本。</p>
      <button type="button" onClick={() => onUse(advice)} className="mt-3 min-h-10 rounded-xl border border-[#0C7064]/30 px-3 py-2 text-[11.5px] font-semibold text-[#0C7064]"><ArrowRight size={14} className="mr-1 inline" />填入下一步行动</button>
    </Panel>
    <Panel title="E3 同口径复测对比" icon={<GitCompareArrows size={16} />}>
      {comparison ? <div className="overflow-x-auto"><table className="w-full min-w-[400px] border-collapse text-center text-[12px]"><thead><tr className="bg-cream text-olive"><th className="rounded-l-lg px-3 py-2 text-left">境·心·脑·行</th><th className="px-3 py-2">前次 #{comparison.previous.id}</th><th className="px-3 py-2">最近 #{comparison.current.id}</th><th className="rounded-r-lg px-3 py-2">变化</th></tr></thead><tbody>{comparison.dimensions.map((row) => <tr key={row.key} className="border-b border-border/60"><td className="px-3 py-2 text-left font-bold text-olive">{row.key}</td><td className="px-3 py-2">{row.before?.toFixed(1) ?? "—"}</td><td className="px-3 py-2">{row.current?.toFixed(1) ?? "—"}</td><td className={`px-3 py-2 font-semibold ${row.delta === null ? "text-olive-mute" : row.delta > 0 ? "text-green-700" : row.delta < 0 ? "text-red-700" : "text-olive"}`}>{row.delta === null ? "—" : `${row.delta > 0 ? "+" : ""}${row.delta.toFixed(1)}`}</td></tr>)}</tbody></table><p className="mt-2 text-[10.5px] text-olive-mute">仅比较最近两份 V3.7 报告均分，旧版不参与；分数变化须结合真人观察，不能单独作为效果结论。</p></div> : <p className="rounded-lg bg-cream/50 p-3 text-[11.5px] leading-relaxed text-olive-mute">同版本复测不足两份，暂不生成变化值。已有旧版结果仍保留，但不会与 V3.7 混合比较。</p>}
      <div className={`mt-3 rounded-lg p-3 text-[11px] leading-relaxed ${months >= 3 && !hasStageReview ? "bg-amber-50 text-amber-900" : "bg-cream/50 text-olive-soft"}`}>{months >= 3 ? hasStageReview ? "已有学期／阶段复盘记录，请在教研会核对阶段证据与后续服务形式。" : "服务已满约三个月：请安排阶段评估，经教研记录后再决定继续一对一或改为沙龙／学习坊；当前未标记为已通过。" : "尚未满约三个月：维持一对一教练课＋督学，以月度证据持续评估。"}</div>
    </Panel>
  </>;
}

export function WeekdayCheckinGrid({ data }: { data: CoachingDetail }) {
  const dates = Array.from({ length: 5 }, (_, index) => { const date = new Date(); const day = date.getDay() || 7; date.setDate(date.getDate() - day + index + 1); return date; });
  return <Panel title="本周平日督学打卡" icon={<CalendarCheck2 size={16} />}>
    <p className="mb-3 text-[11px] leading-relaxed text-olive-mute">周一至周五，数据来自既有结构化日检验；同日多版本只取最高版本。网格只读，补录或更正请在下方日检验表单完成。</p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{dates.map((date) => {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      const latest = data.checkins.filter((row) => row.checkDate === key).sort((a, b) => b.version - a.version)[0];
      return <div key={key} className={`rounded-xl border p-3 ${latest ? "border-[#0C7064]/20 bg-mint-pale/35" : "border-dashed border-border bg-cream/40"}`}><b className="text-[11px] text-olive">{date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit", weekday: "short" })}</b>{latest ? <div className="mt-2 text-[11px] leading-relaxed text-olive-soft"><span className="block text-[#0C7064]">已打卡 · V{latest.version}</span><span className="mt-1 block">完成 {latest.completionRate}%</span><span>准确 {latest.accuracyRate}%</span></div> : <span className="mt-2 block text-[11px] text-olive-mute">未打卡</span>}</div>;
    })}</div>
  </Panel>;
}

export function MonthlyRhythmPanel({ data }: { data: CoachingDetail }) {
  const month = new Date().toLocaleDateString("en-CA").slice(0, 7);
  const { data: reports = [] } = trpc.coaching.monthlyReports.useQuery({ caseId: data.coachingCase.id });
  const monthlyReview = data.reviews.find((review) => review.period === "month" && review.periodKey === month);
  const report = reports.find((item) => item.month === month);
  const pushed = report ? data.resourceRecipients.some((grant) => grant.resourceType === "monthly_report" && grant.resourceId === report.id && !grant.revokedAt) || Boolean(report.pushedAt) : false;
  const nextMonthDate = new Date(); nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, "0")}`;
  const nextPlan = data.plans.some((plan) => plan.level === "month" && plan.startDate.startsWith(nextMonth));
  const days = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const lastWeek = new Date().getDate() >= days - 6;
  const rows = [
    { label: "本月月复盘", ok: Boolean(monthlyReview), text: monthlyReview ? `已保存 V${monthlyReview.version}` : "尚未保存" },
    { label: "本月月报版本", ok: Boolean(report), text: report ? `已保存 V${report.version}` : "尚未保存" },
    { label: "家长月反馈", ok: pushed, text: pushed ? "已有推送记录" : "尚未确认推送" },
    { label: `${nextMonth} 下月计划`, ok: nextPlan, text: nextPlan ? "已有计划版本" : "尚未建立" },
  ];
  return <Panel title="月总结与月度教研会" icon={<RefreshCw size={16} />}>
    <p className={`rounded-lg p-3 text-[11px] leading-relaxed ${lastWeek ? "bg-amber-50 text-amber-900" : "bg-mint-pale/35 text-olive-soft"}`}>{lastWeek ? "现在是当月最后一周：请在教研会完成月总结、证据复核与下月动态调整。" : "当月最后一周高亮提醒：月总结、下月规划与家长反馈都须在同一教研节奏内核对。"}</p>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">{rows.map((row) => <div key={row.label} className="flex items-center gap-2 rounded-lg bg-cream/45 p-2.5 text-[11.5px]">{row.ok ? <Check size={14} className="text-green-700" /> : <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-200 text-[9px] font-bold text-amber-900">!</span>}<b className="text-olive">{row.label}</b><span className="ml-auto text-right text-[10.5px] text-olive-mute">{row.text}</span></div>)}</div>
    <p className="mt-2 text-[10.5px] text-olive-mute">状态来自真实复盘、月报、授权与计划记录；此卡不替代下方月报编辑及逐人推送流程。</p>
  </Panel>;
}

export function RiskReferralPanel({ data, onOpen }: { data: CoachingDetail; onOpen: () => void }) {
  const psychology = [...new Set(data.results.filter((result) => KIND[result.kind]).map((result) => KIND[result.kind]))];
  const open = data.exceptions.filter((item) => item.status !== "closed").length;
  return <Panel title="风险与专业转介入口" icon={<ShieldAlert size={16} />}>
    <div className="grid grid-cols-2 gap-2"><div className="rounded-lg bg-cream/50 p-3"><span className="block text-[10px] text-olive-mute">心理类测评（仅名称）</span><b className="mt-1 block text-[12px] text-olive">{psychology.length ? psychology.join("、") : "暂无"}</b></div><div className="rounded-lg bg-cream/50 p-3"><span className="block text-[10px] text-olive-mute">既有未关闭异常</span><b className="mt-1 block text-[16px] text-olive">{open} 项</b></div></div>
    <p className="mt-3 text-[11px] leading-relaxed text-olive-mute"><AlertTriangle size={13} className="mr-1 inline text-amber-700" />不显示心理原始作答，不根据分数自动下诊断。出现风险须由伴学师按既有异常流程记录、复核并在需要时转介专业人员。</p>
    <button type="button" onClick={onOpen} className="mt-3 min-h-10 rounded-xl border border-amber-300 px-3 py-2 text-[11.5px] font-semibold text-amber-900"><ArrowRight size={14} className="mr-1 inline" />进入成长页异常与转介记录</button>
  </Panel>;
}
