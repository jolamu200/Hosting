import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useNavLoader } from "@/App";
import { getApiKeyStatus, generateApiKey, pauseApiKey, resumeApiKey, deleteApiKey, revealApiKey } from "@/lib/api";
import {
  ArrowLeft, Code2, Copy, Check, RefreshCw, Pause, Play, Trash2,
  Loader2, KeyRound, AlertTriangle, Eye, EyeOff
} from "lucide-react";

function CodeBlock({ children }: { children: string }) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    showToast("Copied to clipboard", "success");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group">
      <pre className="bg-muted/50 border border-border rounded-lg p-3.5 text-xs overflow-x-auto"><code>{children}</code></pre>
      <button onClick={copy} className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 border border-border opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

interface EndpointDoc {
  method: string;
  path: string;
  desc: string;
  body?: string;
}

function EndpointRow({ ep, origin }: { ep: EndpointDoc; origin: string }) {
  const methodColor: Record<string, string> = {
    GET: "bg-teal-500/10 text-teal-400",
    POST: "bg-blue-500/10 text-blue-400",
    DELETE: "bg-red-500/10 text-red-400",
  };
  const curl = `curl${ep.method !== "GET" ? ` -X ${ep.method}` : ""} "${origin}${ep.path}" \\\n  -H "Authorization: Bearer <YOUR_API_KEY>"${ep.body ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${ep.body}'` : ""}`;
  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-3">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${methodColor[ep.method]}`}>{ep.method}</span>
        <code className="text-xs font-mono">{ep.path}</code>
      </div>
      <p className="text-sm text-muted-foreground mb-3">{ep.desc}</p>
      <CodeBlock>{curl}</CodeBlock>
    </div>
  );
}

