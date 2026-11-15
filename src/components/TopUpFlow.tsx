import { useState, useEffect, useRef, type ReactElement } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import { useToast } from "@/hooks/useToast";
import { Modal } from "@/components/Modal";
import { getPackages, getMobileChargeStatus, initiatePayment, verifyPayment, initiatePaymentNg, getPaymentsConfig } from "@/lib/api";
import { ArrowLeft, Coins, Loader2, Check, Minus, Plus, Copy, CheckCheck, Wallet } from "lucide-react";

interface Package {
  _id: string;
  name: string;
  txAmount: number;
  bonusTx: number;
  ksPrice: number;
  isBestDeal: boolean;
  order: number;
  active: boolean;
}

interface NigeriaPackage {
  id: string;
  name: string;
  txAmount: number;
  bonusTx: number;
  ngnPrice: number;
  isBestDeal: boolean;
}

interface TanzaniaPackage {
  id: string;
  name: string;
  txAmount: number;
  bonusTx: number;
  tzsPrice: number;
  isBestDeal: boolean;
}

const TANZANIA_PACKAGES: TanzaniaPackage[] = [
  { id: "tz_starter", name: "Starter", txAmount: 10, bonusTx: 0, tzsPrice: 1500, isBestDeal: false },
  { id: "tz_basic", name: "Basic", txAmount: 20, bonusTx: 0, tzsPrice: 3000, isBestDeal: false },
  { id: "tz_standard", name: "Standard", txAmount: 30, bonusTx: 0, tzsPrice: 4500, isBestDeal: false },
  { id: "tz_pro", name: "Pro", txAmount: 50, bonusTx: 5, tzsPrice: 7500, isBestDeal: true },
  { id: "tz_elite", name: "Elite", txAmount: 100, bonusTx: 10, tzsPrice: 15000, isBestDeal: false },
  { id: "tz_ultimate", name: "Ultimate", txAmount: 200, bonusTx: 20, tzsPrice: 30000, isBestDeal: false },
];

const USD_PER_TX = 0.2;

const NIGERIA_PACKAGES: NigeriaPackage[] = [
  { id: "ng_starter", name: "Starter", txAmount: 10, bonusTx: 0, ngnPrice: 1000, isBestDeal: false },
  { id: "ng_basic", name: "Basic", txAmount: 20, bonusTx: 0, ngnPrice: 2000, isBestDeal: false },
  { id: "ng_standard", name: "Standard", txAmount: 30, bonusTx: 0, ngnPrice: 3000, isBestDeal: false },
  { id: "ng_pro", name: "Pro", txAmount: 50, bonusTx: 5, ngnPrice: 5000, isBestDeal: true },
  { id: "ng_elite", name: "Elite", txAmount: 100, bonusTx: 10, ngnPrice: 10000, isBestDeal: false },
  { id: "ng_ultimate", name: "Ultimate", txAmount: 200, bonusTx: 20, ngnPrice: 20000, isBestDeal: false },
];

type Stage = "select" | "pending" | "success" | "failed";
type PayMethod = "mpesa" | "airtel" | "card" | "apple_pay";

function normalizeTanzaniaPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("255") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return "255" + digits.slice(1);
  if (digits.length === 9) return "255" + digits;
  return digits;
}
function isValidTanzaniaPhone(value: string): boolean {
  return /^255[67]\d{8}$/.test(normalizeTanzaniaPhone(value));
}

function TanzaniaPaymentModal({
  isOpen, onClose, pkg, onSuccess
}: {
  isOpen: boolean;
  onClose: () => void;
  pkg: TanzaniaPackage | null;
  onSuccess: () => void;
}) {
  const { showToast } = useToast();
  const [stage, setStage] = useState<"select" | "pending" | "success" | "failed">("select");
  const [reference, setReference] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [phone, setPhone] = useState("");
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStage("select");
      setReference(null);
      setPhone("");
      if (pollRef.current) clearTimeout(pollRef.current);
    }
  }, [isOpen]);

  useEffect(() => {
    if (stage === "pending" && reference) {
      let attempts = 0;
      const poll = async () => {
        attempts++;
        const res = await fetch(`/api/payments/tanzania-status/${encodeURIComponent(reference)}`, { credentials: "include" });
        const data = await res.json() as { status?: string; txAmount?: number };
        if (data.status === "success") {
          setStage("success");
          onSuccess();
          return;
        }
        if (data.status === "failed" || attempts > 27) {
          setStage("failed");
          return;
        }
        pollRef.current = setTimeout(poll, 11000);
      };
      pollRef.current = setTimeout(poll, 11000);
    }
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [stage, reference, onSuccess]);

  const handlePay = async () => {
    if (!pkg) return;
    if (!isValidTanzaniaPhone(phone)) {
      showToast("Enter a valid Tanzania mobile number (e.g. 0712345678)", "error");
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch("/api/payments/initiate-tanzania", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tzsAmount: pkg.tzsPrice, txAmount: pkg.txAmount, bonusTx: pkg.bonusTx, phone: normalizeTanzaniaPhone(phone) })
      });
      const data = await res.json() as { reference?: string; error?: string };
      if (data.error) { showToast(data.error, "error"); return; }
      if (data.reference) {
        setReference(data.reference);
        setStage("pending");
      }
    } catch {
      showToast("Failed to initiate payment", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !pkg) return null;
  const total = pkg.txAmount + pkg.bonusTx;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tanzania Mobile Payment">
      <div className="space-y-4">
        {stage === "select" && (
          <>
            <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5">
              <p className="text-sm font-medium text-sky-300 mb-1">{pkg.name}</p>
              <p className="text-2xl font-bold text-sky-400">{total} TX</p>
              <p className="text-sm text-muted-foreground">TZS {pkg.tzsPrice.toLocaleString()}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tanzania mobile number (Tigo, Airtel, Vodacom)</label>
              <input
                type="tel"
                inputMode="tel"
                placeholder="0712345678 or +255712345678"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/[^\d+\s-]/g, "").slice(0, 20))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-sky-500/60"
              />
              <p className="text-[11px] text-muted-foreground">With or without the +255 country code, both work.</p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-muted/30 text-xs text-muted-foreground">
              A payment prompt will be sent directly to your Tanzania mobile number. Supports Tigo Pesa, Airtel Money, and Vodacom M-Pesa (TZ).
            </div>
            <button
              onClick={handlePay}
              disabled={isProcessing || !phone}
              className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Pay TZS {pkg.tzsPrice.toLocaleString()}
            </button>
          </>
        )}
        {stage === "pending" && (
          <div className="text-center space-y-4 py-4">
            <Loader2 className="w-10 h-10 animate-spin text-sky-400 mx-auto" />
            <p className="font-semibold">Waiting for payment...</p>
            <p className="text-sm text-muted-foreground">Approve the payment prompt sent to your phone. This page will update automatically once confirmed.</p>
          </div>
        )}
        {stage === "success" && (
          <div className="text-center space-y-3 py-4">
            <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto">
              <Check className="w-7 h-7 text-green-400" />
            </div>
            <p className="font-bold text-green-400">Payment successful!</p>
            <p className="text-sm text-muted-foreground">{total} TX has been added to your account.</p>
            <button onClick={onClose} className="mt-2 px-6 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors">Done</button>
          </div>
        )}
        {stage === "failed" && (
          <div className="text-center space-y-3 py-4">
            <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto">
              <Minus className="w-7 h-7 text-red-400" />
            </div>
            <p className="font-bold text-red-400">Payment failed</p>
            <p className="text-sm text-muted-foreground">Your payment was not completed. Please try again.</p>
            <button onClick={() => setStage("select")} className="mt-2 px-6 py-2 rounded-xl bg-muted hover:bg-muted/80 text-sm font-medium border border-border transition-colors">Try Again</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

const LOGO_MPESA = "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/mpesa.jpg";
const LOGO_AIRTEL = "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/airtel.jpg";
const LOGO_CARD = "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/creditcard.jpg";
const LOGO_APPLEPAY = "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/applepay.jpg";

function PayLogo({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      className={"rounded object-contain " + className}
      style={{ width: 44, height: 30 }}
      onError={e => { (e.target as HTMLImageElement).style.opacity = "0.4"; }}
    />
  );
}
function MpesaLogo() { return <PayLogo src={LOGO_MPESA} alt="M-Pesa" />; }
function AirtelLogo() { return <PayLogo src={LOGO_AIRTEL} alt="Airtel" />; }
function CardLogo() { return <PayLogo src={LOGO_CARD} alt="Card" />; }
function ApplePayLogo() { return <PayLogo src={LOGO_APPLEPAY} alt="Apple Pay" />; }

function isValidKenyanPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return true;
  if (digits.startsWith("0") && digits.length === 10) return true;
  if (digits.length === 9) return true;
  return false;
}
function toPaystackPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return "+" + digits;
  if (digits.startsWith("0") && digits.length === 10) return "+254" + digits.slice(1);
  if (digits.length === 9) return "+254" + digits;
  return "+" + digits;
}

