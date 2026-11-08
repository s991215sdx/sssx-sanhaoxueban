import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Check, ClipboardCheck, FileText, History, Inbox, Plus, RefreshCw, Send, ShieldCheck, UserCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { COACHING_MONTHLY_DIMENSIONS, COACHING_QUALITY_FRAMEWORK, coachingQualityLevel, type CoachingQualityScores } from "@contracts/orgService";
import type { CoachingMonthlyPreview, CoachingMonthlyReport, CoachingQualityInboxItem, CoachingQualityReview } from "./coachingTypes";

type DimensionKey = (typeof COACHING_MONTHLY_DIMENSIONS)[number]["key"];
type ReviewType = "self" | "peer" | "supervisor";
type QualityFormInput = { scores: CoachingQualityScores; findings: string; improvementActions: string };
const REVIEW_TYPE: Record<ReviewType, string> = { self: "伴学师自查", peer: "同伴互查", supervisor: "主管抽查" };
const REVIEW_STATUS: Record<string, string> = { pending: "待检查", submitted: "已提交 · 待整改关闭", closed: "已整改关闭" };
const input = "mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] font-normal text-olive outline-none focus:border-[#0C7064]";
const label = "block text-[11.5px] font-semibold text-olive";
const primary = "min-h-10 rounded-xl bg-[#0C7064] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#095C53] disabled:opacity-40";
const secondary = "min-h-10 rounded-xl border border-[#0C7064]/25 bg-white px-3.5 py-2 text-[12px] font-semibold text-[#0C7064] hover:bg-mint-pale/35 disabled:opacity-40";

