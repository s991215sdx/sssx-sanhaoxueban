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
import MentalSdqQuiz from "@/components/companion/MentalSdqQuiz";
import MentalPaQuiz from "@/components/companion/MentalPaQuiz";
import MentalScl90Quiz from "@/components/companion/MentalScl90Quiz";
import E3ParentQuiz from "@/components/companion/E3ParentQuiz";
import DiscParentQuiz from "@/components/companion/DiscParentQuiz";
import DiscV2Quiz from "@/components/companion/DiscV2Quiz";
import { isE3V37Result, isE3V37ParentResult } from "@contracts/assessments";
import { isMentalV2 } from "@contracts/mentalHealth";
import { ClipboardCheck, Sparkles, Target, Compass } from "lucide-react";

/** 测评中心管理的测评项。anchor/holland/mental/discparent 为并行任务新增的选做测评。 */
type TestKind = "mbti" | "disc" | "e3" | "e3parent" | "multi5" | "discparent" | "anchor" | "holland" | "mentalsdq" | "mentalpa" | "mental";

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
    name: "心理健康筛查（四套量表 · 选一套做）",
    desc: "学生版 A（SDQ 长处与困难，4—17 岁）/ 学生版 B（PHQ-A + GAD-7，11 岁以上）/ 通用版（PHQ-9 + GAD-7）/ 深度评估（SCL-90，16 岁以上 90 题）· 均为选做，可分开多次做 · 选做",
    required: false,
    tab: "mental",
    summary: (l) => {
      const parts: string[] = [];
      if (l.mentalSdq) parts.push(`A·SDQ ${l.mentalSdq.totalDiff}/40（${l.mentalSdq.totalBand}）`);
      if (l.mentalPa) parts.push(`B·PHQ-A ${l.mentalPa.phq9}（${l.mentalPa.phq9Level}）`);
      if (l.mental)
        parts.push(isMentalV2(l.mental) ? `通用·PHQ-9 ${l.mental.phq9}（${l.mental.phq9Level}）` : "通用·旧版结果保留");
      if (l.mentalScl90) parts.push(`深度·SCL-90 ${l.mentalScl90.total} 分（${l.mentalScl90.level}）`);
      return parts.length > 0 ? parts.join(" · ") : null;
    },
    doneOf: (l) => !!(l.mental || l.mentalSdq || l.mentalPa || l.mentalScl90),
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
  if (kind === "mentalsdq") return <MentalSdqQuiz onDone={onDone} />;
  if (kind === "mentalpa") return <MentalPaQuiz onDone={onDone} />;
  return <MentalChooser onDone={onDone} />;
}

