import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { BANDS } from "@contracts/content";
import { Check, Divide, X } from "lucide-react";
import { PAPER_CAUSES, type PaperItemSeed, type PaperSummary } from "./shared";

type Item = PaperItemSeed;

const RESULT_BTNS: { key: Item["result"]; label: string; icon: typeof Check; active: string }[] = [
  { key: "right", label: "做对", icon: Check, active: "border-lime bg-lime text-white" },
  { key: "wrong", label: "做错", icon: X, active: "border-terra bg-terra text-white" },
  { key: "half", label: "半对", icon: Divide, active: "border-butter bg-butter text-olive" },
];

/** 新建流第 2 步：逐题定性（结果三态 + 错题的区间/知识点/错因）。 */
export default function PaperGradeStep({
  paperId,
  onAnalyzed,
}: {
  paperId: number;
  onAnalyzed: (summary: PaperSummary) => void;
}) {
  const { data: chapters } = trpc.graph.overview.useQuery();
  const [countStr, setCountStr] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState<string | null>(null);

  const analyze = trpc.paper.analyze.useMutation({
    onSuccess: (d) => onAnalyzed(d.summary as PaperSummary),
    onError: (e) => setError(e.message || "分析失败，再试一次"),
  });

  function generate() {
    const n = Math.floor(Number(countStr));
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      setError("题数填 1-100 之间的整数哦");
      return;
    }
    setError(null);
    setItems((prev) =>
      Array.from({ length: n }, (_, i) => {
        const old = prev.find((p) => p.no === i + 1);
        return old ?? { no: i + 1, result: "right" as const };
      }),
    );
  }

  function setResult(no: number, result: Item["result"]) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.no !== no) return it;
        if (result === "right") return { no, result };
        // 做错/半对默认进第2提分区，可再改
        return { ...it, result, band: it.band ?? 2 };
      }),
    );
  }

  function patch(no: number, p: Partial<Item>) {
    setItems((prev) => prev.map((it) => (it.no === no ? { ...it, ...p } : it)));
  }

  function markAll(result: Item["result"]) {
    setItems((prev) =>
      prev.map((it) => (result === "right" ? { no: it.no, result } : { ...it, result, band: it.band ?? 2 })),
    );
  }

  const wrongCount = items.filter((i) => i.result !== "right").length;

  return (
    <div className="space-y-5">
      <div className="paper-card p-5">
        <label className="mono text-[11px] tracking-wider text-olive-mute">这套卷一共几道题？</label>
        <div className="mt-2.5 flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={countStr}
            onChange={(e) => setCountStr(e.target.value)}
            placeholder="如 22"
            className="w-28 rounded-xl border border-input bg-cream px-4 py-2.5 text-[15px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25"
          />
          <button
            onClick={generate}
            className="rounded-xl bg-olive px-5 py-2.5 text-[14.5px] font-medium text-cream hover:bg-lime"
          >
            生成题号列表
          </button>
          {items.length > 0 && (
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => markAll("right")}
                className="rounded-xl border border-border bg-cream px-3.5 py-2.5 text-[13px] font-medium text-olive-soft hover:border-lime hover:text-olive"
              >
                全卷都对
              </button>
              <button
                onClick={() => markAll("wrong")}
                className="rounded-xl border border-border bg-cream px-3.5 py-2.5 text-[13px] font-medium text-olive-soft hover:border-terra hover:text-terra"
              >
                以下全错
              </button>
            </div>
          )}
        </div>
        {items.length > 0 && (
          <p className="mt-2.5 text-[12.5px] text-olive-mute">
            凭印象逐题标一下：做对的不用管，做错/半对的题再花 10 秒选个「提分区间」。
          </p>
        )}
      </div>

      {items.map((it) => (
        <div key={it.no} className="paper-card p-4">
          <div className="flex items-center gap-3">
            <span className="mono w-9 shrink-0 text-center text-[15px] font-bold text-olive">{it.no}</span>
            <div className="flex flex-1 gap-2">
              {RESULT_BTNS.map((b) => (
                <button
                  key={b.key}
                  onClick={() => setResult(it.no, b.key)}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-xl border px-2 py-2 text-[13.5px] font-medium transition-colors ${
                    it.result === b.key ? b.active : "border-border bg-cream text-olive-soft hover:border-olive/40"
                  }`}
                >
                  <b.icon size={14} />
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {it.result !== "right" && (
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              {/* 提分区间三选一 */}
              <div>
                <div className="mono text-[10px] tracking-wider text-olive-mute">它属于哪个提分区间？</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {BANDS.map((b) => {
                    const active = it.band === b.band;
                    return (
                      <button
                        key={b.band}
                        onClick={() => patch(it.no, { band: b.band })}
                        className={`rounded-xl border p-3 text-left transition-colors ${
                          active ? "border-transparent bg-cream" : "border-border bg-cream/50 hover:bg-cream"
                        }`}
                        style={active ? { boxShadow: `inset 0 0 0 2px ${b.color}` } : undefined}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                          <span className="text-[13px] font-semibold text-olive">{b.name}</span>
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-olive-mute">{b.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {/* 这题分值 */}
                <div>
                  <div className="mono text-[10px] tracking-wider text-olive-mute">这题满分几分？</div>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0.5}
                    max={100}
                    step={0.5}
                    value={it.score ?? 5}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      patch(it.no, { score: Number.isFinite(v) && v > 0 ? Math.min(100, v) : 5 });
                    }}
                    className="mt-1.5 w-full rounded-xl border border-input bg-cream px-3 py-2 text-[13.5px] text-olive outline-none focus:border-lime"
                  />
                </div>
                {/* 知识点下拉 */}
                <div>
                  <div className="mono text-[10px] tracking-wider text-olive-mute">对应知识点（选了才会自动进错题本）</div>
                  <select
                    value={it.kpCode ?? ""}
                    onChange={(e) => patch(it.no, { kpCode: e.target.value || undefined })}
                    className="mt-1.5 w-full rounded-xl border border-input bg-cream px-3 py-2 text-[13.5px] text-olive outline-none focus:border-lime"
                  >
                    <option value="">不确定 / 先不选</option>
                    {chapters?.map((ch) => (
                      <optgroup key={ch.name} label={ch.name}>
                        {ch.kps.map((k) => (
                          <option key={k.code} value={k.code}>
                            {k.title}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                {/* 错因下拉 */}
                <div>
                  <div className="mono text-[10px] tracking-wider text-olive-mute">错因（可空）</div>
                  <select
                    value={it.cause ?? ""}
                    onChange={(e) => patch(it.no, { cause: e.target.value || undefined })}
                    className="mt-1.5 w-full rounded-xl border border-input bg-cream px-3 py-2 text-[13.5px] text-olive outline-none focus:border-lime"
                  >
                    <option value="">让系统按区间猜一个</option>
                    {PAPER_CAUSES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {items.length > 0 && (
        <div className="paper-card sticky bottom-3 p-4">
          {error && <p className="mb-2 text-[13px] text-terra">{error}</p>}
          <button
            onClick={() => analyze.mutate({ id: paperId, items })}
            disabled={analyze.isPending}
            className="w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
          >
            {analyze.isPending
              ? "正在分析，并把错题收进错题本…"
              : wrongCount > 0
                ? `开始分析（${wrongCount} 道待捞分）→`
                : "开始分析 →"}
          </button>
        </div>
      )}
    </div>
  );
}
