import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { trpc } from "@/providers/trpc";
import { clearQuizDraft, loadQuizDraft, useDraftResumed, useDraftState } from "@/lib/quizDraft";
import { useAuth } from "@/hooks/useAuth";
import {
  E3V37_QUESTIONS,
  E3V37_LIFE_EVENTS,
  E3V37_OPEN_QUESTIONS,
  E3V37_MOTIVATION_OPTIONS,
  E3V37_RATING_COUNT,
  type E3V37MotivationKey,
  type E3V37Question,
  type E3V37Result,
  type E3V37Stage,
} from "@contracts/assessments";
import { GRADES, STAGES, STAGE_GRADES, stageOfGrade, type Stage } from "@contracts/constants";

/** 本测评的草稿 key：作答实时保存，误退出后回来接着测。 */
const E3_DRAFT = "e3";

const RATE_HINTS = ["从不", "很少", "有时", "经常", "总是"];
const EVENT_HINTS = ["没发生", "轻度", "中度", "重度"];

/** 九能红黄绿（与报告一致）：卡点红 / 待提升黄 / 正常绿。 */
const LEVEL_COLOR: Record<string, string> = { 卡点: "#DD3534", 待提升: "#E3B53A", 正常: "#2F7A41" };

/** 各系统分段（与 V3.7 试卷一致）：题号范围 + 预计用时 + 补充说明 + 完成后的鼓励语。 */
const PARTS: { min: number; max: number; title: string; short: string; minutes: string; note?: string; praise: string }[] = [
  {
    min: 1, max: 21, title: "一、乐学 · 动力系统", short: "乐学", minutes: "约 3 分钟",
    note: "看看你的动力、信心和韧劲——动力系统是学习这台车的发动机。",
    praise: "乐学部分完成！你刚刚看清了自己的动力来源，这是最重要的一步。",
  },
  {
    min: 22, max: 33, title: "二、会学 · 行为系统", short: "会学", minutes: "约 2 分钟",
    note: "学懂、记住、会用——每天的听课、整理和错题习惯都在这里。",
    praise: "会学部分完成！快一半啦，你对自己的日常学习习惯有了清楚的认识。",
  },
  {
    min: 34, max: 49, title: "三、善学 · 加速系统", short: "善学", minutes: "约 3 分钟",
    note: "计划、复盘和 AI 智学——让同样的时间产生更大的进步。",
    praise: "善学部分完成！这部分题量不小，你坚持下来了，真棒。",
  },
  {
    min: 50, max: 67, title: "四、条件 · 支持系统", short: "条件", minutes: "约 3 分钟",
    note: "这部分不进总分，是看你的身心与环境基础（状态 / 关系 / 资源）。",
    praise: "条件部分完成！身心状态和支持环境也看清了，只剩最后一小段。",
  },
  {
    min: 68, max: 70, title: "五、学能筛查", short: "学能", minutes: "约 1 分钟",
    note: "这部分单独报告，不进总分——只是粗筛当前的加工效率，不代表智力或潜力。",
    praise: "评分题全部完成！接下来只有几个很轻松的小部分。",
  },
];

/** 答题流程的阶段：部分开场 → 逐题作答 → 部分完成鼓励 → 状态单选 → 生活事件 → 开放题。（v184 起移除学科快扫页） */
type Phase =
  | { kind: "intro"; part: number }
  | { kind: "quiz"; part: number; qi: number }
  | { kind: "done"; part: number }
  | { kind: "motivation" }
  | { kind: "life" }
  | { kind: "open" };

