import { useEffect, useState } from "react";
import { Coins, SlidersHorizontal } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { DEFAULT_ORG_POINTS } from "@contracts/orgService";

export default function OrgPlatformPoints({ orgs }: { orgs: { id: number; name: string; brandName: string; edition: "school" | "org" }[] }) {
  const utils = trpc.useUtils();
  const institutionOrgs = orgs.filter((o) => o.edition === "org");
  const [orgId, setOrgId] = useState(0);
  const [initialAmount, setInitialAmount] = useState(DEFAULT_ORG_POINTS);
  const [delta, setDelta] = useState(1000);
  const [reason, setReason] = useState("");
  useEffect(() => { if (!institutionOrgs.some((o) => o.id === orgId)) setOrgId(institutionOrgs[0]?.id ?? 0); }, [institutionOrgs, orgId]);
  const { data: points } = trpc.orgService.points.useQuery({ orgId }, { enabled: orgId > 0 });
  const refresh = async () => { await utils.orgService.points.invalidate({ orgId }); };
  const initialize = trpc.orgService.initializePoints.useMutation({ onSuccess: refresh });
  const adjust = trpc.orgService.adjustPoints.useMutation({ onSuccess: async () => { setReason(""); await refresh(); } });

  return <section className="rounded-2xl border border-[#0C7064]/20 bg-mint-pale/25 p-4">
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-52 flex-1"><h2 className="flex items-center gap-2 text-[16px] font-bold text-olive"><Coins size={18} className="text-[#0C7064]" />机构积分初始化与调整</h2><p className="mt-1 text-[11.5px] text-olive-mute">新机构默认首次发放 {DEFAULT_ORG_POINTS.toLocaleString()} 积分，超管可调整；200 人完整理论覆盖测算为 59,800 积分（取整参考 60,000）。仅首次初始化发放，已有机构不补发、不重置，编辑资料或刷新不会重复赠送；校园版不发放。</p></div>
      <select aria-label="选择机构" value={orgId} onChange={(e) => setOrgId(Number(e.target.value))} className="min-h-11 rounded-xl border border-border bg-white px-3 py-2 text-[12.5px] text-olive outline-none focus:border-[#0C7064]">{institutionOrgs.map((o) => <option key={o.id} value={o.id}>{o.brandName}（{o.name}）</option>)}</select>
    </div>
    {!institutionOrgs.length ? <p className="mt-3 text-[12px] text-olive-mute">暂无机构版账号。</p> : <>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-3.5">
          <div className="flex flex-wrap items-center gap-3"><div className="flex-1 text-[12px] text-olive-mute">当前总余额 <b className="mono ml-1 text-[18px] text-olive">{(points?.totalBalance ?? 0).toLocaleString()}</b><span className="ml-3">未分配池 <b className="mono text-olive">{(points?.poolBalance ?? 0).toLocaleString()}</b></span></div><span className={`rounded-full px-2 py-1 text-[10.5px] font-semibold ${points?.initialized ? "bg-mint-pale text-[#0C7064]" : "bg-amber-50 text-amber-800"}`}>{points?.initialized ? "已初始化" : "待初始化"}</span></div>
          {!points?.initialized && <div className="mt-3 flex flex-wrap gap-2"><label className="flex-1 text-[11px] font-semibold text-olive">首次发放积分<input type="number" min={0} max={100000000} step={1000} value={initialAmount} onChange={(e) => setInitialAmount(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-border px-3 py-2 font-normal outline-none focus:border-[#0C7064]" /></label><button type="button" onClick={() => initialize.mutate({ orgId, amount: initialAmount })} disabled={initialize.isPending || !Number.isSafeInteger(initialAmount) || initialAmount < 0} className="self-end rounded-lg bg-[#0C7064] px-4 py-2.5 text-[12px] font-semibold text-white hover:bg-[#095C53] disabled:opacity-40">{initialize.isPending ? "正在初始化…" : "首次初始化"}</button></div>}
          {initialize.isSuccess && <p className="mt-2 text-[11px] text-[#2F7A41]">{initialize.data.initialized ? "首次发放完成。" : "该机构此前已初始化，未重复发放。"}</p>}
          {initialize.error && <p role="alert" className="mt-2 text-[11px] text-red-700">{initialize.error.message}</p>}
        </div>
        <div className="rounded-xl bg-white p-3.5">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-olive"><SlidersHorizontal size={14} />调整未分配池</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_auto]"><input aria-label="调整积分数量" type="number" step={100} value={delta} onChange={(e) => setDelta(Number(e.target.value))} className="rounded-lg border border-border px-3 py-2 text-[12px] outline-none focus:border-[#0C7064]" /><input aria-label="调整原因" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="必填：扩容、补发或回收原因" className="rounded-lg border border-border px-3 py-2 text-[12px] outline-none focus:border-[#0C7064]" /><button type="button" disabled={adjust.isPending || !points?.initialized || !Number.isSafeInteger(delta) || delta === 0 || reason.trim().length < 2} onClick={() => adjust.mutate({ orgId, delta, reason })} className="rounded-lg bg-[#0C7064] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#095C53] disabled:opacity-40">{adjust.isPending ? "调整中…" : "确认调整"}</button></div>
          <p className="mt-1.5 text-[10.5px] text-olive-mute">正数增加、负数减少；不能调成负余额。调整只影响未分配池，不直接扣伴学师个人钱包。</p>
          {adjust.isSuccess && <p className="mt-2 text-[11px] text-[#2F7A41]">调整已写入积分流水。</p>}{adjust.error && <p role="alert" className="mt-2 text-[11px] text-red-700">{adjust.error.message}</p>}
        </div>
      </div>
    </>}
  </section>;
}
