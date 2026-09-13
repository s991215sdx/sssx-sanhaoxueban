import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { MOOD_TAGS } from "@contracts/content";
import { MailOpen, Send } from "lucide-react";
import MoodFace, { MOOD_LABELS } from "./MoodFace";

/** 树洞倾诉表单：心情大圆钮 + 标签 chips + 倾诉 → 信纸回信。 */
export default function TalkForm() {
  const [mood, setMood] = useState<number | null>(null);
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [content, setContent] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const talk = trpc.treehole.talk.useMutation({
    onSuccess: (d) => {
      setReply(d.reply);
      void utils.treehole.history.invalidate();
      void utils.treehole.weekMood.invalidate();
      void utils.treehole.todayMood.invalidate();
    },
  });

  function toggleTag(t: string) {
    setTags((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function reset() {
    setReply(null);
    setMood(null);
    setTags(new Set());
    setContent("");
    talk.reset();
  }

  const valid = mood !== null && content.trim().length > 0;

  /* 回信态：信纸卡 */
  if (reply !== null) {
    return (
      <div className="space-y-3">
        <div className="paper-card accent-l border-butter bg-butter/40 p-6">
          <div className="flex items-center gap-2">
            <MailOpen size={16} className="text-olive" />
            <span className="mono text-[11px] tracking-wider text-olive-soft">树洞的回信</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-olive">{reply}</p>
        </div>
        <p className="text-center text-[12.5px] text-olive-mute">回信已存进树洞，只有你能看到。</p>
        <button
          onClick={reset}
          className="w-full rounded-xl border border-olive py-2.5 text-[14px] font-medium text-olive hover:bg-lime-pale"
        >
          再说点什么
        </button>
      </div>
    );
  }

  return (
    <div className="paper-card space-y-5 p-6">
      {/* 心情 1-5 大圆钮 */}
      <div>
        <div className="mono text-[11px] tracking-wider text-olive-mute">今天感觉怎么样？</div>
        <div className="mt-3 flex justify-between gap-1 sm:justify-start sm:gap-4">
          {[1, 2, 3, 4, 5].map((m) => (
            <button
              key={m}
              onClick={() => setMood(m)}
              className={`flex flex-col items-center gap-1.5 rounded-2xl p-2 transition-all ${
                mood === m ? "scale-110 bg-lime-pale ring-2 ring-lime" : "hover:bg-cream"
              }`}
            >
              <MoodFace mood={m} size={44} />
              <span className={`text-[11.5px] ${mood === m ? "font-semibold text-olive" : "text-olive-mute"}`}>
                {MOOD_LABELS[m]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 标签多选 */}
      <div>
        <div className="mono text-[11px] tracking-wider text-olive-mute">和什么有关？（可多选，可不选）</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {MOOD_TAGS.map((t) => (
            <button
              key={t}
              onClick={() => toggleTag(t)}
              className={`rounded-full border px-4 py-1.5 text-[13.5px] font-medium transition-colors ${
                tags.has(t) ? "border-olive bg-olive text-cream" : "border-border bg-cream text-olive-soft hover:border-olive/40"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* 倾诉 */}
      <div>
        <div className="mono text-[11px] tracking-wider text-olive-mute">想说什么都可以</div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="这一周遇到的、烦的、开心的，都可以讲给我听。不用组织语言，想到哪写到哪。"
          className="mt-2 w-full resize-none rounded-xl border border-input bg-cream px-4 py-2.5 text-[15px] leading-relaxed text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25"
        />
      </div>

      {talk.isError && <p className="text-[13px] text-terra">没送出去，再试一次好吗？</p>}

      <button
        onClick={() => valid && talk.mutate({ mood: mood!, tags: [...tags], content: content.trim() })}
        disabled={!valid || talk.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
      >
        <Send size={15} />
        {talk.isPending ? "树洞正在听…" : "讲给树洞听"}
      </button>
    </div>
  );
}
