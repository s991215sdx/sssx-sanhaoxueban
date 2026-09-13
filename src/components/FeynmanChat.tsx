import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { SendHorizonal, Bot, User, Mic, Square } from "lucide-react";

type Msg = { role: "tutor" | "student"; content: string };

// Web Speech API（Chrome/微信内置浏览器多为 webkit 前缀）；不支持则为 null，隐藏麦克风。
const SpeechRec: (new () => any) | null =
  typeof window !== "undefined"
    ? ((window as any).webkitSpeechRecognition ?? (window as any).SpeechRecognition ?? null)
    : null;

/** 费曼输出对话：孩子讲，AI 学伴追问。 */
export default function FeynmanChat({
  sessionId,
  onDone,
}: {
  sessionId: number;
  onDone: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [progress, setProgress] = useState<{ hit: number; total: number } | null>(null);
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const baseTextRef = useRef("");

  const start = trpc.preview.feynmanStart.useMutation({
    onSuccess: (d) => {
      setMessages([{ role: "tutor", content: d.message }]);
      setProgress({ hit: 0, total: d.conceptsTotal });
    },
  });
  const reply = trpc.preview.feynmanReply.useMutation({
    onSuccess: (d) => {
      setMessages((m) => [...m, { role: "tutor", content: d.reply }]);
      setProgress({ hit: d.hitCount, total: d.total });
      if (d.done) setDone(true);
    },
  });

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      start.mutate({ sessionId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, reply.isPending]);

  // 卸载/结束时停止录音
  useEffect(() => () => recRef.current?.stop(), []);
  useEffect(() => {
    if (done && listening) recRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

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
    baseTextRef.current = input;
    rec.onresult = (e: any) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      const base = baseTextRef.current.trimEnd();
      setInput(base ? `${base} ${transcript}` : transcript);
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

  const send = () => {
    const text = input.trim();
    if (!text || reply.isPending || done) return;
    if (listening) recRef.current?.stop();
    setMessages((m) => [...m, { role: "student", content: text }]);
    setInput("");
    reply.mutate({ sessionId, message: text });
  };

  const pending = start.isPending && messages.length === 0;

  return (
    <div className="paper-card flex h-[560px] flex-col overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-border bg-lime-pale/50 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-olive text-cream">
            <Bot size={18} />
          </span>
          <div>
            <div className="text-[15px] font-semibold text-olive">学伴小思</div>
            <div className="mono text-[10px] tracking-wider text-olive-mute">费曼学习法 · 讲出来才算懂</div>
          </div>
        </div>
        {progress && (
          <span className="chip text-olive">
            关键点 <span className="mono font-bold">{progress.hit}/{progress.total}</span>
          </span>
        )}
      </div>

      {/* 消息区 */}
      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto bg-cream/50 p-5">
        {pending && (
          <div className="flex items-center gap-2 text-sm text-olive-mute">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-lime border-t-transparent" />
            学伴正在准备…
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "student" ? "flex-row-reverse" : ""}`}>
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                m.role === "tutor" ? "bg-olive text-cream" : "bg-lime text-white"
              }`}
            >
              {m.role === "tutor" ? <Bot size={15} /> : <User size={15} />}
            </span>
            <div
              className={`max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[14.5px] leading-relaxed ${
                m.role === "tutor"
                  ? "rounded-tl-sm bg-cream-card text-olive border border-border"
                  : "rounded-tr-sm bg-lime-pale text-olive"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {reply.isPending && (
          <div className="flex gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-olive text-cream">
              <Bot size={15} />
            </span>
            <div className="rounded-2xl rounded-tl-sm border border-border bg-cream-card px-4 py-3">
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-olive-mute"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      <div className="border-t border-border bg-cream-card p-4">
        {done ? (
          <button
            onClick={onDone}
            className="w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
          >
            生成我的课堂提问清单 →
          </button>
        ) : (
          <div>
            <div className="flex gap-2">
              {SpeechRec && (
                <button
                  onClick={toggleListen}
                  aria-label={listening ? "停止语音输入" : "开始语音输入"}
                  title={listening ? "再点一下停止" : "说话转文字"}
                  className={`flex w-11 shrink-0 items-center justify-center self-start rounded-xl border transition-colors ${
                    listening
                      ? "animate-pulse border-terra bg-terra text-white"
                      : "border-border bg-cream text-olive-soft hover:border-olive/40"
                  }`}
                >
                  {listening ? <Square size={15} /> : <Mic size={17} />}
                </button>
              )}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={2}
                placeholder={listening ? "正在听你说…说完点左边方块停止" : "用你自己的话讲讲这节课…（Enter 发送，Shift+Enter 换行）"}
                className="flex-1 resize-none rounded-xl border border-input bg-cream px-4 py-2.5 text-[14.5px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25"
              />
              <button
                onClick={send}
                disabled={!input.trim() || reply.isPending}
                className="flex w-14 items-center justify-center rounded-xl bg-olive text-cream transition-colors hover:bg-lime disabled:opacity-40"
              >
                <SendHorizonal size={18} />
              </button>
            </div>
            {SpeechRec && <p className="mt-1.5 text-[11px] text-olive-mute">也可以点左边麦克风，直接说话转文字（说完再点一次停止，可继续编辑）</p>}
          </div>
        )}
      </div>
    </div>
  );
}
