import { useState } from "react";
import { CalendarClock, Save, ShieldCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";

const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const input = "mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] font-normal text-olive outline-none focus:border-[#0C7064]";
const label = "block text-[10.5px] font-semibold text-olive";
type Settings = { h3Hours: number; weeklyPlanDay: number; weeklyReviewDay: number; qualityVersion: string; retentionDays: number; hardCaseLimit: number; s1Hours: number; s2Hours: number; s3Hours: number };
const DEFAULTS: Settings = { h3Hours: 24, weeklyPlanDay: 1, weeklyReviewDay: 0, qualityVersion: "1.0", retentionDays: 365, hardCaseLimit: 0, s1Hours: 8, s2Hours: 2, s3Hours: 24 };

/** 机构级交付节奏与容量配置；保存仍由服务端核验管理员身份。 */
export default function CoachingDeliverySettings() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.coaching.deliverySettings.useQuery();
  const [draft, setDraft] = useState<Partial<Settings>>({});
  const settings: Settings = { ...DEFAULTS, ...data, ...draft };
  const save = trpc.coaching.saveDeliverySettings.useMutation({ onSuccess: async () => {
    await Promise.all([utils.coaching.deliverySettings.invalidate(), utils.coaching.operations.invalidate(), utils.coaching.staffWorkloads.invalidate()]);
  } });
  const patch = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((old) => ({ ...old, [key]: value }));
  const numberField = (key: "h3Hours" | "s1Hours" | "s2Hours" | "s3Hours" | "retentionDays" | "hardCaseLimit", text: string, min: number, max: number, note?: string) => <label className={label}>{text}<input aria-label={text} type="number" min={min} max={max} value={settings[key]} onChange={(event) => patch(key, Number(event.target.value))} className={input} />{note && <span className="mt-1 block text-[9.5px] font-normal leading-relaxed text-olive-mute">{note}</span>}</label>;
  const valid = settings.h3Hours >= 1 && settings.h3Hours <= 168 && settings.s1Hours >= 1 && settings.s1Hours <= 168
    && settings.s2Hours >= 1 && settings.s2Hours <= 72 && settings.s3Hours >= 1 && settings.s3Hours <= 168
    && settings.retentionDays >= 30 && settings.retentionDays <= 3650 && settings.hardCaseLimit >= 0 && settings.hardCaseLimit <= 10000;
  return <section className="mb-3 rounded-xl border border-[#0C7064]/15 bg-mint-pale/20 p-3">
    <div className="flex items-center gap-2"><CalendarClock size={15} className="text-[#0C7064]" /><div className="min-w-0 flex-1"><h3 className="text-[12.5px] font-bold text-olive">交付节奏、异常时限与档案保留</h3><p className="mt-1 text-[10px] leading-relaxed text-olive-mute">此处修改机构后续默认规则；已发生记录的原时限和历史快照不回写。</p></div></div>
    {isLoading && <p className="py-4 text-center text-[11px] text-olive-mute">正在读取机构交付设置…</p>}
    {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] text-red-700">{error.message}</p>}
    {data && <>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{numberField("h3Hours", "H3 交接时限（小时）", 1, 168)}{numberField("s1Hours", "S1 默认时限（小时）", 1, 168)}{numberField("s2Hours", "S2 默认时限（小时）", 1, 72)}{numberField("s3Hours", "S3 默认时限（小时）", 1, 168)}</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><label className={label}>周计划日<select aria-label="周计划日" value={settings.weeklyPlanDay} onChange={(event) => patch("weeklyPlanDay", Number(event.target.value))} className={input}>{WEEK.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label className={label}>周复盘日<select aria-label="周复盘日" value={settings.weeklyReviewDay} onChange={(event) => patch("weeklyReviewDay", Number(event.target.value))} className={input}>{WEEK.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label className={label}>质量框架版本<select aria-label="质量框架版本" value={settings.qualityVersion} onChange={(event) => patch("qualityVersion", event.target.value)} className={input}><option value="1.0">1.0 · 当前已发布</option></select></label>{numberField("retentionDays", "附件保留天数", 30, 3650)}</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{numberField("hardCaseLimit", "单人硬容量（在读主档）", 0, 10000, "0 表示沿用建议负荷；建议负荷可在下方设置。管理员也不能绕过明确设置的硬容量。")}<div className="rounded-lg bg-white p-2.5 text-[10px] leading-relaxed text-olive-soft sm:col-span-2 lg:col-span-3"><ShieldCheck size={13} className="mr-1 inline text-[#0C7064]" />S4 始终立即处理，不提供延迟配置。系统留痕不替代现实救助、专业复核或转介；附件到期销毁仍需管理员逐项核验。</div></div>
      <div className="mt-3 flex items-center gap-3"><button type="button" disabled={save.isPending || !valid} onClick={() => save.mutate(settings)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#0C7064] px-3.5 py-2 text-[11.5px] font-semibold text-white disabled:opacity-40"><Save size={13} />{save.isPending ? "保存中…" : "保存机构交付设置"}</button>{save.isSuccess && <span className="text-[10.5px] text-[#2F7A41]">设置已保存并刷新。</span>}</div>
      {save.error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] text-red-700">{save.error.message}</p>}
    </>}
  </section>;
}
