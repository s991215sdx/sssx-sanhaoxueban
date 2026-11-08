import { useState } from "react";
import { ArrowRightLeft, Check, ChevronDown, Inbox, UserCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";

const TYPE_LABEL: Record<string, string> = {
  H1: "新生接手",
  H2: "阶段服务交接",
  H3: "课后督学交接",
  H4: "结课与回访交接",
  H5: "人员改派",
};

/** 新督学即使尚未进入主档名单，也能从这里查看必要背景并完成接收。 */
export default function CoachingHandoffInbox() {
  const utils = trpc.useUtils();
  const { data: incoming = [], isLoading, error } = trpc.coaching.incoming.useQuery();
  const [confirmId, setConfirmId] = useState(0);
  const [accepted, setAccepted] = useState<{ id: number; reassigned: boolean } | null>(null);
  const accept = trpc.coaching.acceptHandoff.useMutation({
    onSuccess: async (result, input) => {
      setConfirmId(0);
      setAccepted({ id: input.handoffId, reassigned: result.reassigned });
      await Promise.all([
        utils.coaching.incoming.invalidate(),
        utils.coaching.cases.invalidate(),
        utils.coaching.detail.invalidate(),
        utils.coaching.operations.invalidate(),
        utils.coaching.staffWorkloads.invalidate(),
      ]);
    },
  });

  if (isLoading) {
    return <section aria-label="待接收交接" className="rounded-2xl border border-border bg-white p-4 text-[12px] text-olive-mute shadow-sm">正在读取待接收交接…</section>;
  }
  if (error) {
    return <section aria-label="待接收交接" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[12px] text-red-700">待接收交接读取失败：{error.message}</section>;
  }
  if (!incoming.length) return null;

  return <section aria-label="待接收交接" className="overflow-hidden rounded-2xl border border-[#0C7064]/20 bg-white shadow-sm">
    <header className="flex flex-wrap items-center gap-2 bg-mint-pale/45 px-4 py-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#0C7064]"><Inbox size={17} /></span>
      <div className="min-w-0 flex-1"><h2 className="text-[14px] font-bold text-olive">待我接收的服务交接</h2><p className="mt-0.5 text-[10.5px] text-olive-mute">先核对背景与责任边界，再确认接收。</p></div>
      <span className="rounded-full bg-[#0C7064] px-2.5 py-1 text-[11px] font-semibold text-white">{incoming.length} 项</span>
    </header>
    <div className="divide-y divide-border px-4">
      {incoming.map(({ handoff, studentName, goal, currentSituation, planSummary }) => {
        const isReassignment = handoff.type === "H5";
        const confirming = confirmId === handoff.id;
        return <article key={handoff.id} className="py-4">
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-mint-pale px-2 py-1 text-[10.5px] font-bold text-[#0C7064]">{handoff.type}</span><h3 className="text-[13px] font-bold text-olive">{studentName ?? "学员"} · {TYPE_LABEL[handoff.type] ?? "服务交接"}</h3></div>
              <p className="mt-1.5 text-[12px] font-semibold text-olive-soft">{handoff.title}</p>
            </div>
            <span className="text-[10px] text-olive-mute">#{handoff.id}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-cream/60 p-3 text-[11.5px] leading-relaxed text-olive-soft">{handoff.content}</p>
          <details className="group mt-2 rounded-xl border border-border bg-white p-3">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11.5px] font-semibold text-olive"><ChevronDown size={14} className="transition-transform group-open:rotate-180" />接收前查看必要的 GROW 背景</summary>
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              {[["明确目标", goal], ["评估现状", currentSituation], ["定制计划", planSummary]].map(([label, text]) => <div key={label} className="min-w-0 rounded-lg bg-cream/50 p-2.5"><b className="text-[10.5px] text-[#0C7064]">{label}</b><p className="mt-1 max-h-36 overflow-y-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-olive-soft">{text || "暂未填写"}</p></div>)}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-olive-mute">此处仅提供交接所需背景，不开放敏感异常正文，也不代表已取得其他主档的修改权限。</p>
          </details>
          {isReassignment && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900"><ArrowRightLeft size={13} className="mr-1 inline" />这是人员改派：只有你确认接收后，新主教与督学负责人才会正式生效；接收前仍由原负责人服务。</p>}
          {accepted?.id === handoff.id && <p className="mt-2 text-[11px] text-[#2F7A41]">{accepted.reassigned ? "接收成功，新负责人已生效。" : "交接已确认接收。"}</p>}
          {accept.error && confirmId === handoff.id && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">{accept.error.message}</p>}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {confirming ? <>
              <button type="button" disabled={accept.isPending} onClick={() => setConfirmId(0)} className="min-h-10 rounded-xl border border-border px-3 py-2 text-[11.5px] font-semibold text-olive">再想想</button>
              <button type="button" disabled={accept.isPending} onClick={() => accept.mutate({ handoffId: handoff.id })} className="min-h-10 rounded-xl bg-[#0C7064] px-3.5 py-2 text-[11.5px] font-semibold text-white disabled:opacity-40"><Check size={14} className="mr-1 inline" />{accept.isPending ? "正在接收…" : isReassignment ? "确认接收并使改派生效" : "确认接收"}</button>
            </> : <button type="button" onClick={() => { accept.reset(); setAccepted(null); setConfirmId(handoff.id); }} className="min-h-10 rounded-xl border border-[#0C7064]/25 px-3.5 py-2 text-[11.5px] font-semibold text-[#0C7064] hover:bg-mint-pale/40"><UserCheck size={14} className="mr-1 inline" />{isReassignment ? "核对并接收改派" : "核对并接收交接"}</button>}
          </div>
        </article>;
      })}
    </div>
  </section>;
}
