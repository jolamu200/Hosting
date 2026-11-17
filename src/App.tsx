import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Link } from "react-router";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CurrencyProvider } from "@/hooks/useCurrency";
import { CurrencyPickerModal } from "@/components/CurrencyPickerModal";
import { ToastProvider } from "@/hooks/useToast";
import { Login } from "@/pages/Login";
import { Signup } from "@/pages/Signup";
import { MagicLinkVerify } from "@/pages/MagicLinkVerify";
import { GitHubSuccess } from "@/pages/GitHubSuccess";
import { ResetPassword } from "@/pages/ResetPassword";
import { Dashboard } from "@/pages/Dashboard";
import { Admin } from "@/pages/Admin";
import TopUp from "@/pages/TopUp";
import { Profile } from "@/pages/Profile";
import { Docs } from "@/pages/Docs";
import { Deploy } from "@/pages/Deploy";
import { ServicesBots } from "@/pages/ServicesBots";
import { MyBots } from "@/pages/MyBots";
import { SocialBoosting } from "@/pages/SocialBoosting";
import { DeveloperApi } from "@/pages/DeveloperApi";
import { BotDeployPage } from "@/pages/BotDeployPage";
import { Tutorials } from "@/pages/Tutorials";
import { Contact } from "@/pages/Contact";
import { NotFound } from "@/pages/NotFound";
import { PageLoader } from "@/components/PageLoader";
import Home from "@/pages/Home";
import { Community } from "@/pages/Community";
import { BotFeatures } from "@/pages/BotFeatures";
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { Wrench } from "lucide-react";
import { getPublicMaintenanceStatus } from "@/lib/api";

interface NavLoadingContextType {
  navigateWithLoader: (path: string) => void;
}

const NavLoadingContext = createContext<NavLoadingContextType>({
  navigateWithLoader: () => {}
});

export function useNavLoader() {
  return useContext(NavLoadingContext);
}

function NavLoadingProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const navigateWithLoader = useCallback((path: string) => {
    setLoading(true);
    setTimeout(() => {
      navigate(path);
      setLoading(false);
    }, 400);
  }, [navigate]);

  if (loading) return <PageLoader />;

  return (
    <NavLoadingContext.Provider value={{ navigateWithLoader }}>
      {children}
    </NavLoadingContext.Provider>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: "instant" }); }, [pathname]);
  return null;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return <>{children}</>;
}

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Home />;
}

function AppRoutes() {
  return (
    <NavLoadingProvider>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/auth/magic" element={<MagicLinkVerify />} />
        <Route path="/auth/login" element={<MagicLinkVerify />} />
        <Route path="/auth/verify" element={<MagicLinkVerify />} />
        <Route path="/auth/github/success" element={<GitHubSuccess />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/tutorials" element={<Tutorials />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/services/bots" element={<ServicesBots />} />
        <Route path="/services/bots/:slug" element={<BotDeployPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
        <Route path="/topup" element={<ProtectedRoute><TopUp /></ProtectedRoute>} />
        <Route path="/community" element={<ProtectedRoute><Community /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/deploy" element={<ProtectedRoute><Deploy /></ProtectedRoute>} />
        <Route path="/mybots" element={<ProtectedRoute><MyBots /></ProtectedRoute>} />
        <Route path="/services/boosting" element={<ProtectedRoute><SocialBoosting /></ProtectedRoute>} />
        <Route path="/developers" element={<ProtectedRoute><DeveloperApi /></ProtectedRoute>} />
        <Route path="/features" element={<BotFeatures />} />
        <Route path="/botfeatures" element={<BotFeatures />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <CurrencyPickerModal />
    </NavLoadingProvider>
  );
}

function MaintenanceGate({ children }: { children: ReactNode }) {
  const { user, isAdmin, isModerator } = useAuth();
  const { pathname } = useLocation();
  const [maintenanceOn, setMaintenanceOn] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    getPublicMaintenanceStatus()
      .then(d => { if (d?.maintenanceMode) setMaintenanceOn(true); })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  if (!checked) return null;

  const authPaths = ["/login", "/signup", "/auth/magic", "/auth/login", "/auth/verify", "/auth/github/success", "/auth/reset-password", "/reset-password"];
  if (authPaths.some(p => pathname === p || pathname.startsWith(p + "/"))) return <>{children}</>;

  if (maintenanceOn && !(isAdmin || isModerator)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-6">
            <Wrench className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Under Maintenance</h1>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            Bmb Tech Hosting is temporarily down for maintenance. We'll be back shortly — please check again in a few minutes.
          </p>
          {user ? (
            <p className="text-xs text-muted-foreground">Logged in as <span className="text-foreground font-medium">{user.email}</span></p>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AppBootWrapper({ children }: { children: ReactNode }) {
  const { loading } = useAuth();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinTimeElapsed(true), 2200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loading && minTimeElapsed) {
      const el = document.getElementById("boot-loader");
      if (el) {
        el.style.opacity = "0";
        setTimeout(() => {
          el.remove();
          const style = document.getElementById("boot-loader-style");
          if (style) style.remove();
        }, 300);
      }
    }
  }, [loading, minTimeElapsed]);

  if (loading || !minTimeElapsed) return null;
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <CurrencyProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppBootWrapper>
              <MaintenanceGate>
                <AppRoutes />
              </MaintenanceGate>
            </AppBootWrapper>
          </BrowserRouter>
        </ToastProvider>
      </CurrencyProvider>
    </AuthProvider>
  );
}

export default App;
