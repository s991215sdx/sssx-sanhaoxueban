import { lazy, Suspense, useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { MasteryBar, scoreLabel, scoreColor } from "@/components/ScoreRing";
import OmniBox from "@/components/OmniBox";
import PrescriptionsCard from "@/components/PrescriptionsCard";
import {
  Flame,
  AlarmClock,
  BookOpenCheck,
  ArrowRight,
  Sparkles,
  CalendarCheck,
  HeartHandshake,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import { BANDS, PLAN_KIND_LABELS, type PlanKind } from "@contracts/content";

const DashboardCharts = lazy(() => import("@/components/DashboardCharts"));

function greeting() {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

const MINUTE_OPTIONS = [20, 40, 60, 90];

const KIND_CHIP_COLORS: Record<PlanKind, string> = {
  review: "#556339",
  band1: BANDS[0].color,
  band2: BANDS[1].color,
  band3: BANDS[2].color,
  preview: "#7cb83c",
  feynman: "#7cb83c",
  rest: "#c7a23a",
};

/* ------------------------------- 今日计划 ------------------------------- */

function TodayPlan() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.plan.today.useQuery();
  const { data: suggest } = trpc.plan.suggest.useQuery();
  const [minutes, setMinutes] = useState<number | null>(null);
  const [explanation, setExplanation] = useState<string[]>([]);
  const [whyOpen, setWhyOpen] = useState(false);

  const generate = trpc.plan.generate.useMutation({
    onSuccess: (d) => {
      setExplanation(d.explanation);
      setWhyOpen(true);
      utils.plan.today.invalidate();
    },
  });
  const toggle = trpc.plan.toggleItem.useMutation({
    onSuccess: () => utils.plan.today.invalidate(),
  });

  const plan = data?.plan ?? null;
  // 默认采用智能建议时长（基于查漏情况推算），其次档案时长
  const effectiveMinutes = minutes ?? suggest?.suggestedMinutes ?? data?.minutes ?? 45;
  const doneCount = plan?.items.filter((i) => i.done).length ?? 0;
  // 分钟选项：把智能建议值并入快选
  const minuteOptions = [...new Set([...(suggest ? [suggest.suggestedMinutes] : []), ...MINUTE_OPTIONS])].sort((a, b) => a - b);
  // 「为什么这样安排」：优先展示本次生成的解释，否则展示智能建议的依据
  const whyLines = explanation.length > 0 ? explanation : (suggest?.reasons ?? []);

  return (
    <div className="paper-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarCheck size={18} className="text-lime" />
          <h2 className="font-bold text-olive">今日计划</h2>
          {plan && (
            <span className="mono text-xs text-olive-mute">
              {doneCount}/{plan.items.length} 已完成
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-olive-mute">今天有</span>
          {minuteOptions.map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              className={`mono relative rounded-full border px-3 py-1 text-[13px] font-medium transition-colors ${
                effectiveMinutes === m
                  ? "border-olive bg-olive text-cream"
                  : "border-border bg-cream text-olive-soft hover:border-olive/40"
              }`}
            >
              {m}分钟
              {suggest && m === suggest.suggestedMinutes && (
                <span className="absolute -right-1.5 -top-1.5 rounded-full bg-terra px-1 text-[9px] font-bold leading-4 text-white">
                  荐
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => generate.mutate({ minutes: effectiveMinutes })}
            disabled={generate.isPending}
            className="rounded-full bg-lime px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-lime-light disabled:opacity-50"
          >
            {generate.isPending ? "规划中…" : plan ? "重新生成" : "按建议生成安排"}
          </button>
        </div>
      </div>

      {/* 学习时长建议：基于查漏情况推算「今天学多久 + 每次学多久」 */}
      {suggest && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-butter/40 px-3.5 py-2.5 text-[13px] text-olive">
          <AlarmClock size={14} className="shrink-0 text-terra" />
          <span>
            据今天的查漏情况，建议学 <b className="mono">{suggest.suggestedMinutes}</b> 分钟：分{" "}
            <b className="mono">{suggest.sessions}</b> 段，每次专注 <b className="mono">{suggest.sessionMinutes}</b>{" "}
            分钟、休息 <b className="mono">{suggest.breakMinutes}</b> 分钟。
          </span>
          {(suggest.load.due > 0 || suggest.load.band1 > 0 || suggest.load.band2 > 0 || suggest.load.band3 > 0) && (
            <span className="mono text-xs text-olive-mute">
              （到期复习 {suggest.load.due} · 送分区 {suggest.load.band1} · 提分区 {suggest.load.band2} · 攻坚区{" "}
              {suggest.load.band3}）
            </span>
          )}
        </div>
      )}

      {isLoading && (
        <div className="mt-4 flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-lime border-t-transparent" />
        </div>
      )}

      {!isLoading && !plan && (
        <div className="mt-3">
          <p className="text-[14px] text-olive-mute">
            还没有今天的安排——点「按建议生成安排」，学伴会按「复习 → 抢分 → 预习」的顺序帮你排好每一段时间。
          </p>
          {whyLines.length > 0 && (
            <ul className="mt-2 space-y-1.5 rounded-xl bg-lime-pale/50 p-4">
              {whyLines.map((e, i) => (
                <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-olive-soft">
                  <span className="mono shrink-0 text-olive-mute">{i + 1}.</span>
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {plan && (
        <>
          {plan.note && (
            <p className="accent-l border-butter mt-3 text-[13px] leading-relaxed text-olive-soft">{plan.note}</p>
          )}
          <div className="mt-4 space-y-2">
            {plan.items.map((item, i) => {
              const kind = item.kind as PlanKind;
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-cream/60 px-3.5 py-2.5">
                  <button
                    aria-label={item.done ? "取消完成" : "标记完成"}
                    onClick={() => toggle.mutate({ date: plan.date, index: i, done: !item.done })}
                    disabled={toggle.isPending}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      item.done ? "border-lime bg-lime text-white" : "border-olive-mute/50 bg-cream-card hover:border-lime"
                    }`}
                  >
                    {item.done && <Check size={13} strokeWidth={3} />}
                  </button>
                  <span
                    className="chip shrink-0 !border-0 !text-[10.5px]"
                    style={{ backgroundColor: `${KIND_CHIP_COLORS[kind] ?? "#8b9468"}1f`, color: KIND_CHIP_COLORS[kind] ?? "#8b9468" }}
                  >
                    {PLAN_KIND_LABELS[kind] ?? item.kind}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate text-[14px] ${
                      item.done ? "text-olive-mute line-through" : "text-olive"
                    }`}
                  >
                    {item.title}
                  </span>
                  <span className="mono shrink-0 text-xs text-olive-mute">{item.minutes}min</span>
                </div>
              );
            })}
          </div>

          {whyLines.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setWhyOpen((o) => !o)}
                className="flex items-center gap-1 text-[13px] font-medium text-olive-soft hover:text-olive"
              >
                为什么这样安排
                {whyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {whyOpen && (
                <ul className="mt-2 space-y-1.5 rounded-xl bg-lime-pale/50 p-4">
                  {whyLines.map((e, i) => (
                    <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-olive-soft">
                      <span className="mono shrink-0 text-olive-mute">{i + 1}.</span>
                      {e}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------- 心情小条 ------------------------------- */

function MoodStrip() {
  const { data: mood } = trpc.treehole.todayMood.useQuery();
  if (!mood) return null;

  if (mood.count === 0 || mood.avg === null) {
    return (
      <Link
        to="/treehole"
        className="paper-card flex items-center gap-3 border-butter bg-butter/25 px-5 py-3.5 transition-transform hover:-translate-y-0.5"
      >
        <HeartHandshake size={18} className="shrink-0 text-terra" />
        <span className="text-[14px] text-olive">今天感觉如何？去树洞说一句，学伴会回你。</span>
        <ArrowRight size={15} className="ml-auto shrink-0 text-olive-mute" />
      </Link>
    );
  }
  if (mood.avg <= 2) {
    return (
      <div className="paper-card flex items-center gap-3 border-butter bg-butter/25 px-5 py-3.5">
        <HeartHandshake size={18} className="shrink-0 text-terra" />
        <span className="text-[14px] text-olive">
          看到你今天心情有点低落，今日计划已为你减量，先照顾好自己。
        </span>
      </div>
    );
  }
  return null;
}

/* ------------------------------ 图表骨架屏 ------------------------------ */

function ChartsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="paper-card animate-pulse p-5 lg:col-span-3">
        <div className="h-5 w-28 rounded bg-lime-pale" />
        <div className="mt-2 h-64 rounded-xl bg-lime-pale/60" />
      </div>
      <div className="paper-card animate-pulse p-5 lg:col-span-2">
        <div className="h-5 w-24 rounded bg-lime-pale" />
        <div className="mt-2 h-44 rounded-xl bg-lime-pale/60" />
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="mx-auto h-8 w-14 rounded bg-lime-pale/60" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- 页面 --------------------------------- */

export default function Dashboard() {
  const { data, isLoading, error, refetch } = trpc.dashboard.summary.useQuery(undefined, {
    retry: 6,
    retryDelay: 3000,
  });
  const { data: chapters } = trpc.graph.overview.useQuery(undefined, { retry: 6, retryDelay: 3000 });

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        <p className="mono text-sm text-olive-mute">正在唤醒学伴…</p>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="paper-card accent-l border-terra mx-auto mt-16 max-w-md p-6">
        <p className="font-semibold text-olive">数据暂时连不上</p>
        <p className="mt-1 text-sm text-olive-mute">首次启动需要初始化题库，稍等片刻再试。</p>
        <button onClick={() => refetch()} className="mt-4 rounded-xl bg-olive px-5 py-2.5 text-sm font-medium text-cream">
          重新加载
        </button>
      </div>
    );
  }

  const today = new Date();
  const dateStr = `${today.getMonth() + 1}月${today.getDate()}日 ${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][today.getDay()]}`;

  return (
    <div className="space-y-6">
      {/* 问候区 */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mono text-xs tracking-widest text-olive-mute">{dateStr}</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-olive">
            {greeting()}，同学！
          </h1>
          <p className="mt-1.5 text-[15px] text-olive-soft">今天也是「会学习」的一天，从两个小任务开始。</p>
        </div>
        <div className="chip !px-3.5 !py-1.5 !text-sm text-olive">
          <Flame size={15} className="text-terra" />
          连续学习 <span className="mono font-bold">{data.streak}</span> 天
        </div>
      </div>

      {/* 全能伴学入口：像大模型一样，说 / 拍都行 */}
      <OmniBox />

      {/* 心情小条 */}
      <MoodStrip />

      {/* V61：伴学处方（伴学师开方推送） */}
      <PrescriptionsCard />

      {/* 今日计划 */}
      <TodayPlan />

      {/* 今日任务 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/gaps"
          className="paper-card group relative overflow-hidden p-5 transition-transform hover:-translate-y-0.5"
        >
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-butter/50" />
          <div className="flex items-center gap-2 text-olive">
            <AlarmClock size={18} className="text-terra" />
            <span className="mono text-xs tracking-wider text-olive-mute">间隔复习 · 防遗忘</span>
          </div>
          <div className="mt-3 text-2xl font-bold text-olive">
            {data.reviewDue > 0 ? (
              <>
                <span className="mono">{data.reviewDue}</span> 道复习题到期
              </>
            ) : (
              "复习队列已清空"
            )}
          </div>
          <p className="mt-1 text-sm text-olive-mute">
            {data.reviewDue > 0 ? "遗忘曲线说：现在复习刚刚好" : "今天的复习任务完成啦"}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-olive group-hover:gap-2 transition-all">
            {data.reviewDue > 0 ? "去复习" : "看看错题本"} <ArrowRight size={15} />
          </span>
        </Link>

        <Link
          to="/preview"
          className="paper-card group relative overflow-hidden p-5 transition-transform hover:-translate-y-0.5"
        >
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-lime-pale" />
          <div className="flex items-center gap-2 text-olive">
            <BookOpenCheck size={18} className="text-lime" />
            <span className="mono text-xs tracking-wider text-olive-mute">高效预习 · 带问题上课</span>
          </div>
          {data.suggestedKp ? (
            <>
              <div className="mt-3 text-2xl font-bold text-olive">{data.suggestedKp.title}</div>
              <p className="mt-1 text-sm text-olive-mute">{data.suggestedKp.chapter} · 建议今天预习</p>
            </>
          ) : (
            <>
              <div className="mt-3 text-2xl font-bold text-olive">全部知识点都掌握啦</div>
              <p className="mt-1 text-sm text-olive-mute">可以去错题本巩固，或等新学期内容</p>
            </>
          )}
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-olive group-hover:gap-2 transition-all">
            开始 25 分钟预习 <ArrowRight size={15} />
          </span>
        </Link>
      </div>

      {/* 掌握度 + 活动（recharts 按需加载） */}
      <Suspense fallback={<ChartsSkeleton />}>
        <DashboardCharts radar={data.radar} weekly={data.weekly} stats={data.stats} />
      </Suspense>

      {/* 待巩固知识点 */}
      {chapters && (
        <div className="paper-card p-5">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-lime" />
            <h2 className="font-bold text-olive">最需要关注的 5 个知识点</h2>
          </div>
          <div className="mt-4 space-y-3">
            {chapters
              .flatMap((c) => c.kps.map((k) => ({ ...k, chapter: c.name })))
              .sort((a, b) => a.score - b.score)
              .slice(0, 5)
              .map((k, i) => (
                <Link to="/preview" key={k.id} className="flex items-center gap-3 group">
                  <span className="mono w-5 text-sm text-olive-mute">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[15px] font-medium text-olive group-hover:underline">
                        {k.title}
                      </span>
                      <span className="mono text-xs" style={{ color: scoreColor(k.score) }}>
                        {scoreLabel(k.score)}
                      </span>
                    </div>
                    <MasteryBar score={k.score} className="mt-1.5" />
                  </div>
                </Link>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
