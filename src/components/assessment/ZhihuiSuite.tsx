import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, ChevronDown, ClipboardList, Info, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import Subject4dQuiz from "@/components/companion/Subject4dQuiz";
import HollandQuiz from "@/components/companion/HollandQuiz";
import AnchorQuiz from "@/components/companion/AnchorQuiz";
import Multi5Quiz from "@/components/companion/Multi5Quiz";
import AcademicsEditorCore, { type AcademicsSubmit } from "@/components/companion/AcademicsEditorCore";
import { type AcademicsData } from "@contracts/academics";

/**
 * v181：选科及升学规划测评（一条龙）。
 * 主流程：学科四维测评 → 霍兰德职业兴趣测评 → 职业锚测评，做完生成「选科及升学规划报告」。
 * 「多元智能五项」折叠在职业兴趣测评之后，仅作参考（暂不影响选科与专业推荐因子）。
 * v194：步骤按渠道套餐动态裁剪（如校园渠道不含职业锚则只走两步）。
 */
const ALL_STEPS = [
  { key: "subject4d", label: "学科四维测评" },
  { key: "holland", label: "霍兰德职业兴趣" },
  { key: "anchor", label: "职业锚测评" },
] as const;
type BaseKey = (typeof ALL_STEPS)[number]["key"];
type StepKey = BaseKey | "grades";

/* 校园模式成绩必填：语数英+物化生政史地 9 科全部要有最近分数 */
const REQUIRED_SUBJECTS = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "道德与法治", "地理"];
function gradesComplete(profile: any): boolean {
  const subs: { name?: string | null; lastScore?: number | null }[] = profile?.academics?.subjects ?? [];
  return REQUIRED_SUBJECTS.every((n) => subs.find((s) => s.name === n)?.lastScore != null);
}

