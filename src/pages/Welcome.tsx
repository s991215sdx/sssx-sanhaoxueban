import { useState } from "react";
import { useNavigate } from "react-router";
import ProfileStage from "@/components/welcome/ProfileStage";
import AcademicsStage from "@/components/welcome/AcademicsStage";
import ChoiceStage from "@/components/welcome/ChoiceStage";
import E3Stage from "@/components/welcome/E3Stage";

const STAGES = ["认识一下", "成绩与目标", "MBTI 快测", "DISC 快测", "学业诊断"];

/** 首次引导向导（/welcome，全屏无侧边栏）。 */
export default function Welcome() {
  const navigate = useNavigate();
  const [stage, setStage] = useState(0);

  const skipAll = () => {
    localStorage.setItem("onboardingSkipped", "1");
    navigate("/");
  };
  const goHome = () => navigate("/");

  return (
    <div className="min-h-screen bg-cream">
      {/* 顶栏：标题 + 全局跳过 */}
      <header className="sticky top-0 z-10 border-b border-border bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="font-bold text-[15px] text-olive">三好学伴 · 初次见面</div>
          <button onClick={skipAll} className="text-[13px] text-olive-mute hover:text-olive">
            稍后再测，先进去看看 →
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
        {/* 进度点 */}
        <div className="mb-6 flex items-center justify-center gap-0">
          {STAGES.map((label, i) => (
            <div key={label} className="flex items-center">
              {i > 0 && <div className={`h-px w-5 sm:w-9 ${i <= stage ? "bg-lime" : "bg-border"}`} />}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold transition-colors ${
                    i < stage
                      ? "bg-lime text-cream"
                      : i === stage
                        ? "bg-olive text-cream"
                        : "border border-border bg-cream-card text-olive-mute"
                  }`}
                >
                  {i + 1}
                </div>
                <span className={`text-[11px] ${i === stage ? "font-semibold text-olive" : "text-olive-mute"}`}>{label}</span>
              </div>
            </div>
          ))}
        </div>

        {stage === 0 && <ProfileStage onNext={() => setStage(1)} />}
        {stage === 1 && <AcademicsStage onNext={() => setStage(2)} onSkip={() => setStage(2)} />}
        {stage === 2 && (
          <ChoiceStage
            key="mbti"
            kind="mbti"
            title="MBTI 快测"
            subtitle="28 道二选一，看看你的性格能量从哪里来"
            onNext={() => setStage(3)}
            onSkip={() => setStage(3)}
          />
        )}
        {stage === 3 && (
          <ChoiceStage
            key="disc"
            kind="disc"
            title="DISC 快测"
            subtitle="24 道二选一，找到最适合你的带动方式"
            onNext={() => setStage(4)}
            onSkip={() => setStage(4)}
          />
        )}
        {stage === 4 && (
          <E3Stage
            onSkip={goHome}
            renderAction={() => (
              <button
                onClick={goHome}
                className="w-full rounded-xl bg-olive py-3.5 text-[16px] font-semibold text-cream transition-colors hover:bg-lime"
              >
                完成，进入三好学伴 →
              </button>
            )}
          />
        )}
      </main>
    </div>
  );
}
