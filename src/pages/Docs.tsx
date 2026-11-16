import { ArrowLeft, Zap, BookOpen, Shield, Repeat2, Gift, Users, HelpCircle, ChevronDown, AlertTriangle, Search } from "lucide-react";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { useNavLoader } from "@/App";
import { TechBackground } from "@/components/TechBackground";

const ANIM = `
@keyframes docsSlideIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes docsFadeIn{from{opacity:0}to{opacity:1}}
@keyframes docsScaleIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
`;

interface FAQItem { q: string; a: string; tags?: string[]; }
interface Section { icon: React.ComponentType<{ className?: string }>; title: string; color?: string; items: FAQItem[]; }

const sections: Section[] = [
  {
    icon: Zap,
    title: "Getting Started",
    color: "purple",
    items: [
      { q: "How do I deploy a bot?", a: "From your dashboard, go to Services → Bot Deployment. Browse the available bot templates and click 'Deploy'. On the deploy page: get your session ID (Step 1), enter a bot name of at least 5 letters (Step 2), paste your session ID (Step 3), choose your device mode (Step 4), then click Deploy. Your bot builds in roughly 4 minutes.", tags: ["deploy", "start", "setup", "new"] },
      { q: "Where do I get a session ID?", a: "Each bot template has a 'Get Session ID' button that opens the pairing page. Follow the pairing process and you'll receive a long session string — copy and paste the entire value into the deploy form.", tags: ["session", "pair", "qr", "link"] },
      { q: "What's the difference between Android and iOS device?", a: "Android enables interactive buttons (list menus, quick-reply buttons). iOS uses text-only responses. Choose based on your bot's feature set — Android is recommended for most use cases.", tags: ["android", "ios", "device", "mode"] },
      { q: "How much does hosting cost?", a: "Hosting is a small monthly fee per bot. The exact price in your own currency is shown clearly on each bot's deploy page before you confirm.", tags: ["price", "cost", "tx", "coins"] },
      { q: "Can I deploy multiple bots?", a: "Yes. You can deploy as many bots as your balance allows, and manage them all from the My Bots page.", tags: ["multiple", "more", "bots"] },
      { q: "How long does deployment take?", a: "Deployment typically takes around 4 minutes. During this time, Heroku builds and starts your bot. You'll see the status update from 'building' to 'running' on the My Bots page once it's ready.", tags: ["time", "deploy", "how long", "minutes", "building"] },
    ],
  },
  {
    icon: Repeat2,
    title: "Managing Your Bot",
    color: "indigo",
    items: [
      { q: "How do I restart or stop my bot?", a: "From My Bots, each bot card has Start, Stop, and Restart buttons. Use these to control your bot's lifecycle.", tags: ["restart", "stop", "start", "control"] },
      { q: "How do I update my session ID?", a: "Click 'Edit' on your bot card, enter the new session string, and save. This is useful if WhatsApp logs you out or you get a new session.", tags: ["update", "session", "edit", "change"] },
      { q: "How do I view logs?", a: "Click the 'Logs' button on any bot card. This shows recent application output to help you debug issues.", tags: ["logs", "debug", "output", "error"] },
      { q: "My bot stopped working after a WhatsApp update — what do I do?", a: "Generate a new session using the pairing link for your bot, then update your bot via the Edit button with the new session ID, and restart. This usually resolves WhatsApp connection issues.", tags: ["stopped", "update", "whatsapp", "fix", "broken"] },
      { q: "How do I share my bot's deploy page?", a: "On the Bot Deployment page, each bot template has a 'Copy link' button. Share that link and it opens the deploy page for that specific bot directly.", tags: ["share", "link", "copy"] },
    ],
  },
  {
    icon: Zap,
    title: "Balance & Billing",
    color: "violet",
    items: [
      { q: "How does my balance work?", a: "Your balance is shown in your local currency and is used to pay for bot hosting and boosting. It never expires.", tags: ["tx", "coins", "currency", "what"] },
      { q: "How do I add funds?", a: "Go to the Top Up page. Choose a package and pay via M-Pesa, Airtel Money, Credit/Debit Card, or Apple Pay. Your balance is updated instantly after payment confirmation.", tags: ["buy", "top up", "purchase", "pay", "mpesa", "airtel", "card"] },
      { q: "What is the cheapest option?", a: "The Starter pack gives you the minimum needed to deploy a bot. The Best Deal pack gives the most value for your money — look for the 'Best Deal' badge.", tags: ["cheap", "cheap", "starter", "best", "deal"] },
      { q: "Does my balance expire?", a: "No — your balance never expires. Use it whenever you need to deploy or renew.", tags: ["expire", "expiry", "balance", "never"] },
      { q: "My payment went through but my balance didn't change", a: "Wait 1–2 minutes and refresh your dashboard. If your balance still hasn't changed after 5 minutes, contact support with your payment reference number.", tags: ["payment", "tx", "not added", "missing", "charged"] },
    ],
  },
  {
    icon: Gift,
    title: "Coupons",
    color: "green",
    items: [
      { q: "Where do I enter a coupon code?", a: "From the dashboard, click 'Coupon Code'. Enter the code you received and click Claim.", tags: ["coupon", "code", "claim", "enter"] },
      { q: "Where can I find coupon codes?", a: "Coupon codes are shared in the Bmb Tech WhatsApp channel and occasionally on social media. Keep an eye out!", tags: ["find", "coupon", "code", "where"] },
      { q: "Can I use the same coupon twice?", a: "No. Each coupon can only be claimed once, by one account.", tags: ["coupon", "twice", "reuse"] },
    ],
  },
  {
    icon: Users,
    title: "Referrals",
    color: "blue",
    items: [
      { q: "How do referrals work?", a: "Share your unique referral link from the dashboard. When someone signs up using your link, you both earn a reward automatically.", tags: ["referral", "invite", "earn", "bonus"] },
      { q: "Are there restrictions on referrals?", a: "Yes — accounts created from the same IP address or device as yours do not qualify for referral rewards. This prevents self-referrals.", tags: ["referral", "restriction", "ip", "self"] },
      { q: "When do I receive my referral reward?", a: "Instantly, as soon as your referral creates an account. No delays, no waiting.", tags: ["referral", "when", "instant"] },
    ],
  },
  {
    icon: Shield,
    title: "Account & Security",
    color: "green",
    items: [
      { q: "I forgot my password — how do I reset it?", a: "On the login page, click 'Forgot password?' and enter your email address. A password reset link will be sent to your inbox. If you signed up via GitHub or Google, you can log in using that OAuth option instead.", tags: ["password", "forgot", "reset", "login"] },
      { q: "My account was banned — what should I do?", a: "Contact support via the contact page with your account email. Bans are issued for Terms of Service violations. If you believe it's an error, we'll review it.", tags: ["banned", "suspended", "account", "ban"] },
      { q: "Is my session ID safe?", a: "Your session ID is stored encrypted and used only to connect your bot to WhatsApp. We do not share or expose it to third parties.", tags: ["session", "safe", "security", "privacy"] },
    ],
  },
  {
    icon: AlertTriangle,
    title: "Troubleshooting",
    color: "orange",
    items: [
      { q: "Bot stopped working / isn't responding", a: "WhatsApp may have disconnected the session. Try these steps in order:\n1. Go to My Bots and click Restart on the bot.\n2. If still not responding after 2 minutes, generate a new session using the bot's pairing link.\n3. Click Edit on your bot card, paste the new session ID, and save.\n4. Click Restart again.\nThis resolves most issues.", tags: ["stopped", "not responding", "offline", "fix", "broken", "session", "restart", "not working"] },
      { q: "Bot shows 'stopped' status unexpectedly", a: "WhatsApp may have logged out the session in the background. Go to Edit on your bot card, generate a new session using the bot's pairing link, paste the new session ID, save, and restart the bot.", tags: ["stopped", "status", "unexpected", "offline"] },
      { q: "How to update my session ID when WhatsApp logs out", a: "1. Click the 'Get Session ID' button for your bot template to open the pairing page.\n2. Scan the QR code or enter the pairing code in WhatsApp.\n3. Copy the full session string you receive.\n4. Go to My Bots → Edit on your bot → paste the new session ID → Save.\n5. Restart the bot.", tags: ["session", "update", "logout", "whatsapp", "qr", "pairing", "expired"] },
      { q: "Bot is running but not replying to messages", a: "Check these in order:\n1. Confirm the bot status shows 'running' on the My Bots page.\n2. Click 'Logs' and look for error messages.\n3. If logs show 'session expired' or similar — generate a new session and update it via Edit.\n4. If the bot was recently deployed, wait 5 minutes — some bots take time to fully initialize.\n5. If issues persist, contact support with your bot name and a screenshot of the logs.", tags: ["not replying", "not responding", "messages", "reply", "silent"] },
      { q: "Deploy failed / bot stuck in 'building'", a: "If your bot has been in 'building' status for more than 10 minutes, the deployment likely failed. Try:\n1. Go to Services → Bot Deployment.\n2. Click Deploy again using the same bot template and a fresh session ID.\n3. If the issue persists, contact support with your bot name.", tags: ["deploy failed", "building", "stuck", "failed", "deployment"] },
      { q: "The page goes blank / white screen", a: "Try a hard refresh (Ctrl+Shift+R on desktop, or pull down to refresh on mobile). If logged out, sign in again and navigate back. If the issue persists across refreshes, clear your browser cache.", tags: ["blank", "white", "screen", "empty", "page", "crash"] },
      { q: "Payment failed or was not processed", a: "If your M-Pesa / Airtel prompt didn't appear: make sure your phone number is correct and includes the country code. If payment was deducted but your balance wasn't updated, wait 3 minutes and refresh. If still missing, contact support with your reference number and a screenshot.", tags: ["payment", "failed", "not processed", "mpesa", "airtel", "charged"] },
      { q: "I can't log in to my account", a: "Try these:\n1. If using email+password: click 'Forgot password?' and reset it.\n2. If using GitHub or Google: click the respective OAuth button — do not enter a password.\n3. If your account was banned, the login page will show an error message.\n4. Try a different browser or clear cookies.", tags: ["login", "cant login", "sign in", "access", "locked out"] },
    ],
  },
  {
    icon: HelpCircle,
    title: "Common Questions",
    color: "purple",
    items: [
      { q: "Can I change my WhatsApp bot's phone number?", a: "No — bots are tied to the session ID which is linked to a specific WhatsApp number. To use a different number, deploy a new bot.", tags: ["phone", "number", "change", "whatsapp"] },
      { q: "What happens when my bot expires?", a: "When your bot's hosting period ends, it enters a 24-hour grace period where it stays in maintenance mode. After that, it is automatically deleted. Renew before expiry from the My Bots page to avoid data loss.", tags: ["expire", "expiry", "delete", "grace", "renew"] },
      { q: "Can I renew my bot?", a: "Yes. From the My Bots page, click 'Renew' on any active or expired bot. The cost will be deducted from your balance and the bot's expiry is extended by 30 days.", tags: ["renew", "extend", "subscription"] },
    ],
  },
];

