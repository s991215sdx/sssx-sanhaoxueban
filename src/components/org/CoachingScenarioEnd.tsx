import { useState } from "react";
import { Check, CircleStop } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { coachingScenarioLabel, type CoachingScenarioKey } from "@contracts/orgService";
import type { CoachingDetail } from "./coachingTypes";
import { invalidateCoachingOperations } from "./coachingRefresh";

/** 结束服务场景与结课是两个动作：历史周期保留，可逐个或全部结束。 */
export default function CoachingScenarioEnd({ data }: { data: CoachingDetail }) {
  const utils = trpc.useUtils();
  const caseId = data.coachingCase.id;
  const [selected, setSelected] = useState<CoachingScenarioKey[]>([]);
  const [reason, setReason] = useState("");
  const end = trpc.coaching.endScenarios.useMutation({ onSuccess: async () => {
    setSelected([]); setReason("");
    await Promise.all([utils.coaching.detail.invalidate({ caseId }), utils.coaching.cases.invalidate(), invalidateCoachingOperations(utils)]);
  } });
  const toggle = (key: CoachingScenarioKey) => setSelected((old) => old.includes(key) ? old.filter((item) => item !== key) : [...old, key]);
  return <section aria-label="结束服务场景" className="mt-3 rounded-xl border border-border bg-cream/40 p-3">
    <div className="flex flex-wrap items-center gap-2"><h4 className="flex min-w-0 flex-1 items-center gap-1.5 text-[12.5px] font-bold text-olive"><CircleStop size={14} />结束服务场景</h4>{data.serviceScenarios.length > 1 && <button type="button" onClick={() => setSelected(selected.length === data.serviceScenarios.length ? [] : [...data.serviceScenarios])} className="text-[10.5px] font-semibold text-[#0C7064]">{selected.length === data.serviceScenarios.length ? "清空选择" : "选择全部"}</button>}</div>
    <p className="mt-1 text-[10.5px] leading-relaxed text-olive-mute">可逐个或全部结束 A—D 场景。结束只关闭当前服务周期，不删除历史，也不会自动把主档结课。</p>
    {data.serviceScenarios.length ? <>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">{data.serviceScenarios.map((key) => <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] ${selected.includes(key) ? "border-[#0C7064]/35 bg-mint-pale/55 text-[#0C7064]" : "border-border bg-white text-olive"}`}><input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)} className="accent-[#0C7064]" />{key} · {coachingScenarioLabel(key)}{selected.includes(key) && <Check size={12} className="ml-auto" />}</label>)}</div>
      <label className="mt-2 block text-[11px] font-semibold text-olive">结束原因<textarea aria-label="结束服务场景原因" value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={2000} placeholder="说明该场景结束的日期、事实与后续安排" className="mt-1 w-full rounded-lg border border-border bg-white px-2.5 py-2 text-[12px] font-normal" /></label>
      <button type="button" disabled={end.isPending || !selected.length || reason.trim().length < 2} onClick={() => end.mutate({ caseId, scenarios: selected, reason })} className="mt-2 min-h-10 w-full rounded-xl border border-[#0C7064]/25 bg-white px-3 py-2 text-[11.5px] font-semibold text-[#0C7064] disabled:opacity-40">{end.isPending ? "正在结束…" : `结束所选 ${selected.length} 个场景并保留历史`}</button>
    </> : <p className="mt-2 rounded-lg bg-white p-2.5 text-[11px] text-olive-mute">当前没有使用中的服务场景；历史周期仍可在 GROW 区域查看。</p>}
    {end.error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] text-red-700">{end.error.message}</p>}
    {end.isSuccess && <p className="mt-2 text-[11px] text-[#2F7A41]">所选场景已结束，结束人、时间与原因均已留痕。</p>}
  </section>;
}