export function DeveloperApi() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { navigateWithLoader } = useNavLoader();
  const { showToast } = useToast();

  const [status, setStatus] = useState<{ hasKey: boolean; maskedKey: string; active: boolean; callCount: number; lastUsedAt: string | null } | null>(null);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [revealBusy, setRevealBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const load = useCallback(async () => {
    try {
      const res = await getApiKeyStatus();
      setStatus(res);
    } catch {
      showToast("Failed to load API key status", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    load();
  }, [user, navigate, load]);

  const handleGenerate = async () => {
    setBusy(true);
    setRevealedKey(null);
    try {
      const res = await generateApiKey();
      if (res.apiKey) {
        setRawKey(res.apiKey);
        showToast("API key generated", "success");
        load();
      } else {
        showToast(res.error || "Failed to generate key", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePauseResume = async () => {
    setBusy(true);
    try {
      const res = status?.active ? await pauseApiKey() : await resumeApiKey();
      if (res.ok) { showToast(status?.active ? "API key paused" : "API key resumed", "success"); load(); }
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete your API key? Any integrations using it will stop working.")) return;
    setBusy(true);
    try {
      const res = await deleteApiKey();
      if (res.ok) { showToast("API key deleted", "success"); setRawKey(null); setRevealedKey(null); load(); }
    } finally {
      setBusy(false);
    }
  };

  const copyRawKey = () => {
    if (!rawKey) return;
    navigator.clipboard.writeText(rawKey);
    setCopied(true);
    showToast("Copied to clipboard", "success");
    setTimeout(() => setCopied(false), 1500);
  };

  const handleToggleReveal = async () => {
    if (revealedKey) { setRevealedKey(null); return; }
    setRevealBusy(true);
    try {
      const res = await revealApiKey();
      if (res.apiKey) setRevealedKey(res.apiKey);
      else showToast(res.error || "Couldn't reveal key", "error");
    } finally {
      setRevealBusy(false);
    }
  };

  const copyRevealedKey = () => {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey);
    showToast("Copied to clipboard", "success");
  };

  if (!user) return null;

  const templateEndpoints: EndpointDoc[] = [
    { method: "GET", path: "/api/v1/bot-templates", desc: "List all bot templates available to deploy. Free to call." },
  ];

  const botEndpoints: EndpointDoc[] = [
    { method: "POST", path: "/api/v1/bots/deploy-template", desc: "Deploy a bot from a template. Debits TX from your balance. months is 1-9 (defaults to 1); total cost is the template's TX rate × months.", body: '{"botTemplateId":"<id>","botName":"mybot","sessionVar":"<session>","months":1}' },
    { method: "GET", path: "/api/v1/bots", desc: "List all bots on your account." },
    { method: "POST", path: "/api/v1/bots/:id/stop", desc: "Stop a running bot." },
    { method: "POST", path: "/api/v1/bots/:id/restart", desc: "Restart a bot." },
    { method: "DELETE", path: "/api/v1/bots/:id", desc: "Permanently delete a bot." },
  ];

  const boostEndpoints: EndpointDoc[] = [
    { method: "GET", path: "/api/v1/boost/services?q=instagram&currency=KES", desc: "List boosting services from our local catalogue (fast). Optional query params: q, category, currency (KES, USD, NGN, ...). Response includes id, name, pricePer1000, min, max, platformId, serviceType." },
    { method: "GET", path: "/api/v1/boost/categories", desc: "List all category names for building filters." },
    { method: "POST", path: "/api/v1/boost/order", desc: "Place a boost order using TX only (no card/mobile money on the API). Debits TX from your balance. Returns 402 with requiredTx, balanceTx, shortfallTx if balance is too low. Auto-refunds TX if the upstream order fails.", body: '{"serviceId":745,"link":"https://instagram.com/handle","quantity":1000}' },
    { method: "GET", path: "/api/v1/boost/orders", desc: "List your boost orders plus stats (total, completed, pending, failed, globalCompleted)." },
    { method: "GET", path: "/api/v1/boost/orders/:id/refresh", desc: "Refresh a single order status from the fulfilment pipeline." },
  ];

  const accountEndpoints: EndpointDoc[] = [
    { method: "GET", path: "/api/v1/me", desc: "Check your account balance, currency, and API usage." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14 gap-3">
            <button onClick={() => navigateWithLoader("/dashboard")} className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-teal-400" />
              <span className="font-bold text-sm sm:text-base">Developer API</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <div>
          <h1 className="text-xl font-bold mb-1">My API Key</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Deploy bots and place social media boosting orders programmatically. One API key, simple REST endpoints, billed only from your TX balance (top up on the site first — direct card/mobile money is website-only).
          </p>
          <div className="mb-4 p-3 rounded-lg border border-teal-500/20 bg-teal-500/5 text-xs text-teal-200/90 leading-relaxed">
            <p className="font-semibold text-teal-300 mb-1">TX billing for API orders</p>
            <p>Boost and bot deploy calls deduct TX from your account. If you do not have enough TX, the API returns <code className="text-[11px]">402 INSUFFICIENT_COINS</code> with <code className="text-[11px]">requiredTx</code>, <code className="text-[11px]">balanceTx</code>, and <code className="text-[11px]">shortfallTx</code> so you can prompt the user to top up.</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-5">
              {rawKey && (
                <div className="mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300">Copy and store it safely. You can reveal it again anytime below.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono bg-background/60 rounded px-2 py-1.5 overflow-x-auto whitespace-nowrap">{rawKey}</code>
                    <button onClick={copyRawKey} className="p-2 rounded-md hover:bg-muted transition-colors shrink-0">
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {!status?.hasKey ? (
                <div className="text-center py-4">
                  <KeyRound className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">You haven't created an API key yet.</p>
                  <Button onClick={handleGenerate} disabled={busy} className="gap-2">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                    Generate API Key
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <code className="text-sm font-mono truncate">{revealedKey || status.maskedKey}</code>
                      {revealedKey && (
                        <button onClick={copyRevealedKey} className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${status.active ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400"}`}>
                      {status.active ? "Active" : "Paused"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4 text-xs text-muted-foreground">
                    <div><p className="font-medium text-foreground">{status.callCount}</p>Calls</div>
                    <div><p className="font-medium text-foreground">{status.lastUsedAt ? new Date(status.lastUsedAt).toLocaleDateString() : "Never"}</p>Last used</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleToggleReveal} disabled={revealBusy} className="gap-1.5">
                      {revealBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : revealedKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {revealedKey ? "Hide" : "Reveal"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleGenerate} disabled={busy} className="gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                    </Button>
                    <Button variant="outline" size="sm" onClick={handlePauseResume} disabled={busy} className="gap-1.5">
                      {status.active ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Resume</>}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleDelete} disabled={busy} className="gap-1.5 text-red-400 hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-lg font-bold mb-1">Base URL</h2>
          <CodeBlock>{`${origin}/api/v1`}</CodeBlock>
        </div>

        <div>
          <h2 className="text-lg font-bold mb-1">Authentication</h2>
          <p className="text-sm text-muted-foreground mb-3">Send your key on every request:</p>
          <CodeBlock>{`Authorization: Bearer <YOUR_API_KEY>`}</CodeBlock>
        </div>

        <div>
          <h2 className="text-lg font-bold mb-1">Rate Limits & Caching</h2>
          <p className="text-sm text-muted-foreground mb-3">
            300 requests per 15 minutes per key. GET /boost/services is read-only and free to call, but our catalogue only changes when we refresh it (about every 30 minutes) — so hitting it on every single page load or order is unnecessary and wastes your rate limit.
          </p>
          <p className="text-sm text-muted-foreground">
            Cache the response for at least 10–15 minutes on your side (in memory, Redis, or a database) and serve your own users from that cache. Only re-fetch when the cache expires, not on every request.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-bold mb-3">Account</h2>
          {accountEndpoints.map(ep => <EndpointRow key={ep.path} ep={ep} origin={origin} />)}
        </div>

        <div>
          <h2 className="text-lg font-bold mb-3">Bot Templates</h2>
          {templateEndpoints.map(ep => <EndpointRow key={ep.path} ep={ep} origin={origin} />)}
        </div>

        <div>
          <h2 className="text-lg font-bold mb-3">Bot Deployment</h2>
          {botEndpoints.map(ep => <EndpointRow key={ep.path} ep={ep} origin={origin} />)}
        </div>

        <div>
          <h2 className="text-lg font-bold mb-1">Social Media Boosting</h2>
          <p className="text-sm text-muted-foreground mb-3">
            Recommended flow: GET services → pick serviceId → POST order with link + quantity → poll GET orders or refresh. Cache the services list for 10–15 minutes on your side.
          </p>
          {boostEndpoints.map(ep => <EndpointRow key={ep.path + ep.method} ep={ep} origin={origin} />)}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-lg font-bold">Quick start example</h2>
          <p className="text-sm text-muted-foreground">Place 1000 Instagram followers after checking balance:</p>
          <CodeBlock>{`# 1) Check balance
curl "${origin}/api/v1/me" -H "Authorization: Bearer <YOUR_API_KEY>"

# 2) Find a service
curl "${origin}/api/v1/boost/services?q=instagram%20followers&currency=KES" \
  -H "Authorization: Bearer <YOUR_API_KEY>"

# 3) Place order (TX deducted)
curl -X POST "${origin}/api/v1/boost/order" \
  -H "Authorization: Bearer <YOUR_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"serviceId":745,"link":"https://instagram.com/handle","quantity":1000}'`}</CodeBlock>
          <p className="text-xs text-muted-foreground">On success you get order id, status, costTx, costKes, and balanceLeft. On low balance you get a clear 402 with how much TX is missing.</p>
        </div>
      </main>
    </div>
  );
}
