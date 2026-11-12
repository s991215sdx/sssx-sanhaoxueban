/**
 * 邀请另一位家长（v251）
 *
 * 报告生成之后才需要它：一位家长已经填完，另一位还没填。此时报告里已经有一份
 * 「你的位置」，缺的是另一个人那一列。二维码必须从报告页直接给出——让家长
 * 回到测评中心再找一遍码，十次有八次就断了。
 *
 * 三条约定：
 * 1. 码是孩子的码（familyCode），不是填卷人的码；爸妈扫同一张，答卷都落到孩子名下。
 * 2. 不打印：整块 `no-print`，跟着 PDF 打出去只会多一张看不懂的图。
 * 3. 填完不必手动刷新：面板每 15 秒问一次「几位家长填了」，报告页跟着重取。
 */
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, UserPlus, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { familyJoinPath } from "@contracts/familyCode";

const ORDER = ["dad", "mom"] as const;
const NAME: Record<string, string> = { dad: "爸爸", mom: "妈妈", other: "其他家人" };

export default function InviteParentButton({
  studentId,
  /** 报告里已经有的家长称谓，用来写「妈妈还没填」这类句子 */
  filledLabels = [],
}: {
  studentId?: number;
  filledLabels?: string[];
}) {
  const [open, setOpen] = useState(false);
  const { data } = trpc.assessment.familyCode.useQuery(studentId != null ? { userId: studentId } : undefined, {
    retry: false,
    refetchInterval: open ? 15000 : false,
    refetchOnWindowFocus: true,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  const code = data?.code ?? null;
  const url = code && typeof window !== "undefined" ? `${window.location.origin}${familyJoinPath(code)}` : "";

  useEffect(() => {
    if (!open || !canvasRef.current || !url) return;
    QRCode.toCanvas(canvasRef.current, url, { width: 480, margin: 2 })
      .then(() => {
        canvasRef.current!.style.width = "";
        canvasRef.current!.style.height = "";
      })
      .catch(() => {
        /* 画不出来就让链接兜底，下面那行链接一直可复制 */
      });
  }, [open, url]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const filled = data?.parents ?? [];
  const has = (key: string) => filled.some((p) => p.respondent === key);
  const waiting = ORDER.filter((k) => !has(k));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* 非 https 时复制会被拒，链接就印在下面，让家长自己长按 */
    }
  };

  return (
    <div className="no-print">
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-[12.5px] font-semibold text-olive hover:border-lime"
      >
        <UserPlus size={14} />
        邀请另一位家长
        {waiting.length > 0 && (
          <span className="rounded-full bg-butter-pale px-1.5 py-0.5 text-[10.5px] font-bold text-[#8A6508]">
            {waiting.map((k) => NAME[k]).join("、")}待填
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-[420px] rounded-2xl bg-cream p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[15.5px] font-bold text-olive">另一位家长，扫这张码</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-olive-mute">
                  扫一次答 55 题 + 24 组性格词，约 12 分钟。答卷落到同一个孩子名下，不用注册。
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="shrink-0 text-olive-mute hover:text-olive" aria-label="关闭">
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex gap-4">
              <div className="w-[150px] shrink-0 rounded-xl border border-border bg-white p-2.5">
                {url ? <canvas ref={canvasRef} className="h-auto w-full" /> : <div className="h-[130px] animate-pulse rounded bg-cream-deep/40" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-1.5">
                  {(["dad", "mom"] as const).map((k) => (
                    <span
                      key={k}
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${
                        has(k) ? "bg-lime-pale text-olive" : "border border-dashed border-border text-olive-mute"
                      }`}
                    >
                      {has(k) ? <Check size={11} /> : null}
                      {NAME[k]}
                      {has(k) ? " 已填" : " 待填"}
                    </span>
                  ))}
                  {filled
                    .filter((p) => p.respondent === "other")
                    .map((p) => (
                      <span key={p.label} className="rounded-full bg-lime-pale px-2 py-0.5 text-[11.5px] font-semibold text-olive">
                        {p.label || NAME.other} 已填
                      </span>
                    ))}
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-olive-soft">
                  {waiting.length
                    ? `${waiting.map((k) => NAME[k]).join("、")}那份还没到——填完这一页会自动多出对照列。`
                    : "两位都填了。爷爷奶奶想补一份也可以扫，会作为「其他家人」单独记一列。"}
                  {filledLabels.length > 0 && ` 报告现在的口径是${filledLabels.join("、")}填的那份。`}
                </p>
              </div>
            </div>

            {url && (
              <>
                <p className="mono mt-3 break-all rounded-lg bg-white/70 px-2.5 py-2 text-[10.5px] leading-snug text-olive-mute">
                  {url}
                </p>
                <div className="mt-2.5 flex gap-2">
                  <button
                    onClick={copy}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-[12px] font-semibold text-olive hover:bg-butter-pale/60"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? "已复制" : "复制链接"}
                  </button>
                  <button
                    onClick={() => {
                      if (!canvasRef.current) return;
                      const a = document.createElement("a");
                      a.href = canvasRef.current.toDataURL("image/png");
                      a.download = "家长补填-扫码.png";
                      a.click();
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[12px] font-semibold text-cream hover:bg-lime"
                  >
                    <Download size={13} />
                    存二维码
                  </button>
                </div>
              </>
            )}

            <p className="mt-3 rounded-lg border border-dashed border-olive/15 bg-white/50 px-2.5 py-2 text-[10.5px] leading-relaxed text-olive-mute">
              这张码只认「是哪个孩子」，看不到任何结果。家长在那头提交后，本页 15 秒内自动更新；
              没动就切回窗口再看一眼。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