function currentMonth() { return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7); }
function localDateInput(date: Date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
function defaultDueAt() { const date = new Date(); date.setDate(date.getDate() + 7); return localDateInput(date); }
function emptyFields(): Record<DimensionKey, string> { return { goalProgress: "", academicProgress: "", taskExecution: "", learningMethod: "", habitFamily: "" }; }
function percent(value: number | null) { return value == null ? "暂无数据" : `${value}%`; }
function qualityTotal(item: CoachingQualityReview["review"]) {
  const scores = [item.planScore, item.executionScore, item.archiveScore, item.familyScore, item.reviewScore];
  return scores.every((score) => score != null) ? scores.reduce<number>((sum, score) => sum + (score ?? 0), 0) : null;
}
function reviewGroup(item: CoachingQualityReview["review"]) { return `${item.caseId}-${item.reviewType}-${item.reviewerId}-${item.periodKey}`; }

export default function CoachingMonthlyQuality({ caseId, coachId, supervisorId }: { caseId: number; coachId: number; supervisorId: number }) {
  const utils = trpc.useUtils();
  const [month, setMonth] = useState(currentMonth());
  const [fields, setFields] = useState(emptyFields);
  const [meetingNotes, setMeetingNotes] = useState("");
  const [nextActions, setNextActions] = useState(["", ""]);
  const [familyAction, setFamilyAction] = useState("");
  const [confirmPushId, setConfirmPushId] = useState(0);
  const { data: preview, isLoading: previewLoading, error: previewError, refetch: refreshPreview, isFetching } = trpc.coaching.monthlyPreview.useQuery({ caseId, month });
  const { data: reports = [], error: reportsError } = trpc.coaching.monthlyReports.useQuery({ caseId });
  useEffect(() => {
    setFields(emptyFields()); setMeetingNotes(""); setNextActions(["", ""]); setFamilyAction(""); setConfirmPushId(0);
  }, [caseId, month]);
  const save = trpc.coaching.saveMonthlyReport.useMutation({ onSuccess: async () => {
    setConfirmPushId(0); await utils.coaching.monthlyReports.invalidate({ caseId });
  } });
  const push = trpc.coaching.pushMonthlyReport.useMutation({ onSuccess: async () => {
    setConfirmPushId(0); await utils.coaching.monthlyReports.invalidate({ caseId });
  } });
  const actions = nextActions.map((item) => item.trim()).filter(Boolean);
  const canSave = Object.values(fields).every((value) => value.trim().length >= 2) && familyAction.trim().length >= 2
    && actions.length >= 1 && actions.length <= 3 && actions.every((value) => value.length >= 2);
  const fillDraft = () => {
    if (!preview) return;
    const current = preview.current;
    setFields({
      goalProgress: `本月日检验 ${current.checkinDays} 天，平均完成率 ${percent(current.averageCompletion)}，上月为 ${percent(preview.previous.averageCompletion)}。请结合已确认目标补写推进事实及与起点／上月相比的具体变化。`,
      academicProgress: "系统未自动归集同口径考试成绩或排名。请按已核验试卷补充分数、排名与考试口径；本月无新数据时请明确说明，不能用课程或出勤推断提分。",
      taskExecution: `本月截止任务 ${current.tasksDue} 项，已验收 ${current.tasksVerified} 项，验收率 ${percent(current.taskVerificationRate)}。请补写代表性证据、未完成原因和补位安排。`,
      learningMethod: `本月费曼输出 ${current.feynmanDays} 天，五项学习痕迹完整 ${current.fullTraceDays} 天。请结合学生作品补写方法使用情况、实际变化与需巩固点。`,
      habitFamily: `本月完成督学 ${current.completedSupervisions} 次、课堂 ${current.completedSessions} 场，家庭反馈 ${current.feedbackSessions} 场。请补写作息、自主学习节奏与家庭配合的真实变化。`,
    });
    setNextActions(["围绕下月目标确定一项可验证行动，明确截止日与证据", "安排一次费曼输出或错题复验，记录掌握情况"]);
    setFamilyAction("本周固定一个 15 分钟家庭沟通时间，只核对一项行动证据，并记录需要协调的问题。 ");
  };

  return <div className="space-y-4">
    <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><h2 className="flex items-center gap-2 text-[16px] font-bold text-olive"><FileText size={18} className="text-[#0C7064]" />月度学习报告</h2><p className="mt-1 text-[11.5px] leading-relaxed text-olive-mute">数据预览 → 保存新版本 → 确认推送家庭。每次保存保留数据快照，推送后家庭只看到对应版本。</p></div><label className={`${label} w-full sm:w-40`}>报告月份<input aria-label="报告月份" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className={input} /></label></header>
      <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" disabled={isFetching} onClick={() => void refreshPreview()} className={secondary}><RefreshCw size={14} className="mr-1 inline" />{isFetching ? "刷新中…" : "刷新数据预览"}</button><button type="button" disabled={!preview} onClick={fillDraft} className={secondary}>按真实指标生成可编辑草稿</button>{preview && <span className="text-[10.5px] text-olive-mute">统计周期 {preview.current.periodStart}～{preview.current.periodEnd} · 起点月 {preview.baselineMonth}</span>}</div>
      {previewLoading && <div className="mt-3 h-32 animate-pulse rounded-xl bg-cream/60" />}
      {previewError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-[11.5px] text-red-700">{previewError.message}</p>}
      {preview && <><div className="mt-3 grid gap-2 lg:grid-cols-3"><MetricsCard title="本月" metrics={preview.current} /><MetricsCard title="上月" metrics={preview.previous} /><MetricsCard title={`起点月 ${preview.baselineMonth}`} metrics={preview.baseline} /></div><details className="mt-2 rounded-lg bg-cream/45 p-2.5 text-[10.5px] text-olive-mute"><summary className="cursor-pointer font-semibold text-olive">查看统计口径与数据边界</summary><ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">{preview.current.sources.map((source) => <li key={source}>{source}</li>)}</ul></details></>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">{COACHING_MONTHLY_DIMENSIONS.map((dimension) => <label key={dimension.key} className={label}>{dimension.label}<textarea aria-label={`月报${dimension.label}`} rows={4} maxLength={12000} value={fields[dimension.key]} onChange={(event) => setFields((current) => ({ ...current, [dimension.key]: event.target.value }))} placeholder={dimension.prompt} className={`${input} resize-y leading-relaxed`} /></label>)}</div>
      <label className={`${label} mt-3`}>月度沟通纪要（可选）<textarea aria-label="月度沟通纪要" rows={3} maxLength={15000} value={meetingNotes} onChange={(event) => setMeetingNotes(event.target.value)} placeholder="记录与学生、家长已确认的事实、分歧与责任边界" className={input} /></label>
      <div className="mt-3 rounded-xl border border-border bg-cream/35 p-3"><h3 className="text-[12px] font-bold text-olive">下月行动（1—3 条）</h3>{nextActions.map((action, index) => <div key={index} className="mt-2 flex items-center gap-2"><input aria-label={`下月行动 ${index + 1}`} value={action} maxLength={2000} onChange={(event) => setNextActions((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`第 ${index + 1} 条：动作、责任人与验证证据`} className={`${input} mt-0`} />{nextActions.length > 1 && <button type="button" aria-label={`删除下月行动 ${index + 1}`} onClick={() => setNextActions((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="shrink-0 rounded-lg border border-border px-2.5 py-2 text-[11px] text-olive-mute">删除</button>}</div>)}{nextActions.length < 3 && <button type="button" onClick={() => setNextActions((current) => [...current, ""])} className="mt-2 text-[11px] font-semibold text-[#0C7064]"><Plus size={13} className="mr-1 inline" />增加一条行动</button>}</div>
      <label className={`${label} mt-3`}>家长 1 件配合事<textarea aria-label="家长一件配合事" rows={2} maxLength={4000} value={familyAction} onChange={(event) => setFamilyAction(event.target.value)} placeholder="只保留一件具体、可执行、可核验的家庭配合事" className={input} /></label>
      <button type="button" disabled={save.isPending || !canSave || !preview} onClick={() => save.mutate({ caseId, month, ...fields, meetingNotes, nextActions: actions, familyAction })} className={`${primary} mt-3 w-full`}>{save.isPending ? "正在保存快照与新版本…" : "保存月报新版本"}</button>
      {save.error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2.5 text-[11.5px] text-red-700">{save.error.message}</p>}{save.isSuccess && <p className="mt-2 text-[11px] text-[#2F7A41]">月报 V{save.data.version} 已保存，数据快照与正文均已留档；请在下方核对后推送。</p>}
      {reportsError && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2.5 text-[11.5px] text-red-700">{reportsError.message}</p>}
      <div className="mt-4 space-y-2"><h3 className="flex items-center gap-1.5 text-[12.5px] font-bold text-olive"><History size={15} />月报版本与推送</h3>{reports.map((report) => <ReportCard key={report.id} report={report} confirming={confirmPushId === report.id} pushing={push.isPending && push.variables?.reportId === report.id} error={push.error && push.variables?.reportId === report.id ? push.error.message : ""} onAskPush={() => setConfirmPushId(report.id)} onCancelPush={() => setConfirmPushId(0)} onPush={() => push.mutate({ reportId: report.id })} />)}{!reports.length && <p className="rounded-xl border border-dashed border-border py-5 text-center text-[11.5px] text-olive-mute">尚未保存月报。保存后仍需单独确认，才会推送给家庭。</p>}</div>
    </section>
    <QualityPanel caseId={caseId} coachId={coachId} supervisorId={supervisorId} month={month} />
  </div>;
}

function MetricsCard({ title, metrics }: { title: string; metrics: CoachingMonthlyPreview["current"] }) {
  const rows = [["日检验天数", `${metrics.checkinDays} 天`], ["平均完成／准确率", `${percent(metrics.averageCompletion)}／${percent(metrics.averageAccuracy)}`], ["任务验收", `${metrics.tasksVerified}/${metrics.tasksDue} · ${percent(metrics.taskVerificationRate)}`], ["课堂／家庭反馈", `${metrics.completedSessions} 场／${metrics.feedbackSessions} 场 · ${percent(metrics.feedbackRate)}`], ["完成督学", `${metrics.completedSupervisions} 次`], ["费曼／五项痕迹", `${metrics.feynmanDays} 天／${metrics.fullTraceDays} 天`]] as const;
  return <article className="rounded-xl border border-border bg-cream/40 p-3"><h3 className="text-[12px] font-bold text-olive">{title}</h3><dl className="mt-2 space-y-1.5">{rows.map(([name, value]) => <div key={name} className="flex items-start justify-between gap-2 text-[10.5px]"><dt className="text-olive-mute">{name}</dt><dd className="text-right font-semibold text-olive-soft">{value}</dd></div>)}</dl></article>;
}

function ReportCard({ report, confirming, pushing, error, onAskPush, onCancelPush, onPush }: { report: CoachingMonthlyReport; confirming: boolean; pushing: boolean; error: string; onAskPush: () => void; onCancelPush: () => void; onPush: () => void }) {
  return <details className="rounded-xl border border-border bg-cream/35 p-3"><summary className="flex cursor-pointer flex-wrap items-center gap-2 text-[12px] font-semibold text-olive"><span className="min-w-0 flex-1">{report.month} · V{report.version}</span><span className={`rounded-full px-2 py-0.5 text-[10px] ${report.pushedAt ? "bg-mint-pale text-[#0C7064]" : "bg-amber-50 text-amber-800"}`}>{report.pushedAt ? "已推送家庭" : "内部待推送"}</span></summary><div className="mt-3 grid gap-2 md:grid-cols-2">{COACHING_MONTHLY_DIMENSIONS.map((dimension) => <div key={dimension.key} className="rounded-lg bg-white p-2.5"><b className="text-[10.5px] text-[#0C7064]">{dimension.label}</b><p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-olive-soft">{report[dimension.key]}</p></div>)}</div><div className="mt-2 rounded-lg bg-white p-2.5 text-[11px] leading-relaxed text-olive-soft"><b>下月行动：</b><ol className="mt-1 list-decimal pl-5">{report.nextActions.map((action, index) => <li key={index}>{action}</li>)}</ol><p className="mt-2"><b>家庭配合：</b>{report.familyAction}</p>{report.meetingNotes && <p className="mt-2 whitespace-pre-wrap"><b>沟通纪要：</b>{report.meetingNotes}</p>}</div><p className="mt-2 text-[10px] text-olive-mute">保存于 {new Date(report.createdAt).toLocaleString("zh-CN")}{report.pushedAt ? ` · 推送于 ${new Date(report.pushedAt).toLocaleString("zh-CN")}` : " · 尚未对家庭可见"}</p>{!report.pushedAt && <div className="mt-2">{confirming ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5"><p className="text-[11px] leading-relaxed text-amber-900">请确认已核对五维正文、数据快照、下月行动和家庭配合事。推送后此版本将对获授权学员及监护人可见。</p><div className="mt-2 flex flex-wrap justify-end gap-2"><button type="button" disabled={pushing} onClick={onCancelPush} className={secondary}>返回检查</button><button type="button" disabled={pushing} onClick={onPush} className={primary}><Send size={13} className="mr-1 inline" />{pushing ? "推送中…" : "确认正式推送家庭"}</button></div></div> : <button type="button" onClick={onAskPush} className={secondary}><Send size={13} className="mr-1 inline" />核对并推送此版本</button>}</div>}{error && <p role="alert" className="mt-2 text-[11px] text-red-700">{error}</p>}</details>;
}

function QualityPanel({ caseId, coachId, supervisorId, month }: { caseId: number; coachId: number; supervisorId: number; month: string }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: staff = [] } = trpc.coaching.staff.useQuery();
  const { data: framework = COACHING_QUALITY_FRAMEWORK } = trpc.coaching.qualityFramework.useQuery();
  const { data: reviews = [], error } = trpc.coaching.qualityReviews.useQuery({ caseId });
  const [reviewType, setReviewType] = useState<ReviewType>("peer");
  const [reviewerId, setReviewerId] = useState(0);
  const [periodKey, setPeriodKey] = useState(month);
  const [dueAt, setDueAt] = useState(defaultDueAt);
  useEffect(() => { setPeriodKey(month); }, [month]);
  useEffect(() => { setReviewerId(0); }, [reviewType, caseId]);
  const eligible = useMemo(() => staff.filter((person) => reviewType === "self" ? person.id === coachId || person.id === supervisorId : reviewType === "peer" ? person.id !== coachId && person.id !== supervisorId : person.role === "admin"), [staff, reviewType, coachId, supervisorId]);
  const refresh = async () => { await Promise.all([utils.coaching.qualityReviews.invalidate({ caseId }), utils.coaching.qualityInbox.invalidate()]); };
  const assign = trpc.coaching.assignQualityReview.useMutation({ onSuccess: refresh });
  const self = trpc.coaching.submitSelfQualityReview.useMutation({ onSuccess: refresh });
  const canSelf = user?.id === coachId || user?.id === supervisorId;
  const latestIds = useMemo(() => { const map = new Map<string, number>(); for (const item of reviews) map.set(reviewGroup(item.review), Math.max(map.get(reviewGroup(item.review)) ?? 0, item.review.version)); return new Set(reviews.filter((item) => map.get(reviewGroup(item.review)) === item.review.version).map((item) => item.review.id)); }, [reviews]);
  return <section className="rounded-2xl border border-border bg-white p-4 shadow-sm"><header><h2 className="flex items-center gap-2 text-[16px] font-bold text-olive"><ShieldCheck size={18} className="text-[#0C7064]" />内部质量自查、互查与主管抽查</h2><p className="mt-1 text-[11.5px] leading-relaxed text-olive-mute">计划、执行、档案、家校、复盘各 20 分。红黄绿只用于内部整改，不是对学员的评价，也不会推送给学生或家长。</p></header>
    {user?.role === "admin" && <div className="mt-4 rounded-xl border border-[#0C7064]/15 bg-mint-pale/20 p-3"><h3 className="text-[12.5px] font-bold text-olive">管理员安排检查</h3><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><label className={label}>检查类型<select aria-label="质量检查类型" value={reviewType} onChange={(event) => setReviewType(event.target.value as ReviewType)} className={input}>{Object.entries(REVIEW_TYPE).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label><label className={label}>检查人<select aria-label="质量检查人" value={reviewerId} onChange={(event) => setReviewerId(Number(event.target.value))} className={input}><option value={0}>请选择</option>{eligible.map((person) => <option key={person.id} value={person.id}>{person.name} · {person.role === "admin" ? "管理员" : "伴学师"}</option>)}</select></label><label className={label}>周期<input aria-label="质量检查周期" value={periodKey} maxLength={24} onChange={(event) => setPeriodKey(event.target.value)} className={input} /></label><label className={label}>完成期限<input aria-label="质量检查期限" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className={input} /></label></div><button type="button" disabled={assign.isPending || !reviewerId || periodKey.trim().length < 2 || !dueAt} onClick={() => assign.mutate({ caseId, reviewType, reviewerId, periodKey, dueAt: new Date(dueAt) })} className={`${primary} mt-2 w-full`}>{assign.isPending ? "安排中…" : "安排检查并生成待办"}</button>{assign.error && <p role="alert" className="mt-2 text-[11px] text-red-700">{assign.error.message}</p>}{assign.isSuccess && <p className="mt-2 text-[11px] text-[#2F7A41]">检查任务已安排，检查人可在页面上方“待我检查”完成。</p>}</div>}
    {canSelf && <div className="mt-4 rounded-xl border border-border bg-cream/35 p-3"><h3 className="text-[12.5px] font-bold text-olive">直接提交本期自查</h3><p className="mt-1 text-[10.5px] text-olive-mute">仅当前主教／督学可提交；再次提交会追加版本，已整改关闭的周期不能修改。</p><QualityScoreForm key={`${caseId}-${periodKey}`} modules={framework.modules} pending={self.isPending} error={self.error?.message} success={self.isSuccess ? `自查 V${self.data.version} 已提交。` : ""} submitLabel="提交五模块自查" onSubmit={(value) => self.mutate({ caseId, periodKey, ...value })} /></div>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2.5 text-[11.5px] text-red-700">{error.message}</p>}
    <div className="mt-4 space-y-2">{reviews.map((item) => <QualityHistoryCard key={item.review.id} item={item} modules={framework.modules} currentUserId={user?.id ?? 0} isAdmin={user?.role === "admin"} latest={latestIds.has(item.review.id)} onChanged={refresh} />)}{!reviews.length && <p className="rounded-xl border border-dashed border-border py-5 text-center text-[11.5px] text-olive-mute">暂无质量检查记录。可直接自查，或由管理员安排互查／抽查。</p>}</div>
  </section>;
}

function QualityScoreForm({ modules, initial, pending, error, success, submitLabel, onSubmit }: { modules: readonly { key: keyof CoachingQualityScores; label: string; maxScore: number }[]; initial?: QualityFormInput; pending: boolean; error?: string; success?: string; submitLabel: string; onSubmit: (value: QualityFormInput) => void }) {
  const [scores, setScores] = useState<CoachingQualityScores>(initial?.scores ?? { plan: 0, execution: 0, archive: 0, family: 0, review: 0 });
  const [findings, setFindings] = useState(initial?.findings ?? "");
  const [improvementActions, setImprovementActions] = useState(initial?.improvementActions ?? "");
  const total = modules.reduce((sum, module) => sum + scores[module.key], 0);
  const level = coachingQualityLevel(total);
  return <div className="mt-3"><div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{modules.map((module) => <label key={module.key} className={label}>{module.label}<input aria-label={`${module.label}评分`} type="number" min={0} max={module.maxScore} step={1} value={scores[module.key]} onChange={(event) => setScores((current) => ({ ...current, [module.key]: Number(event.target.value) }))} className={input} /><span className="text-[9.5px] font-normal text-olive-mute">满分 {module.maxScore}</span></label>)}</div><div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2 text-[11px]"><b className="text-olive">合计 {total}/100</b><span className={level.key === "green" ? "text-[#2F7A41]" : level.key === "yellow" ? "text-amber-800" : "text-red-700"}>{level.label}</span><span className="ml-auto text-[10px] text-olive-mute">仅内部使用</span></div><label className={`${label} mt-2`}>检查发现与事实依据<textarea aria-label="质量检查发现" rows={3} maxLength={12000} value={findings} onChange={(event) => setFindings(event.target.value)} placeholder="写清检查了哪些材料、发现什么事实；不要写成对学员的评价" className={input} /></label><label className={`${label} mt-2`}>整改动作<textarea aria-label="质量整改动作" rows={2} maxLength={12000} value={improvementActions} onChange={(event) => setImprovementActions(event.target.value)} placeholder="具体动作、责任人与预期完成节点" className={input} /></label><button type="button" disabled={pending || findings.trim().length < 2 || improvementActions.trim().length < 2 || modules.some((module) => !Number.isInteger(scores[module.key]) || scores[module.key] < 0 || scores[module.key] > module.maxScore)} onClick={() => onSubmit({ scores, findings, improvementActions })} className={`${primary} mt-2 w-full`}>{pending ? "提交中…" : submitLabel}</button>{error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] text-red-700">{error}</p>}{success && <p className="mt-2 text-[11px] text-[#2F7A41]">{success}</p>}</div>;
}

function QualityHistoryCard({ item, modules, currentUserId, isAdmin, latest, onChanged }: { item: CoachingQualityReview; modules: readonly { key: keyof CoachingQualityScores; label: string; maxScore: number }[]; currentUserId: number; isAdmin: boolean; latest: boolean; onChanged: () => Promise<void> }) {
  const review = item.review;
  const total = qualityTotal(review);
  const level = total == null ? null : coachingQualityLevel(total);
  const initial: QualityFormInput | undefined = total == null ? undefined : { scores: { plan: review.planScore!, execution: review.executionScore!, archive: review.archiveScore!, family: review.familyScore!, review: review.reviewScore! }, findings: review.findings, improvementActions: review.improvementActions };
  const correct = trpc.coaching.submitQualityReview.useMutation({ onSuccess: onChanged });
  return <article className="rounded-xl border border-border bg-cream/35 p-3"><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-mint-pale px-2 py-1 text-[10px] font-bold text-[#0C7064]">{REVIEW_TYPE[review.reviewType as ReviewType] ?? review.reviewType}</span><b className="min-w-0 flex-1 text-[12px] text-olive">{review.periodKey} · V{review.version}</b><span className="text-[10.5px] text-olive-mute">{REVIEW_STATUS[review.status] ?? review.status}</span></div><div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-olive-mute"><span>检查人：{item.reviewerName ?? `账号 #${review.reviewerId}`}</span>{review.dueAt && <span>期限：{new Date(review.dueAt).toLocaleString("zh-CN")}</span>}{review.submittedAt && <span>提交：{new Date(review.submittedAt).toLocaleString("zh-CN")}</span>}</div>{total == null ? <p className="mt-2 rounded-lg bg-white p-2.5 text-[11px] text-olive-mute">待检查人评分；当前不计算总分。</p> : <><div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-white p-2.5 text-[11px]"><b className="text-olive">{total}/100</b>{level && <span className={level.key === "green" ? "text-[#2F7A41]" : level.key === "yellow" ? "text-amber-800" : "text-red-700"}>{level.label}</span>}<span className="ml-auto text-[10px] text-olive-mute">{modules.map((module) => `${module.label} ${review[`${module.key}Score`]}`).join(" · ")}</span></div><p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-olive-soft"><b>检查发现：</b>{review.findings}</p><p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-olive-soft"><b>整改动作：</b>{review.improvementActions}</p></>}{review.closeEvidence && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-mint-pale/30 p-2.5 text-[11px] leading-relaxed text-[#0C7064]"><b>关闭证据：</b>{review.closeEvidence}</p>}{latest && review.status === "submitted" && (isAdmin || review.reviewerId === currentUserId) && <QualityClose reviewId={review.id} onChanged={onChanged} />}{latest && review.status === "submitted" && review.reviewerId === currentUserId && initial && <details className="mt-2 rounded-lg bg-white p-2.5"><summary className="cursor-pointer text-[11px] font-semibold text-olive">更正本次检查（追加 V{review.version + 1}，不覆盖历史）</summary><QualityScoreForm modules={modules} initial={initial} pending={correct.isPending} error={correct.error?.message} success={correct.isSuccess ? `已追加 V${correct.data.version}。` : ""} submitLabel="保存更正新版本" onSubmit={(value) => correct.mutate({ reviewId: review.id, ...value })} /></details>}{!latest && <p className="mt-2 text-[10px] text-olive-mute">历史版本只读；请在最新版本中更正或关闭。</p>}</article>;
}

function QualityClose({ reviewId, onChanged }: { reviewId: number; onChanged: () => Promise<void> }) {
  const [evidence, setEvidence] = useState("");
  const close = trpc.coaching.closeQualityReview.useMutation({ onSuccess: async () => { setEvidence(""); await onChanged(); } });
  return <div className="mt-2 rounded-lg border border-[#0C7064]/15 bg-white p-2.5"><label className={label}>整改关闭证据<textarea aria-label={`质量检查 #${reviewId} 关闭证据`} rows={2} maxLength={12000} value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="补交材料编号、复验结果或其他可核验事实" className={input} /></label><button type="button" disabled={close.isPending || evidence.trim().length < 2} onClick={() => close.mutate({ reviewId, closeEvidence: evidence })} className={`${primary} mt-2 w-full`}><Check size={14} className="mr-1 inline" />{close.isPending ? "关闭中…" : "核验整改证据并关闭"}</button>{close.error && <p role="alert" className="mt-2 text-[11px] text-red-700">{close.error.message}</p>}</div>;
}

/** 互查人只获得任务与学员姓名；提交待办不依赖完整主档权限。 */
export function CoachingQualityInbox() {
  const utils = trpc.useUtils();
  const { data: tasks = [], isLoading, error } = trpc.coaching.qualityInbox.useQuery();
  const { data: framework = COACHING_QUALITY_FRAMEWORK } = trpc.coaching.qualityFramework.useQuery();
  const submit = trpc.coaching.submitQualityReview.useMutation({ onSuccess: async () => { await Promise.all([utils.coaching.qualityInbox.invalidate(), utils.coaching.qualityReviews.invalidate()]); } });
  if (isLoading) return <section aria-label="待我质量检查" className="rounded-2xl border border-border bg-white p-4 text-[12px] text-olive-mute">正在读取质量检查任务…</section>;
  if (error) return <section aria-label="待我质量检查" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[12px] text-red-700">质量检查任务读取失败：{error.message}</section>;
  if (!tasks.length) return null;
  return <section aria-label="待我质量检查" className="rounded-2xl border border-[#0C7064]/20 bg-white p-4 shadow-sm"><header className="flex items-center gap-2"><Inbox size={18} className="text-[#0C7064]" /><div className="min-w-0 flex-1"><h2 className="text-[14px] font-bold text-olive">待我完成的质量检查</h2><p className="text-[10.5px] text-olive-mute">只显示任务所需学员姓名，不开放其他主档或敏感正文。</p></div><span className="rounded-full bg-[#0C7064] px-2.5 py-1 text-[11px] font-semibold text-white">{tasks.length} 项</span></header><div className="mt-3 space-y-3">{tasks.map((item) => <QualityInboxCard key={item.review.id} item={item} modules={framework.modules} pending={submit.isPending && submit.variables?.reviewId === item.review.id} error={submit.error && submit.variables?.reviewId === item.review.id ? submit.error.message : ""} onSubmit={(value) => submit.mutate({ reviewId: item.review.id, ...value })} />)}</div></section>;
}

function QualityInboxCard({ item, modules, pending, error, onSubmit }: { item: CoachingQualityInboxItem; modules: readonly { key: keyof CoachingQualityScores; label: string; maxScore: number }[]; pending: boolean; error: string; onSubmit: (value: QualityFormInput) => void }) {
  const [open, setOpen] = useState(false);
  return <article className="rounded-xl border border-border bg-cream/35 p-3"><div className="flex flex-wrap items-center gap-2"><ClipboardCheck size={15} className="text-[#0C7064]" /><b className="min-w-0 flex-1 text-[12.5px] text-olive">{item.studentName ?? "学员"} · {REVIEW_TYPE[item.review.reviewType as ReviewType] ?? "质量检查"} · {item.review.periodKey}</b><button type="button" onClick={() => setOpen((value) => !value)} className={secondary}><UserCheck size={13} className="mr-1 inline" />{open ? "收起" : "开始检查"}</button></div>{item.review.dueAt && <p className="mt-1 text-[10.5px] text-olive-mute"><CalendarRange size={11} className="mr-1 inline" />完成期限：{new Date(item.review.dueAt).toLocaleString("zh-CN")}</p>}{open && <QualityScoreForm modules={modules} pending={pending} error={error} submitLabel="提交检查结果" onSubmit={onSubmit} />}</article>;
}
