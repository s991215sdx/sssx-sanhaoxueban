import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { ChevronDown, ChevronUp, Mic, Plus, Trash2 } from "lucide-react";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDuration(sec: number | null): string {
  if (!sec) return "";
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分` : `${m} 分钟`;
}

/** 伴学师 · 课堂录音：列表 + 记一节录音。 */
export default function RecordingSection() {
  const utils = trpc.useUtils();
  const { data: list, isLoading } = trpc.recording.list.useQuery();
  const { data: chapters } = trpc.graph.overview.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // 表单状态
  const [title, setTitle] = useState("");
  const [recDate, setRecDate] = useState(todayStr());
  const [kpCodes, setKpCodes] = useState<string[]>([]);
  const [minutes, setMinutes] = useState("");
  const [note, setNote] = useState("");
  const [transcript, setTranscript] = useState("");

  const kpOptions = useMemo(
    () => (chapters ?? []).flatMap((ch) => ch.kps.map((k) => ({ code: k.code, title: k.title, chapter: ch.name }))),
    [chapters],
  );

  const add = trpc.recording.add.useMutation({
    onSuccess: () => {
      utils.recording.list.invalidate();
      setTitle("");
      setRecDate(todayStr());
      setKpCodes([]);
      setMinutes("");
      setNote("");
      setTranscript("");
      setShowForm(false);
    },
  });
  const remove = trpc.recording.remove.useMutation({
    onSuccess: () => utils.recording.list.invalidate(),
  });

  const toggleKp = (code: string) =>
    setKpCodes((arr) => (arr.includes(code) ? arr.filter((c) => c !== code) : [...arr, code]));

  const valid = title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(recDate);
  const inputCls =
    "mt-1.5 w-full rounded-xl border border-input bg-cream px-4 py-2.5 text-[14.5px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25";

  return (
    <div className="space-y-4">
      <button
        onClick={() => setShowForm((v) => !v)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
      >
        <Plus size={17} />
        记一节录音
      </button>

      {/* 新增表单 */}
      {showForm && (
        <div className="paper-card space-y-4 p-5">
          <div>
            <label className="mono text-[11px] tracking-wider text-olive-mute">这节课叫什么？</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：数学·一元一次方程"
              maxLength={64}
              className={inputCls}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mono text-[11px] tracking-wider text-olive-mute">上课日期</label>
              <input type="date" value={recDate} onChange={(e) => setRecDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mono text-[11px] tracking-wider text-olive-mute">时长（分钟，选填）</label>
              <input
                type="number"
                min={0}
                max={600}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="40"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="mono text-[11px] tracking-wider text-olive-mute">关联知识点（可多选）</label>
            <div className="scrollbar-thin mt-1.5 flex max-h-36 flex-wrap content-start gap-1.5 overflow-y-auto rounded-xl border border-border bg-cream p-3">
              {kpOptions.map((k) => (
                <button
                  key={k.code}
                  type="button"
                  onClick={() => toggleKp(k.code)}
                  className={`chip transition-colors ${
                    kpCodes.includes(k.code) ? "!border-lime !bg-lime-pale font-semibold text-olive" : "hover:border-lime/60"
                  }`}
                >
                  {k.title}
                </button>
              ))}
              {kpOptions.length === 0 && <span className="text-[12.5px] text-olive-mute">知识点加载中…</span>}
            </div>
          </div>

          <div>
            <label className="mono text-[11px] tracking-wider text-olive-mute">一句话备注（选填）</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：后半节讲的新题型没太跟上"
              maxLength={128}
              className={inputCls}
            />
          </div>

          <div>
            <label className="mono text-[11px] tracking-wider text-olive-mute">转写 / 课堂要点（选填）</label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={5}
              placeholder="把录音转文字/课堂要点粘到这里"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 rounded-xl border border-olive py-2.5 text-sm font-medium text-olive hover:bg-lime-pale"
            >
              先不记了
            </button>
            <button
              disabled={!valid || add.isPending}
              onClick={() =>
                add.mutate({
                  title: title.trim(),
                  recDate,
                  kpCodes,
                  durationSec: minutes ? Math.round(Number(minutes) * 60) : undefined,
                  note: note.trim() || undefined,
                  transcript: transcript.trim() || undefined,
                })
              }
              className="flex-1 rounded-xl bg-olive py-2.5 text-sm font-semibold text-cream hover:bg-lime disabled:opacity-50"
            >
              {add.isPending ? "保存中…" : "存下这节课"}
            </button>
          </div>
          {add.isError && <p className="text-center text-[13px] text-terra">保存没成功，再点一次试试。</p>}
        </div>
      )}

      {/* 列表 */}
      {isLoading ? (
        <div className="paper-card h-32 animate-pulse bg-cream-deep/50" />
      ) : !list || list.length === 0 ? (
        <div className="paper-card p-8 text-center">
          <Mic className="mx-auto text-lime" size={30} />
          <p className="mt-2 font-semibold text-olive">还没有录过课</p>
          <p className="mt-1 text-sm text-olive-mute">把课堂录音的要点存进来，复习时按知识点就能找到它。</p>
        </div>
      ) : (
        list.map((r) => (
          <div key={r.id} className="paper-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[15px] font-semibold text-olive">{r.title}</span>
                  <span className="mono text-[12px] text-olive-mute">
                    {r.recDate}
                    {r.durationSec ? ` · ${fmtDuration(r.durationSec)}` : ""}
                  </span>
                </div>
                {r.kpTitles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.kpTitles.map((t, i) => (
                      <span key={i} className="chip !text-[11px]">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {r.note && <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">{r.note}</p>}
              </div>
              <button
                aria-label="删除这条录音"
                disabled={remove.isPending}
                onClick={() => remove.mutate({ id: r.id })}
                className="shrink-0 rounded-lg p-2 text-olive-mute transition-colors hover:bg-terra/10 hover:text-terra"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {r.transcript && (
              <>
                <button
                  onClick={() => setExpandedId((id) => (id === r.id ? null : r.id))}
                  className="mt-3 flex items-center gap-1 text-[13px] text-olive-mute hover:text-olive"
                >
                  {expandedId === r.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {expandedId === r.id ? "收起转写" : "看转写 / 课堂要点"}
                </button>
                {expandedId === r.id && (
                  <p className="mt-2 whitespace-pre-line rounded-xl bg-cream p-4 text-[13.5px] leading-relaxed text-olive-soft">
                    {r.transcript}
                  </p>
                )}
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