function NigeriaPaymentModal({
  isOpen, onClose, pkg, userEmail, onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  pkg: NigeriaPackage | null;
  userEmail: string;
  onSuccess: () => void;
}) {
  const [stage, setStage] = useState<Stage>("select");
  const [cardEmail, setCardEmail] = useState(userEmail || "");
  const [loading, setLoading] = useState(false);
  const [failReason, setFailReason] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    if (!isOpen) { setStage("select"); setLoading(false); setFailReason(""); }
  }, [isOpen]);

  useEffect(() => {
    setCardEmail(userEmail || "");
  }, [userEmail]);

  if (!pkg) return null;
  const totalTx = pkg.txAmount + pkg.bonusTx;

  const handlePay = async () => {
    if (!cardEmail.trim() || !cardEmail.includes("@")) { showToast("Enter a valid email", "error"); return; }
    setLoading(true);
    try {
      const paystackPop = (window as unknown as { PaystackPop?: new () => {
        resumeTransaction: (accessCode: string, callbacks: Record<string, unknown>) => void;
        newTransaction: (config: Record<string, unknown>) => void;
      } }).PaystackPop;
      if (!paystackPop) { showToast("Payment system not loaded. Refresh and try again.", "error"); setLoading(false); return; }

      const initData = await initiatePaymentNg({
        ngnAmount: pkg.ngnPrice,
        txAmount: pkg.txAmount,
        bonusTx: pkg.bonusTx,
        packageName: pkg.name,
      }) as { accessCode?: string; reference?: string; error?: string };

      if (initData.error) { showToast(initData.error, "error"); setLoading(false); return; }
      if (!initData.accessCode || !initData.reference) { showToast("Payment init failed", "error"); setLoading(false); return; }

      const ref = initData.reference;
      setLoading(false);
      const instance = new paystackPop();
      instance.resumeTransaction(initData.accessCode, {
        onSuccess: async () => {
          try { await verifyPayment(ref); } catch {}
          setStage("success");
          showToast(`Payment confirmed! ${totalTx} TX added.`, "success");
          onSuccess();
        },
        onLoad: () => {},
        onCancel: () => { setStage("failed"); setFailReason("Payment was cancelled."); },
        onError: () => { setStage("failed"); setFailReason("Payment encountered an error. Please try again."); }
      });
    } catch { showToast("Payment failed", "error"); setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nigeria Payment" maxWidth="max-w-lg">
      {stage === "success" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg text-green-400">Payment Confirmed!</p>
            <p className="text-sm text-muted-foreground mt-1">{totalTx} TX has been added to your account.</p>
          </div>
          <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Done</button>
        </div>
      ) : stage === "failed" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg text-red-400">Payment Failed</p>
            <p className="text-sm text-muted-foreground mt-1">{failReason}</p>
          </div>
          <div className="flex gap-2 w-full">
            <button onClick={() => { setStage("select"); setFailReason(""); }} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Try Again</button>
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Close</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">{pkg.name}</span>
              <span className="font-bold text-green-400">{totalTx} TX</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              🇳🇬 NGN {pkg.ngnPrice.toLocaleString()}
              {pkg.bonusTx > 0 && <span className="ml-1.5 text-green-400">+{pkg.bonusTx} bonus</span>}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Email</label>
            <input type="email" placeholder="your@email.com" value={cardEmail} onChange={e => setCardEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500" />
            <p className="text-xs text-muted-foreground mt-1">Paystack will open and show available payment options for Nigeria (card, bank transfer, USSD).</p>
          </div>
          <button onClick={handlePay} disabled={loading}
            className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Loading..." : `Pay NGN ${pkg.ngnPrice.toLocaleString()}`}
          </button>
        </div>
      )}
    </Modal>
  );
}

