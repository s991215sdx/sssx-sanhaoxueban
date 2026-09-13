import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { BANDS } from "@contracts/content";
import { CalendarDays, ClipboardList, Plus, ScanLine } from "lucide-react";
import PaperUploadStep from "@/components/papers/PaperUploadStep";
import PaperGradeStep from "@/components/papers/PaperGradeStep";
import PaperResultView from "@/components/papers/PaperResultView";
import PaperDetail from "@/components/papers/PaperDetail";
import type { PaperSummary } from "@/components/papers/shared";

type View = { mode: "list" } | { mode: "new" } | { mode: "detail"; id: number };

export default function Papers() {
  const [view, setView] = useState<View>({ mode: "list" });
  const [newStep, setNewStep] = useState<1 | 2 | 3>(1);
  const [newId, setNewId] = useState<number | null>(null);
  const [summary, setSummary] = useState<PaperSummary | null>(null);
  const utils = trpc.useUtils();

  const { data: list, isLoading } = trpc.paper.list.useQuery(undefined, { retry: 5, retryDelay: 3000 });

  function finishNew() {
    void utils.paper.list.invalidate();
    void utils.gaps.listErrors.invalidate();
    void utils.gaps.todayReviews.invalidate();
    void utils.dashboard.summary.invalidate();
    setView({ mode: "list" });
    setNewStep(1);
    setNewId(null);
    setSummary(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-olive">试卷分析</h1>
        <p className="mt-1 text-[15px] text-olive-soft">
          拍照、逐题定性、看三区分布——考试分析三步法，告诉你分数都丢在哪、先捞哪块。
        </p>
      </div>

      {view.mode === "detail" && <PaperDetail id={view.id} onBack={() => setView({ mode: "list" })} />}

      {view.mode === "new" && (
        <div className="space-y-4">
          {/* 步骤条 */}
          <div className="flex items-center gap-2">
            {["拍照上传", "逐题定性", "看分析结果"].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <span
                  className={`mono flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold ${
                    newStep > i ? "bg-olive text-cream" : "bg-cream-deep text-olive-mute"
                  }`}
                >
                  {i + 1}
                </span>
                <span className={`text-[13px] ${newStep > i ? "font-medium text-olive" : "text-olive-mute"}`}>
                  {s}
                </span>
                {i < 2 && <span className="h-px w-5 bg-border" />}
              </div>
            ))}
          </div>

          {newStep === 1 && (
            <PaperUploadStep
              onCreated={(id) => {
                setNewId(id);
                setNewStep(2);
              }}
            />
          )}
          {newStep === 2 && newId !== null && (
            <PaperGradeStep
              paperId={newId}
              onAnalyzed={(s) => {
                setSummary(s);
                setNewStep(3);
                void utils.paper.list.invalidate();
              }}
            />
          )}
          {newStep === 3 && summary && <PaperResultView summary={summary} onDone={finishNew} />}
        </div>
      )}

      {view.mode === "list" && (
        <div className="space-y-4">
          <button
            onClick={() => {
              setNewStep(1);
              setNewId(null);
              setSummary(null);
              setView({ mode: "new" });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-olive/30 bg-cream-card py-4 text-[15px] font-semibold text-olive transition-colors hover:border-lime hover:bg-lime-pale/50"
          >
            <Plus size={18} />
            丢一份试卷进来
          </button>

          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
            </div>
          )}

          {!isLoading && (!list || list.length === 0) && (
            <div className="paper-card p-8 text-center">
              <ScanLine className="mx-auto text-olive-mute" size={30} />
              <p className="mt-2 font-semibold text-olive">还没有分析过试卷</p>
              <p className="mt-1 text-sm text-olive-mute">
                把最近一张试卷丢进来，3 分钟告诉你分数都丢在哪。
              </p>
            </div>
          )}

          {list?.map((p) => {
            const bandTotal = Math.max(1, p.bandCounts[1] + p.bandCounts[2] + p.bandCounts[3]);
            const hasAnalysis = p.itemCount > 0;
            return (
              <button
                key={p.id}
                onClick={() => setView({ mode: "detail", id: p.id })}
                className="paper-card block w-full p-4 text-left transition-colors hover:border-olive/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-lime-pale text-olive">
                    <ClipboardList size={19} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14.5px] font-medium text-olive">{p.title}</span>
                      {p.score && <span className="chip !text-[11px] text-olive">{p.score}</span>}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[12.5px] text-olive-mute">
                      {p.examDate && (
                        <span className="flex items-center gap-1">
                          <CalendarDays size={11} />
                          {p.examDate}
                        </span>
                      )}
                      <span>{hasAnalysis ? `${p.itemCount} 题已定性` : "待逐题定性"}</span>
                    </div>
                  </div>
                </div>
                {/* 三区区间 mini 条 */}
                {hasAnalysis && bandTotal > 0 && (
                  <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-cream-deep">
                    {BANDS.map((b) => {
                      const n = p.bandCounts[b.band];
                      return n > 0 ? (
                        <div
                          key={b.band}
                          style={{ width: `${(n / bandTotal) * 100}%`, backgroundColor: b.color }}
                        />
                      ) : null;
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
