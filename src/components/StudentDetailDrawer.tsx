import { useState } from "react";
import { trpc } from "@/providers/trpc";
import AnswerDetail from "@/components/companion/AnswerDetail";
import CoachingPlanCard from "@/components/CoachingPlanCard";
import type { AcademicsData } from "@contracts/academics";
import { defaultFullScore } from "@contracts/academics";
import { isE3V27Result } from "@contracts/assessments";
import { isE3V37Result } from "@contracts/e3v37";
import type { E3V37Result } from "@contracts/e3v37";
import { isE3V37ParentResult } from "@contracts/e3v37Parent";
import { e3v37LevelTextClass, E3V37_LEVEL_CAPTION } from "@/components/reports/e3v37Theme";
import { downloadReport, e3V37PrintHtml } from "@/lib/reportDownload";
import { X, Maximize2, Minimize2, Printer } from "lucide-react";
import {
  MbtiReportCard,
  DiscReportCard,
  MultiReportCard,
  CombinedReportCard,
} from "@/components/StudentReportCards";

/** 伴学师端 · V3.7 三阶九能概览卡：九能分数 chips + 主卡点 + 红线 + 打印。 */
function E3V37OverviewCard({ e3, studentName }: { e3: E3V37Result; studentName: string }) {
  return (
    <div className="rounded-xl border border-cream-deep bg-cream-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] font-bold text-olive">学习力诊断 · 三阶九能 V3.7（{e3.stageLabel}）</div>
        <button
          onClick={() => downloadReport("学业诊断报告（三阶九能 V3.7）", e3V37PrintHtml(e3, studentName), studentName)}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-olive px-2.5 py-1.5 text-[11.5px] font-semibold text-cream hover:bg-lime-deep"
        >
          <Printer size={12} /> 打印
        </button>
      </div>
      <p className="mt-1 text-[11px] text-olive-mute">{E3V37_LEVEL_CAPTION}</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {e3.abilities.map((a) => (
          <div key={a.key} className="rounded-lg bg-cream px-1.5 py-1.5 text-center">
            <div className="text-[10.5px] text-olive-mute">
              {a.system}·{a.label}
            </div>
            <div className={`mono text-[13px] font-bold ${e3v37LevelTextClass(a.level)}`}>{a.score}</div>
            <div className={`text-[10px] ${e3v37LevelTextClass(a.level)}`}>{a.level}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {e3.systems.condition.cells.map((c) => (
          <span key={c.key} className={`chip !text-[10.5px] ${c.level === "卡点" ? "!border-[#8f1313]/50 !bg-[#fbe3df] !text-[#8f1313]" : ""}`}>
            条件·{c.label} {c.score}
          </span>
        ))}
        {e3.aptitude.map((a) => (
          <span key={a.key} className="chip !text-[10.5px]">
            学能·{a.label} {a.score}
          </span>
        ))}
      </div>
      {e3.mainBlock && (
        <p className="mt-2 text-[12.5px] font-semibold text-[#8f1313]">
          主卡点：{e3.mainBlock.label} {e3.mainBlock.score}/5（优先干预）
        </p>
      )}
      {e3.redFlags.length > 0 && (
        <div className="mt-2 rounded-lg border border-terra/40 bg-terra/10 px-3 py-2">
          <div className="text-[11.5px] font-bold text-terra">红线提示（先照顾好状态，再谈成绩）</div>
          {e3.redFlags.map((f, i) => (
            <p key={i} className="mt-0.5 text-[11.5px] leading-relaxed text-terra">{f}</p>
          ))}
        </div>
      )}
    </div>
  );
}

type RawItem = { kind: string; answers: unknown; createdAt: Date | string };

/**
 * 学员完整详情抽屉：档案 + 学业目标 + 测评摘要（含答题明细）+ 学习数据。
 * 管理后台（source="admin"）与伴学工作台（source="coach"）共用。
 */
export default function StudentDetailDrawer({
  userId,
  source,
  onClose,
}: {
  userId: number;
  source: "admin" | "coach";
  onClose: () => void;
}) {
  const adminQ = trpc.admin.studentDetail.useQuery({ userId }, { enabled: source === "admin" });
  const coachQ = trpc.coach.studentDetail.useQuery({ userId }, { enabled: source === "coach" });
  const q = source === "admin" ? adminQ : coachQ;
  const data = q.data;
  /** 宽屏模式：电脑上默认右半屏抽屉，可一键放大到全屏阅读报告。 */
  const [wide, setWide] = useState(false);

  const rawOf = (kind: string): unknown =>
    data?.assessments?.raw?.find((r: RawItem) => r.kind === kind)?.answers ?? null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-olive/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`h-full w-full overflow-y-auto bg-cream p-5 shadow-xl transition-[max-width] ${wide ? "max-w-none" : "max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between ${wide ? "mx-auto max-w-4xl" : ""}`}>
          <h2 className="text-[17px] font-bold text-olive">学员详情</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWide((w) => !w)}
              title={wide ? "还原为半屏" : "放大到全屏"}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] text-olive-mute hover:bg-lime-pale hover:text-olive"
            >
              {wide ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              {wide ? "还原" : "全屏"}
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-olive-mute hover:bg-lime-pale hover:text-olive">
              <X size={18} />
            </button>
          </div>
        </div>

        {q.isLoading || !data ? (
          <div className="flex justify-center py-10">
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
          </div>
        ) : (
          <div className={`mt-4 space-y-4 ${wide ? "mx-auto max-w-4xl" : ""}`}>
            {/* 档案 */}
            <div className="paper-card p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-olive text-[15px] font-bold text-cream">
                  {(data.profile?.name || data.user.name || "学")[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold text-olive">
                    {data.profile?.name || data.user.name || "未命名"}
                  </div>
                  <div className="mono mt-0.5 text-[11px] text-olive-mute">
                    {[data.user.phone, data.profile?.grade, data.profile?.school, data.profile?.targetSchool && `目标：${data.profile.targetSchool}`]
                      .filter(Boolean)
                      .join(" · ") || "档案未完善"}
                  </div>
                </div>
              </div>
              <div className="mono mt-3 grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "答题", value: data.learning.attemptCount },
                  { label: "错题", value: data.learning.errorCount },
                  { label: "预习", value: data.learning.previewsDone },
                  { label: "计划", value: data.learning.planCount },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-cream px-1 py-2">
                    <div className="text-[16px] font-bold text-olive">{s.value}</div>
                    <div className="text-[10.5px] text-olive-mute">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 测评完整报告（查看 / 下载）+ 答题明细 */}
            <div className="paper-card p-4">
              <div className="mono text-[10px] tracking-wider text-olive-mute">测评报告</div>
              <div className="mt-2 space-y-3">
                {data.assessments.mbti ? (
                  <div>
                    <MbtiReportCard mbti={data.assessments.mbti} studentName={data.profile?.name || data.user.name || "学员"} />
                    <AnswerDetail kind="mbti" answers={rawOf("mbti")} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-cream-deep bg-cream/60 px-3.5 py-3 text-[13px] font-semibold text-olive">
                    MBTI 性格测评：未测
                  </div>
                )}
                {data.assessments.disc ? (
                  <div>
                    <DiscReportCard disc={data.assessments.disc} studentName={data.profile?.name || data.user.name || "学员"} />
                    <AnswerDetail kind="disc" answers={rawOf("disc")} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-cream-deep bg-cream/60 px-3.5 py-3 text-[13px] font-semibold text-olive">
                    DISC 行为风格：未测
                  </div>
                )}
                {data.assessments.e3 ? (
                  isE3V37Result(data.assessments.e3) ? (
                    <div>
                      <E3V37OverviewCard e3={data.assessments.e3} studentName={data.profile?.name || data.user.name || "学员"} />
                      <AnswerDetail kind="e3" answers={rawOf("e3")} />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#c7a23a]/60 bg-[#f5e7c1] px-3.5 py-3 text-[13px] font-semibold text-[#8a6d1a]">
                      学习力诊断（E3）：学生是旧版 V2.7 结果——学业诊断已升级为 V3.7 三阶九能版，需提醒学生重新完成一次诊断（约 16-18 分钟）。
                    </div>
                  )
                ) : (
                  <div className="rounded-xl border border-cream-deep bg-cream/60 px-3.5 py-3 text-[13px] font-semibold text-olive">
                    学习力诊断（E3 三阶九能）：未测
                  </div>
                )}
                {isE3V37ParentResult(data.assessments.optional?.e3parent) && (
                  <div className="rounded-xl border border-cream-deep bg-cream-card p-4">
                    <div className="text-[13px] font-bold text-olive">家长卷 · 认知盲区判读（V3.7）</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="chip !text-[11px]">不了解 {data.assessments.optional.e3parent.unknownCount} 项（{data.assessments.optional.e3parent.unknownLevel}）</span>
                      <span className="chip !text-[11px]">观察与孩子自评明显差异 {data.assessments.optional.e3parent.blindSpots.length} 项</span>
                      {data.assessments.optional.e3parent.overestimates.length > 0 && (
                        <span className="chip !text-[11px] text-terra">高估：{data.assessments.optional.e3parent.overestimates.map((d) => d.kp).join("、")}</span>
                      )}
                      {data.assessments.optional.e3parent.underestimates.length > 0 && (
                        <span className="chip !text-[11px] text-terra">低估：{data.assessments.optional.e3parent.underestimates.map((d) => d.kp).join("、")}</span>
                      )}
                      {data.assessments.optional.e3parent.severeConflict && (
                        <span className="chip !border-[#8f1313]/50 !bg-[#fbe3df] !text-[11px] !text-[#8f1313]">家庭近期有严重亲子冲突信号</span>
                      )}
                    </div>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-olive-soft">{data.assessments.optional.e3parent.summary}</p>
                  </div>
                )}
                {data.assessments.multi ? (
                  <div>
                    <MultiReportCard multi={data.assessments.multi} studentName={data.profile?.name || data.user.name || "学员"} />
                    <AnswerDetail kind="multi" answers={rawOf("multi")} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-cream-deep bg-cream/60 px-3.5 py-3 text-[13px] font-semibold text-olive">
                    多元智能：未测
                  </div>
                )}
                {/* 综合报告卡仅对 V3.7 e3 结果展示（V2.7 老数据上面已提示学生重测） */}
                {data.assessments.mbti && data.assessments.disc && isE3V37Result(data.assessments.e3) && (
                  <CombinedReportCard
                    mbti={data.assessments.mbti}
                    disc={data.assessments.disc}
                    e3={data.assessments.e3}
                    multi={data.assessments.multi ?? null}
                    academics={(data.academics as AcademicsData | null) ?? null}
                    optional={data.assessments.optional ?? null}
                    studentName={data.profile?.name || data.user.name || "学员"}
                  />
                )}
              </div>
            </div>

            {/* 学习力陪跑训练方案（需 E3 已完成） */}
            {data.assessments.e3 && isE3V27Result(data.assessments.e3) && (
              <CoachingPlanCard
                name={data.profile?.name || data.user.name || "学员"}
                grade={data.profile?.grade ?? null}
                e3={data.assessments.e3}
                mbti={data.assessments.mbti ?? null}
                disc={data.assessments.disc ?? null}
                multi={data.assessments.multi ?? null}
                academics={(data.academics as AcademicsData | null) ?? null}
              />
            )}

            {/* 学业目标 */}
            <div className="paper-card p-4">
              <div className="mono text-[10px] tracking-wider text-olive-mute">
                学业自评与目标{(data.academics as AcademicsData | null)?.examName ? ` · ${(data.academics as AcademicsData).examName}` : ""}
              </div>
              {!(data.academics as AcademicsData | null)?.subjects?.length ? (
                <p className="mt-2 text-[12.5px] text-olive-mute">还没有填写学业目标。</p>
              ) : (
                <div className="mt-2 space-y-1">
                  {(data.academics as AcademicsData).subjects
                    .filter((s) => s.selfLevel != null || s.lastScore != null || s.targetScore != null)
                    .map((s) => (
                      <div key={s.name} className="flex items-center gap-2 rounded-lg bg-cream/60 px-3 py-1.5 text-[12.5px]">
                        <span className="w-16 shrink-0 font-medium text-olive">{s.name}</span>
                        <span className="text-olive-soft">
                          自评 {s.selfLevel ?? "-"} 档 · 最近 {s.lastScore ?? "-"} · 目标 {s.targetScore ?? "-"}
                        </span>
                        <span className="mono ml-auto text-[11px] text-olive-mute">/ {s.fullScore ?? defaultFullScore(s.name, data.profile?.grade)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* 学习动态 */}
            <div className="paper-card p-4">
              <div className="mono text-[10px] tracking-wider text-olive-mute">近 7 次心情分（内容保密）</div>
              <div className="mt-2.5 flex items-end gap-2">
                {data.learning.moodRecent.length === 0 && <p className="text-[12.5px] text-olive-mute">还没有心情记录。</p>}
                {[...data.learning.moodRecent].reverse().map((m, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t-md ${m.mood <= 2 ? "bg-terra/70" : m.mood >= 4 ? "bg-lime" : "bg-butter"}`}
                      style={{ height: `${m.mood * 12}px` }}
                    />
                    <span className="mono text-[10px] text-olive-mute">{m.mood}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="paper-card p-4">
              <div className="mono text-[10px] tracking-wider text-olive-mute">最近 20 条答题</div>
              <div className="mt-2.5 space-y-1.5">
                {data.learning.recentAttempts.length === 0 && (
                  <p className="text-[12.5px] text-olive-mute">还没有答题记录。</p>
                )}
                {data.learning.recentAttempts.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12.5px]">
                    <span className={`h-2 w-2 rounded-full ${a.correct ? "bg-lime" : "bg-terra"}`} />
                    <span className="text-olive-soft">{a.stage}</span>
                    <span className="mono ml-auto text-[11px] text-olive-mute">
                      {new Date(a.createdAt).toLocaleString("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