function PaymentModal({
  isOpen, onClose, pkg, userEmail, onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  pkg: Package | null;
  userEmail: string;
  onSuccess: () => void;
}) {
  const [method, setMethod] = useState<PayMethod>("mpesa");
  const { currency, format } = useCurrency();
  const [phone, setPhone] = useState("");
  const [cardEmail, setCardEmail] = useState(userEmail || "");
  const [stage, setStage] = useState<Stage>("select");
  const [message, setMessage] = useState("");
  const [failReason, setFailReason] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const { showToast } = useToast();

  const handleClose = () => {
    if (stage === "pending") {
      showToast("Payment cancelled. If you were charged, please contact support.", "error");
    }
    onClose();
  };

  useEffect(() => {
    if (!isOpen) {
      setStage("select");
      setPhone("");
      setReference("");
      setMessage("");
      setFailReason("");
      setLoading(false);
      setPollCount(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (stage !== "pending" || !reference) return;
    let count = 0;
    const interval = setInterval(async () => {
      count += 1;
      setPollCount(count);
      if (count >= 40) {
        clearInterval(interval);
        setStage("failed");
        setFailReason("Payment timed out — you did not complete the payment in time.");
        return;
      }
      try {
        const data = await getMobileChargeStatus(reference) as { status?: string; txAmount?: number; error?: string };
        if (data.error) return;
        if (data.status === "success") { clearInterval(interval); setStage("success"); showToast(`Payment confirmed! ${data.txAmount ?? 0} TX added.`, "success"); onSuccess(); return; }
        if (data.status === "failed") { clearInterval(interval); setStage("failed"); setFailReason("Payment failed. Please try again."); return; }
        if (data.status === "abandoned") { clearInterval(interval); setStage("failed"); setFailReason("Payment was abandoned."); return; }
        if (data.status === "cancelled") { clearInterval(interval); setStage("failed"); setFailReason("Payment was cancelled."); return; }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [stage, reference, onSuccess, showToast]);

  const handleMobileCharge = async () => {
    if (!pkg) return;
    if (!phone.trim() || !isValidKenyanPhone(phone)) { showToast("Enter a valid phone (e.g. 0712345678)", "error"); return; }
    setLoading(true);
    try {
      const normalized = toPaystackPhone(phone);
      const provider = method === "airtel" ? "airtel" : "mpesa";
      const res = await fetch("/api/payments/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
        body: JSON.stringify({ packageId: pkg._id, phone: normalized, provider })
      });
      const data = await res.json() as { error?: string; reference?: string; message?: string };
      if (data.error) { showToast(data.error, "error"); setLoading(false); return; }
      setReference(data.reference || "");
      setMessage(data.message || "Check your phone for the payment prompt.");
      setPollCount(0);
      setStage("pending");
    } catch { showToast("Failed to initiate payment", "error"); }
    setLoading(false);
  };

  const handlePopupPay = async (channels: string[]) => {
    if (!pkg) return;
    if (channels.includes("apple_pay") && !("ApplePaySession" in window)) { showToast("Apple Pay is only available on Apple devices using Safari.", "error"); return; }
    if (!cardEmail.trim() || !cardEmail.includes("@")) { showToast("Enter a valid email", "error"); return; }
    setLoading(true);
    try {
      const paystackPop = (window as unknown as { PaystackPop?: new () => {
        resumeTransaction: (accessCode: string, callbacks: Record<string, unknown>) => void;
        newTransaction: (config: Record<string, unknown>) => void;
      } }).PaystackPop;
      if (!paystackPop) { showToast("Payment system not loaded. Refresh and try again.", "error"); setLoading(false); return; }
      if (channels.includes("card")) {
        const [cardData, configData] = await Promise.all([
          fetch("/api/payments/prepare-card", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
            body: JSON.stringify({ packageId: pkg._id })
          }).then(r => r.json()),
          fetch("/api/payments/config").then(r => r.json())
        ]);
        const ref = (cardData as { reference?: string }).reference;
        const publicKey = (configData as { paystackPublicKey?: string }).paystackPublicKey || "";
        if (!ref) { showToast("Payment init failed", "error"); setLoading(false); return; }
        setLoading(false);
        const instance = new paystackPop();
        instance.newTransaction({
          key: publicKey,
          email: cardEmail,
          amount: pkg.ksPrice * 100,
          currency: "KES",
          ref,
          channels: ["card"],
          onSuccess: async () => { try { await verifyPayment(ref); } catch {} setStage("success"); showToast(`Payment confirmed! ${totalTx} TX added.`, "success"); onSuccess(); },
          onCancel: () => { setStage("failed"); setFailReason("Card payment was cancelled."); },
          onError: () => { setStage("failed"); setFailReason("Card payment encountered an error. Please try again."); }
        });
      } else {
        const initData = await initiatePayment(pkg._id);
        const accessCode = (initData as { accessCode?: string }).accessCode;
        const ref = (initData as { reference?: string }).reference;
        if (!accessCode || !ref) { showToast("Payment init failed", "error"); setLoading(false); return; }
        setLoading(false);
        const instance = new paystackPop();
        instance.resumeTransaction(accessCode, {
          onSuccess: async () => { try { await verifyPayment(ref); } catch {} setStage("success"); showToast(`Payment confirmed! ${totalTx} TX added.`, "success"); onSuccess(); },
          onLoad: () => {},
          onCancel: () => { setStage("failed"); setFailReason("Apple Pay payment was cancelled."); },
          onError: () => { setStage("failed"); setFailReason("Apple Pay encountered an error. Please try again."); }
        });
      }
    } catch { showToast("Payment failed", "error"); setLoading(false); }
  };

  if (!pkg) return null;
  const totalTx = pkg.txAmount + pkg.bonusTx;

  const methodOptions: { key: PayMethod; label: string; Logo: () => ReactElement }[] = [
    { key: "mpesa", label: "M-Pesa", Logo: MpesaLogo },
    { key: "airtel", label: "Airtel", Logo: AirtelLogo },
    { key: "card", label: "Card", Logo: CardLogo },
    { key: "apple_pay", label: "Apple Pay", Logo: ApplePayLogo },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Complete Payment" maxWidth="max-w-lg">
      {stage === "success" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg text-green-400">Payment Confirmed!</p>
            <p className="text-sm text-muted-foreground mt-1">{totalTx} TX has been added to your account.</p>
          </div>
          <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Done</button>
        </div>
      ) : stage === "failed" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg text-red-400">Payment Failed</p>
            <p className="text-sm text-muted-foreground mt-1">{failReason}</p>
          </div>
          <div className="flex gap-2 w-full">
            <button onClick={() => { setStage("select"); setFailReason(""); setReference(""); }} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Try Again</button>
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Close</button>
          </div>
        </div>
      ) : stage === "pending" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <Loader2 className="w-10 h-10 animate-spin text-teal-400" />
          <div className="text-center">
            <p className="font-semibold">Waiting for payment...</p>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div className="bg-teal-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, (pollCount / 40) * 100)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">This may take up to 2 minutes.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">{pkg.name}</span>
              <span className="font-bold text-teal-400">{totalTx} TX</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">KES {pkg.ksPrice}{currency !== "KES" && <span className="text-muted-foreground/60"> ≈ {format(pkg.ksPrice)}</span>}</p>
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            {methodOptions.map(({ key, label, Logo }) => (
              <button key={key} onClick={() => setMethod(key)}
                className={`flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl border-2 transition-all ${method === key ? "border-teal-500 bg-teal-500/10 shadow-sm shadow-teal-500/20" : "border-border hover:border-teal-500/40 hover:bg-muted/50"}`}
                title={label}
              >
                <Logo />
                <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
              </button>
            ))}
          </div>

          {(method === "mpesa" || method === "airtel") ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1.5">Phone Number</label>
                <input type="tel" placeholder="0712345678" value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500" />
              </div>
              <button onClick={handleMobileCharge} disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Initiating..." : `Pay KES ${pkg.ksPrice}`}
              </button>
            </div>
          ) : method === "card" ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1.5">Email</label>
                <input type="email" placeholder="your@email.com" value={cardEmail} onChange={e => setCardEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500" />
              </div>
              <button onClick={() => handlePopupPay(["card"])} disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Loading..." : `Pay with Card — KES ${pkg.ksPrice}`}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1.5">Email</label>
                <input type="email" placeholder="your@email.com" value={cardEmail} onChange={e => setCardEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500" />
              </div>
              <button onClick={() => handlePopupPay(["apple_pay"])} disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Loading..." : "Pay with Apple Pay"}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function CopyButton({ value, className = "" }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy"}
      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-all duration-200 ${
        copied
          ? "border-green-500/60 bg-green-500/15 text-green-400 scale-95"
          : "border-border bg-muted/50 text-muted-foreground hover:border-border/80 hover:bg-muted hover:text-foreground active:scale-95"
      } ${className}`}
    >
      {copied
        ? <CheckCheck className="w-3.5 h-3.5" />
        : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

const LOGO_MANUAL_MPESA = "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/mpesa.jpg";
const LOGO_MANUAL_BINANCE = "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/binance.jpg";
const LOGO_MANUAL_BYBIT = "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/bybit.jpg";
const LOGO_MANUAL_BITGET = "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/bitget.jpg";
const LOGO_MANUAL_PAYPAL = "https://raw.githubusercontent.com/xhclintohn/Music-Clips-Collection/refs/heads/main/images/paypal.jpg";

const MANUAL_METHODS = [
  {
    key: "mpesa",
    label: "M-Pesa",
    logo: LOGO_MANUAL_MPESA,
    color: "green",
    fieldLabel: "Number",
    value: (import.meta.env.VITE_MANUAL_MPESA_NUMBER as string) || "",
    holder: (import.meta.env.VITE_MANUAL_HOLDER as string) || "Bmb Tech",
    note: "Send to this number then send us your receipt.",
  },
  {
    key: "binance",
    label: "Binance",
    logo: LOGO_MANUAL_BINANCE,
    color: "yellow",
    fieldLabel: "UID",
    value: (import.meta.env.VITE_MANUAL_BINANCE_UID as string) || "",
    holder: (import.meta.env.VITE_MANUAL_HOLDER as string) || "Bmb Tech",
    note: "Pay via Binance Pay to this UID.",
  },
  {
    key: "bybit",
    label: "Bybit",
    logo: LOGO_MANUAL_BYBIT,
    color: "orange",
    fieldLabel: "UID",
    value: (import.meta.env.VITE_MANUAL_BYBIT_UID as string) || "",
    holder: (import.meta.env.VITE_MANUAL_HOLDER as string) || "Bmb Tech",
    note: "Send via Bybit P2P or transfer to this UID.",
  },
  {
    key: "bitget",
    label: "Bitget",
    logo: LOGO_MANUAL_BITGET,
    color: "blue",
    fieldLabel: "UID",
    value: (import.meta.env.VITE_MANUAL_BITGET_UID as string) || "",
    holder: (import.meta.env.VITE_MANUAL_HOLDER as string) || "Bmb Tech",
    note: "Transfer via Bitget to this UID.",
  },
] as const;

const COLOR_MAP: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  green:  { border: "border-green-500/25",  bg: "bg-green-500/5",  text: "text-green-400",  badge: "bg-green-500/15 text-green-400" },
  yellow: { border: "border-yellow-500/25", bg: "bg-yellow-500/5", text: "text-yellow-400", badge: "bg-yellow-500/15 text-yellow-400" },
  orange: { border: "border-orange-500/25", bg: "bg-orange-500/5", text: "text-orange-400", badge: "bg-orange-500/15 text-orange-400" },
  blue:   { border: "border-blue-500/25",   bg: "bg-blue-500/5",   text: "text-blue-400",   badge: "bg-blue-500/15 text-blue-400" },
};

function PayPalProofModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [paypalTxId, setPaypalTxId] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isOpen) { setEmail(""); setTxAmount(""); setPaypalTxId(""); setDone(false); }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!email.trim() || !txAmount.trim() || !paypalTxId.trim()) {
      showToast("Please fill in all fields", "error");
      return;
    }
    const amount = parseInt(txAmount, 10);
    if (isNaN(amount) || amount < 1) { showToast("Enter a valid TX amount", "error"); return; }
    setSending(true);
    try {
      const res = await fetch("/api/payments/notify-paypal-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ senderEmail: email.trim(), txAmount: amount, paypalTransactionId: paypalTxId.trim() }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.ok) { setDone(true); } else { showToast(data.error || "Failed to send", "error"); }
    } catch { showToast("Failed to send proof", "error"); }
    finally { setSending(false); }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Submit PayPal Payment Proof">
      <div className="space-y-4">
        {done ? (
          <div className="text-center space-y-3 py-4">
            <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mx-auto">
              <Check className="w-7 h-7 text-green-400" />
            </div>
            <p className="font-bold text-green-400">Proof submitted!</p>
            <p className="text-sm text-muted-foreground">We've received your details. Your TX will be credited after we verify the payment. This usually takes a few minutes.</p>
            <button onClick={onClose} className="mt-2 px-6 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors">Done</button>
          </div>
        ) : (
          <>
            <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 text-xs text-blue-300 leading-relaxed">
              Pay <span className="font-bold">rtxclinton@gmail.com</span> on PayPal, then fill in the details below. We'll verify and credit your TX coins.
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Your account email (on Bmb Tech Hosting)</label>
              <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-blue-500/60" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">TX amount you expect to receive</label>
              <input type="number" inputMode="numeric" min="1" placeholder="e.g. 50" value={txAmount} onChange={e => setTxAmount(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-blue-500/60" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">PayPal Transaction ID / Reference</label>
              <input type="text" placeholder="e.g. 1AB23456CD789012E" value={paypalTxId} onChange={e => setPaypalTxId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm outline-none focus:border-blue-500/60" />
              <p className="text-[11px] text-muted-foreground">Found in your PayPal receipt email or transaction history.</p>
            </div>
            <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-xs text-amber-300">
              📸 Also send your payment screenshot via the <span className="font-semibold">Contact & Support</span> page so we can verify faster.
            </div>
            <button onClick={handleSubmit} disabled={sending}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Submit Proof
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

function ManualPaySection() {
  const [paypalProofOpen, setPaypalProofOpen] = useState(false);
  return (
    <div className="mt-10 pt-8 border-t border-border/50">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-7 h-7 rounded-lg bg-muted/80 border border-border flex items-center justify-center">
          <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <h2 className="font-bold text-base">Manual Payment</h2>
        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Fallback</span>
      </div>
      <p className="text-sm text-muted-foreground mb-5 ml-9.5">
        If automatic payment isn't working, send manually using any method below then send us your receipt to get your TX credited.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MANUAL_METHODS.filter(m => !!m.value).map(m => {
          const c = COLOR_MAP[m.color];
          return (
            <div
              key={m.key}
              className={`rounded-xl border p-4 ${c.border} ${c.bg} flex flex-col gap-3`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={m.logo} alt={m.label} className="w-6 h-6 rounded object-contain" onError={e => { (e.target as HTMLImageElement).style.opacity = "0.4"; }} />
                  <span className={`font-bold text-sm ${c.text}`}>{m.label}</span>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.badge}`}>{m.fieldLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold text-base tracking-wide text-foreground truncate">{m.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.holder}</p>
                </div>
                <CopyButton value={m.value} />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-2.5">{m.note}</p>
            </div>
          );
        })}
        <div className="rounded-xl border p-4 border-blue-500/25 bg-blue-500/5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={LOGO_MANUAL_PAYPAL} alt="PayPal" className="w-6 h-6 rounded object-contain" onError={e => { (e.target as HTMLImageElement).style.opacity = "0.4"; }} />
              <span className="font-bold text-sm text-blue-400">PayPal</span>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">Email</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-mono font-bold text-base tracking-wide text-foreground truncate">rtxclinton@gmail.com</p>
              <p className="text-xs text-muted-foreground mt-0.5">rtxclinton</p>
            </div>
            <CopyButton value="rtxclinton@gmail.com" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-2.5">Send payment to this PayPal email, then submit your receipt and details below so we can credit your TX.</p>
          <button onClick={() => setPaypalProofOpen(true)}
            className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
            Submit Payment Proof
          </button>
        </div>
      </div>
      <a
        href="/contact"
        className="w-full mt-4 py-2.5 rounded-xl border border-border bg-muted/40 hover:bg-muted text-sm font-medium transition-colors block text-center"
      >
        Send Proof of Payment
      </a>
      <p className="mt-2 text-xs text-center text-muted-foreground">
        Reach us via the Contact &amp; Support page with your receipt and account email to get your TX credited.
      </p>
      <PayPalProofModal isOpen={paypalProofOpen} onClose={() => setPaypalProofOpen(false)} />
    </div>
  );
}

