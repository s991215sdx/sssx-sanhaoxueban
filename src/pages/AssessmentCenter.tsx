import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import ChoiceStage from "@/components/welcome/ChoiceStage";
import E3Stage from "@/components/welcome/E3Stage";
import Multi5Quiz from "@/components/companion/Multi5Quiz";
// 以下三个答题组件由并行任务新增；若暂未就绪，tsc 会报 import 错，属跨代理待定。
import AnchorQuiz from "@/components/companion/AnchorQuiz";
import HollandQuiz from "@/components/companion/HollandQuiz";
import MentalQuiz from "@/components/companion/MentalQuiz";
import E3ParentQuiz from "@/components/companion/E3ParentQuiz";
import DiscParentQuiz from "@/components/companion/DiscParentQuiz";
import DiscV2Quiz from "@/components/companion/DiscV2Quiz";
import { isE3V37Result, isE3V37ParentResult } from "@contracts/assessments";
import { isMentalV2 } from "@contracts/mentalHealth";
import { ClipboardCheck, Sparkles, Target, Compass } from "lucide-react";

/** 测评中心管理的测评项。anchor/holland/mental/discparent 为并行任务新增的选做测评。 */
type TestKind = "mbti" | "disc" | "e3" | "e3parent" | "multi5" | "discparent" | "anchor" | "holland" | "mental";

type TestDef = {
  kind: TestKind;
  name: string;
  desc: string;
  required: boolean;
  /** 报告页对应 tab */
  tab: string;
  /** 已测时的核心结果一行；数据里没有测评时间，故不显示时间。 */
  summary?: (latest: any) => string | null;
  /** 自定义「已测」判定（默认 latest[kind] 非空；discparent 等多条结果的测评用数组长度判）。 */
  doneOf?: (latest: any) => boolean;
};

const TESTS: TestDef[] = [
  {
    kind: "mbti",
    name: "MBTI 性格快测",
    desc: "28 道二选一 · 必测",
    required: true,
    tab: "mbti",
    summary: (l) => (l.mbti ? `${l.mbti.type} 型` : null),
  },
  {
    kind: "disc",
    name: "DISC 行为风格",
    desc: "24 组「最像我 / 最不像我」强迫选择 · 必测",
    required: true,
    tab: "disc",
    summary: (l) => (l.disc ? `主型 ${l.disc.primary}${l.disc.version === 2 ? "" : "（旧版题目，建议重测）"}` : null),
  },
  {
    kind: "e3",
    name: "E3 学业诊断",
    desc: "三阶九能 70 题 · 分小学/初中/高中版 · 必测",
    required: true,
    tab: "e3",
    summary: (l) =>
      l.e3
        ? isE3V37Result(l.e3)
          ? "已生成三阶九能诊断"
          : "已升级 V3.7，请重新测评"
        : null,
  },
  {
    kind: "e3parent",
    name: "家长卷 · 家庭支持与观察对照",
    desc: "约 8 分钟 · 由家长填写 · 进入系统后随时可补 · 选做",
    required: false,
    tab: "parent",
    summary: (l) =>
      l.e3parent
        ? isE3V37ParentResult(l.e3parent)
          ? `家长了解程度「${l.e3parent.unknownLevel}」· 观察差异 ${l.e3parent.blindSpots?.length ?? 0} 项`
          : "已升级 V3.7，请重新测评"
        : null,
  },
  {
    kind: "multi5",
    name: "多元智能五项 · 客观测评",
    desc: "五维客观题 · 40 题约 8 分钟 · 选做",
    required: false,
    tab: "multi5",
    summary: (l) => (l.multi5 ? `综合 ${l.multi5.overall} · 细心指数 ${l.multi5.carefulIndex}%` : null),
  },
  {
    kind: "discparent",
    name: "家长 DISC（家庭版）",
    desc: "家长测家庭环境下的行为风格，多位家长可各测一次，自动与孩子的校园 DISC 做冲突对照分析 · 选做",
    required: false,
    tab: "parent",
    summary: (l) => {
      const n = (l.discParents as unknown[] | undefined)?.length ?? 0;
      return n > 0 ? `已测 ${n} 位家长` : null;
    },
    doneOf: (l) => ((l.discParents as unknown[] | undefined)?.length ?? 0) > 0,
  },
  {
    kind: "anchor",
    name: "职业锚测评",
    desc: "看看你内心最看重什么 · 选做",
    required: false,
    tab: "anchor",
    summary: (l) => (l.anchor ? "已生成职业锚画像" : null),
  },
  {
    kind: "holland",
    name: "霍兰德职业兴趣",
    desc: "RIASEC 六型兴趣代码 · 选做",
    required: false,
    tab: "holland",
    summary: (l) => (l.holland ? "已生成兴趣代码" : null),
  },
  {
    kind: "mental",
    name: "心理健康筛查（PHQ-9 + GAD-7 专业量表）",
    desc: "三甲医院通用筛查量表 · 16 题 · 约 3 分钟 · 选做",
    required: false,
    tab: "mental",
    summary: (l) =>
      l.mental
        ? isMentalV2(l.mental)
          ? `PHQ-9 ${l.mental.phq9}（${l.mental.phq9Level}）· GAD-7 ${l.mental.gad7}（${l.mental.gad7Level}）`
          : "量表已升级为 PHQ-9 + GAD-7 专业版（三甲医院通用筛查），请重新测评"
        : null,
  },
];

