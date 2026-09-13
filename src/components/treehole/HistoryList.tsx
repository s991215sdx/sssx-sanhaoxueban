import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { ChevronDown, ChevronUp, MessageCircleHeart } from "lucide-react";
import MoodFace, { MOOD_LABELS } from "./MoodFace";

/** UTC+8 格式化：M月D日 HH:mm。 */
function fmtTime(d: Date): string {
  const t = new Date(d.getTime() + 8 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCMonth() + 1}月${t.getUTCDate()}日 ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
}

/** 树洞历史：倒序卡片，回信可折叠。 */
export default function HistoryList() {
  const { data, isLoading } = trpc.treehole.history.useQuery({ limit: 20 });
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-lime border-t-transparent" />
      </div>
    );
  }
  if (!data || data.length === 0) {
    return (
      <div className="paper-card p-7 text-center">
        <MessageCircleHeart className="mx-auto text-olive-mute" size={26} />
        <p className="mt-2 text-sm text-olive-mute">树洞还空着。今天的第一句话，随时等你来说。</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((e) => {
        const open = openIds.has(e.id);
        return (
          <div key={e.id} className="paper-card p-4">
            <div className="flex items-center gap-3">
              <MoodFace mood={e.mood} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-medium text-olive">{MOOD_LABELS[e.mood]}</span>
                  <span className="mono text-[11px] text-olive-mute">{fmtTime(e.createdAt)}</span>
                </div>
                {e.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {e.tags.map((t) => (
                      <span key={t} className="chip !text-[10.5px] text-olive-soft">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <p className="mt-2.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-olive-soft">{e.content}</p>
            <button
              onClick={() =>
                setOpenIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(e.id)) next.delete(e.id);
                  else next.add(e.id);
                  return next;
                })
              }
              className="mt-2 flex items-center gap-1 text-[12.5px] font-medium text-olive-mute hover:text-olive"
            >
              {open ? (
                <>
                  收起回信 <ChevronUp size={13} />
                </>
              ) : (
                <>
                  看回信 <ChevronDown size={13} />
                </>
              )}
            </button>
            {open && (
              <div className="mt-2 rounded-xl bg-butter/40 p-3.5 text-[13.5px] leading-relaxed text-olive">
                {e.reply}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
