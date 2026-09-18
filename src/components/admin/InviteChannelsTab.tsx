import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, Link2, Plus, QrCode, RefreshCw } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { INVITE_CHANNEL_KINDS } from "@contracts/invite";

function inviteUrl(code: string): string {
  return `${window.location.origin}/invite/${code}`;
}

/** 单个渠道的二维码（canvas 渲染 + 下载 PNG）。 */
function ChannelQr({ code, name }: { code: string; name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, inviteUrl(code), { width: 480, margin: 2 })
      .then(() => setReady(true))
      .catch(() => setReady(false));
  }, [code]);
  return (
    <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-border bg-white p-3">
      <canvas ref={canvasRef} className="w-full max-w-[240px]" />
      {ready && (
        <>
          <p className="mono break-all text-center text-[10.5px] text-olive-mute">{inviteUrl(code)}</p>
          <button
            onClick={() => {
              const a = document.createElement("a");
              a.href = canvasRef.current!.toDataURL("image/png");
              a.download = `注册二维码-${name}.png`;
              a.click();
            }}
            className="flex items-center gap-1.5 rounded-lg bg-olive px-3 py-1.5 text-[12.5px] font-semibold text-cream hover:bg-lime"
          >
            <Download size={14} />
            下载二维码（打印/发给家长）
          </button>
        </>
      )}
    </div>
  );
}

/** 后台管理 · 注册邀请 tab：按渠道生成/分发注册二维码，看每个渠道带来多少注册。 */
export default function InviteChannelsTab() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.invite.channels.useQuery();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>(INVITE_CHANNEL_KINDS[0]);
  const [note, setNote] = useState("");
  const [qrFor, setQrFor] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  const create = trpc.invite.createChannel.useMutation({
    onSuccess: () => {
      setName("");
      setNote("");
      utils.invite.channels.invalidate();
    },
  });
  const toggle = trpc.invite.setChannelActive.useMutation({
    onSuccess: () => utils.invite.channels.invalidate(),
  });

  const copyLink = async (id: number, code: string) => {
    const url = inviteUrl(code);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-4">
      {/* 新建渠道 */}
      <div className="paper-card p-5">
        <h3 className="flex items-center gap-2 font-bold text-olive">
          <QrCode size={17} />
          新建注册邀请渠道
        </h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-olive-mute">
          每个渠道一张专属二维码：地推物料、异业合作门店、社群海报各用一张，家长扫码填基础信息完成注册，后台就能看到每个渠道带来多少人。
        </p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-[1fr_130px]">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
            placeholder="渠道名，比如「地推-万达广场点位」"
            className="rounded-xl border border-olive/20 bg-cream/60 px-3.5 py-2.5 text-[14px] text-olive outline-none placeholder:text-olive-mute/60 focus:border-lime"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded-xl border border-olive/20 bg-cream/60 px-3.5 py-2.5 text-[14px] text-olive outline-none focus:border-lime"
          >
            {INVITE_CHANNEL_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={255}
          placeholder="备注（可选）：对接人、点位、合作门店等"
          className="mt-2.5 w-full rounded-xl border border-olive/20 bg-cream/60 px-3.5 py-2.5 text-[14px] text-olive outline-none placeholder:text-olive-mute/60 focus:border-lime"
        />
        <button
          onClick={() => create.mutate({ name: name.trim(), kind, note: note.trim() })}
          disabled={create.isPending || name.trim().length < 2}
          className="mt-3 flex items-center gap-1.5 rounded-xl bg-olive px-4 py-2.5 text-[14px] font-semibold text-cream hover:bg-lime disabled:opacity-40"
        >
          {create.isPending ? <RefreshCw size={15} className="animate-spin" /> : <Plus size={15} />}
          生成渠道二维码
        </button>
        {create.error && <p className="mt-2 text-[12.5px] text-terra">{create.error.message}</p>}
      </div>

      {/* 渠道列表 */}
      <div className="paper-card p-5">
        <h3 className="font-bold text-olive">渠道与二维码</h3>
        {isLoading ? (
          <p className="mt-3 text-[13px] text-olive-mute">加载中…</p>
        ) : !data || data.channels.length === 0 ? (
          <p className="mt-3 text-[13px] text-olive-mute">还没有渠道——先在上方建一个，把二维码印到物料上。</p>
        ) : (
          <div className="mt-3 space-y-3">
            {data.channels.map((c) => (
              <div key={c.id} className={`rounded-xl border p-4 ${c.active ? "border-border bg-cream/60" : "border-border/60 bg-cream/30 opacity-70"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[14.5px] font-bold text-olive">{c.name}</span>
                  <span className="chip !text-[11px]">{c.kind}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${c.active ? "bg-lime-pale text-olive" : "bg-olive-mute/15 text-olive-mute"}`}>
                    {c.active ? "投放中" : "已停用"}
                  </span>
                  <span className="ml-auto text-[12px] text-olive-mute">
                    累计注册 <b className="mono text-[14px] text-olive">{c.registrations}</b> 人
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-olive-mute">
                  <span className="mono">码：{c.code}</span>
                  <span>{new Date(c.createdAt).toLocaleDateString("zh-CN")} 创建</span>
                  {c.note && <span>备注：{c.note}</span>}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    onClick={() => setQrFor(qrFor === c.id ? null : c.id)}
                    className="flex items-center gap-1 rounded-lg border border-border bg-cream-card px-2.5 py-1.5 text-[12px] font-semibold text-olive hover:bg-lime-pale"
                  >
                    <QrCode size={13} />
                    {qrFor === c.id ? "收起二维码" : "显示二维码"}
                  </button>
                  <button
                    onClick={() => copyLink(c.id, c.code)}
                    className="flex items-center gap-1 rounded-lg border border-border bg-cream-card px-2.5 py-1.5 text-[12px] font-semibold text-olive hover:bg-lime-pale"
                  >
                    <Link2 size={13} />
                    {copied === c.id ? "已复制链接 ✓" : "复制注册链接"}
                  </button>
                  <button
                    onClick={() => toggle.mutate({ id: c.id, active: !c.active })}
                    className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold ${
                      c.active
                        ? "border-terra/40 text-terra hover:bg-terra/10"
                        : "border-lime/50 text-olive hover:bg-lime-pale"
                    }`}
                  >
                    {c.active ? "停用（二维码立即失效）" : "重新启用"}
                  </button>
                </div>
                {qrFor === c.id && <ChannelQr code={c.code} name={c.name} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 最近注册 */}
      {data && data.recent.length > 0 && (
        <div className="paper-card p-5">
          <h3 className="font-bold text-olive">最近注册（扫码进来的家长）</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-olive-mute">
                  <th className="pb-2 pr-3 font-medium">时间</th>
                  <th className="pb-2 pr-3 font-medium">渠道</th>
                  <th className="pb-2 pr-3 font-medium">学生</th>
                  <th className="pb-2 pr-3 font-medium">年级</th>
                  <th className="pb-2 pr-3 font-medium">家长称呼</th>
                  <th className="pb-2 font-medium">手机号</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r) => {
                  const ch = data.channels.find((c) => c.id === r.channelId);
                  return (
                    <tr key={r.id} className="border-t border-border/60 text-olive-soft">
                      <td className="py-2 pr-3 whitespace-nowrap">{new Date(r.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="py-2 pr-3">{ch?.name ?? r.channelCode}</td>
                      <td className="py-2 pr-3 font-semibold text-olive">{r.studentName}</td>
                      <td className="py-2 pr-3">{r.grade}</td>
                      <td className="py-2 pr-3">{r.parentName}</td>
                      <td className="py-2 mono">{r.phone}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
