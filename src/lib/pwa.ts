import { useCallback, useEffect, useState } from "react";

/** Shown on the "Get our App" page. Bump it when you publish a new build. */
export const APP_VERSION = "1.0.0";

/**
 * Optional: put a signed APK at  public/app/bmb-tech.apk  and the page shows a
 * real "Download APK" option automatically. Without it, the app installs
 * straight from the browser (PWA) with one tap.
 */
export const APK_URL = "/app/bmb-tech.apk";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installedFlag = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

// Captured as soon as this module loads, so the browser's install offer isn't missed
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault(); // we show our own Install button instead of the browser mini-bar
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installedFlag = true;
    deferred = null;
    notify();
  });
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone;
}

export function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !window.isSecureContext) return;
  const register = () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}

/** True only when /app/bmb-tech.apk really exists (the SPA fallback returns HTML, which we reject). */
export async function checkApkAvailable(): Promise<boolean> {
  try {
    const res = await fetch(APK_URL, { method: "HEAD" });
    const type = res.headers.get("content-type") || "";
    return res.ok && !type.includes("text/html");
  } catch {
    return false;
  }
}

export function useInstallApp() {
  const [, force] = useState(0);

  useEffect(() => {
    registerServiceWorker();
    const l = () => force(n => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const promptInstall = useCallback(async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    const ev = deferred;
    if (!ev) return "unavailable";
    deferred = null; // a prompt event can only be used once
    notify();
    await ev.prompt();
    const choice = await ev.userChoice;
    if (choice.outcome === "accepted") {
      installedFlag = true;
      notify();
    }
    return choice.outcome;
  }, []);

  return { canPrompt: deferred !== null, installed: installedFlag || isStandalone(), promptInstall };
}