export default function ZhihuiSuite({ onExit }: { onExit: () => void }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const latestQuery = trpc.assessment.latest.useQuery();
  const { data } = latestQuery;
  /* v194：渠道套餐——校园渠道（如无职业锚）步骤动态裁剪；成绩档案用于完成页强制录入 */
  const { data: access } = trpc.invite.myAssessmentAccess.useQuery();
  const { data: profile } = trpc.profile.get.useQuery();
  const campus = !!access?.campus;
  /* v221：机构可调成绩权重（提示文案动态显示；未设置默认校园 35 / 通用 40） */
  const { data: xw } = trpc.school.xuankeWeight.get.useQuery();
  const scorePct = xw?.scoreWeight ?? (campus ? 35 : 40);
  const steps = useMemo((): { key: StepKey; label: string }[] => {
    const kinds = access?.kinds ?? [];
    const base: { key: StepKey; label: string }[] =
      access?.enabled && !kinds.includes("all") ? ALL_STEPS.filter((s) => kinds.includes(s.key)) : [...ALL_STEPS];
    /* v194：校园模式最后追加「月考成绩」必填步骤：学科四维 + 霍兰德 + 成绩，一次走完 */
    if (access?.campus) base.push({ key: "grades" as const, label: "月考成绩" });
    return base;
  }, [access]);
  const LAST = steps.length - 1;
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
    const firstIncomplete = steps.findIndex((s) => !doneOf(s.key));
    if (firstIncomplete === -1) setFinished(true); // 全部完成：直接出完成页
    else if (firstIncomplete > 0) setStep(firstIncomplete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestQuery.isLoading]);
  const doneOf = (k: StepKey): boolean => (k === "grades" ? gradesComplete(profile) : !!latest[k]);

  const next = () => {
    utils.assessment.latest.invalidate();
    setStep((s) => (s < LAST ? s + 1 : s));
  };
  const finish = () => {
    utils.assessment.latest.invalidate();
    setFinished(true);
  };

  if (finished) {
    const doneLabels = steps.map((s) => s.label.replace("测评", "")).join("、");
    const gradesOk = gradesComplete(profile);
    return (
      <div className="space-y-4">
        <div className="paper-card mx-auto max-w-lg p-8 text-center">
          <CheckCircle2 className="mx-auto h-11 w-11 text-[#2F7A41]" />
          <h2 className="mt-3 text-[19px] font-bold text-olive">选科及升学规划测评完成</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">
            {doneLabels}都已记录在案，你的「选科及升学规划报告」正在生成——选科组合、适合的专业与职业、升学路径一目了然。
          </p>
          {/* v194：校园模式必须先把 9 科月考成绩填完才能看报告 */}
          {campus && !gradesOk && (
            <p className="mt-3 rounded-xl bg-butter-pale/70 px-4 py-2.5 text-[13px] leading-relaxed text-olive">
              月考成绩已出分：请先把<b>语数英 + 物化生政史地 9 科成绩</b>录入系统，选科推荐需要按成绩加权（权重 {scorePct}%）生成。
            </p>
          )}
          <div className="mt-5 flex gap-2">
            {campus && !gradesOk ? (
              <button
                onClick={() => navigate("/report-detail")}
                className="flex-1 rounded-xl bg-brand py-3 text-[14px] font-semibold text-cream hover:bg-lime-deep"
              >
                先录入月考成绩（9 科必填）→
              </button>
            ) : (
              <button
                onClick={() => navigate("/zhihui-report")}
                className="flex-1 rounded-xl bg-brand py-3 text-[14px] font-semibold text-cream hover:bg-lime-deep"
              >
                查看选科及升学规划报告
              </button>
            )}
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

  const cur = steps[step]!;
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
          {steps.map((s, i) => {
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
                {i < steps.length - 1 && <span className="text-[11px] text-olive-mute">→</span>}
              </span>
            );
          })}
        </div>
      </div>

      {/* 当前步骤：最后一步完成即出完成页 */}
      {cur.key === "subject4d" && <Subject4dQuiz onDone={step === LAST ? finish : next} suite />}
      {cur.key === "holland" && <HollandQuiz onDone={step === LAST ? finish : next} suite />}
      {cur.key === "anchor" && <AnchorQuiz suite onDone={finish} />}
      {cur.key === "grades" && <CampusGradesStep onDone={finish} />}

      {/* 折叠参考测评：跟在职业兴趣测评后，仅参考、不影响选科推荐（套餐含 multi5 时才展示） */}
      {step >= 1 && (!access?.enabled || (access?.kinds ?? []).includes("all") || (access?.kinds ?? []).includes("multi5")) && (
        <RefPanel open={refOpen} onToggle={() => setRefOpen((o) => !o)} done={refDone || !!latest.multi5} onRefDone={() => { setRefDone(true); utils.assessment.latest.invalidate(); }} />
      )}
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

/**
 * v194 校园模式「月考成绩」步骤：9 科必填（语数英+物化生政史地），全部填完才能提交并看报告。
 */
function CampusGradesStep({ onDone }: { onDone: () => void }) {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.profile.get.useQuery();
  /* v221：成绩权重提示随机构设置动态显示（默认校园 35） */
  const { data: xw } = trpc.school.xuankeWeight.get.useQuery();
  const scorePct = xw?.scoreWeight ?? 35;
  const [missing, setMissing] = useState<string[]>([]);
  const save = trpc.profile.saveAcademics.useMutation({
    onSuccess: () => {
      utils.profile.get.invalidate();
      utils.assessment.latest.invalidate();
      onDone();
    },
  });

  if (isLoading) return <div className="paper-card h-40 animate-pulse bg-cream-deep/50" />;
  if (!profile) return null;

  const onSubmit = (data: AcademicsSubmit) => {
    /* 9 科必填校验：缺一科都拦下并列出缺哪几科 */
    const absent = REQUIRED_SUBJECTS.filter(
      (n) => data.subjects.find((s) => s.name === n)?.lastScore == null,
    );
    if (absent.length > 0) {
      setMissing(absent);
      return;
    }
    setMissing([]);
    save.mutate(data);
  };

  return (
    <div className="paper-card p-4">
      <p className="mb-3 rounded-xl bg-mint-pale/70 px-4 py-2.5 text-[13px] leading-relaxed text-olive">
        月考成绩是选科推荐的重要依据（与测评潜力一起按 {scorePct}% 权重计入）。请把<b>语数英 + 物化生政史地 9 科</b>的最近月考分数都填上，填完即可查看你的选科及升学规划报告。
      </p>
      {missing.length > 0 && (
        <p className="mb-3 rounded-xl bg-terra/10 px-4 py-2.5 text-[13px] font-medium text-terra">
          还有 {missing.length} 科没填最近分数：{missing.join("、")}。9 科全部填完才能生成报告哦。
        </p>
      )}
      {save.isError && <p className="mb-3 rounded-xl bg-terra/10 px-4 py-2.5 text-[13px] text-terra">保存失败，请再试一次。</p>}
      <AcademicsEditorCore
        grade={profile.grade}
        initial={profile.academics as AcademicsData | null | undefined}
        submitting={save.isPending}
        submitLabel="保存成绩并查看报告"
        onSubmit={onSubmit}
        footer={null}
        showIntro={false}
      />
    </div>
  );
}