const TX_RATE_KES = 5;
const TX_MIN = 3;

function CustomTxModal({ isOpen, onClose, userEmail, onSuccess }: { isOpen: boolean; onClose: () => void; userEmail: string; onSuccess: () => void }) {
  const [txAmount, setTxAmount] = useState(10);
  const [method, setMethod] = useState<PayMethod>("mpesa");
  const [phone, setPhone] = useState("");
  const [cardEmail, setCardEmail] = useState(userEmail || "");
  const [stage, setStage] = useState<Stage>("select");
  const [message, setMessage] = useState("");
  const [failReason, setFailReason] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const { showToast } = useToast();
  const { currency, format } = useCurrency();

  const ksPrice = txAmount * TX_RATE_KES;

  useEffect(() => {
    if (!isOpen) { setStage("select"); setPhone(""); setReference(""); setMessage(""); setFailReason(""); setLoading(false); setPollCount(0); setTxAmount(10); }
  }, [isOpen]);

  useEffect(() => {
    if (stage !== "pending" || !reference) return;
    let count = 0;
    const interval = setInterval(async () => {
      count += 1;
      setPollCount(count);
      if (count >= 40) { clearInterval(interval); setStage("failed"); setFailReason("Payment timed out."); return; }
      try {
        const data = await getMobileChargeStatus(reference) as { status?: string; txAmount?: number; error?: string };
        if (data.status === "success") { clearInterval(interval); setStage("success"); showToast(`${data.txAmount ?? txAmount} TX added!`, "success"); onSuccess(); return; }
        if (["failed", "abandoned", "cancelled"].includes(data.status || "")) { clearInterval(interval); setStage("failed"); setFailReason("Payment failed. Please try again."); return; }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [stage, reference, onSuccess, showToast, txAmount]);

  const handleMobileCharge = async () => {
    if (!phone.trim() || !isValidKenyanPhone(phone)) { showToast("Enter a valid phone", "error"); return; }
    setLoading(true);
    try {
      const normalized = toPaystackPhone(phone);
      const provider = method === "airtel" ? "airtel" : "mpesa";
      const res = await fetch("/api/payments/charge-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
        body: JSON.stringify({ txAmount, ksAmount: ksPrice, phone: normalized, provider })
      });
      const data = await res.json() as { error?: string; reference?: string; message?: string };
      if (data.error) { showToast(data.error, "error"); setLoading(false); return; }
      setReference(data.reference || "");
      setMessage(data.message || "Check your phone for the payment prompt.");
      setPollCount(0);
      setTxAmount(10);
      setStage("pending");
    } catch { showToast("Failed to initiate payment", "error"); }
    setLoading(false);
  };

  const handlePopupPay = async (channels: string[]) => {
    if (channels.includes("apple_pay") && !("ApplePaySession" in window)) { showToast("Apple Pay is only available on Apple devices using Safari.", "error"); return; }
    if (!cardEmail.trim() || !cardEmail.includes("@")) { showToast("Enter a valid email", "error"); return; }
    setLoading(true);
    try {
      const paystackPop = (window as unknown as { PaystackPop?: new () => {
        resumeTransaction: (accessCode: string, callbacks: Record<string, unknown>) => void;
        newTransaction: (config: Record<string, unknown>) => void;
      } }).PaystackPop;
      if (!paystackPop) { showToast("Payment system not loaded.", "error"); setLoading(false); return; }
      if (channels.includes("card")) {
        const [cardData, configData] = await Promise.all([
          fetch("/api/payments/prepare-card-custom", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
            body: JSON.stringify({ txAmount, ksAmount: ksPrice })
          }).then(r => r.json()),
          fetch("/api/payments/config").then(r => r.json())
        ]);
        const ref = (cardData as { reference?: string }).reference;
        const publicKey = (configData as { paystackPublicKey?: string }).paystackPublicKey || "";
        if (!ref) { showToast("Payment init failed", "error"); setLoading(false); return; }
        setLoading(false);
        const instance = new paystackPop();
        instance.newTransaction({
          key: publicKey,
          email: cardEmail,
          amount: ksPrice * 100,
          currency: "KES",
          ref,
          channels: ["card"],
          onSuccess: async () => { try { await verifyPayment(ref); } catch {} setStage("success"); showToast(`${txAmount} TX added!`, "success"); onSuccess(); },
          onCancel: () => { setStage("failed"); setFailReason("Card payment was cancelled."); },
          onError: () => { setStage("failed"); setFailReason("Card payment encountered an error. Please try again."); }
        });
      } else {
        const initData = await fetch("/api/payments/initiate-custom", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
          body: JSON.stringify({ txAmount, ksAmount: ksPrice })
        }).then(r => r.json());
        const accessCode = (initData as { accessCode?: string }).accessCode;
        const ref = (initData as { reference?: string }).reference;
        if (!accessCode || !ref) { showToast("Payment init failed", "error"); setLoading(false); return; }
        setLoading(false);
        const instance = new paystackPop();
        instance.resumeTransaction(accessCode, {
          onSuccess: async () => { try { await verifyPayment(ref); } catch {} setStage("success"); showToast(`${txAmount} TX added!`, "success"); onSuccess(); },
          onLoad: () => {},
          onCancel: () => { setStage("failed"); setFailReason("Apple Pay payment was cancelled."); },
          onError: () => { setStage("failed"); setFailReason("Apple Pay encountered an error. Please try again."); }
        });
      }
    } catch { showToast("Payment failed", "error"); setLoading(false); }
  };

  const methodOptions: { key: PayMethod; label: string; Logo: () => ReactElement }[] = [
    { key: "mpesa", label: "M-Pesa", Logo: MpesaLogo },
    { key: "airtel", label: "Airtel", Logo: AirtelLogo },
    { key: "card", label: "Card", Logo: CardLogo },
    { key: "apple_pay", label: "Apple Pay", Logo: ApplePayLogo },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Custom TX Purchase" maxWidth="max-w-lg">
      {stage === "success" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center"><Check className="w-8 h-8 text-green-400" /></div>
          <div className="text-center">
            <p className="font-semibold text-lg text-green-400">Payment Confirmed!</p>
            <p className="text-sm text-muted-foreground mt-1">{txAmount} TX added to your balance.</p>
          </div>
          <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Done</button>
        </div>
      ) : stage === "failed" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
          <div className="text-center"><p className="font-semibold text-lg text-red-400">Failed</p><p className="text-sm text-muted-foreground mt-1">{failReason}</p></div>
          <div className="flex gap-2 w-full">
            <button onClick={() => { setStage("select"); setFailReason(""); setReference(""); }} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Try Again</button>
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Close</button>
          </div>
        </div>
      ) : stage === "pending" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <Loader2 className="w-10 h-10 animate-spin text-teal-400" />
          <div className="text-center"><p className="font-semibold">Waiting for payment...</p><p className="text-sm text-muted-foreground mt-1">{message}</p></div>
          <div className="w-full bg-muted rounded-full h-1.5"><div className="bg-teal-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, (pollCount / 40) * 100)}%` }} /></div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-border bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">How many TX do you want?</p>
            <div className="flex items-center justify-between gap-3">
              <button onClick={() => setTxAmount(v => Math.max(TX_MIN, v - 1))} className="w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"><Minus className="w-4 h-4" /></button>
              <div className="flex-1 text-center">
                <input
                  type="number"
                  inputMode="numeric"
                  value={txAmount}
                  onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= TX_MIN) setTxAmount(v); }}
                  onBlur={e => { const v = parseInt(e.target.value, 10); setTxAmount(isNaN(v) || v < TX_MIN ? TX_MIN : v); }}
                  min={TX_MIN}
                  className="w-full text-center text-3xl font-bold text-teal-400 bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <p className="text-xs text-muted-foreground">TX Coins</p>
              </div>
              <button onClick={() => setTxAmount(v => v + 1)} className="w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="mt-3 pt-3 border-t border-border flex justify-between text-sm">
              <span className="text-muted-foreground">Cost</span>
              <span className="font-semibold">KES {ksPrice}{currency !== "KES" && <span className="text-muted-foreground/60 text-xs"> ≈ {format(ksPrice)}</span>}</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            {methodOptions.map(({ key, label, Logo }) => (
              <button key={key} onClick={() => setMethod(key)}
                className={`flex flex-col items-center gap-2 py-3.5 px-2 rounded-xl border-2 transition-all ${method === key ? "border-teal-500 bg-teal-500/10 shadow-sm shadow-teal-500/20" : "border-border hover:border-teal-500/40 hover:bg-muted/50"}`}
                title={label}
              >
                <Logo />
                <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
              </button>
            ))}
          </div>

          {(method === "mpesa" || method === "airtel") ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1.5">Phone Number</label>
                <input type="tel" placeholder="0712345678" value={phone} onChange={e => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500" />
              </div>
              <button onClick={handleMobileCharge} disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Initiating..." : `Pay KES ${ksPrice}`}
              </button>
            </div>
          ) : method === "card" ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1.5">Email</label>
                <input type="email" placeholder="your@email.com" value={cardEmail} onChange={e => setCardEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500" />
              </div>
              <button onClick={() => handlePopupPay(["card"])} disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Loading..." : `Pay with Card — KES ${ksPrice}`}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1.5">Email</label>
                <input type="email" placeholder="your@email.com" value={cardEmail} onChange={e => setCardEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500" />
              </div>
              <button onClick={() => handlePopupPay(["apple_pay"])} disabled={loading}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loading ? "Loading..." : "Pay with Apple Pay"}
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function OtherCountryPaymentModal({
  isOpen, onClose, pkg, userEmail, onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  pkg: Package | null;
  userEmail: string;
  onSuccess: () => void;
}) {
  const [method, setMethod] = useState<"card" | "apple_pay">("card");
  const [cardEmail, setCardEmail] = useState(userEmail || "");
  const [stage, setStage] = useState<Stage>("select");
  const [failReason, setFailReason] = useState("");
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!isOpen) { setStage("select"); setLoading(false); setFailReason(""); }
  }, [isOpen]);

  useEffect(() => { setCardEmail(userEmail || ""); }, [userEmail]);

  if (!pkg) return null;
  const totalTx = pkg.txAmount + pkg.bonusTx;

  const handlePay = async () => {
    if (method === "apple_pay" && !("ApplePaySession" in window)) {
      showToast("Apple Pay is only available on Apple devices using Safari.", "error");
      return;
    }
    if (!cardEmail.trim() || !cardEmail.includes("@")) { showToast("Enter a valid email", "error"); return; }
    setLoading(true);
    try {
      const paystackPop = (window as unknown as { PaystackPop?: new () => {
        resumeTransaction: (accessCode: string, callbacks: Record<string, unknown>) => void;
        newTransaction: (config: Record<string, unknown>) => void;
      } }).PaystackPop;
      if (!paystackPop) { showToast("Payment system not loaded. Refresh and try again.", "error"); setLoading(false); return; }

      const [cardData, configData] = await Promise.all([
        fetch("/api/payments/prepare-card", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
          body: JSON.stringify({ packageId: pkg._id })
        }).then(r => r.json()),
        fetch("/api/payments/config").then(r => r.json())
      ]);
      const ref = (cardData as { reference?: string }).reference;
      const publicKey = (configData as { paystackPublicKey?: string }).paystackPublicKey || "";
      if (!ref) { showToast("Payment init failed", "error"); setLoading(false); return; }
      setLoading(false);
      const instance = new paystackPop();
      instance.newTransaction({
        key: publicKey,
        email: cardEmail,
        amount: pkg.ksPrice * 100,
        currency: "KES",
        ref,
        channels: [method === "card" ? "card" : "apple_pay"],
        onSuccess: async () => {
          try { await verifyPayment(ref); } catch {}
          setStage("success");
          showToast(`Payment confirmed! ${totalTx} TX added.`, "success");
          onSuccess();
        },
        onCancel: () => { setStage("failed"); setFailReason("Payment was cancelled."); },
        onError: () => { setStage("failed"); setFailReason("Payment encountered an error. Please try again."); }
      });
    } catch { showToast("Payment failed", "error"); setLoading(false); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Complete Payment" maxWidth="max-w-lg">
      {stage === "success" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg text-green-400">Payment Confirmed!</p>
            <p className="text-sm text-muted-foreground mt-1">{totalTx} TX has been added to your account.</p>
          </div>
          <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Done</button>
        </div>
      ) : stage === "failed" ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg text-red-400">Payment Failed</p>
            <p className="text-sm text-muted-foreground mt-1">{failReason}</p>
          </div>
          <div className="flex gap-2 w-full">
            <button onClick={() => { setStage("select"); setFailReason(""); }} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">Try Again</button>
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Close</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium">{pkg.name}</span>
              <span className="font-bold text-blue-400">{totalTx} TX</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">${(pkg.txAmount * USD_PER_TX).toFixed(2)} USD</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setMethod("card")}
              className={`flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 transition-all ${method === "card" ? "border-blue-500 bg-blue-500/10 shadow-sm shadow-blue-500/20" : "border-border hover:border-blue-500/40 hover:bg-muted/50"}`}>
              <CardLogo />
              <span className="text-xs font-semibold text-muted-foreground">Credit / Debit Card</span>
            </button>
            <button onClick={() => setMethod("apple_pay")}
              className={`flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 transition-all ${method === "apple_pay" ? "border-blue-500 bg-blue-500/10 shadow-sm shadow-blue-500/20" : "border-border hover:border-blue-500/40 hover:bg-muted/50"}`}>
              <ApplePayLogo />
              <span className="text-xs font-semibold text-muted-foreground">Apple Pay</span>
            </button>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">Email</label>
            <input type="email" placeholder="your@email.com" value={cardEmail} onChange={e => setCardEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500" />
          </div>
          <button onClick={handlePay} disabled={loading}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Loading..." : `Pay with ${method === "card" ? "Card" : "Apple Pay"} — ${(pkg.txAmount * USD_PER_TX).toFixed(2)}`}
          </button>
        </div>
      )}
    </Modal>
  );
}


