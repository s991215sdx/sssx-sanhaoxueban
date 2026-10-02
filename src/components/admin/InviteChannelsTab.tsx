import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, Link2, Plus, QrCode, RefreshCw, FileText } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { INVITE_CHANNEL_KINDS, INVITE_REPORT_KINDS } from "@contracts/invite";

function inviteUrl(code: string): string {
  return `${window.location.origin}/invite/${code}`;
}

/** v80 测评报告功能配置编辑器：总开关 + 勾选开放的报告种类（新建渠道与编辑已有渠道共用）。 */
function ReportAccessEditor({
  enabled,
  kinds,
  saving,
  onSave,
}: {
  enabled: boolean;
  kinds: string[];
  saving: boolean;
  onSave: (enabled: boolean, kinds: string[]) => void;
}) {
  const [on, setOn] = useState(enabled);
  const [picked, setPicked] = useState<string[]>(kinds);
  const allPicked = picked.includes("all");
  const toggleKind = (key: string) =>
    setPicked((list) => {
      if (key === "all") return list.includes("all") ? [] : ["all"];
      /* 逐个勾选时自动取消「全部」 */
      const next = list.includes(key) ? list.filter((x) => x !== key) : [...list, key];
      return next.filter((x) => x !== "all");
    });
  return (
    <div className="rounded-xl border border-border bg-cream/60 p-3.5">
      <label className="flex cursor-pointer items-center gap-2.5">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => setOn((v) => !v)}
          className={`relative h-5.5 w-10 shrink-0 rounded-full transition-colors ${on ? "bg-lime" : "bg-cream-deep"}`}
          style={{ height: 22 }}
        >
          <span
            className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-[3px]"}`}
          />
        </button>
        <span className="text-[13px] font-bold text-olive">开放测评报告功能</span>
        <span className="text-[11.5px] text-olive-mute">扫码注册的客户，客户端可直接查看下方勾选的报告</span>
      </label>
      {on && (
        <>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {/* v80.1：一键开放全部测评报告 */}
            <button
              type="button"
              onClick={() => toggleKind("all")}
              className={`rounded-full border px-2.5 py-1 text-[12px] font-bold transition-colors ${
                allPicked
                  ? "border-lime bg-olive text-cream"
                  : "border-olive/40 bg-cream-card text-olive hover:bg-lime-pale"
              }`}
            >
              {allPicked ? "✓ " : ""}
              全部报告（{INVITE_REPORT_KINDS.length} 种）
            </button>
            {INVITE_REPORT_KINDS.map((k) => {
              const active = allPicked || picked.includes(k.key);
              return (
              <button
                key={k.key}
                type="button"
                onClick={() => toggleKind(k.key)}
                className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
                  active
                    ? "border-lime bg-lime-pale text-olive"
                    : "border-border bg-cream-card text-olive-mute hover:bg-lime-pale/50"
                }`}
              >
                {active ? "✓ " : ""}
                {k.label}
              </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={saving || picked.length === 0}
            onClick={() => onSave(true, picked)}
            className="mt-2.5 rounded-lg bg-olive px-3 py-1.5 text-[12px] font-semibold text-cream hover:bg-lime disabled:opacity-40"
          >
            {saving ? "保存中…" : "保存报告设置"}
          </button>
          {picked.length === 0 && <p className="mt-1.5 text-[11.5px] text-terra">至少勾选 1 种报告，或关闭总开关</p>}
        </>
      )}
      {!on && enabled && (
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(false, [])}
          className="mt-2.5 rounded-lg border border-terra/40 px-3 py-1.5 text-[12px] font-semibold text-terra hover:bg-terra/10 disabled:opacity-40"
        >
          {saving ? "保存中…" : "关闭测评报告功能"}
        </button>
      )}
    </div>
  );
}

/** 单个渠道的二维码（canvas 渲染 + 下载 PNG），固定宽度放渠道行右侧。 */
function ChannelQr({ code, name }: { code: string; name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, inviteUrl(code), { width: 480, margin: 2 })
      .then(() => {
        // qrcode 库会写死内联 width/height=480px,清掉让 CSS 类控制显示尺寸(下载仍是 480 高清图)
        canvasRef.current!.style.width = "";
        canvasRef.current!.style.height = "";
        setReady(true);
      })
      .catch(() => setReady(false));
  }, [code]);
  return (
    <div className="flex w-[190px] shrink-0 flex-col items-center gap-2 self-start rounded-xl border border-border bg-white p-3">
      <canvas ref={canvasRef} className="h-auto w-full" />
      {ready && (
        <>
          <p className="mono w-full break-all text-center text-[10px] leading-snug text-olive-mute">{inviteUrl(code)}</p>
          <button
            onClick={() => {
              const a = document.createElement("a");
              a.href = canvasRef.current!.toDataURL("image/png");
              a.download = `注册二维码-${name}.png`;
              a.click();
            }}
            className="flex items-center gap-1.5 rounded-lg bg-olive px-3 py-1.5 text-[12px] font-semibold text-cream hover:bg-lime"
          >
            <Download size={13} />
            下载二维码
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
  const [reportOn, setReportOn] = useState(false);
  const [reportKinds, setReportKinds] = useState<string[]>([]);
  const [editReportsFor, setEditReportsFor] = useState<number | null>(null);

  const create = trpc.invite.createChannel.useMutation({
    onSuccess: () => {
      setName("");
      setNote("");
      setReportOn(false);
      setReportKinds([]);
      utils.invite.channels.invalidate();
    },
  });
  const toggle = trpc.invite.setChannelActive.useMutation({
    onSuccess: () => utils.invite.channels.invalidate(),
  });
  const setReports = trpc.invite.setChannelReports.useMutation({
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
        {/* v80：测评报告功能——发码时选择打开/关闭，注册客户客户端直接可见勾选的报告 */}
        <div className="mt-2.5">
          <ReportAccessEditor
            enabled={reportOn}
            kinds={reportKinds}
            saving={create.isPending}
            onSave={(on, kinds) => {
              setReportOn(on);
              setReportKinds(kinds);
            }}
          />
        </div>
        <button
          onClick={() =>
            create.mutate({
              name: name.trim(),
              kind,
              note: note.trim(),
              reportAccess: reportOn,
              reportKinds: reportOn ? reportKinds : [],
            })
          }
          disabled={create.isPending || name.trim().length < 2 || (reportOn && reportKinds.length === 0)}
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
                <div className="flex flex-col gap-4 sm:flex-row">
                  {/* 左侧：渠道信息 + 操作 */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14.5px] font-bold text-olive">{c.name}</span>
                      <span className="chip !text-[11px]">{c.kind}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${c.active ? "bg-lime-pale text-olive" : "bg-olive-mute/15 text-olive-mute"}`}>
                        {c.active ? "投放中" : "已停用"}
                      </span>
                      {c.reportAccess && (
                        <span className="flex items-center gap-1 rounded-full bg-butter/70 px-2 py-0.5 text-[11px] font-bold text-[#8a6d1a]">
                          <FileText size={11} />
                          报告已开放
                        </span>
                      )}
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
                        className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold ${
                          qrFor === c.id
                            ? "border-lime bg-lime-pale text-olive"
                            : "border-border bg-cream-card text-olive hover:bg-lime-pale"
                        }`}
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
                      <button
                        onClick={() => setEditReportsFor(editReportsFor === c.id ? null : c.id)}
                        className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold ${
                          editReportsFor === c.id
                            ? "border-lime bg-lime-pale text-olive"
                            : "border-border bg-cream-card text-olive hover:bg-lime-pale"
                        }`}
                      >
                        <FileText size={13} />
                        {editReportsFor === c.id ? "收起报告设置" : "测评报告"}
                      </button>
                    </div>
                    {/* v80：已有渠道的测评报告功能（打开/关闭 + 勾选报告种类） */}
                    {editReportsFor === c.id && (
                      <div className="mt-2.5">
                        <ReportAccessEditor
                          key={`${c.id}-${c.reportAccess}-${(c.reportKinds ?? []).join(",")}`}
                          enabled={!!c.reportAccess}
                          kinds={(c.reportKinds ?? []) as string[]}
                          saving={setReports.isPending}
                          onSave={(on, kinds) =>
                            setReports.mutate(
                              { id: c.id, reportAccess: on, reportKinds: on ? kinds : [] },
                              { onSuccess: () => setEditReportsFor(null) },
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                  {/* 右侧：二维码（点击「显示二维码」展开，再点收起） */}
                  {qrFor === c.id && <ChannelQr code={c.code} name={c.name} />}
                </div>
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
                      <td className="py-2 pr-3 font-semibold text-olive">{r.studentName ?? "—"}</td>
                      <td className="py-2 pr-3">{r.grade ?? "—"}</td>
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
