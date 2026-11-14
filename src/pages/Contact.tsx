import { useState, useEffect } from "react";
  import { useNavigate } from "react-router";
  import { useAuth } from "@/hooks/useAuth";
  import { useNavLoader } from "@/App";
  import { TechBackground } from "@/components/TechBackground";
  import { AppLogoIcon } from "@/components/AppLogo";
  import { lockScroll, unlockScroll } from "@/lib/scrollLock";
  import { Button } from "@/components/ui/button";
  import {
    ArrowLeft, Coins, Mail, MessageCircle, Send,
    LayoutDashboard, CreditCard, BookOpen, UserCircle, LogOut,
    Bot, Shield, ChevronRight, Moon, Sun, Menu, X, ExternalLink, LogIn, UserPlus
  } from "lucide-react";

const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string) || "";

  function useTheme() {
    const [theme, setTheme] = useState<"dark" | "light">(() =>
      (localStorage.getItem("theme") as "dark" | "light") || "dark"
    );
    useEffect(() => {
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.classList.toggle("light", theme === "light");
      localStorage.setItem("theme", theme);
    }, [theme]);
    return { theme, toggle: () => setTheme(t => t === "dark" ? "light" : "dark") };
  }

  function AnimatedLogo() {
    return (
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-teal-500 via-emerald-500 to-orange-500 animate-pulse" style={{ animationDuration: "3s" }} />
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-teal-500 via-emerald-500 to-orange-500 opacity-60 blur-sm" />
        <div className="relative w-full h-full flex items-center justify-center rounded-lg">
          <AppLogoIcon className="w-4 h-4 text-white drop-shadow-sm" />
        </div>
      </div>
    );
  }

  export function Contact() {
    const { user, logout, isAdmin } = useAuth();
    const navigate = useNavigate();
    const { navigateWithLoader } = useNavLoader();
    const { theme, toggle: toggleTheme } = useTheme();
    const [navOpen, setNavOpen] = useState(false);

    useEffect(() => {
      if (navOpen) {
        lockScroll();
        return () => unlockScroll();
      }
    }, [navOpen]);

    const navItems = [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
      { label: "Top Up TX", icon: CreditCard, path: "/topup" },
      { label: "Docs", icon: BookOpen, path: "/docs" },
    ];

    return (
      <div className="min-h-screen bg-background relative">
        <TechBackground />
        <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center justify-between h-14">
              <div className="flex items-center gap-3">
                <button className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors" onClick={() => setNavOpen(true)}>
                  <Menu className="w-5 h-5" />
                </button>
                <button className="flex items-center gap-2" onClick={() => navigateWithLoader("/")}>
                  <AnimatedLogo /><span className="font-bold text-base">Bmb Tech Hosting</span>
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-muted transition-all">
                  {theme === "dark" ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
                </button>
                {user ? (
                  <button onClick={() => navigateWithLoader("/profile")} className="p-2 rounded-lg hover:bg-muted transition-colors">
                    <UserCircle className="w-5 h-5 text-muted-foreground" />
                  </button>
                ) : (
                  <div className="hidden sm:flex items-center gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => navigateWithLoader("/login")}>Log In</Button>
                    <Button size="sm" onClick={() => navigateWithLoader("/signup")}>Sign Up</Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>

        {navOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setNavOpen(false)} />}
        <aside className={`fixed top-0 left-0 h-full w-72 bg-card border-r border-border z-[110] transform transition-transform duration-300 ease-out ${navOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2.5"><AnimatedLogo /><span className="font-bold text-base">Bmb Tech Hosting</span></div>
            <button onClick={() => setNavOpen(false)} className="p-2 rounded-lg hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4 flex flex-col h-[calc(100%-65px)] overflow-y-auto">
            {user ? (
              <div className="mb-5 p-3 rounded-xl bg-muted/50 border border-border/50">
                <p className="text-xs text-muted-foreground mb-0.5">Signed in as</p>
                <p className="text-sm font-semibold truncate">{user.username ? `@${user.username}` : user.email}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-sm font-bold text-teal-400">Balance: {user.txCoins} TX</span>
                </div>
              </div>
            ) : (
              <div className="mb-5 p-3 rounded-xl bg-teal-500/10 border border-teal-500/20">
                <p className="text-xs font-semibold text-teal-400 mb-2">Guest Mode</p>
                <p className="text-xs text-muted-foreground mb-3">Sign in to access your full dashboard and account features.</p>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-7 text-xs" onClick={() => { navigateWithLoader("/signup"); setNavOpen(false); }}>
                    <UserPlus className="w-3 h-3 mr-1" />Sign Up
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => { navigateWithLoader("/login"); setNavOpen(false); }}>
                    <LogIn className="w-3 h-3 mr-1" />Log In
                  </Button>
                </div>
              </div>
            )}
            <nav className="space-y-0.5 flex-1">
              {user && navItems.map(item => (
                <button key={item.path} onClick={() => { navigateWithLoader(item.path); setNavOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                  <div className="flex items-center gap-2.5"><item.icon className="w-4 h-4" />{item.label}</div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                </button>
              ))}
              <button onClick={() => { navigateWithLoader("/services/bots"); setNavOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                <div className="flex items-center gap-2.5"><Bot className="w-4 h-4" />Bot Deployment</div>
                <ChevronRight className="w-3.5 h-3.5 opacity-40" />
              </button>
              <button onClick={() => { navigateWithLoader("/contact"); setNavOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium bg-muted text-foreground transition-all">
                <div className="flex items-center gap-2.5"><MessageCircle className="w-4 h-4" />Contact</div>
                <ChevronRight className="w-3.5 h-3.5 opacity-40" />
              </button>
              {isAdmin && (
                <button onClick={() => { navigateWithLoader("/admin"); setNavOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-amber-400 hover:bg-amber-500/10 transition-all">
                  <div className="flex items-center gap-2.5"><Shield className="w-4 h-4" />Admin Panel</div>
                  <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                </button>
              )}
            </nav>
            <div className="space-y-0.5 border-t border-border pt-3 mt-3">
              {user ? (
                <>
                  <button onClick={() => { navigateWithLoader("/profile"); setNavOpen(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                    <UserCircle className="w-4 h-4" />Profile
                  </button>
                  <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all">
                    <LogOut className="w-4 h-4" />Sign Out
                  </button>
                </>
              ) : (
                <button onClick={() => { navigateWithLoader("/"); setNavOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
                  <ArrowLeft className="w-4 h-4" />Back to Home
                </button>
              )}
            </div>
          </div>
        </aside>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 relative z-[1]">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Contact &amp; Support</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Get help or reach out to our team</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
            <a href="https://wa.me/255767862457" target="_blank" rel="noopener noreferrer"
              className="flex flex-col gap-3 p-5 rounded-xl border border-border bg-card hover:border-green-500/40 hover:bg-green-500/5 transition-all group">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                <MessageCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="font-semibold">WhatsApp Support</p>
                <p className="text-sm text-muted-foreground mt-0.5">Chat with us on WhatsApp for the fastest response</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-green-400 font-medium">
                Open WhatsApp <ExternalLink className="w-3 h-3" />
              </div>
            </a>

            {SUPPORT_EMAIL && (<a href={`mailto:${SUPPORT_EMAIL}`}
              className="flex flex-col gap-3 p-5 rounded-xl border border-border bg-card hover:border-teal-500/40 hover:bg-teal-500/5 transition-all group">
              <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center group-hover:bg-teal-500/20 transition-colors">
                <Mail className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <p className="font-semibold">Email Support</p>
                <p className="text-sm text-muted-foreground mt-0.5">Send us an email and we'll respond within 24 hours</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-teal-400 font-medium">
                {SUPPORT_EMAIL} <ExternalLink className="w-3 h-3" />
              </div>
            </a>)}

            <a href="https://t.me/bmb_tech" target="_blank" rel="noopener noreferrer"
              className="flex flex-col gap-3 p-5 rounded-xl border border-border bg-card hover:border-blue-500/40 hover:bg-blue-500/5 transition-all group">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <Send className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="font-semibold">Telegram</p>
                <p className="text-sm text-muted-foreground mt-0.5">Message us directly on Telegram for quick support</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-blue-400 font-medium">
                Open Telegram <ExternalLink className="w-3 h-3" />
              </div>
            </a>

            <a href="https://whatsapp.com/channel/0029VawO6hgF6sn7k3SuVU3z" target="_blank" rel="noopener noreferrer"
              className="flex flex-col gap-3 p-5 rounded-xl border border-green-500/30 bg-green-500/5 hover:border-green-500/50 hover:bg-green-500/10 transition-all group">
              <div className="w-10 h-10 rounded-lg bg-green-500/15 border border-green-500/25 flex items-center justify-center group-hover:bg-green-500/25 transition-colors">
                <MessageCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="font-semibold">Join Our Official Channel</p>
                <p className="text-sm text-muted-foreground mt-0.5">WhatsApp updates, announcements, and news</p>
              </div>
              <div className="inline-flex items-center justify-center gap-2 mt-1 px-3 py-2 rounded-lg bg-green-500/20 text-green-300 text-xs font-semibold group-hover:bg-green-500/30 transition-colors">
                Click to join <ExternalLink className="w-3 h-3" />
              </div>
            </a>

            <div className="flex flex-col gap-3 p-5 rounded-xl border border-border bg-card">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="font-semibold">Response Times</p>
                <div className="space-y-1 mt-2">
                  <p className="text-xs text-muted-foreground">WhatsApp: Usually within 1–2 hours</p>
                  <p className="text-xs text-muted-foreground">Email: Within 24 hours</p>
                  <p className="text-xs text-muted-foreground">Hours: Monday–Saturday, 8am–8pm EAT</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card/50">
            <h2 className="font-semibold mb-1">Before Reaching Out</h2>
            <p className="text-sm text-muted-foreground mb-3">Many common questions are answered in our documentation and video tutorials.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" onClick={() => navigateWithLoader("/docs")}>
                <BookOpen className="w-3.5 h-3.5 mr-1.5" />Read the Docs
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigateWithLoader("/tutorials")}>
                <BookOpen className="w-3.5 h-3.5 mr-1.5" />Watch Tutorials
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }
