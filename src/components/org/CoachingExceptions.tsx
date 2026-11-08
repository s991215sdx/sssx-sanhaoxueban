import { useEffect, useMemo, useState } from "react";
import { AlertOctagon, CheckCircle2, Clock3, Eye, ShieldAlert, ShieldCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { COACHING_EXCEPTION_CATEGORIES, COACHING_EXCEPTION_SEVERITIES, coachingExceptionSensitive,
  defaultCoachingExceptionDueAt, type CoachingExceptionCategory, type CoachingExceptionSeverity } from "@contracts/orgService";
import type { CoachingDetail } from "./coachingTypes";
import { invalidateCoachingOperations } from "./coachingRefresh";

type ExceptionItem = CoachingDetail["exceptions"][number];
const input = "mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] font-normal text-olive outline-none focus:border-[#0C7064]";
const label = "block text-[11.5px] font-semibold text-olive";
const primary = "min-h-10 rounded-xl bg-[#0C7064] px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-[#095C53] disabled:opacity-40";
const STATUS = { open: "待处理", processing: "处理中", closed: "已关闭" } as const;

function dateInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function displayDate(value: Date | string): string {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

/** S1—S4 补救闭环。敏感正文不放在普通 detail 响应中，管理员每次主动查看均审计。 */
export default function CoachingExceptions({ data }: { data: CoachingDetail }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const caseId = data.coachingCase.id;
  const { data: staff = [] } = trpc.coaching.staff.useQuery();
  const [severity, setSeverity] = useState<CoachingExceptionSeverity>("S1");
  const [category, setCategory] = useState<CoachingExceptionCategory>("service");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [sensitive, setSensitive] = useState(false);
  const [assigneeId, setAssigneeId] = useState(0);
  const [dueAt, setDueAt] = useState(dateInput(defaultCoachingExceptionDueAt("S1")));
  const [revealed, setRevealed] = useState<Record<number, ExceptionItem>>({});
  const mustSensitive = coachingExceptionSensitive(severity, category);
  const isSensitive = coachingExceptionSensitive(severity, category, sensitive);
  const admins = useMemo(() => staff.filter((person) => person.role === "admin"), [staff]);
  const openCount = data.exceptions.filter((item) => item.status !== "closed").length;
  const refresh = () => Promise.all([utils.coaching.detail.invalidate({ caseId }), invalidateCoachingOperations(utils)]);

  useEffect(() => {
    setSeverity("S1"); setCategory("service"); setTitle(""); setDetail(""); setSensitive(false);
    setAssigneeId(0); setDueAt(dateInput(defaultCoachingExceptionDueAt("S1"))); setRevealed({});
  }, [caseId]);
  useEffect(() => {
    if (isSensitive && !admins.some((person) => person.id === assigneeId)) setAssigneeId(admins[0]?.id ?? 0);
  }, [admins, assigneeId, isSensitive]);
  const create = trpc.coaching.createException.useMutation({ onSuccess: async () => {
    setTitle(""); setDetail(""); setSensitive(false); await refresh();
  } });
  const reveal = trpc.coaching.revealException.useMutation({ onSuccess: (item) => {
    setRevealed((current) => ({ ...current, [item.id]: item }));
  } });

  return <section className="min-w-0 rounded-2xl border border-border bg-white p-4 shadow-sm">
    <header className="flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1"><h2 className="flex items-center gap-1.5 text-[16px] font-bold text-olive"><ShieldCheck size={18} className="text-[#0C7064]" />S1—S4 异常补救闭环</h2><p className="mt-1 text-[11.5px] leading-relaxed text-olive-mute">登记事实、指定接收人与补救期限；每次处理均追加记录，关闭必须填写处理结果与可核验证据。</p></div>
      <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800">{openCount} 项未关闭 · 共 {data.exceptions.length} 项</span>
    </header>

    <div className="mt-4 rounded-xl border border-[#0C7064]/15 bg-mint-pale/20 p-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className={label}>异常等级<select aria-label="异常等级" value={severity} onChange={(event) => { const value = event.target.value as CoachingExceptionSeverity; setSeverity(value); setDueAt(dateInput(defaultCoachingExceptionDueAt(value))); create.reset(); }} className={input}>{COACHING_EXCEPTION_SEVERITIES.map((key) => <option key={key} value={key}>{key} · {{ S1: "轻微", S2: "一般", S3: "严重", S4: "重大" }[key]}</option>)}</select></label>
        <label className={label}>异常类别<select aria-label="异常类别" value={category} onChange={(event) => { setCategory(event.target.value as CoachingExceptionCategory); create.reset(); }} className={input}>{COACHING_EXCEPTION_CATEGORIES.map((item) => <option key={item.key} value={item.key}>{item.label}{item.sensitive ? "（敏感）" : ""}</option>)}</select></label>
        <label className={label}>接收人<select aria-label="异常接收人" value={assigneeId} onChange={(event) => setAssigneeId(Number(event.target.value))} className={input}><option value={0}>请选择</option>{(isSensitive ? admins : staff).map((person) => <option key={person.id} value={person.id}>{person.name} · {person.role === "admin" ? "管理员" : "伴学师"}</option>)}</select></label>
        <label className={label}>补救期限<input aria-label="补救期限" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className={input} /></label>
      </div>
      <p className="mt-1 text-[10.5px] text-olive-mute">默认时限：S1 当日、S2 两小时、S3 二十四小时、S4 立即；可按实际情况调整并留存。</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className={label}>异常标题<input aria-label="异常标题" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} placeholder="例：周复盘未按约定时间完成" className={input} /></label>
        <label className={label}>事实与影响<textarea aria-label="异常事实与影响" value={detail} onChange={(event) => setDetail(event.target.value)} rows={2} maxLength={12000} placeholder="客观记录发生了什么、影响哪个交付节点；心理与安全类不要写入普通时间线" className={input} /></label>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-[11.5px] text-olive"><input aria-label="按敏感异常保护" type="checkbox" checked={isSensitive} disabled={mustSensitive} onChange={(event) => setSensitive(event.target.checked)} className="accent-[#0C7064]" />按敏感异常最小可见{mustSensitive && "（当前等级／类别强制）"}</label>
        <button type="button" disabled={create.isPending || !assigneeId || !dueAt || title.trim().length < 2 || detail.trim().length < 2} onClick={() => create.mutate({ caseId, severity, category, title, detail, sensitive, assigneeId, dueAt: new Date(dueAt) })} className={`${primary} ml-auto`}>{create.isPending ? "登记中…" : "登记异常并指定接收人"}</button>
      </div>
      {isSensitive && <p className={`mt-2 rounded-lg p-2.5 text-[11.5px] leading-relaxed ${severity === "S4" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}><ShieldAlert size={14} className="mr-1 inline" />{severity === "S4" ? "重大异常：立即升级机构负责人并启动线下应急流程；系统记录不能替代现实救助，伴学师不作心理诊断或治疗。" : "敏感正文仅本机构管理员可主动查看与处理；每次查看均写审计，普通伴学师只见必要的办理信息。"}</p>}
      {create.error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-[11.5px] text-red-700">{create.error.message}</p>}
      {create.isSuccess && <p className="mt-2 text-[11px] text-[#2F7A41]">异常已登记，接收人和补救期限已留痕。</p>}
    </div>

    {reveal.error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2.5 text-[11.5px] text-red-700">{reveal.error.message}</p>}
    <div className="mt-4 space-y-3">{data.exceptions.map((item) => <ExceptionCard key={item.id} item={revealed[item.id] ?? item} isRevealed={Boolean(revealed[item.id])}
      isAdmin={user?.role === "admin"} revealing={reveal.isPending} onReveal={() => reveal.mutate({ exceptionId: item.id })} onChanged={async (exceptionId) => {
        setRevealed((current) => { const next = { ...current }; delete next[exceptionId]; return next; });
        await refresh();
      }} />)}
      {!data.exceptions.length && <p className="rounded-xl border border-dashed border-border py-6 text-center text-[12px] text-olive-mute">当前主档暂无异常记录。发现延误、档案缺项或安全问题时，从上方登记。</p>}
    </div>
  </section>;
}

function ExceptionCard({ item, isRevealed, isAdmin, revealing, onReveal, onChanged }: {
  item: ExceptionItem; isRevealed: boolean; isAdmin: boolean; revealing: boolean; onReveal: () => void; onChanged: (exceptionId: number) => Promise<unknown>;
}) {
  const [action, setAction] = useState<"progress" | "closed">("progress");
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState("");
  const save = trpc.coaching.recordException.useMutation({ onSuccess: async () => { setNote(""); setEvidence(""); await onChanged(item.id); } });
  const canProcess = !item.sensitive || isAdmin;
  const overdue = item.status !== "closed" && new Date(item.dueAt).getTime() < Date.now();
  return <article className={`rounded-xl border p-3 ${item.severity === "S4" ? "border-red-200 bg-red-50/35" : "border-border bg-cream/35"}`}>
    <div className="flex flex-wrap items-center gap-2">
      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${item.severity === "S4" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-900"}`}>{item.severity}{item.sensitive ? " · 敏感" : ""}</span>
      <b className="min-w-0 flex-1 text-[12.5px] text-olive">{item.title}</b>
      <span className="text-[10.5px] text-olive-mute">{STATUS[item.status as keyof typeof STATUS] ?? item.status}</span>
    </div>
    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-olive-mute"><span>接收人：{item.assigneeName || `账号 #${item.assigneeId}`}</span><span className={overdue ? "font-semibold text-red-700" : ""}><Clock3 size={11} className="mr-0.5 inline" />{overdue ? "已逾期 · " : "期限 · "}{displayDate(item.dueAt)}</span><span>登记：{displayDate(item.createdAt)}</span></div>
    {item.sensitive && !isRevealed ? <div className="mt-2 rounded-lg bg-white/75 p-2.5 text-[11px] leading-relaxed text-olive-mute">敏感标题、事实、处理正文与关闭证据未随普通详情返回。{isAdmin ? "如需办理，请主动授权查看；本次查看将写入审计。" : "请联系本机构管理员处理。"}</div> : <p className="mt-2 whitespace-pre-wrap text-[11.5px] leading-relaxed text-olive-soft">{item.detail}</p>}
    {item.sensitive && !isRevealed && isAdmin && <button type="button" disabled={revealing} onClick={onReveal} className="mt-2 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-amber-900"><Eye size={13} className="mr-1 inline" />{revealing ? "授权查看中…" : "授权查看并记录审计"}</button>}

    {item.actions.length > 0 && <div className="mt-3 space-y-1.5 border-l-2 border-[#0C7064]/20 pl-3">{item.actions.map((entry) => <div key={entry.id} className="text-[10.5px] leading-relaxed text-olive-mute"><span>{displayDate(entry.createdAt)} · {entry.actorName || `账号 #${entry.actorUserId}`} · {{ created: "登记", progress: "处理", closed: "关闭" }[entry.action] ?? entry.action}</span>{entry.note && <p className="mt-0.5 whitespace-pre-wrap text-olive-soft">{entry.note}</p>}{entry.evidence && <p className="mt-0.5 whitespace-pre-wrap text-[#0C7064]">证据：{entry.evidence}</p>}</div>)}</div>}
    {item.status === "closed" ? <p className="mt-2 text-[11px] font-semibold text-[#2F7A41]"><CheckCircle2 size={14} className="mr-1 inline" />已关闭；原处理历史与关闭证据只读保留。</p> : canProcess && (!item.sensitive || isRevealed) && <div className="mt-3 rounded-lg bg-white p-2.5">
      <div className="grid gap-2 sm:grid-cols-[150px_minmax(0,1fr)]"><label className={label}>本次操作<select aria-label={`异常 #${item.id} 操作`} value={action} onChange={(event) => setAction(event.target.value as typeof action)} className={input}><option value="progress">登记处理进展</option><option value="closed">核验并关闭</option></select></label><label className={label}>{action === "closed" ? "处理结果" : "处理进展"}<textarea aria-label={`异常 #${item.id} 处理说明`} value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={12000} placeholder="已采取的补救、沟通或升级动作" className={input} /></label></div>
      <label className={`${label} mt-2`}>{action === "closed" ? "关闭证据（必填）" : "过程证据（可选）"}<textarea aria-label={`异常 #${item.id} 处理证据`} value={evidence} onChange={(event) => setEvidence(event.target.value)} rows={2} maxLength={12000} placeholder="补交档案编号、复验结果、沟通确认或其他可核验事实" className={input} /></label>
      <button type="button" disabled={save.isPending || note.trim().length < 2 || (action === "closed" && evidence.trim().length < 2)} onClick={() => save.mutate({ exceptionId: item.id, action, note, evidence })} className={`${primary} mt-2 w-full`}>{save.isPending ? "保存中…" : action === "closed" ? "保存处理结果与证据并关闭" : "追加处理记录"}</button>
    </div>}
    {save.error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] text-red-700">{save.error.message}</p>}
    {save.isSuccess && <p className="mt-2 text-[11px] text-[#2F7A41]">处理历史已追加保存。</p>}
    {item.severity === "S4" && item.status !== "closed" && <p className="mt-2 text-[11px] font-semibold text-red-800"><AlertOctagon size={13} className="mr-1 inline" />请同步执行机构线下应急预案，不要等待系统提醒。</p>}
  </article>;
}
