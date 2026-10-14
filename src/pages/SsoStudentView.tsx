/**
 * v158：一体通 SSO 免登只读视图——/sso/view/:studentId（公开路由，靠 sso 短会话 cookie 鉴权）。
 * 最小权限：只展示该学员的档案 + 测评数据（复用 ReportView / AnswerSheetsPanel，全只读），
 * 不渲染任何编辑入口；会话 10 分钟有效，失效后提示从一体通重新进入。
 */
import { useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import ReportView from "@/components/reports/ReportView";
import AnswerSheetsPanel from "@/components/AnswerSheetsPanel";
import type { AcademicsData } from "@contracts/academics";
import { defaultFullScore } from "@contracts/academics";
import { isE3V37Result } from "@contracts/e3v37";
import { isE3V37ParentResult } from "@contracts/e3v37Parent";
import { ShieldCheck } from "lucide-react";

export default function SsoStudentView() {
  const { studentId } = useParams();
  const userId = Number(studentId);
  const validId = Number.isInteger(userId) && userId > 0;
  const q = trpc.sso.studentDetail.useQuery({ userId }, { enabled: validId, retry: false });

  if (!validId || q.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4">
        <div className="w-full max-w-sm rounded-2xl bg-card p-8 text-center shadow-[0_8px_30px_-12px_rgba(12,80,72,0.25)]">
          <h1 className="text-[17px] font-bold text-olive">链接已失效</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">
            {q.error?.message || "链接无效"}，请从一体通重新进入。
          </p>
        </div>
      </div>
    );
  }
  if (q.isLoading || !q.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
      </div>
    );
  }
  const data = q.data;
  const a = data.assessments;

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-3xl px-4 py-6">
        {/* 顶栏：来源 + 只读说明 */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[15px] font-bold text-olive">三好学伴 · 学员测评</span>
          <span className="flex items-center gap-1 rounded-full bg-lime-pale px-2.5 py-1 text-[11.5px] font-medium text-olive">
            <ShieldCheck size={13} />
            一体通只读视图 · 10 分钟有效
          </span>
        </div>

        {/* 学员档案（与后台详情同款墨绿卡） */}
        <div className="rounded-2xl bg-[#0C7064] p-4 shadow-[0_4px_16px_-8px_rgba(12,112,100,0.45)]">
          <div className="mono text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
            Student Profile · 学员档案
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[16px] font-bold text-[#0C7064] shadow-sm">
              {(data.profile?.name || data.user.name || "学")[0]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[18px] font-bold text-white">
                  {data.profile?.name || data.user.name || "未命名"}
                </span>
                {[data.profile?.grade, data.profile?.school].filter(Boolean).length > 0 && (
                  <span className="text-[12.5px] font-semibold text-white/85">
                    {[data.profile?.grade, data.profile?.school].filter(Boolean).join(" · ")}
                  </span>
                )}
                {data.profile?.targetSchool && (
                  <span className="mono text-[11.5px] text-white/80">目标：{data.profile.targetSchool}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 测评报告（默认完整展开，与学生端/伴学端同一渲染） */}
        <div className="paper-card mt-4 p-4">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3.5 w-1 rounded-full bg-[#0C7064]" />
            <span className="text-[14px] font-bold text-[#1E3530]">测评报告</span>
          </div>
          <p className="mt-2 text-[12.5px] text-olive-soft">
            {(() => {
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
              if (a.optional?.scl90) names.push("心理健康·深度评估(SCL-90)");
              if (a.optional?.subject) names.push("学科能力评估");
              if (a.e3parent) names.push("家长卷");
              return names.length > 0 ? `已测 ${names.length} 项：${names.join("、")}` : "该学员还没有测评结果。";
            })()}
          </p>
          {a.mbti || a.disc || a.e3 || a.multi || a.optional ? (
            <div className="mt-3">
              <ReportView
                data={{
                  mbti: a.mbti, disc: a.disc, e3: a.e3, multi: a.multi ?? null,
                  multi5: (a.optional?.multi5 as never) ?? null, anchor: (a.optional?.anchor as never) ?? null,
                  holland: (a.optional?.holland as never) ?? null, mental: (a.optional?.mental as never) ?? null,
                  mentalSdq: (a.optional?.mentalsdq as never) ?? null, mentalPa: (a.optional?.mentalpa as never) ?? null,
                  mentalScl90: (a.optional?.scl90 as never) ?? null,
                  subject: (a.optional?.subject as never) ?? null,
                  e3parent: a.e3parent, discParents: (a.discParents ?? []) as never, raw: a.raw ?? [],
                }}
                profile={{ name: data.profile?.name || data.user.name, grade: data.profile?.grade, academics: data.academics as never }}
                viewer="tutor"
              />
            </div>
          ) : null}
        </div>

        {/* 家长卷 · 认知盲区判读（V3.7） */}
        {isE3V37ParentResult(a.e3parent) && (
          <div className="mt-4 rounded-xl border border-cream-deep bg-cream-card p-4">
            <div className="text-[13px] font-bold text-olive">家长卷 · 认知盲区判读（V3.7）</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="chip !text-[11px]">不了解 {a.e3parent.unknownCount} 项（{a.e3parent.unknownLevel}）</span>
              <span className="chip !text-[11px]">观察与孩子自评明显差异 {a.e3parent.blindSpots.length} 项</span>
              {a.e3parent.overestimates.length > 0 && (
                <span className="chip !text-[11px] text-terra">高估：{a.e3parent.overestimates.map((d) => d.kp).join("、")}</span>
              )}
              {a.e3parent.underestimates.length > 0 && (
                <span className="chip !text-[11px] text-terra">低估：{a.e3parent.underestimates.map((d) => d.kp).join("、")}</span>
              )}
              {a.e3parent.severeConflict && (
                <span className="chip !border-[#A82524]/50 !bg-[#FAF2E4] !text-[11px] !text-[#A82524]">家庭近期有严重亲子冲突信号</span>
              )}
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-olive-soft">{a.e3parent.summary}</p>
          </div>
        )}

        {/* 答题卷 · 得分表（逐题作答，只读） */}
        <div className="mt-4">
          <AnswerSheetsPanel
            raw={(a.raw ?? []) as never}
            e3={a.e3}
            studentName={(data.profile?.name || data.user.name) ?? undefined}
          />
        </div>

        {/* 成绩与目标（只读） */}
        {(data.academics as AcademicsData | null)?.subjects?.length ? (
          <div className="paper-card mt-4 p-4">
            <div className="mono text-[10px] tracking-wider text-olive-mute">
              成绩与目标{(data.academics as AcademicsData).examName ? ` · ${(data.academics as AcademicsData).examName}` : ""}
            </div>
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
          </div>
        ) : null}

        <p className="mt-6 text-center text-[11.5px] text-olive-mute">
          本页面由一体通免登进入 · 只读 · 会话 10 分钟后自动失效
        </p>
      </div>
    </div>
  );
}
