import { useState, useEffect, useCallback, useMemo, useRef, type ReactElement } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import { useToast } from "@/hooks/useToast";
import { useNavLoader } from "@/App";
import {
  getBoostServices, placeBoostOrder, getBoostOrders, refreshBoostOrder,
  prepareBoostOrder, payBoostMpesa, getBoostMpesaStatus,
  payBoostTanzania, getBoostTanzaniaStatus,
  payBoostCardPrepare, payBoostCardInit, verifyBoostCard,
  getPaymentsConfig,
} from "@/lib/api";
import { PLATFORMS, iconUrl, type PlatformDef } from "@/lib/platforms";
import { lockScroll, unlockScroll } from "@/lib/scrollLock";

const LOGO_MPESA = "data:image/svg+xml;utf8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%20120%2080%22%3E%3Crect%20width=%22120%22%20height=%2280%22%20rx=%2210%22%20fill=%22%2316a34a%22/%3E%3Ctext%20x=%2260%22%20y=%2246%22%20text-anchor=%22middle%22%20font-family=%22Arial,Helvetica,sans-serif%22%20font-weight=%22700%22%20font-size=%2215%22%20fill=%22%23ffffff%22%3EM-PESA%3C/text%3E%3C/svg%3E";
const LOGO_AIRTEL = "data:image/svg+xml;utf8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%20120%2080%22%3E%3Crect%20width=%22120%22%20height=%2280%22%20rx=%2210%22%20fill=%22%23dc2626%22/%3E%3Ctext%20x=%2260%22%20y=%2246%22%20text-anchor=%22middle%22%20font-family=%22Arial,Helvetica,sans-serif%22%20font-weight=%22700%22%20font-size=%2215%22%20fill=%22%23ffffff%22%3EAirtel%3C/text%3E%3C/svg%3E";
const LOGO_CARD = "data:image/svg+xml;utf8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%20120%2080%22%3E%3Crect%20width=%22120%22%20height=%2280%22%20rx=%2210%22%20fill=%22%23334155%22/%3E%3Ctext%20x=%2260%22%20y=%2246%22%20text-anchor=%22middle%22%20font-family=%22Arial,Helvetica,sans-serif%22%20font-weight=%22700%22%20font-size=%2215%22%20fill=%22%23ffffff%22%3ECard%3C/text%3E%3C/svg%3E";
const LOGO_APPLEPAY = "data:image/svg+xml;utf8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%20120%2080%22%3E%3Crect%20width=%22120%22%20height=%2280%22%20rx=%2210%22%20fill=%22%23111827%22/%3E%3Ctext%20x=%2260%22%20y=%2246%22%20text-anchor=%22middle%22%20font-family=%22Arial,Helvetica,sans-serif%22%20font-weight=%22700%22%20font-size=%2215%22%20fill=%22%23ffffff%22%3EApple%20Pay%3C/text%3E%3C/svg%3E";
import {
  ArrowLeft, Search, TrendingUp, Loader2, Coins, ExternalLink,
  CheckCircle2, Clock, XCircle, RefreshCw, Send, LayoutGrid, X, ChevronDown, Check
} from "lucide-react";
import { tx } from "@/lib/money";

function normalizeKenyaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return "254" + digits.slice(1);
  if (digits.length === 9) return "254" + digits;
  return digits;
}
function isValidKenyaPhone(value: string): boolean {
  return /^254[17]\d{8}$/.test(normalizeKenyaPhone(value));
}

const HANDLE_TYPES = new Set(["Followers", "Subscribers", "Members"]);
function linkLabelFor(type: string | undefined): string {
  if (type && HANDLE_TYPES.has(type)) return "Profile handle / URL";
  return "Post / video link";
}
function exampleLinkFor(platformId: string | undefined, serviceType: string | undefined): string {
  const plat = PLATFORMS.find(p => p.id === platformId);
  const base = plat?.example || "https://example.com/your_profile";
  if (serviceType && HANDLE_TYPES.has(serviceType)) return base;
  const postExamples: Record<string, string> = {
    instagram: "https://instagram.com/p/POST_ID",
    tiktok: "https://tiktok.com/@your_handle/video/1234567890",
    youtube: "https://youtube.com/watch?v=VIDEO_ID",
    facebook: "https://facebook.com/your_page/posts/1234567890",
    x: "https://x.com/your_handle/status/1234567890",
    twitch: "https://twitch.tv/videos/1234567890",
    threads: "https://threads.net/@your_handle/post/POST_ID",
    linkedin: "https://linkedin.com/posts/your_profile_activity-123",
    pinterest: "https://pinterest.com/pin/1234567890",
    soundcloud: "https://soundcloud.com/your_handle/your-track",
    spotify: "https://open.spotify.com/track/TRACK_ID",
  };
  return postExamples[platformId || ""] || base;
}