/** 内嵌挂载对应测评的答题组件。 */
function QuizStage({ kind, onDone }: { kind: TestKind; onDone: () => void }) {
  if (kind === "mbti") {
    return (
      <ChoiceStage
        key="mbti-quiz"
        kind="mbti"
        title="MBTI 快测"
        subtitle="28 道二选一，看看你的性格能量从哪里来"
        onNext={onDone}
        onSkip={onDone}
      />
    );
  }
  if (kind === "disc") {
    return <DiscV2Quiz key="disc-quiz" onNext={onDone} onSkip={onDone} />;
  }
  if (kind === "e3") {
    return (
      <E3Stage
        onSkip={onDone}
        renderAction={() => (
          <button
            onClick={onDone}
            className="w-full rounded-xl bg-olive py-3.5 text-[16px] font-semibold text-cream transition-colors hover:bg-lime"
          >
            完成，返回测评中心
          </button>
        )}
      />
    );
  }
  if (kind === "e3parent") return <E3ParentQuiz onDone={onDone} />;
  if (kind === "multi5") return <Multi5Quiz onDone={onDone} />;
  if (kind === "discparent") return <DiscParentQuiz onDone={onDone} />;
  if (kind === "anchor") return <AnchorQuiz onDone={onDone} />;
  if (kind === "holland") return <HollandQuiz onDone={onDone} />;
  return <MentalQuiz onDone={onDone} />;
}

