/**
 * 测评码弹窗（v239）：伴学师点「去做测评」，不再跳去孩子的测评中心——那是孩子的页面，
 * 伴学师点进去只会被弹回工作台，看起来就是「点了没反应」。
 *
 * 现场真正要做的是把这份卷递到孩子或家长手上：出码、让人扫、当场答完。
 * 所以这里只做一件事：把一张码摆出来，并说清「孩子扫会怎样、家长扫会怎样」。
 *
 * 码是算出来的（孩子编号 + 测评 + 6 小时时段 + 签名），随点随出，不必存也不用清理；
 * 过期了再点一次就是新的一张。
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, QrCode, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { passPath } from "@contracts/passCode";
import { PassCtx } from "@/components/coach/passRequest";

export function AssessmentPassProvider({ studentId, children }: { studentId: number; children: ReactNode }) {
  const [kind, setKind] = useState<string | null>(null);
  return (
    <PassCtx.Provider value={setKind}>
      {children}
      {kind && <AssessmentPassDialog studentId={studentId} kind={kind} onClose={() => setKind(null)} />}
    </PassCtx.Provider>
  );
}

function joinUrl(code: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}${passPath(code)}`;
}

function clockOf(iso: string | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameDay = d.toDateString() === new Date().toDateString();
  const hh = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return sameDay ? `今天 ${hh}` : `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${hh}`;
}

export function AssessmentPassDialog({
  studentId,
  kind,
  onClose,
}: {
  studentId: number;
  kind: string;
  onClose: () => void;
}) {
  const { data, isLoading, error, refetch, isFetching } = trpc.assessment.passCode.useQuery(
    { userId: studentId, kind },
    { retry: false },
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrReady, setQrReady] = useState(false);
  const [copied, setCopied] = useState(false);

  const code = data?.code ?? null;
  const url = code ? joinUrl(code) : "";

  useEffect(() => {
    if (!canvasRef.current || !url) return;
    setQrReady(false);
    QRCode.toCanvas(canvasRef.current, url, { width: 480, margin: 2 })
      .then(() => {
        /* qrcode 写死内联 480px，清掉让 CSS 决定显示尺寸（下载仍是高清） */
        canvasRef.current!.style.width = "";
        canvasRef.current!.style.height = "";
        setQrReady(true);
      })
      .catch(() => setQrReady(false));
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* 非 https 或老浏览器：链接就印在下面，手动复制 */
    }
  };

  const who = data?.def.who ?? "student";
  const isParent = who === "parent";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-3 py-6 sm:items-center sm:py-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-cream-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-[15.5px] font-bold text-olive">
              <QrCode size={16} className="shrink-0" />
              {isParent ? "让家长扫这张码填" : "让孩子扫这张码答"}
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-olive-mute">
              {data ? `${data.childAlias}（${data.grade || "年级未填"}）· ${data.def.name} · 约 ${data.def.minutes} 分钟` : "正在出码…"}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1 text-olive-mute hover:text-olive" aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-terra/40 bg-terra/10 px-3 py-2 text-[13px] leading-relaxed text-terra">
            {error.message}
          </p>
        )}

        <div className="mt-4 flex justify-center">
          <div className="w-[210px] rounded-xl border border-border bg-white p-3">
            {isLoading || !qrReady ? (
              <div className="flex h-[186px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
              </div>
            ) : (
              <canvas ref={canvasRef} className="h-auto w-full" />
            )}
          </div>
        </div>

        {data && (
          <>
            <p className="mono mt-3 break-all rounded-lg bg-cream px-2.5 py-2 text-[11px] leading-snug text-olive-mute">{url}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={copy}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-cream px-3 py-1.5 text-[12px] font-semibold text-olive hover:bg-butter-pale/60"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "已复制" : "复制链接"}
              </button>
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = canvasRef.current!.toDataURL("image/png");
                  a.download = `${data.def.name}-扫码.png`;
                  a.click();
                }}
                className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-cream hover:bg-lime"
              >
                <Download size={13} />
                存二维码
              </button>
              <button
                onClick={() => void refetch()}
                disabled={isFetching}
                className="rounded-lg border border-border bg-cream px-3 py-1.5 text-[12px] font-semibold text-olive-mute hover:text-olive disabled:opacity-50"
              >
                重出一张
              </button>
            </div>

            <div className="mt-3 space-y-1.5 rounded-xl border border-dashed border-olive/20 bg-cream/60 px-3 py-2 text-[11.5px] leading-relaxed text-olive-mute">
              {isParent ? (
                <>
                  <p>
                    家长扫完直接在手机上填，不用注册。交上来落在<b className="text-olive">{data.childAlias}</b>名下，
                    报告里会注明是哪位家长填的。
                  </p>
                  <p>同一个码，爸爸、妈妈各扫一次，各填一份。</p>
                </>
              ) : (
                <>
                  <p>
                    孩子扫完直接进他自己的账号（2 小时有效），答完就进报告，和平时登录进来答一模一样。
                  </p>
                  <p>孩子本来就在自己手机上登着，也可以不用这张码，直接进测评中心。</p>
                </>
              )}
              <p>
                这张码 {clockOf(data.expiresAt)} 前有效
                {data.received > 0 ? ` · 已经收到 ${data.received} 份` : ""}。过期了点「重出一张」。
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
