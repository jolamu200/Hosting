import crypto from "crypto";
import { Transaction } from "../models/Transaction.js";
import { SITE_URL } from "../config.js";

/**
 * SpeedPesa (Tanzania mobile money). All credentials come from .env.
 *
 * Two modes, chosen automatically:
 *  1) "merchant" mode  – SPEEDPESA_API_KEY + SPEEDPESA_API_SECRET + SPEEDPESA_MERCHANT_ID + SPEEDPESA_BASE_URL
 *     (token auth + USSD push, the flow Bmb Tech was already using). Payment confirmation arrives via the
 *     webhook  POST {SITE_URL}/webhook/speedpesa
 *  2) "legacy" mode    – only SPEEDPESA_API_KEY (x-api-key header, /mobilepayin + /status), as in Toxic.
 */
const LEGACY_BASE = "https://speedpesa.com/api/v1";

const env = (k: string) => (process.env[k] || "").trim();
const isMerchantMode = () =>
  !!(env("SPEEDPESA_API_KEY") && env("SPEEDPESA_API_SECRET") && env("SPEEDPESA_MERCHANT_ID") && env("SPEEDPESA_BASE_URL"));

export function isTanzaniaAvailable(): boolean {
  return !!env("SPEEDPESA_API_KEY");
}

/** Accepts ".../api", ".../api/v1" or the bare host and returns ".../api/v1". */
function merchantBase(): string {
  const b = env("SPEEDPESA_BASE_URL").replace(/\/+$/, "").replace(/\/v1$/, "").replace(/\/api$/, "");
  return `${b}/api/v1`;
}

function legacyHeaders(): Record<string, string> {
  return { "x-api-key": env("SPEEDPESA_API_KEY"), "Content-Type": "application/json" };
}

export interface SpeedPesaInitResult {
  success: boolean;
  reference?: string;
  message?: string;
}

async function getMerchantToken(): Promise<string> {
  const res = await fetch(`${merchantBase()}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: env("SPEEDPESA_API_KEY"), api_secret: env("SPEEDPESA_API_SECRET") }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; message?: string };
  if (!res.ok || !data.access_token) throw new Error(data.message || "Could not authenticate with SpeedPesa");
  return data.access_token;
}

export async function initiateSpeedPesaPayment(params: {
  phonenumber: string;
  amount: number;
}): Promise<SpeedPesaInitResult> {
  try {
    if (isMerchantMode()) {
      const reference = `BMB${Date.now()}${crypto.randomBytes(4).toString("hex")}`;
      const token = await getMerchantToken();
      const res = await fetch(`${merchantBase()}/collections/ussd-push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Merchant-Id": env("SPEEDPESA_MERCHANT_ID"),
        },
        body: JSON.stringify({
          msisdn: params.phonenumber,
          amount: params.amount,
          currency: "TZS",
          channel: "MPESA",
          reference,
          callback_url: `${SITE_URL}/webhook/speedpesa`,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok || data.success === false) return { success: false, message: data.message || "SpeedPesa rejected the payment request" };
      return { success: true, reference };
    }

    const res = await fetch(`${LEGACY_BASE}/mobilepayin`, {
      method: "POST",
      headers: legacyHeaders(),
      body: JSON.stringify({ phonenumber: params.phonenumber, amount: String(params.amount) }),
    });
    const data = (await res.json()) as { type?: string; message?: string; data?: { reference?: string } };
    if (data.type === "success" && data.data?.reference) return { success: true, reference: data.data.reference };
    return { success: false, message: data.message || "Failed to initiate payment" };
  } catch (e) {
    return { success: false, message: e instanceof Error && e.message ? e.message : "Payment service unavailable" };
  }
}

export interface SpeedPesaStatusResult {
  success: boolean;
  status?: "SUCCESS" | "PENDING" | "FAILED";
  message?: string;
}

export async function getSpeedPesaPaymentStatus(reference: string): Promise<SpeedPesaStatusResult> {
  try {
    if (isMerchantMode()) {
      // Confirmation is pushed to our webhook, so the local transaction is the source of truth.
      const tx = await Transaction.findOne({ paystackRef: reference, paystackCountry: "tanzania" });
      if (!tx) return { success: false, message: "Transaction not found" };
      if (tx.status === "success") return { success: true, status: "SUCCESS" };
      if (tx.status === "failed") return { success: true, status: "FAILED" };
      return { success: true, status: "PENDING" };
    }
    const res = await fetch(`${LEGACY_BASE}/status`, {
      method: "POST",
      headers: legacyHeaders(),
      body: JSON.stringify({ reference }),
    });
    const data = (await res.json()) as { type?: string; message?: string; data?: { status?: string } };
    if (data.data?.status) return { success: true, status: data.data.status as "SUCCESS" | "PENDING" | "FAILED" };
    return { success: false, message: data.message || "Status check failed" };
  } catch {
    return { success: false, message: "Payment service unavailable" };
  }
}
