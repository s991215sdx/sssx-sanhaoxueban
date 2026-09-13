import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import StudentDetailDrawer from "@/components/StudentDetailDrawer";
import { GraduationCap } from "lucide-react";

/** 伴学工作台（/tutor）：伴学师查看名下学员，admin 可看全部。 */
export default function Tutor() {
  const { user } = useAuth();
  const allowed = user?.role === "tutor" || user?.role === "admin";
  const [detailId, setDetailId] = useState<number | null>(null);
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
            <button
              key={s.userId}
              onClick={() => setDetailId(s.userId)}
              className="paper-card p-4 text-left transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-olive text-[15px] font-bold text-cream">
                  {(s.name || "学")[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold text-olive">{s.name}</span>
                    {s.grade && <span className="text-[12px] text-olive-mute">{s.grade}</span>}
                  </div>
                  <div className="mono mt-0.5 text-[11px] text-olive-mute">
                    最近活跃 {new Date(s.lastSignInAt).toLocaleDateString("zh-CN")}
                  </div>
                </div>
              </div>
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
              </div>
              <div className="mono mt-3 flex gap-3 text-[12px] text-olive-soft">
                <span>答题 {s.attempts}</span>
                <span>错题 {s.errors}</span>
                <span>计划 {s.plans}</span>
                <span>预习 {s.previewsDone}</span>
              </div>
            </button>
          ))}
          {students?.length === 0 && (
            <p className="paper-card px-5 py-8 text-center text-[13px] text-olive-mute sm:col-span-2">
              还没有分配学员给你，请等管理员在后台分配。
            </p>
          )}
        </div>
      )}

      {detailId !== null && <StudentDetailDrawer userId={detailId} source="coach" onClose={() => setDetailId(null)} />}
    </div>
  );
}
