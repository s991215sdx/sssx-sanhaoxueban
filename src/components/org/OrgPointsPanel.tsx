import { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Coins, Send, WalletCards } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";

const TYPE: Record<string, string> = { initial_grant: "平台初始化", platform_adjustment: "平台调整", allocation_out: "分配给伴学师", allocation_in: "机构分配入账", reclaim_out: "机构回收出账", reclaim_in: "机构回收入账", assessment_debit: "测评扣费", assessment_refund: "取消／过期退款" };

export default function OrgPointsPanel() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: points, isLoading, error } = trpc.orgService.points.useQuery({});
  const { data: tutors = [] } = trpc.admin.tutors.useQuery({ orgId: user?.orgId });
  const [tutorUserId, setTutorUserId] = useState(0);
  const [amount, setAmount] = useState(6000);
  const [reclaimAmount, setReclaimAmount] = useState(1000);
  const [reclaimReason, setReclaimReason] = useState("");
  const wallets = useMemo(() => new Map((points?.accounts ?? []).map((a) => [a.ownerUserId, a])), [points]);
  const allocate = trpc.orgService.allocatePoints.useMutation({ onSuccess: async () => { await utils.orgService.points.invalidate(); } });
  const reclaim = trpc.orgService.reclaimPoints.useMutation({ onSuccess: async () => { setReclaimReason(""); await utils.orgService.points.invalidate(); } });
  const recipients = [
    ...(user?.role === "admin" ? [{ id: user.id, name: `${user.name ?? "我"}（我 · 管理员）` }] : []),
    ...tutors.filter((t) => t.id !== user?.id),
  ];
  const personalTotal = (points?.totalBalance ?? 0) - (points?.poolBalance ?? 0);

  if (user?.role !== "admin") return <div className="rounded-2xl border border-border bg-white p-6 text-[13px] text-olive-mute">积分分配由机构管理员操作。你当前可用积分请见「测评中心」右上角。</div>;
  return <div className="space-y-4">
    <section className="grid gap-3 sm:grid-cols-3">
      <Metric icon={<Coins size={19} />} label="机构总余额" value={points?.totalBalance ?? 0} note="未分配池＋全部个人钱包" />
      <Metric icon={<WalletCards size={19} />} label="未分配池" value={points?.poolBalance ?? 0} note="平台初始化与调整进入这里" />
      <Metric icon={<Send size={19} />} label="已分配未使用" value={personalTotal} note="个人测评只扣自己的钱包" />
    </section>

    <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-[16px] font-bold text-olive">给伴学师／管理员分配个人积分</h2>
        <p className="mt-1 text-[11.5px] leading-relaxed text-olive-mute">分配只是从未分配池转到个人钱包，不属于测评消耗。管理员也可分给本人，用于本人建码的扫码注册和点选测评；注册或测评扣费时不会再扣机构池。请按实际服务量发放。</p>
        {!points?.initialized && !isLoading && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">本机构尚未初始化，请联系平台超管在「机构管理」中发放初始积分。</p>}
        <div className="mt-4 space-y-3">
          <label className="block text-[12px] font-semibold text-olive">伴学师<select value={tutorUserId} onChange={(e) => setTutorUserId(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-border bg-cream px-3 py-2.5 font-normal outline-none focus:border-[#0C7064]"><option value={0}>请选择接收人</option>{recipients.map((t) => <option key={t.id} value={t.id}>{t.name} · 当前 {(wallets.get(t.id)?.balance ?? 0).toLocaleString()} 积分</option>)}</select></label>
          <label className="block text-[12px] font-semibold text-olive">分配数量<input type="number" min={1} max={10000000} step={100} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-border bg-cream px-3 py-2.5 font-normal outline-none focus:border-[#0C7064]" /></label>
          <button type="button" disabled={allocate.isPending || !tutorUserId || !Number.isSafeInteger(amount) || amount <= 0 || amount > (points?.poolBalance ?? 0)} onClick={() => allocate.mutate({ tutorUserId, amount })} className="min-h-11 w-full rounded-xl bg-[#0C7064] py-2.5 text-[13px] font-semibold text-white hover:bg-[#095C53] disabled:opacity-40">{allocate.isPending ? "正在分配…" : "确认分配"}</button>
          {allocate.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{allocate.error.message}</p>}
          {allocate.isSuccess && <p className="text-[12px] text-[#2F7A41]">已分配，双方钱包与流水已同步更新。</p>}
        </div>
        <div className="mt-5 space-y-3 border-t border-border pt-4">
          <div><h3 className="text-[13px] font-bold text-olive">回收未使用个人积分</h3><p className="mt-1 text-[10.5px] leading-relaxed text-olive-mute">只退回个人钱包现有余额，已消耗的不冲销。该人员有服务中或暂停的陪跑主档时，必须先完成改派。</p></div>
          <label className="block text-[12px] font-semibold text-olive">回收数量<input type="number" min={1} max={Math.max(1, wallets.get(tutorUserId)?.balance ?? 0)} step={100} value={reclaimAmount} onChange={(e) => setReclaimAmount(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-border bg-cream px-3 py-2.5 font-normal outline-none focus:border-[#0C7064]" /></label>
          <label className="block text-[12px] font-semibold text-olive">回收原因<textarea value={reclaimReason} onChange={(e) => setReclaimReason(e.target.value)} rows={2} maxLength={500} placeholder="例：人员服务已改派，回收剩余未用额度" className="mt-1 w-full resize-y rounded-lg border border-border bg-cream px-3 py-2 font-normal outline-none focus:border-[#0C7064]" /></label>
          <button type="button" disabled={reclaim.isPending || !tutorUserId || !Number.isSafeInteger(reclaimAmount) || reclaimAmount <= 0 || reclaimAmount > (wallets.get(tutorUserId)?.balance ?? 0) || reclaimReason.trim().length < 2} onClick={() => reclaim.mutate({ tutorUserId, amount: reclaimAmount, reason: reclaimReason })} className="min-h-11 w-full rounded-xl border border-[#0C7064]/25 bg-mint-pale/40 py-2.5 text-[13px] font-semibold text-[#0C7064] hover:bg-mint-pale disabled:opacity-40">{reclaim.isPending ? "正在回收…" : `从所选人员回收至机构池（可回收 ${(wallets.get(tutorUserId)?.balance ?? 0).toLocaleString()}）`}</button>
          {reclaim.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{reclaim.error.message}</p>}
          {reclaim.isSuccess && <p className="text-[12px] text-[#2F7A41]">已回收，个人出账与机构池入账双流水已同步生成。</p>}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-[16px] font-bold text-olive">钱包明细</h2>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-[12px]"><thead className="text-[10.5px] text-olive-mute"><tr className="border-b border-border"><th className="py-2 font-medium">账户</th><th className="py-2 font-medium">角色</th><th className="py-2 text-right font-medium">可用积分</th></tr></thead><tbody>{(points?.accounts ?? []).map((account) => <tr key={account.id} className="border-b border-border/60 last:border-0"><td className="py-2.5 font-semibold text-olive">{account.name}</td><td className="py-2.5 text-olive-mute">{account.ownerUserId === 0 ? "机构池" : account.role === "admin" ? "管理员" : "伴学师"}</td><td className="mono py-2.5 text-right font-bold text-olive">{account.balance.toLocaleString()}</td></tr>)}</tbody></table></div>
      </div>
    </section>

    <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between"><h2 className="text-[16px] font-bold text-olive">积分流水</h2><span className="text-[11px] text-olive-mute">保留最近 150 条</span></div>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{error.message}</p>}
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-[11.5px]"><thead className="text-[10.5px] text-olive-mute"><tr className="border-b border-border"><th className="py-2 font-medium">时间</th><th className="py-2 font-medium">类型</th><th className="py-2 font-medium">账户</th><th className="py-2 font-medium">说明</th><th className="py-2 text-right font-medium">变动</th><th className="py-2 text-right font-medium">余额</th></tr></thead><tbody>{(points?.ledger ?? []).map((entry) => {
        const account = wallets.get(entry.ownerUserId);
        const incoming = entry.amount > 0;
        return <tr key={entry.id} className="border-b border-border/60 last:border-0"><td className="whitespace-nowrap py-2.5 text-olive-mute">{new Date(entry.createdAt).toLocaleString("zh-CN")}</td><td className="py-2.5 text-olive">{TYPE[entry.type] ?? entry.type}</td><td className="py-2.5 text-olive-soft">{account?.name ?? `用户 ${entry.ownerUserId}`}</td><td className="max-w-64 py-2.5 text-olive-mute">{entry.reason || entry.kind || "—"}</td><td className={`mono py-2.5 text-right font-bold ${incoming ? "text-[#2F7A41]" : "text-olive"}`}><span className="mr-1 inline-flex">{incoming ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}</span>{incoming ? "+" : ""}{entry.amount.toLocaleString()}</td><td className="mono py-2.5 text-right text-olive">{entry.balanceAfter.toLocaleString()}</td></tr>;
      })}</tbody></table></div>
      {!isLoading && !points?.ledger.length && <p className="py-7 text-center text-[12px] text-olive-mute">还没有积分流水。</p>}
    </section>
  </div>;
}

function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: number; note: string }) {
  return <div className="rounded-2xl border border-[#0C7064]/15 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-[12px] font-semibold text-olive-mute"><span className="text-[#0C7064]">{icon}</span>{label}</div><div className="mono mt-2 text-[26px] font-bold text-olive">{value.toLocaleString()}</div><div className="mt-1 text-[10.5px] text-olive-mute">{note}</div></div>;
}