function useRevealOnScroll(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const obs = new IntersectionObserver(([entry]) => {
      if (t) { clearTimeout(t); t = null; }
      if (entry.isIntersecting) {
        t = setTimeout(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; t = null; }, delay);
      } else {
        el.style.opacity = "0";
        el.style.transform = "translateY(16px)";
      }
    }, { threshold: 0.08 });
    obs.observe(el);
    return () => { obs.disconnect(); if (t) clearTimeout(t); };
  }, [delay]);
  return ref;
}

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRevealOnScroll(delay);
  return (
    <div ref={ref} className={className} style={{ opacity: 0, transform: "translateY(16px)", transition: `opacity 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.7s cubic-bezier(0.22,1,0.36,1) ${delay}ms` }}>
      {children}
    </div>
  );
}

function fuzzScore(text: string, query: string): number {
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  if (t.includes(q)) return 3;
  const words = q.split(/\s+/);
  let score = 0;
  for (const w of words) {
    if (w.length < 2) continue;
    if (t.includes(w)) score += 2;
    else {
      for (let i = 0; i <= t.length - w.length; i++) {
        let diff = 0;
        for (let j = 0; j < w.length; j++) if (t[i + j] !== w[j]) diff++;
        if (diff <= 1) { score += 1; break; }
      }
    }
  }
  return score;
}

