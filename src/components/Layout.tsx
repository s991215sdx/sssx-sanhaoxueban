import { NavLink } from "react-router";
import { Home, BookOpenCheck, Bandage, ClipboardList, HeartHandshake, Sprout, LineChart, LogOut, ShieldCheck, GraduationCap, ClipboardCheck, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

const NAV = [
  { to: "/", label: "首页", icon: Home },
  { to: "/preview", label: "预习中心", icon: BookOpenCheck },
  { to: "/gaps", label: "查漏补缺", icon: Bandage },
  { to: "/assessments", label: "测评中心", icon: ClipboardCheck },
  { to: "/papers", label: "试卷分析", icon: ClipboardList },
  { to: "/treehole", label: "树洞心情", icon: HeartHandshake },
  { to: "/companion", label: "伴学师", icon: Sprout },
  { to: "/report", label: "学习报告", icon: LineChart },
];

const MOBILE_NAV = [
  { to: "/", label: "首页", icon: Home },
  { to: "/preview", label: "预习", icon: BookOpenCheck },
  { to: "/gaps", label: "查漏", icon: Bandage },
  { to: "/assessments", label: "测评", icon: ClipboardCheck },
  { to: "/treehole", label: "树洞", icon: HeartHandshake },
  { to: "/companion", label: "我的", icon: Sprout },
];

/** 品牌标志图形（侧边栏折叠态与完整 Logo 共用）。 */
function LogoMark() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="31" height="31" rx="9" fill="#35421e" />
      <path d="M17 25c0-6.5 1.5-11 7-14-.5 6.5-2 11.5-7 14Z" fill="#9ccb52" />
      <path d="M17 25c0-6.5-1.5-11-7-14 .5 6.5 2 11.5 7 14Z" fill="#cfe07a" />
      <circle cx="17" cy="9.5" r="2.2" fill="#f9de81" />
    </svg>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div>
        <div className="font-bold text-[17px] leading-tight tracking-tight text-olive">三好学伴</div>
        <div className="mono text-[10px] tracking-wider text-olive-mute">K12 · 个性化学习</div>
      </div>
    </div>
  );
}

/** 用户名首字头像。 */
function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-olive text-[14px] font-bold text-cream">
      {(name || "学")[0]}
    </span>
  );
}

const COLLAPSE_KEY = "sanhao-nav-collapsed";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";
  const showCoach = isAdmin || user?.role === "tutor";
  const displayName = user?.name?.trim() || "同学";
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
          className="absolute -right-3.5 top-9 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-cream-card text-olive-mute shadow-sm transition-colors hover:bg-lime-pale hover:text-olive"
        >
          {collapsed ? <ChevronsRight size={15} strokeWidth={2.4} /> : <ChevronsLeft size={15} strokeWidth={2.4} />}
        </button>
        {collapsed ? (
          <div className="flex justify-center" title="三好学伴">
            <LogoMark />
          </div>
        ) : (
          <Logo />
        )}
        <nav className={`mt-10 flex flex-col gap-1.5 ${collapsed ? "items-center" : ""}`}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              title={collapsed ? n.label : undefined}
              className={({ isActive }) =>
                `group flex items-center rounded-xl transition-colors ${
                  collapsed ? "w-10 justify-center px-0 py-2.5" : "gap-3 px-3.5 py-2.5 text-[15px]"
                } ${isActive ? "bg-lime-pale font-semibold text-olive" : "text-olive-soft hover:bg-lime-pale/50"}`
              }
            >
              <n.icon size={18} strokeWidth={2.2} />
              {!collapsed && n.label}
            </NavLink>
          ))}
          {showCoach && (
            <NavLink
              to="/tutor"
              title={collapsed ? "伴学工作台" : undefined}
              className={({ isActive }) =>
                `group flex items-center rounded-xl transition-colors ${
                  collapsed ? "w-10 justify-center px-0 py-2.5" : "gap-3 px-3.5 py-2.5 text-[15px]"
                } ${isActive ? "bg-lime-pale font-semibold text-olive" : "text-olive-soft hover:bg-lime-pale/50"}`
              }
            >
              <GraduationCap size={18} strokeWidth={2.2} />
              {!collapsed && "伴学工作台"}
            </NavLink>
          )}
          {isAdmin && (
            <NavLink
              to="/admin"
              title={collapsed ? "后台管理" : undefined}
              className={({ isActive }) =>
                `group flex items-center rounded-xl transition-colors ${
                  collapsed ? "w-10 justify-center px-0 py-2.5" : "gap-3 px-3.5 py-2.5 text-[15px]"
                } ${isActive ? "bg-lime-pale font-semibold text-olive" : "text-olive-soft hover:bg-lime-pale/50"}`
              }
            >
              <ShieldCheck size={18} strokeWidth={2.2} />
              {!collapsed && "后台管理"}
            </NavLink>
          )}
        </nav>
        {collapsed ? (
          <div className="mt-auto flex flex-col items-center gap-2.5">
            <span title={displayName}>
              <Avatar name={displayName} />
            </span>
            <button
              onClick={logout}
              title="退出登录"
              className="rounded-lg p-1.5 text-olive-mute transition-colors hover:bg-lime-pale hover:text-olive"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="mt-auto space-y-3">
            <div className="rounded-xl border border-border bg-butter/50 p-3.5">
              <div className="mono text-[10px] tracking-wider text-olive-mute">学习心法</div>
              <p className="mt-1 text-[13px] leading-relaxed text-olive">
                先预习，带着问题听课；
                <br />
                错题找根因，间隔来复习。
              </p>
            </div>
            {/* 当前用户 */}
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-cream-card p-3">
              <Avatar name={displayName} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold text-olive">{displayName}</div>
                <div className="mono text-[10px] text-olive-mute">{isAdmin ? "管理员" : "好好学习的账号"}</div>
              </div>
              <button
                onClick={logout}
                title="退出登录"
                className="rounded-lg p-1.5 text-olive-mute transition-colors hover:bg-lime-pale hover:text-olive"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* 移动顶栏 */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-cream/90 px-4 py-3 backdrop-blur md:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          {showCoach && (
            <NavLink to="/tutor" className="rounded-lg p-2 text-olive-mute hover:bg-lime-pale hover:text-olive" title="伴学工作台">
              <GraduationCap size={18} />
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/admin" className="rounded-lg p-2 text-olive-mute hover:bg-lime-pale hover:text-olive" title="后台管理">
              <ShieldCheck size={18} />
            </NavLink>
          )}
          <span className="flex items-center gap-1.5">
            <Avatar name={displayName} />
          </span>
          <button onClick={logout} title="退出登录" className="rounded-lg p-2 text-olive-mute hover:bg-lime-pale hover:text-olive">
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <main className={`pb-24 transition-all duration-200 md:pb-10 ${collapsed ? "md:pl-[68px]" : "md:pl-60"}`}>
        <div className="mx-auto max-w-5xl px-4 pt-6 md:px-8 md:pt-8">{children}</div>
      </main>

      {/* 移动底部导航 */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-cream-card/95 backdrop-blur md:hidden">
        {MOBILE_NAV.map((n) => (
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
    </div>
  );
}