interface BoostService {
  id: number;
  name: string;
  category: string;
  pricePer1000: number;
  currency: string;
  min: number;
  max: number;
  platformId: string;
  serviceType: string;
  isRegionVariant: boolean;
}

interface BoostOrderRow {
  _id: string;
  serviceName: string;
  category: string;
  link: string;
  quantity: number;
  costTx: number;
  status: string;
  createdAt: string;
}

function PlatformLogo({ platform, size = 22 }: { platform?: PlatformDef; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!platform || broken) return null;
  return (
    <img
      src={iconUrl(platform.slug)}
      alt=""
      width={size}
      height={size}
      onError={() => setBroken(true)}
    />
  );
}


function detectQuality(name: string): { label: string; color: string; meaning: string } | null {
  const lower = name.toLowerCase();
  if (/\bblue\b/.test(lower)) return { label: "Blue", color: "#3B82F6", meaning: "Standard quality — good for growth, mixed real & activity accounts" };
  if (/\bgreen\b/.test(lower)) return { label: "Green", color: "#22C55E", meaning: "High quality — mostly real-looking active accounts" };
  if (/\bpurple\b/.test(lower) || /\bvip\b/.test(lower)) return { label: "Purple / VIP", color: "#A855F7", meaning: "Premium quality — higher retention, more organic appearance" };
  if (/\bgold\b/.test(lower) || /\bpremium\b/.test(lower)) return { label: "Gold / Premium", color: "#EAB308", meaning: "Top tier quality — best retention and profile realism" };
  if (/\bhq\b/.test(lower) || /high.?quality/.test(lower)) return { label: "HQ", color: "#14B8A6", meaning: "High quality delivery with better retention" };
  if (/\beq\b/.test(lower) || /economy/.test(lower)) return { label: "Economy", color: "#94A3B8", meaning: "Budget option — faster & cheaper, lower retention" };
  return null;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { icon: ReactElement; className: string }> = {
    completed: { icon: <CheckCircle2 className="w-3 h-3" />, className: "bg-green-500/10 text-green-400" },
    processing: { icon: <Loader2 className="w-3 h-3 animate-spin" />, className: "bg-blue-500/10 text-blue-400" },
    pending: { icon: <Clock className="w-3 h-3" />, className: "bg-amber-500/10 text-amber-400" },
    partial: { icon: <Clock className="w-3 h-3" />, className: "bg-amber-500/10 text-amber-400" },
    failed: { icon: <XCircle className="w-3 h-3" />, className: "bg-red-500/10 text-red-400" },
    refunded: { icon: <XCircle className="w-3 h-3" />, className: "bg-red-500/10 text-red-400" },
  };
  const cfg = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${cfg.className}`}>
      {cfg.icon}{status}
    </span>
  );
}

type PayStage = "closed" | "choose" | "mpesa" | "tanzania" | "card" | "pending" | "success" | "failed";

export function SocialBoosting() {
  const { user, isModerator } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { navigateWithLoader } = useNavLoader();
  const { currencies, currency } = useCurrency();
  const { showToast } = useToast();

  const [tab, setTab] = useState<"browse" | "orders">(searchParams.get("tab") === "orders" ? "orders" : "browse");
  const [allServices, setAllServices] = useState<BoostService[]>([]);
  const [search, setSearch] = useState("");
  const [platformId, setPlatformId] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState<string | null>(null);
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [loadingServices, setLoadingServices] = useState(true);

  const [orders, setOrders] = useState<BoostOrderRow[]>([]);
  const [orderStats, setOrderStats] = useState({ total: 0, completed: 0, pending: 0, failed: 0, globalCompleted: 3 });
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [selected, setSelected] = useState<BoostService | null>(null);
  const [link, setLink] = useState("");
  const [quantity, setQuantity] = useState("");
  const [placing, setPlacing] = useState(false);

  const [tanzaniaAvailable, setTanzaniaAvailable] = useState(false);
  const [paystackPublicKey, setPaystackPublicKey] = useState("");
  const [payStage, setPayStage] = useState<PayStage>("closed");
  const [preparedOrder, setPreparedOrder] = useState<{ boostOrderId: string; costKes: number; serviceName: string } | null>(null);
  const [payPhone, setPayPhone] = useState("");
  const [payGateway, setPayGateway] = useState<"mpesa" | "tanzania" | "card" | null>(null);
  const [kenyaProvider, setKenyaProvider] = useState<"mpesa" | "airtel">("mpesa");
  const [payRef, setPayRef] = useState<string | null>(null);
  const [cardEmail, setCardEmail] = useState("");
  const payPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getPaymentsConfig().then(c => {
      const cfg = c as { tanzaniaAvailable?: boolean; paystackPublicKey?: string };
      setTanzaniaAvailable(!!cfg.tanzaniaAvailable);
      setPaystackPublicKey(cfg.paystackPublicKey || "");
    }).catch(() => {});
  }, []);

  const currencySymbol = currencies.find(c => c.code === currency)?.symbol || currency;
  const formatLocal = (amount: number) => `${currencySymbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: amount >= 1000 ? 0 : 2, maximumFractionDigits: amount >= 1000 ? 0 : 2 })}`;

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
  }, [user, navigate]);

  useEffect(() => {
    if (selected || payStage !== "closed") {
      lockScroll();
      return () => unlockScroll();
    }
  }, [selected, payStage]);

  const loadServices = useCallback(async (opts?: { force?: boolean }) => {
    setLoadingServices(true);
    try {
      const cacheKey = `boostServices:${currency}`;
      if (!opts?.force) {
        try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached) as { at: number; services: BoostService[] };
            if (Array.isArray(parsed.services) && parsed.services.length > 0 && Date.now() - parsed.at < 10 * 60 * 1000) {
              setAllServices(parsed.services);
              setLoadingServices(false);
            }
          }
        } catch {}
      } else {
        try { sessionStorage.removeItem(cacheKey); } catch {}
      }
      const res = await getBoostServices({ currency });
      if (Array.isArray(res.services) && res.services.length > 0) {
        setAllServices(res.services);
        try { sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), services: res.services })); } catch {}
      } else if (opts?.force) {
        setAllServices([]);
        showToast("No services returned. Try Pull updates in admin, then refresh again.", "error");
      }
    } catch {
      showToast("Failed to load boosting services", "error");
    } finally {
      setLoadingServices(false);
    }
  }, [currency, showToast]);

  useEffect(() => { loadServices(); }, [loadServices]);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await getBoostOrders();
      if (Array.isArray(res.orders)) setOrders(res.orders);
      if (res.stats) setOrderStats(res.stats);
    } catch {
      showToast("Failed to load orders", "error");
    } finally {
      setLoadingOrders(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (tab === "orders") loadOrders();
  }, [tab, loadOrders]);

  // Which platforms actually have services available right now, in a stable order
  const availablePlatforms = useMemo(() => {
    const present = new Set(allServices.map(s => s.platformId));
    return PLATFORMS.filter(p => present.has(p.id));
  }, [allServices]);

  // Service-type chips available within the selected platform (Followers, Likes, Views...)
  const availableTypes = useMemo(() => {
    if (!platformId) return [];
    const inPlatform = allServices.filter(s => s.platformId === platformId);
    return Array.from(new Set(inPlatform.map(s => s.serviceType)));
  }, [allServices, platformId]);

  const services = useMemo(() => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const filtered = allServices.filter(s => {
      const matchesPlatform = !platformId ? s.platformId !== "other" : s.platformId === platformId;
      const matchesType = !serviceType || s.serviceType === serviceType;
      const haystack = `${s.name} ${s.category}`.toLowerCase();
      const matchesQ = words.length === 0 || words.every(w => haystack.includes(w));
      return matchesPlatform && matchesType && matchesQ;
    });
    return filtered.sort((a, b) => a.pricePer1000 - b.pricePer1000);
  }, [allServices, search, platformId, serviceType]);

  const qtyNum = Number(quantity) || 0;
  const qtyValid = !!selected && qtyNum >= selected.min && qtyNum <= selected.max;
  const qtyError = selected && quantity.trim() !== "" && !qtyValid
    ? `Quantity must be between ${selected.min.toLocaleString()} and ${selected.max.toLocaleString()}`
    : selected && quantity.trim() === ""
      ? `Enter a quantity (min ${selected.min.toLocaleString()})`
      : "";
  const estCostLocal = selected ? (selected.pricePer1000 / 1000) * qtyNum : 0;
  const currentCurrencyDef = currencies.find(c => c.code === currency);
  const estCostKes = currentCurrencyDef && currentCurrencyDef.perKes > 0 ? estCostLocal / currentCurrencyDef.perKes : estCostLocal;
  const estCostTx = Math.max(1, Math.ceil(estCostKes / 5));
  const hasEnoughTx = user ? user.txCoins >= estCostTx : false;
  const selectedPlatformForOrder = selected ? PLATFORMS.find(p => p.id === selected.platformId) : undefined;

  const closeOrderForm = () => { setSelected(null); setLink(""); setQuantity(""); };

  const togglePlatform = (id: string) => {
    setServiceType(null);
    setTypeMenuOpen(false);
    setPlatformId(prev => (prev === id ? null : id));
  };

  const handlePlaceOrder = async () => {
    if (!selected || !link.trim() || qtyNum <= 0) { showToast("Fill in the link and quantity", "error"); return; }
    if (qtyNum < selected.min || qtyNum > selected.max) {
      showToast(`Quantity must be between ${selected.min} and ${selected.max}`, "error");
      return;
    }
    setPlacing(true);
    try {
      const res = await placeBoostOrder({ serviceId: selected.id, link: link.trim(), quantity: qtyNum });
      if (res.error) {
        if (res.code === "INSUFFICIENT_COINS") {
          showToast(`Not enough balance. You need ${tx(res.requiredTx)} for this order.`, "error");
          localStorage.setItem("pendingBoostOrder", JSON.stringify({ serviceId: selected.id, link: link.trim(), quantity: qtyNum }));
          navigateWithLoader(`/topup?required=${res.requiredTx}`);
        } else {
          showToast(res.error, "error");
        }
      } else {
        showToast("Boost order placed!", "success");
        closeOrderForm();
        setTab("orders");
        loadOrders();
      }
    } catch {
      showToast("Failed to place order", "error");
    } finally {
      setPlacing(false);
    }
  };

  const handleRefreshOrder = async (id: string) => {
    try {
      await refreshBoostOrder(id);
      loadOrders();
    } catch {}
  };

  const closePayFlow = () => {
    setPayStage("closed");
    setPreparedOrder(null);
    setPayPhone("");
    setPayGateway(null);
    setPayRef(null);
    setCardEmail("");
    setKenyaProvider("mpesa");
    if (payPollRef.current) clearTimeout(payPollRef.current);
  };

  const handleStartDirectPay = async () => {
    if (!selected || !link.trim() || qtyNum <= 0) { showToast("Fill in the link and quantity", "error"); return; }
    if (qtyNum < selected.min || qtyNum > selected.max) {
      showToast(`Quantity must be between ${selected.min} and ${selected.max}`, "error");
      return;
    }
    setPlacing(true);
    try {
      const res = await prepareBoostOrder({ serviceId: selected.id, link: link.trim(), quantity: qtyNum });
      if (res.error) { showToast(res.error, "error"); return; }
      setPreparedOrder(res);
      closeOrderForm();
      setPayStage("choose");
    } catch {
      showToast("Failed to prepare order", "error");
    } finally {
      setPlacing(false);
    }
  };

  const handlePayMpesa = async () => {
    if (!preparedOrder) return;
    if (!isValidKenyaPhone(payPhone)) { showToast("Enter a valid Kenyan number (e.g. 0712345678)", "error"); return; }
    setPlacing(true);
    try {
      const res = await payBoostMpesa({ boostOrderId: preparedOrder.boostOrderId, phone: normalizeKenyaPhone(payPhone), provider: kenyaProvider });
      if (res.error) { showToast(res.error, "error"); return; }
      setPayGateway("mpesa");
      setPayRef(res.reference);
      setPayStage("pending");
    } catch {
      showToast("Failed to start payment", "error");
    } finally {
      setPlacing(false);
    }
  };

  const handlePayTanzania = async () => {
    if (!preparedOrder) return;
    if (payPhone.replace(/\D/g, "").length < 8) { showToast("Enter a valid Tanzania mobile money number", "error"); return; }
    const tzsDef = currencies.find(c => c.code === "TZS");
    const tzsAmount = tzsDef ? Math.max(1, Math.round(preparedOrder.costKes * tzsDef.perKes)) : preparedOrder.costKes;
    setPlacing(true);
    try {
      const res = await payBoostTanzania({ boostOrderId: preparedOrder.boostOrderId, phone: payPhone.replace(/\D/g, ""), amount: tzsAmount });
      if (res.error) { showToast(res.error, "error"); return; }
      setPayGateway("tanzania");
      setPayRef(res.reference);
      setPayStage("pending");
    } catch {
      showToast("Failed to start payment", "error");
    } finally {
      setPlacing(false);
    }
  };

  const handlePayCard = async (channel: "card" | "apple_pay") => {
    if (!preparedOrder) return;
    if (!cardEmail.trim() || !cardEmail.includes("@")) { showToast("Enter a valid email", "error"); return; }
    if (channel === "apple_pay" && !("ApplePaySession" in window)) {
      showToast("Apple Pay is only available on Apple devices using Safari.", "error");
      return;
    }
    const paystackPop = (window as unknown as { PaystackPop?: new () => {
      resumeTransaction: (accessCode: string, callbacks: Record<string, unknown>) => void;
      newTransaction: (config: Record<string, unknown>) => void;
    } }).PaystackPop;
    if (!paystackPop) { showToast("Payment system not loaded.", "error"); return; }
    setPlacing(true);
    try {
      if (channel === "card") {
        const res = await payBoostCardPrepare({ boostOrderId: preparedOrder.boostOrderId, email: cardEmail.trim() });
        if (res.error || !res.reference) { showToast(res.error || "Payment init failed", "error"); return; }
        setPlacing(false);
        const instance = new paystackPop();
        instance.newTransaction({
          key: paystackPublicKey,
          email: cardEmail.trim(),
          amount: preparedOrder.costKes * 100,
          currency: "KES",
          ref: res.reference,
          channels: ["card"],
          onSuccess: async () => {
            setPayStage("pending");
            const v = await verifyBoostCard(res.reference).catch(() => null);
            if (v?.success) { setPayStage("success"); loadOrders(); } else { setPayStage("failed"); }
          },
          onCancel: () => setPayStage("failed"),
          onError: () => setPayStage("failed"),
        });
      } else {
        const res = await payBoostCardInit({ boostOrderId: preparedOrder.boostOrderId, email: cardEmail.trim() });
        if (res.error || !res.accessCode) { showToast(res.error || "Payment init failed", "error"); return; }
        setPlacing(false);
        const instance = new paystackPop();
        instance.resumeTransaction(res.accessCode, {
          onSuccess: async () => {
            setPayStage("pending");
            const v = await verifyBoostCard(res.reference).catch(() => null);
            if (v?.success) { setPayStage("success"); loadOrders(); } else { setPayStage("failed"); }
          },
          onLoad: () => {},
          onCancel: () => setPayStage("failed"),
          onError: () => setPayStage("failed"),
        });
      }
    } catch {
      showToast("Payment failed", "error");
    } finally {
      setPlacing(false);
    }
  };

  useEffect(() => {
    if (payStage !== "pending" || !payRef || !payGateway) return;
    let attempts = 0;
    let cancelled = false;
    const check = async () => {
      attempts++;
      try {
        const res = payGateway === "mpesa" ? await getBoostMpesaStatus(payRef)
          : await getBoostTanzaniaStatus(payRef);
        if (cancelled) return;
        if (res.status === "awaiting_payment") {
          if (attempts > 27) { setPayStage("failed"); return; }
          payPollRef.current = setTimeout(check, 11000);
          return;
        }
        if (res.status === "failed") { setPayStage("failed"); return; }
        setPayStage("success");
        loadOrders();
      } catch {
        if (attempts > 27) { setPayStage("failed"); return; }
        payPollRef.current = setTimeout(check, 11000);
      }
    };
    payPollRef.current = setTimeout(check, 11000);
    return () => { cancelled = true; if (payPollRef.current) clearTimeout(payPollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payStage, payRef, payGateway]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur-sm z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14 gap-3">
            <button onClick={() => navigateWithLoader("/dashboard")} className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-400" />
              <span className="font-bold text-sm sm:text-base">Social Media Boosting</span>
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <Coins className="w-3.5 h-3.5 text-teal-400" />
              {tx(user.txCoins)}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 w-full">
        <div className="flex gap-2 mb-5 border-b border-border">
          <button
            onClick={() => setTab("browse")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "browse" ? "border-teal-500 text-foreground" : "border-transparent text-muted-foreground"}`}
          >
            Browse Services
          </button>
          <button
            onClick={() => setTab("orders")}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${tab === "orders" ? "border-teal-500 text-foreground" : "border-transparent text-muted-foreground"}`}
          >
            My Orders
          </button>
        </div>

        {tab === "browse" && (
          <>
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search a service or platform..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={loadingServices}
                onClick={() => loadServices({ force: true })}
                title="Refresh services"
              >
                {loadingServices ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => { setPlatformId(null); setServiceType(null); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${!platformId ? "border-teal-500 bg-teal-500/10 text-foreground" : "border-border bg-card text-muted-foreground"}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                All
              </button>
              {loadingServices && availablePlatforms.length === 0 ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-9 w-24 rounded-xl border border-border bg-muted/40 animate-pulse" />
                ))
              ) : (
                availablePlatforms.map(p => (
                  <button
                    key={p.id}
                    onClick={() => togglePlatform(p.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${platformId === p.id ? "text-foreground" : "border-border bg-card text-muted-foreground"}`}
                    style={platformId === p.id ? { borderColor: p.color, backgroundColor: `${p.color}1A` } : undefined}
                  >
                    <span className="w-4 h-4 rounded-sm flex items-center justify-center shrink-0" style={{ backgroundColor: p.color }}>
                      <PlatformLogo platform={p} size={12} />
                    </span>
                    {p.label}
                  </button>
                ))
              )}
            </div>

            {platformId && availableTypes.length > 0 && (
              <div className="relative mb-4">
                <button
                  onClick={() => setTypeMenuOpen(prev => !prev)}
                  className="w-full sm:w-auto flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-border bg-card text-sm font-medium"
                >
                  <span>
                    Showing: <span className="text-teal-400">{serviceType || "All types"}</span>
                    <span className="text-muted-foreground font-normal"> — tap to change</span>
                  </span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${typeMenuOpen ? "rotate-180" : ""}`} />
                </button>
                {typeMenuOpen && (
                  <div className="fixed inset-0 z-[180] flex items-center justify-center p-4" onClick={() => setTypeMenuOpen(false)}>
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
                    <div
                      className="relative z-10 w-full max-w-sm max-h-[70dvh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl p-2"
                      onClick={e => e.stopPropagation()}
                    >
                      <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Service type</p>
                      <button
                        onClick={() => { setServiceType(null); setTypeMenuOpen(false); }}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm hover:bg-muted/60 text-left"
                      >
                        All types
                        {!serviceType && <Check className="w-4 h-4 text-teal-400" />}
                      </button>
                      {availableTypes.map(t => (
                        <button
                          key={t}
                          onClick={() => { setServiceType(t); setTypeMenuOpen(false); }}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm hover:bg-muted/60 text-left"
                        >
                          {t}
                          {serviceType === t && <Check className="w-4 h-4 text-teal-400" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {loadingServices ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
                <p className="text-sm font-medium text-foreground">Please wait...</p>
                <p className="text-xs text-muted-foreground text-center max-w-xs">Loading platforms and services from our catalogue. This is usually instant after the first load.</p>
              </div>
            ) : services.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <p className="text-sm text-muted-foreground text-center">No services found.</p>
                <Button variant="outline" size="sm" className="gap-2" disabled={loadingServices} onClick={() => loadServices({ force: true })}>
                  {loadingServices ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Refresh catalogue
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {services.map(s => {
                  const plat = PLATFORMS.find(p => p.id === s.platformId);
                  const quality = detectQuality(s.name);
                  return (
                    <div key={s.id} className="rounded-xl border border-border bg-card p-4 flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {plat && (
                          <span className="w-4 h-4 rounded-sm flex items-center justify-center shrink-0" style={{ backgroundColor: plat.color }}>
                            <PlatformLogo platform={plat} size={11} />
                          </span>
                        )}
                        <p className="text-xs text-teal-400 font-medium truncate">{s.category}</p>
                      </div>
                      <p className="text-sm font-semibold mb-1 flex-1 break-words">{s.name}</p>
                      {quality && (
                        <div className="mb-2 flex items-start gap-1.5">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0" style={{ backgroundColor: quality.color + "22", color: quality.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: quality.color }} />
                            {quality.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground leading-snug">{quality.meaning}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2 mt-auto">
                        <span className="text-sm font-bold">{formatLocal(s.pricePer1000)} per 1000</span>
                        <Button size="sm" onClick={() => setSelected(s)}>Order</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "orders" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Your total</p>
                <p className="text-xl font-bold">{orderStats.total}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Your completed</p>
                <p className="text-xl font-bold text-green-400">{orderStats.completed}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-xl font-bold text-amber-400">{orderStats.pending}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-xl font-bold text-red-400">{orderStats.failed}</p>
              </div>
              <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-3 col-span-2 sm:col-span-1">
                <p className="text-xs text-muted-foreground">Global completed</p>
                <p className="text-xl font-bold text-teal-400">{orderStats.globalCompleted ?? 3}</p>
              </div>
            </div>

            <button
              onClick={() => navigateWithLoader("/contact")}
              className="w-full mb-4 flex items-center justify-between p-3.5 rounded-xl border border-green-500/20 bg-green-500/5 hover:bg-green-500/10 transition-colors"
            >
              <div className="text-left">
                <p className="text-sm font-semibold">Need help with an order?</p>
                <p className="text-xs text-muted-foreground">Contact support for order issues or anything else</p>
              </div>
              <span className="text-xs text-green-400 font-medium shrink-0">Contact →</span>
            </button>

            {loadingOrders ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : orders.length === 0 ? (
              <p className="text-center text-muted-foreground py-16 text-sm">No orders yet.</p>
            ) : (
              <div className="space-y-2">
                {orders.map(o => (
                  <div key={o._id} className="rounded-xl border border-border bg-card p-3.5 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{o.serviceName}</p>
                        <a href={o.link} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground truncate flex items-center gap-1 hover:underline">
                          <span className="truncate">{o.link}</span> <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                        <p className="text-xs text-muted-foreground mt-1">{o.quantity} qty · {tx(o.costTx)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <StatusBadge status={o.status} />
                        {!["completed", "failed", "refunded"].includes(o.status) && (
                          <button onClick={() => handleRefreshOrder(o._id)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" /> Check
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {selected && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto bg-card border border-border rounded-xl p-5">
            <button
              onClick={closeOrderForm}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 mb-1 pr-8">
              {selectedPlatformForOrder && (
                <span className="w-4 h-4 rounded-sm flex items-center justify-center shrink-0" style={{ backgroundColor: selectedPlatformForOrder.color }}>
                  <PlatformLogo platform={selectedPlatformForOrder} size={11} />
                </span>
              )}
              <p className="text-xs text-teal-400 font-medium">{selected.category}</p>
            </div>
            <h3 className="font-bold text-base mb-4 break-words pr-8">{selected.name}</h3>

            <label className="text-xs text-muted-foreground mb-1 block">{linkLabelFor(selected.serviceType)}</label>
            <Input
              placeholder={exampleLinkFor(selected.platformId, selected.serviceType)}
              value={link}
              onChange={e => setLink(e.target.value)}
              className="mb-1"
            />
            <p className="text-[11px] text-muted-foreground mb-3">
              Example: <span className="font-mono">{exampleLinkFor(selected.platformId, selected.serviceType)}</span>
            </p>

            <label className="text-xs text-muted-foreground mb-1 block">Quantity ({selected.min.toLocaleString()}–{selected.max.toLocaleString()})</label>
            <Input
              type="number"
              min={selected.min}
              max={selected.max}
              placeholder={String(selected.min)}
              value={quantity}
              onChange={e => setQuantity(e.target.value.replace(/[^0-9]/g, ""))}
              className="mb-1"
            />
            {qtyError ? (
              <p className="text-[11px] text-red-400 mb-3 font-medium">{qtyError}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground mb-3">Minimum {selected.min.toLocaleString()} · Maximum {selected.max.toLocaleString()}</p>
            )}

            <div className="flex items-center justify-between mb-2 p-3 rounded-lg bg-muted/40">
              <span className="text-xs text-muted-foreground">Estimated cost</span>
              <span className="text-sm font-bold">{qtyValid ? formatLocal(estCostLocal) : "—"}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-4">Wrong link = no refund. Double-check it before paying.</p>

            {isModerator ? (
              <Button className="w-full gap-2 bg-gradient-to-r from-teal-600 to-orange-600 hover:from-teal-700 hover:to-orange-700 text-white border-0" disabled={placing || !qtyValid || !link.trim()} onClick={handlePlaceOrder}>
                {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {hasEnoughTx ? "Continue and pay from balance" : "Continue to payment"}
              </Button>
            ) : (
              <Button className="w-full gap-2 bg-gradient-to-r from-teal-600 to-orange-600 hover:from-teal-700 hover:to-orange-700 text-white border-0" disabled={placing || !qtyValid || !link.trim()} onClick={handleStartDirectPay}>
                {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Continue to payment
              </Button>
            )}
          </div>
        </div>
      )}

      {payStage !== "closed" && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto bg-card border border-border rounded-xl p-5">
            <button
              onClick={closePayFlow}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {payStage === "choose" && preparedOrder && (
              <>
                <h3 className="font-bold text-base mb-1 pr-8">Choose payment method</h3>
                <p className="text-xs text-muted-foreground mb-2 break-words">{preparedOrder.serviceName}</p>
                <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20 mb-3">
                  <p className="text-[11px] text-teal-300 font-medium leading-relaxed">
                    Payments are processed automatically. Once confirmed, your boost order starts right away — no manual approval needed.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 mb-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Amount due</span>
                  <span className="text-sm font-bold">KES {preparedOrder.costKes.toLocaleString()}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Select your country / method</p>
                <div className="space-y-2">
                  <button
                    onClick={() => { setKenyaProvider("mpesa"); setPayStage("mpesa"); }}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:border-teal-500/50 hover:bg-teal-500/5 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <img src={LOGO_MPESA} alt="" className="w-7 h-7 rounded object-contain bg-white/90 p-0.5 shrink-0" />
                      <img src={LOGO_AIRTEL} alt="" className="w-7 h-7 rounded object-contain bg-white/90 p-0.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-medium text-sm block">🇰🇪 Kenya — M-Pesa or Airtel</span>
                        <span className="text-[11px] text-muted-foreground">Choose network on next step</span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">KES</span>
                  </button>
                  {tanzaniaAvailable && (
                    <button
                      onClick={() => setPayStage("tanzania")}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors text-left"
                    >
                      <div>
                        <span className="font-medium text-sm block">🇹🇿 Tanzania — Mobile Money</span>
                        <span className="text-[11px] text-muted-foreground">M-Pesa / Tigo / Airtel</span>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">TZS</span>
                    </button>
                  )}
                  {!!paystackPublicKey && (
                    <button
                      onClick={() => setPayStage("card")}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border hover:border-teal-500/50 hover:bg-teal-500/5 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img src={LOGO_CARD} alt="" className="w-7 h-7 rounded object-contain bg-white/90 p-0.5 shrink-0" />
                        <img src={LOGO_APPLEPAY} alt="" className="w-7 h-7 rounded object-contain bg-white/90 p-0.5 shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium text-sm block">Card / Apple Pay</span>
                          <span className="text-[11px] text-muted-foreground">Visa, Mastercard, Apple Pay — worldwide</span>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-2">Global</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-4">Wrong link = no refund. Double-check the link before paying.</p>
              </>
            )}

            {payStage === "mpesa" && preparedOrder && (
              <>
                <h3 className="font-bold text-base mb-1 pr-8">Kenya mobile money</h3>
                <p className="text-xs text-muted-foreground mb-4">Pick your network, then enter the phone that will receive the payment prompt.</p>
                <p className="text-[11px] text-muted-foreground mb-2 font-medium uppercase tracking-wide">Network</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setKenyaProvider("mpesa")}
                    className={`flex items-center gap-2 px-3 py-3 rounded-xl border transition-colors text-left ${kenyaProvider === "mpesa" ? "border-teal-500 bg-teal-500/10" : "border-border hover:bg-muted/40"}`}
                  >
                    <img src={LOGO_MPESA} alt="M-Pesa" className="w-8 h-8 rounded object-contain bg-white p-0.5" />
                    <span className="text-sm font-semibold">M-Pesa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setKenyaProvider("airtel")}
                    className={`flex items-center gap-2 px-3 py-3 rounded-xl border transition-colors text-left ${kenyaProvider === "airtel" ? "border-red-500 bg-red-500/10" : "border-border hover:bg-muted/40"}`}
                  >
                    <img src={LOGO_AIRTEL} alt="Airtel" className="w-8 h-8 rounded object-contain bg-white p-0.5" />
                    <span className="text-sm font-semibold">Airtel</span>
                  </button>
                </div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  {kenyaProvider === "airtel" ? "Airtel Money number" : "M-Pesa number"}
                </label>
                <Input
                  placeholder="0712345678 or +254712345678"
                  value={payPhone}
                  onChange={e => setPayPhone(e.target.value.replace(/[^\d+\s-]/g, "").slice(0, 20))}
                  className="mb-4"
                />
                <Button className="w-full gap-2 bg-gradient-to-r from-teal-600 to-orange-600 hover:from-teal-700 hover:to-orange-700 text-white border-0" disabled={placing || !payPhone} onClick={handlePayMpesa}>
                  {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Pay KES {preparedOrder.costKes.toLocaleString()} via {kenyaProvider === "airtel" ? "Airtel" : "M-Pesa"}
                </Button>
                <button type="button" onClick={() => setPayStage("choose")} className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground py-2">
                  ← Back to payment methods
                </button>
              </>
            )}

            {payStage === "tanzania" && preparedOrder && (
              <>
                <h3 className="font-bold text-base mb-4 pr-8">Pay with Tanzania Mobile Money</h3>
                <label className="text-xs text-muted-foreground mb-1 block">Mobile money number</label>
                <Input
                  placeholder="07XXXXXXXX"
                  value={payPhone}
                  onChange={e => setPayPhone(e.target.value.replace(/[^\d+\s-]/g, "").slice(0, 20))}
                  className="mb-4"
                />
                <Button className="w-full gap-2 bg-gradient-to-r from-teal-600 to-orange-600 hover:from-teal-700 hover:to-orange-700 text-white border-0" disabled={placing || !payPhone} onClick={handlePayTanzania}>
                  {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Continue
                </Button>
              </>
            )}

            {payStage === "card" && preparedOrder && (
              <>
                <h3 className="font-bold text-base mb-1 pr-8">Card / Apple Pay</h3>
                <p className="text-xs text-muted-foreground mb-4">Works worldwide. Choose card or Apple Pay after entering your email.</p>
                <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={cardEmail}
                  onChange={e => setCardEmail(e.target.value)}
                  className="mb-4"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="gap-2 h-auto py-3 flex-col" disabled={placing || !cardEmail} onClick={() => handlePayCard("card")}>
                    {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : <img src={LOGO_CARD} alt="" className="w-8 h-8 rounded object-contain bg-white p-0.5" />}
                    <span className="text-xs font-semibold">Card</span>
                  </Button>
                  <Button variant="outline" className="gap-2 h-auto py-3 flex-col" disabled={placing || !cardEmail} onClick={() => handlePayCard("apple_pay")}>
                    {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : <img src={LOGO_APPLEPAY} alt="" className="w-8 h-8 rounded object-contain bg-white p-0.5" />}
                    <span className="text-xs font-semibold">Apple Pay</span>
                  </Button>
                </div>
                <button type="button" onClick={() => setPayStage("choose")} className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground py-2">
                  ← Back to payment methods
                </button>
              </>
            )}

            {payStage === "pending" && (
              <div className="text-center space-y-4 py-4">
                <Loader2 className="w-10 h-10 animate-spin text-teal-400 mx-auto" />
                <p className="font-semibold">Waiting for payment...</p>
                <p className="text-sm text-muted-foreground">Approve the prompt sent to your phone. This will update automatically once confirmed.</p>
              </div>
            )}

            {payStage === "success" && (
              <div className="text-center space-y-3 py-4">
                <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7 text-green-400" />
                </div>
                <p className="font-bold text-green-400">Payment successful!</p>
                <p className="text-sm text-muted-foreground">Your order has been placed.</p>
                <button
                  onClick={() => { closePayFlow(); setTab("orders"); }}
                  className="mt-2 px-6 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
                >
                  View orders
                </button>
              </div>
            )}

            {payStage === "failed" && (
              <div className="text-center space-y-3 py-4">
                <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
                  <XCircle className="w-7 h-7 text-red-400" />
                </div>
                <p className="font-bold text-red-400">Payment failed</p>
                <p className="text-sm text-muted-foreground">Your payment wasn't completed. No order was placed, and no charge should apply.</p>
                <button
                  onClick={closePayFlow}
                  className="mt-2 px-6 py-2 rounded-xl bg-muted hover:bg-muted/80 text-sm font-medium border border-border transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
