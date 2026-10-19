import { NavLink, useLocation } from "react-router";
import { Home, BookOpenCheck, Bandage, ClipboardList, HeartHandshake, Sprout, LineChart, LogOut, ShieldCheck, GraduationCap, ClipboardCheck, ChevronsLeft, ChevronsRight, Trash2, Building2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import UpdateToast from "@/components/UpdateToast";
import BackBar from "@/components/BackBar";
import { trpc } from "@/providers/trpc";
import { visibleSchoolGroups, type SchoolItemKey } from "@/components/admin/SchoolConsole";

/** 导航项所属学员端模块（测评中心恒可用；首页属 home，受限学员不显示）。 */
const NAV = [
  { to: "/", label: "首页", icon: Home, module: "home" },
  { to: "/preview", label: "预习中心", icon: BookOpenCheck, module: "preview" },
  { to: "/gaps", label: "查漏补缺", icon: Bandage, module: "gaps" },
  { to: "/assessments", label: "测评中心", icon: ClipboardCheck, module: "assessments" },
  { to: "/papers", label: "试卷分析", icon: ClipboardList, module: "papers" },
  { to: "/treehole", label: "树洞心情", icon: HeartHandshake, module: "treehole" },
  { to: "/companion", label: "伴学师", icon: Sprout, module: "companion" },
  { to: "/report", label: "学习报告", icon: LineChart, module: "report" },
];

const MOBILE_NAV = [
  { to: "/", label: "首页", icon: Home, module: "home" },
  { to: "/preview", label: "预习", icon: BookOpenCheck, module: "preview" },
  { to: "/gaps", label: "查漏", icon: Bandage, module: "gaps" },
  { to: "/assessments", label: "测评", icon: ClipboardCheck, module: "assessments" },
  { to: "/treehole", label: "树洞", icon: HeartHandshake, module: "treehole" },
  { to: "/companion", label: "我的", icon: Sprout, module: "companion" },
];

/** 品牌标志图形（侧边栏折叠态与完整 Logo 共用）。 */
function LogoMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="31" height="31" rx="9" fill="#0C7064" />
      <path d="M17 25c0-6.5 1.5-11 7-14-.5 6.5-2 11.5-7 14Z" fill="#8EBD86" />
      <path d="M17 25c0-6.5-1.5-11-7-14 .5 6.5 2 11.5 7 14Z" fill="#CDE3CC" />
      <circle cx="17" cy="9.5" r="2.2" fill="#FCCE45" />
    </svg>
  );
}

function Logo({ brand }: { brand: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div>
        <div className="font-bold text-[17px] leading-tight tracking-tight text-olive">{brand}</div>
        <div className="mono text-[10px] tracking-wider text-olive-mute">K12 · 个性化学习</div>
      </div>
    </div>
  );
}

/** 用户名首字头像。 */
function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-[14px] font-bold text-cream">
      {(name || "学")[0]}
    </span>
  );
}

/**
 * v177 多机构超管：同手机号名下有多个机构账号时，给出机构切换入口。
 * 切换 = 后端校验同手机号后重新签发会话，成功后整页刷新重置缓存。
 */
