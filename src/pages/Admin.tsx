import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router";
import InviteChannelsTab from "@/components/admin/InviteChannelsTab";
import OrgAdminTab from "@/components/admin/OrgAdminTab";
import ResetPasswordButton from "@/components/ResetPasswordButton";
import DeleteStudentButton from "@/components/DeleteStudentButton";
import SchoolConsole from "@/components/admin/SchoolConsole";
import StudentsTab from "@/components/admin/StudentsTab";
import TutorsTab from "@/components/admin/TutorsTab";
import XuankeWeightPanel from "@/components/admin/XuankeWeightPanel";
import { ShieldCheck, Users, BookOpenCheck, Bandage, ClipboardList, HeartHandshake, PenLine, X, Search, Library as LibraryIcon } from "lucide-react";
import Pager from "@/components/Pager";
import { usePager } from "@/hooks/usePager";

/** 后台管理：机构管理员=总览/学员/伴学师/注册邀请；平台超管=机构管理（总系统）。v200：教务=只进学员分配台。
 *  v220.1：校园机构（粤华等）管理员/教务进学校版控制台（左侧栏），且全站改称「指导老师」。 */
export default function Admin() {
  const { user, refresh } = useAuth();
  const isAdmin = user?.role === "admin";
  const isPlatformAdmin = isAdmin && user?.orgId == null;
  const isJiaowu = user?.role === "jiaowu";
  /* 校园机构判定：机构管理员与教务都查询 */
  const { data: schoolCtx } = trpc.school.context.useQuery(undefined, {
    enabled: (isAdmin && !isPlatformAdmin) || isJiaowu,
  });

  if (isJiaowu) {
    if (schoolCtx?.campus) return <SchoolConsole selfName={user?.name ?? "教务"} jiaowu />;
    return (
      <div className="space-y-5">
        <header>
          <h1 className="text-[22px] font-bold tracking-tight text-[#1E3530]">学员分配台</h1>
          <p className="mt-1 text-[13px] text-olive-mute">
            可搜索学员（支持手机号）、分配伴学师、给伴学师开启/关闭学员报告查看权限。手机号已脱敏，完整号码不可见。
          </p>
        </header>
        <StudentsTab jiaowu orgScope={{ orgId: null }} />
      </div>
    );
  }

  if (!isAdmin) {
    return <ClaimAdminCard onClaimed={() => refresh()} />;
  }
  /* v220.1：校园机构管理员直接进学校版控制台 */
  if (!isPlatformAdmin && schoolCtx?.campus) {
    return <SchoolConsole selfName={user.name ?? "管理员"} />;
  }
  /* V60：平台超管 = 机构管理 + 全系统数据（god mode）；机构管理员 = 本机构四 tab */
  return <AdminPanel selfId={user.id} onRefresh={refresh} platform={isPlatformAdmin} />;
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
          className="mt-5 w-full rounded-xl bg-brand py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
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
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-butter-pale text-brand">
        <Icon size={19} />
      </span>
      <div>
        <div className="mono text-[20px] font-bold leading-none text-olive">{value}</div>
        <div className="mt-1 text-[12px] text-olive-mute">{label}</div>
      </div>
    </div>
  );
}

type AdminTab = "overview" | "students" | "tutors" | "invites" | "orgs" | "dash" | "xuanke";

const ADMIN_TABS: { key: AdminTab; label: string }[] = [
  { key: "overview", label: "总览" },
  { key: "students", label: "学员" },
  { key: "tutors", label: "伴学师" },
  { key: "invites", label: "注册邀请" },
  { key: "xuanke", label: "选科设置" },
];