/** 测评中心主页（/assessments）：全部测评的入口与报告导航。 */
export default function AssessmentCenter() {
  const navigate = useNavigate();
  const { data, isLoading } = trpc.assessment.latest.useQuery();
  const [testing, setTesting] = useState<TestKind | null>(null);
  // 支持 ?start=e3 深链：从报告页「去测评」直达对应答题
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const start = params.get("start") as TestKind | null;
    if (start && TESTS.some((t) => t.kind === start)) {
      setTesting(start);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);
  // anchor / holland / mental 为并行任务新增字段，接口已约定；类型未就绪故按 any 读取。
  const latest: any = data ?? {};
  const close = () => setTesting(null);
  const hasResult = (kind: TestKind) => {
    const def = TESTS.find((t) => t.kind === kind);
    return def?.doneOf ? def.doneOf(latest) : !!latest[kind];
  };
  const allRequired = !!latest.mbti && !!latest.disc && !!latest.e3;

  if (isLoading) {
    return <div className="paper-card h-40 animate-pulse bg-cream-deep/50" />;
  }

  return (
    <div className="space-y-4">
      {/* 顶部简介卡 */}
      <div className="paper-card accent-l border-lime p-5">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={17} className="text-olive" />
          <h2 className="text-[17px] font-bold text-olive">测评中心</h2>
        </div>
        <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">
          这里集中了全部测评的入口与报告。三项必测（MBTI 性格、DISC 行为风格、E3 三阶九能学业诊断）是综合学习力报告的基础；
          选做测评（家长卷、家长 DISC、多元智能五项、职业锚、霍兰德职业兴趣、心理健康）帮你和家人从更多角度认识自己，按兴趣挑着做就好。
        </p>
      </div>

      {/* 最重要入口：综合学习力报告 + 成绩现状（置顶突出） */}
      {!testing && (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => allRequired && navigate("/report-detail?tab=combined")}
            disabled={!allRequired}
            className={`paper-card flex items-center gap-3.5 p-5 text-left ${
              allRequired ? "accent-l border-lime shadow-sm hover:bg-lime-pale/40" : "opacity-70"
            }`}
          >
            <Sparkles size={30} className="shrink-0 text-lime-deep" />
            <div>
              <h3 className="text-[16.5px] font-bold text-olive">综合学习力报告</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-olive-mute">
                {allRequired
                  ? "MBTI × DISC × 学习力诊断 三合一，点开看你的专属综合报告 →"
                  : "三项必测（MBTI / DISC / E3）都完成后即可查看，先去补齐吧。"}
              </p>
            </div>
          </button>
          <button
            onClick={() => navigate("/report-detail?tab=academics")}
            className="paper-card accent-l border-lime flex items-center gap-3.5 p-5 text-left shadow-sm hover:bg-lime-pale/40"
          >
            <Target size={30} className="shrink-0 text-lime-deep" />
            <div>
              <h3 className="text-[16.5px] font-bold text-olive">成绩现状及目标分数</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-olive-mute">
                各科的最近分与目标分，一眼看清每科要补的空间 →
              </p>
            </div>
          </button>
        </div>
      )}

      {/* 我的测评 */}
      {testing ? (
        <QuizStage kind={testing} onDone={close} />
      ) : (
        <div className="space-y-3">
          <div className="mono px-1 text-[11px] tracking-wider text-olive-mute">我的测评</div>
          {TESTS.map((t) => {
            const done = hasResult(t.kind);
            const core = done ? t.summary?.(latest) : null;
            return (
              <div key={t.kind} className="paper-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-olive">{t.name}</h3>
                  <span
                    className={`chip !py-0.5 text-[11px] ${
                      t.required ? "!border-lime/50 !bg-lime-pale" : ""
                    }`}
                  >
                    {t.required ? "必测" : "选做"}
                  </span>
                </div>
                {done ? (
                  <p className="mt-2 text-[13.5px] text-olive-soft">
                    {core ? `核心结果：${core}` : "已完成测评"}
                  </p>
                ) : (
                  <p className="mt-2 text-[13.5px] text-olive-mute">
                    {t.desc} · 还没测
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  {done ? (
                    <>
                      <button
                        onClick={() => navigate(`/report-detail?tab=${t.tab}`)}
                        className="flex-1 rounded-xl bg-olive py-2 text-[13px] font-semibold text-cream hover:bg-lime-deep"
                      >
                        查看报告
                      </button>
                      <button
                        onClick={() => setTesting(t.kind)}
                        className="flex-1 rounded-xl border border-border bg-cream-card py-2 text-[13px] text-olive-mute transition-colors hover:border-lime/60 hover:text-olive"
                      >
                        重新测
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setTesting(t.kind)}
                      className="flex-1 rounded-xl bg-olive py-2 text-[13px] font-semibold text-cream hover:bg-lime-deep"
                    >
                      开始测评
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 底部入口 */}
      {!testing && (
        <div className="space-y-3">
          <button
            onClick={() => navigate("/report-detail")}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-cream-card py-2.5 text-[13px] text-olive-mute hover:border-lime/60 hover:text-olive"
          >
            <Compass size={14} />
            打开完整报告页
          </button>
        </div>
      )}
    </div>
  );
}
