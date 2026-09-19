import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import StudentDetailDrawer from "@/components/StudentDetailDrawer";
import InviteChannelsTab from "@/components/admin/InviteChannelsTab";
import ResetPasswordButton from "@/components/ResetPasswordButton";
import { ShieldCheck, Users, BookOpenCheck, Bandage, ClipboardList, HeartHandshake, PenLine, X } from "lucide-react";

/** 后台管理：总览 / 学员 / 伴学师 / 注册邀请 四个 tab。 */
export default function Admin() {
  const { user, refresh } = useAuth();
  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    return <ClaimAdminCard onClaimed={() => refresh()} />;
  }
  return <AdminPanel selfId={user.id} />;
}

/** 系统还没有管理员时，当前用户可一键自任管理员（bootstrap）。 */
function ClaimAdminCard({ onClaimed }: { onClaimed: () => void }) {
  const claim = trpc.admin.claimAdmin.useMutation({
    onSuccess: () => onClaimed(),
  });
  return (
    <div className="mx-auto mt-16 max-w-md">
      <div className="paper-card p-8 text-center">
        <ShieldCheck className="mx-auto text-olive" size={34} />
        <h1 className="mt-3 text-[19px] font-bold text-olive">后台管理</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-olive-mute">
          这里用于查看所有账号的学习概览、管理管理员。
          <br />
          当前系统还没有管理员——第一个进来的人可以接管。
        </p>
        <button
          onClick={() => claim.mutate()}
          disabled={claim.isPending}
          className="mt-5 w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
        >
          {claim.isPending ? "开通中…" : "我是负责人，开通管理员"}
        </button>
        {claim.error && <p className="mt-3 text-[13px] text-terra">{claim.error.message}</p>}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="paper-card flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-pale text-olive">
        <Icon size={19} />
      </span>
      <div>
        <div className="mono text-[20px] font-bold leading-none text-olive">{value}</div>
        <div className="mt-1 text-[12px] text-olive-mute">{label}</div>
      </div>
    </div>
  );
}

type AdminTab = "overview" | "students" | "tutors" | "invites";

const ADMIN_TABS: { key: AdminTab; label: string }[] = [
  { key: "overview", label: "总览" },
  { key: "students", label: "学员" },
  { key: "tutors", label: "伴学师" },
  { key: "invites", label: "注册邀请" },
];