function AdminPanel({ selfId, onRefresh, platform = false }: { selfId: number; onRefresh: () => void; platform?: boolean }) {
  const navigate = useNavigate();
  const refresh = onRefresh;
  const [tab, setTab] = useState<AdminTab>(platform ? "dash" : "overview");
  /* v220.1：校园机构的管理员已由外层直接导到学校版控制台，此面板只管普通机构与平台超管 */
  const tabs = platform
    ? [
        { key: "orgs" as AdminTab, label: "机构管理" },
        { key: "dash" as AdminTab, label: "数据仪表盘" },
        ...ADMIN_TABS,
      ]
    : ADMIN_TABS;
  /* V61：平台超管的系统选择器——选某个机构=只看该系统的数据；默认全部 */
  const [orgSel, setOrgSel] = useState<number | "all">("all");
  /* 始终传对象（tRPC input 非可选）；机构管理员的 orgId 会被后端强制为本机构，传 null 无影响 */
  const orgScope = { orgId: platform ? (orgSel === "all" ? null : orgSel) : null };
  const { data: orgsForSel } = trpc.org.list.useQuery(undefined, { enabled: platform });
  const [detailId, setDetailId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { data: overview } = trpc.admin.overview.useQuery(orgScope);
  /* V86：总览用户列表模糊搜索（姓名/手机号/邮箱），防抖 300ms 再发查询 */
  const [userSearch, setUserSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(userSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [userSearch]);
  const { data: users, isLoading } = trpc.admin.users.useQuery({ ...orgScope, search: debouncedSearch || undefined });
  /* v160：用户列表分页（搜索词变化自动回第 1 页） */
  const usersPager = usePager(users ?? [], 20, debouncedSearch);
  const setRole = trpc.admin.setRole.useMutation({
    onSuccess: () => {
      utils.admin.users.invalidate();
      utils.admin.overview.invalidate();
    },
  });
  /* V88：管理员修改用户姓名（后端同步 users + 学员档案，占位名「同学+尾号」可改为真名） */
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const setUserName = trpc.admin.setUserName.useMutation({
    onSuccess: () => {
      utils.admin.users.invalidate();
      setRenamingId(null);
    },
  });
  /* V59：平台超管自举——系统还没有平台超管时，机构管理员可把自己升级为平台超管（总系统） */
  const claimPlatform = trpc.admin.claimPlatformAdmin.useMutation({
    onSuccess: () => refresh(),
  });

  return (
    <div className="space-y-5">
      <header>
        <div className="flex items-center gap-3">
          <h1 className="text-[22px] font-bold tracking-tight text-[#1E3530]">{platform ? "总系统 · 后台管理" : "后台管理"}</h1>
          <button
            type="button"
            onClick={() => navigate("/library")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-cream-card px-3.5 py-2 text-[13px] font-medium whitespace-nowrap text-olive transition-colors hover:bg-mint-pale/60"
          >
            <LibraryIcon size={14} /> 资料库
          </button>
        </div>
        <p className="mt-1 text-[13px] text-olive-mute">
          {platform
            ? "平台超管：可查看所有机构的数据，并可给任意账号开通管理员。树洞内容属于隐私，只看得到心情曲线。"
            : "所有账号的学习概览。树洞内容属于隐私，这里只看得到心情曲线，看不到具体文字。"}
        </p>
        {!platform && (
          <>
            <button
              onClick={() => claimPlatform.mutate()}
              disabled={claimPlatform.isPending}
              className="mt-2 text-[12px] text-olive-mute underline decoration-dotted underline-offset-2 hover:text-olive disabled:opacity-40"
              title="若系统还没有平台超管（总系统），点这里接管"
            >
              {claimPlatform.isPending ? "处理中…" : "我是平台负责人，升级为平台超管"}
            </button>
            {claimPlatform.error && <p className="mt-1 text-[11.5px] text-terra">{claimPlatform.error.message}</p>}
          </>
        )}
      </header>

      {/* Tab 切换 */}
      {/* v127：tab 条白底，选中=草绿色卡（色卡）+白字，未选中=白底墨字 */}
      <div className="flex rounded-xl border border-[#1E3530]/10 bg-white p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg py-2 text-[13px] font-semibold transition ${
              tab === t.key ? "bg-[#0C7064] text-white shadow" : "text-[#1E3530] hover:bg-[#0C7064]/10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "orgs" && <OrgAdminTab />}
      {tab === "dash" && <PlatformDashboard onPickOrg={(id) => { setOrgSel(id); setTab("overview"); }} />}
      {tab === "invites" && <InviteChannelsTab />}
      {/* v221：选科评分权重（机构管理员可调；平台超管只读预览） */}
      {tab === "xuanke" && <XuankeWeightPanel canEdit={!platform} />}
      {/* V61：超管分系统查看——数据类 tab 上方的系统选择器（机构管理员无此条，恒看本机构） */}
      {platform && (tab === "overview" || tab === "students" || tab === "tutors") && (
        <div className="paper-card flex flex-wrap items-center gap-2.5 px-4 py-2.5">
          <span className="text-[12.5px] font-semibold text-olive">查看系统</span>
          <select
            value={orgSel === "all" ? "all" : String(orgSel)}
            onChange={(e) => setOrgSel(e.target.value === "all" ? "all" : Number(e.target.value))}
            className="rounded-lg border border-border bg-cream-card px-2.5 py-1.5 text-[12.5px] text-olive outline-none focus:border-lime"
          >
            <option value="all">全部系统（跨机构合计）</option>
            {(orgsForSel ?? []).map((o) => (
              <option key={o.id} value={String(o.id)}>
                {o.brandName || o.name}
              </option>
            ))}
          </select>
          {orgSel !== "all" && (
            <span className="text-[11.5px] text-olive-mute">当前只显示该系统（机构）的数据</span>
          )}
        </div>
      )}
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

          {/* 用户列表（V86：支持按姓名/手机号/邮箱模糊搜索） */}
          <div className="paper-card overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3.5">
              <span className="text-[14.5px] font-semibold text-olive">用户列表</span>
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-olive-mute" />
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="搜索姓名 / 手机号 / 邮箱"
                  className="w-full rounded-lg border border-border bg-cream-card py-1.5 pl-8 pr-3 text-[12.5px] text-olive outline-none transition-colors placeholder:text-olive-mute/60 focus:border-lime"
                />
              </div>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {usersPager.pageItems.map((u) => (
                  <div key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-[14px] font-bold text-cream">
                      {(u.name || "学")[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {renamingId === u.id ? (
                          <>
                            <input
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              maxLength={32}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && renameValue.trim()) setUserName.mutate({ userId: u.id, name: renameValue });
                                if (e.key === "Escape") setRenamingId(null);
                              }}
                              className="w-32 rounded-lg border border-border bg-cream-card px-2 py-1 text-[13px] text-olive outline-none focus:border-lime"
                            />
                            <button
                              onClick={() => setUserName.mutate({ userId: u.id, name: renameValue })}
                              disabled={setUserName.isPending || !renameValue.trim()}
                              className="rounded-lg border border-border bg-cream-card px-2 py-1 text-[11.5px] font-medium text-olive hover:border-lime disabled:opacity-40"
                            >
                              {setUserName.isPending ? "保存中…" : "保存"}
                            </button>
                            <button
                              onClick={() => setRenamingId(null)}
                              className="rounded-lg px-2 py-1 text-[11.5px] text-olive-mute hover:text-olive"
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="truncate text-[14.5px] font-semibold text-olive">{u.name}</span>
                            <button
                              onClick={() => {
                                setRenamingId(u.id);
                                setRenameValue(u.name);
                              }}
                              className="text-[11px] text-olive-mute underline decoration-dotted underline-offset-2 transition-colors hover:text-olive"
                              title="修改姓名（学员档案会同步更新）"
                            >
                              改名
                            </button>
                          </>
                        )}
                        {renamingId !== u.id && u.role === "admin" && <span className="chip !py-0.5 !text-[10.5px] text-olive">管理员</span>}
                        {renamingId !== u.id && u.role === "tutor" && <span className="chip !py-0.5 !text-[10.5px] text-olive">伴学师</span>}
                        {renamingId !== u.id && u.role === "jiaowu" && <span className="chip !py-0.5 !text-[10.5px] text-olive">教务</span>}
                        {/* V60：超管看全量列表时标注所属机构 */}
                        {renamingId !== u.id && platform && u.orgName && (
                          <span className="chip !py-0.5 !text-[10.5px] text-olive-soft">{u.orgName}</span>
                        )}
                        {renamingId !== u.id && u.id === selfId && <span className="text-[11px] text-olive-mute">（我）</span>}
                        {setUserName.error && renamingId === u.id && (
                          <span className="text-[11px] text-terra">{setUserName.error.message}</span>
                        )}
                      </div>
                      <div className="mono mt-0.5 text-[11px] text-olive-mute">
                        {u.phone ? `手机 ${u.phone} · ` : ""}注册 {new Date(u.createdAt).toLocaleDateString("zh-CN")} · 最近登录{" "}
                        {new Date(u.lastSignInAt).toLocaleDateString("zh-CN")}
                      </div>
                    </div>
                    <div className="mono hidden text-[12px] text-olive-soft sm:block">
                      错题 {u.errors} · 答题 {u.attempts} · 计划 {u.plans}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setDetailId(u.id)}
                        className="rounded-lg border border-border bg-cream-card px-3.5 py-2 text-[13px] font-medium text-olive whitespace-nowrap transition-colors hover:border-[#E3B53A]/50 hover:bg-butter-pale/60"
                      >
                        详情
                      </button>
                      {u.id !== selfId && (
                        <>
                          {/* V60：平台超管可给任意账号开通/取消管理员；机构后台不提供此按钮 */}
                          {platform && (
                            <button
                              onClick={() => setRole.mutate({ userId: u.id, role: u.role === "admin" ? "user" : "admin" })}
                              disabled={setRole.isPending}
                              className="rounded-lg border border-border bg-cream-card px-3.5 py-2 text-[13px] font-medium text-olive whitespace-nowrap transition-colors hover:border-[#E3B53A]/50 hover:bg-butter-pale/60 disabled:opacity-40"
                            >
                              {u.role === "admin" ? "取消管理员" : "设为管理员"}
                            </button>
                          )}
                          {/* v200：教务角色仅平台超管可设置/取消（后端同口径限制） */}
                          {platform && (
                            <button
                              onClick={() => setRole.mutate({ userId: u.id, role: u.role === "jiaowu" ? "user" : "jiaowu" })}
                              disabled={setRole.isPending}
                              className="rounded-lg border border-border bg-cream-card px-3.5 py-2 text-[13px] font-medium text-olive whitespace-nowrap transition-colors hover:border-[#E3B53A]/50 hover:bg-butter-pale/60 disabled:opacity-40"
                            >
                              {u.role === "jiaowu" ? "取消教务" : "设为教务"}
                            </button>
                          )}
                          <button
                            onClick={() => setRole.mutate({ userId: u.id, role: u.role === "tutor" ? "user" : "tutor" })}
                            disabled={setRole.isPending}
                            className="rounded-lg border border-border bg-cream-card px-3.5 py-2 text-[13px] font-medium text-olive whitespace-nowrap transition-colors hover:border-[#E3B53A]/50 hover:bg-butter-pale/60 disabled:opacity-40"
                          >
                            {u.role === "tutor" ? "取消伴学师" : "设为伴学师"}
                          </button>
                          {/* V89：管理员重置该用户登录密码（复用 V53 接口，重置后默认 123456） */}
                          <ResetPasswordButton userId={u.id} name={u.name} />
                          {/* v210：伴学师/教务可移出机构（后端拒绝管理员/超管；学员在学员管理里移出） */}
                          {(u.role === "tutor" || u.role === "jiaowu") && <DeleteStudentButton userId={u.id} name={u.name} />}
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {users?.length === 0 && (
                  <p className="px-5 py-8 text-center text-[13px] text-olive-mute">
                    {debouncedSearch ? `没有匹配「${debouncedSearch}」的用户。` : "还没有用户。"}
                  </p>
                )}
              </div>
            )}
            <Pager page={usersPager.page} totalPages={usersPager.totalPages} total={usersPager.total} onChange={usersPager.setPage} />
          </div>

          {detailId !== null && <UserDetailDrawer userId={detailId} onClose={() => setDetailId(null)} />}
        </>
      )}

      {tab === "students" && <StudentsTab platform={platform} orgScope={orgScope} />}
      {tab === "tutors" && <TutorsTab orgScope={orgScope} />}
    </div>
  );
}


/** 用户详情抽屉：最近答题动态 + 近 7 条心情分（不看内容）。 */
function UserDetailDrawer({ userId, onClose }: { userId: number; onClose: () => void }) {
  const { data, isLoading } = trpc.admin.userDetail.useQuery({ userId });
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-brand/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-cream p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-olive">用户详情</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-olive-mute hover:bg-butter-pale hover:text-brand">
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
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-[15px] font-bold text-cream">
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


/** V61：平台超管数据仪表盘——全系统合计 + 各机构（独立系统）对比；点机构行可跳到该系统的数据视图。 */
function PlatformDashboard({ onPickOrg }: { onPickOrg: (orgId: number) => void }) {
  const { data: rows, isLoading } = trpc.org.dashboard.useQuery();
  const total = (rows ?? []).reduce(
    (acc, r) => ({
      students: acc.students + r.studentCount,
      tutors: acc.tutors + r.tutorCount,
      attempts: acc.attempts + r.attemptCount,
      errors: acc.errors + r.errorCount,
      moods: acc.moods + r.moodCount,
      previews: acc.previews + r.previewCount,
    }),
    { students: 0, tutors: 0, attempts: 0, errors: 0, moods: 0, previews: 0 },
  );

  return (
    <div className="space-y-4">
      {/* 全系统合计 */}
      <div>
        <p className="mb-2 text-[12.5px] font-semibold text-olive-mute">全部系统合计（{(rows ?? []).length} 个独立系统）</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard icon={Users} label="学员总数" value={total.students} />
          <StatCard icon={HeartHandshake} label="伴学师" value={total.tutors} />
          <StatCard icon={PenLine} label="答题记录" value={total.attempts} />
          <StatCard icon={Bandage} label="错题总数" value={total.errors} />
          <StatCard icon={HeartHandshake} label="树洞条数" value={total.moods} />
          <StatCard icon={BookOpenCheck} label="完成预习" value={total.previews} />
        </div>
      </div>

      {/* 各独立系统对比 */}
      <div className="paper-card overflow-hidden">
        <div className="border-b border-border px-5 py-3.5">
          <span className="text-[14.5px] font-semibold text-olive">各独立系统数据</span>
          <span className="ml-2 text-[11.5px] text-olive-mute">点「查看」可按系统筛选总览/学员/伴学师数据</span>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {(rows ?? []).map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14.5px] font-semibold text-olive">{r.brandName || r.name}</span>
                    {!r.active && <span className="chip !py-0.5 !text-[10.5px] text-terra">已停用</span>}
                  </div>
                  <div className="mono mt-0.5 text-[11px] text-olive-mute">
                    学员 {r.studentCount} · 伴学师 {r.tutorCount} · 管理员 {r.adminCount}
                    {r.lastActiveAt && <> · 最近活跃 {new Date(r.lastActiveAt).toLocaleDateString("zh-CN")}</>}
                  </div>
                </div>
                <div className="mono hidden text-[12px] text-olive-soft sm:block">
                  答题 {r.attemptCount} · 错题 {r.errorCount} · 树洞 {r.moodCount} · 预习 {r.previewCount}
                </div>
                <button
                  onClick={() => onPickOrg(r.id)}
                  className="rounded-lg border border-border bg-cream-card px-3.5 py-2 text-[13px] font-medium text-olive whitespace-nowrap transition-colors hover:border-[#E3B53A]/50 hover:bg-butter-pale/60"
                >
                  查看该系统
                </button>
              </div>
            ))}
            {(rows ?? []).length === 0 && (
              <p className="px-5 py-8 text-center text-[13px] text-olive-mute">还没有任何机构，先在「机构管理」里创建。</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
