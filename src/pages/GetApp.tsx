import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Smartphone, Apple, Check, Download, ShieldCheck, RefreshCw, Loader2 } from "lucide-react";
import { APP_VERSION, APK_URL, checkApkAvailable, useInstallApp } from "@/lib/pwa";

type Device = "android" | "ios";

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card/70 p-5">
      <h2 className="flex items-center gap-2.5 font-bold text-[15px] mb-4">
        <span className="text-primary">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function CheckRow({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[15px] text-muted-foreground leading-snug">
      <span className="mt-0.5 grid place-items-center w-5 h-5 rounded-full border border-primary/50 text-primary shrink-0">
        <Check className="w-3 h-3" />
      </span>
      <span>{children}</span>
    </li>
  );
}

function AppIcon() {
  return (
    <img
      src="/favicon-192.png"
      alt="Bmb Tech"
      className="mx-auto w-28 h-28 rounded-[1.75rem] border border-border object-cover shadow-lg"
    />
  );
}

function BackToChoice({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
      <ArrowLeft className="w-4 h-4" /> Back to device choice
    </button>
  );
}

export function GetApp() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const device = params.get("device") as Device | null;
  const { canPrompt, installed, promptInstall } = useInstallApp();
  const [apk, setApk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");

  useEffect(() => {
    let cancelled = false;
    checkApkAvailable().then(ok => { if (!cancelled) setApk(ok); });
    return () => { cancelled = true; };
  }, []);

  const goChoice = () => setParams({});

  const handleInstall = async () => {
    setHint("");
    if (installed) return;
    if (canPrompt) {
      setBusy(true);
      try {
        const result = await promptInstall();
        if (result === "dismissed") {
          setHint("Installation was cancelled. You can install later from the Chrome menu (⋮) → Install app.");
        }
      } finally {
        setBusy(false);
      }
      return;
    }
    if (apk) {
      window.location.href = APK_URL;
      return;
    }
    setHint("Open the Chrome menu (⋮) and tap “Install app” or “Add to Home screen”. If you don’t see it, open this page in Chrome.");
  };

  const buttonLabel = installed
    ? "App installed"
    : apk && !canPrompt
      ? `Download Android app · v${APP_VERSION}`
      : `Install Android app · v${APP_VERSION}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 h-14 px-3 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur">
        <button
          onClick={() => navigate(user ? "/dashboard" : "/")}
          className="grid place-items-center w-10 h-10 rounded-full hover:bg-muted transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-base">Get our App</h1>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 pb-16">
        {/* ---------- Step 1: choose a device ---------- */}
        {device !== "android" && device !== "ios" && (
          <>
            <div className="text-center">
              <div className="mx-auto grid place-items-center w-24 h-24 rounded-3xl border border-primary/30 bg-primary/10">
                <Smartphone className="w-10 h-10 text-primary" />
              </div>
              <h2 className="mt-5 text-3xl font-extrabold font-display">Get our App</h2>
              <p className="mt-3 text-[15px] font-medium">
                Get our Android App · iOS users <span className="text-amber-400">Coming soon</span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose your device below. Android is ready to install; iPhone support is on the way.
              </p>
            </div>

            <div className="mt-7 space-y-3">
              <button
                onClick={() => setParams({ device: "android" })}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card/70 hover:bg-muted/50 transition-colors text-left"
              >
                <span className="grid place-items-center w-14 h-14 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 shrink-0">
                  <Smartphone className="w-6 h-6 text-emerald-400" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-lg">Android</span>
                  <span className="block text-sm text-muted-foreground">Install the free app · Ready now</span>
                </span>
                <span className="text-sm font-semibold text-primary shrink-0">Select</span>
              </button>

              <button
                onClick={() => setParams({ device: "ios" })}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card/70 hover:bg-muted/50 transition-colors text-left"
              >
                <span className="grid place-items-center w-14 h-14 rounded-2xl bg-muted/60 shrink-0">
                  <Apple className="w-6 h-6 text-muted-foreground" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-lg">iOS / iPhone</span>
                  <span className="block text-sm text-muted-foreground">iOS users · Coming soon</span>
                </span>
                <span className="text-[11px] font-bold tracking-wide uppercase text-amber-400 border border-amber-500/40 bg-amber-500/10 rounded-full px-3 py-1.5 shrink-0">
                  Coming soon
                </span>
              </button>
            </div>
          </>
        )}

        {/* ---------- Step 2a: Android ---------- */}
        {device === "android" && (
          <>
            <BackToChoice onClick={goChoice} />
            <div className="text-center">
              <AppIcon />
              <h2 className="mt-6 text-2xl font-extrabold font-display">Bmb Tech for Android</h2>
              <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed">
                Official app for faster access to deploy bots, top up coins, manage your bots, social boosts and the
                Community Chat — the same secure account as the website.
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Latest version: <span className="font-bold text-foreground">v{APP_VERSION}</span> · {apk ? "APK" : "App"} · Free
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <Card icon={<Smartphone className="w-5 h-5" />} title="What you get">
                <ul className="space-y-3">
                  <CheckRow>Opens full-screen from your home screen, just like a native app</CheckRow>
                  <CheckRow>Same Coins wallet, bots and Community Chat as on the website</CheckRow>
                  <CheckRow>Always the latest version — it updates itself, no manual updates</CheckRow>
                  <CheckRow>Free and lightweight — installs in a few seconds</CheckRow>
                </ul>
              </Card>

              <Card icon={<RefreshCw className="w-5 h-5" />} title="How to install">
                <ol className="space-y-3 text-[15px] text-muted-foreground leading-snug">
                  <li>1. Tap <span className="font-semibold text-foreground">Install Android app</span> below.</li>
                  <li>2. When your phone asks you to confirm, tap <span className="font-semibold text-foreground">Install</span>.</li>
                  <li>3. Open <span className="font-semibold text-foreground">Bmb Tech</span> from your home screen and sign in.</li>
                  <li>4. No prompt appeared? Open the Chrome menu <span className="font-semibold text-foreground">⋮</span> and tap <span className="font-semibold text-foreground">Install app</span> or <span className="font-semibold text-foreground">Add to Home screen</span>.</li>
                </ol>
              </Card>

              <Card icon={<ShieldCheck className="w-5 h-5" />} title="First install tips">
                <ul className="space-y-2.5 text-[15px] text-muted-foreground leading-snug list-disc pl-5">
                  <li>Use Chrome on your phone for the smoothest install.</li>
                  <li>Sign in with the same Google, GitHub or email account you use on the website.</li>
                  {apk && <li>If you downloaded the APK file, open it from your Downloads and allow installs from this source if Android asks.</li>}
                </ul>
              </Card>
            </div>

            <button
              onClick={handleInstall}
              disabled={busy || installed}
              className="mt-6 w-full h-14 rounded-2xl bg-primary text-primary-foreground font-bold text-base inline-flex items-center justify-center gap-2.5 disabled:opacity-60 hover:opacity-90 transition-opacity"
            >
              {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : installed ? <Check className="w-5 h-5" /> : <Download className="w-5 h-5" />}
              {buttonLabel}
            </button>
            {hint && <p className="mt-3 text-sm text-amber-400 text-center leading-snug">{hint}</p>}
            {apk && canPrompt && !installed && (
              <p className="mt-3 text-sm text-center text-muted-foreground">
                Prefer the APK file?{" "}
                <a href={APK_URL} className="text-primary underline underline-offset-2">Download APK</a>
              </p>
            )}
            <p className="mt-3 text-center text-xs text-muted-foreground">Free · Works in Chrome on Android</p>
          </>
        )}

        {/* ---------- Step 2b: iPhone ---------- */}
        {device === "ios" && (
          <>
            <BackToChoice onClick={goChoice} />
            <div className="text-center">
              <AppIcon />
              <h2 className="mt-6 text-2xl font-extrabold font-display">Bmb Tech for iPhone</h2>
              <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed">
                An official iOS app is planned so you can manage bots, Coins and boosts from your iPhone. It is not
                available for download yet.
              </p>
              <p className="mt-3 text-sm font-semibold text-amber-400">Coming soon</p>
            </div>

            <section className="mt-6 rounded-2xl border border-border bg-card/70 p-5 space-y-4 text-[15px] text-muted-foreground leading-relaxed">
              <p>
                Until the iPhone app launches, open <span className="font-semibold text-foreground">{window.location.host}</span> in{" "}
                <span className="font-semibold text-foreground">Safari</span> and sign in with the same account.
              </p>
              <p>
                Tip: in Safari tap <span className="font-semibold text-foreground">Share</span>, then{" "}
                <span className="font-semibold text-foreground">Add to Home Screen</span> to keep it one tap away.
              </p>
              <p>
                Prefer Android right now? Go back and choose <span className="font-semibold text-foreground">Android</span> to
                install the free app.
              </p>
            </section>

            <button
              disabled
              className="mt-6 w-full h-14 rounded-2xl bg-primary/40 text-primary-foreground/70 font-bold text-base inline-flex items-center justify-center gap-2.5 cursor-not-allowed"
            >
              <Download className="w-5 h-5" />
              Download iPhone app · Coming soon
            </button>
            <p className="mt-3 text-center text-xs text-muted-foreground">Button disabled until the iOS release</p>
          </>
        )}
      </main>
    </div>
  );
}
