import { BookOpenCheck, CalendarCheck2, Check, ClipboardCheck, Clock3, FileText, GraduationCap, Target } from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { CoachingDetail } from "./coachingTypes";
import { parseGrowForm } from "./growPlan";
import { GROWTH_STAGES, cardForDate, resolveGrowthStage, stageTipFor } from "./knowledgeBase";
import { CoachingPanel, V4_CARD } from "./CoachingV4";

function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function CoachingGrowthSummary({ data }: { data: CoachingDetail }) {
  const grow = parseGrowForm(data.coachingCase.growForm);
  const subjects = grow?.subjects.filter((row) => row.name.trim()) ?? [];
  const exams = [...(grow?.exams.filter((row) => row.name.trim()) ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const today = new Date();
  const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 6);
  const recent = new Set(data.checkins.filter((row) => new Date(`${row.checkDate}T12:00:00`) >= cutoff).map((row) => row.checkDate));
  const verified = data.tasks.filter((task) => task.status === "verified").length;
  return <CoachingPanel title="成长证据总览" subtitle="只使用真实成绩、日检验和任务验收；不从签到推断提分">
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Metric label="学科目标" value={subjects.length} unit="项" /><Metric label="大考记录" value={exams.length} unit="次" />
      <Metric label="近 7 天日检验" value={recent.size} unit="天" /><Metric label="任务验收" value={data.tasks.length ? Math.round(verified / data.tasks.length * 100) : 0} unit={data.tasks.length ? "%" : "暂无"} />
    </div>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <section><h4 className="flex items-center gap-1.5 text-[12px] font-bold text-olive"><Target size={14} className="text-[#0C7064]" />学科现状与提升目标</h4>
        {subjects.length ? <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[330px] border-collapse text-[11.5px]"><thead><tr className="bg-cream text-left text-olive-mute"><th className="rounded-l-lg px-3 py-2">学科</th><th className="px-3 py-2">现状</th><th className="rounded-r-lg px-3 py-2">目标</th></tr></thead><tbody>{subjects.map((row, index) => <tr key={`${row.name}-${index}`} className="border-b border-border/60"><td className="px-3 py-2 font-semibold text-olive">{row.name}</td><td className="px-3 py-2 text-olive-soft">{row.baseline ?? "待补全"}</td><td className="px-3 py-2 font-semibold text-[#0C7064]">{row.target ?? "待补全"}</td></tr>)}</tbody></table></div> : <Empty text="尚未记录学科目标，请在规划页按实际情况补全。" />}
      </section>
      <section><h4 className="flex items-center gap-1.5 text-[12px] font-bold text-olive"><GraduationCap size={14} className="text-[#0C7064]" />大考成绩与衡量</h4>
        <div className="mt-2 space-y-2">{exams.slice(0, 5).map((exam, index) => <div key={`${exam.name}-${index}`} className="rounded-lg bg-cream/55 p-3"><div className="flex flex-wrap items-center gap-2"><b className="min-w-0 flex-1 text-[11.5px] text-olive">{exam.name}</b><time className="text-[10px] text-olive-mute">{exam.date || "日期待补全"}</time></div><p className="mt-1 whitespace-pre-wrap text-[11.5px] text-olive-soft">{exam.scores || "成绩待记录"}</p></div>)}{!exams.length && <Empty text="暂无真实大考记录，不绘制示例分数或趋势。" />}</div>
      </section>
    </div>
    <p className="mt-3 text-[10.5px] leading-relaxed text-olive-mute">成绩按原始记录呈现，不自动跨考试比较；日检验用于核对执行证据，不等同学习效果结论。</p>
  </CoachingPanel>;
}

export function PlanningRhythm({ data }: { data: CoachingDetail }) {
  const month = localDay(new Date()).slice(0, 7);
  const levels = [{ key: "term", label: "总体规划" }, { key: "month", label: "首月／月计划" }, { key: "week", label: "周行动" }, { key: "day", label: "日检验" }] as const;
  const monthly = data.reviews.filter((review) => review.period === "month" && review.periodKey === month)[0];
  return <CoachingPanel title="规划节奏" subtitle="总体规划 → 首月规划 → 月度教研动态调整">
    <div className="rounded-xl bg-[#E5EFE8]/55 p-3 text-[11px] leading-relaxed text-olive-soft">前三个月一对一＋督学；后三个月经阶段评估决定一对一或沙龙／学习坊，督学始终保留。</div>
    <div className="mt-3 space-y-2">{levels.map((level) => {
      const rows = level.key === "day" ? data.checkins : data.plans.filter((plan) => plan.level === level.key);
      return <div key={level.key} className="flex items-center gap-2 rounded-lg border border-[#E7E2D0] px-3 py-2.5 text-[11px]"><span className="min-w-0 flex-1 font-semibold text-olive">{level.label}</span><span className="text-olive-mute">{rows.length ? `${rows.length} 条真实记录` : "尚未建立"}</span>{rows.length > 0 && <Check size={13} className="text-[#0C7064]" />}</div>;
    })}</div>
    <div className="mt-3 rounded-lg bg-cream/60 p-3 text-[11px] leading-relaxed text-olive-soft"><b className="text-olive">本月教研：</b>{monthly ? `月复盘 V${monthly.version} 已保存` : "当月最后一周完成月总结、证据复核与下月调整"}</div>
  </CoachingPanel>;
}

export function ParentCardSchedule({ data }: { data: CoachingDetail }) {
  const { data: student } = trpc.coach.studentDetail.useQuery({ userId: data.coachingCase.studentUserId });
  const growth = resolveGrowthStage({ birthDate: data.profile?.birthDate, grade: student?.profile?.grade });
  const today = new Date();
  const cards = Array.from({ length: 7 }, (_, index) => { const date = new Date(today); date.setDate(date.getDate() + index); return { date, card: cardForDate(date) }; });
  return <CoachingPanel title="生命周期分版与本周卡片排期" subtitle="按当前学员阶段补充家长提醒；这里是内容预览，不是推送记录">
    <div className="rounded-xl bg-cream/55 p-3 text-[11.5px] leading-relaxed text-olive-soft"><b className="text-olive">当前分版：</b>{growth ? `${growth.stage.name} · ${growth.stage.quality}（${growth.source === "birthday" ? "生日" : "年级估算"}）` : "生日或年级未补全，暂不猜测生命周期"}</div>
    <div className="mt-3 grid gap-2 md:grid-cols-2">{GROWTH_STAGES.map((stage) => <div key={stage.key} className={`rounded-lg px-3 py-2 text-[10.5px] ${growth?.stage.key === stage.key ? "bg-[#E5EFE8] font-semibold text-[#0C7064]" : "bg-cream/45 text-olive-soft"}`}>{stage.minAge}–{stage.maxAge} 岁 · {stage.name} · {stage.quality}</div>)}</div>
    <div className="mt-4 space-y-2">{cards.map(({ date, card }, index) => <article key={localDay(date)} className="rounded-xl border border-[#E7E2D0] p-3"><div className="flex flex-wrap items-center gap-2"><CalendarCheck2 size={14} className="text-[#0C7064]" /><b className="min-w-0 flex-1 text-[11.5px] text-olive">{date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", weekday: "short" })} · {card.title}</b><span className={`rounded-full px-2 py-0.5 text-[10px] ${index === 0 ? "bg-[#E5EFE8] text-[#0C7064]" : "bg-cream text-olive-mute"}`}>{index === 0 ? "今日可预览" : "内容排期预览"}</span></div><p className="mt-1.5 text-[11px] leading-relaxed text-olive-soft">{card.knowledge}</p>{growth && <p className="mt-1 text-[10.5px] leading-relaxed text-[#0C7064]">{stageTipFor(growth.stage, card)}</p>}</article>)}</div>
  </CoachingPanel>;
}

export function ParentFamilyPreview({ data }: { data: CoachingDetail }) {
  const { data: reports = [] } = trpc.coaching.monthlyReports.useQuery({ caseId: data.coachingCase.id });
  const activePlans = data.plans.filter((plan) => plan.status === "confirmed" && plan.issuedAt);
  const pushed = data.sessions.flatMap((session) => session.participants.filter((row) => row.participant.feedbackVersion > 0).map((row) => ({ session, participant: row.participant })));
  const latestReport = reports[0];
  return <CoachingPanel title="家长端内容预览" subtitle="仅汇总已生效计划、已推送课堂反馈和月报，不新增发送能力">
    <div className="overflow-hidden rounded-2xl border border-[#DDE5D9] bg-[#FAFBF7]">
      <header className="bg-[#0C7064] px-4 py-3 text-white"><div className="text-[10px] text-white/70">三好学伴 · 家庭陪跑反馈</div><h4 className="mt-0.5 text-[14px] font-bold">和孩子一起，把每一步走稳</h4></header>
      <div className="space-y-3 p-4">
        <PreviewSection icon={<Target size={14} />} title="正式计划">{activePlans.length ? activePlans.slice(0, 2).map((plan) => <p key={plan.id} className="rounded-lg bg-white p-2.5 text-[11px] text-olive-soft">{plan.title} V{plan.version} · {plan.startDate}～{plan.endDate}</p>) : <Empty text="暂无三方会签并生效的计划。" />}</PreviewSection>
        <PreviewSection icon={<BookOpenCheck size={14} />} title="已推送课堂反馈">{pushed.length ? pushed.slice(0, 2).map(({ session, participant }) => <p key={participant.id} className="rounded-lg bg-white p-2.5 text-[11px] leading-relaxed text-olive-soft">{new Date(session.startAt).toLocaleDateString("zh-CN")} · V{participant.feedbackVersion}<br />{participant.feedbackText || "本次以录音／图片反馈"}</p>) : <Empty text="尚未正式推送课堂反馈。" />}</PreviewSection>
        <PreviewSection icon={<FileText size={14} />} title="家长月反馈与下月计划">{latestReport ? <p className="rounded-lg bg-white p-2.5 text-[11px] leading-relaxed text-olive-soft">{latestReport.month} 月报 V{latestReport.version} · {latestReport.pushedAt ? "已推送" : "尚未推送"}<br />下月行动：{latestReport.nextActions.join("；") || "待记录"}</p> : <Empty text="暂无月报版本。" />}</PreviewSection>
      </div>
    </div>
  </CoachingPanel>;
}

function Metric({ label, value, unit }: { label: string; value: number; unit: string }) {
  return <div className="rounded-xl bg-cream/55 p-3"><span className="text-[10.5px] text-olive-mute">{label}</span><div className="mt-1 text-[20px] font-bold text-olive">{value}<small className="ml-1 text-[10px] font-normal text-olive-mute">{unit}</small></div></div>;
}
function Empty({ text }: { text: string }) { return <p className="mt-2 rounded-lg border border-dashed border-[#E7E2D0] p-3 text-[11px] leading-relaxed text-olive-mute">{text}</p>; }
function PreviewSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section><h5 className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-bold text-olive">{icon}{title}</h5><div className="space-y-1.5">{children}</div></section>;
}

export function FamilyWorkflowNote() {
  return <section className={V4_CARD}><h3 className="flex items-center gap-1.5 text-[13px] font-bold text-olive"><ClipboardCheck size={15} className="text-[#0C7064]" />家校反馈边界</h3><p className="mt-2 text-[11px] leading-relaxed text-olive-soft"><Clock3 size={13} className="mr-1 inline" />知识卡片须由伴学师核对后复制到既有反馈或月报；正式推送仍逐人选择接收人。心理原始答案和内部备注不会进入家长端。</p></section>;
}
