/** 学员 tab（v220 从 Admin.tsx 拆出供学校版控制台复用）：
 *  admin.students 列表 + 指导老师多对多分配 + 搜索 + 详情抽屉。
 *  platform=超管看全量带机构标注；orgScope=超管分系统筛选；jiaowu=教务受限视图；
 *  tutorLabel=角色称谓（学校版传「指导老师」，机构版默认「伴学师」）。 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { ClipboardList, Search } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { usePager } from "@/hooks/usePager";
import Pager from "@/components/Pager";
import StudentDetailDrawer from "@/components/StudentDetailDrawer";
import ResetPasswordButton from "@/components/ResetPasswordButton";
import DeleteStudentButton from "@/components/DeleteStudentButton";
import ReportAccessButton from "@/components/ReportAccessButton";
import AssessmentReleasePanel from "@/components/AssessmentReleasePanel";
import TutorAssignButton from "@/components/TutorAssignButton";
import ReportGrantButton from "@/components/ReportGrantButton";
import BulkAssignTutors from "@/components/BulkAssignTutors";

export default function StudentsTab({
  platform = false,
  jiaowu = false,
  orgScope,
  tutorLabel = "伴学师",
}: {
  platform?: boolean;
  jiaowu?: boolean;
  orgScope: { orgId: number | null };
  tutorLabel?: string;
}) {
  /* v157：详情抽屉与 URL 参数联动（?student=<id>），刷新/转发链接可直达学员详情 */
  const [searchParams, setSearchParams] = useSearchParams();
  const studentParam = searchParams.get("student");
  const detailId = studentParam && /^\d+$/.test(studentParam) ? Number(studentParam) : null;
  const openDetail = (id: number) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("student", String(id));
      return next;
    });
  const closeDetail = () =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("student");
        return next;
      },
      { replace: true },
    );
  const [releaseFor, setReleaseFor] = useState<number | null>(null);
  const [q, setQ] = useState("");
  /* v217：批量分配指导老师——勾选学员后统一分配（后端单次上限 500 人） */
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const togglePick = (id: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  /* v200：搜索改服务端匹配（教务的手机号是脱敏返回的，客户端过滤永远搜不到）；
     输入防抖 300ms 再发查询，行为与总览用户搜索一致 */
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const kw = debouncedQ;
  const { data: students, isLoading } = trpc.admin.students.useQuery({ ...orgScope, search: kw || undefined });
  const { data: tutors } = trpc.admin.tutors.useQuery(orgScope);
  const filtered = students ?? [];
  /* v160：学员列表分页（搜索词变化自动回第 1 页） */
  const studentsPager = usePager(filtered, 20, kw);

  return (
    <div className="paper-card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3.5">
        {/* v217：全选/反选当前搜索结果的学员 */}
        <input
          type="checkbox"
          checked={filtered.length > 0 && filtered.every((s) => picked.has(s.userId))}
          onChange={() =>
            setPicked((prev) => {
              const all = filtered.every((s) => prev.has(s.userId));
              const next = new Set(prev);
              filtered.forEach((s) => (all ? next.delete(s.userId) : next.add(s.userId)));
              return next;
            })
          }
          className="h-4 w-4 accent-[#0C7064]"
          title="全选/取消全选当前列表学员"
        />
        <span className="text-[14.5px] font-semibold text-olive">学员列表</span>
        <span className="text-[12px] text-olive-mute">{filtered.length} 位</span>
        {picked.size > 0 && (
          <span className="text-[12px] font-semibold text-brand">已选 {picked.size} 人</span>
        )}
        {picked.size > 0 && (
          <button type="button" onClick={() => setPicked(new Set())} className="text-[11.5px] text-olive-mute underline underline-offset-2 hover:text-brand">清空</button>
        )}
        {/* v217：批量分配指导老师（合并语义，不覆盖学员已有其他指导老师） */}
        <BulkAssignTutors
          studentIds={[...picked]}
          tutors={(tutors ?? []).map((t) => ({ id: t.id, name: t.name }))}
          onDone={() => setPicked(new Set())}
          tutorLabel={tutorLabel}
        />
        {/* V56：学员查询（姓名/手机号） */}
        <span className="relative ml-auto">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-olive-mute" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索姓名 / 手机号"
            className="w-52 rounded-lg border border-border bg-cream-card py-1.5 pl-8 pr-3 text-[12.5px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime"
          />
        </span>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {studentsPager.pageItems.map((s) => (
            <div key={s.userId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
              <input
                type="checkbox"
                checked={picked.has(s.userId)}
                onChange={() => togglePick(s.userId)}
                className="h-4 w-4 shrink-0 accent-[#0C7064]"
                aria-label={`选择 ${s.name}`}
              />
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0C7064] text-[14px] font-bold text-white">
                {(s.name || "学")[0]}
              </span>
              {/* v184：min-w-[240px] 保证中等宽度（边栏收起）时信息栏不被按钮组挤没，
                  空间不够时外层 flex-wrap 会把按钮组整组折到下一行 */}
              <div className="min-w-[240px] flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-[14.5px] font-semibold text-[#1E3530]">{s.name}</span>
                  {s.grade && <span className="text-[11.5px] text-olive-mute">{s.grade}</span>}
                  {s.mbti && <span className="chip !py-0.5 !text-[10.5px] text-olive">{s.mbti}</span>}
                  {s.disc && <span className="chip !py-0.5 !text-[10.5px] text-olive">{s.disc}</span>}
                  {s.hasMulti && <span className="chip !py-0.5 !text-[10.5px] text-olive">多元✓</span>}
                  {s.hasAcademics && <span className="chip !py-0.5 !text-[10.5px] text-olive">学业✓</span>}
                  {/* V60：超管看全量列表时标注所属机构 */}
                  {platform && s.orgName && (
                    <span className="chip !py-0.5 !text-[10.5px] text-olive-soft">{s.orgName}</span>
                  )}
                </div>
                {/* V56：名下指导老师（可多选） */}
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span className="text-[11px] text-olive-mute">{tutorLabel}：</span>
                  {s.tutors.length === 0 ? (
                    <span className="text-[11px] text-olive-mute">未分配</span>
                  ) : (
                    s.tutors.map((t) => (
                      <span
                        key={t.id}
                        title={t.reportAccess === false ? `该${tutorLabel}无报告查看权限` : `该${tutorLabel}可查看测评报告`}
                        className={`rounded-full px-1.5 py-px text-[10.5px] font-semibold ${
                          t.reportAccess === false ? "bg-cream-card text-olive-mute ring-1 ring-border" : "bg-butter-pale text-brand"
                        }`}
                      >
                        {t.name}
                        {t.reportAccess === false ? "🔒" : ""}
                      </span>
                    ))
                  )}
                </div>
                <div className="mono mt-0.5 text-[11px] text-olive-mute">
                  {s.phone && <>{s.phone} · </>}注册 {new Date(s.createdAt).toLocaleDateString("zh-CN")} · 最近活跃{" "}
                  {new Date(s.lastSignInAt).toLocaleDateString("zh-CN")}
                </div>
                <div className="mono mt-0.5 text-[11px] text-olive-soft">
                  答题 {s.attempts} · 错题 {s.errors} · 计划 {s.plans} · 预习 {s.previewsDone}
                </div>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {/* V56：多对多分配指导老师（v200：教务仅有的两个操作之一） */}
                <TutorAssignButton studentUserId={s.userId} tutors={tutors ?? []} assigned={s.tutors} tutorLabel={tutorLabel} />
                {/* v169：分配报告（开通指导老师报告查看权限，可设有效期；v200：教务仅有的两个操作之一） */}
                <ReportGrantButton studentUserId={s.userId} studentName={s.name} tutors={tutors ?? []} assigned={s.tutors} />
                {/* 以下操作 v200 起对教务隐藏：报告推送/测评推送/重置密码/删除/详情 */}
                {!jiaowu && (
                  <>
                {/* V54：报告推送开关 */}
                <ReportAccessButton userId={s.userId} released={s.reportReleased} />
                {/* v82：渠道绑定测评套餐的学员——推送解锁隐藏的测评 */}
                {(s.assessBoundKinds.length > 0 || s.releasedAssessments.length > 0) && (
                  <button
                    type="button"
                    title="推送测评（解锁套餐外隐藏的测评）"
                    onClick={() => setReleaseFor(releaseFor === s.userId ? null : s.userId)}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold ${
                      releaseFor === s.userId
                        ? "border-transparent bg-brand font-semibold text-white shadow-sm"
                        : "border-border bg-cream-card text-olive hover:bg-butter-pale/70"
                    }`}
                  >
                    <ClipboardList size={13} />
                    推送测评
                  </button>
                )}
                {/* V53：管理员可重置任意学员登录密码（默认 123456） */}
                <ResetPasswordButton userId={s.userId} name={s.name} />
                {/* v96：删除学员（移入回收站，保留 2 个月可恢复） */}
                <DeleteStudentButton userId={s.userId} name={s.name} />
                <button
                  onClick={() => openDetail(s.userId)}
                  className="rounded-lg border border-border bg-cream-card px-3.5 py-2 text-[13px] font-medium text-olive whitespace-nowrap transition-colors hover:border-[#E3B53A]/50 hover:bg-butter-pale/60"
                >
                  详情
                </button>
                  </>
                )}
              </div>
              {releaseFor === s.userId && (
                <div className="w-full">
                  <AssessmentReleasePanel
                    key={`${s.userId}-${s.releasedAssessments.join(",")}`}
                    userId={s.userId}
                    released={s.releasedAssessments}
                    boundKinds={s.assessBoundKinds}
                  />
                </div>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="px-5 py-8 text-center text-[13px] text-olive-mute">
              {kw ? `没有匹配「${kw}」的学员。` : "还没有学员档案。"}
            </p>
          )}
        </div>
      )}
      <Pager page={studentsPager.page} totalPages={studentsPager.totalPages} total={studentsPager.total} onChange={studentsPager.setPage} />
      {/* v200：教务无学员详情权限（接口对教务关闭），URL 带参数也不渲染抽屉 */}
      {detailId !== null && !jiaowu && <StudentDetailDrawer userId={detailId} source="admin" onClose={closeDetail} />}
    </div>
  );
}
