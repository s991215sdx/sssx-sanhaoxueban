import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, ClipboardList, Users, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import ProfileStage from "@/components/welcome/ProfileStage";
import ChoiceStage from "@/components/welcome/ChoiceStage";
import E3Stage from "@/components/welcome/E3Stage";
import AcademicsStage from "@/components/welcome/AcademicsStage";
import Multi5Quiz from "@/components/companion/Multi5Quiz";
import DiscV2Quiz from "@/components/companion/DiscV2Quiz";
import MentalSdqQuiz from "@/components/companion/MentalSdqQuiz";

/**
 * V56/v181：学习力测评（一条龙）。
 * 顺序固定：基本信息 → MBTI → DISC 学生版 → 学习力诊断（E3 三阶九能）→ 学业目标
 *           → 心理健康 A 版（SDQ）→ 智能五项。
 * 每一步完成后自动进入下一项；学业目标 / 心理健康可跳过；
 * 全部走完出完成页，并提醒家长完成「家长 DISC + 家长认知（家庭卷）」。
 */
const STEPS = [
  { key: "basics", label: "基本信息" },
  { key: "mbti", label: "MBTI 性格" },
  { key: "disc", label: "DISC 学生版" },
  { key: "e3", label: "学习力诊断" },
  { key: "academics", label: "学业目标" },
  { key: "mentalsdq", label: "心理健康 A 版" },
  { key: "multi5", label: "智能五项" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];
const LAST = STEPS.length - 1;

export default function CombinedSuite({ onExit }: { onExit: () => void }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const latestQuery = trpc.assessment.latest.useQuery();
  const profileQuery = trpc.profile.get.useQuery();
  const { data } = latestQuery;
  const { data: profile } = profileQuery;
  const [step, setStep] = useState(0);
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
      mentalsdq: !!latest.mentalSdq,
      multi5: !!latest.multi5,
    };
    const firstIncomplete = STEPS.findIndex((s) => !doneFlags[s.key]);
    if (firstIncomplete === -1) setStep(LAST); // 全部完成：停在最后一项的结果页
    else if (firstIncomplete > 0) setStep(firstIncomplete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestQuery.isLoading, profileQuery.isLoading]);
  const doneOf = (k: StepKey): boolean => {
    if (k === "basics") return basicsDone;
    if (k === "academics") return !!(profile as unknown as { academics?: unknown } | undefined)?.academics;
    if (k === "mentalsdq") return !!latest.mentalSdq;
    if (k === "multi5") return !!latest.multi5;
    return !!latest[k];
  };

  const next = () => {
    // 每步完成都刷新数据，完成页才能看到最新结果
    utils.assessment.latest.invalidate();
    utils.profile.get.invalidate();
    setStep((s) => (s < LAST ? s + 1 : s));
  };

  if (finished) {
    return (
      <div className="space-y-4">
        <div className="paper-card mx-auto max-w-lg p-8 text-center">
          <CheckCircle2 className="mx-auto h-11 w-11 text-[#2F7A41]" />
          <h2 className="mt-3 text-[19px] font-bold text-olive">学习力测评完成</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">
            基本信息、MBTI、DISC、学习力诊断、学业目标、心理健康、智能五项都已记录在案。综合学习力报告正在生成，伴学师会结合全部测评为你解读。
          </p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => navigate("/report-detail?tab=combined")}
              className="flex-1 rounded-xl bg-brand py-3 text-[14px] font-semibold text-cream hover:bg-lime-deep"
            >
              查看综合学习力报告
            </button>
            <button
              onClick={onExit}
              className="flex-1 rounded-xl border border-border bg-cream-card py-3 text-[14px] text-olive-mute hover:border-[#E3B53A]/60 hover:text-olive"
            >
              返回测评中心
            </button>
          </div>
        </div>
        {/* v181：提醒家长完成的部分——做完后综合学习力报告更完整 */}
        <div className="paper-card accent-l mx-auto max-w-lg border-[#E3B53A]/50 bg-butter-pale/50 p-5">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-olive" />
            <h3 className="text-[15px] font-bold text-olive">还差家长的两份问卷（由家长填写）</h3>
          </div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-olive-mute">
            家长 DISC 与孩子做家庭对照分析，家长认知（家庭卷）反映家庭支持与观察差异——两份都做完，综合学习力报告会多出亲子对照章节。
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => navigate("/assessments?start=discparent")}
              className="flex-1 rounded-xl bg-brand py-2.5 text-[13px] font-semibold text-cream hover:bg-lime"
            >
              家长 DISC →
            </button>
            <button
              onClick={() => navigate("/assessments?start=e3parent")}
              className="flex-1 rounded-xl bg-brand py-2.5 text-[13px] font-semibold text-cream hover:bg-lime"
            >
              家长认知（家庭卷）→
            </button>
          </div>
        </div>
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
          <span className="text-[14.5px] font-bold text-olive">学习力测评</span>
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
              className="w-full rounded-xl bg-brand py-3.5 text-[16px] font-semibold text-cream transition-colors hover:bg-lime"
            >
              完成，继续下一项 →
            </button>
          )}
        />
      )}
      {cur.key === "academics" && <AcademicsStage onNext={next} onSkip={next} />}
      {cur.key === "mentalsdq" && (
        <MentalSdqQuiz
          key="suite-mentalsdq"
          onDone={next}
        />
      )}
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
