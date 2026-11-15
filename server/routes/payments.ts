import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { Package } from "../models/Package.js";
import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";
import { authGuard, type AuthRequest } from "../middleware/auth.js";
import { banCheck } from "../middleware/banCheck.js";
import { paymentRateLimit } from "../middleware/rateLimit.js";
import {
  verifyWebhookSignature,
  verifyWebhookSignatureNg,
  verifyTransaction,
  verifyTransactionNg,
  initializeTransaction,
  initializeTransactionNg,
  chargeMobileMoney,
  getChargeStatus,
  normalizePhone,
  PAYSTACK_PUBLIC_KEY,
  getNigeriaPublicKey,
  isNigeriaAvailable,
} from "../services/paystack.js";
import {
  isTanzaniaAvailable,
  initiateAblinerPayment,
  getAblinerPaymentStatus,
  verifyAblinerWebhook,
} from "../services/abliner.js";
import { BoostOrder } from "../models/BoostOrder.js";
import { fulfillPaidBoostOrder } from "../services/boostFulfillment.js";
import { notifyOwner } from "../services/notify.js";
import { createNotification } from "../services/notifications.js";

const router = Router();
const MAX_DAILY_FAILURES = 5;
const TX_RATE_KES = 5;

function getParam(val: string | string[]): string {
  return Array.isArray(val) ? (val[0] ?? "") : val;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function recordPaymentFailure(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user || user.isBanned) return;
  const today = todayStr();
  const currentDate = (user as unknown as { paymentFailDate?: string }).paymentFailDate || "";
  const currentCount = (user as unknown as { paymentFailCount?: number }).paymentFailCount || 0;
  const newCount = currentDate === today ? currentCount + 1 : 1;
  if (newCount >= MAX_DAILY_FAILURES) {
    await User.findByIdAndUpdate(userId, {
      isBanned: true,
      banReason: "Automated: excessive payment failures",
      paymentFailCount: newCount,
      paymentFailDate: today
    });
  } else {
    await User.findByIdAndUpdate(userId, { paymentFailCount: newCount, paymentFailDate: today });
  }
}