function searchSections(q: string) {
  if (!q.trim()) return null;
  const results: Array<{ item: FAQItem; sectionTitle: string; SectionIcon: Section["icon"]; score: number }> = [];
  for (const section of sections) {
    for (const item of section.items) {
      const haystack = [item.q, item.a, ...(item.tags || [])].join(" ");
      const score = fuzzScore(haystack, q);
      if (score > 0) {
        results.push({ item, sectionTitle: section.title, SectionIcon: section.icon, score });
      }
    }
  }
  results.sort((a, b) => b.score - a.score);
  if (results.length === 0) {
    const fallback = sections.find(s => s.title === "Troubleshooting");
    if (fallback) {
      return fallback.items.slice(0, 3).map(item => ({ item, sectionTitle: fallback.title, SectionIcon: fallback.icon, score: 0, isFallback: true }));
    }
  }
  return results.map(r => ({ ...r, isFallback: false }));
}

function FAQCard({ q, a, delay = 0 }: FAQItem & { delay?: number }) {
  const [open, setOpen] = useState(false);
  const lines = a.split("\n");
  return (
    <Reveal delay={delay}>
      <div className="border border-border rounded-xl overflow-hidden hover:border-teal-500/30 transition-colors">
        <button
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
          onClick={() => setOpen(!open)}
        >
          <span className="text-sm font-medium pr-4">{q}</span>
          <span className="shrink-0 transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </span>
        </button>
        {open && (
          <div className="px-4 pb-4 pt-0" style={{ animation: "docsSlideIn 0.2s ease both" }}>
            {lines.length > 1 ? (
              <div className="text-sm text-muted-foreground leading-relaxed space-y-1">
                {lines.map((line, i) => <p key={i}>{line}</p>)}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
            )}
          </div>
        )}
      </div>
    </Reveal>
  );
}

