import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Bell, BellRing, CalendarClock, Check, ClipboardList, RotateCcw, Settings2, UserRoundCheck, Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";

const KIND: Record<string, string> = { task: "行动验收", handoff: "服务交接", quality: "质量检查", exception: "服务异常", session: "课堂交付", supervision: "督学交付" };
const STATUS: Record<string, string> = { pending: "待发送", sent: "已发送", delivered: "已送达", failed: "发送失败", manual: "已转人工" };
const CATEGORY: Record<string, string> = { overdue: "已逾期", today: "今日待办", upcoming: "未来交付", risk: "开放风险" };
const input = "mt-1 rounded-lg border border-border bg-cream px-2.5 py-2 text-[12px] text-olive outline-none focus:border-[#0C7064]";
const secondary = "inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-[#0C7064]/25 px-2.5 py-1.5 text-[11px] font-semibold text-[#0C7064] hover:bg-mint-pale/35 disabled:opacity-40";
function dateTime(value: string | Date | null) { return value ? new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) : "—"; }

export default function CoachingOperations({ onOpenCase }: { onOpenCase: (caseId: number, kind: string) => void }) {
  const { user } = useAuth();
  const [panel, setPanel] = useState<"todos" | "notifications" | "loads">("todos");
  const [filter, setFilter] = useState<"all" | "overdue" | "today" | "upcoming" | "risk">("all");
  const { data, isLoading, error } = trpc.coaching.operations.useQuery();
  const utils = trpc.useUtils();
  const remind = trpc.coaching.remindOperation.useMutation({ onSuccess: async () => { await utils.coaching.notifications.invalidate(); } });
  const items = useMemo(() => (data?.items ?? []).filter((item) => filter === "all" || (filter === "overdue" ? item.dueDate < (data?.today ?? "") : filter === "upcoming" ? item.category === "upcoming" : filter === "risk" ? item.category === "risk" : item.dueDate === data?.today)), [data, filter]);
  const accessible = new Set(data?.accessibleCaseIds ?? []);
  return <section className="rounded-2xl border border-[#0C7064]/15 bg-white p-4 shadow-sm" aria-label="陪跑运营中心">
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-0 flex-1"><h2 className="flex items-center gap-1.5 text-[16px] font-bold text-olive"><ClipboardList size={17} className="text-[#0C7064]" />陪跑运营中心</h2><p className="mt-1 text-[10.5px] text-olive-mute">统一查看本人待办、风险和未来交付；日期按 Asia/Shanghai 计算。</p></div>
      <div className="flex rounded-xl bg-cream p-1">{([{ key: "todos" as const, label: "运营待办" }, { key: "notifications" as const, label: "通知中心" }, ...(user?.role === "admin" ? [{ key: "loads" as const, label: "团队负荷" }] : [])]).map((item) => <button type="button" key={item.key} onClick={() => setPanel(item.key)} className={`min-h-9 rounded-lg px-3 text-[11.5px] font-semibold ${panel === item.key ? "bg-white text-[#0C7064] shadow-sm" : "text-olive-mute"}`}>{item.label}</button>)}</div>
    </div>
    {panel === "notifications" ? <CoachingNotificationCenter /> : panel === "loads" ? <StaffWorkloads /> : <>
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">{([
        { key: "today", label: "今日待办", value: data?.summary.today ?? 0, icon: CalendarClock },
        { key: "overdue", label: "已逾期", value: data?.summary.overdue ?? 0, icon: AlertTriangle },
        { key: "risk", label: "开放风险", value: data?.summary.risks ?? 0, icon: BellRing },
        { key: "upcoming", label: "近 7 天交付", value: data?.summary.upcoming ?? 0, icon: UserRoundCheck },
      ] as const).map((card) => <button type="button" key={card.key} onClick={() => setFilter(card.key)} className={`rounded-xl border p-3 text-left ${filter === card.key ? "border-[#0C7064]/35 bg-mint-pale/45" : "border-border bg-cream/40"}`}><card.icon size={15} className={card.key === "overdue" || card.key === "risk" ? "text-amber-700" : "text-[#0C7064]"} /><b className="mt-1 block text-[21px] text-olive">{card.value}</b><span className="text-[10.5px] text-olive-mute">{card.label}</span></button>)}</div>
      {data?.nextDeliveries.length ? <div className="mt-3 rounded-xl bg-mint-pale/25 p-3"><h3 className="text-[11.5px] font-bold text-olive">下一次交付</h3><div className="mt-2 flex gap-2 overflow-x-auto pb-1">{data.nextDeliveries.map((item) => <button type="button" key={item.key} onClick={() => accessible.has(item.caseId) && onOpenCase(item.caseId, item.kind)} className="min-w-[190px] rounded-lg bg-white p-2.5 text-left"><span className="text-[10px] text-[#0C7064]">{item.dueDate} · {KIND[item.kind]}</span><b className="mt-0.5 block truncate text-[11.5px] text-olive">{item.studentName}</b><span className="block truncate text-[10.5px] text-olive-mute">{item.title}</span></button>)}</div></div> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2"><div className="flex flex-wrap gap-1">{(["all", "overdue", "today", "upcoming", "risk"] as const).map((key) => <button type="button" key={key} onClick={() => setFilter(key)} className={`rounded-full px-2.5 py-1 text-[10.5px] ${filter === key ? "bg-[#0C7064] text-white" : "bg-cream text-olive-mute"}`}>{key === "all" ? "全部" : CATEGORY[key]}</button>)}</div><span className="ml-auto text-[10px] text-olive-mute">{items.length} 项</span></div>
      {isLoading && <p className="py-6 text-center text-[12px] text-olive-mute">正在汇总运营待办…</p>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-[11.5px] text-red-700">{error.message}</p>}
      <div className="mt-2 max-h-[460px] space-y-2 overflow-y-auto pr-1">{items.map((item) => <article key={item.key} className="rounded-xl border border-border bg-cream/35 p-3">
        <div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[9.5px] ${item.category === "overdue" || item.category === "risk" ? "bg-amber-100 text-amber-900" : "bg-mint-pale text-[#0C7064]"}`}>{CATEGORY[item.category]}</span><b className="min-w-0 flex-1 break-words text-[12px] text-olive">{item.title}</b><span className="text-[10px] text-olive-mute">{KIND[item.kind]}</span></div>
        <p className="mt-1.5 text-[11px] text-olive-soft">{item.studentName} · 期限 {item.dueDate}{item.dueAt && <span className="text-olive-mute">（{dateTime(item.dueAt)}）</span>}</p>
        <div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={!accessible.has(item.caseId)} onClick={() => onOpenCase(item.caseId, item.kind)} className={secondary}>{accessible.has(item.caseId) ? <>进入主档<ArrowRight size={12} /></> : "请在上方待办箱处理"}</button><button type="button" disabled={remind.isPending} onClick={() => remind.mutate({ itemKey: item.key })} className={secondary}><Bell size={12} />提醒我</button></div>
      </article>)}{!isLoading && !items.length && <p className="rounded-xl border border-dashed border-border py-7 text-center text-[12px] text-olive-mute">当前筛选下没有待办，已完成或暂停主档不会混入常规分母。</p>}</div>
      {remind.isSuccess && <p className="mt-2 text-[11px] text-[#2F7A41]">{remind.data.duplicate ? "今天已创建过同一待办提醒，不会重复发送。" : "提醒已写入通知中心。"}</p>}
      {remind.error && <p role="alert" className="mt-2 text-[11px] text-red-700">{remind.error.message}</p>}
    </>}
  </section>;
}

export function CoachingNotificationCenter({ family = false }: { family?: boolean }) {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.coaching.notifications.useQuery();
  const [manualId, setManualId] = useState(0);
  const [reason, setReason] = useState("");
  const refresh = async () => { await utils.coaching.notifications.invalidate(); };
  const read = trpc.coaching.readNotification.useMutation({ onSuccess: refresh });
  const retry = trpc.coaching.retryNotification.useMutation({ onSuccess: refresh });
  const manual = trpc.coaching.manualNotification.useMutation({ onSuccess: async () => { setManualId(0); setReason(""); await refresh(); } });
  return <div className={family ? "rounded-2xl border border-[#0C7064]/15 bg-white p-4 shadow-sm" : "mt-4"}>
    <div className="flex items-center gap-2"><Bell size={16} className="text-[#0C7064]" /><h3 className="text-[13px] font-bold text-olive">站内通知</h3><span className="rounded-full bg-mint-pale px-2 py-0.5 text-[10px] text-[#0C7064]">{data?.unread ?? 0} 条未读</span></div>
    <p className="mt-1.5 text-[10.5px] leading-relaxed text-olive-mute">{data?.channelNote ?? "当前仅提供站内通知，不代表微信或短信已经送达。"}</p>
    {isLoading && <p className="py-5 text-center text-[11.5px] text-olive-mute">正在投递到期通知…</p>}
    {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-[11px] text-red-700">{error.message}</p>}
    <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">{data?.items.map((item) => <article key={item.id} className={`rounded-xl border p-3 ${item.priority === "urgent" ? "border-amber-300 bg-amber-50/60" : "border-border bg-cream/35"}`}>
      <div className="flex flex-wrap items-center gap-2"><b className="min-w-0 flex-1 break-words text-[12px] text-olive">{item.title}</b><span className={`rounded-full px-2 py-0.5 text-[9.5px] ${item.status === "failed" ? "bg-red-100 text-red-700" : item.status === "delivered" ? "bg-mint-pale text-[#0C7064]" : "bg-cream-deep/50 text-olive-mute"}`}>{STATUS[item.status] ?? item.status}</span>{item.readAt && <span className="text-[9.5px] text-olive-mute">已读</span>}</div>
      <p className="mt-1.5 whitespace-pre-wrap break-words text-[11.5px] leading-relaxed text-olive-soft">{item.body}</p>
      <div className="mt-2 grid gap-0.5 text-[9.5px] text-olive-mute"><span>创建 {dateTime(item.createdAt)} · 可发送 {dateTime(item.notBefore)}</span><span>发送 {dateTime(item.sentAt)} · 送达 {dateTime(item.deliveredAt)} · 已读 {dateTime(item.readAt)}</span>{item.retryCount > 0 && <span>已重试 {item.retryCount} 次</span>}{item.failureReason && <span className="text-red-700">失败原因：{item.failureReason}</span>}{item.manualReason && <span>转人工：{item.manualReason}</span>}</div>
      <div className="mt-2 flex flex-wrap gap-2">{item.status === "delivered" && !item.readAt && <button type="button" disabled={read.isPending} onClick={() => read.mutate({ notificationId: item.id })} className={secondary}><Check size={12} />标记已读</button>}{!family && item.status === "failed" && <><button type="button" disabled={retry.isPending} onClick={() => retry.mutate({ notificationId: item.id })} className={secondary}><RotateCcw size={12} />重试</button><button type="button" onClick={() => { setManualId(item.id); setReason(""); }} className={secondary}>转人工</button></>}</div>
      {!family && manualId === item.id && <div className="mt-2 rounded-lg bg-white p-2.5"><label className="text-[10.5px] font-semibold text-olive">转人工原因<input aria-label={`通知 ${item.id} 转人工原因`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="说明原因与后续联系方式" className={`${input} w-full`} /></label><button type="button" disabled={manual.isPending || reason.trim().length < 2} onClick={() => manual.mutate({ notificationId: item.id, reason })} className={`${secondary} mt-2`}>确认转人工</button></div>}
    </article>)}{!isLoading && !data?.items.length && <p className="rounded-xl border border-dashed border-border py-6 text-center text-[11.5px] text-olive-mute">暂无通知。交接、月报和正式课堂反馈产生后会显示在这里。</p>}</div>
    {(read.error ?? retry.error ?? manual.error) && <p role="alert" className="mt-2 text-[11px] text-red-700">{(read.error ?? retry.error ?? manual.error)?.message}</p>}
  </div>;
}

function StaffWorkloads() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.coaching.staffWorkloads.useQuery();
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("07:00");
  const [suggestedCaseLoad, setSuggestedCaseLoad] = useState(20);
  useEffect(() => { if (data?.settings) { setQuietStart(data.settings.quietStart); setQuietEnd(data.settings.quietEnd); setSuggestedCaseLoad(data.settings.suggestedCaseLoad); } }, [data?.settings]);
  const save = trpc.coaching.saveNotificationSettings.useMutation({ onSuccess: async () => { await Promise.all([utils.coaching.staffWorkloads.invalidate(), utils.coaching.notificationSettings.invalidate()]); } });
  return <div className="mt-4">
    <section className="rounded-xl bg-cream/45 p-3"><h3 className="flex items-center gap-1.5 text-[12px] font-bold text-olive"><Settings2 size={14} />通知静默与建议负荷</h3><div className="mt-2 grid gap-2 sm:grid-cols-3"><label className="text-[10.5px] font-semibold text-olive">静默开始<input type="time" value={quietStart} onChange={(event) => setQuietStart(event.target.value)} className={`${input} w-full`} /></label><label className="text-[10.5px] font-semibold text-olive">静默结束<input type="time" value={quietEnd} onChange={(event) => setQuietEnd(event.target.value)} className={`${input} w-full`} /></label><label className="text-[10.5px] font-semibold text-olive">建议在读人数<input type="number" min={1} max={200} value={suggestedCaseLoad} onChange={(event) => setSuggestedCaseLoad(Number(event.target.value))} className={`${input} w-full`} /></label></div><p className="mt-2 text-[10px] leading-relaxed text-olive-mute">开始与结束相同表示关闭静默。心理与安全紧急事项会绕过静默；超过建议负荷仅预警，不限制接案。</p><button type="button" disabled={save.isPending || suggestedCaseLoad < 1 || suggestedCaseLoad > 200} onClick={() => save.mutate({ quietStart, quietEnd, suggestedCaseLoad })} className={`${secondary} mt-2`}>保存机构设置</button>{save.isSuccess && <span className="ml-2 text-[10.5px] text-[#2F7A41]">已保存</span>}{save.error && <p role="alert" className="mt-2 text-[11px] text-red-700">{save.error.message}</p>}</section>
    {isLoading && <p className="py-5 text-center text-[11.5px] text-olive-mute">正在计算团队负荷…</p>}{error && <p role="alert" className="mt-2 text-[11px] text-red-700">{error.message}</p>}
    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{data?.staff.map((person) => <article key={person.userId} className={`rounded-xl border p-3 ${person.overdue || person.caseOverload ? "border-amber-300 bg-amber-50/45" : "border-border bg-cream/35"}`}><div className="flex items-center gap-2"><Users size={14} className="text-[#0C7064]" /><b className="min-w-0 flex-1 truncate text-[12px] text-olive">{person.name}</b><span className="text-[9.5px] text-olive-mute">{person.role === "admin" ? "管理员" : "伴学师"}</span></div><div className="mt-2 grid grid-cols-4 gap-1 text-center"><span className="rounded-lg bg-white p-1.5 text-[9px] text-olive-mute"><b className="block text-[15px] text-olive">{person.activeCases}</b>在读</span><span className="rounded-lg bg-white p-1.5 text-[9px] text-olive-mute"><b className="block text-[15px] text-olive">{person.pausedCases}</b>暂停</span><span className="rounded-lg bg-white p-1.5 text-[9px] text-olive-mute"><b className="block text-[15px] text-olive">{person.todayTodos}</b>今日</span><span className="rounded-lg bg-white p-1.5 text-[9px] text-olive-mute"><b className="block text-[15px] text-amber-800">{person.overdueTodos}</b>逾期</span></div><p className={`mt-2 text-[10px] leading-relaxed ${person.overdue || person.caseOverload ? "text-amber-900" : "text-olive-mute"}`}>{person.message}{person.openRisks > 0 ? `；开放风险 ${person.openRisks} 项` : ""}</p></article>)}</div>
  </div>;
}