export async function paystackWebhookHandler(req: Request, res: Response): Promise<void> {
  try {
    const signature = Array.isArray(req.headers["x-paystack-signature"])
      ? req.headers["x-paystack-signature"][0]
      : req.headers["x-paystack-signature"] || "";
    if (!signature) { res.status(400).json({ error: "Missing signature" }); return; }
    const body = JSON.stringify(req.body);

    const isValidKenya = verifyWebhookSignature(body, signature);
    const isValidNigeria = !isValidKenya && verifyWebhookSignatureNg(body, signature);

    if (!isValidKenya && !isValidNigeria) { res.status(400).json({ error: "Invalid signature" }); return; }

    const country: "kenya" | "nigeria" = isValidNigeria ? "nigeria" : "kenya";
    const currencyLabel = country === "nigeria" ? "NGN" : "KES";

    const event = req.body;
    if (event.event === "charge.success") {
      const reference = event.data.reference as string;
      const tx = await Transaction.findOne({ paystackRef: reference });
      if (tx && tx.status === "pending") {
        tx.status = "success";
        await tx.save();
        const user = await User.findById(tx.userId);
        if (user) {
          user.txCoins += tx.txAmount;
          await user.save();
          notifyOwner(`💰 *Payment Confirmed (Webhook)*\n\nUser: \`${user.email}\`\nAmount: ${tx.txAmount} TX (${currencyLabel} ${tx.ksAmount})\nCountry: ${country === "nigeria" ? "🇳🇬 Nigeria" : "🇰🇪 Kenya"}\nRef: \`${reference}\``).catch(() => {});
          createNotification(user._id, "topup", "Top up successful", `You topped up ${tx.txAmount} TX (${currencyLabel} ${tx.ksAmount}).`).catch(() => {});
        }
      }
    }
    res.json({ received: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

router.get("/config", (_req, res) => {
  res.json({
    paystackPublicKey: PAYSTACK_PUBLIC_KEY,
    nigeriaPublicKey: getNigeriaPublicKey(),
    nigeriaAvailable: isNigeriaAvailable(),
    tanzaniaAvailable: isTanzaniaAvailable(),
  });
});

router.get("/packages", async (_req, res) => {
  try {
    const packages = await Package.find({ active: true }).sort({ order: 1 }).lean();
    res.json(packages);
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/initiate", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ packageId: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const pkg = await Package.findById(parsed.data.packageId);
    if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const reference = `TX_${Date.now()}_${user._id.toString().slice(-6)}`;
    const result = await initializeTransaction(user.email, pkg.ksPrice, reference, {
      packageId: pkg._id.toString(),
      userId: user._id.toString(),
      txAmount: pkg.txAmount + pkg.bonusTx
    });
    if (!result.success) { res.status(500).json({ error: "Failed to initialize payment" }); return; }
    await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount: pkg.txAmount + pkg.bonusTx,
      ksAmount: pkg.ksPrice,
      paystackRef: reference,
      status: "pending",
      paystackCountry: "kenya",
    });
    res.json({ authorizationUrl: result.authorizationUrl, accessCode: result.accessCode, reference });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/initiate-ng", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    if (!isNigeriaAvailable()) { res.status(503).json({ error: "Nigeria payments are not available." }); return; }
    const schema = z.object({
      ngnAmount: z.number().min(100),
      txAmount: z.number().min(1),
      bonusTx: z.number().min(0).default(0),
      packageName: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { ngnAmount, txAmount, bonusTx, packageName } = parsed.data;
    const totalTx = txAmount + bonusTx;
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const reference = `TXNG_${Date.now()}_${user._id.toString().slice(-6)}`;
    const result = await initializeTransactionNg(user.email, ngnAmount, reference, {
      packageName: packageName || "Nigeria Package",
      userId: user._id.toString(),
      txAmount: totalTx,
    });
    if (!result.success) { res.status(500).json({ error: "Failed to initialize payment" }); return; }
    await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount: totalTx,
      ksAmount: ngnAmount,
      paystackRef: reference,
      status: "pending",
      paystackCountry: "nigeria",
    });
    res.json({ authorizationUrl: result.authorizationUrl, accessCode: result.accessCode, reference });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/charge", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      packageId: z.string(),
      phone: z.string().min(9),
      provider: z.enum(["mpesa", "airtel"])
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { packageId, phone, provider } = parsed.data;
    const pkg = await Package.findById(packageId);
    if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const reference = `TXM_${Date.now()}_${user._id.toString().slice(-6)}`;
    const paystackProvider: "mpesa" | "atl" = provider === "airtel" ? "atl" : "mpesa";
    const charge = await chargeMobileMoney({
      email: user.email,
      amountKes: pkg.ksPrice * 100,
      phone: normalizePhone(phone),
      provider: paystackProvider,
      reference
    });
    await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount: pkg.txAmount + pkg.bonusTx,
      ksAmount: pkg.ksPrice,
      paystackRef: charge.reference,
      status: "pending",
      paystackCountry: "kenya",
    });
    res.json({
      reference: charge.reference,
      message: charge.display_text ?? "Check your phone for the payment prompt."
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Charge failed";
    res.status(400).json({ error: message });
  }
});

router.post("/charge-custom", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      txAmount: z.number().min(3),
      ksAmount: z.number().min(15).optional(),
      phone: z.string().min(9),
      provider: z.enum(["mpesa", "airtel"])
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { txAmount, phone, provider } = parsed.data;
    const ksAmount = parsed.data.ksAmount ?? txAmount * TX_RATE_KES;
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const reference = `TXCUSTM_${Date.now()}_${user._id.toString().slice(-6)}`;
    const paystackProvider: "mpesa" | "atl" = provider === "airtel" ? "atl" : "mpesa";
    const charge = await chargeMobileMoney({
      email: user.email,
      amountKes: ksAmount * 100,
      phone: normalizePhone(phone),
      provider: paystackProvider,
      reference
    });
    await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount,
      ksAmount,
      paystackRef: charge.reference,
      status: "pending",
      paystackCountry: "kenya",
    });
    res.json({
      reference: charge.reference,
      message: charge.display_text ?? "Check your phone for the payment prompt."
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Charge failed";
    res.status(400).json({ error: message });
  }
});

