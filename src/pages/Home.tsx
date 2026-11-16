import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { TechBackground } from "@/components/TechBackground";
import { AppLogoFull } from "@/components/AppLogo";
import { useAuth } from "@/hooks/useAuth";
import { useNavLoader } from "@/App";
import { tx } from "@/lib/money";
import {
  Bot, Zap, Shield, Clock, Coins, ArrowRight, CheckCircle2, Moon, Sun,
  Users, MessageCircle, BookOpen, Menu, X, TrendingUp, Code2, Terminal,
  Rocket, Wallet, ChevronDown,
} from "lucide-react";

const PAYMENT_METHODS = [
  "M-Pesa", "Airtel Money", "Tigo Pesa", "Vodacom M-Pesa", "MTN MoMo",
  "Visa / Mastercard", "Apple Pay", "OPay", "Bank Transfer", "USSD",
];

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    (localStorage.getItem("theme") as "dark" | "light") || "dark"
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("theme", theme);
  }, [theme]);
  return { theme, toggle: () => setTheme(t => (t === "dark" ? "light" : "dark")) };
}

/** Fades a block in once it scrolls into view. */
function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setTimeout(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; }, delay);
        obs.disconnect();
      }
    }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return (
    <div
      ref={ref}
      className={className}
      style={{ opacity: 0, transform: "translateY(18px)", transition: "opacity .7s ease, transform .7s ease" }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="max-w-2xl mb-10">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-3">{eyebrow}</p>
      <h2 className="text-3xl sm:text-4xl font-bold leading-tight">{title}</h2>
      {sub && <p className="text-muted-foreground mt-3 leading-relaxed">{sub}</p>}
    </div>
  );
}

const bento = [
  { icon: Zap, title: "Live in minutes", desc: "Pick a bot, paste your session ID, press Deploy. No servers to set up, no commands to learn.", span: "md:col-span-2", tone: "primary" },
  { icon: Clock, title: "Always on", desc: "Your bot keeps running while you sleep.", span: "", tone: "plain" },
  { icon: Shield, title: "Isolated apps", desc: "Every bot gets its own app, so one failure never touches another.", span: "", tone: "plain" },
  { icon: Wallet, title: "Pay how you live", desc: "Top up with mobile money, card or Apple Pay. Every price is shown in your own currency.", span: "md:col-span-2", tone: "amber" },
  { icon: Users, title: "Referral rewards", desc: "Earn rewards when friends join with your link.", span: "", tone: "plain" },
  { icon: BookOpen, title: "Guides included", desc: "Step-by-step docs and video tutorials for every feature.", span: "", tone: "plain" },
];

const steps = [
  { icon: Users, title: "Create your account", desc: "Sign up with Google, GitHub or a one-click email link." },
  { icon: Coins, title: "Add funds", desc: "Top up in seconds with mobile money or card." },
  { icon: Rocket, title: "Deploy your bot", desc: "Choose a template, paste your session ID and go live." },
];

const getFaqs = () => [
  { q: "How much does it cost?", a: `Bot hosting starts at ${tx(10)} per month. You add funds in your own currency and spend them on any service.` },
  { q: "How long does a deployment take?", a: "Usually a few minutes from pressing Deploy to your bot answering on WhatsApp." },
  { q: "Which payment methods are supported?", a: "Mobile money (M-Pesa, Airtel, Tigo, Vodacom, MTN and more), cards, Apple Pay and bank transfer, depending on your country." },
  { q: "What happens when my plan expires?", a: "You get a reminder before it ends and a short grace period. Renew from your balance to keep the same bot running." },
];

function TerminalCard() {
  const lines = [
    { t: "$ bmb deploy --bot bmb-bot", c: "text-foreground" },
    { t: "✔ session verified", c: "text-emerald-400" },
    { t: "✔ app created: bmbhost-amani", c: "text-emerald-400" },
    { t: "✔ variables configured", c: "text-emerald-400" },
    { t: "→ building…", c: "text-muted-foreground" },
    { t: "● bot online — 24/7", c: "text-primary" },
  ];
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-3xl blur-2xl opacity-60" style={{ background: "linear-gradient(120deg, hsl(var(--primary)/.25), hsl(var(--brand-2)/.18))" }} />
      <div className="relative rounded-2xl border border-border bmb-glass overflow-hidden shadow-2xl" style={{ animation: "bmb-float 7s ease-in-out infinite" }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-2 text-xs text-muted-foreground flex items-center gap-1.5"><Terminal className="w-3 h-3" /> deploy.log</span>
        </div>
        <div className="p-5 font-mono text-[13px] leading-7 min-h-[230px]">
          {lines.map((l, i) => (
            <div key={i} className={l.c} style={{ opacity: 0, animation: `fadeLine .4s ease forwards`, animationDelay: `${0.4 + i * 0.55}s` }}>
              {l.t}
            </div>
          ))}
          <span className="inline-block w-2 h-4 bg-primary align-middle" style={{ animation: "bmb-caret 1s steps(1) infinite" }} />
        </div>
        <div className="grid grid-cols-3 divide-x divide-border border-t border-border text-center">
          {[[tx(10), "per month"], ["24/7", "uptime"], ["~4 min", "to go live"]].map(([a, b]) => (
            <div key={a} className="py-3">
              <p className="font-display font-bold text-sm">{a}</p>
              <p className="text-[11px] text-muted-foreground">{b}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const { navigateWithLoader } = useNavLoader();
  const { theme, toggle: toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [menuOpen]);

  const navLinks = [
    { label: "Bots", href: "/services/bots" },
    { label: "Boosting", href: "/services/boosting" },
    { label: "Features", href: "/features" },
    { label: "API", href: "/developers" },
    { label: "Docs", href: "/docs" },
    { label: "Contact", href: "/contact" },
  ];
  const go = (href: string) => { navigateWithLoader(href); setMenuOpen(false); };

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      <style>{`@keyframes fadeLine{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}`}</style>
      <TechBackground />

      {/* Floating pill navigation */}
      <header className="sticky top-3 z-50 px-3 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-14 pl-4 pr-2 rounded-full border border-border bmb-glass shadow-lg shadow-black/5">
          <button onClick={() => go("/")} aria-label="Home"><AppLogoFull /></button>
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map(l => (
              <button key={l.href} onClick={() => go(l.href)} className="px-3 py-1.5 text-sm rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                {l.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <button onClick={toggleTheme} aria-label="Toggle theme" className="w-9 h-9 grid place-items-center rounded-full text-muted-foreground hover:bg-muted transition-colors">
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {!authLoading && (user ? (
              <Button size="sm" className="hidden sm:flex rounded-full" onClick={() => go("/dashboard")}>Dashboard</Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="hidden sm:flex rounded-full" onClick={() => go("/login")}>Log in</Button>
                <Button size="sm" className="hidden sm:flex rounded-full" onClick={() => go("/signup")}>Get started</Button>
              </>
            ))}
            <button onClick={() => setMenuOpen(o => !o)} aria-label="Menu" className="lg:hidden w-9 h-9 grid place-items-center rounded-full hover:bg-muted">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="lg:hidden max-w-5xl mx-auto mt-2 rounded-2xl border border-border bmb-glass p-3 shadow-xl">
            {navLinks.map(l => (
              <button key={l.href} onClick={() => go(l.href)} className="w-full text-left px-3 py-2.5 rounded-lg text-sm hover:bg-muted">{l.label}</button>
            ))}
            <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-border">
              {user ? (
                <Button className="col-span-2" onClick={() => go("/dashboard")}>Dashboard</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => go("/login")}>Log in</Button>
                  <Button onClick={() => go("/signup")}>Get started</Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-16 sm:pt-20 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> WhatsApp bot hosting, made simple
            </span>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.05]">
              Your bots, online <span className="bmb-gradient-text">around the clock.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
              Deploy a WhatsApp bot without touching a server. Pay with mobile money or card, and keep it running 24/7 with Bmb Tech.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button size="lg" className="rounded-full px-7 bmb-btn-glow" onClick={() => go(user ? "/services/bots" : "/signup")}>
                {user ? "Deploy a bot" : "Start free"} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button size="lg" variant="outline" className="rounded-full px-7" onClick={() => go("/services/boosting")}>
                <TrendingUp className="w-4 h-4 mr-1" /> Social boosting
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["No server skills needed", "Pay in your local currency", "Cancel anytime"].map(t => (
                <li key={t} className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" />{t}</li>
              ))}
            </ul>
          </div>
          <Reveal><TerminalCard /></Reveal>
        </section>

        {/* Payment marquee */}
        <section className="border-y border-border bg-card/40 overflow-hidden">
          <div className="flex w-max py-4" style={{ animation: "bmb-marquee 32s linear infinite" }}>
            {[...PAYMENT_METHODS, ...PAYMENT_METHODS].map((m, i) => (
              <span key={i} className="mx-3 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-sm text-muted-foreground whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />{m}
              </span>
            ))}
          </div>
        </section>

        {/* Bento features */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <Reveal><SectionTitle eyebrow="Why Bmb Tech" title="Everything you need to keep a bot running" sub="Simple tools, fair pricing and reliable hosting — built for bot owners." /></Reveal>
          <div className="grid md:grid-cols-4 gap-4">
            {bento.map((f, i) => {
              const tone =
                f.tone === "primary" ? "bg-primary text-primary-foreground border-transparent"
                : f.tone === "amber" ? "border-[hsl(var(--brand-2)/0.35)] bg-[hsl(var(--brand-2)/0.08)]"
                : "bg-card border-border";
              return (
                <Reveal key={f.title} delay={i * 60} className={f.span}>
                  <div className={`h-full rounded-2xl border p-6 transition-transform hover:-translate-y-1 ${tone}`}>
                    <f.icon className={`w-6 h-6 mb-4 ${f.tone === "primary" ? "" : f.tone === "amber" ? "text-[hsl(var(--brand-2))]" : "text-primary"}`} />
                    <h3 className="font-bold text-lg mb-1.5">{f.title}</h3>
                    <p className={`text-sm leading-relaxed ${f.tone === "primary" ? "opacity-80" : "text-muted-foreground"}`}>{f.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* Steps */}
        <section className="border-y border-border bg-card/30">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
            <Reveal><SectionTitle eyebrow="How it works" title="From sign-up to live bot in three steps" /></Reveal>
            <div className="relative grid md:grid-cols-3 gap-6">
              <div className="hidden md:block absolute top-6 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />
              {steps.map((s, i) => (
                <Reveal key={s.title} delay={i * 110}>
                  <div className="relative text-center md:text-left">
                    <div className="mx-auto md:mx-0 w-12 h-12 rounded-xl bg-background border border-border grid place-items-center text-primary relative z-10">
                      <s.icon className="w-5 h-5" />
                    </div>
                    <p className="mt-4 text-xs font-semibold text-muted-foreground">STEP {i + 1}</p>
                    <h3 className="font-bold text-lg mt-1">{s.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{s.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Services + pricing */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 grid lg:grid-cols-2 gap-6">
          <Reveal>
            <div className="h-full rounded-2xl border border-border bg-card p-8 flex flex-col">
              <Bot className="w-7 h-7 text-primary" />
              <h3 className="font-display text-2xl font-bold mt-4">Bot hosting</h3>
              <p className="text-muted-foreground mt-2 leading-relaxed">Pick a ready-made WhatsApp bot, add your session ID and deploy. Renew from your balance whenever you like.</p>
              <p className="mt-6"><span className="font-display text-5xl font-extrabold bmb-gradient-text">{tx(10)}</span> <span className="text-muted-foreground">/ month</span></p>
              <ul className="mt-5 space-y-2 text-sm">
                {["Up to 9 months per deployment", "Live logs and restart controls", "Reminders before expiry"].map(t => (
                  <li key={t} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-primary" />{t}</li>
                ))}
              </ul>
              <Button className="mt-8 rounded-full self-start" onClick={() => go("/services/bots")}>Browse bots <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="h-full rounded-2xl border border-[hsl(var(--brand-2)/0.35)] bg-[hsl(var(--brand-2)/0.07)] p-8 flex flex-col">
              <TrendingUp className="w-7 h-7 text-[hsl(var(--brand-2))]" />
              <h3 className="font-display text-2xl font-bold mt-4">Social boosting</h3>
              <p className="text-muted-foreground mt-2 leading-relaxed">Grow followers, likes and views across popular platforms at low prices, paid from the same wallet.</p>
              <ul className="mt-6 space-y-2 text-sm">
                {["Pay with mobile money or card", "Track every order in one place", "Fast, automatic delivery"].map(t => (
                  <li key={t} className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[hsl(var(--brand-2))]" />{t}</li>
                ))}
              </ul>
              <Button variant="outline" className="mt-auto rounded-full self-start" onClick={() => go("/services/boosting")}>Open boosting <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </div>
          </Reveal>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-20">
          <Reveal><SectionTitle eyebrow="FAQ" title="Questions, answered" /></Reveal>
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {getFaqs().map((f, i) => (
              <div key={f.q}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 font-semibold">
                  {f.q}
                  <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && <p className="px-5 pb-5 -mt-1 text-sm text-muted-foreground leading-relaxed">{f.a}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        {!user && !authLoading && (
          <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
            <Reveal>
              <div className="rounded-3xl p-10 sm:p-14 text-center relative overflow-hidden" style={{ background: "linear-gradient(120deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-[hsl(224_60%_6%)]">Ready to put your bot online?</h2>
                <p className="mt-3 text-[hsl(224_60%_6%/0.75)] max-w-xl mx-auto">Create an account in seconds and deploy your first bot today.</p>
                <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
                  <button onClick={() => go("/signup")} className="rounded-full bg-[hsl(224_60%_6%)] text-white px-7 py-3 font-semibold hover:opacity-90 transition-opacity">Create free account</button>
                  <button onClick={() => go("/login")} className="rounded-full border border-[hsl(224_60%_6%/0.35)] text-[hsl(224_60%_6%)] px-7 py-3 font-semibold hover:bg-white/20 transition-colors">Log in</button>
                </div>
              </div>
            </Reveal>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <AppLogoFull />
            <p className="text-sm text-muted-foreground mt-3 max-w-xs leading-relaxed">WhatsApp bot hosting and social boosting, paid your way.</p>
            <a href="https://whatsapp.com/channel/0029VawO6hgF6sn7k3SuVU3z" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-4 text-sm text-primary hover:underline">
              <MessageCircle className="w-4 h-4" /> Join our WhatsApp channel
            </a>
          </div>
          {[
            { title: "Services", items: [["Bot hosting", "/services/bots"], ["Social boosting", "/services/boosting"], ["Developer API", "/developers"]] },
            { title: "Learn", items: [["Documentation", "/docs"], ["Tutorials", "/tutorials"], ["Bot features", "/features"]] },
            { title: "Account", items: [["Contact", "/contact"], ["Sign up", "/signup"], ["Log in", "/login"]] },
          ].map(col => (
            <div key={col.title}>
              <h4 className="text-sm font-bold mb-3">{col.title}</h4>
              <ul className="space-y-2">
                {col.items.map(([label, href]) => (
                  <li key={href}><button onClick={() => go(href)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{label}</button></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border py-5 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <Code2 className="w-3.5 h-3.5" /> © {new Date().getFullYear()} Bmb Tech. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