function AdminPanel({ selfId }: { selfId: number }) {
  const [tab, setTab] = useState<AdminTab>("overview");
  const [detailId, setDetailId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { data: overview } = trpc.admin.overview.useQuery();
  const { data: users, isLoading } = trpc.admin.users.useQuery();
  const setRole = trpc.admin.setRole.useMutation({
    onSuccess: () => {
      utils.admin.users.invalidate();
      utils.admin.overview.invalidate();
    },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight text-olive">后台管理</h1>
        <p className="mt-1 text-[13px] text-olive-mute">所有账号的学习概览。树洞内容属于隐私，这里只看得到心情曲线，看不到具体文字。</p>
      </header>

      {/* Tab 切换 */}
      <div className="flex rounded-xl bg-cream-deep p-1">
        {ADMIN_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition ${
              tab === t.key ? "bg-cream text-olive shadow-sm" : "text-olive-mute"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "invites" && <InviteChannelsTab />}
      {tab === "overview" && (
        <>
          {overview && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard icon={Users} label="注册用户" value={overview.userCount} />
              <StatCard icon={PenLine} label="答题记录" value={overview.attemptCount} />
              <StatCard icon={Bandage} label="错题总数" value={overview.errorCount} />
              <StatCard icon={ClipboardList} label="试卷分析" value={overview.paperCount} />
              <StatCard icon={HeartHandshake} label="树洞条数" value={overview.moodCount} />
              <StatCard icon={BookOpenCheck} label="完成预习" value={overview.previewCount} />
            </div>
          )}

          {/* 用户列表 */}
          <div className="paper-card overflow-hidden">
            <div className="border-b border-border px-5 py-3.5">
              <span className="text-[14.5px] font-semibold text-olive">用户列表</span>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {users?.map((u) => (
                  <div key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive text-[14px] font-bold text-cream">
                      {(u.name || "学")[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14.5px] font-semibold text-olive">{u.name}</span>
                        {u.role === "admin" && <span className="chip !py-0.5 !text-[10.5px] text-olive">管理员</span>}
                        {u.role === "tutor" && <span className="chip !py-0.5 !text-[10.5px] text-olive">伴学师</span>}
                        {u.id === selfId && <span className="text-[11px] text-olive-mute">（我）</span>}
                      </div>
                      <div className="mono mt-0.5 text-[11px] text-olive-mute">
                        注册 {new Date(u.createdAt).toLocaleDateString("zh-CN")} · 最近登录{" "}
                        {new Date(u.lastSignInAt).toLocaleDateString("zh-CN")}
                      </div>
                    </div>
                    <div className="mono hidden text-[12px] text-olive-soft sm:block">
                      错题 {u.errors} · 答题 {u.attempts} · 计划 {u.plans}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setDetailId(u.id)}
                        className="rounded-lg border border-border bg-cream px-3 py-1.5 text-[12.5px] font-medium text-olive hover:border-lime"
                      >
                        详情
                      </button>
                      {u.id !== selfId && (
                        <>
                          <button
                            onClick={() => setRole.mutate({ userId: u.id, role: u.role === "admin" ? "user" : "admin" })}
                            disabled={setRole.isPending}
                            className="rounded-lg border border-border bg-cream px-3 py-1.5 text-[12.5px] font-medium text-olive-soft hover:border-olive/40 disabled:opacity-40"
                          >
                            {u.role === "admin" ? "取消管理员" : "设为管理员"}
                          </button>
                          <button
                            onClick={() => setRole.mutate({ userId: u.id, role: u.role === "tutor" ? "user" : "tutor" })}
                            disabled={setRole.isPending}
                            className="rounded-lg border border-border bg-cream px-3 py-1.5 text-[12.5px] font-medium text-olive-soft hover:border-olive/40 disabled:opacity-40"
                          >
                            {u.role === "tutor" ? "取消伴学师" : "设为伴学师"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {users?.length === 0 && <p className="px-5 py-8 text-center text-[13px] text-olive-mute">还没有用户。</p>}
              </div>
            )}
          </div>

          {detailId !== null && <UserDetailDrawer userId={detailId} onClose={() => setDetailId(null)} />}
        </>
      )}

      {tab === "students" && <StudentsTab />}
      {tab === "tutors" && <TutorsTab />}
    </div>
  );
}

/** 伴学师下拉选项（分配/更换/解除）。 */
function TutorSelect({
  value,
  studentUserId,
  tutors,
  onDone,
}: {
  value: number | null;
  studentUserId: number;
  tutors: { id: number; name: string }[];
  onDone?: () => void;
}) {
  const utils = trpc.useUtils();
  const assign = trpc.admin.assignTutor.useMutation({
    onSuccess: () => {
      utils.admin.students.invalidate();
      utils.admin.tutors.invalidate();
      onDone?.();
    },
  });
  return (
    <select
      value={value ?? ""}
      disabled={assign.isPending}
      onChange={(e) => {
        const v = e.target.value;
        assign.mutate({ studentUserId, tutorId: v === "" ? null : Number(v) });
      }}
      className="rounded-lg border border-border bg-cream px-2 py-1.5 text-[12px] text-olive outline-none focus:border-lime disabled:opacity-50"
    >
      <option value="">未分配</option>
      {tutors.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

/** 学员 tab：admin.students 列表 + 伴学师分配 + 详情抽屉。 */
function StudentsTab() {
  const [detailId, setDetailId] = useState<number | null>(null);
  const { data: students, isLoading } = trpc.admin.students.useQuery();
  const { data: tutors } = trpc.admin.tutors.useQuery();

  return (
    <div className="paper-card overflow-hidden">
      <div className="border-b border-border px-5 py-3.5">
        <span className="text-[14.5px] font-semibold text-olive">学员列表</span>
        <span className="ml-2 text-[12px] text-olive-mute">{students?.length ?? 0} 位</span>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        </div>
      ) : (
        <div className="divide-y divide-border">
          {students?.map((s) => (
            <div key={s.userId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive text-[14px] font-bold text-cream">
                {(s.name || "学")[0]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-[14.5px] font-semibold text-olive">{s.name}</span>
                  {s.grade && <span className="text-[11.5px] text-olive-mute">{s.grade}</span>}
                  {s.mbti && <span className="chip !py-0.5 !text-[10.5px] text-olive">{s.mbti}</span>}
                  {s.disc && <span className="chip !py-0.5 !text-[10.5px] text-olive">{s.disc}</span>}
                  {s.hasMulti && <span className="chip !py-0.5 !text-[10.5px] text-olive">多元✓</span>}
                  {s.hasAcademics && <span className="chip !py-0.5 !text-[10.5px] text-olive">学业✓</span>}
                </div>
                <div className="mono mt-0.5 text-[11px] text-olive-mute">
                  {s.phone && <>{s.phone} · </>}注册 {new Date(s.createdAt).toLocaleDateString("zh-CN")} · 最近活跃{" "}
                  {new Date(s.lastSignInAt).toLocaleDateString("zh-CN")}
                </div>
                <div className="mono mt-0.5 text-[11px] text-olive-soft">
                  答题 {s.attempts} · 错题 {s.errors} · 计划 {s.plans} · 预习 {s.previewsDone}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TutorSelect value={s.tutorId} studentUserId={s.userId} tutors={tutors ?? []} />
                {/* V53：管理员可重置任意学员登录密码（默认 123456） */}
                <ResetPasswordButton userId={s.userId} name={s.name} />
                <button
                  onClick={() => setDetailId(s.userId)}
                  className="rounded-lg border border-border bg-cream px-3 py-1.5 text-[12.5px] font-medium text-olive hover:border-lime"
                >
                  详情
                </button>
              </div>
            </div>
          ))}
          {students?.length === 0 && <p className="px-5 py-8 text-center text-[13px] text-olive-mute">还没有学员档案。</p>}
        </div>
      )}
      {detailId !== null && <StudentDetailDrawer userId={detailId} source="admin" onClose={() => setDetailId(null)} />}
    </div>
  );
}

/** 伴学师 tab：admin.tutors 列表，行内学员可更换/解除伴学师。 */
function TutorsTab() {
  const { data: tutors, isLoading } = trpc.admin.tutors.useQuery();

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="paper-card flex justify-center py-10">
          <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        </div>
      ) : (
        <>
          {tutors?.map((t) => (
            <div key={t.id} className="paper-card overflow-hidden">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-5 py-3.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-olive text-[14px] font-bold text-cream">
                  {(t.name || "伴")[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] font-semibold text-olive">{t.name}</div>
                  <div className="mono mt-0.5 text-[11px] text-olive-mute">
                    学员 {t.studentCount} 人 · 总答题 {t.totalAttempts} · 最近登录{" "}
                    {new Date(t.lastSignInAt).toLocaleDateString("zh-CN")}
                  </div>
                </div>
              </div>
              <div className="divide-y divide-border">
                {t.students.map((s) => (
                  <div key={s.userId} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="text-[13px] text-olive">
                      {s.name}
                      {s.grade && <span className="ml-1.5 text-[11.5px] text-olive-mute">{s.grade}</span>}
                    </span>
                    <span className="ml-auto">
                      <TutorSelect value={t.id} studentUserId={s.userId} tutors={tutors} />
                    </span>
                  </div>
                ))}
                {t.students.length === 0 && (
                  <p className="px-5 py-4 text-[12.5px] text-olive-mute">还没有分配学员，可在「学员」tab 里分配。</p>
                )}
              </div>
            </div>
          ))}
          {tutors?.length === 0 && (
            <p className="paper-card px-5 py-8 text-center text-[13px] text-olive-mute">
              还没有伴学师——在「总览」tab 的用户列表里可以把用户设为伴学师。
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** 用户详情抽屉：最近答题动态 + 近 7 条心情分（不看内容）。 */
function UserDetailDrawer({ userId, onClose }: { userId: number; onClose: () => void }) {
  const { data, isLoading } = trpc.admin.userDetail.useQuery({ userId });
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-olive/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-cream p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-olive">用户详情</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-olive-mute hover:bg-lime-pale hover:text-olive">
            <X size={18} />
          </button>
        </div>
        {isLoading || !data ? (
          <div className="flex justify-center py-10">
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="paper-card p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-olive text-[15px] font-bold text-cream">
                  {(data.user.name ?? "学")[0]}
                </span>
                <div>
                  <div className="text-[15px] font-semibold text-olive">{data.user.name ?? "未命名"}</div>
                  <div className="mono text-[11px] text-olive-mute">
                    {data.user.role === "admin" ? "管理员" : data.user.role === "tutor" ? "伴学师" : "普通用户"} · 完成预习{" "}
                    {data.previewsDone} 次
                  </div>
                </div>
              </div>
            </div>

            <div className="paper-card p-4">
              <div className="mono text-[10px] tracking-wider text-olive-mute">近 7 次心情分（内容保密）</div>
              <div className="mt-2.5 flex items-end gap-2">
                {data.moodRecent.length === 0 && <p className="text-[12.5px] text-olive-mute">还没有心情记录。</p>}
                {[...data.moodRecent].reverse().map((m, i) => (
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
                {data.recentAttempts.length === 0 && <p className="text-[12.5px] text-olive-mute">还没有答题记录。</p>}
                {data.recentAttempts.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12.5px]">
                    <span className={`h-2 w-2 rounded-full ${a.correct ? "bg-lime" : "bg-terra"}`} />
                    <span className="text-olive-soft">{a.stage}</span>
                    <span className="mono ml-auto text-[11px] text-olive-mute">
                      {new Date(a.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
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
