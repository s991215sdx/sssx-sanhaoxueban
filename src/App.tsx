import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import PreviewList from "./pages/PreviewList";
import PreviewSession from "./pages/PreviewSession";
import Gaps from "./pages/Gaps";
import Welcome from "./pages/Welcome";
import Companion from "./pages/Companion";
import Papers from "./pages/Papers";
import Treehole from "./pages/Treehole";
import Login from "./pages/Login";
import Admin from "./pages/Admin";
import Tutor from "./pages/Tutor";
import { trpc } from "./providers/trpc";
import { useAuth } from "@/hooks/useAuth";

const Report = lazy(() => import("./pages/Report"));
const ReportDetail = lazy(() => import("./pages/ReportDetail"));
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

/** 登录守卫：未登录 → /login。 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <FullScreenLoading text="学伴唤醒中…" />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** 档案守卫：无档案，或未走完引导且未点过「稍后再测」→ 先去 /welcome。 */
function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading } = trpc.profile.get.useQuery();

  if (isLoading) return <FullScreenLoading text="正在打开你的学习档案…" />;
  const skipped = typeof window !== "undefined" && localStorage.getItem("onboardingSkipped");
  if (!profile || (!profile.onboarded && !skipped)) {
    return <Navigate to="/welcome" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* 登录页：公开 */}
      <Route path="/login" element={<Login />} />
      {/* 首次引导：需登录，不套 Layout，不做档案守卫 */}
      <Route
        path="/welcome"
        element={
          <AuthGate>
            <Welcome />
          </AuthGate>
        }
      />
      <Route
        path="*"
        element={
          <AuthGate>
            <ProfileGuard>
              <Layout>
                <Suspense fallback={<PageSpinner />}>
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
                    <Route path="/admin" element={<Admin />} />
                    <Route path="/tutor" element={<Tutor />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </Layout>
            </ProfileGuard>
          </AuthGate>
        }
      />
    </Routes>
  );
}
