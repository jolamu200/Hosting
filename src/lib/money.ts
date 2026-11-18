/**
 * Local-currency pricing.
 *
 * Internally the wallet is still stored in "units" (txCoins) so existing payments keep working,
 * but nothing in the UI says "TX" any more: every amount is shown in the visitor's own currency.
 *   tx(10)  ->  "TSh 1,500" (Tanzania)  /  "KSh 50" (Kenya)  /  "$2.00" (USD)
 */
export interface MoneyCurrency { code: string; symbol: string; perKes: number }

const FALLBACK: MoneyCurrency[] = [
  { code: "KES", symbol: "KSh", perKes: 1 },
  { code: "USD", symbol: "$", perKes: 0.00773 },
  { code: "NGN", symbol: "₦", perKes: 12.1 },
  { code: "TZS", symbol: "TSh", perKes: 19.9 },
  { code: "UGX", symbol: "USh", perKes: 28.3 },
  { code: "GHS", symbol: "₵", perKes: 0.1085 },
];

/** Real prices charged per unit in each market (must match server/routes/payments.ts). */
const UNIT_PRICE: Record<string, number> = { KES: 5, TZS: 150, NGN: 100, USD: 0.2 };

let current = "KES";
let list: MoneyCurrency[] = FALLBACK;

export function setMoneyState(code: string, currencies?: MoneyCurrency[]) {
  current = code;
  if (currencies && currencies.length) list = currencies;
}
export const getMoneyCurrency = () => current;

function def(code: string): MoneyCurrency {
  return list.find(c => c.code === code) || list.find(c => c.code === "USD") || FALLBACK[1];
}

export function unitPrice(code = current): number {
  if (UNIT_PRICE[code] != null) return UNIT_PRICE[code];
  const usd = def("USD").perKes || 0.00773;
  const raw = 0.2 * (def(code).perKes / usd);
  if (raw >= 100) return Math.round(raw / 10) * 10;
  if (raw >= 10) return Math.round(raw);
  return Math.round(raw * 100) / 100;
}

export function formatMoney(amount: number, code = current): string {
  const d = def(code);
  const abs = Math.abs(amount);
  const decimals = abs >= 100 || Number.isInteger(abs) && abs >= 10 ? 0 : 2;
  const text = amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const tight = d.symbol.length === 1 && !/[A-Za-z]/.test(d.symbol);
  return tight ? `${d.symbol}${text}` : `${d.symbol} ${text}`;
}

/** Wallet units -> local money text. */
export function tx(units?: number | null): string {
  const n = Number(units ?? 0);
  return formatMoney(n * unitPrice(current), current);
}

/** Wallet units -> raw local amount. */
export function txValue(units?: number | null): number {
  return Number(units ?? 0) * unitPrice(current);
}

// ------------------------------------------------------------------ auto-detect
const TZ_CURRENCY: Record<string, string> = {
  "Africa/Nairobi": "KES", "Africa/Dar_es_Salaam": "TZS", "Africa/Lagos": "NGN", "Africa/Kampala": "UGX",
  "Africa/Accra": "GHS", "Africa/Johannesburg": "ZAR", "Africa/Kigali": "RWF", "Africa/Lusaka": "ZMW",
  "Africa/Douala": "XAF", "Africa/Libreville": "XAF", "Africa/Brazzaville": "XAF", "Africa/Abidjan": "XOF",
  "Africa/Dakar": "XOF", "Africa/Cairo": "EGP", "Africa/Blantyre": "MWK", "Africa/Addis_Ababa": "ETB",
  "Africa/Kinshasa": "USD", "Africa/Lubumbashi": "USD", "Europe/London": "GBP", "Asia/Kolkata": "INR",
  "Asia/Dubai": "AED", "Asia/Shanghai": "CNY", "Australia/Sydney": "AUD", "America/Toronto": "CAD",
};
const REGION_CURRENCY: Record<string, string> = {
  KE: "KES", TZ: "TZS", NG: "NGN", UG: "UGX", GH: "GHS", ZA: "ZAR", RW: "RWF", ZM: "ZMW", CM: "XAF", GA: "XAF",
  CG: "XAF", CI: "XOF", SN: "XOF", EG: "EGP", MW: "MWK", ET: "ETB", GB: "GBP", IN: "INR", AE: "AED", CN: "CNY",
  AU: "AUD", CA: "CAD", US: "USD", CD: "USD", DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", BE: "EUR",
  PT: "EUR", IE: "EUR", AT: "EUR",
};

/** Best-effort guess from the device time zone, then browser language region. No network calls. */
export function detectCurrency(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    // Some Tanzanian phones report the Nairobi time zone: trust a Tanzanian language region (e.g. sw-TZ) first.
    if (tz === "Africa/Nairobi" || tz === "Africa/Dar_es_Salaam") {
      const regions = (navigator.languages || [navigator.language]).map(l => (l.split("-")[1] || "").toUpperCase());
      if (regions.includes("TZ")) return "TZS";
    }
    if (TZ_CURRENCY[tz]) return TZ_CURRENCY[tz];
    if (tz.startsWith("Europe/")) return "EUR";
  } catch { /* ignore */ }
  try {
    for (const lang of navigator.languages || [navigator.language]) {
      const region = (lang.split("-")[1] || "").toUpperCase();
      if (REGION_CURRENCY[region]) return REGION_CURRENCY[region];
    }
  } catch { /* ignore */ }
  return "USD";
}

/** Currency -> top-up country page (/topup/<country>). Unlisted currencies use the card flow. */
export function countryForCurrency(code: string): "kenya" | "nigeria" | "tanzania" | "other" {
  if (code === "KES") return "kenya";
  if (code === "NGN") return "nigeria";
  if (code === "TZS") return "tanzania";
  return "other";
}
