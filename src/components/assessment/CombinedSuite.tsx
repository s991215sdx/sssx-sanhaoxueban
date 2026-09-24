import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, ClipboardList, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import ProfileStage from "@/components/welcome/ProfileStage";
import ChoiceStage from "@/components/welcome/ChoiceStage";
import E3Stage from "@/components/welcome/E3Stage";
import AcademicsStage from "@/components/welcome/AcademicsStage";
import Multi5Quiz from "@/components/companion/Multi5Quiz";
import DiscV2Quiz from "@/components/companion/DiscV2Quiz";

/**
 * V56：综合学习力系统测评（一条龙）。
 * 顺序固定：基本信息 → MBTI → DISC 学生版 → 学习力诊断（E3 三阶九能）→ 学业目标 → 智能五项。
 * 每一步完成后自动进入下一项；学业目标可跳过；全部走完出完成页。
 */
const STEPS = [
  { key: "basics", label: "基本信息" },
  { key: "mbti", label: "MBTI 性格" },
  { key: "disc", label: "DISC 学生版" },
  { key: "e3", label: "学习力诊断" },
  { key: "academics", label: "学业目标" },
  { key: "multi5", label: "智能五项" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

export default function CombinedSuite({ onExit }: { onExit: () => void }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const latestQuery = trpc.assessment.latest.useQuery();
  const profileQuery = trpc.profile.get.useQuery();
  const { data } = latestQuery;
  const { data: profile } = profileQuery;
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [basicsDone, setBasicsDone] = useState(false);
  const [finished, setFinished] = useState(false);
  const latest: any = data ?? {};

  // V68：进入向导时跳过已完成步骤，直接从第一个未完成项继续（不重复填基本信息/重做 MBTI、DISC）
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    if (latestQuery.isLoading || profileQuery.isLoading) return;
    resumedRef.current = true;
    const hasBasics = !!(profile as { name?: string } | null)?.name;
    setBasicsDone(hasBasics);
    const doneFlags: Record<StepKey, boolean> = {
      basics: hasBasics,
      mbti: !!latest.mbti,
      disc: !!latest.disc,
      e3: !!latest.e3,
      academics: !!(profile as { academics?: unknown } | null)?.academics,
      multi5: !!latest.multi5,
    };
    const firstIncomplete = STEPS.findIndex((s) => !doneFlags[s.key]);
    if (firstIncomplete === -1) setStep(5); // 全部完成：停在最后一项的结果页
    else if (firstIncomplete > 0) setStep(firstIncomplete as 0 | 1 | 2 | 3 | 4 | 5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestQuery.isLoading, profileQuery.isLoading]);
  const doneOf = (k: StepKey): boolean => {
    if (k === "basics") return basicsDone;
    if (k === "academics") return !!(profile as unknown as { academics?: unknown } | undefined)?.academics;
    if (k === "multi5") return !!latest.multi5;
    return !!latest[k];
  };

  const next = () => {
    // 每步完成都刷新数据，完成页才能看到最新结果
    utils.assessment.latest.invalidate();
    utils.profile.get.invalidate();
    setStep((s) => (s < 5 ? ((s + 1) as 0 | 1 | 2 | 3 | 4 | 5) : s));
  };

  if (finished) {
    return (
      <div className="paper-card mx-auto max-w-lg p-8 text-center">
        <CheckCircle2 className="mx-auto h-11 w-11 text-[#5a9326]" />
        <h2 className="mt-3 text-[19px] font-bold text-olive">综合学习力系统测评完成</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">
          基本信息、MBTI、DISC、学习力诊断、学业目标、智能五项都已记录在案。综合报告正在生成，伴学师会结合全部测评为你解读。
        </p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => navigate("/report-detail?tab=combined")}
            className="flex-1 rounded-xl bg-olive py-3 text-[14px] font-semibold text-cream hover:bg-lime-deep"
          >
            查看综合报告
          </button>
          <button
            onClick={onExit}
            className="flex-1 rounded-xl border border-border bg-cream-card py-3 text-[14px] text-olive-mute hover:border-lime/60 hover:text-olive"
          >
            返回测评中心
          </button>
        </div>
      </div>
    );
  }

  const cur = STEPS[step];
  return (
    <div className="space-y-4">
      {/* 步骤条 */}
      <div className="paper-card p-4">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-olive" />
          <span className="text-[14.5px] font-bold text-olive">综合学习力系统测评</span>
          <button onClick={onExit} className="ml-auto rounded-lg p-1 text-olive-mute hover:bg-lime-pale hover:text-olive">
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
                      ? "border-lime bg-olive text-cream"
                      : done
                        ? "border-lime/60 bg-lime-pale text-olive"
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
      {cur.key === "basics" && (
        <ProfileStage
          onNext={() => {
            setBasicsDone(true);
            next();
          }}
        />
      )}
      {cur.key === "mbti" && (
        <ChoiceStage
          key="suite-mbti"
          kind="mbti"
          title="MBTI 性格快测"
          subtitle={`第 2 步 · 28 道二选一，看看你的性格能量从哪里来`}
          onNext={next}
          onSkip={next}
        />
      )}
      {cur.key === "disc" && <DiscV2Quiz key="suite-disc" onNext={next} onSkip={next} />}
      {cur.key === "e3" && (
        <E3Stage
          onSkip={next}
          renderAction={() => (
            <button
              onClick={next}
              className="w-full rounded-xl bg-olive py-3.5 text-[16px] font-semibold text-cream transition-colors hover:bg-lime"
            >
              完成，继续下一项 →
            </button>
          )}
        />
      )}
      {cur.key === "academics" && <AcademicsStage onNext={next} onSkip={next} />}
      {cur.key === "multi5" && (
        <Multi5Quiz
          key="suite-multi5"
          onDone={() => {
            utils.assessment.latest.invalidate();
            setFinished(true);
          }}
        />
      )}
    </div>
  );
}
