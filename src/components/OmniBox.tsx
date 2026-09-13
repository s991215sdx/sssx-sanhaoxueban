import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { pickAndCompress } from "@/lib/image";
import { MasteryBar } from "@/components/ScoreRing";
import { ImagePlus, Mic, SendHorizonal, Sparkles, Square, X } from "lucide-react";

// Web Speech API 语音识别（Chrome/Edge/微信内置浏览器）；不支持则隐藏麦克风。
const SpeechRec: (new () => any) | null =
  typeof window !== "undefined"
    ? ((window as any).webkitSpeechRecognition ?? (window as any).SpeechRecognition ?? null)
    : null;

type AnalyzeResult = {
  reply: string;
  intent: "question" | "error" | "chat";
  transcript: string | null;
  subject: string | null;
  matchedKps: { id: number; code: string; title: string; subject: string; chapter: string; score: number }[];
  planSteps: string[];
  ai: boolean;
};

/**
 * 首页全能入口：像大模型一样的一个输入框。
 * 文字 / 图片（拍照、截图）直接丢进来，AI 自动分析知识点薄弱项并给出系统性查漏方案。
 */
export default function OmniBox() {
  const [text, setText] = useState("");
  const [imageData, setImageData] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const baseTextRef = useRef("");

  useEffect(() => () => recRef.current?.stop(), []);

  /** 麦克风语音输入：识别结果实时拼接进输入框（可再编辑）。 */
  const toggleListen = () => {
    if (!SpeechRec) return;
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new SpeechRec();
    rec.lang = "zh-CN";
    rec.interimResults = true;
    rec.continuous = true;
    baseTextRef.current = text;
    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      const base = baseTextRef.current.trimEnd();
      setText(base ? `${base} ${transcript}` : transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const analyze = trpc.analyze.analyze.useMutation({
    onSuccess: (d) => setResult(d),
  });

  const canSend = (text.trim().length > 0 || imageData != null) && !analyze.isPending;

  const send = () => {
    if (!canSend) return;
    analyze.mutate({
      ...(text.trim() ? { text: text.trim() } : {}),
      ...(imageData ? { imageData } : {}),
    });
  };

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      setImageData(await pickAndCompress(f));
    } catch (err) {
      alert(err instanceof Error ? err.message : "图片处理失败，请重试");
    }
  };

  const reset = () => {
    setResult(null);
    setText("");
    setImageData(null);
    analyze.reset();
  };

  return (
    <div className="paper-card accent-l border-lime p-5">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-lime" />
        <span className="mono text-xs tracking-wider text-olive-mute">全能伴学入口 · 直接说 / 直接拍</span>
      </div>

      {!result ? (
        <>
          <div className="mt-3 flex items-end gap-2 rounded-2xl border border-input bg-cream p-2 focus-within:border-lime focus-within:ring-2 focus-within:ring-lime/25">
            <div className="flex-1">
              {imageData && (
                <div className="relative mb-2 inline-block">
                  <img src={imageData} alt="待分析图片" className="max-h-28 rounded-lg border border-border" />
                  <button
                    onClick={() => setImageData(null)}
                    aria-label="移除图片"
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-terra text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder="把不会的题拍给我，或点麦克风直接说：比如「一元一次方程我总是移错项」…"
                className="w-full resize-none bg-transparent px-2 py-1.5 text-[15px] text-olive outline-none placeholder:text-olive-mute/70"
              />
            </div>
            <div className="flex items-center gap-1.5 pb-1">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
              <button
                onClick={() => fileRef.current?.click()}
                aria-label="上传图片"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-olive-mute transition-colors hover:bg-lime-pale hover:text-olive"
              >
                <ImagePlus size={18} />
              </button>
              {SpeechRec && (
                <button
                  onClick={toggleListen}
                  title={listening ? "再点一下停止" : "语音输入（说话自动转文字）"}
                  aria-label={listening ? "停止语音输入" : "开始语音输入"}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                    listening ? "bg-terra text-white animate-pulse" : "text-olive-mute hover:bg-lime-pale hover:text-olive"
                  }`}
                >
                  {listening ? <Square size={16} /> : <Mic size={18} />}
                </button>
              )}
              <button
                onClick={send}
                disabled={!canSend}
                aria-label="发送"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-olive text-cream transition-colors hover:bg-lime disabled:opacity-40"
              >
                <SendHorizonal size={17} />
              </button>
            </div>
          </div>
          {analyze.isPending && (
            <p className="mt-2 text-[13px] text-olive-mute">AI 正在分析你的内容和知识图谱，大约需要几秒钟…</p>
          )}
          {analyze.isError && <p className="mt-2 text-[13px] text-terra">分析失败了，请再试一次。</p>}
        </>
      ) : (
        <div className="mt-3">
          {result.transcript && (
            <div className="mb-3 rounded-xl border border-border bg-cream px-3.5 py-2.5">
              <div className="mono text-[10.5px] tracking-wider text-olive-mute">
                AI 识别到的内容{result.subject ? ` · 判定学科：${result.subject}` : ""}（识别有误请重新拍摄或补充说明）
              </div>
              <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-olive-soft">{result.transcript}</p>
            </div>
          )}
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-olive">{result.reply}</p>

          {result.matchedKps.length > 0 && (
            <div className="mt-4 space-y-2.5">
              {result.matchedKps.map((k) => (
                <div key={k.id} className="flex items-center gap-3 rounded-xl border border-border bg-cream px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-[14.5px] font-medium text-olive">{k.title}</span>
                      <span className="shrink-0 text-[11.5px] text-olive-mute">
                        {k.subject} · {k.chapter}
                      </span>
                    </div>
                    <MasteryBar score={k.score} className="mt-1.5" />
                  </div>
                  <Link
                    to="/preview"
                    className="shrink-0 rounded-lg bg-olive px-3 py-1.5 text-[12.5px] font-medium text-cream hover:bg-lime"
                  >
                    去学
                  </Link>
                </div>
              ))}
            </div>
          )}

          {result.planSteps.length > 0 && (
            <div className="mt-4 rounded-xl bg-lime-pale/50 p-3.5">
              <div className="mono text-[11px] tracking-wider text-olive-mute">系统性查漏方案</div>
              <ol className="mt-2 space-y-1.5 text-[13.5px] leading-relaxed text-olive">
                {result.planSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </div>
          )}

          {result.intent === "error" && (
            <Link to="/gaps" className="mt-3 inline-block text-[13px] font-medium text-lime hover:underline">
              这是一道错题？去错题本收录它，系统会安排间隔复习 →
            </Link>
          )}

          <button onClick={reset} className="mt-4 text-[13px] font-medium text-olive-mute hover:text-olive">
            ↩ 再问一次
          </button>
        </div>
      )}
    </div>
  );
}