const colorMap: Record<string, string> = {
  purple: "text-teal-400 bg-teal-500/10 border-teal-500/20",
  indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  violet: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  green: "text-green-400 bg-green-500/10 border-green-500/20",
  blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  orange: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  yellow: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
};

export function Docs() {
  const { navigateWithLoader } = useNavLoader();
  const [search, setSearch] = useState("");
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["Getting Started"]));

  const filtered = searchSections(search);

  const toggleSection = (title: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background relative">
      <style>{ANIM}</style>
      <TechBackground />
      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-50">
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center h-14 gap-3">
            <button onClick={() => navigateWithLoader("/")} className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors" aria-label="Back">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <h1 className="font-bold text-base">Documentation & Help</h1>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 relative z-[1]">
        <Reveal>
          <div className="rounded-2xl bg-gradient-to-br from-teal-500/10 to-orange-500/5 border border-teal-500/20 p-5">
            <h2 className="font-bold text-lg mb-1">Bmb Tech Hosting Documentation</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Guides for deploying bots, payments, and troubleshooting. Can't find your answer? Contact support.
            </p>
            <button
              onClick={() => navigateWithLoader("/contact")}
              className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg bg-teal-500/15 text-teal-400 hover:bg-teal-500/25 text-xs font-medium transition-colors border border-teal-500/20"
            >
              Contact Support
            </button>
          </div>
        </Reveal>

        <Reveal delay={60}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search docs… e.g. 'bot not responding', 'payment failed'"
              className="w-full px-4 py-3 pl-10 rounded-xl border border-border bg-muted/50 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </Reveal>

        {filtered !== null ? (
          <div className="space-y-3" style={{ animation: "docsScaleIn 0.25s ease both" }}>
            {(filtered as Array<{ item: FAQItem; sectionTitle: string; SectionIcon: Section["icon"]; isFallback?: boolean }>).map((result, i) => (
              <Reveal key={i} delay={i * 40}>
                <div className="border border-border rounded-xl overflow-hidden hover:border-teal-500/30 transition-colors">
                  <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                    <result.SectionIcon className="w-3 h-3 text-teal-400" />
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wide font-semibold">{result.sectionTitle}</span>
                    {result.isFallback && <span className="text-[9px] text-muted-foreground/60 ml-auto">Suggested</span>}
                  </div>
                  <FAQCard {...result.item} />
                </div>
              </Reveal>
            ))}
            {(filtered as Array<{ isFallback?: boolean }>).every(r => r.isFallback) && search && (
              <Reveal delay={filtered.length * 40}>
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground">No exact match for "<span className="text-foreground">{search}</span>" — showing related troubleshooting.</p>
                  <button
                    className="mt-2 text-xs text-teal-400 hover:text-teal-300 transition-colors underline underline-offset-2"
                    onClick={() => navigateWithLoader("/contact")}
                  >
                    Still stuck? Contact support →
                  </button>
                </div>
              </Reveal>
            )}
          </div>
        ) : (
          <>
            {sections.map((section, si) => {
              const colors = colorMap[section.color || "purple"] || colorMap.purple;
              const isOpen = openSections.has(section.title);
              return (
                <Reveal key={section.title} delay={si * 50}>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/40 transition-colors"
                      onClick={() => toggleSection(section.title)}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${colors}`}>
                          <section.icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-semibold text-sm">{section.title}</span>
                        <span className="text-[11px] text-muted-foreground/60">({section.items.length})</span>
                      </div>
                      <span style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}>
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 space-y-2.5 border-t border-border/50" style={{ animation: "docsSlideIn 0.2s ease both" }}>
                        {section.items.map((item, i) => (
                          <FAQCard key={item.q} {...item} delay={i * 30} />
                        ))}
                      </div>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </>
        )}

        <Reveal delay={80}>
          <div className="rounded-2xl bg-card border border-border p-5 text-center">
            <p className="text-sm font-medium mb-1">Still need help?</p>
            <p className="text-xs text-muted-foreground mb-3">Our support team is available via the contact page.</p>
            <button
              onClick={() => navigateWithLoader("/contact")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-sm font-medium transition-colors"
            >
              Get Support
            </button>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
