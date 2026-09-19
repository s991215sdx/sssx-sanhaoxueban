import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import StudentDetailDrawer from "@/components/StudentDetailDrawer";
import InviteChannelsTab from "@/components/admin/InviteChannelsTab";
import TrainingPlanLibrary from "@/components/TrainingPlanLibrary";
import ResetPasswordButton from "@/components/ResetPasswordButton";
import ReportAccessButton from "@/components/ReportAccessButton";
import { STUDENT_MODULES } from "@contracts/studentModules";
import { GraduationCap, SlidersHorizontal, Send } from "lucide-react";

/** 学员卡内联的「功能开关」面板：勾选该学员可用的模块（测评中心恒可用）。 */
function StudentModulesPanel({ userId, enabledModules }: { userId: number; enabledModules: string[] | null }) {
  const utils = trpc.useUtils();
  const allKeys = STUDENT_MODULES.map((m) => m.key);
  const [selected, setSelected] = useState<string[]>(enabledModules ?? allKeys);
  const save = trpc.coach.setStudentModules.useMutation({
    onSuccess: () => utils.coach.myStudents.invalidate(),
  });
  const toggle = (key: string) =>
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  return (
    <div className="mt-3 rounded-xl border border-border bg-cream/70 p-3" onClick={(e) => e.stopPropagation()}>
      <div className="text-[12px] font-bold text-olive">学员端可见功能（测评中心始终可用）</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {STUDENT_MODULES.map((m) => {
          const on = selected.includes(m.key);
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => toggle(m.key)}
              className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                on ? "border-lime/60 bg-lime-pale text-olive" : "border-border bg-cream-card text-olive-mute"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => save.mutate({ userId, modules: selected })}
          disabled={save.isPending}
          className="rounded-lg bg-olive px-3 py-1.5 text-[12px] font-semibold text-cream hover:bg-lime disabled:opacity-40"
        >
          {save.isPending ? "保存中…" : "保存"}
        </button>
        {selected.length === 0 && (
          <span className="text-[11px] text-olive-mute">全部不勾 = 恢复全部功能</span>
        )}
        {save.isSuccess && <span className="text-[11px] text-olive">已保存 ✓</span>}
        {save.error && <span className="text-[11px] text-terra">{save.error.message}</span>}
      </div>
    </div>
  );
}

/** 伴学工作台（/tutor）：伴学师查看名下学员，admin 可看全部。 */
export default function Tutor() {
  const { user } = useAuth();
  const allowed = user?.role === "tutor" || user?.role === "admin";
  const [detailId, setDetailId] = useState<number | null>(null);
  const [modulesFor, setModulesFor] = useState<number | null>(null);
  const { data: students, isLoading } = trpc.coach.myStudents.useQuery(undefined, { enabled: allowed });

  if (!allowed) {
    return (
      <div className="mx-auto mt-16 max-w-md">
        <div className="paper-card p-8 text-center">
          <GraduationCap className="mx-auto text-olive" size={34} />
          <h1 className="mt-3 text-[19px] font-bold text-olive">伴学工作台</h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-olive-mute">
            这里是伴学师的工作台，需要伴学师权限。如果你负责伴学，请联系管理员为你开通。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-olive">伴学工作台</h1>
        <p className="mt-1 text-[13px] text-olive-mute">
          你名下的学员都在这里。树洞内容属于隐私，只能看到心情曲线，看不到具体文字。
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {students?.map((s) => (
            <div
              key={s.userId}
              onClick={() => setDetailId(s.userId)}
              className="paper-card cursor-pointer p-4 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-olive text-[15px] font-bold text-cream">
                  {(s.name || "学")[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold text-olive">{s.name}</span>
                    {s.grade && <span className="text-[12px] text-olive-mute">{s.grade}</span>}
                    {s.enabledModules != null && (
                      <span className="rounded-full bg-butter/40 px-1.5 py-0.5 text-[10px] font-semibold text-olive-soft">
                        仅测评中心{s.enabledModules.length > 1 ? `等 ${s.enabledModules.length} 项` : ""}
                      </span>
                    )}
                  </div>
                  <div className="mono mt-0.5 text-[11px] text-olive-mute">
                    最近活跃 {new Date(s.lastSignInAt).toLocaleDateString("zh-CN")}
                  </div>
                </div>
                <button
                  type="button"
                  title="开启/关闭学员端功能"
                  onClick={(e) => {
                    e.stopPropagation();
                    setModulesFor(modulesFor === s.userId ? null : s.userId);
                  }}
                  className={`rounded-lg p-1.5 transition-colors ${
                    modulesFor === s.userId ? "bg-lime-pale text-olive" : "text-olive-mute hover:bg-lime-pale hover:text-olive"
                  }`}
                >
                  <SlidersHorizontal size={15} />
                </button>
                {/* V53：重置该学员登录密码（默认 123456） */}
                <ResetPasswordButton userId={s.userId} name={s.name} compact />
                {/* V54：报告推送开关（默认未推送，家长不可见） */}
                <ReportAccessButton userId={s.userId} released={s.reportReleased} compact />
              </div>
              {modulesFor === s.userId && <StudentModulesPanel userId={s.userId} enabledModules={s.enabledModules} />}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.mbti ? (
                  <span className="chip !py-0.5 !text-[10.5px] text-olive">MBTI {s.mbti}</span>
                ) : (
                  <span className="chip !py-0.5 !text-[10.5px] opacity-60">MBTI 未测</span>
                )}
                {s.disc ? (
                  <span className="chip !py-0.5 !text-[10.5px] text-olive">DISC {s.disc}</span>
                ) : (
                  <span className="chip !py-0.5 !text-[10.5px] opacity-60">DISC 未测</span>
                )}
                {s.hasMulti && <span className="chip !py-0.5 !text-[10.5px] text-olive">多元 ✓</span>}
                {s.hasAcademics && <span className="chip !py-0.5 !text-[10.5px] text-olive">学业目标 ✓</span>}
                {/* V55：家长/学员点了「请伴学师推送报告」——橙色提醒，推送后自动消失 */}
                {s.reportPushRequestedAt && !s.reportReleased && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#c7a23a99] bg-[#f5e7c1] px-2 py-0.5 text-[10.5px] font-semibold text-[#8a6d1a]">
                    <Send size={11} />
                    家长请求推送报告
                  </span>
                )}
              </div>
              <div className="mono mt-3 flex gap-3 text-[12px] text-olive-soft">
                <span>答题 {s.attempts}</span>
                <span>错题 {s.errors}</span>
                <span>计划 {s.plans}</span>
                <span>预习 {s.previewsDone}</span>
              </div>
            </div>
          ))}
          {students?.length === 0 && (
            <p className="paper-card px-5 py-8 text-center text-[13px] text-olive-mute sm:col-span-2">
              还没有分配学员给你，请等管理员在后台分配。
            </p>
          )}
        </div>
      )}

      {/* 邀请注册：伴学师自己的二维码（经此码注册的学员自动归到名下） */}
      <section className="pt-3">
        <h2 className="text-[17px] font-bold text-olive">邀请注册 · 我的二维码</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-olive-mute">
          生成你自己的注册二维码发给家长（可打印、可复制链接）：通过你的码注册的学员<b className="text-olive">自动归到你名下</b>。学员注册后默认只显示测评中心，在上方学员卡里可以逐人开启更多功能。
        </p>
        <div className="mt-3">
          <InviteChannelsTab />
        </div>
      </section>

      {/* 学习力陪跑训练方案（三阶九能）：典型问题 + 简要方案，点开看详细做法 */}
      <TrainingPlanLibrary />

      {detailId !== null && <StudentDetailDrawer userId={detailId} source="coach" onClose={() => setDetailId(null)} />}
    </div>
  );
}
