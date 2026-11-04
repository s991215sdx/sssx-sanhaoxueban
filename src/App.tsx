import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router";
import { moduleForPath } from "@contracts/studentModules";
import { isPlaceholderName } from "@contracts/constants";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import { trpc } from "./providers/trpc";
import { useAuth } from "@/hooks/useAuth";

/* v232 首屏提速：全部页面懒加载——首屏只带运行时+Layout+Login，其余路由按需下载 */
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PreviewList = lazy(() => import("./pages/PreviewList"));
const PreviewSession = lazy(() => import("./pages/PreviewSession"));
const Gaps = lazy(() => import("./pages/Gaps"));
const Welcome = lazy(() => import("./pages/Welcome"));
const Companion = lazy(() => import("./pages/Companion"));
const Papers = lazy(() => import("./pages/Papers"));
const Treehole = lazy(() => import("./pages/Treehole"));
const InviteRegister = lazy(() => import("./pages/InviteRegister"));
/* v238：家长扫码填家长卷（公开，不需要账号） */
const FamilyJoin = lazy(() => import("./pages/FamilyJoin"));
/* v239 测评码：伴学师出码，孩子或家长扫码当场作答（公开路由） */
const PassJoin = lazy(() => import("./pages/PassJoin"));
const SsoStudentView = lazy(() => import("./pages/SsoStudentView"));
const Admin = lazy(() => import("./pages/Admin"));
const Tutor = lazy(() => import("./pages/Tutor"));
const Library = lazy(() => import("./pages/Library"));
const RecycleBin = lazy(() => import("./pages/RecycleBin"));
const ProfileStage = lazy(() => import("@/components/welcome/ProfileStage"));

const Report = lazy(() => import("./pages/Report"));
const ReportDetail = lazy(() => import("./pages/ReportDetail"));
const ZhihuiReport = lazy(() => import("./pages/ZhihuiReport"));
const LearnFlow = lazy(() => import("./pages/LearnFlow"));
const AssessmentCenter = lazy(() => import("./pages/AssessmentCenter"));

function PageSpinner() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
      <p className="mono text-sm text-olive-mute">加载中…</p>
    </div>
  );
}

function FullScreenLoading({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream">
      <div className="h-11 w-11 animate-spin rounded-full border-[3px] border-olive border-t-transparent" />
      <p className="mono text-sm text-olive-mute">{text}</p>
    </div>
  );
}

/** 登录守卫：未登录 → /login（v226：保留 query，如 ?portal= 品牌化预览参数）。 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <FullScreenLoading text="学伴唤醒中…" />;
  if (!isAuthenticated) return <Navigate to={`/login${location.search}`} replace />;
  return <>{children}</>;
}

/** 档案守卫：无档案，或未走完引导且未点过「稍后再测」→ 先去 /welcome。V61：管理员/伴学师不走学员引导。v200：教务同 staff 待遇。 */
function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isStaff = user?.role === "admin" || user?.role === "tutor" || user?.role === "jiaowu";
  const { data: profile, isLoading } = trpc.profile.get.useQuery(undefined, { enabled: !isStaff });

  if (isStaff) return <>{children}</>;
  if (isLoading) return <FullScreenLoading text="正在打开你的学习档案…" />;
  const skipped = typeof window !== "undefined" && localStorage.getItem("onboardingSkipped");
  if (!profile || (!profile.onboarded && !skipped)) {
    return <Navigate to="/welcome" replace />;
  }
  return <>{children}</>;
}

/** v76 基本信息门禁：占位名（同学/同学+尾号，邀请注册默认名）一律先补全真实姓名，才能进入任何学习与测评页面。 */
function BasicsGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isStaff = user?.role === "admin" || user?.role === "tutor" || user?.role === "jiaowu";
  const { data: profile, isLoading } = trpc.profile.get.useQuery(undefined, { enabled: !isStaff });
  if (isStaff) return <>{children}</>;
  if (isLoading) return <FullScreenLoading text="正在打开你的学习档案…" />;
  if (!profile || isPlaceholderName(profile.name)) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="paper-card p-6">
          <h2 className="text-lg font-bold text-olive">先认识一下你</h2>
          <p className="mt-1 text-[14px] text-olive-soft">
            测评需要基于你的基本情况才能给出贴合的解读。花两分钟填好基本信息，就能开始测评。
          </p>
        </div>
        <div className="mt-4">
          {/* v181e：基本信息完成后落到测评中心（不带 queue 参数），由学员自己选要做的测评组合；
             用整页跳转而非 reload，避免重新触发注册套餐的连测队列。 */}
          <ProfileStage onNext={() => window.location.replace("/assessments")} />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

