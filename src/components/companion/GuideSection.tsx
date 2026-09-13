import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { SEVEN_STEPS } from "@contracts/content";
import { Footprints, Lightbulb, PartyPopper } from "lucide-react";

/** 伴学师 · 自主学习七步法导学。 */
export default function GuideSection() {
  const utils = trpc.useUtils();
  const { data: session, isLoading } = trpc.guide.today.useQuery();

  const [draft, setDraft] = useState("");
  const [summary, setSummary] = useState<string | null>(null);

  const start = trpc.guide.start.useMutation({
    onSuccess: () => utils.guide.today.invalidate(),
  });
  const answer = trpc.guide.answer.useMutation({
    onSuccess: () => {
      setDraft("");
      utils.guide.today.invalidate();
    },
  });
  const finish = trpc.guide.finish.useMutation({
    onSuccess: (d) => {
      setSummary(d.summary);
      utils.guide.today.invalidate();
    },
  });

  const stepIdx = session ? Math.min(session.step, SEVEN_STEPS.length - 1) : 0;
  const stepKey = session ? SEVEN_STEPS[stepIdx].key : "";
  const savedAnswer = session?.answers[stepKey];

  // 换步时把已保存的回答带进输入框
  useEffect(() => {
    setDraft(savedAnswer ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.step]);

  if (isLoading) {
    return <div className="paper-card h-40 animate-pulse bg-cream-deep/50" />;
  }

  /* ------- 今天还没开始 ------- */
  if (!session) {
    return (
      <div className="paper-card p-6">
        <div className="flex items-center gap-2">
          <Footprints size={18} className="text-olive" />
          <h3 className="font-bold text-olive">自主学习七步法</h3>
        </div>
        <p className="mt-2 text-[14.5px] leading-relaxed text-olive-soft">
          每天 10 分钟，把学习流程走一遍：定目标、拆计划、先预习、会听课、限时作业、错题归因、复盘输出。 走完一轮，方法就变成了习惯。
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SEVEN_STEPS.map((s) => (
            <div key={s.key} className="rounded-xl border border-border bg-cream px-3 py-2 text-center text-[13px] text-olive-soft">
              {s.title}
            </div>
          ))}
        </div>
        <button
          disabled={start.isPending}
          onClick={() => start.mutate()}
          className="mt-5 w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-50"
        >
          {start.isPending ? "准备中…" : "开始今日导学 →"}
        </button>
      </div>
    );
  }

  const allDone = session.done || session.step >= SEVEN_STEPS.length;

  return (
    <div className="space-y-4">
      {/* 步骤条 */}
      <div className="paper-card p-4">
        <div className="flex items-center justify-between">
          {SEVEN_STEPS.map((s, i) => (
            <div key={s.key} className="flex flex-1 items-center last:flex-none">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold transition-colors ${
                  i < session.step || allDone
                    ? "bg-lime text-cream"
                    : i === session.step
                      ? "bg-olive text-cream"
                      : "border border-border bg-cream text-olive-mute"
                }`}
                title={s.title}
              >
                {i + 1}
              </div>
              {i < SEVEN_STEPS.length - 1 && <div className={`mx-1 h-0.5 flex-1 ${i < session.step ? "bg-lime" : "bg-border"}`} />}
            </div>
          ))}
        </div>
        <p className="mt-2 text-center text-[12.5px] text-olive-mute">
          {allDone ? "七步全部走完啦" : `当前：${SEVEN_STEPS[stepIdx].title}`}
        </p>
      </div>

      {/* 小结卡 */}
      {summary && (
        <div className="paper-card accent-l border-butter bg-butter/30 p-5">
          <div className="flex items-center gap-2">
            <PartyPopper size={17} className="text-olive" />
            <h3 className="font-bold text-olive">今日导学小结</h3>
          </div>
          <p className="mt-2.5 whitespace-pre-line text-[14.5px] leading-relaxed text-olive">{summary}</p>
        </div>
      )}

      {allDone && !summary && (
        <div className="paper-card p-6 text-center">
          <PartyPopper className="mx-auto text-lime" size={30} />
          <p className="mt-2 font-semibold text-olive">七步都写好啦</p>
          <p className="mt-1 text-sm text-olive-mute">生成一段小结，把今天的思考收进口袋。</p>
          <button
            disabled={finish.isPending}
            onClick={() => finish.mutate({ sessionId: session.id })}
            className="mt-4 rounded-xl bg-olive px-6 py-2.5 text-sm font-semibold text-cream hover:bg-lime disabled:opacity-50"
          >
            {finish.isPending ? "生成中…" : "完成今日导学"}
          </button>
        </div>
      )}

      {/* 当前步卡片 */}
      {!allDone && (
        <div className="paper-card p-5">
          <h3 className="text-[16px] font-bold text-olive">{SEVEN_STEPS[stepIdx].title}</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-olive-soft">{SEVEN_STEPS[stepIdx].why}</p>

          <div className="mt-4 rounded-xl bg-lime-pale/70 p-4">
            <p className="text-[14.5px] font-medium leading-relaxed text-olive">{SEVEN_STEPS[stepIdx].prompt}</p>
          </div>

          <ul className="mt-3 space-y-1.5">
            {SEVEN_STEPS[stepIdx].tips.map((t, i) => (
              <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-olive-mute">
                <Lightbulb size={13} className="mt-0.5 shrink-0 text-lime" />
                {t}
              </li>
            ))}
          </ul>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="写下你的想法，一两句也很好…"
            className="mt-4 w-full resize-none rounded-xl border border-input bg-cream px-4 py-2.5 text-[14.5px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25"
          />

          <button
            disabled={draft.trim().length === 0 || answer.isPending}
            onClick={() => answer.mutate({ sessionId: session.id, stepKey, answer: draft.trim() })}
            className="mt-3 w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-50"
          >
            {answer.isPending ? "保存中…" : savedAnswer ? "改好了，下一步 →" : "写好啦，下一步 →"}
          </button>
          {answer.isError && <p className="mt-2 text-center text-[13px] text-terra">保存没成功，再点一次试试。</p>}
        </div>
      )}
    </div>
  );
}