function OrgSwitcher() {
  const { data: accounts } = trpc.auth.accountsList.useQuery();
  const switchMut = trpc.auth.accountsSwitch.useMutation();
  const [open, setOpen] = useState(false);
  const list = (accounts ?? []).filter((a) => !a.deleted);
  if (list.length < 2) return null;
  const label = (a: (typeof list)[number]) =>
    a.brandName ?? a.orgName ?? (a.orgId == null ? "三好学伴平台" : "机构账号");
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={`切换机构（共 ${list.length} 个身份）`}
        className="rounded-lg p-1.5 text-olive-mute transition-colors hover:bg-butter-pale hover:text-brand"
      >
        <Building2 size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute bottom-9 right-0 z-50 w-60 rounded-xl border border-border bg-white p-1.5 shadow-[0_8px_30px_-6px_rgba(11,61,46,.25)]">
            <div className="px-2.5 py-1.5 text-[11px] text-olive-mute">切换机构身份</div>
            {list.map((a) => (
              <button
                key={a.userId}
                type="button"
                disabled={a.current || switchMut.isPending}
                onClick={() =>
                  switchMut.mutate(
                    { userId: a.userId },
                    { onSuccess: () => window.location.reload() },
                  )
                }
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                  a.current ? "bg-mint-pale/60 font-semibold text-olive" : "text-olive-soft hover:bg-butter-pale"
                }`}
              >
                <span className="truncate">{label(a)}</span>
                {a.current && <span className="ml-auto text-[10px] text-brand">当前</span>}
                {!a.current && a.role === "admin" && <span className="ml-auto text-[10px] text-olive-mute">超管</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const COLLAPSE_KEY = "sanhao-nav-collapsed";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const isPlatformAdmin = isAdmin && user?.orgId == null;
  const showCoach = isAdmin || user?.role === "tutor";
  const displayName = user?.name?.trim() || "同学";
  /* V59 SaaS：机构品牌名（商标）；平台超管与未登录一律显示平台品牌 */
  const brand = user?.org?.brandName ?? "三好学伴";
  const orgPaused = !!user?.org && !user.org.active;
  /* V61 三系统分离：管理员/伴学师/教务用工作台，不显示学员端服务功能导航（v200：教务纳入） */
  const isStaff = user?.role === "admin" || user?.role === "tutor" || user?.role === "jiaowu";
  /* 学员端功能开关（v50）：null=全功能；数组=只显示这些模块（测评中心恒显示） */
  const { data: profile } = trpc.profile.get.useQuery();
  const enabledModules = profile?.enabledModules ?? null;
  const navVisible = (m: string) => enabledModules === null || m === "assessments" || enabledModules.includes(m);

  /* v220.3：校园机构判定（机构管理员/教务）——学校版后台菜单并入外层侧边栏，隐藏伴学工作台 */
  const { data: schoolCtx } = trpc.school.context.useQuery(undefined, {
    enabled: (isAdmin && !isPlatformAdmin) || user?.role === "jiaowu",
  });
  const isCampus = !!schoolCtx?.campus;
  const isJiaowu = user?.role === "jiaowu";
  /* 学校版的管理者（校长/教务）：侧边栏直接列出控制台菜单。
     v220.5：平台超管（orgId=null）一律走原版界面——school.context 对超管返回 campus=true
     （表示「存在校园机构」而非「我是校园机构」），不能据此切换学校版。 */
  const campusMgr = isCampus && user?.orgId != null && (isAdmin || isJiaowu);
  /* v220.5：超管的「伴学工作台」称谓不跟校园版走 */
  const campusTutor = isCampus && user?.orgId != null;
  const schoolGroups = campusMgr ? visibleSchoolGroups(isJiaowu) : [];
  const location = useLocation();
  const campusItemActive = (key: SchoolItemKey) => {
    if (location.pathname !== "/admin") return false;
    const cur = new URLSearchParams(location.search).get("item");
    const first = schoolGroups[0]?.items[0]?.key;
    return (cur ?? first ?? "progress") === key;
  };
  /* 桌面侧边栏折叠态：记住用户选择，折叠后只留图标，给阅读区让出最大空间 */
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggleCollapsed = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* 私密模式等场景下静默忽略 */
      }
      return next;
    });

  /* v80：手机从左向右滑 = 返回上一步（全局手势，输入控件/横向滚动容器自动豁免） */
  useSwipeBack();

  return (
    <div className="min-h-screen bg-cream">
      {/* 桌面侧边栏：可点击右缘按钮折叠为窄图标栏 */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-cream-card/80 py-6 backdrop-blur transition-all duration-200 md:flex ${
          collapsed ? "w-[68px] px-2" : "w-60 px-5"
        }`}
      >
        {/* 折叠/展开开关（贴在栏右缘） */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "展开侧边栏" : "收起侧边栏，给阅读区让出空间"}
          aria-label={collapsed ? "展开侧边栏" : "收起侧边栏，给阅读区让出空间"}
          className="absolute -right-3.5 top-9 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-cream-card text-olive-mute shadow-sm transition-colors hover:bg-butter-pale hover:text-brand"
        >
          {collapsed ? <ChevronsRight size={15} strokeWidth={2.4} /> : <ChevronsLeft size={15} strokeWidth={2.4} />}
        </button>
        {collapsed ? (
          <div className="flex justify-center" title={brand}>
            <LogoMark />
          </div>
        ) : (
          <Logo brand={brand} />
        )}
        {/* v224：侧栏可滚动但滚条完全隐形（保留滚动功能，无滚条痕迹） */}
        <nav className={`mt-10 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${collapsed ? "items-center" : ""}`}>
          {/* V61：管理员/伴学师不显示学员端功能（预习/查漏/测评/树洞/报告等），只看工作台 */}
          {!isStaff && NAV.filter((n) => navVisible(n.module)).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              title={collapsed ? n.label : undefined}
              className={({ isActive }) =>
                `group flex items-center rounded-xl transition-colors ${
                  collapsed ? "w-10 justify-center px-0 py-2.5" : "gap-3 px-3.5 py-2.5 text-[15px]"
                } ${isActive ? "bg-brand font-semibold text-white shadow-sm" : "text-olive-soft hover:bg-butter-pale/60"}`
              }
            >
              <n.icon size={18} strokeWidth={2.2} />
              {!collapsed && n.label}
            </NavLink>
          ))}
          {/* v220.3：学校版管理者隐藏「伴学工作台」，侧边栏直接列出学校版控制台菜单（与回收站并列） */}
          {showCoach && !campusMgr && (
            <NavLink
              to="/tutor"
              title={collapsed ? (campusTutor ? "指导老师工作台" : "伴学工作台") : undefined}
              className={({ isActive }) =>
                `group flex items-center rounded-xl transition-colors ${
                  collapsed ? "w-10 justify-center px-0 py-2.5" : "gap-3 px-3.5 py-2.5 text-[15px]"
                } ${isActive ? "bg-brand font-semibold text-white shadow-sm" : "text-olive-soft hover:bg-butter-pale/60"}`
              }
            >
              <GraduationCap size={18} strokeWidth={2.2} />
              {!collapsed && (campusTutor ? "指导老师工作台" : "伴学工作台")}
            </NavLink>
          )}
          {campusMgr &&
            schoolGroups.map((g) => (
              <div key={g.label} className={collapsed ? "flex flex-col items-center gap-1" : ""}>
                {!collapsed && (
                  <div className="px-3.5 pb-1 pt-2 text-[10.5px] font-bold tracking-wider text-olive-mute/80">{g.label}</div>
                )}
                {g.items.map((it) => (
                  <NavLink
                    key={it.key}
                    to={`/admin?item=${it.key}`}
                    title={collapsed ? it.label : undefined}
                    className={`group flex items-center rounded-xl transition-colors ${
                      collapsed ? "w-10 justify-center px-0 py-2.5" : "gap-3 px-3.5 py-2.5 text-[15px]"
                    } ${campusItemActive(it.key) ? "bg-brand font-semibold text-white shadow-sm" : "text-olive-soft hover:bg-butter-pale/60"}`}
                  >
                    <it.icon size={18} strokeWidth={2.2} />
                    {!collapsed && it.label}
                  </NavLink>
                ))}
              </div>
            ))}
          {isAdmin && !campusMgr && (
            <NavLink
              to="/admin"
              title={collapsed ? "后台管理" : undefined}
              className={({ isActive }) =>
                `group flex items-center rounded-xl transition-colors ${
                  collapsed ? "w-10 justify-center px-0 py-2.5" : "gap-3 px-3.5 py-2.5 text-[15px]"
                } ${isActive ? "bg-brand font-semibold text-white shadow-sm" : "text-olive-soft hover:bg-butter-pale/60"}`
              }
            >
              <ShieldCheck size={18} strokeWidth={2.2} />
              {!collapsed && "后台管理"}
            </NavLink>
          )}
          {/* v200：教务的唯一入口：学员分配台（RoleGate 把教务的其它访问全部重定向到 /admin）；v220.3：校园教务改走学校版菜单 */}
          {user?.role === "jiaowu" && !campusMgr && (
            <NavLink
              to="/admin"
              title={collapsed ? "学员分配台" : undefined}
              className={({ isActive }) =>
                `group flex items-center rounded-xl transition-colors ${
                  collapsed ? "w-10 justify-center px-0 py-2.5" : "gap-3 px-3.5 py-2.5 text-[15px]"
                } ${isActive ? "bg-brand font-semibold text-white shadow-sm" : "text-olive-soft hover:bg-butter-pale/60"}`}
            >
              <ShieldCheck size={18} strokeWidth={2.2} />
              {!collapsed && "学员分配台"}
            </NavLink>
          )}
          {/* v96：回收站（已删学员 2 个月保留期，可恢复） */}
          {showCoach && (
            <NavLink
              to="/recycle-bin"
              title={collapsed ? "回收站" : undefined}
              className={({ isActive }) =>
                `group flex items-center rounded-xl transition-colors ${
                  collapsed ? "w-10 justify-center px-0 py-2.5" : "gap-3 px-3.5 py-2.5 text-[15px]"
                } ${isActive ? "bg-brand font-semibold text-white shadow-sm" : "text-olive-soft hover:bg-butter-pale/60"}`
              }
            >
              <Trash2 size={18} strokeWidth={2.2} />
              {!collapsed && "回收站"}
            </NavLink>
          )}
        </nav>
        {/* v104：侧栏底部低存在感树苗装饰，呼应「三好树」品牌意象 */}
        <div className={`mt-auto flex items-center gap-1.5 text-[10px] text-olive-mute/70 ${collapsed ? "justify-center" : "px-3.5"}`}>
          <Sprout size={14} strokeWidth={1.8} />
          {!collapsed && <span>伴每一棵小树，长成大树</span>}
        </div>
        {collapsed ? (
          <div className="mt-auto flex flex-col items-center gap-2.5">
            <span title={displayName}>
              <Avatar name={displayName} />
            </span>
            <OrgSwitcher />
            <button
              onClick={logout}
              title="退出登录"
              className="rounded-lg p-1.5 text-olive-mute transition-colors hover:bg-butter-pale hover:text-brand"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="mt-auto space-y-3">
            {!isStaff && (
              <div className="rounded-xl border border-border bg-butter/50 p-3.5">
                <div className="mono text-[10px] tracking-wider text-olive-mute">学习心法</div>
                <p className="mt-1 text-[13px] leading-relaxed text-olive">
                  先预习，带着问题听课；
                  <br />
                  错题找根因，间隔来复习。
                </p>
              </div>
            )}
            {/* 当前用户 */}
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-cream-card p-3">
              <Avatar name={displayName} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-olive">{displayName}</div>
                <div className="mono text-[10px] text-olive-mute">
                  {isPlatformAdmin ? "平台超管" : isAdmin ? "管理员" : user?.role === "jiaowu" ? "教务" : "好好学习的账号"}
                </div>
              </div>
              <OrgSwitcher />
              <button
                onClick={logout}
                title="退出登录"
                className="rounded-lg p-1.5 text-olive-mute transition-colors hover:bg-butter-pale hover:text-brand"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* 移动顶栏 */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-cream/90 px-4 py-3 backdrop-blur md:hidden">
        <Logo brand={brand} />
        <div className="flex items-center gap-2">
          {showCoach && !campusMgr && (
            <NavLink to="/tutor" className="rounded-lg p-2 text-olive-mute hover:bg-butter-pale hover:text-brand" title={campusTutor ? "指导老师工作台" : "伴学工作台"}>
              <GraduationCap size={18} />
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className="rounded-lg p-2 text-olive-mute hover:bg-butter-pale hover:text-brand" title="后台管理">
              <ShieldCheck size={18} />
            </NavLink>
          )}
          <span className="flex items-center gap-1.5">
            <Avatar name={displayName} />
          </span>
          <OrgSwitcher />
          <button onClick={logout} title="退出登录" className="rounded-lg p-2 text-olive-mute hover:bg-butter-pale hover:text-brand">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <main className={`pb-24 transition-all duration-200 md:pb-10 ${collapsed ? "md:pl-[68px]" : "md:pl-60"}`}>
        {/* V59：机构被平台停用时的提示条（学员/伴学师/机构管理员都能看到） */}
        {orgPaused && (
          <div className="border-b border-terra/30 bg-terra/10 px-4 py-2.5 text-center text-[12.5px] text-terra">
            本机构服务已暂停，部分功能可能不可用。如有疑问请联系机构老师。
          </div>
        )}
        {/* v87/v93：桌面端内容区加白色卡片背景板；v93 起 2xl 超大屏放宽到 1560px，消灭两侧大片留白；移动端保持全宽 */}
        <div className="mx-auto max-w-5xl px-4 pt-6 md:max-w-6xl md:px-5 md:pt-5 lg:max-w-7xl 2xl:max-w-[1560px]">
          <div className="md:paper-card md:min-h-[calc(100vh-4.5rem)] md:px-8 md:py-7">
            <BackBar />
            {children}
          </div>
        </div>
      </main>

      {/* v71：新版本提示（服务器发新版后弹"立即刷新"，治 webview 缓存旧包） */}
      <UpdateToast />

      {/* 移动底部导航（V61：管理员/伴学师没有学员端功能，不显示底部学员导航） */}
      {!isStaff && (
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-border bg-cream-card/95 backdrop-blur md:hidden"
        style={{ gridTemplateColumns: `repeat(${MOBILE_NAV.filter((n) => navVisible(n.module)).length}, minmax(0, 1fr))` }}
      >
        {MOBILE_NAV.filter((n) => navVisible(n.module)).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[11px] ${isActive ? "font-semibold text-olive" : "text-olive-mute"}`
            }
          >
            <n.icon size={20} strokeWidth={2.2} />
            {n.label}
          </NavLink>
        ))}
      </nav>
      )}
    </div>
  );
}