/** 模块门禁：受限学员（enabledModules 非空）只能访问已开启模块；首页直落测评中心。V61：staff 不受限。 */
function ModuleGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isStaff = user?.role === "admin" || user?.role === "tutor" || user?.role === "jiaowu";
  const { data: profile } = trpc.profile.get.useQuery(undefined, { enabled: !isStaff });
  const location = useLocation();
  if (isStaff) return <>{children}</>;
  const mods = profile?.enabledModules;
  if (mods != null) {
    const key = moduleForPath(location.pathname);
    /* v181e：报告模块不再受模块开关限制——注册学员做完测评后应能进入报告中心，
       报告内容本身仍由页内发布状态（reportReleased / 渠道放行）控制，不会泄漏。 */
    if (key === "home" || (key != null && key !== "assessments" && key !== "report" && !mods.includes(key))) {
      return <Navigate to="/assessments" replace />;
    }
  }
  return <>{children}</>;
}

/**
 * V61 三系统分离·角色门禁：
 * 管理员/伴学师只用工作台（/tutor）与后台（/admin），访问学员端页面一律重定向到伴学工作台。
 */
function RoleGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const isStaff = user?.role === "admin" || user?.role === "tutor";
  /* v200：教务只允许进 /admin（学员分配台），访问其它学员端页面一律回 /admin */
  if (user?.role === "jiaowu") {
    if (location.pathname !== "/admin") return <Navigate to="/admin" replace />;
    return <>{children}</>;
  }
  const staffPaths = ["/tutor", "/admin", "/recycle-bin", "/library", "/zhihui-report"];
  const onStaffPath = staffPaths.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));
  if (isStaff && !onStaffPath) {
    return <Navigate to="/tutor" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* 登录页：公开 */}
      <Route path="/login" element={<Login />} />
      {/* 邀请注册落地页：公开（扫码直达，无需登录） */}
      <Route path="/invite/:code" element={<Suspense fallback={<PageSpinner />}><InviteRegister /></Suspense>} />
      {/* v238 家庭码：父母扫同一个码填家长卷，答案落到同一个孩子名下（公开，免登录） */}
      <Route path="/f/:code" element={<Suspense fallback={<PageSpinner />}><FamilyJoin /></Suspense>} />
      {/* v239 测评码：一张码对应「某个孩子 + 某份测评」，孩子扫码进自己账号，家长扫码就地作答 */}
      <Route path="/p/:code" element={<Suspense fallback={<PageSpinner />}><PassJoin /></Suspense>} />
      {/* v158：一体通 SSO 免登只读视图：公开路由（ticket 兑换 10 分钟短会话，仅可读对应学员） */}
      <Route path="/sso/view/:studentId" element={<Suspense fallback={<PageSpinner />}><SsoStudentView /></Suspense>} />
      {/* 首次引导：需登录，不套 Layout，不做档案守卫 */}
      <Route
        path="/welcome"
        element={
          <AuthGate>
            <Suspense fallback={<FullScreenLoading text="正在准备引导…" />}>
              <Welcome />
            </Suspense>
          </AuthGate>
        }
      />
      <Route
        path="*"
        element={
          <AuthGate>
            <ProfileGuard>
              <ModuleGate>
                <RoleGate>
                <Layout>
                <Suspense fallback={<PageSpinner />}>
                  {/* v76：基本信息门禁包裹全部学员端页面——占位名一律先补全，才能进入测评与学习内容 */}
                  <BasicsGate>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/preview" element={<PreviewList />} />
                    <Route path="/preview/:code" element={<PreviewSession />} />
                    <Route path="/gaps" element={<Gaps />} />
                    <Route path="/assessments" element={<AssessmentCenter />} />
                    <Route path="/learn/:errorId" element={<LearnFlow />} />
                    <Route path="/papers" element={<Papers />} />
                    <Route path="/treehole" element={<Treehole />} />
                    <Route path="/companion" element={<Companion />} />
                    <Route path="/report" element={<Report />} />
                    <Route path="/report-detail" element={<ReportDetail />} />
                    <Route path="/zhihui-report" element={<ZhihuiReport />} />
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/tutor" element={<Tutor />} />
      <Route path="/library" element={<Library />} />
                    <Route path="/recycle-bin" element={<RecycleBin />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                  </BasicsGate>
                </Suspense>
                </Layout>
                </RoleGate>
              </ModuleGate>
            </ProfileGuard>
          </AuthGate>
        }
      />
    </Routes>
  );
}