/** 心理健康四套量表自选页：孩子自己挑一套做（四套可分开多次做）。 */
function MentalChooser({ onDone }: { onDone: () => void }) {
  const { data } = trpc.assessment.latest.useQuery();
  const [picked, setPicked] = useState<"mentalsdq" | "mentalpa" | "scl90" | "mental" | null>(null);
  if (picked === "mentalsdq") return <MentalSdqQuiz onDone={onDone} />;
  if (picked === "mentalpa") return <MentalPaQuiz onDone={onDone} />;
  if (picked === "scl90") return <MentalScl90Quiz onDone={onDone} />;
  if (picked === "mental") return <MentalQuiz onDone={onDone} />;
  const l: any = data ?? {};
  const OPTIONS: { key: "mentalsdq" | "mentalpa" | "scl90" | "mental"; badge: string; title: string; age: string; desc: string; done: null | { label: string; note: string } }[] = [
    {
      key: "mentalsdq",
      badge: "学生版 A",
      title: "SDQ 长处与困难问卷",
      age: "4—17 岁（11 岁以下由家长引导填写）",
      desc: "国际通用的儿童青少年行为筛查：把状态拆成情绪、行为、注意力、同伴关系、亲社会优势五个观察面，还含 1 条安全预警题。25+1 题约 4 分钟。",
      done: l.mentalSdq
        ? { label: "已测", note: `困难总分 ${l.mentalSdq.totalDiff}/40（${l.mentalSdq.totalBand}）· 综合「${l.mentalSdq.level}」${l.mentalSdq.selfHarm ? " · ⚠有安全预警信号" : ""}` }
        : null,
    },
    {
      key: "mentalpa",
      badge: "学生版 B",
      title: "PHQ-A + GAD-7",
      age: "11 岁以上",
      desc: "国际通用的青少年抑郁 + 焦虑筛查：PHQ-A 是 PHQ-9 的青少年改编版，GAD-7 为原版标准措辞，信效度依据充分。16 题约 3 分钟，含 1 道自伤念头红线题。",
      done: l.mentalPa
        ? { label: "已测", note: `PHQ-A ${l.mentalPa.phq9}/27（${l.mentalPa.phq9Level}）· GAD-7 ${l.mentalPa.gad7}/21（${l.mentalPa.gad7Level}）${l.mentalPa.selfHarm ? " · ⚠有安全预警信号" : ""}` }
        : null,
    },
    {
      key: "scl90",
      badge: "深度评估",
      title: "SCL-90 症状自评量表",
      age: "16 岁以上 · 约 15—20 分钟",
      desc: "国际应用最广泛的心理症状自评量表（原版标准 90 题、一字未改）：10 因子全面扫描近一周状态，按中国常模口径给出筛选结论，含 1 道生命安全题。适合想做一次完整深度评估的同学。",
      done: l.mentalScl90
        ? { label: "已测", note: `总分 ${l.mentalScl90.total}/450（${l.mentalScl90.level}）${l.mentalScl90.selfHarm ? " · ⚠有安全预警信号" : ""}` }
        : null,
    },
    {
      key: "mental",
      badge: "通用版",
      title: "PHQ-9 + GAD-7",
      age: "不限（青少年与成人都适用）",
      desc: "国际通用的抑郁 + 焦虑筛查标准版。16 题约 3 分钟，含 1 道自伤念头红线题。已经测过旧版（30 题十因子）的同学，也可以在这里测新版。",
      done: l.mental
        ? isMentalV2(l.mental)
          ? { label: "已测", note: `PHQ-9 ${l.mental.phq9}/27（${l.mental.phq9Level}）· GAD-7 ${l.mental.gad7}/21（${l.mental.gad7Level}）${l.mental.selfHarm ? " · ⚠有安全预警信号" : ""}` }
          : { label: "旧版结果", note: "30 题旧版结果保留可查，建议测上面的新版" }
        : null,
    },
  ];
  return (
    <div className="paper-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-olive">心理健康测评 · 选一套做</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-olive-soft">
            四套都是国际通用筛查工具（选做），观察的侧重点和深度不同，可以挑一套，也可以分几次各做一套——做过的结果都会进报告。如实作答，结果只有你自己看到。
          </p>
        </div>
        <button onClick={onDone} className="shrink-0 text-[13px] text-olive-mute hover:text-olive">
          返回
        </button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {OPTIONS.map((o) => (
          <div key={o.key} className="flex flex-col rounded-xl border border-lime/40 bg-lime-pale/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-olive px-2.5 py-0.5 text-[11px] font-bold text-cream">{o.badge}</span>
              {o.done ? (
                <span className="rounded-full border border-lime/60 bg-cream px-2 py-px text-[11px] font-semibold text-[#5a9326]">{o.done.label}</span>
              ) : (
                <span className="rounded-full border border-dashed border-[#a8b08c]/80 px-2 py-px text-[11px] text-olive-mute">未测</span>
              )}
            </div>
            <div className="mt-2 text-[14.5px] font-bold text-olive">{o.title}</div>
            <div className="mono mt-0.5 text-[11px] text-olive-mute">{o.age}</div>
            <p className="mt-2 flex-1 text-[12.5px] leading-relaxed text-olive-soft">{o.desc}</p>
            {o.done && <p className="mt-2 text-[11.5px] leading-relaxed text-olive-mute">{o.done.note}</p>}
            <button
              onClick={() => setPicked(o.key)}
              className="mt-3 w-full rounded-xl bg-olive py-2.5 text-[13.5px] font-semibold text-cream transition-colors hover:bg-lime"
            >
              {o.done ? "重新测一遍" : "开始这套测评"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
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
