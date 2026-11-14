import crypto from "crypto";
import { SITE_URL } from "../config.js";

/**
 * Abliner (Tanzania mobile money) — https://abliner.net/docs
 * All credentials are read from .env:
 *   ABLINER_API_KEY         API key (tsl_live_...)              REQUIRED
 *   ABLINER_WEBHOOK_SECRET  Webhook signing secret (whsec_...)  REQUIRED (also signs requests)
 *   ABLINER_API_BASE_URL    default https://abliner.net
 *
 * Payments are started with POST /api/v1/deposits (USSD push). The final result arrives on
 *   POST {SITE_URL}/webhook/abliner
 * and can also be polled with GET /api/v1/transactions?customer_reference=...
 */
const env = (k: string) => (process.env[k] || "").trim();

const baseUrl = (): string =>
  (env("ABLINER_API_BASE_URL") || "https://abliner.net").replace(/\/+$/, "").replace(/\/api\/v1$/, "");

export const isTanzaniaAvailable = (): boolean => !!env("ABLINER_API_KEY");
export const getAblinerWebhookSecret = (): string => env("ABLINER_WEBHOOK_SECRET");

export const ABLINER_MIN_TZS = 500;
export const ABLINER_MAX_TZS = 3_000_000;

/** 0712345678 / 712345678 / +255712345678  ->  255712345678 */
export function toAblinerPhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("255")) return d;
  if (d.startsWith("0")) d = d.slice(1);
  return `255${d}`;
}

function authHeaders(bodyForSignature?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env("ABLINER_API_KEY")}`,
    "Content-Type": "application/json",
  };
  const secret = env("ABLINER_WEBHOOK_SECRET");
  if (bodyForSignature !== undefined && secret) {
    const ts = Math.floor(Date.now() / 1000).toString();
    headers["x-abliner-timestamp"] = ts;
    headers["x-abliner-signature"] = crypto.createHmac("sha256", secret).update(`${ts}.${bodyForSignature}`).digest("hex");
  }
  return headers;
}

const FRIENDLY: Record<string, string> = {
  ussd_session_busy: "This phone already has a payment prompt open. Approve or dismiss it, wait a minute, then try again.",
  invalid_phone: "Enter a valid Tanzania mobile money number (e.g. 0712345678).",
  amount_out_of_range: `Amount must be between TZS ${ABLINER_MIN_TZS.toLocaleString("en-US")} and TZS ${ABLINER_MAX_TZS.toLocaleString("en-US")}.`,
  unsupported_request: "This mobile network is not available right now. Try another number.",
  gateway_not_configured: "Tanzania payments are temporarily unavailable. Please try again later.",
  provider_error: "The mobile network did not respond. Please try again in a moment.",
  daily_limit_exceeded: "Daily payment limit reached. Please try again tomorrow.",
};

export interface AblinerInitResult {
  success: boolean;
  reference?: string; // OUR reference (customer_reference) — stored as the transaction ref
  message?: string;
}

export async function initiateAblinerPayment(params: { phone: string; amount: number }): Promise<AblinerInitResult> {
  try {
    if (!isTanzaniaAvailable()) return { success: false, message: "Tanzania payments are not available." };
    const amount = Math.round(params.amount);
    // Alphanumeric only: Abliner echoes an alphanumeric reference to the network.
    const reference = `BMB${Date.now()}${crypto.randomBytes(4).toString("hex")}`.toUpperCase();
    const body = JSON.stringify({
      amount,
      method: "mobile",
      currency: "TZS",
      phone: toAblinerPhone(params.phone),
      reference,
      callback_url: `${SITE_URL}/webhook/abliner`,
    });
    const res = await fetch(`${baseUrl()}/api/v1/deposits`, {
      method: "POST",
      headers: { ...authHeaders(body), "Idempotency-Key": reference },
      body,
    });
    const raw = await res.text();
    let data: { status?: string; code?: string; message?: string } = {};
    try { data = JSON.parse(raw); } catch { /* non-JSON */ }
    if (!res.ok || data.status === "error") {
      const code = data.code || "";
      return { success: false, message: FRIENDLY[code] || data.message || "Failed to initiate payment" };
    }
    return { success: true, reference };
  } catch {
    return { success: false, message: "Payment service unavailable. Please try again." };
  }
}

export interface AblinerStatusResult {
  success: boolean;
  status?: "SUCCESS" | "PENDING" | "FAILED";
  message?: string;
}

export async function getAblinerPaymentStatus(reference: string): Promise<AblinerStatusResult> {
  try {
    const res = await fetch(`${baseUrl()}/api/v1/transactions?customer_reference=${encodeURIComponent(reference)}`, {
      headers: authHeaders(),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: Array<{ status?: string }>; message?: string };
    if (!res.ok) return { success: false, message: json.message || "Status check failed" };
    const tx = Array.isArray(json.data) ? json.data[0] : undefined;
    if (!tx) return { success: true, status: "PENDING" };
    const s = String(tx.status || "").toLowerCase();
    if (s === "completed") return { success: true, status: "SUCCESS" };
    if (s === "failed") return { success: true, status: "FAILED" };
    return { success: true, status: "PENDING" };
  } catch {
    return { success: false, message: "Payment service unavailable" };
  }
}

/** Verifies x-webhook-signature = HMAC-SHA256(secret, `${x-webhook-timestamp}.${rawBody}`), max 5 min old. */
export function verifyAblinerWebhook(rawBody: Buffer | undefined, headers: Record<string, unknown>): boolean {
  const secret = env("ABLINER_WEBHOOK_SECRET");
  if (!secret || !rawBody) return false;
  const signature = String(headers["x-webhook-signature"] || "");
  const timestamp = String(headers["x-webhook-timestamp"] || "");
  if (!signature || !timestamp) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody.toString()}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
