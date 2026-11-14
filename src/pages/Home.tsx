import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { TechBackground } from "@/components/TechBackground";
import { AppLogoIcon } from "@/components/AppLogo";
import { useAuth } from "@/hooks/useAuth";
import { useNavLoader } from "@/App";
import {
  Bot, Zap, Shield, Clock, Coins, ArrowRight,
  CheckCircle, ChevronRight, Moon, Sun,
  Users, MessageCircle, BookOpen, Youtube,
  Menu, X, TrendingUp, Code2
} from "lucide-react";

const MPESA_URL = "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/mpesa.jpg";
const AIRTEL_URL = "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/airtel.jpg";
const CARD_URL = "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/creditcard.jpg";
const APPLEPAY_URL = "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/applepay.jpg";
const OPAY_URL = "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/opay.jpg";
const ORANGEMONEY_URL = "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/orangemoney.jpg";
const MTN_URL = "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/mtn.jpg";

const PAYMENT_LOGOS: { src?: string; label: string; textOnly?: boolean }[] = [
  { src: MPESA_URL, label: "M-Pesa" },
  { src: AIRTEL_URL, label: "Airtel" },
  { src: CARD_URL, label: "Card" },
  { src: APPLEPAY_URL, label: "Apple Pay" },
  { src: OPAY_URL, label: "OPay" },
  { src: ORANGEMONEY_URL, label: "Orange Money" },
  { src: MTN_URL, label: "MTN MoMo" },
  { textOnly: true, label: "📱 Tigo Pesa" },
  { textOnly: true, label: "📱 Vodacom" },
  { textOnly: true, label: "⚡ Zap" },
  { textOnly: true, label: "🏦 Bank Transfer" },
  { textOnly: true, label: "📱 USSD" },
  { textOnly: true, label: "💳 PayAttitude" },
  { textOnly: true, label: "💳 PayPal" },
];

const GLOBAL_STYLES = `
@keyframes txFlipHero{
  0%{transform:rotateY(0deg)}
  20%{transform:rotateY(360deg)}
  50%{transform:rotateY(360deg)}
  70%{transform:rotateY(720deg)}
  100%{transform:rotateY(720deg)}
}
@keyframes txFlipNav{
  0%{transform:rotateY(0deg)}
  28%{transform:rotateY(360deg)}
  54%{transform:rotateY(360deg)}
  82%{transform:rotateY(720deg)}
  100%{transform:rotateY(720deg)}
}
@keyframes fadeUp{from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideInLeft{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:translateX(0)}}
@keyframes slideInRight{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
@keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
@keyframes countUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes payTickV{0%{transform:translateY(0)}100%{transform:translateY(-50%)}}
@keyframes pulseGlow{0%,100%{box-shadow:0 0 0 0 rgba(20,184,166,0)}50%{box-shadow:0 0 18px 4px rgba(20,184,166,0.18)}}
@keyframes scaleIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
`;

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

function NavAnimatedLogo() {
  return (
    <div style={{ width: 32, height: 32, perspective: "100px" }}>
      <div
        className="w-8 h-8 flex items-center justify-center"
      >
        <AppLogoIcon className="w-4 h-4 text-primary" />
      </div>
    </div>
  );
}

function HeroLogo() {
  return (
    <div className="mx-auto mb-6" style={{ width: 88, height: 88, perspective: "160px" }}>
      <div
        className="w-full h-full rounded-3xl flex items-center justify-center"
        style={{ animation: "txFlipHero 6s cubic-bezier(0.4,0,0.2,1) infinite", willChange: "transform", transformStyle: "preserve-3d" }}
      >
        <span style={{ filter: "drop-shadow(0 0 12px rgba(20,184,166,0.8))" }}>
          <AppLogoIcon className="w-12 h-12 text-primary" />
        </span>
      </div>
    </div>
  );
}

