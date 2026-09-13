import { useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { MasteryBar, scoreColor, scoreLabel } from "@/components/ScoreRing";
import { STAGES, STAGE_GRADES, GRADES } from "@contracts/constants";
import { ChevronRight, GraduationCap, Hammer } from "lucide-react";

const STEPS = ["先备检测", "精讲学习", "小试牛刀", "讲给 AI 听", "课堂提问清单"];

export default function PreviewList() {
  const { data: chapters, isLoading, error, refetch } = trpc.graph.overview.useQuery(
    { withEmpty: true, allGrades: true },
    {
      retry: 6,
      retryDelay: 3000,
      refetchOnMount: "always", // 预习完返回时强制刷新，避免「已预习仍显示未开始」
    },
  );
  const { data: profile } = trpc.profile.get.useQuery();
  const [picked, setPicked] = useState<string | null>(null);
  const [pickedSubject, setPickedSubject] = useState<string | null>(null);
  // 默认跟学生档案年级；档案缺失或历史非规范值时回退初一
  const profileGrade = profile?.grade && GRADES.includes(profile.grade) ? profile.grade : "初一";
  const grade = picked ?? profileGrade;

  // 该年级已有的学科列表（按章节数据推导），默认选数学（无数学则第一个学科）
  const gradeChapters = chapters?.filter((ch) => ch.grade === grade);
  const subjects = [...new Set((gradeChapters ?? []).map((ch) => ch.subject))];
  const subject = pickedSubject && subjects.includes(pickedSubject) ? pickedSubject : subjects.includes("数学") ? "数学" : subjects[0];
  const shown = gradeChapters?.filter((ch) => ch.subject === subject);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-olive">预习中心</h1>
        <p className="mt-1 text-[15px] text-olive-soft">
          人教版 · 覆盖小学到高中。每次预习 25 分钟，走完五步，带着问题去上课。
        </p>
      </div>

      {/* 年级选择器 */}
      <div className="paper-card space-y-2.5 p-4">
        {STAGES.map((s) => (
          <div key={s} className="flex flex-wrap items-center gap-2">
            <span className="mono w-8 shrink-0 text-[11px] tracking-wider text-olive-mute">{s}</span>
            {STAGE_GRADES[s].map((g) => (
              <button
                key={g}
                onClick={() => setPicked(g)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  grade === g
                    ? "bg-olive text-cream"
                    : "bg-lime-pale/60 text-olive-soft hover:bg-lime-pale"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* 学科选择器（该年级有内容的学科才出现） */}
      {subjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {subjects.map((s) => (
            <button
              key={s}
              onClick={() => setPickedSubject(s)}
              className={`rounded-full px-4 py-1.5 text-[13.5px] font-medium transition-colors ${
                subject === s ? "bg-lime text-white" : "bg-lime-pale/60 text-olive-soft hover:bg-lime-pale"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* 五步流程 */}
      <div className="paper-card flex flex-wrap items-center gap-x-1 gap-y-2 p-4">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <span className="flex items-center gap-2 rounded-full bg-lime-pale/70 px-3 py-1.5">
              <span className="mono flex h-5 w-5 items-center justify-center rounded-full bg-olive text-[11px] font-bold text-cream">
                {i + 1}
              </span>
              <span className="text-[13px] font-medium text-olive">{s}</span>
            </span>
            {i < STEPS.length - 1 && <ChevronRight size={14} className="mx-1 text-olive-mute" />}
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
          <p className="mono text-xs text-olive-mute">首次启动正在准备题库，约需半分钟…</p>
        </div>
      )}
      {error && (
        <div className="paper-card accent-l border-terra p-6">
          <p className="font-semibold text-olive">题库暂时连不上</p>
          <p className="mt-1 text-sm text-olive-mute">服务正在初始化，请稍候重试。</p>
          <button onClick={() => refetch()} className="mt-3 rounded-xl bg-olive px-4 py-2 text-sm font-medium text-cream">
            重新加载
          </button>
        </div>
      )}

      {shown?.length === 0 && (
        <div className="paper-card p-6 text-center text-sm text-olive-mute">该年级目录整理中。</div>
      )}

      {shown?.map((ch) => (
        <section key={`${ch.grade}-${ch.name}`}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-bold text-olive">{ch.name}</h2>
            <span className="mono text-xs" style={{ color: scoreColor(ch.avg) }}>
              章节均分 {ch.avg}
            </span>
          </div>
          <div className="space-y-2.5">
            {ch.kps.map((kp) => {
              if (!kp.hasContent) {
                // 骨架占位：精讲/题库第二期填充，禁止进入学习流
                return (
                  <div
                    key={kp.id}
                    className="paper-card flex items-center gap-4 p-4 opacity-70"
                  >
                    <div className="mono hidden w-14 shrink-0 text-[11px] leading-tight text-olive-mute sm:block">
                      {kp.code}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15.5px] font-semibold text-olive-soft">{kp.title}</span>
                        <span className="chip !border-0 bg-butter/60 !text-[11px] text-olive-soft">
                          精讲内容建设中
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-xl bg-olive-mute/40 px-3.5 py-2 text-sm font-medium text-cream">
                      <Hammer size={15} />
                      建设中
                    </div>
                  </div>
                );
              }
              const state = scoreLabel(kp.score);
              return (
                <Link
                  key={kp.id}
                  to={`/preview/${kp.code}`}
                  className="paper-card group flex items-center gap-4 p-4 transition-transform hover:-translate-y-0.5"
                >
                  <div className="mono hidden w-14 shrink-0 text-[11px] leading-tight text-olive-mute sm:block">
                    {kp.code}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15.5px] font-semibold text-olive">{kp.title}</span>
                      {/* 预习过但还没做题（score=0）时不显示「未开始」，用「已预习」更贴切 */}
                      {!(kp.previewed && kp.score === 0) && (
                        <span
                          className="chip !border-0 !text-[11px]"
                          style={{ backgroundColor: `${scoreColor(kp.score)}22`, color: scoreColor(kp.score) }}
                        >
                          {state}
                        </span>
                      )}
                      {kp.previewed && kp.score < 60 && (
                        <span className="chip !border-0 bg-lime !text-[11px] text-white">已预习</span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <MasteryBar score={kp.score} className="max-w-48" />
                      <span className="mono text-xs text-olive-mute">{kp.score}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-olive px-3.5 py-2 text-sm font-medium text-cream transition-colors group-hover:bg-lime">
                    <GraduationCap size={15} />
                    预习
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
