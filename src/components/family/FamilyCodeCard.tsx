/**
 * 家庭码卡（v238）：一个孩子一张码，爸爸、妈妈扫同一个码，答卷都落到这个孩子名下。
 *
 * 放在学生端的测评中心里，也放在「家庭教育测评」引导页里。家长那边是公开页面
 * （/f/<code>），不需要注册账号——家长卷只是孩子档案里的一份补充材料。
 *
 * 卡上要能一眼看出「谁还没填」：漏一位家长，报告里的六项盲区就少一半对照。
 */
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, RefreshCw, Smartphone } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { familyJoinPath } from "@contracts/familyCode";

const RESPONDENT_LABEL: Record<string, string> = { dad: "爸爸", mom: "妈妈", other: "其他家人" };

function joinUrl(code: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}${familyJoinPath(code)}`;
}

export default function FamilyCodeCard({ compact = false }: { compact?: boolean }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.assessment.familyCode.useQuery(undefined, { retry: false });
  const rotate = trpc.assessment.rotateFamilyCode.useMutation({
    onSuccess: () => void utils.assessment.familyCode.invalidate(),
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrReady, setQrReady] = useState(false);
  const [copied, setCopied] = useState(false);

  const code = data?.code ?? null;
  const url = code ? joinUrl(code) : "";

  useEffect(() => {
    if (!canvasRef.current || !url) return;
    QRCode.toCanvas(canvasRef.current, url, { width: 480, margin: 2 })
      .then(() => {
        /* qrcode 会写死内联 480px，清掉让 CSS 控制显示尺寸（下载仍是高清） */
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
      /* 老浏览器/非 https：让用户自己长按复制，链接就印在下面 */
    }
  };

  if (isLoading) {
    return <div className="paper-card h-40 animate-pulse bg-cream-deep/50" />;
  }

  const filled = data?.parents ?? [];
  const hasDad = filled.some((p) => p.respondent === "dad");
  const hasMom = filled.some((p) => p.respondent === "mom");

  return (
    <div className="paper-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-[15.5px] font-bold text-olive">
            <Smartphone size={16} className="shrink-0" />
            爸妈那一份，扫这个码
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-olive-mute">
            爸爸、妈妈各扫一次，都填到你这个孩子名下，不用注册账号。
          </p>
        </div>
        <button
          onClick={() => {
            if (window.confirm("换一张码之后，原来那张立刻失效（已经填过的答卷不受影响）。确定换吗？")) {
              rotate.mutate();
            }
          }}
          disabled={rotate.isPending}
          className="flex shrink-0 items-center gap-1 text-[12px] text-olive-mute hover:text-olive disabled:opacity-50"
          title="码被转发到群里时，换一张"
        >
          <RefreshCw size={12} />
          换码
        </button>
      </div>

      <div className={compact ? "mt-3" : "mt-4 flex flex-wrap items-start gap-4"}>
        <div className="w-[168px] shrink-0 rounded-xl border border-border bg-white p-2.5">
          <canvas ref={canvasRef} className="h-auto w-full" />
        </div>

        <div className="min-w-[160px] flex-1">
          {/* 已填 / 未填：两位家长各自的状态分开显示，漏一位盲区就少一半对照 */}
          <div className="flex flex-wrap gap-2">
            {[
              { key: "dad", label: "爸爸", done: hasDad },
              { key: "mom", label: "妈妈", done: hasMom },
            ].map((p) => (
              <span
                key={p.key}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                  p.done ? "bg-lime-pale text-olive" : "border border-dashed border-border bg-cream text-olive-mute"
                }`}
              >
                {p.done ? <Check size={12} /> : null}
                {p.label}
                {p.done ? " 已填" : " 还没填"}
              </span>
            ))}
            {filled
              .filter((p) => p.respondent === "other")
              .map((p) => (
                <span key={p.label} className="flex items-center gap-1 rounded-full bg-lime-pale px-2.5 py-1 text-[12px] font-semibold text-olive">
                  <Check size={12} />
                  {p.label || RESPONDENT_LABEL.other} 已填
                </span>
              ))}
          </div>

          {qrReady && (
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
                    a.download = "家庭教育测评-家长扫码.png";
                    a.click();
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-cream hover:bg-lime"
                >
                  <Download size={13} />
                  存二维码
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {!compact && (
        <p className="mt-3 rounded-xl border border-dashed border-olive/20 bg-cream/60 px-3 py-2 text-[11.5px] leading-relaxed text-olive-mute">
          这张码只用来认「是哪个孩子」，看不到任何测评结果；发给家人时不用另加密码。万一转错了群，点右上角「换码」。
        </p>
      )}
    </div>
  );
}
