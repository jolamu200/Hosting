import {
  useState, useEffect, useLayoutEffect, useRef, useCallback,
  type ChangeEvent, type KeyboardEvent, type TouchEvent, type ComponentType,
} from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { PageLoader } from "@/components/PageLoader";
import {
  ArrowLeft, MessagesSquare, Pin, Crown, ShieldCheck, User as UserIcon,
  ImagePlus, Send, Reply, Trash2, Copy, X, ArrowDown, Loader2,
} from "lucide-react";
import {
  fetchMessages, sendMessage, uploadChatImage, deleteMessage, togglePin,
  IMAGE_TYPES, CHAT_IMAGE_MAX,
  type ChatMessage, type ChatRole, type ChatUser,
} from "@/lib/chat";

type IconType = ComponentType<{ className?: string }>;

/* ------------------------------------------------------------------ */
/* Small helpers                                                        */
/* ------------------------------------------------------------------ */

// Matches http(s) links; the last character can't be trailing punctuation.
const URL_RE = /(https?:\/\/[^\s<>"']*[^\s<>"'.,!?;:)\]])/gi;

function Linkified({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={e => e.stopPropagation()}
            className="text-primary underline underline-offset-2 break-all"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h} 45% 36%)`;
}

/** Highest updatedAt in a batch (ISO strings sort correctly as text). */
function latestStamp(items: ChatMessage[], fallback: string): string {
  return items.reduce((max, m) => (m.updatedAt > max ? m.updatedAt : max), fallback);
}

function Avatar({ user, size = 40 }: { user: ChatUser; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (user.avatarUrl && !broken) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0 bg-muted"
      />
    );
  }
  return (
    <span
      className="grid place-items-center rounded-full font-bold text-white shrink-0"
      style={{ width: size, height: size, background: colorFor(user.username), fontSize: size * 0.42 }}
    >
      {user.username.charAt(0).toUpperCase()}
    </span>
  );
}

function RoleBadge({ role }: { role: ChatRole }) {
  if (role === "owner") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
        <Crown className="w-3.5 h-3.5" /> Owner
      </span>
    );
  }
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
        <ShieldCheck className="w-3.5 h-3.5" /> Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <UserIcon className="w-3.5 h-3.5" /> User
    </span>
  );
}

function Chip({ icon: Icon, label, onClick, danger }: { icon: IconType; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(); }}
      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition-colors ${
        danger
          ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/15"
          : "border-border bg-muted/40 hover:bg-muted"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* One message                                                          */
/* ------------------------------------------------------------------ */

interface RowProps {
  m: ChatMessage;
  mine: boolean;
  myRole: ChatRole;
  canModerate: boolean;
  selected: boolean;
  onSelect: () => void;
  onReply: () => void;
  onCopy: () => void;
  onPin: () => void;
  onDelete: () => void;
  onMediaLoad: () => void;
}

function MessageRow({ m, mine, myRole, canModerate, selected, onSelect, onReply, onCopy, onPin, onDelete, onMediaLoad }: RowProps) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    const s = startRef.current;
    startRef.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    // swipe either way = reply
    if (Math.abs(t.clientX - s.x) > 70 && Math.abs(t.clientY - s.y) < 40) onReply();
  };

  const canDelete = mine || (canModerate && !(m.user.role === "owner" && myRole !== "owner"));

  return (
    <div className="px-4 py-2 flex gap-3 items-start" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <Avatar user={m.user} size={40} />
      <div className="min-w-0 max-w-[88%]">
        <div
          onClick={e => { e.stopPropagation(); onSelect(); }}
          className={`rounded-2xl border px-4 py-3 cursor-pointer ${mine ? "border-primary/40 bg-primary/5" : "border-border bg-card/70"}`}
        >
          {m.pinned && (
            <p className="flex items-center gap-1.5 text-xs text-amber-400 mb-1.5">
              <Pin className="w-3.5 h-3.5" /> Pinned
            </p>
          )}
          {m.replyTo && (
            <div className="mb-2 border-l-2 border-border pl-3 text-xs text-muted-foreground truncate">
              {m.replyTo.deleted
                ? "Message deleted"
                : `${m.replyTo.username}: ${m.replyTo.text || (m.replyTo.hasImage ? "📷 Photo" : "")}`}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-[15px]">@{m.user.username}</span>
            <RoleBadge role={m.user.role} />
          </div>
          {m.text && (
            <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
              <Linkified text={m.text} />
            </p>
          )}
          {m.imageUrl && (
            <a href={m.imageUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
              <img
                src={m.imageUrl}
                alt="Shared picture"
                loading="lazy"
                onLoad={onMediaLoad}
                className="mt-2 rounded-xl max-h-72 w-auto max-w-full object-cover"
              />
            </a>
          )}
          <p className="mt-1 text-right text-xs text-muted-foreground">{formatTime(m.createdAt)}</p>
        </div>

        {selected && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip icon={Reply} label="Reply" onClick={onReply} />
            {m.text && <Chip icon={Copy} label="Copy" onClick={onCopy} />}
            {canModerate && <Chip icon={Pin} label={m.pinned ? "Unpin" : "Pin"} onClick={onPin} />}
            {canDelete && <Chip icon={Trash2} label="Delete" onClick={onDelete} danger />}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export function Community() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinned, setPinned] = useState<ChatMessage | null>(null);
  const [canModerate, setCanModerate] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ file: File; preview: string } | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const cursorRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const restoreRef = useRef<number | null>(null);
  const lastIdRef = useRef("");
  const inflightRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const userId = user?.id;
  const myRole: ChatRole = user?.isAdmin ? "owner" : user?.isModerator ? "admin" : "user";

  /** Adds / updates / removes messages; ignores old messages that fall outside the loaded window. */
  const mergeMessages = useCallback((incoming: ChatMessage[]) => {
    setMessages(prev => {
      const map = new Map(prev.map(m => [m.id, m]));
      const oldest = prev.length ? prev[0].createdAt : "";
      let changed = false;
      for (const m of incoming) {
        if (m.deleted) {
          if (map.delete(m.id)) changed = true;
          continue;
        }
        const old = map.get(m.id);
        if (!old) {
          if (oldest && m.createdAt < oldest) continue;
          map.set(m.id, m);
          changed = true;
        } else if (old.updatedAt !== m.updatedAt) {
          map.set(m.id, m);
          changed = true;
        }
      }
      if (!changed) return prev;
      return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }, []);

  const applyPinned = useCallback((p: ChatMessage | null) => {
    setPinned(prev => (prev?.id === p?.id && prev?.updatedAt === p?.updatedAt ? prev : p));
  }, []);

  // First load
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    (async () => {
      try {
        const page = await fetchMessages({ limit: 60 });
        if (cancelled) return;
        const list = page.messages.filter(m => !m.deleted);
        setMessages(list);
        applyPinned(page.pinned);
        setCanModerate(page.canModerate);
        setHasMore(page.hasMore);
        cursorRef.current = latestStamp(list, page.serverTime);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Could not load the chat.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, reloadKey, applyPinned]);

  // Live updates: poll every 3 seconds while the tab is visible
  useEffect(() => {
    if (!userId || loading || loadError) return;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState === "hidden" || inflightRef.current) return;
      inflightRef.current = true;
      try {
        const page = await fetchMessages({ after: cursorRef.current });
        if (stopped) return;
        mergeMessages(page.messages);
        applyPinned(page.pinned);
        setCanModerate(page.canModerate);
        cursorRef.current = latestStamp(page.messages, cursorRef.current || page.serverTime);
      } catch {
        /* transient network error: try again on the next tick */
      } finally {
        inflightRef.current = false;
      }
    };
    const id = setInterval(tick, 3000);
    const onVisible = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, loading, loadError, mergeMessages, applyPinned]);

  // Keep the view pinned to the newest message (unless the reader scrolled up)
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (restoreRef.current !== null) {
      el.scrollTop += el.scrollHeight - restoreRef.current;
      restoreRef.current = null;
      return;
    }
    const lastId = messages.length ? messages[messages.length - 1].id : "";
    if (lastId !== lastIdRef.current) {
      lastIdRef.current = lastId;
      if (stickRef.current) el.scrollTop = el.scrollHeight;
      else setShowJump(true);
    }
  }, [messages]);

  // Free the preview URL of a picked image
  useEffect(() => {
    return () => { if (image) URL.revokeObjectURL(image.preview); };
  }, [image]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    stickRef.current = near;
    if (near) setShowJump(false);
  };

  const jumpToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setShowJump(false);
  };

  const onMediaLoad = () => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  };

  const loadMore = async () => {
    if (loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const page = await fetchMessages({ before: messages[0].createdAt, limit: 50 });
      const el = scrollRef.current;
      if (el) restoreRef.current = el.scrollHeight;
      setMessages(prev => {
        const ids = new Set(prev.map(x => x.id));
        return [...page.messages.filter(x => !x.deleted && !ids.has(x.id)), ...prev];
      });
      setHasMore(page.hasMore);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not load older messages", "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  const handlePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) { showToast("Only JPEG, PNG or WebP images are allowed", "error"); return; }
    if (file.size > CHAT_IMAGE_MAX) { showToast("Image is too large (max 5 MB)", "error"); return; }
    setImage({ file, preview: URL.createObjectURL(file) });
  };

  const handleSend = async () => {
    const body = text.trim();
    if ((!body && !image) || sending) return;
    setSending(true);
    try {
      let imageId: string | undefined;
      if (image) {
        const up = await uploadChatImage(image.file);
        imageId = up.id;
      }
      const msg = await sendMessage({ text: body, imageId, replyTo: replyTo?.id });
      stickRef.current = true;
      mergeMessages([msg]);
      setText("");
      setImage(null);
      setReplyTo(null);
      if (inputRef.current) inputRef.current.style.height = "auto";
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not send your message", "error");
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Desktop: Enter sends, Shift+Enter = new line. On phones Enter = new line.
    if (e.key === "Enter" && !e.shiftKey && !window.matchMedia("(pointer: coarse)").matches) {
      e.preventDefault();
      handleSend();
    }
  };

  const startReply = (m: ChatMessage) => {
    setReplyTo(m);
    setSelectedId(null);
    inputRef.current?.focus();
  };

  const handleCopy = async (m: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(m.text);
      showToast("Copied", "success");
    } catch {
      showToast("Could not copy", "error");
    }
    setSelectedId(null);
  };

  const handlePin = async (m: ChatMessage) => {
    setSelectedId(null);
    try {
      const result = await togglePin(m.id);
      setPinned(result);
      showToast(result ? "Message pinned" : "Message unpinned", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not pin the message", "error");
    }
  };

  const handleDelete = async (m: ChatMessage) => {
    setSelectedId(null);
    if (!window.confirm("Delete this message?")) return;
    try {
      await deleteMessage(m.id);
      setMessages(prev => prev.filter(x => x.id !== m.id));
      setPinned(prev => (prev?.id === m.id ? null : prev));
      if (replyTo?.id === m.id) setReplyTo(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not delete the message", "error");
    }
  };

  if (authLoading || !user) return <PageLoader />;

  const visible = pinned ? messages.filter(m => m.id !== pinned.id) : messages;

  const renderRow = (m: ChatMessage) => (
    <MessageRow
      key={m.id}
      m={m}
      mine={m.user.id === user.id}
      myRole={myRole}
      canModerate={canModerate}
      selected={selectedId === m.id}
      onSelect={() => setSelectedId(prev => (prev === m.id ? null : m.id))}
      onReply={() => startReply(m)}
      onCopy={() => handleCopy(m)}
      onPin={() => handlePin(m)}
      onDelete={() => handleDelete(m)}
      onMediaLoad={onMediaLoad}
    />
  );

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* header */}
      <header className="shrink-0 h-16 px-3 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur">
        <button
          onClick={() => navigate("/dashboard")}
          className="grid place-items-center w-10 h-10 rounded-full hover:bg-muted transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="grid place-items-center w-10 h-10 text-muted-foreground">
          <MessagesSquare className="w-6 h-6" />
        </span>
        <div className="min-w-0">
          <h1 className="font-bold text-lg leading-tight truncate">Community Chat</h1>
          <p className="text-xs text-muted-foreground truncate">Community · swipe either way to reply</p>
        </div>
      </header>

      {/* messages */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onClick={() => setSelectedId(null)}
          className="h-full overflow-y-auto overscroll-contain py-2"
        >
          {loading ? (
            <div className="h-full grid place-items-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : loadError ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
              <p className="text-sm text-muted-foreground">{loadError}</p>
              <button
                onClick={() => setReloadKey(k => k + 1)}
                className="h-10 px-5 rounded-full bg-foreground text-background text-sm font-semibold"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              {hasMore && (
                <div className="flex justify-center py-2">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-full border border-border bg-muted/40 text-xs font-medium hover:bg-muted disabled:opacity-60"
                  >
                    {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Load earlier messages
                  </button>
                </div>
              )}

              {pinned && (
                <>
                  <p className="px-4 pt-2 pb-1 flex items-center gap-2 text-sm font-medium text-amber-400">
                    <Pin className="w-4 h-4" /> Pinned
                  </p>
                  {renderRow(pinned)}
                  <div className="mx-4 my-2 border-t border-border" />
                </>
              )}

              {visible.map(renderRow)}

              {visible.length === 0 && !pinned && (
                <div className="py-24 text-center px-6">
                  <MessagesSquare className="w-10 h-10 mx-auto text-muted-foreground/60 mb-3" />
                  <p className="text-sm text-muted-foreground">No messages yet. Say hi to the community 👋</p>
                </div>
              )}
              <div className="h-2" />
            </>
          )}
        </div>

        {showJump && (
          <button
            onClick={jumpToBottom}
            className="absolute bottom-3 right-4 inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-primary text-primary-foreground text-xs font-semibold shadow-lg"
          >
            <ArrowDown className="w-3.5 h-3.5" /> New messages
          </button>
        )}
      </div>

      {/* composer */}
      <footer className="shrink-0 border-t border-border bg-background px-4 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 rounded-xl border border-border bg-card px-3 py-2">
            <Reply className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0 flex-1 text-xs">
              <p className="font-semibold text-primary truncate">Replying to @{replyTo.user.username}</p>
              <p className="text-muted-foreground truncate">{replyTo.text || "📷 Photo"}</p>
            </div>
            <button onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {image && (
          <div className="relative inline-block mb-2">
            <img src={image.preview} alt="Selected" className="h-20 rounded-xl border border-border object-cover" />
            <button
              onClick={() => setImage(null)}
              aria-label="Remove picture"
              className="absolute -top-2 -right-2 grid place-items-center w-6 h-6 rounded-full bg-foreground text-background"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="grid place-items-center w-11 h-11 rounded-full border border-border bg-muted/40 hover:bg-muted transition-colors shrink-0"
            aria-label="Attach a picture"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePick} />
          <textarea
            ref={inputRef}
            value={text}
            rows={1}
            maxLength={2000}
            onChange={handleInput}
            onKeyDown={handleKey}
            placeholder="Message the community…"
            className="flex-1 min-w-0 resize-none rounded-3xl border border-border bg-card/70 px-4 py-3 text-[15px] leading-snug outline-none focus:border-primary/50 max-h-32 placeholder:text-muted-foreground"
          />
          <button
            onClick={handleSend}
            disabled={sending || (!text.trim() && !image)}
            className="grid place-items-center w-12 h-12 rounded-full bg-primary text-primary-foreground disabled:opacity-50 shrink-0 transition-opacity"
            aria-label="Send"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Images max 5 MB · JPEG, PNG, WebP</p>
      </footer>
    </div>
  );
}
