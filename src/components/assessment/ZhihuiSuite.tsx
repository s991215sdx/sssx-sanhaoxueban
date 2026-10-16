import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, ChevronDown, ClipboardList, Info, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import Subject4dQuiz from "@/components/companion/Subject4dQuiz";
import HollandQuiz from "@/components/companion/HollandQuiz";
import AnchorQuiz from "@/components/companion/AnchorQuiz";
import Multi5Quiz from "@/components/companion/Multi5Quiz";

/**
 * v181：选科及升学规划测评（一条龙）。
 * 主流程：学科四维测评 → 霍兰德职业兴趣测评 → 职业锚测评，做完生成「选科及升学规划报告」。
 * 「多元智能五项」折叠在职业兴趣测评之后，仅作参考（暂不影响选科与专业推荐因子）。
 */
const STEPS = [
  { key: "subject4d", label: "学科四维测评" },
  { key: "holland", label: "霍兰德职业兴趣" },
  { key: "anchor", label: "职业锚测评" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];
const LAST = STEPS.length - 1;

export default function ZhihuiSuite({ onExit }: { onExit: () => void }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const latestQuery = trpc.assessment.latest.useQuery();
  const { data } = latestQuery;
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);
  /* 参考测评（多元智能五项）折叠区 */
  const [refOpen, setRefOpen] = useState(false);
  const [refDone, setRefDone] = useState(false);
  const latest: any = data ?? {};

  // 进入时跳过已完成步骤，从第一个未完成项继续
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    if (latestQuery.isLoading) return;
    resumedRef.current = true;
    const doneFlags: Record<StepKey, boolean> = {
      subject4d: !!latest.subject4d,
      holland: !!latest.holland,
      anchor: !!latest.anchor,
    };
    const firstIncomplete = STEPS.findIndex((s) => !doneFlags[s.key]);
    if (firstIncomplete === -1) setFinished(true); // 三项都完成：直接出完成页
    else if (firstIncomplete > 0) setStep(firstIncomplete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestQuery.isLoading]);
  const doneOf = (k: StepKey): boolean => !!latest[k];

  const next = () => {
    utils.assessment.latest.invalidate();
    setStep((s) => (s < LAST ? s + 1 : s));
  };

  if (finished) {
    return (
      <div className="space-y-4">
        <div className="paper-card mx-auto max-w-lg p-8 text-center">
          <CheckCircle2 className="mx-auto h-11 w-11 text-[#2F7A41]" />
          <h2 className="mt-3 text-[19px] font-bold text-olive">选科及升学规划测评完成</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">
            学科四维、霍兰德职业兴趣、职业锚都已记录在案，你的「选科及升学规划报告」正在生成——选科组合、适合的专业与职业、升学路径一目了然。
          </p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => navigate("/zhihui-report")}
              className="flex-1 rounded-xl bg-brand py-3 text-[14px] font-semibold text-cream hover:bg-lime-deep"
            >
              查看选科及升学规划报告
            </button>
            <button
              onClick={onExit}
              className="flex-1 rounded-xl border border-border bg-cream-card py-3 text-[14px] text-olive-mute hover:border-[#E3B53A]/60 hover:text-olive"
            >
              返回测评中心
            </button>
          </div>
        </div>
        <RefPanel open={refOpen} onToggle={() => setRefOpen((o) => !o)} done={refDone || !!latest.multi5} />
      </div>
    );
  }

  const cur = STEPS[step]!;
  return (
    <div className="space-y-4">
      {/* 步骤条 */}
      <div className="paper-card p-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-olive" />
          <span className="text-[14.5px] font-bold text-olive">选科及升学规划测评</span>
          <span className="rounded-full bg-brand px-2 py-px text-[10.5px] font-bold text-cream">推荐</span>
          <button onClick={onExit} className="ml-auto rounded-lg p-1 text-olive-mute hover:bg-butter-pale hover:text-brand">
            <X size={16} />
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {STEPS.map((s, i) => {
            const done = doneOf(s.key);
            const active = i === step;
            return (
              <span key={s.key} className="flex items-center gap-1.5">
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    active
                      ? "border-lime bg-brand text-cream"
                      : done
                        ? "border-[#E3B53A]/60 bg-butter-pale text-brand font-semibold"
                        : "border-border bg-cream text-olive-mute"
                  }`}
                >
                  {i + 1}. {s.label}
                  {done && " ✓"}
                </span>
                {i < STEPS.length - 1 && <span className="text-[11px] text-olive-mute">→</span>}
              </span>
            );
          })}
        </div>
      </div>

      {/* 当前步骤 */}
      {cur.key === "subject4d" && <Subject4dQuiz onDone={next} />}
      {cur.key === "holland" && <HollandQuiz onDone={next} />}
      {cur.key === "anchor" && (
        <AnchorQuiz
          onDone={() => {
            utils.assessment.latest.invalidate();
            setFinished(true);
          }}
        />
      )}

      {/* 折叠参考测评：跟在职业兴趣测评后，仅参考、不影响选科推荐 */}
      {step >= 1 && <RefPanel open={refOpen} onToggle={() => setRefOpen((o) => !o)} done={refDone || !!latest.multi5} onRefDone={() => { setRefDone(true); utils.assessment.latest.invalidate(); }} />}
    </div>
  );
}

/** 折叠的参考测评区：多元智能五项（暂不影响选科与专业推荐的因子）。 */
function RefPanel({ open, onToggle, done, onRefDone }: { open: boolean; onToggle: () => void; done: boolean; onRefDone?: () => void }) {
  return (
    <div className="paper-card border-border/70 bg-cream/60">
      <button onClick={onToggle} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <Info size={15} className="shrink-0 text-olive-mute" />
        <span className="text-[13px] font-semibold text-olive-soft">
          参考测评 · 多元智能五项
          <span className="ml-2 text-[11.5px] font-normal text-olive-mute">折叠在职业兴趣后，仅作参考，暂不影响选科与专业推荐</span>
        </span>
        {done && <span className="ml-1 rounded-full border border-lime/60 bg-cream px-2 py-px text-[10.5px] font-semibold text-[#2F7A41]">已测 ✓</span>}
        <ChevronDown size={15} className={`ml-auto shrink-0 text-olive-mute transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4">
          {done ? (
            <p className="rounded-xl bg-cream-card px-4 py-3 text-[12.5px] text-olive-mute">
              已完成。五维智能结果会作为参考附在学习力相关报告中，可在测评中心重新测评。
            </p>
          ) : (
            <Multi5Quiz onDone={() => onRefDone?.()} />
          )}
        </div>
      )}
    </div>
  );
}
