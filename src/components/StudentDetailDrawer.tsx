import { useState } from "react";
import { trpc } from "@/providers/trpc";
import CoachingPlanCard from "@/components/CoachingPlanCard";
import V37CoachingPlanCard from "@/components/V37CoachingPlanCard";
import ReportView from "@/components/reports/ReportView";
import AcademicsEditorCore from "@/components/companion/AcademicsEditorCore";
import type { AcademicsSubmit } from "@/components/companion/AcademicsEditorCore";
import type { AcademicsData } from "@contracts/academics";
import { defaultFullScore } from "@contracts/academics";
import { isE3V27Result } from "@contracts/assessments";
import { isE3V37Result } from "@contracts/e3v37";
import { isE3V37ParentResult } from "@contracts/e3v37Parent";
import { X, Maximize2, Minimize2, ChevronDown, ChevronUp } from "lucide-react";

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
  /** 测评报告：默认收起为一行摘要，展开渲染与学生端一致的 ReportView。 */
  const [reportOpen, setReportOpen] = useState(false);
  /** 成绩与目标 · 可代填：伴学师/管理员代学员填写。 */
  const [editAcad, setEditAcad] = useState(false);
  const [acadSaved, setAcadSaved] = useState(false);

  const utils = trpc.useUtils();
  const saveMut = trpc.coach.saveAcademics.useMutation({
    onSuccess: () => {
      // 后端已放行 admin：两个入口共用同一 mutation，按当前数据源刷新对应查询。
      if (source === "admin") utils.admin.studentDetail.invalidate({ userId });
      else utils.coach.studentDetail.invalidate({ userId });
      setEditAcad(false);
      setAcadSaved(true);
    },
  });

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

            {/* 测评报告：默认一行摘要，展开渲染与学生端完全一致的 ReportView */}
            <div className="paper-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="mono text-[10px] tracking-wider text-olive-mute">测评报告</div>
                <button
                  onClick={() => setReportOpen((v) => !v)}
                  className="flex shrink-0 items-center gap-0.5 rounded-lg border border-lime/60 bg-lime-pale px-2.5 py-1 text-[11.5px] font-semibold text-olive hover:bg-lime/20"
                >
                  {reportOpen ? (
                    <>
                      收起 <ChevronUp size={13} />
                    </>
                  ) : (
                    <>
                      查看完整报告（与学生端一致） <ChevronDown size={13} />
                    </>
                  )}
                </button>
              </div>
              <p className="mt-2 text-[12.5px] text-olive-soft">
                {(() => {
                  const a = data.assessments;
                  const names: string[] = [];
                  if (a.mbti) names.push("MBTI 性格测评");
                  if (a.disc) names.push("DISC 行为风格");
                  if (a.e3) names.push(isE3V37Result(a.e3) ? "学习力诊断（V3.7 三阶九能）" : "学习力诊断（旧版 V2.7）");
                  if (a.multi) names.push("多元智能");
                  if (a.optional?.multi5) names.push("多元智能五项");
                  if (a.optional?.anchor) names.push("职业锚");
                  if (a.optional?.holland) names.push("霍兰德职业兴趣");
                  if (a.optional?.mental) names.push("心理健康·通用版");
                  if (a.optional?.mentalsdq) names.push("心理健康·学生版A(SDQ)");
                  if (a.optional?.mentalpa) names.push("心理健康·学生版B(PHQ-A)");
                  if (a.e3parent) names.push("家长卷");
                  return names.length > 0 ? `已测 ${names.length} 项：${names.join("、")}` : "还没有测评结果。";
                })()}
              </p>
              {reportOpen && (
                <div className="mt-3">
                  {(() => {
                    const a = data.assessments;
                    return (
                      <ReportView
                        data={{
                          mbti: a.mbti, disc: a.disc, e3: a.e3, multi: a.multi ?? null,
                          multi5: (a.optional?.multi5 as any) ?? null, anchor: (a.optional?.anchor as any) ?? null,
                          holland: (a.optional?.holland as any) ?? null, mental: (a.optional?.mental as any) ?? null,
                          mentalSdq: (a.optional?.mentalsdq as any) ?? null, mentalPa: (a.optional?.mentalpa as any) ?? null,
                          e3parent: a.e3parent, discParents: (a.discParents ?? []) as any, raw: a.raw ?? [],
                        }}
                        profile={{ name: data.profile?.name || data.user.name, grade: data.profile?.grade, academics: data.academics as any }}
                        viewer="tutor"
                        onEditAcademics={() => {
                          setEditAcad(true);
                          document.getElementById("drawer-academics-editor")?.scrollIntoView({ behavior: "smooth" });
                        }}
                      />
                    );
                  })()}
                </div>
              )}
              {/* 家长卷 · 认知盲区判读（V3.7）：伴学师/管理员专属信息，学生端不可见，保留在 ReportView 展开区之外 */}
              {isE3V37ParentResult(data.assessments.e3parent) && (
                <div className="mt-3 rounded-xl border border-cream-deep bg-cream-card p-4">
                  <div className="text-[13px] font-bold text-olive">家长卷 · 认知盲区判读（V3.7）</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="chip !text-[11px]">不了解 {data.assessments.e3parent.unknownCount} 项（{data.assessments.e3parent.unknownLevel}）</span>
                    <span className="chip !text-[11px]">观察与孩子自评明显差异 {data.assessments.e3parent.blindSpots.length} 项</span>
                    {data.assessments.e3parent.overestimates.length > 0 && (
                      <span className="chip !text-[11px] text-terra">高估：{data.assessments.e3parent.overestimates.map((d) => d.kp).join("、")}</span>
                    )}
                    {data.assessments.e3parent.underestimates.length > 0 && (
                      <span className="chip !text-[11px] text-terra">低估：{data.assessments.e3parent.underestimates.map((d) => d.kp).join("、")}</span>
                    )}
                    {data.assessments.e3parent.severeConflict && (
                      <span className="chip !border-[#8f1313]/50 !bg-[#fbe3df] !text-[11px] !text-[#8f1313]">家庭近期有严重亲子冲突信号</span>
                    )}
                  </div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-olive-soft">{data.assessments.e3parent.summary}</p>
                </div>
              )}
            </div>

            {/* 学习力陪跑训练方案（V3.7 三阶九能） */}
            {data.assessments.e3 && isE3V37Result(data.assessments.e3) && (
              <V37CoachingPlanCard
                name={data.profile?.name || data.user.name || "学员"}
                grade={data.profile?.grade ?? null}
                e3={data.assessments.e3}
                academics={(data.academics as AcademicsData | null) ?? null}
              />
            )}

            {/* 学习力陪跑训练方案（V2.7 旧版，需 E3 已完成） */}
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

            {/* 成绩与目标 · 可代填（伴学师/管理员代学员填写） */}
            <div className="paper-card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="mono text-[10px] tracking-wider text-olive-mute">
                  成绩与目标 · 可代填{(data.academics as AcademicsData | null)?.examName ? ` · ${(data.academics as AcademicsData).examName}` : ""}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {acadSaved && !editAcad && <span className="text-[11.5px] font-medium text-olive">已保存 ✓</span>}
                  <button
                    onClick={() => {
                      setEditAcad((v) => !v);
                      setAcadSaved(false);
                    }}
                    className="rounded-lg border border-lime/60 bg-lime-pale px-2.5 py-1 text-[11.5px] font-semibold text-olive hover:bg-lime/20"
                  >
                    {editAcad ? "收起填写" : "帮TA填写 / 修改"}
                  </button>
                </div>
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
              <div id="drawer-academics-editor">
                {editAcad && (
                  <div className="mt-3">
                    <AcademicsEditorCore
                      grade={data.profile?.grade}
                      initial={data.academics as AcademicsData | null}
                      submitting={saveMut.isPending}
                      submitLabel="保存到学员档案"
                      onSubmit={(d: AcademicsSubmit) => {
                        setAcadSaved(false);
                        saveMut.mutate({ userId, ...d });
                      }}
                      footer={
                        <>
                          {saveMut.isError && (
                            <p className="mt-2 text-center text-[13px] text-terra">保存失败，请再试一次。</p>
                          )}
                        </>
                      }
                    />
                  </div>
                )}
              </div>
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