/** 学段确认门：诊断分小学/初中/高中三版，必须先确认学段再发对应测评。 */
function StageConfirm({ defaultName, onDone }: { defaultName: string; onDone: () => void }) {
  const [name, setName] = useState(defaultName);
  const [stage, setStage] = useState<Stage | null>(null);
  const [grade, setGrade] = useState("");
  const setup = trpc.profile.setup.useMutation({ onSuccess: onDone });
  const inputCls =
    "mt-2 w-full rounded-xl border border-input bg-cream px-4 py-2.5 text-[15px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25";
  const valid = name.trim().length > 0 && stage !== null && GRADES.includes(grade);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="paper-card p-4 sm:p-6">
        <h2 className="text-lg font-bold text-olive">先确认你的学段</h2>
        <p className="mt-1 text-[14px] text-olive-soft">
          学业诊断分「小学版 / 初中版 / 高中版」，题目不一样——先告诉我们你读哪个学段，系统才会给你对应的测评。
        </p>
        <div className="mt-5 space-y-4">
          <div>
            <label className="mono text-[11px] tracking-wider text-olive-mute">怎么称呼你？</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="名字或喜欢的称呼" maxLength={32} className={inputCls} />
          </div>
          <div>
            <label className="mono text-[11px] tracking-wider text-olive-mute">你在哪个学段？</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setStage(s);
                    setGrade(STAGE_GRADES[s][0]);
                  }}
                  className={`rounded-xl border px-4 py-3 text-[15px] font-semibold transition-colors ${
                    stage === s ? "border-olive bg-brand text-cream" : "border-border bg-cream text-olive-soft hover:border-olive/40"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          {stage && (
            <div>
              <label className="mono text-[11px] tracking-wider text-olive-mute">具体年级</label>
              <select value={grade} onChange={(e) => setGrade(e.target.value)} className={inputCls}>
                {STAGE_GRADES[stage].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={() => valid && setup.mutate({ name: name.trim(), grade, dailyMinutes: 45 })}
            disabled={!valid || setup.isPending}
            className="w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
          >
            {setup.isPending ? "正在确认…" : "确认学段，开始诊断 →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 向导第 4 阶段：E3 学业诊断 V3.7 三阶九能（一次一题，分段进行，每段有预计用时与完成鼓励）。 */
export default function E3Stage({ renderAction, onSkip }: { renderAction: () => ReactNode; onSkip: () => void }) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { data: profile, isLoading: profileLoading } = trpc.profile.get.useQuery();
  const stageKnown = !!profile?.grade && stageOfGrade(profile.grade) !== null;
  const { data, isLoading } = trpc.assessment.questions.useQuery({ kind: "e3" }, { enabled: stageKnown });

  /* 旧版（V2.7）草稿的 ratings 是 73 题，与 V3.7 的 70 题不兼容：
     首个 state 初始化时校验，长度不对直接清草稿从头开始（在其余草稿字段读取之前执行）。 */
  const [draftValid] = useState(() => {
    const d = loadQuizDraft(user?.id, E3_DRAFT);
    if (!d) return true;
    const r = d.ratings;
    if (!Array.isArray(r) || r.length !== E3V37_RATING_COUNT) {
      clearQuizDraft(user?.id, E3_DRAFT);
      return false;
    }
    return true;
  });

  /* 全部作答状态挂草稿：每答一题实时保存，误退出/刷新后自动恢复到上次进度 */
  const [ratings, setRatings] = useDraftState<(number | null)[]>(E3_DRAFT, "ratings", () => Array(E3V37_RATING_COUNT).fill(null));
  const [motivation, setMotivation] = useDraftState<E3V37MotivationKey | null>(E3_DRAFT, "motivation", null);
  const [lifeEvents, setLifeEvents] = useDraftState<number[]>(E3_DRAFT, "lifeEvents", () => Array(8).fill(0));
  const [openAnswers, setOpenAnswers] = useDraftState<string[]>(E3_DRAFT, "openAnswers", ["", "", ""]);
  const [phase, setPhase] = useDraftState<Phase>(E3_DRAFT, "phase", { kind: "intro", part: 0 });
  // v184：旧草稿可能停在已删除的学科快扫页阶段，归一到「生活事件快扫」
  if ((phase as unknown as { kind: string }).kind === "subjects") setPhase({ kind: "life" });
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* 是否从草稿恢复（有实质进度）：用于显示「已恢复进度」提示条 */
  // v70：跟随 uid 重算（换号/新注册账号不再误显示"已恢复进度"）
  const [resumed, setResumed] = useDraftResumed(user?.id, E3_DRAFT, "ratings");
  const resumedShow = resumed && draftValid;

  /** 清空草稿并从头再来一遍。 */
  const resetAll = () => {
    clearQuizDraft(user?.id, E3_DRAFT);
    setRatings(Array(E3V37_RATING_COUNT).fill(null));
    setMotivation(null);
    setLifeEvents(Array(8).fill(0));
    setOpenAnswers(["", "", ""]);
    setPhase({ kind: "intro", part: 0 });
    setResumed(false);
  };

  const submit = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      clearQuizDraft(user?.id, E3_DRAFT); // 提交成功，草稿使命完成
      utils.assessment.latest.invalidate();
      utils.profile.get.invalidate();
    },
  });

  const answeredCount = useMemo(() => ratings.filter((r) => r !== null).length, [ratings]);
  const ready = answeredCount === E3V37_RATING_COUNT && motivation !== null;

  /* ---------- 提交成功：简洁成功卡（九能红黄绿一览 + 动作按钮） ---------- */
  if (submit.isSuccess && (submit.data as { kind?: string }).kind === "e3") {
    const result = (submit.data as { result?: unknown }).result as E3V37Result | undefined;
    const abilities = result?.abilities ?? [];
    return (
      <div className="mx-auto max-w-3xl">
        <div className="paper-card accent-l border-lime p-5 sm:p-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lime-pale text-[22px] font-bold text-[#2F7A41]">✓</div>
          <h2 className="mt-3 text-center text-lg font-bold text-olive">诊断完成</h2>
          <p className="mt-1 text-center text-[13.5px] text-olive-soft">
            三阶九能诊断已生成，红色是当前卡点、黄色待提升、绿色正常。
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {abilities.map((a) => (
              <span
                key={a.key}
                className="chip"
                style={{ borderColor: LEVEL_COLOR[a.level], color: LEVEL_COLOR[a.level] }}
              >
                {a.system}·{a.label} <b>{a.score.toFixed(1)}</b> {a.level}
              </span>
            ))}
          </div>
          <div className="mt-5">{renderAction()}</div>
        </div>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="paper-card flex justify-center p-14">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        </div>
      </div>
    );
  }

  // 学段未确认（如跳过了建档）：先确认学段，再发对应版本的测评
  if (!stageKnown) {
    return (
      <StageConfirm
        defaultName={profile?.name ?? ""}
        onDone={() => {
          void utils.profile.get.invalidate();
          void utils.assessment.questions.invalidate();
        }}
      />
    );
  }

  if (isLoading || !data || (data as { kind?: string }).kind !== "e3") {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="paper-card flex justify-center p-14">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        </div>
      </div>
    );
  }

  /* 后端并行开发中：按约定形状读取，缺失字段回退到契约常量。 */
  const q = data as unknown as {
    stage?: E3V37Stage;
    stageLabel?: string;
    ratings?: E3V37Question[];
    motivationOptions?: typeof E3V37_MOTIVATION_OPTIONS;
    lifeEvents?: { no: number; kp: string; text: string }[];
    openQuestions?: string[];
  };
  const stage: E3V37Stage = q.stage === "primary" || q.stage === "senior" ? q.stage : "junior";
  const stageLabel = q.stageLabel ?? (stage === "primary" ? "小学版" : stage === "senior" ? "高中版" : "初中版");
  const ratingQuestions = Array.isArray(q.ratings) && q.ratings.length > 0 ? q.ratings : E3V37_QUESTIONS[stage];
  const motivationOptions = q.motivationOptions ?? E3V37_MOTIVATION_OPTIONS;
  const lifeEventItems = q.lifeEvents ?? E3V37_LIFE_EVENTS[stage];
  const openQuestions = q.openQuestions ?? E3V37_OPEN_QUESTIONS;

  /** 当前题（quiz 阶段）：题号 = 部分起始 + 题内序号。 */
  const currentNo = phase.kind === "quiz" ? PARTS[phase.part].min + phase.qi : null;
  const currentQ = currentNo != null ? ratingQuestions.find((qq) => qq.no === currentNo) : null;

  /** 选一选项：记录答案，稍作停顿后自动进入下一题（答过的题重选则只更新不跳转）。 */
  const answerCurrent = (v: number) => {
    if (phase.kind !== "quiz" || currentNo == null) return;
    const already = ratings[currentNo - 1] !== null;
    setRatings((arr) => arr.map((x, i) => (i === currentNo - 1 ? v : x)));
    setResumed(false); // 已开始新作答，"已恢复进度"提示条使命完成
    if (already) return;
    const part = PARTS[phase.part];
    const isLast = currentNo >= part.max;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      setPhase((p) => {
        if (p.kind !== "quiz") return p;
        return isLast ? { kind: "done", part: p.part } : { kind: "quiz", part: p.part, qi: p.qi + 1 };
      });
    }, 260);
  };

  const header = (
    <div className="paper-card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-olive">学业诊断测评 · 三阶九能（{stageLabel}）</h2>
          <p className="mt-0.5 text-[13px] text-olive-soft">
            一次只做一道题，做完一小部分就休息一下；凭第一反应作答就好，越诚实，建议越准。
          </p>
        </div>
        <button onClick={onSkip} className="shrink-0 text-[13px] text-olive-mute hover:text-olive">
          先跳过这测
        </button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-deep">
          <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${(answeredCount / E3V37_RATING_COUNT) * 100}%` }} />
        </div>
        <span className="mono shrink-0 text-[12px] text-olive-mute">{answeredCount} / {E3V37_RATING_COUNT}</span>
      </div>
      {resumedShow && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-lime/50 bg-lime-pale/60 px-3 py-2">
          <span className="text-[12.5px] text-olive">已恢复你上次的作答进度（已答 {answeredCount} / {E3V37_RATING_COUNT}），接着做就好，不用重测。</span>
          <button onClick={resetAll} className="shrink-0 text-[12px] text-olive-mute underline hover:text-olive">
            从头再做一遍
          </button>
        </div>
      )}
    </div>
  );

  /* ---------- 部分开场卡：说明这一部分是什么、大概用多久 ---------- */
  if (phase.kind === "intro") {
    const part = PARTS[phase.part];
    const count = part.max - part.min + 1;
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {header}
        <div className="paper-card p-4 text-center sm:p-6">
          <div className="mono text-[11px] tracking-wider text-olive-mute">
            第 {phase.part + 1} 部分 / 共 5 部分 · {count} 道题 · {part.minutes}
          </div>
          <h3 className="mt-2 text-[17px] font-bold text-olive">{part.title}</h3>
          <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-olive-soft">
            {part.note ?? "不用想太久，凭最近一个月的真实感觉作答就好。"}一次只出现一道题，点完自动跳到下一题。
          </p>
          <button
            onClick={() => setPhase({ kind: "quiz", part: phase.part, qi: 0 })}
            className="mt-5 w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
          >
            开始这一部分 →
          </button>
        </div>
      </div>
    );
  }

  /* ---------- 逐题作答卡：一次一题 ---------- */
  if (phase.kind === "quiz" && currentQ) {
    const part = PARTS[phase.part];
    const count = part.max - part.min + 1;
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {header}
        <div className="paper-card p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <span className="mono text-[11px] tracking-wider text-olive-mute">
              {part.short} · 第 {phase.qi + 1} / {count} 题
            </span>
            <span className="mono text-[11px] text-olive-mute">{part.minutes}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-deep">
            <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${((phase.qi + 1) / count) * 100}%` }} />
          </div>
          <p className="mt-4 min-h-[72px] text-[16.5px] font-medium leading-relaxed text-olive">
            <span className="mono mr-1.5 text-[13px] text-olive-mute">{currentQ.no}.</span>
            {currentQ.text}
          </p>
          {currentQ.no >= 45 && currentQ.no <= 48 && (
            <p className="mt-1 rounded-lg bg-cream-deep/60 px-3 py-1.5 text-[12.5px] text-olive-mute">
              没用过 AI 学习工具的话，45-48 题选「从不」。
            </p>
          )}
          <div className="mt-4 grid grid-cols-5 gap-2">
            {RATE_HINTS.map((hint, i) => {
              const v = i + 1;
              const sel = ratings[currentQ.no - 1] === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => answerCurrent(v)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-3 transition-colors ${
                    sel ? "border-olive bg-brand text-cream" : "border-border bg-cream text-olive-soft hover:border-lime"
                  }`}
                >
                  <span className={`h-4 w-4 rounded-full border-2 ${sel ? "border-cream bg-cream" : "border-olive-mute/40"}`} />
                  <span className="text-[12px] font-medium">{hint}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex justify-between">
            <button
              type="button"
              onClick={() =>
                setPhase((p) =>
                  p.kind === "quiz" && p.qi > 0 ? { kind: "quiz", part: p.part, qi: p.qi - 1 } : { kind: "intro", part: phase.part },
                )
              }
              className="text-[13px] text-olive-mute hover:text-olive"
            >
              ← 上一题
            </button>
            {ratings[currentQ.no - 1] !== null && (
              <button
                type="button"
                onClick={() =>
                  setPhase((p) =>
                    p.kind === "quiz"
                      ? currentQ.no >= part.max
                        ? { kind: "done", part: p.part }
                        : { kind: "quiz", part: p.part, qi: p.qi + 1 }
                      : p,
                  )
                }
                className="text-[13px] font-semibold text-olive hover:text-lime-deep"
              >
                下一题 →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- 部分完成鼓励卡 ---------- */
  if (phase.kind === "done") {
    const part = PARTS[phase.part];
    const isLastPart = phase.part >= PARTS.length - 1;
    const next = isLastPart ? null : PARTS[phase.part + 1];
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {header}
        <div className="paper-card p-4 text-center sm:p-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lime-pale text-[22px] font-bold text-[#2F7A41]">✓</div>
          <h3 className="mt-3 text-[17px] font-bold text-olive">{part.praise}</h3>
          <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-olive-soft">
            {isLastPart
              ? "接下来是「学习状态单选」，只选一项，约 1 分钟。"
              : `可以喝口水休息一下。准备好了就进入下一部分：${next!.title}，${next!.minutes}。`}
          </p>
          <button
            onClick={() => setPhase(isLastPart ? { kind: "motivation" } : { kind: "intro", part: phase.part + 1 })}
            className="mt-5 w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
          >
            继续 →
          </button>
        </div>
      </div>
    );
  }

  /* ---------- 学习状态单选 ---------- */
  if (phase.kind === "motivation") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {header}
        <div className="paper-card p-4 sm:p-5">
          <div className="mono text-[11px] tracking-wider text-olive-mute">轻松的一步 · 约 1 分钟</div>
          <h4 className="mt-1.5 text-[15px] font-bold text-olive">学习状态单选：最像你最近的状态（只选一项）</h4>
          <div className="mt-3 grid gap-2.5">
            {motivationOptions.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setMotivation(o.key)}
                className={`rounded-2xl border px-4 py-3 text-left text-[14.5px] leading-relaxed transition-colors ${
                  motivation === o.key
                    ? "border-lime bg-lime-pale font-medium text-olive"
                    : "border-border bg-cream text-olive-soft hover:border-[#E3B53A]/60"
                }`}
              >
                <span className="mono mr-2 text-[12px] font-bold text-olive-mute">{o.key}</span>
                <span className="mr-2 font-semibold">{o.label}</span>
                {o.text}
              </button>
            ))}
          </div>
          <button
            disabled={!motivation}
            onClick={() => setPhase({ kind: "life" })}
            className="mt-4 w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
          >
            继续 →（生活事件快扫，约 1 分钟）
          </button>
        </div>
      </div>
    );
  }

  /* ---------- 七、生活事件快扫 ---------- */
  if (phase.kind === "life") {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {header}
        <div className="paper-card p-4 sm:p-5">
          <div className="mono text-[11px] tracking-wider text-olive-mute">六、生活事件快扫（过去 3 个月）· 约 1 分钟</div>
          <div className="mt-3 divide-y divide-border">
            {lifeEventItems.map((e, i) => (
              <div key={e.no} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-[14px] text-olive">{e.text}</span>
                <div className="flex gap-1.5">
                  {EVENT_HINTS.map((h, v) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setLifeEvents((arr) => arr.map((x, j) => (j === i ? v : x)))}
                      className={`rounded-full border px-3 py-1 text-[12.5px] transition-colors ${
                        lifeEvents[i] === v
                          ? v === 0
                            ? "border-lime bg-lime-pale font-medium text-olive"
                            : "border-butter bg-butter/70 font-medium text-olive"
                          : "border-border bg-cream text-olive-mute hover:border-[#E3B53A]/60"
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => setPhase({ kind: "open" })}
            className="mt-5 w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
          >
            继续 →（最后一步，可留空）
          </button>
        </div>
      </div>
    );
  }

  /* ---------- 八、开放题 + 提交 ---------- */
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {header}
      <div className="paper-card p-4 sm:p-5">
        <div className="mono text-[11px] tracking-wider text-olive-mute">七、最后，想和我说点什么？· 约 2 分钟，可留空</div>
        <div className="mt-3 space-y-4">
          {openQuestions.map((qq, i) => (
            <div key={qq}>
              <label className="text-[13.5px] text-olive-soft">{qq}</label>
              <textarea
                value={openAnswers[i]}
                onChange={(e) => setOpenAnswers((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                rows={2}
                maxLength={2000}
                placeholder="想到什么写什么，不写也没关系"
                className="mt-1.5 w-full resize-none rounded-xl border border-input bg-cream px-4 py-2.5 text-[14.5px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="paper-card p-4 sm:p-5">
        <button
          disabled={!ready || submit.isPending}
          onClick={() =>
            submit.mutate({
              kind: "e3",
              answers: {
                stage,
                ratings: ratings.map((r) => r ?? 3),
                motivation: motivation ?? "C",
                subjects: [],
                lossReasons: [],
                scoreTrend: "",
                lifeEvents,
                openAnswers,
              },
            } as never)
          }
          className="w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-50"
        >
          {submit.isPending
            ? "正在生成诊断…"
            : ready
              ? "看看我的诊断结果 →"
              : `还有 ${E3V37_RATING_COUNT - answeredCount} 题评分${motivation ? "" : "、状态单选"}没完成`}
        </button>
        {submit.isError && <p className="mt-2 text-center text-[13px] text-terra">提交没成功，再点一次试试。</p>}
      </div>
    </div>
  );
}