export interface TopUpFlowProps {
  requiredTx?: number;
  onSuccess?: () => void;
  compact?: boolean;
}

export function TopUpFlow({ requiredTx, onSuccess, compact = false }: TopUpFlowProps) {
  const { user, refreshUser } = useAuth();
  const { currency, format } = useCurrency();
  const { showToast } = useToast();
  const [packages, setPackages] = useState<Package[]>([]);
  const [pkgLoading, setPkgLoading] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null);
  const [selectedNgPkg, setSelectedNgPkg] = useState<NigeriaPackage | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [ngModalOpen, setNgModalOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [otherMethodModalOpen, setOtherMethodModalOpen] = useState(false);
  const [country, setCountry] = useState<"kenya" | "nigeria" | "tanzania" | "other" | null>(null);
  const [_nigeriaAvailable, setNigeriaAvailable] = useState(false);
  const [tzModalOpen, setTzModalOpen] = useState(false);
  const [selectedTzPkg, setSelectedTzPkg] = useState<TanzaniaPackage | null>(null);

  const handlePaid = async () => {
    await refreshUser();
    onSuccess?.();
  };

  useEffect(() => {
    getPackages()
      .then(data => setPackages((data as Package[]).sort((a, b) => a.order - b.order)))
      .catch(() => showToast("Failed to load packages", "error"))
      .finally(() => setPkgLoading(false));

    getPaymentsConfig()
      .then(config => {
        const c = config as { nigeriaAvailable?: boolean };
        setNigeriaAvailable(!!c.nigeriaAvailable);
      })
      .catch(() => {});
  }, [showToast]);

  return (
    <div className={compact ? "space-y-4" : "space-y-4"}>
        {requiredTx != null && requiredTx > 0 && (
          <div className="p-3.5 rounded-lg border border-teal-500/30 bg-teal-500/5 text-sm">
            You need at least <span className="font-semibold">{requiredTx} TX</span> to continue. Pay here — your balance updates automatically after payment.
          </div>
        )}
        {user && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border w-fit">
            <Coins className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-muted-foreground">Balance</span>
            <span className="font-semibold text-sm">{user.txCoins} TX</span>
          </div>
        )}

        {country === null ? (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <p className="text-sm text-muted-foreground">Select your country to see available packages and payment methods.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => setCountry("kenya")}
                className="group p-6 rounded-xl border border-border bg-card/50 hover:border-teal-500/40 hover:bg-teal-500/5 transition-all text-left"
              >
                <div className="text-4xl mb-3">🇰🇪</div>
                <p className="font-bold text-lg">Kenya</p>
                <p className="text-sm text-muted-foreground mt-1">Pay with M-Pesa, Airtel, Card</p>
                <p className="text-xs text-muted-foreground mt-0.5">Prices in KES</p>
              </button>

              <button
                onClick={() => setCountry("nigeria")}
                className="group p-6 rounded-xl border border-border bg-card/50 hover:border-green-500/40 hover:bg-green-500/5 transition-all text-left"
              >
                <div className="text-4xl mb-3">🇳🇬</div>
                <p className="font-bold text-lg">Nigeria</p>
                <p className="text-sm text-muted-foreground mt-1">Pay with Card, Transfer, USSD, OPay, Zap</p>
                <p className="text-xs text-muted-foreground mt-0.5">Prices in NGN</p>
              </button>

              <button
                onClick={() => setCountry("tanzania")}
                className="group p-6 rounded-xl border border-border bg-card/50 hover:border-sky-500/40 hover:bg-sky-500/5 transition-all text-left"
              >
                <div className="text-4xl mb-3">🇹🇿</div>
                <p className="font-bold text-lg">Tanzania</p>
                <p className="text-sm text-muted-foreground mt-1">Pay with Tigo, Airtel, Vodacom</p>
                <p className="text-xs text-muted-foreground mt-0.5">Prices in TZS · Tigo, Airtel, Vodacom</p>
              </button>

              <button
                onClick={() => setCountry("other")}
                className="group p-6 rounded-xl border border-border bg-card/50 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all text-left"
              >
                <div className="text-4xl mb-3">🌍</div>
                <p className="font-bold text-lg">Other Countries</p>
                <p className="text-sm text-muted-foreground mt-1">Pay with Card or Apple Pay</p>
                <p className="text-xs text-muted-foreground mt-0.5">Available worldwide</p>
              </button>
            </div>
          </div>
        ) : country === "other" ? (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <button onClick={() => setCountry(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Change country
              </button>
              <span className="text-muted-foreground">·</span>
              <span className="text-sm font-medium">🌍 Other Countries</span>
            </div>
            {pkgLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>
            ) : (
              <div className="space-y-6">
                <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 text-sm text-blue-300">
                  Card &amp; Apple Pay are accepted worldwide — no local payment methods needed.
                </div>
                <div className="grid gap-3">
                  {packages.map(pkg => {
                    const total = pkg.txAmount + pkg.bonusTx;
                    return (
                      <div key={pkg._id + "-other"}
                        className={`relative w-full p-4 rounded-xl border transition-all hover:border-blue-500/40 hover:bg-blue-500/5 ${pkg.isBestDeal ? "border-blue-500/50 bg-blue-500/5" : "border-border bg-card/50"}`}>
                        {pkg.isBestDeal && (
                          <span className="absolute -top-2.5 right-3 px-2 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-full uppercase tracking-wide">Best Deal</span>
                        )}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{pkg.name}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {pkg.txAmount} TX{pkg.bonusTx > 0 ? ` + ${pkg.bonusTx} bonus` : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-blue-400">{total} TX</p>
                            <p className="text-sm text-muted-foreground">${(pkg.txAmount * USD_PER_TX).toFixed(2)} USD</p>
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <button onClick={() => { setSelectedPkg(pkg); setOtherMethodModalOpen(true); }}
                            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors">
                            Purchase
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : country === "tanzania" ? (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <button onClick={() => setCountry(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Change country
              </button>
              <span className="text-muted-foreground">·</span>
              <span className="text-sm font-medium">🇹🇿 Tanzania (TZS)</span>
            </div>
            <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 text-sm text-sky-300">
              Supports Tigo Pesa, Airtel Money, Vodacom M-Pesa (TZ), and more Tanzania mobile networks.
            </div>
            <div className="grid gap-3">
              {TANZANIA_PACKAGES.map(pkg => {
                const total = pkg.txAmount + pkg.bonusTx;
                return (
                  <div key={pkg.id}
                    className={`relative w-full p-4 rounded-xl border transition-all hover:border-sky-500/40 hover:bg-sky-500/5 ${pkg.isBestDeal ? "border-sky-500/50 bg-sky-500/5" : "border-border bg-card/50"}`}>
                    {pkg.isBestDeal && (
                      <span className="absolute -top-2.5 right-3 px-2 py-0.5 text-[10px] font-bold bg-sky-600 text-white rounded-full uppercase tracking-wide">Best Deal</span>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{pkg.name}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {pkg.txAmount} TX{pkg.bonusTx > 0 ? ` + ${pkg.bonusTx} bonus` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-sky-400">{total} TX</p>
                        <p className="text-sm text-muted-foreground">TZS {pkg.tzsPrice.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button onClick={() => { setSelectedTzPkg(pkg); setTzModalOpen(true); }}
                        className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors">
                        Purchase
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : country === "nigeria" ? (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <button onClick={() => setCountry(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Change country
              </button>
              <span className="text-muted-foreground">·</span>
              <span className="text-sm font-medium">🇳🇬 Nigeria (NGN)</span>
            </div>
            <div className="grid gap-3">
              {NIGERIA_PACKAGES.map(pkg => {
                const total = pkg.txAmount + pkg.bonusTx;
                return (
                  <div key={pkg.id}
                    className={`relative w-full p-4 rounded-xl border transition-all hover:border-green-500/40 hover:bg-green-500/5 ${pkg.isBestDeal ? "border-green-500/50 bg-green-500/5" : "border-border bg-card/50"}`}>
                    {pkg.isBestDeal && (
                      <span className="absolute -top-2.5 right-3 px-2 py-0.5 text-[10px] font-bold bg-green-600 text-white rounded-full uppercase tracking-wide">Best Deal</span>
                    )}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{pkg.name}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {pkg.txAmount} TX{pkg.bonusTx > 0 ? ` + ${pkg.bonusTx} bonus` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-400">{total} TX</p>
                        <p className="text-sm text-muted-foreground">NGN {pkg.ngnPrice.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <button onClick={() => { setSelectedNgPkg(pkg); setNgModalOpen(true); }}
                        className="px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors">
                        Purchase
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <button onClick={() => setCountry(null)} className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" /> Change country
              </button>
              <span className="text-muted-foreground">·</span>
              <span className="text-sm font-medium">🇰🇪 Kenya (KES)</span>
            </div>
            {pkgLoading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-teal-400" /></div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-3">
                  {packages.map(pkg => {
                    const total = pkg.txAmount + pkg.bonusTx;
                    return (
                      <div key={pkg._id}
                        className={`relative w-full p-4 rounded-xl border transition-all hover:border-teal-500/40 hover:bg-teal-500/5 ${pkg.isBestDeal ? "border-teal-500/50 bg-teal-500/5" : "border-border bg-card/50"}`}>
                        {pkg.isBestDeal && (
                          <span className="absolute -top-2.5 right-3 px-2 py-0.5 text-[10px] font-bold bg-teal-600 text-white rounded-full uppercase tracking-wide">Best Deal</span>
                        )}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{pkg.name}</p>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {pkg.txAmount} TX{pkg.bonusTx > 0 ? ` + ${pkg.bonusTx} bonus` : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-teal-400">{total} TX</p>
                            <p className="text-sm text-muted-foreground">KES {pkg.ksPrice}{currency !== "KES" && ` ≈ ${format(pkg.ksPrice)}`}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <button onClick={() => { setSelectedPkg(pkg); setModalOpen(true); }}
                            className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors">
                            Purchase
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border border-dashed border-border rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Custom Amount</p>
                      <p className="text-sm text-muted-foreground">Choose exactly how many TX you need</p>
                    </div>
                    <button onClick={() => setCustomModalOpen(true)}
                      className="px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm font-medium transition-colors border border-border">
                      Custom
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!compact && <ManualPaySection />}

      <PaymentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        pkg={selectedPkg}
        userEmail={user?.email || ""}
        onSuccess={() => { handlePaid(); setModalOpen(false); }}
      />
      <NigeriaPaymentModal
        isOpen={ngModalOpen}
        onClose={() => setNgModalOpen(false)}
        pkg={selectedNgPkg}
        userEmail={user?.email || ""}
        onSuccess={() => { handlePaid(); setNgModalOpen(false); }}
      />
      <CustomTxModal
        isOpen={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        userEmail={user?.email || ""}
        onSuccess={() => { handlePaid(); setCustomModalOpen(false); }}
      />
      <OtherCountryPaymentModal
        isOpen={otherMethodModalOpen}
        onClose={() => setOtherMethodModalOpen(false)}
        pkg={selectedPkg}
        userEmail={user?.email || ""}
        onSuccess={() => { handlePaid(); setOtherMethodModalOpen(false); }}
      />
      <TanzaniaPaymentModal
        isOpen={tzModalOpen}
        onClose={() => setTzModalOpen(false)}
        pkg={selectedTzPkg}
        onSuccess={() => { handlePaid(); setTzModalOpen(false); }}
      />
    </div>
  );
}