router.get("/charge/status/:reference", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const reference = getParam(req.params.reference);
    let status: string;
    try {
      status = await getChargeStatus(reference);
    } catch {
      res.json({ status: "pending" });
      return;
    }
    if (status === "success") {
      const tx = await Transaction.findOne({ paystackRef: reference, userId: req.user!._id });
      if (tx && tx.status === "pending") {
        tx.status = "success";
        await tx.save();
        const user = await User.findById(req.user!._id);
        if (user) {
          user.txCoins += tx.txAmount;
          await user.save();
          notifyOwner(`💰 *Payment Received*\n\nUser: \`${user.email}\`\nAmount: ${tx.txAmount} TX (KES ${tx.ksAmount})\nMethod: Mobile Money\nRef: \`${reference}\``).catch(() => {});
          createNotification(user._id, "topup", "Top up successful", `You topped up ${tx.txAmount} TX (KES ${tx.ksAmount}).`).catch(() => {});
        }
        res.json({ status: "success", txAmount: tx.txAmount });
        return;
      }
      if (tx && tx.status === "success") { res.json({ status: "success", txAmount: tx.txAmount }); return; }
    }
    if (["failed", "abandoned", "cancelled", "reversed"].includes(status)) {
      const tx = await Transaction.findOne({ paystackRef: reference, userId: req.user!._id });
      if (tx && tx.status === "pending") {
        tx.status = "failed";
        await tx.save();
        await recordPaymentFailure(req.user!._id.toString());
      }
      res.json({ status });
      return;
    }
    res.json({ status });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/verify", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ reference: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { reference } = parsed.data;
    const tx = await Transaction.findOne({ paystackRef: reference, userId: req.user!._id });
    if (!tx) { res.status(404).json({ error: "Transaction not found" }); return; }
    if (tx.status === "success") { res.json({ success: true, txAmount: tx.txAmount }); return; }
    const isNg = tx.paystackCountry === "nigeria";
    const result = isNg ? await verifyTransactionNg(reference) : await verifyTransaction(reference);
    if (result.success) {
      tx.status = "success";
      await tx.save();
      const user = await User.findById(req.user!._id);
      if (user) {
        user.txCoins += tx.txAmount;
        await user.save();
        const curr = isNg ? "NGN" : "KES";
        notifyOwner(`💰 *Payment Verified*\n\nUser: \`${user.email}\`\nAmount: ${tx.txAmount} TX (${curr} ${tx.ksAmount})\nRef: \`${reference}\``).catch(() => {});
        createNotification(user._id, "topup", "Top up successful", `You topped up ${tx.txAmount} TX.`).catch(() => {});
      }
      res.json({ success: true, txAmount: tx.txAmount });
    } else {
      res.json({ success: false });
    }
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/prepare-card", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ packageId: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const pkg = await Package.findById(parsed.data.packageId);
    if (!pkg) { res.status(404).json({ error: "Package not found" }); return; }
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const reference = `TXCARD_${Date.now()}_${user._id.toString().slice(-6)}`;
    await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount: pkg.txAmount + pkg.bonusTx,
      ksAmount: pkg.ksPrice,
      paystackRef: reference,
      status: "pending",
      paystackCountry: "kenya",
    });
    res.json({ reference });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/initiate-custom", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ txAmount: z.number().min(3), ksAmount: z.number().min(15).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { txAmount } = parsed.data;
    const ksAmount = parsed.data.ksAmount ?? txAmount * TX_RATE_KES;
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const reference = `TXAC_${Date.now()}_${user._id.toString().slice(-6)}`;
    const result = await initializeTransaction(user.email, ksAmount, reference, {
      userId: user._id.toString(),
      txAmount
    });
    if (!result.success) { res.status(500).json({ error: "Failed to initialize payment" }); return; }
    await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount,
      ksAmount,
      paystackRef: reference,
      status: "pending",
      paystackCountry: "kenya",
    });
    res.json({ accessCode: result.accessCode, reference });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/prepare-card-ng", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    if (!isNigeriaAvailable()) { res.status(503).json({ error: "Nigeria payments are not available." }); return; }
    const schema = z.object({
      ngnAmount: z.number().min(100),
      txAmount: z.number().min(1),
      bonusTx: z.number().min(0).default(0),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { ngnAmount, txAmount, bonusTx } = parsed.data;
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const reference = `TXNGCARD_${Date.now()}_${user._id.toString().slice(-6)}`;
    await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount: txAmount + bonusTx,
      ksAmount: ngnAmount,
      paystackRef: reference,
      status: "pending",
      paystackCountry: "nigeria",
    });
    res.json({ reference });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/prepare-card-custom", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ txAmount: z.number().min(3), ksAmount: z.number().min(15).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { txAmount } = parsed.data;
    const ksAmount = parsed.data.ksAmount ?? txAmount * TX_RATE_KES;
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const reference = `TXCCARD_${Date.now()}_${user._id.toString().slice(-6)}`;
    await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount,
      ksAmount,
      paystackRef: reference,
      status: "pending",
      paystackCountry: "kenya",
    });
    res.json({ reference });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

function normalizeTanzaniaPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("255") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return "255" + digits.slice(1);
  if (digits.length === 9) return "255" + digits;
  return null;
}

