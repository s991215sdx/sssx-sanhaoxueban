import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { trpc } from "@/providers/trpc";
import { clearQuizDraft, loadQuizDraft, useDraftResumed, useDraftState } from "@/lib/quizDraft";
import { useAuth } from "@/hooks/useAuth";
import {
  E3V37_QUESTIONS,
  E3V37_SCAN_SUBJECTS,
  E3V37_LIFE_EVENTS,
  E3V37_LOSS_REASONS,
  E3V37_SCORE_TRENDS,
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
const LEVEL_COLOR: Record<string, string> = { 卡点: "#b91c1c", 待提升: "#c7a23a", 正常: "#5a9326" };

/** 学科快扫一行（V3.7）：喜欢/掌握/发挥 0-5（0=未开设）+ 最近大考成绩 + 排名 + 最薄弱环节。 */
type SubjectRow = {
  name: string;
  liking: number;
  mastery: number;
  exam: number;
  lastScore: number | null;
  fullScore: number | null;
  rank: string;
  weakest: string;
};

const emptySubject = (name: string): SubjectRow => ({
  name,
  liking: 0,
  mastery: 0,
  exam: 0,
  lastScore: null,
  fullScore: null,
  rank: "",
  weakest: "",
});

/** 高中选科：首选（物理/历史，圈一个）与再选（化学/生物/政治/地理，最多两科）。 */
const SENIOR_FIRST_OPTIONS = ["物理", "历史"] as const;
const SENIOR_SECOND_OPTIONS = ["化学", "生物", "政治", "地理"] as const;
const SENIOR_SECOND_MAX = 2;

/** 高中 scanSubjects 中的占位行文案（非真实科目，仅提示选科）。 */
const isSeniorPlaceholder = (name: string) => name.includes("首选科目") || name.includes("再选科目");

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

/** 答题流程的阶段：部分开场 → 逐题作答 → 部分完成鼓励 → 状态单选 → 学科快扫 → 生活事件 → 开放题。 */
type Phase =
  | { kind: "intro"; part: number }
  | { kind: "quiz"; part: number; qi: number }
  | { kind: "done"; part: number }
  | { kind: "motivation" }
  | { kind: "subjects" }
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
                    stage === s ? "border-olive bg-olive text-cream" : "border-border bg-cream text-olive-soft hover:border-olive/40"
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
            className="w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
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
  const [subjects, setSubjects] = useDraftState<SubjectRow[]>(E3_DRAFT, "subjects", []);
  /** 高中选科：首选科目（"" = 未选）与再选科目（最多两科）；选中后在 subjects 里生成对应科目行。 */
  const [seniorFirst, setSeniorFirst] = useDraftState<string>(E3_DRAFT, "seniorFirst", "");
  const [seniorSecond, setSeniorSecond] = useDraftState<string[]>(E3_DRAFT, "seniorSecond", []);
  const [lossReasons, setLossReasons] = useDraftState<string[]>(E3_DRAFT, "lossReasons", []);
  const [scoreTrend, setScoreTrend] = useDraftState<string>(E3_DRAFT, "scoreTrend", "");
  const [lifeEvents, setLifeEvents] = useDraftState<number[]>(E3_DRAFT, "lifeEvents", () => Array(8).fill(0));
  const [openAnswers, setOpenAnswers] = useDraftState<string[]>(E3_DRAFT, "openAnswers", ["", "", ""]);
  const [subjectsInit, setSubjectsInit] = useDraftState<boolean>(
    E3_DRAFT,
    "subjectsInit",
    () => ((loadQuizDraft(user?.id, E3_DRAFT)?.subjects as unknown[] | undefined)?.length ?? 0) > 0,
  );
  const [phase, setPhase] = useDraftState<Phase>(E3_DRAFT, "phase", { kind: "intro", part: 0 });
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
    setSubjects([]);
    setLossReasons([]);
    setScoreTrend("");
    setLifeEvents(Array(8).fill(0));
    setOpenAnswers(["", "", ""]);
    setSubjectsInit(false);
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
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lime-pale text-[22px] font-bold text-[#5a9326]">✓</div>
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
    scanSubjects?: string[];
    lossReasons?: readonly string[];
    scoreTrends?: readonly string[];
    lifeEvents?: { no: number; kp: string; text: string }[];
    openQuestions?: string[];
  };
  const stage: E3V37Stage = q.stage === "primary" || q.stage === "senior" ? q.stage : "junior";
  const stageLabel = q.stageLabel ?? (stage === "primary" ? "小学版" : stage === "senior" ? "高中版" : "初中版");
  const ratingQuestions = Array.isArray(q.ratings) && q.ratings.length > 0 ? q.ratings : E3V37_QUESTIONS[stage];
  const motivationOptions = q.motivationOptions ?? E3V37_MOTIVATION_OPTIONS;
  const scanSubjects = q.scanSubjects ?? E3V37_SCAN_SUBJECTS[stage];
  const lossReasonOptions = q.lossReasons ?? E3V37_LOSS_REASONS;
  const scoreTrendOptions = q.scoreTrends ?? E3V37_SCORE_TRENDS;
  const lifeEventItems = q.lifeEvents ?? E3V37_LIFE_EVENTS[stage];
  const openQuestions = q.openQuestions ?? E3V37_OPEN_QUESTIONS;

  // 按学段初始化学科快扫行（高中不生成「首选/再选」占位行，选科通过点选 chips 完成）
  if (!subjectsInit) {
    setSubjectsInit(true);
    setSubjects(
      scanSubjects.filter((name) => !(stage === "senior" && isSeniorPlaceholder(name))).map((name) => emptySubject(name)),
    );
  }

  // 高中：清掉旧草稿遗留的「首选/再选」占位行（旧版为自由文本输入，已改为点选选科）
  if (stage === "senior" && subjects.some((s) => isSeniorPlaceholder(s.name))) {
    setSubjects(subjects.filter((s) => !isSeniorPlaceholder(s.name)));
  }

  const setSubject = (i: number, patch: Partial<SubjectRow>) =>
    setSubjects((arr) => arr.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  /** 高中：由选科 chips 托管的科目名（首选/再选），不作为普通固定行渲染。 */
  const seniorManaged = (name: string) =>
    stage === "senior" &&
    ((SENIOR_FIRST_OPTIONS as readonly string[]).includes(name) ||
      (SENIOR_SECOND_OPTIONS as readonly string[]).includes(name));

  /** 高中首选科目单选：选中后生成该科目行（插在固定科目之后）；换选则替换旧行。 */
  const pickSeniorFirst = (name: string) => {
    if (name === seniorFirst) return;
    setSeniorFirst(name);
    setSubjects((arr) => {
      const without = arr.filter((s) => !(SENIOR_FIRST_OPTIONS as readonly string[]).includes(s.name));
      const fixedCount = scanSubjects.filter((n) => !isSeniorPlaceholder(n)).length;
      return [...without.slice(0, fixedCount), emptySubject(name), ...without.slice(fixedCount)];
    });
  };

  /** 高中再选科目（最多 2 科）：选中生成独立科目行；取消选中直接移除对应行。 */
  const toggleSeniorSecond = (name: string) => {
    if (seniorSecond.includes(name)) {
      setSeniorSecond(seniorSecond.filter((x) => x !== name));
      setSubjects((arr) => arr.filter((s) => s.name !== name));
      return;
    }
    if (seniorSecond.length >= SENIOR_SECOND_MAX) return;
    setSeniorSecond([...seniorSecond, name]);
    setSubjects((arr) => (arr.some((s) => s.name === name) ? arr : [...arr, emptySubject(name)]));
  };

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
            className="mt-5 w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
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
                    sel ? "border-olive bg-olive text-cream" : "border-border bg-cream text-olive-soft hover:border-lime"
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
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lime-pale text-[22px] font-bold text-[#5a9326]">✓</div>
          <h3 className="mt-3 text-[17px] font-bold text-olive">{part.praise}</h3>
          <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-olive-soft">
            {isLastPart
              ? "接下来是「学习状态单选」，只选一项，约 1 分钟。"
              : `可以喝口水休息一下。准备好了就进入下一部分：${next!.title}，${next!.minutes}。`}
          </p>
          <button
            onClick={() => setPhase(isLastPart ? { kind: "motivation" } : { kind: "intro", part: phase.part + 1 })}
            className="mt-5 w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
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
                    : "border-border bg-cream text-olive-soft hover:border-lime/60"
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
            onClick={() => setPhase({ kind: "subjects" })}
            className="mt-4 w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
          >
            继续 →（学科快扫，约 3 分钟）
          </button>
        </div>
      </div>
    );
  }

  /* ---------- 六、学科快速扫描 ---------- */
  if (phase.kind === "subjects") {
    const numInputCls =
      "w-full rounded-lg border border-input bg-cream px-2.5 py-1.5 text-[13px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime";
    const chipCls = (active: boolean, disabled = false) =>
      `rounded-full border px-4 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? "border-olive bg-olive text-cream"
          : disabled
            ? "border-border bg-cream text-olive-mute/50"
            : "border-border bg-cream text-olive-soft hover:border-lime/60"
      }`;

    /** 单个科目行。fixedName=true 时科目名只读（高中选科生成的行）。 */
    const renderSubjectRow = (s: SubjectRow, i: number, fixedName = false) => {
      const closed = s.liking === 0 && s.mastery === 0 && s.exam === 0;
      // 学生自行添加的行（无对应固定科目名）允许自填科目名
      const srcName = scanSubjects[i];
      const editable = !fixedName && (srcName == null || srcName.includes("其他"));
      return (
        <div key={`sub-${i}`} className="rounded-2xl border border-border bg-cream/50 p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            {editable ? (
              <input
                value={s.name}
                onChange={(e) => setSubject(i, { name: e.target.value })}
                placeholder="填写科目名"
                maxLength={32}
                className="w-44 rounded-lg border border-input bg-cream px-3 py-1.5 text-[14px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime"
              />
            ) : (
              <span className="text-[14.5px] font-semibold text-olive">{s.name}</span>
            )}
            <button
              type="button"
              onClick={() =>
                setSubject(
                  i,
                  closed
                    ? { liking: 3, mastery: 3, exam: 3 }
                    : { liking: 0, mastery: 0, exam: 0, weakest: "" },
                )
              }
              className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                closed ? "border-terra/50 bg-[#fbe3df] text-[#b91c1c]" : "border-border bg-cream text-olive-mute hover:border-lime/60"
              }`}
            >
              {closed ? "未开设 · 点击恢复" : "未开设"}
            </button>
          </div>
          {!closed && (
            <>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["liking", "喜欢程度"],
                    ["mastery", "掌握程度"],
                    ["exam", "考试发挥"],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field} className="flex items-center justify-between gap-2">
                    <span className="text-[12.5px] text-olive-soft">{label}</span>
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setSubject(i, { [field]: v })}
                          className={`h-6 w-6 rounded-full border-2 text-[11px] transition-colors ${
                            s[field] === v ? "border-olive bg-olive text-cream" : "border-border bg-cream text-olive-mute hover:border-lime"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input
                  value={s.rank}
                  onChange={(e) => setSubject(i, { rank: e.target.value })}
                  placeholder="排名（可空）：年级人数/排名，如 480/120"
                  maxLength={32}
                  className={numInputCls}
                />
                <input
                  value={s.weakest}
                  onChange={(e) => setSubject(i, { weakest: e.target.value })}
                  placeholder="最薄弱环节（章节、题型或原因），可留空"
                  maxLength={200}
                  className={numInputCls}
                />
              </div>
            </>
          )}
        </div>
      );
    };

    // 高中：选科托管行（首选/再选）不在普通列表里渲染，由下方选科块负责
    const seniorMode = stage === "senior";
    const plainRows = subjects
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => !seniorManaged(s.name) && !isSeniorPlaceholder(s.name));
    const firstIdx = seniorFirst ? subjects.findIndex((s) => s.name === seniorFirst) : -1;

    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {header}
        <div className="paper-card p-4 sm:p-5">
          <div className="mono text-[11px] tracking-wider text-olive-mute">六、学科快速扫描 · 约 3 分钟</div>
          <p className="mt-1 text-[12.5px] text-olive-mute">
            1=很差，3=一般，5=很好；没有开设的科目点「未开设」，排名记不清可以留空。
          </p>
          <p className="mt-1 text-[12px] text-olive-mute/90">
            小提示：各科成绩与目标在「个人中心 · 成绩与目标」里填写，这里不用重复填。
          </p>
          <div className="mt-3 space-y-4">
            {plainRows.map(({ s, i }) => renderSubjectRow(s, i))}

            {seniorMode && (
              <>
                {/* 首选科目：物理/历史 圈一个，圈完再对这一科打分 */}
                <div className="rounded-2xl border border-border bg-cream/50 p-3.5 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[14.5px] font-semibold text-olive">
                      首选科目{seniorFirst ? `：${seniorFirst}` : ""}
                    </span>
                    <div className="flex gap-2">
                      {SENIOR_FIRST_OPTIONS.map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => pickSeniorFirst(name)}
                          className={chipCls(seniorFirst === name)}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                  {!seniorFirst && (
                    <p className="mt-2 text-[12.5px] text-olive-mute">先圈一个首选科目（物理/历史），再对这一科打分。</p>
                  )}
                </div>
                {seniorFirst && firstIdx >= 0 && renderSubjectRow(subjects[firstIdx], firstIdx, true)}

                {/* 再选科目：化学/生物/政治/地理 最多选两科，每科一行独立打分 */}
                <div className="rounded-2xl border border-border bg-cream/50 p-3.5 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[14.5px] font-semibold text-olive">
                      再选科目{seniorSecond.length > 0 ? `：${seniorSecond.join("、")}` : ""}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {SENIOR_SECOND_OPTIONS.map((name) => {
                        const active = seniorSecond.includes(name);
                        const disabled = !active && seniorSecond.length >= SENIOR_SECOND_MAX;
                        return (
                          <button
                            key={name}
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleSeniorSecond(name)}
                            className={chipCls(active, disabled)}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <p className="mt-2 text-[12.5px] text-olive-mute">
                    {seniorSecond.length === 0
                      ? "最多选 2 科；每选一科会生成一个独立科目行，分别打分。"
                      : seniorSecond.length < SENIOR_SECOND_MAX
                        ? "还可以再选 1 科；再点已选科目可取消（该科的打分会一并移除）。"
                        : "已选满 2 科；再点已选科目可取消（该科的打分会一并移除）。"}
                  </p>
                </div>
                {seniorSecond.map((name) => {
                  const i = subjects.findIndex((s) => s.name === name);
                  return i >= 0 ? renderSubjectRow(subjects[i], i, true) : null;
                })}
              </>
            )}

            <button
              type="button"
              onClick={() => setSubjects((arr) => [...arr, { ...emptySubject(""), liking: 3, mastery: 3, exam: 3 }])}
              className="text-[13px] text-olive-mute underline hover:text-olive"
            >
              + 添加其他科目
            </button>
          </div>

          <div className="mt-4">
            <h4 className="text-[14px] font-bold text-olive">考试失分主因（可多选）</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {lossReasonOptions.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() =>
                    setLossReasons((arr) => (arr.includes(r) ? arr.filter((x) => x !== r) : [...arr, r]))
                  }
                  className={`rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${
                    lossReasons.includes(r)
                      ? "border-lime bg-lime-pale font-medium text-olive"
                      : "border-border bg-cream text-olive-mute hover:border-lime/60"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <h4 className="text-[14px] font-bold text-olive">成绩趋势</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {scoreTrendOptions.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setScoreTrend(t)}
                  className={`rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${
                    scoreTrend === t
                      ? "border-lime bg-lime-pale font-medium text-olive"
                      : "border-border bg-cream text-olive-mute hover:border-lime/60"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setPhase({ kind: "life" })}
            className="mt-5 w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
          >
            继续 →（生活事件，约 1 分钟）
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
          <div className="mono text-[11px] tracking-wider text-olive-mute">七、生活事件快扫（过去 3 个月）· 约 1 分钟</div>
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
                          : "border-border bg-cream text-olive-mute hover:border-lime/60"
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
            className="mt-5 w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
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
        <div className="mono text-[11px] tracking-wider text-olive-mute">八、最后，想和我说点什么？· 约 2 分钟，可留空</div>
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
                subjects: subjects
                  .filter((s) => s.name.trim())
                  .map((s) => ({
                    name: s.name.trim(),
                    liking: s.liking,
                    mastery: s.mastery,
                    exam: s.exam,
                    lastScore: null,
                    fullScore: null,
                    rank: s.rank.trim(),
                    weakest: s.weakest.trim(),
                  })),
                lossReasons,
                scoreTrend,
                lifeEvents,
                openAnswers,
              },
            } as never)
          }
          className="w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-50"
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