function PaymentTicker() {
  const items = [...PAYMENT_LOGOS, ...PAYMENT_LOGOS, ...PAYMENT_LOGOS, ...PAYMENT_LOGOS];
  const speed = items.length * 1.5;
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-sm"
      style={{ height: 280, width: 96, maxWidth: 96 }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          animation: `payTickV ${speed}s linear infinite`,
          willChange: "transform",
        }}
      >
        {items.map((p, i) => (
          <div key={i} className="flex flex-col items-center justify-center gap-1 shrink-0 px-1" style={{ height: 56 }}>
            {p.textOnly ? (
              <div className="w-12 h-8 rounded-lg border border-border/50 bg-muted/50 flex items-center justify-center px-1">
                <span className="text-[9px] font-bold text-foreground/70 text-center leading-tight">{p.label}</span>
              </div>
            ) : (
              <div className="w-12 h-8 rounded-lg overflow-hidden border border-border/50 bg-muted/50 flex items-center justify-center">
                <img
                  src={p.src}
                  alt={p.label}
                  className="w-full h-full object-contain"
                  onError={e => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                />
              </div>
            )}
            <span className="text-[8px] text-muted-foreground font-medium text-center leading-none w-full truncate px-0.5">{p.textOnly ? "" : p.label}</span>
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-card/80 to-transparent pointer-events-none z-10" />
      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card/80 to-transparent pointer-events-none z-10" />
    </div>
  );
}

function useReveal(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let t: ReturnType<typeof setTimeout> | null = null;

    const apply = (visible: boolean, fromAbove: boolean) => {
      if (t) clearTimeout(t);
      if (visible) {
        t = setTimeout(() => {
          el.style.opacity = "1";
          el.style.transform = "translateY(0) scale(1)";
          t = null;
        }, delay);
      } else {
        el.style.opacity = "0";
        el.style.transform = fromAbove ? "translateY(-24px) scale(0.97)" : "translateY(32px) scale(0.97)";
      }
    };

    const obs = new IntersectionObserver(([entry]) => {
      const fromAbove = entry.boundingClientRect.top < 0;
      apply(entry.isIntersecting, fromAbove);
    }, { threshold: 0.1 });

    obs.observe(el);
    return () => { obs.disconnect(); if (t) clearTimeout(t); };
  }, [delay]);

  return ref;
}

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useReveal(delay);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: 0,
        transform: "translateY(32px) scale(0.97)",
        transition: `opacity 0.9s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.9s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

const features = [
  { icon: Zap, title: "Instant Deployment", desc: "Deploy your WhatsApp bot in under 4 minutes. No server setup, no technical knowledge required.", color: "purple" },
  { icon: Clock, title: "24/7 Uptime", desc: "Your bots run continuously on our reliable infrastructure — always on, even when you're offline.", color: "indigo" },
  { icon: Shield, title: "Secure & Isolated", desc: "Each bot runs in its own isolated Pterodactyl environment for maximum security and stability.", color: "violet" },
  { icon: Coins, title: "Affordable Pricing", desc: "Simple TX coin system. 10 TX = 1 month of bot hosting. Top up via M-Pesa, Tigo, Airtel, MTN, card, and more.", color: "purple" },
  { icon: Users, title: "Referral Rewards", desc: "Earn bonus TX coins every time someone signs up using your referral link.", color: "indigo" },
  { icon: BookOpen, title: "Full Documentation", desc: "Comprehensive guides and video tutorials to help you get the most out of every feature.", color: "violet" },
];

const steps = [
  { number: "01", title: "Create an Account", desc: "Sign up in seconds using GitHub OAuth, Google, or a secure email link — no password required." },
  { number: "02", title: "Top Up TX Coins", desc: "Add TX coins via mobile money, card, or Apple Pay. Processed instantly." },
  { number: "03", title: "Deploy Your Bot", desc: "Pick a bot template, paste your session ID, and hit Deploy. Your bot goes live in 4 minutes." },
];

const pricingPoints = [
  "WhatsApp bot hosting from 10 TX / month",
  "Social media boosting — cheapest prices around",
  "1000 Instagram followers from about $0.53",
  "Top up any amount — starts from KES 50",
  "Earn free TX via referral program",
];

const resources = [
  { icon: BookOpen, title: "Documentation", desc: "Step-by-step guides covering deployment, bot management, billing, and troubleshooting.", link: "/docs", label: "Read Docs" },
  { icon: Youtube, title: "Video Tutorials", desc: "Visual walkthroughs covering the entire setup and management process.", link: "/tutorials", label: "Watch Now" },
  { icon: Zap, title: "Bot Features & Help", desc: "Explore all Bmb Bot commands, enable/disable features, and copy commands instantly.", link: "/features", label: "Explore" },
  { icon: Code2, title: "Developer API", desc: "Deploy bots and place social media boosting orders programmatically with your own API key.", link: "/developers", label: "View Docs" },
  { icon: MessageCircle, title: "Support", desc: "Reach our team through the contact page or community channels for fast, helpful responses.", link: "/contact", label: "Get Help" },
];

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { navigateWithLoader } = useNavLoader();
  const { theme, toggle: toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [mobileMenuOpen]);

  const navLinks = [
    { label: "Services", href: "/services/bots" },
    { label: "Boosting", href: "/services/boosting" },
    { label: "API", href: "/developers" },
    { label: "Features", href: "/features" },
    { label: "Docs", href: "/docs" },
    { label: "Tutorials", href: "/tutorials" },
    { label: "Contact", href: "/contact" },
  ];

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      <style>{GLOBAL_STYLES}</style>
      <TechBackground />

      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <button className="flex items-center gap-2" onClick={() => navigateWithLoader("/")}>
              <NavAnimatedLogo />
              <span className="font-bold text-base">Bmb Tech Hosting</span>
            </button>

            <nav className="hidden md:flex items-center gap-0.5">
              {navLinks.map(link => (
                <button
                  key={link.href}
                  onClick={() => navigateWithLoader(link.href)}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {link.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-muted transition-all duration-200" aria-label="Toggle theme">
                {theme === "dark" ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
              </button>
              {!authLoading && (
                user ? (
                  <Button size="sm" onClick={() => navigateWithLoader("/dashboard")} className="hidden sm:flex">
                    Dashboard <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" className="hidden sm:flex" onClick={() => navigateWithLoader("/login")}>
                      Log In
                    </Button>
                    <Button size="sm" className="hidden sm:flex" onClick={() => navigateWithLoader("/signup")}>
                      Sign Up Free
                    </Button>
                  </>
                )
              )}
              <button
                className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={() => setMobileMenuOpen(false)} />
      )}
      <aside className={`fixed top-0 right-0 h-full w-72 bg-card border-l border-border z-[110] transform transition-transform duration-300 ease-out ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2"><NavAnimatedLogo /><span className="font-bold">Bmb Tech Hosting</span></div>
          <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-muted transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-1">
          {navLinks.map(link => (
            <button
              key={link.href}
              onClick={() => { navigateWithLoader(link.href); setMobileMenuOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
            >
              {link.label}
              <ChevronRight className="w-4 h-4 opacity-40" />
            </button>
          ))}
          <div className="pt-4 border-t border-border space-y-2">
            {user ? (
              <Button className="w-full" onClick={() => { navigateWithLoader("/dashboard"); setMobileMenuOpen(false); }}>
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button variant="outline" className="w-full" onClick={() => { navigateWithLoader("/login"); setMobileMenuOpen(false); }}>
                  Log In
                </Button>
                <Button className="w-full" onClick={() => { navigateWithLoader("/signup"); setMobileMenuOpen(false); }}>
                  Sign Up Free
                </Button>
              </>
            )}
          </div>
        </div>
      </aside>

      <main className="relative z-[1]">
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-24">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <div className="flex-1 text-center lg:text-left" style={{ animation: "fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) both" }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold mb-6">
                <Zap className="w-3 h-3" />
                Bots · Super Cheap Social Media Boosting
              </div>
              <HeroLogo />
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-6 leading-[1.08]"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--foreground)) 0%, #2dd4bf 50%, #fb923c 100%)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Bots &amp; Super Cheap Social Boosting
              </h1>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed">
                Host WhatsApp bots and grow Instagram, TikTok, YouTube, Twitch and more at the cheapest prices you&apos;ll find.
                Deploy in minutes, boost for pennies, and pay with M-Pesa, Tigo, MTN, Airtel, card, Apple Pay, and more.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-12">
                <Button
                  size="lg"
                  className="w-full sm:w-auto px-8 bg-gradient-to-r from-teal-600 to-orange-600 hover:from-teal-700 hover:to-orange-700 text-white shadow-lg shadow-teal-500/30"
                  style={{ animation: "pulseGlow 3s ease-in-out 2s infinite" }}
                  onClick={() => navigateWithLoader(user ? "/dashboard" : "/signup")}
                >
                  {user ? "Go to Dashboard" : "Get Started Free"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button size="lg" variant="outline" className="w-full sm:w-auto px-8" onClick={() => navigateWithLoader("/services/boosting")}>
                  Social Media Boosting
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto lg:mx-0">
                {[
                  { value: "10 TX", label: "per bot / month" },
                  { value: "~4 min", label: "deployment time" },
                  { value: "24/7", label: "uptime guarantee" },
                  { value: `${PAYMENT_LOGOS.length}+`, label: "payment methods" },
                ].map((stat, i) => (
                  <div
                    key={stat.label}
                    className="p-3 rounded-xl bg-muted/50 border border-border/50 text-center"
                    style={{ animation: `countUp 0.6s cubic-bezier(0.22,1,0.36,1) ${300 + i * 80}ms both` }}
                  >
                    <p className="text-lg font-bold text-teal-400">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-shrink-0" style={{ animation: "slideInRight 0.8s cubic-bezier(0.22,1,0.36,1) 0.2s both" }}>
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Payment Methods</p>
                <PaymentTicker />
                <p className="text-[10px] text-muted-foreground text-center max-w-[96px] leading-tight">
                  Accepted worldwide
                </p>
              </div>
            </div>
          </div>
        </section>

        <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 py-16 border-t border-border/50">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Our Services</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">WhatsApp bot hosting and social media boosting at super cheap prices — all in one platform.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <Reveal delay={60}>
              <div className="group h-full p-6 rounded-2xl border border-border bg-card hover:border-teal-500/40 hover:shadow-lg hover:shadow-teal-500/10 transition-all cursor-pointer" onClick={() => navigateWithLoader("/services/bots")}>
                <div className="w-11 h-11 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Bot className="w-5 h-5 text-teal-400" />
                </div>
                <h3 className="font-bold text-lg mb-2">WhatsApp Bot Hosting</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  Keep your WhatsApp automation bots running 24/7 without managing servers.
                  Simple deployment, real-time monitoring, and instant scaling.
                </p>
                <span className="text-sm font-medium text-teal-400 group-hover:text-teal-300 flex items-center gap-1 transition-colors">
                  View plans <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Reveal>
            <Reveal delay={140}>
              <div className="group h-full p-6 rounded-2xl border border-border bg-card hover:border-pink-500/40 hover:shadow-lg hover:shadow-pink-500/10 transition-all cursor-pointer" onClick={() => navigateWithLoader("/services/boosting")}>
                <div className="w-11 h-11 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-5 h-5 text-pink-400" />
                </div>
                <h3 className="font-bold text-lg mb-2">Social Media Boosting</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                  Grow Instagram, TikTok, YouTube, Twitch, Facebook and more with followers, likes and views.
                  Pay with TX or mobile money — prices update automatically from our catalogue.
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 mb-4">
                  <li>• Get <span className="text-foreground font-medium">1000 Instagram followers</span> from ~<span className="text-pink-400 font-semibold">$0.53</span> <span className="opacity-80">(~68 KSh / ~727 NGN)</span></li>
                  <li>• Boost TikTok followers, video likes & views</li>
                  <li>• YouTube subscribers, Twitch followers & more</li>
                </ul>
                <span className="text-sm font-medium text-pink-400 group-hover:text-pink-300 flex items-center gap-1 transition-colors">
                  Start boosting <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Reveal>
          </div>
        </Reveal>

        <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 py-16 border-t border-border/50" delay={40}>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">How It Works</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Three simple steps to get your bot live and running continuously.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {steps.map((step, i) => (
              <Reveal key={step.number} delay={i * 100}>
                <div className="relative p-6 rounded-2xl border border-border bg-card hover:border-teal-500/30 hover:shadow-md transition-all h-full">
                  {i < steps.length - 1 && (
                    <div className="hidden sm:block absolute top-10 -right-3 w-6 h-0.5 bg-gradient-to-r from-border to-transparent z-10" />
                  )}
                  <div className="text-5xl font-black mb-4" style={{ color: "rgba(20,184,166,0.15)" }}>{step.number}</div>
                  <h3 className="font-bold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>

        <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 py-16 border-t border-border/50" delay={40}>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Why Choose Bmb Tech Hosting?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Built for WhatsApp bot operators who need reliability without the technical overhead.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <Reveal key={feature.title} delay={i * 60}>
                <div className="group p-5 rounded-xl border border-border bg-card/50 hover:border-teal-500/30 hover:bg-card hover:shadow-md transition-all h-full">
                  <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <feature.icon className="w-4 h-4 text-teal-400" />
                  </div>
                  <h3 className="font-semibold mb-1.5">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>

        <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 py-16 border-t border-border/50" delay={40}>
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-12 items-center">
              <div className="flex-1 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold mb-6">
                  <Coins className="w-3 h-3" />
                  Simple, Transparent Pricing
                </div>
                <h2 className="text-3xl font-bold mb-4">No Subscriptions. Just TX Coins.</h2>
                <p className="text-muted-foreground mb-8 leading-relaxed">
                  TX Coins are Bmb Tech Hosting's internal currency. Top up with exactly what you need — no recurring charges, no lock-in.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left mb-8">
                  {pricingPoints.map(point => (
                    <Reveal key={point}>
                      <div className="flex items-center gap-2.5 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                        <span className="text-muted-foreground">{point}</span>
                      </div>
                    </Reveal>
                  ))}
                </div>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-teal-600 to-orange-600 hover:from-teal-700 hover:to-orange-700 text-white"
                  onClick={() => navigateWithLoader(user ? "/topup" : "/signup")}
                >
                  {user ? "Top Up TX Coins" : "Get Started Free"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
              <div className="flex-shrink-0">
                <div className="p-6 rounded-2xl border border-teal-500/20 bg-teal-500/5 text-center space-y-4" style={{ minWidth: 220 }}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-teal-400 mb-2">Accepted Payments</p>
                  <div className="overflow-hidden" style={{ maxHeight: 160 }}>
                    <PaymentTicker />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Payments processed by Paystack</p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 py-16 border-t border-border/50" delay={40}>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Resources &amp; Support</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Everything you need to learn, troubleshoot, and get the most from Bmb Tech Hosting.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {resources.map((resource, i) => (
              <Reveal key={resource.title} delay={i * 80}>
                <div className="group p-6 rounded-xl border border-border bg-card/50 hover:border-teal-500/30 hover:bg-card hover:shadow-md transition-all flex flex-col h-full">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <resource.icon className="w-5 h-5 text-teal-400" />
                  </div>
                  <h3 className="font-semibold mb-2">{resource.title}</h3>
                  <p className="text-sm text-muted-foreground flex-1 leading-relaxed">{resource.desc}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 self-start group-hover:border-teal-500/40 transition-colors"
                    onClick={() => navigateWithLoader(resource.link)}
                  >
                    {resource.label} <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>

        {!authLoading && !user && (
          <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 py-16 border-t border-border/50">
            <div className="max-w-2xl mx-auto text-center">
              <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Join hundreds of bot operators already hosting on Bmb Tech Hosting. Sign up in seconds — no credit card required.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  size="lg"
                  className="w-full sm:w-auto px-8 bg-gradient-to-r from-teal-600 to-orange-600 hover:from-teal-700 hover:to-orange-700 text-white shadow-lg shadow-teal-500/25"
                  onClick={() => navigateWithLoader("/signup")}
                >
                  Create Free Account <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto px-8"
                  onClick={() => navigateWithLoader("/login")}
                >
                  Already have an account? Log In
                </Button>
                <a
                  href="https://whatsapp.com/channel/0029VawO6hgF6sn7k3SuVU3z"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 h-11 rounded-md border border-green-500/40 bg-green-500/10 text-green-300 text-sm font-semibold hover:bg-green-500/20 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Click to join our channel
                </a>
              </div>
            </div>
          </Reveal>
        )}
      </main>

      <footer className="border-t border-border mt-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <NavAnimatedLogo />
                <span className="font-bold">Bmb Tech Hosting</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                WhatsApp bot hosting and super cheap social media boosting. Reliable, fast, and affordable.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Services</p>
              <ul className="space-y-2">
                <li><button onClick={() => navigateWithLoader("/services/bots")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Bot Hosting</button></li>
                <li><button onClick={() => navigateWithLoader("/services/boosting")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Social Media Boosting</button></li>
                <li><button onClick={() => navigateWithLoader("/developers")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Developer API</button></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Resources</p>
              <ul className="space-y-2">
                <li><button onClick={() => navigateWithLoader("/docs")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Documentation</button></li>
                <li><button onClick={() => navigateWithLoader("/tutorials")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Tutorials</button></li>
                <li><button onClick={() => navigateWithLoader("/features")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Bot Features</button></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-3">Account</p>
              <ul className="space-y-2">
                <li><button onClick={() => navigateWithLoader("/contact")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</button></li>
                <li><button onClick={() => navigateWithLoader("/signup")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign Up</button></li>
                <li><button onClick={() => navigateWithLoader("/login")} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Log In</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Bmb Tech Hosting. All rights reserved.</p>
            <p className="text-xs text-muted-foreground">🇰🇪 M-Pesa · Airtel · 🇳🇬 OPay · Zap · USSD · 🇨🇲 MTN MoMo · Orange Money · 🇹🇿 Tigo Pesa · Vodacom · Card · Apple Pay · PayPal · and more</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