router.post("/initiate-tanzania", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    if (!isTanzaniaAvailable()) { res.status(503).json({ error: "Tanzania payments are not available." }); return; }
    const schema = z.object({
      tzsAmount: z.number().min(500),
      txAmount: z.number().min(1),
      bonusTx: z.number().min(0).default(0),
      phone: z.string().min(8).max(16),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" }); return; }
    const { tzsAmount, txAmount, bonusTx } = parsed.data;
    const phone = normalizeTanzaniaPhone(parsed.data.phone);
    if (!phone || !/^255[67]\d{8}$/.test(phone)) { res.status(400).json({ error: "Enter a valid Tanzania mobile number (e.g. 0712345678)" }); return; }
    const TZS_PER_TX = 150;
    const expectedTzsAmount = txAmount * TZS_PER_TX;
    if (Math.abs(tzsAmount - expectedTzsAmount) > 1) { res.status(400).json({ error: "Invalid package amount" }); return; }
    const totalTx = txAmount + bonusTx;
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const result = await initiateAblinerPayment({ phone, amount: tzsAmount });
    if (!result.success || !result.reference) {
      res.status(500).json({ error: result.message || "Failed to initiate payment" });
      return;
    }
    await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount: totalTx,
      ksAmount: tzsAmount,
      paystackRef: result.reference,
      status: "pending",
      paystackCountry: "tanzania",
    });
    res.json({ reference: result.reference });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/tanzania-status/:reference", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const reference = getParam(req.params.reference);
    const result = await getAblinerPaymentStatus(reference);
    if (!result.success) { res.json({ status: "pending" }); return; }
    if (result.status === "SUCCESS") {
      const tx = await Transaction.findOne({ paystackRef: reference, userId: req.user!._id });
      if (tx && tx.status === "pending") {
        tx.status = "success";
        await tx.save();
        const user = await User.findById(req.user!._id);
        if (user) {
          user.txCoins += tx.txAmount;
          await user.save();
          notifyOwner(`💰 *Tanzania Payment Received*\n\nUser: \`${user.email}\`\nAmount: ${tx.txAmount} TX (TZS ${tx.ksAmount})\nRef: \`${reference}\``).catch(() => {});
          createNotification(user._id, "topup", "Top up successful", `You topped up ${tx.txAmount} TX (TZS ${tx.ksAmount}).`).catch(() => {});
        }
        res.json({ status: "success", txAmount: tx.txAmount });
        return;
      }
      if (tx && tx.status === "success") { res.json({ status: "success", txAmount: tx.txAmount }); return; }
    }
    if (result.status === "FAILED") {
      const tx = await Transaction.findOne({ paystackRef: reference, userId: req.user!._id });
      if (tx && tx.status === "pending") {
        tx.status = "failed";
        await tx.save();
      }
      res.json({ status: "failed" });
      return;
    }
    res.json({ status: "pending" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/notify-paypal-proof", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      senderEmail: z.string().email(),
      txAmount: z.number().min(1).max(10000),
      paypalTransactionId: z.string().min(1).max(100),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" }); return; }
    const { senderEmail, txAmount, paypalTransactionId } = parsed.data;
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    notifyOwner(
      `💳 *PayPal Payment Proof Submitted*\n\nUser: \`${user.email}\`\nPayPal Sender: \`${senderEmail}\`\nTX Expected: *${txAmount} TX*\nPayPal Tx ID: \`${paypalTransactionId}\`\n\n⚠️ Verify on PayPal then credit TX manually.`
    ).catch(() => {});
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export async function ablinerWebhookHandler(req: Request, res: Response): Promise<void> {
  try {
    const raw = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!verifyAblinerWebhook(raw, req.headers as Record<string, unknown>)) { res.status(401).json({ error: "Invalid signature" }); return; }

    const body = (req.body || {}) as { event?: string; data?: { reference?: string; customer_reference?: string; status?: string; type?: string } };
    const event = String(body.event || "");
    const d = body.data || {};
    const refs = [d.customer_reference, d.reference].filter((r): r is string => !!r);
    if (!refs.length || !["transaction.completed", "transaction.failed"].includes(event) || (d.type && d.type !== "deposit")) { res.json({ received: true }); return; }
    const completed = event === "transaction.completed";

    // 1) TX top-up
    const tx = await Transaction.findOne({ paystackRef: { $in: refs }, paystackCountry: "tanzania" });
    if (tx) {
      if (tx.status === "pending") {
        if (completed) {
          tx.status = "success";
          await tx.save();
          const user = await User.findById(tx.userId);
          if (user) {
            user.txCoins += tx.txAmount;
            await user.save();
            notifyOwner(`💰 *Tanzania Payment Confirmed (Webhook)*\n\nUser: \`${user.email}\`\nAmount: ${tx.txAmount} TX (TZS ${tx.ksAmount})\nRef: \`${tx.paystackRef}\``).catch(() => {});
            createNotification(user._id, "topup", "Top up successful", `You topped up ${tx.txAmount} TX (TZS ${tx.ksAmount}).`).catch(() => {});
          }
        } else {
          tx.status = "failed";
          await tx.save();
        }
      }
      res.json({ received: true });
      return;
    }

    // 2) Social-boost order paid with Tanzania mobile money
    const order = await BoostOrder.findOne({ paymentRef: { $in: refs }, paymentGateway: "tanzania" });
    if (order && order.status === "awaiting_payment") {
      if (completed) await fulfillPaidBoostOrder(String(order._id));
      else { order.status = "failed"; await order.save(); }
    }
    res.json({ received: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

export default router;
