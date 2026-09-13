import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import QuizCard from "@/components/QuizCard";
import VariantTrainer from "@/components/VariantTrainer";
import { ArrowLeft, Bot, User, SendHorizonal, Mic, Square, PartyPopper, BookOpen, Lightbulb, Sparkles } from "lucide-react";

type Msg = { role: "tutor" | "student"; content: string };
type Phase = "review" | "quiz" | "tutor" | "done";

// Web Speech API（Chrome/微信内置浏览器多为 webkit 前缀）；不支持则隐藏麦克风。
const SpeechRec: (new () => any) | null =
  typeof window !== "undefined"
    ? ((window as any).webkitSpeechRecognition ?? (window as any).SpeechRecognition ?? null)
    : null;

/**
 * 引导学习流：复习卡 → 重做检验 → （仍错）苏格拉底一问一答引导 → 搞懂 → 可举一反三。
 * 入口：错题本 / 试卷分析详情页的「学伴带我学」。
 */
export default function LearnFlow() {
  const { errorId } = useParams<{ errorId: string }>();
  const navigate = useNavigate();
  const id = Number(errorId);

  const [sessionId, setSessionId] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("review");
  const [boot, setBoot] = useState<{
    error: { id: number; stem: string; band: number; cause: string };
    kp: { id: number; code: string; title: string; summary: { heading: string; body: string }[]; example: { stem: string; analysis: string; answer: string } };
    isRoot: boolean;
    selfKpTitle: string;
  } | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [showVariants, setShowVariants] = useState(false);

  const start = trpc.tutor.start.useMutation({
    onSuccess: (d) => {
      setSessionId(d.sessionId);
      setBoot({ error: d.error, kp: d.kp, isRoot: d.isRoot, selfKpTitle: d.selfKpTitle });
    },
  });

  useEffect(() => {
    if (Number.isFinite(id) && id > 0 && sessionId === null && !start.isPending && !start.isError) {
      start.mutate({ errorId: id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (start.isError) {
    return (
      <div className="mx-auto mt-20 max-w-md text-center">
        <p className="text-olive">出错了：{start.error.message}</p>
        <button onClick={() => navigate(-1)} className="mt-4 rounded-xl bg-olive px-5 py-2.5 text-cream">
          返回
        </button>
      </div>
    );
  }

  if (!boot || sessionId === null) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        <p className="mono text-sm text-olive-mute">学伴正在准备复习卡…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-lg p-2 text-olive-mute hover:bg-lime-pale hover:text-olive">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-[19px] font-bold tracking-tight text-olive">学伴带你搞懂这道题</h1>
          <p className="mono mt-0.5 text-[11px] text-olive-mute">
            {phase === "review" && "第 1 步 · 先把知识点看明白"}
            {phase === "quiz" && "第 2 步 · 做一道题检验一下"}
            {phase === "tutor" && "第 3 步 · 学伴一个问题一个问题陪你想到底"}
            {phase === "done" && "搞定啦 · 可以举一反三钉牢它"}
          </p>
        </div>
      </header>

      {/* 错题原文 */}
      <div className="paper-card accent-l border-terra p-4">
        <div className="mono text-[10px] tracking-wider text-olive-mute">这道错题</div>
        <p className="mt-1.5 text-[14px] leading-relaxed text-olive">{boot.error.stem}</p>
      </div>

      {phase === "review" && (
        <ReviewCard
          sessionId={sessionId}
          kp={boot.kp}
          isRoot={boot.isRoot}
          selfKpTitle={boot.selfKpTitle}
          onReady={() => setPhase("quiz")}
        />
      )}

      {phase === "quiz" && (
        <QuizStep
          sessionId={sessionId}
          onPassed={() => {
            setUnderstood(true);
            setPhase("done");
          }}
          onFailed={(msg) => {
            setPhase("tutor");
            void msg;
          }}
        />
      )}

      {phase === "tutor" && (
        <TutorChat
          sessionId={sessionId}
          onUnderstood={() => {
            setUnderstood(true);
            setPhase("done");
          }}
        />
      )}

      {phase === "done" && (
        <div className="space-y-4">
          <div className="paper-card border-lime bg-lime-pale/60 p-6 text-center">
            <PartyPopper className="mx-auto text-lime" size={30} />
            <p className="mt-2 text-lg font-bold text-olive">{understood ? "这个知识点你搞懂了！" : "完成！"}</p>
            <p className="mt-1 text-[13.5px] text-olive-soft">
              懂一道题不算稳，再做几道同类题把它钉牢，考场上才不会又拐错弯。
            </p>
          </div>
          {!showVariants ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => setShowVariants(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
              >
                <Sparkles size={16} />
                举一反三，钉牢它
              </button>
              <button
                onClick={() => navigate("/gaps")}
                className="rounded-xl border border-olive px-5 py-3 text-[14.5px] font-medium text-olive hover:bg-lime-pale"
              >
                回到错题本
              </button>
            </div>
          ) : (
            <div className="paper-card p-5">
              <VariantTrainer errorId={id} initialStreak={0} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 第 1 步：复习卡——精讲要点 + 例题精析（不含检验题）。 */
function ReviewCard({
  sessionId,
  kp,
  isRoot,
  selfKpTitle,
  onReady,
}: {
  sessionId: number;
  kp: { title: string; summary: { heading: string; body: string }[]; example: { stem: string; analysis: string; answer: string } };
  isRoot: boolean;
  selfKpTitle: string;
  onReady: () => void;
}) {
  void sessionId; // 会话由父级创建，翻页后由 QuizStep 领题
  return (
    <div className="space-y-4">
      {isRoot && (
        <div className="paper-card accent-l border-butter bg-butter/30 p-4">
          <div className="flex items-start gap-2">
            <Lightbulb size={15} className="mt-0.5 shrink-0 text-terra" />
            <p className="text-[13px] leading-relaxed text-olive">
              这道「{selfKpTitle}」的错题，根子可能在更早的「{kp.title}」。我们先把这个根子补明白，再回头收拾它。
            </p>
          </div>
        </div>
      )}

      <div className="paper-card p-5">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-olive" />
          <span className="text-[15px] font-bold text-olive">复习卡 · {kp.title}</span>
        </div>
        <div className="mt-3.5 space-y-3.5">
          {kp.summary.map((s, i) => (
            <div key={i}>
              <div className="text-[13.5px] font-semibold text-olive">{s.heading}</div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-olive-soft">{s.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="paper-card p-5">
        <div className="mono text-[10px] tracking-wider text-olive-mute">例题精析</div>
        <p className="mt-2 text-[14px] font-medium leading-relaxed text-olive">{kp.example.stem}</p>
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-olive-soft">{kp.example.analysis}</p>
        <p className="mt-2 rounded-lg bg-lime-pale/60 px-3 py-2 text-[13.5px] text-olive">
          <b>答案：</b>
          {kp.example.answer}
        </p>
      </div>

      <button
        onClick={onReady}
        className="w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
      >
        我看完了，来检验一下 →
      </button>
    </div>
  );
}

/** 第 2 步：重做检验题。答对直接通关；答错启动苏格拉底引导。 */
function QuizStep({ sessionId, onPassed, onFailed }: { sessionId: number; onPassed: () => void; onFailed: (msg: string) => void }) {
  const [q, setQ] = useState<{ id: number; type: "choice" | "fill"; stem: string; options: string[] | null; hint: string } | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const begin = trpc.tutor.beginQuiz.useMutation({
    onSuccess: (d) => setQ(d.question),
    onError: (e) => setError(e.message),
  });
  const submit = trpc.tutor.submitQuiz.useMutation({
    onSuccess: (d) => {
      if (d.correct) onPassed();
      else onFailed(d.tutorMessage ?? "没关系，我们一起再想一想。");
    },
    onError: (e) => setError(e.message),
  });

  useEffect(() => {
    begin.mutate({ sessionId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (error) {
    return (
      <div className="paper-card p-5 text-center">
        <p className="text-[13.5px] text-terra">{error}</p>
      </div>
    );
  }
  if (!q) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-olive-mute">看完复习卡，来做一道同类题。别慌，答错了学伴会陪你一步步想。</p>
      <QuizCard q={q as never} index={0} value={value} onChange={setValue} kpTitle="" />
      <button
        onClick={() => submit.mutate({ sessionId, given: value })}
        disabled={!value.trim() || submit.isPending}
        className="w-full rounded-xl bg-olive py-2.5 text-[14.5px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
      >
        {submit.isPending ? "批改中…" : "提交答案"}
      </button>
    </div>
  );
}

/** 第 3 步：苏格拉底引导对话——一次只回答学伴一个问题，绝不剧透答案。 */
function TutorChat({ sessionId, onUnderstood }: { sessionId: number; onUnderstood: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [progress, setProgress] = useState<{ hit: number; total: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const baseTextRef = useRef("");
  const utils = trpc.useUtils();

  const chat = trpc.tutor.chat.useMutation({
    onSuccess: (d) => {
      setMessages((m) => [...m, { role: "tutor", content: d.reply }]);
      setProgress({ hit: d.hitCount, total: d.total });
      if (d.understood) {
        utils.gaps.listErrors.invalidate();
        utils.dashboard.summary.invalidate();
        setTimeout(onUnderstood, 1200);
      }
    },
  });

  // 恢复开场白（刷新后 messages 从 state 接口拿太绕，这里直接展示欢迎语 + 最近状态）
  const stateQuery = trpc.tutor.state.useQuery({ sessionId });
  useEffect(() => {
    if (stateQuery.data && messages.length === 0) {
      const msgs = stateQuery.data.messages as Msg[];
      if (msgs.length > 0) {
        setMessages(msgs);
        setProgress({ hit: stateQuery.data.conceptsHit, total: stateQuery.data.conceptsTotal });
      }
      if (stateQuery.data.understood) onUnderstood();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateQuery.data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chat.isPending]);

  useEffect(() => () => recRef.current?.stop(), []);

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
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const send = () => {
    const text = input.trim();
    if (!text || chat.isPending) return;
    if (listening) toggleListen();
    setMessages((m) => [...m, { role: "student", content: text }]);
    setInput("");
    chat.mutate({ sessionId, message: text });
  };

  return (
    <div className="space-y-3">
      <div className="paper-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] leading-relaxed text-olive">
            别急着要答案——学伴一次只问你一个小问题，想通了就真是你的了。
          </p>
          {progress && progress.total > 0 && (
            <span className="mono ml-3 shrink-0 text-[11px] text-olive-mute">
              关键点 {progress.hit}/{progress.total}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "student" ? "flex-row-reverse" : ""}`}>
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                m.role === "tutor" ? "bg-olive text-cream" : "bg-lime text-white"
              }`}
            >
              {m.role === "tutor" ? <Bot size={16} /> : <User size={16} />}
            </span>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed ${
                m.role === "tutor" ? "rounded-tl-sm bg-cream-card text-olive" : "rounded-tr-sm bg-lime text-white"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {chat.isPending && (
          <div className="flex gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-olive text-cream">
              <Bot size={16} />
            </span>
            <div className="rounded-2xl rounded-tl-sm bg-cream-card px-4 py-3 text-[13px] text-olive-mute">
              学伴想问题中…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-20 flex gap-2 md:bottom-6">
        <div className="relative flex-1">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder={listening ? "正在听你说…" : "说出你的想法，说错没关系"}
            className="w-full rounded-xl border border-input bg-cream px-4 py-3 pr-11 text-[14px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25"
          />
          {SpeechRec && (
            <button
              onClick={toggleListen}
              className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 ${
                listening ? "bg-terra text-white" : "text-olive-mute hover:bg-lime-pale hover:text-olive"
              }`}
              title={listening ? "停止语音" : "语音输入"}
            >
              {listening ? <Square size={15} /> : <Mic size={17} />}
            </button>
          )}
        </div>
        <button
          onClick={send}
          disabled={!input.trim() || chat.isPending}
          className="rounded-xl bg-olive px-4 text-cream transition-colors hover:bg-lime disabled:opacity-40"
        >
          <SendHorizonal size={17} />
        </button>
      </div>
    </div>
  );
}
