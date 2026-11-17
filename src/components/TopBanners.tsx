import { useCallback, useEffect, useState } from "react";
import { Bell, X, Smartphone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getNotifications } from "@/lib/api";
import { useInstallApp } from "@/lib/pwa";
import type { AppNotification } from "@/types";

const NOTE_KEY = "banner_note_dismissed";
const INSTALL_KEY = "banner_install_dismissed_at";
const WEEK = 7 * 24 * 60 * 60 * 1000;

function readNoteDismissed(): string {
  try { return localStorage.getItem(NOTE_KEY) || ""; } catch { return ""; }
}

function installRecentlyDismissed(): boolean {
  try {
    const t = Number(localStorage.getItem(INSTALL_KEY));
    return !!t && Date.now() - t < WEEK;
  } catch {
    return false;
  }
}

/** Strips at the very top of the dashboard: latest unread notification + "install the app". */
export function TopBanners({ onInstall }: { onInstall: () => void }) {
  const { user } = useAuth();
  const { installed } = useInstallApp();
  const [latest, setLatest] = useState<AppNotification | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [noteDismissed, setNoteDismissed] = useState<string>(readNoteDismissed);
  const [installHidden, setInstallHidden] = useState<boolean>(installRecentlyDismissed);

  const load = useCallback(async () => {
    try {
      const data = await getNotifications() as { notifications?: AppNotification[]; unreadCount?: number };
      const list = data.notifications || [];
      setLatest(list.find(n => !n.read) ?? null);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      /* ignore: banners are optional */
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [user, load]);

  const dismissNote = () => {
    if (!latest) return;
    setNoteDismissed(latest._id);
    try { localStorage.setItem(NOTE_KEY, latest._id); } catch { /* ignore */ }
  };

  const openAll = () => {
    window.dispatchEvent(new Event("open-notifications"));
    dismissNote();
  };

  const hideInstall = () => {
    setInstallHidden(true);
    try { localStorage.setItem(INSTALL_KEY, String(Date.now())); } catch { /* ignore */ }
  };

  const showNote = !!latest && latest._id !== noteDismissed;
  const showInstall = !installed && !installHidden;
  if (!showNote && !showInstall) return null;

  const more = Math.max(0, unreadCount - 1);

  return (
    <div className="space-y-3">
      {showNote && latest && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 px-3 py-3">
          <span className="grid place-items-center w-10 h-10 rounded-xl border border-primary/30 bg-primary/10 shrink-0">
            <Bell className="w-4 h-4 text-primary" />
          </span>
          <p className="flex-1 min-w-0 text-sm leading-snug">
            <span className="font-semibold">{latest.title}</span>
            {more > 0 && <span className="text-muted-foreground"> (+{more} more unread)</span>}
          </p>
          <button
            onClick={openAll}
            className="h-9 px-3 rounded-xl border border-primary/40 bg-primary/10 text-primary text-sm font-semibold shrink-0 hover:bg-primary/20 transition-colors"
          >
            View All
          </button>
          <button onClick={dismissNote} aria-label="Dismiss notification" className="p-1 text-muted-foreground hover:text-foreground shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showInstall && (
        <div
          role="button"
          tabIndex={0}
          onClick={onInstall}
          onKeyDown={e => { if (e.key === "Enter") onInstall(); }}
          className="flex items-center gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3 py-3 cursor-pointer hover:bg-amber-500/15 transition-colors"
        >
          <span className="grid place-items-center w-10 h-10 rounded-xl border border-amber-500/30 bg-amber-500/10 shrink-0">
            <Smartphone className="w-4 h-4 text-amber-400" />
          </span>
          <p className="flex-1 min-w-0 text-sm leading-snug">
            <span className="font-semibold">Get the Bmb Tech app</span>
            <span className="block text-xs text-muted-foreground">Install it on your phone for faster access.</span>
          </p>
          <button
            onClick={e => { e.stopPropagation(); onInstall(); }}
            className="h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shrink-0 hover:opacity-90 transition-opacity"
          >
            Install
          </button>
          <button
            onClick={e => { e.stopPropagation(); hideInstall(); }}
            aria-label="Dismiss"
            className="p-1 text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
