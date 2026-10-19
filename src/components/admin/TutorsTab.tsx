/** 指导老师 tab（v220 从 Admin.tsx 拆出供学校版控制台复用）：
 *  admin.tutors 列表，行内学员可调整分配（多对多）。orgScope=超管分系统筛选；
 *  tutorLabel=角色称谓（学校版传「指导老师」，机构版默认「伴学师」）。 */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { usePager } from "@/hooks/usePager";
import Pager from "@/components/Pager";
import TutorAssignButton from "@/components/TutorAssignButton";

export default function TutorsTab({ orgScope, tutorLabel = "伴学师" }: { orgScope: { orgId: number | null }; tutorLabel?: string }) {
  const { data: tutors, isLoading } = trpc.admin.tutors.useQuery(orgScope);
  const { data: students } = trpc.admin.students.useQuery(orgScope);
  const assignedOf = (userId: number) => students?.find((s) => s.userId === userId)?.tutors ?? [];
  const utils = trpc.useUtils();
  /* v170：邀请学员默认可看报告开关 */
  const setInviteDefault = trpc.admin.setTutorInviteReportDefault.useMutation({
    onSuccess: () => utils.admin.tutors.invalidate(),
  });
  /* v161：每位指导老师名下学员默认折叠，点「展开」看全部；列表分页（每页 10 个） */
  const [expandedTutors, setExpandedTutors] = useState<number[]>([]);
  const toggleTutor = (id: number) =>
    setExpandedTutors((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const tutorsPager = usePager(tutors ?? [], 10);

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="paper-card flex justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        </div>
      ) : (
        <>
          {tutorsPager.pageItems.map((t) => {
            const expanded = expandedTutors.includes(t.id);
            return (
              <div key={t.id} className="paper-card overflow-hidden">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-5 py-3.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-[14px] font-bold text-cream">
                    {(t.name || tutorLabel[0]!)[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] font-semibold text-olive">{t.name}</div>
                    <div className="mono mt-0.5 text-[11px] text-olive-mute">
                      学员 {t.studentCount} 人 · 总答题 {t.totalAttempts} · 最近登录{" "}
                      {new Date(t.lastSignInAt).toLocaleDateString("zh-CN")}
                    </div>
                  </div>
                  {/* v170：邀请学员默认可看报告——开启后扫他的码注册的新学员自动带报告权限 */}
                  <button
                    type="button"
                    title={`开启后，扫这位${tutorLabel}二维码注册的新学员默认可查看测评报告`}
                    onClick={() => setInviteDefault.mutate({ tutorUserId: t.id, value: !t.inviteReportDefault })}
                    disabled={setInviteDefault.isPending}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                      t.inviteReportDefault ? "bg-brand text-white" : "bg-cream-card text-olive-mute ring-1 ring-border hover:text-olive"
                    }`}
                  >
                    {t.inviteReportDefault ? "默认可看报告 ✓" : "默认无报告"}
                  </button>
                </div>
                <button
                  onClick={() => toggleTutor(t.id)}
                  className="flex w-full items-center gap-1.5 px-5 py-2.5 text-[12.5px] font-medium text-olive-mute transition-colors hover:bg-butter-pale/40 hover:text-olive"
                >
                  <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
                  {expanded ? "收起学员列表" : `学员 ${t.studentCount} 人 · 点击展开`}
                </button>
                {expanded && (
                  <div className="divide-y divide-border">
                    {t.students.map((s) => (
                      <div key={s.userId} className="flex items-center gap-3 px-5 py-2.5">
                        <span className="text-[13px] text-olive">
                          {s.name}
                          {s.grade && <span className="ml-1.5 text-[11.5px] text-olive-mute">{s.grade}</span>}
                        </span>
                        <span className="ml-auto">
                          <TutorAssignButton studentUserId={s.userId} tutors={tutors ?? []} assigned={assignedOf(s.userId)} />
                        </span>
                      </div>
                    ))}
                    {t.students.length === 0 && (
                      <p className="px-5 py-4 text-[12.5px] text-olive-mute">还没有分配学员，可在「学员管理」里分配。</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {tutors?.length === 0 && (
            <p className="paper-card px-5 py-8 text-center text-[13px] text-olive-mute">
              还没有{tutorLabel}——在「组织架构」里可以把用户设为{tutorLabel}。
            </p>
          )}
          {tutorsPager.totalPages > 1 && (
            <div className="paper-card overflow-hidden">
              <Pager page={tutorsPager.page} totalPages={tutorsPager.totalPages} total={tutorsPager.total} onChange={tutorsPager.setPage} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
