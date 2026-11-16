import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useNavLoader } from "@/App";
import { getBots, getPaymentHistory } from "@/lib/api";
import { TutorialOverlay, useTutorialOverlay } from "@/components/TutorialOverlay";
import type { Bot as BotType } from "@/types";
import { BotCard } from "@/components/BotCard";
import { CouponModal } from "@/components/CouponModal";
import { NotificationBell } from "@/components/NotificationBell";
import { ReferralModal } from "@/components/ReferralModal";
import { PageLoader } from "@/components/PageLoader";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";
import {
  Gift, Users, Coins, LogOut, Shield, Clock, Loader2, RefreshCw, Bot,
  AlertTriangle, Menu, X, LayoutDashboard, BookOpen, UserCircle, CreditCard,
  MessageCircle, ChevronRight, ChevronLeft, ArrowRight, Moon, Sun, Server,
  Youtube, Hash, TrendingUp, Code2, Search, LayoutGrid, Trash2, HelpCircle,
  Radio, Share2,
} from "lucide-react";
import type { ComponentType } from "react";
import { TechBackground } from "@/components/TechBackground";
import { AppLogoIcon } from "@/components/AppLogo";
import { tx } from "@/lib/money";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

type LucideIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

const CHANNEL_URL = "https://whatsapp.com/channel/0029VawO6hgF6sn7k3SuVU3z";
const VISIT_KEY = "dash_visits_v1";

interface Visit { path: string; label: string; group: string; count: number }

interface ServiceItem {
  title: string;
  desc: string;
  icon: LucideIcon;
  path: string;
  group: string;
}

const SERVICES: ServiceItem[] = [
  { title: "Bot Deployment", desc: "Launch 24/7 WhatsApp bots from verified templates", icon: Bot, path: "/services/bots", group: "Cloud" },
  { title: "Social Media Boosting", desc: "Followers, views, likes & engagement for TikTok, Instagram & YouTube", icon: TrendingUp, path: "/services/boosting", group: "Growth" },
  { title: "My Bots", desc: "Manage, renew and monitor all of your running bots", icon: Server, path: "/mybots", group: "Cloud" },
  { title: "Developer API", desc: "API keys and docs to automate orders and deployments", icon: Code2, path: "/developers", group: "Developer" },
  { title: "Top Up", desc: "Add funds to your wallet in your own local currency", icon: CreditCard, path: "/topup", group: "Finance" },
  { title: "Price Calculator", desc: "Work out exactly what a service will cost you", icon: Hash, path: "/calculator", group: "Tools" },
  { title: "Docs & Guides", desc: "Learn how deployment, renewals and sessions work", icon: BookOpen, path: "/docs", group: "Support" },
  { title: "Video Tutorials", desc: "Watch step-by-step guides on YouTube", icon: Youtube, path: "/tutorials", group: "Support" },
];

interface Slide { title: string; sub: string; icon: LucideIcon; path: string; group: string }

const SLIDES: Slide[] = [
  { title: "Deploy WhatsApp Bots", sub: "24/7 hosting from verified templates", icon: Bot, path: "/services/bots", group: "Cloud" },
  { title: "Social Media Boosting", sub: "Followers, likes & views at super cheap prices", icon: TrendingUp, path: "/services/boosting", group: "Growth" },
  { title: "Developer API", sub: "Automate your orders and deployments", icon: Code2, path: "/developers", group: "Developer" },
];

function readVisits(): Visit[] {
  try {
    const raw = localStorage.getItem(VISIT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Visit[]) : [];
  } catch {
    return [];
  }
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("theme") as "dark" | "light") || "dark";
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);
  const toggle = () => setTheme(t => (t === "dark" ? "light" : "dark"));
  return { theme, toggle };
}

function AnimatedLogo() {
  return (
    <span className="grid place-items-center w-9 h-9 rounded-xl bg-primary text-primary-foreground shrink-0">
      <AppLogoIcon className="w-5 h-5" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                          */
/* ------------------------------------------------------------------ */

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-1 pt-5 pb-2 text-[11px] font-medium tracking-wide text-muted-foreground/80">
      {children}
    </p>
  );
}

function NavRow({
  icon: Icon, label, active, onClick, tone,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
  tone?: "default" | "amber";
}) {
  const base = "w-full flex items-center gap-3 h-11 px-4 rounded-xl border text-sm transition-colors text-left";
  const style = active
    ? "bg-foreground text-background border-transparent font-semibold"
    : tone === "amber"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15"
      : "border-border/60 bg-muted/30 text-foreground/85 hover:bg-muted/70";
  return (
    <button onClick={onClick} className={`${base} ${style}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function StatCard({
  label, value, icon: Icon, hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card/80 p-4 min-h-[8.5rem] flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{label}</span>
        <span className="grid place-items-center w-9 h-9 rounded-xl border border-border bg-muted/40 shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </span>
      </div>
      <div>
        <p className="text-2xl sm:text-3xl font-bold font-display truncate">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function Dashboard() {
  const { user, loading: authLoading, logout, isAdmin, refreshUser } = useAuth();
  const { show: showTutorial, close: closeTutorial } = useTutorialOverlay(user?.id);
  const navigate = useNavigate();
  const { navigateWithLoader } = useNavLoader();
  const { showToast } = useToast();
  const { theme, toggle: toggleTheme } = useTheme();
  const [bots, setBots] = useState<BotType[]>([]);
  const [transactions, setTransactions] = useState<Array<{ _id: string; type: string; txAmount: number; ksAmount: number; status: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [couponOpen, setCouponOpen] = useState(false);
  const [referralOpen, setReferralOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [deployingAppName, setDeployingAppName] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [showAllServices, setShowAllServices] = useState(false);
  const [slide, setSlide] = useState(0);
  const [visits, setVisits] = useState<Visit[]>(readVisits);
  const deployTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("trial") === "true") {
      setSearchParams({}, { replace: true });
      navigateWithLoader("/deploy?trial=true");
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("deployingBot");
      if (stored) {
        const parsed = JSON.parse(stored) as { appName: string; startTime: number };
        const elapsed = Date.now() - parsed.startTime;
        const remaining = 240000 - elapsed;
        if (remaining > 0) {
          setDeployingAppName(parsed.appName);
          deployTimerRef.current = setTimeout(() => {
            setDeployingAppName(null);
            localStorage.removeItem("deployingBot");
          }, remaining);
        } else {
          localStorage.removeItem("deployingBot");
        }
      }
    } catch {
      localStorage.removeItem("deployingBot");
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [botsData, txData] = await Promise.all([getBots(), getPaymentHistory().catch(() => [])]);
      if (Array.isArray(botsData)) {
        setBots(botsData);
        // If a bot we're tracking as "deploying" is no longer building, clear the deploying state
        setDeployingAppName(prev => {
          if (!prev) return null;
          const trackedBot = (botsData as { herokuAppName: string; status: string }[]).find(b => b.herokuAppName === prev);
          if (trackedBot && trackedBot.status !== "building") {
            try { localStorage.removeItem("deployingBot"); } catch {}
            if (deployTimerRef.current) { clearTimeout(deployTimerRef.current); deployTimerRef.current = null; }
            return null;
          }
          return prev;
        });
      }
      if (Array.isArray(txData)) setTransactions(txData.slice(0, 8));
    } catch {
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/login"); return; }
    if (user) fetchData();
  }, [user, authLoading, navigate, fetchData]);

  useEffect(() => {
    if (navOpen) {
      lockScroll();
      return () => unlockScroll();
    }
  }, [navOpen]);

  useEffect(() => {
    return () => { if (deployTimerRef.current) clearTimeout(deployTimerRef.current); };
  }, []);

  // Auto-rotate the hero banner
  useEffect(() => {
    const id = setInterval(() => setSlide(s => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), refreshUser()]);
    setRefreshing(false);
  };

  const recordVisit = (path: string, label: string, group: string) => {
    const exists = visits.some(v => v.path === path);
    const next = exists
      ? visits.map(v => (v.path === path ? { ...v, count: v.count + 1 } : v))
      : [...visits, { path, label, group, count: 1 }];
    setVisits(next);
    try { localStorage.setItem(VISIT_KEY, JSON.stringify(next)); } catch {}
  };

  const clearVisits = () => {
    setVisits([]);
    try { localStorage.removeItem(VISIT_KEY); } catch {}
  };

  /** Navigate (with the page loader) and remember the visit for "Most Visited". */
  const go = (path: string, label?: string, group?: string) => {
    setNavOpen(false);
    if (label) recordVisit(path, label, group ?? "General");
    if (path === "/dashboard") return;
    navigateWithLoader(path);
  };

  if (authLoading) return <PageLoader />;
  if (!user) return <PageLoader />;

  if (user.isBanned) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-red-400 mb-2">Account Suspended</h1>
          <p className="text-muted-foreground max-w-sm">
            Your account has been suspended. You cannot perform any actions on this platform.
            Contact support for assistance.
          </p>
          {user.banReason && (
            <div className="mt-1 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 max-w-sm w-full text-left">
              <p className="text-xs text-red-400 font-semibold uppercase tracking-wide mb-0.5">Reason</p>
              <p className="text-sm text-red-300">{user.banReason}</p>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate("/contact")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Contact Support
          </button>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium transition-colors border border-red-500/20"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const displayName = user.username || user.email.split("@")[0];
  const initial = displayName.charAt(0).toUpperCase();

  const activeBots = bots.filter(b => b.status === "running").length;
  const totalBots = bots.filter(b => b.status !== "deleted").length;

  const q = query.trim().toLowerCase();
  const filteredServices = q
    ? SERVICES.filter(s => `${s.title} ${s.desc} ${s.group}`.toLowerCase().includes(q))
    : showAllServices ? SERVICES : SERVICES.slice(0, 4);

  const topVisits = [...visits].sort((a, b) => b.count - a.count).slice(0, 3);

  const expiringBots = bots.filter(b =>
    !b.isTrial &&
    b.status !== "deleted" &&
    b.status !== "expired" &&
    new Date(b.expiresAt).getTime() - Date.now() > 0 &&
    new Date(b.expiresAt).getTime() - Date.now() <= 3 * 24 * 60 * 60 * 1000
  );

  const bottomNav: { label: string; icon: LucideIcon; path: string }[] = [
    { label: "Home", icon: LayoutGrid, path: "/dashboard" },
    { label: "Top Up", icon: Coins, path: "/topup" },
    { label: "My Bots", icon: Bot, path: "/mybots" },
    { label: "Boosting", icon: TrendingUp, path: "/services/boosting" },
    { label: "Profile", icon: UserCircle, path: "/profile" },
  ];

  const current = SLIDES[slide];

  return (
    <div className="min-h-screen bg-background relative">
      <TechBackground />

      {/* ---------------- Top bar ---------------- */}
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-5 lg:pl-[19.5rem] lg:pr-6">
        <div className="mx-auto max-w-5xl flex items-center gap-2 h-14 rounded-2xl border border-border bg-card/85 backdrop-blur-md px-2.5">
          <button
            className="grid place-items-center w-10 h-10 rounded-xl border border-border bg-muted/40 hover:bg-muted transition-colors lg:hidden"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 lg:hidden min-w-0">
            <AnimatedLogo />
            <span className="font-display font-extrabold text-sm tracking-wide uppercase truncate">Bmb Tech</span>
          </div>
          <span className="hidden lg:block pl-2 font-display font-semibold text-sm text-muted-foreground">Overview</span>

          <div className="ml-auto flex items-center gap-1.5">
            <NotificationBell />
            <button
              onClick={toggleTheme}
              className="hidden sm:grid place-items-center w-9 h-9 rounded-full hover:bg-muted transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark"
                ? <Sun className="w-4 h-4 text-muted-foreground" />
                : <Moon className="w-4 h-4 text-muted-foreground" />}
            </button>
            <button
              onClick={() => go("/topup", "Top Up", "Finance")}
              className="flex items-center gap-1.5 h-10 px-3 rounded-full border border-border bg-muted/40 hover:bg-muted transition-colors text-sm font-bold max-w-[9rem]"
              aria-label="Wallet balance"
            >
              <Coins className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">{tx(user.txCoins)}</span>
            </button>
            <button
              onClick={() => go("/profile")}
              className="grid place-items-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold text-sm"
              aria-label="Profile"
            >
              {initial}
            </button>
          </div>
        </div>
      </header>

      {/* ---------------- Sidebar ---------------- */}
      {navOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}
      <aside
        className={`fixed top-0 left-0 h-full w-72 max-w-[85vw] bg-background border-r border-border z-[110] transform transition-transform duration-300 ease-out ${navOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        <div className="h-full overflow-y-auto px-4 pb-6">
          {/* brand */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <AnimatedLogo />
              <span className="font-display font-extrabold text-sm tracking-wide uppercase truncate">Bmb Tech</span>
            </div>
            <button
              onClick={() => setNavOpen(false)}
              className="grid place-items-center w-9 h-9 rounded-full border border-border bg-muted/40 hover:bg-muted transition-colors lg:hidden"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* user + wallet */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{displayName}</p>
              <p className="text-[11px] font-mono text-muted-foreground truncate">{user.email}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold">{tx(user.txCoins)}</p>
              <p className="text-[10px] text-muted-foreground">Balance</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              onClick={() => go("/topup", "Top Up", "Finance")}
              className="flex items-center justify-center gap-1.5 h-10 rounded-full bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              <Coins className="w-3.5 h-3.5" />
              Top Up
            </button>
            <button
              onClick={() => { setNavOpen(false); setReferralOpen(true); }}
              className="flex items-center justify-center gap-1.5 h-10 rounded-full border border-border bg-muted/40 text-xs font-semibold hover:bg-muted transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              Refer & Earn
            </button>
          </div>

          <SectionLabel>Core</SectionLabel>
          <div className="space-y-2">
            <NavRow icon={LayoutDashboard} label="Dashboard" active onClick={() => go("/dashboard")} />
            <NavRow icon={UserCircle} label="Account Profile" onClick={() => go("/profile")} />
            <NavRow icon={Coins} label="Top Up" onClick={() => go("/topup", "Top Up", "Finance")} />
            <NavRow icon={Gift} label="Coupon Code" onClick={() => { setNavOpen(false); setCouponOpen(true); }} />
            <NavRow icon={Users} label="Refer & Earn" onClick={() => { setNavOpen(false); setReferralOpen(true); }} />
          </div>

          <SectionLabel>Services</SectionLabel>
          <div className="space-y-2">
            <NavRow icon={Bot} label="Bot Deployment" onClick={() => go("/services/bots", "Bot Deployment", "Cloud")} />
            <NavRow icon={Server} label="My Bots" onClick={() => go("/mybots", "My Bots", "Cloud")} />
            <NavRow icon={TrendingUp} label="Social Media Boosting" onClick={() => go("/services/boosting", "Social Media Boosting", "Growth")} />
            <NavRow icon={Code2} label="Developer API" onClick={() => go("/developers", "Developer API", "Developer")} />
            <NavRow icon={Hash} label="Price Calculator" onClick={() => go("/calculator", "Price Calculator", "Tools")} />
          </div>

          <SectionLabel>Learn & Support</SectionLabel>
          <div className="space-y-2">
            <NavRow icon={BookOpen} label="Docs & Guides" onClick={() => go("/docs", "Docs & Guides", "Support")} />
            <NavRow icon={Youtube} label="Video Tutorials" onClick={() => go("/tutorials", "Video Tutorials", "Support")} />
            <NavRow icon={MessageCircle} label="Contact Support" onClick={() => go("/contact")} />
            {isAdmin && (
              <NavRow icon={Shield} label="Admin Panel" tone="amber" onClick={() => go("/admin")} />
            )}
          </div>

          <p className="px-1 pt-6 pb-2 text-[10px] font-semibold tracking-[0.16em] uppercase text-muted-foreground/80">
            Support & Official Channel
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => go("/contact")}
              className="flex items-center justify-center gap-1.5 h-10 rounded-full border border-border bg-muted/40 text-xs font-medium hover:bg-muted transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              Help
            </button>
            <a
              href={CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 h-10 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/15 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp
            </a>
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center gap-1.5 h-10 rounded-full border border-border bg-muted/40 text-xs font-medium hover:bg-muted transition-colors"
            >
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              Theme
            </button>
          </div>
          <button
            onClick={logout}
            className="mt-3 w-full flex items-center justify-center gap-2 h-11 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm font-semibold hover:bg-red-500/15 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ---------------- Main ---------------- */}
      <main className="relative z-[1] px-3 sm:px-5 lg:pl-[19.5rem] lg:pr-6 pt-6 pb-28 lg:pb-12">
        <div className="mx-auto max-w-5xl space-y-6">

          {/* greeting */}
          <section>
            <h1 className="text-3xl sm:text-4xl font-extrabold font-display leading-tight">
              {greeting()}, {displayName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Select a service, deploy a bot, or manage your wallet.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <button
                onClick={() => setReferralOpen(true)}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-border bg-muted/40 text-sm font-semibold hover:bg-muted transition-colors"
              >
                <Share2 className="w-4 h-4" />
                Refer & Earn
              </button>
              <button
                onClick={() => go("/services/bots", "Bot Deployment", "Cloud")}
                className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity bmb-btn-glow"
              >
                <Bot className="w-4 h-4" />
                Deploy a Bot
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="grid place-items-center w-10 h-10 rounded-full border border-border bg-muted/40 hover:bg-muted transition-colors disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
              </button>
            </div>
          </section>

          {/* hero banner */}
          <section className="relative h-44 sm:h-56 rounded-2xl overflow-hidden border border-border">
            {SLIDES.map((s, i) => (
              <button
                key={s.title}
                onClick={() => go(s.path, s.title, s.group)}
                aria-label={s.title}
                className={`absolute inset-0 text-left transition-opacity duration-500 ${i === slide ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                style={{
                  background:
                    "radial-gradient(120% 120% at 100% 0%, hsl(var(--primary) / 0.38) 0%, transparent 55%), linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%)",
                }}
              >
                <div className="absolute inset-0 bmb-grid opacity-70" />
                <s.icon className="absolute -right-4 -bottom-6 w-40 h-40 sm:w-52 sm:h-52 text-primary/15" strokeWidth={1.2} />
                <div className="absolute left-5 right-5 bottom-5">
                  <p className="text-[11px] font-semibold tracking-[0.16em] uppercase text-primary mb-1">{s.group}</p>
                  <h2 className="text-2xl sm:text-3xl font-extrabold font-display">{s.title}</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">{s.sub}</p>
                </div>
              </button>
            ))}
            <div className="absolute top-3 right-3 flex gap-1.5">
              <button
                onClick={() => setSlide(s => (s - 1 + SLIDES.length) % SLIDES.length)}
                className="grid place-items-center w-8 h-8 rounded-full bg-background/70 backdrop-blur border border-border hover:bg-background transition-colors"
                aria-label="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSlide(s => (s + 1) % SLIDES.length)}
                className="grid place-items-center w-8 h-8 rounded-full bg-background/70 backdrop-blur border border-border hover:bg-background transition-colors"
                aria-label="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="absolute bottom-4 right-4 flex items-center gap-1.5" aria-hidden="true">
              {SLIDES.map((s, i) => (
                <span
                  key={s.title}
                  className={`h-1.5 rounded-full transition-all ${i === slide ? "w-5 bg-foreground" : "w-1.5 bg-foreground/30"}`}
                />
              ))}
            </div>
            <span className="sr-only">{current.title}</span>
          </section>

          {/* quick actions */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Top Up", icon: Coins, onClick: () => go("/topup", "Top Up", "Finance") },
              { label: "Refer & Earn", icon: Users, onClick: () => setReferralOpen(true) },
              { label: "Coupon Code", icon: Gift, onClick: () => setCouponOpen(true) },
              { label: "Contact Support", icon: MessageCircle, onClick: () => go("/contact") },
            ].map(a => (
              <button
                key={a.label}
                onClick={a.onClick}
                className="flex items-center gap-3 h-[4.5rem] px-3.5 rounded-2xl border border-border bg-card/80 hover:bg-muted/60 transition-colors text-left"
              >
                <span className="grid place-items-center w-10 h-10 rounded-xl border border-border bg-muted/40 shrink-0">
                  <a.icon className="w-4 h-4" />
                </span>
                <span className="text-sm font-semibold flex-1 truncate">{a.label}</span>
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </section>

          {/* stats */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Coin Balance" value={tx(user.txCoins)} icon={Coins} />
            <StatCard label="Active Bots" value={String(activeBots)} icon={Radio} hint="Currently running" />
            <StatCard label="Total Bots" value={String(totalBots)} icon={Server} />
            <StatCard label="Services" value={String(SERVICES.length)} icon={LayoutGrid} />
          </section>

          {/* deploying notice */}
          {deployingAppName && (
            <div className="p-4 rounded-2xl border border-primary/30 bg-primary/10 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
              <div>
                <p className="text-sm font-semibold text-primary">Bot is deploying...</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{deployingAppName}</span> is building. This takes about 2 minutes.
                </p>
              </div>
            </div>
          )}

          {/* expiring bots */}
          {expiringBots.map(b => {
            const daysLeft = Math.ceil((new Date(b.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
            return (
              <div key={b._id + "-expiry"} className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 flex items-center gap-3">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-300">Bot expiring soon</p>
                  <p className="text-xs text-amber-400/80 mt-0.5">
                    <span className="font-mono">{b.herokuAppName}</span> expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
                  </p>
                </div>
                <button
                  onClick={() => go("/mybots")}
                  className="px-3 py-1.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold transition-colors shrink-0"
                >
                  Renew
                </button>
              </div>
            );
          })}

          {/* featured services */}
          <section>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-xl font-bold font-display">Featured Services</h2>
              {!q && (
                <button
                  onClick={() => setShowAllServices(v => !v)}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <LayoutGrid className="w-4 h-4" />
                  {showAllServices ? "Show Less" : "More Services"}
                </button>
              )}
            </div>
            <label className="flex items-center gap-3 h-12 px-4 rounded-2xl border border-border bg-card/80 mb-3 focus-within:border-primary/50 transition-colors">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search service by name or category..."
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </label>
            {filteredServices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No service matches "{query}".</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {filteredServices.map(s => (
                  <button
                    key={s.path}
                    onClick={() => go(s.path, s.title, s.group)}
                    className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-card/80 hover:bg-muted/60 transition-colors text-left"
                  >
                    <span className="grid place-items-center w-11 h-11 rounded-xl border border-border bg-muted/40 shrink-0">
                      <s.icon className="w-5 h-5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-[15px]">{s.title}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">{s.desc}</span>
                    </span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* most visited */}
          {topVisits.length > 0 && (
            <section className="rounded-2xl border border-border bg-card/60 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="flex items-center gap-2 text-sm font-bold">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Most Visited Sections
                </h2>
                <button
                  onClick={clearVisits}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear History
                </button>
              </div>
              <div className="space-y-2.5">
                {topVisits.map(v => (
                  <button
                    key={v.path}
                    onClick={() => go(v.path, v.label, v.group)}
                    className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border border-border/70 bg-background/50 hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-[10px] font-semibold tracking-[0.14em] uppercase text-muted-foreground">{v.group}</span>
                      <span className="block text-sm font-bold truncate">{v.label}</span>
                      <span className="block text-[11px] font-mono text-muted-foreground mt-0.5">
                        {v.count} visit{v.count !== 1 ? "s" : ""}
                      </span>
                    </span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* recent bots */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-9 h-9 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
              </div>
            </div>
          ) : bots.length > 0 ? (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold font-display">Recent Bots</h2>
                <button onClick={() => go("/mybots")} className="text-xs text-primary hover:underline font-semibold">
                  View all →
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {bots.slice(0, 4).map(bot => (
                  <BotCard
                    key={bot._id}
                    bot={bot}
                    onUpdate={fetchData}
                    deploying={deployingAppName === bot.herokuAppName}
                    coinBalance={user.txCoins}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {/* rewards & coupons */}
          <section>
            <h2 className="text-xl font-bold font-display">Rewards & Coupon Codes</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Redeem a promo coupon code, or invite friends and earn when they join.
            </p>
            <button
              onClick={() => setCouponOpen(true)}
              className="mt-3 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Gift className="w-4 h-4" />
              Redeem Coupon Code
            </button>
            <button
              onClick={() => setReferralOpen(true)}
              className="mt-3 w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card/80 hover:bg-muted/60 transition-colors text-left"
            >
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-primary/15 shrink-0">
                <Users className="w-5 h-5 text-primary" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-[15px]">Refer & Earn</span>
                <span className="block text-xs text-muted-foreground mt-0.5">Share your referral code with friends</span>
              </span>
              <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          </section>

          {/* recent activity */}
          {transactions.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold font-display flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Recent Activity
                </h2>
                <span className="text-xs text-muted-foreground">{transactions.length} transaction{transactions.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="rounded-2xl border border-border overflow-hidden bg-card/60">
                {transactions.map((t, i) => {
                  const isCredit = t.type === "admin_grant" || t.type === "topup" || t.type === "refund";
                  const isFailed = t.status === "failed";
                  const isPending = t.status === "pending";
                  const labelMap: Record<string, string> = { topup: "Top-Up", deploy: "Bot Deployed", renew: "Bot Renewed", admin_grant: "Credit Granted", refund: "Refund", panel: "Panel Purchase" };
                  const label = labelMap[t.type] ?? t.type.replace(/_/g, " ");
                  const sub = t.type === "topup" && t.ksAmount > 0 ? `KES ${t.ksAmount}` : t.type === "deploy" || t.type === "renew" ? "spent" : t.type === "admin_grant" ? "admin bonus" : "";
                  const iconEl = t.type === "deploy" || t.type === "renew"
                    ? <Bot className="w-3.5 h-3.5 text-orange-400" />
                    : t.type === "topup"
                      ? <CreditCard className="w-3.5 h-3.5 text-primary" />
                      : t.type === "panel"
                        ? <Server className="w-3.5 h-3.5 text-primary" />
                        : <Coins className={`w-3.5 h-3.5 ${isCredit ? "text-amber-400" : "text-muted-foreground"}`} />;
                  return (
                    <div
                      key={t._id}
                      className={`flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors ${i < transactions.length - 1 ? "border-b border-border/50" : ""}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isFailed ? "bg-muted/60" : isCredit ? "bg-primary/10" : "bg-orange-500/10"}`}>
                          {iconEl}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate capitalize">{label}</p>
                          <p className="text-xs text-muted-foreground truncate">{sub ? `${sub} · ` : ""}{new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 shrink-0 ml-3">
                        <span className={`text-sm font-bold tabular-nums ${isFailed ? "text-muted-foreground line-through" : isCredit ? "text-primary" : "text-red-400"}`}>
                          {isCredit ? "+" : "-"}{tx(Math.abs(t.txAmount))}
                        </span>
                        {isPending && <span className="text-[10px] font-medium text-yellow-500">pending</span>}
                        {isFailed && <span className="text-[10px] font-medium text-red-500">failed</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* official channel */}
          <a
            href={CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 p-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors"
          >
            <span className="grid place-items-center w-11 h-11 rounded-xl bg-emerald-500/15 shrink-0">
              <MessageCircle className="w-5 h-5 text-emerald-400" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-bold text-[15px]">Join Our Official Channel</span>
              <span className="block text-xs text-muted-foreground mt-0.5">Tap to join for updates on WhatsApp</span>
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </a>
        </div>
      </main>

      {/* ---------------- Bottom nav (mobile) ---------------- */}
      <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-border bg-background/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto">
          {bottomNav.map(item => {
            const active = item.path === "/dashboard";
            return (
              <button
                key={item.path}
                onClick={() => go(item.path)}
                aria-label={item.label}
                className={`grid place-items-center w-12 h-12 rounded-2xl transition-colors ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <item.icon className="w-5 h-5" />
              </button>
            );
          })}
        </div>
      </nav>

      <CouponModal isOpen={couponOpen} onClose={() => setCouponOpen(false)} onSuccess={() => { fetchData(); refreshUser(); }} />

      <ReferralModal
        isOpen={referralOpen}
        onClose={() => setReferralOpen(false)}
        referralCode={user.referralCode || ""}
      />

      {showTutorial && user && (
        <TutorialOverlay userId={user.id} onClose={closeTutorial} />
      )}
    </div>
  );
}
