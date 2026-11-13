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
  isCameroonAvailable,
  initiateFapshiDirectPay,
  initiateFapshiPayment,
  getFapshiPaymentStatus,
} from "../services/fapshi.js";
import {
  isTanzaniaAvailable,
  initiateSpeedPesaPayment,
  getSpeedPesaPaymentStatus,
} from "../services/speedpesa.js";
import {
  isDRCAvailable,
  initiateWonyaPayment,
  getWonyaPaymentStatus,
  normalizeDRCPhone,
  isWonyaCallbackSuccess,
  type WonyaCallbackPayload,
} from "../services/wonyapay.js";
import { notifyOwner } from "../services/notify.js";
import { createNotification } from "../services/notifications.js";

const router = Router();
const MAX_DAILY_FAILURES = 5;
const TX_RATE_KES = 5;

function isSouthAfricaAvailable(): boolean {
  return !!(process.env.PAYSTACK_SA_SECRET_KEY && process.env.PAYSTACK_SA_PUBLIC_KEY);
}

function isGhanaAvailable(): boolean {
  return !!(process.env.PAYSTACK_GHANA_SECRET_KEY && process.env.PAYSTACK_GHANA_PUBLIC_KEY);
}

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
    cameroonAvailable: isCameroonAvailable(),
    southAfricaAvailable: isSouthAfricaAvailable(),
    ghanaAvailable: isGhanaAvailable(),
    tanzaniaAvailable: isTanzaniaAvailable(),
    drcAvailable: isDRCAvailable(),
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

function normalizeCameroonPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("237")) digits = digits.slice(3);
  else if (digits.startsWith("0") && digits.length === 10) digits = digits.slice(1);
  if (/^6\d{8}$/.test(digits)) return digits;
  return null;
}

router.post("/initiate-cameroon", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    if (!isCameroonAvailable()) { res.status(503).json({ error: "Cameroon payments are not available." }); return; }
    const schema = z.object({
      xafAmount: z.number().min(100),
      txAmount: z.number().min(1),
      bonusTx: z.number().min(0).default(0),
      phone: z.string().min(8).max(16),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" }); return; }
    const { xafAmount, txAmount, bonusTx } = parsed.data;
    const phone = normalizeCameroonPhone(parsed.data.phone);
    if (!phone) { res.status(400).json({ error: "Enter a valid Cameroon mobile number (e.g. 6XXXXXXXX)" }); return; }
    const totalTx = txAmount + bonusTx;
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const externalId = `TXCM_${Date.now()}_${user._id.toString().slice(-6)}`;
    const displayName = user.username || user.email.split("@")[0];
    const directResult = await initiateFapshiDirectPay({
      amount: xafAmount,
      phone,
      name: displayName,
      email: user.email,
      externalId,
      message: `Bmb Tech Hosting: ${totalTx} TX top-up`
    });
    if (directResult.success && directResult.transId) {
      const tx = await Transaction.create({
        userId: user._id,
        type: "topup",
        txAmount: totalTx,
        ksAmount: xafAmount,
        paystackRef: directResult.transId,
        status: "pending",
        paystackCountry: "cameroon",
      });
      res.json({ transId: directResult.transId, reference: tx.paystackRef });
      return;
    }
    if (!directResult.directPayUnavailable) {
      res.status(500).json({ error: directResult.message || "Failed to initiate payment" });
      return;
    }
    const hostedResult = await initiateFapshiPayment({
      amount: xafAmount,
      externalId,
      message: `Bmb Tech Hosting: ${totalTx} TX top-up`
    });
    if (!hostedResult.success || !hostedResult.transId || !hostedResult.paymentUrl) {
      res.status(500).json({ error: hostedResult.message || "Failed to initiate payment" });
      return;
    }
    const tx = await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount: totalTx,
      ksAmount: xafAmount,
      paystackRef: hostedResult.transId,
      status: "pending",
      paystackCountry: "cameroon",
    });
    res.json({ transId: hostedResult.transId, reference: tx.paystackRef, paymentUrl: hostedResult.paymentUrl });
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
    const result = await initiateSpeedPesaPayment({ phonenumber: phone, amount: tzsAmount });
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
    const result = await getSpeedPesaPaymentStatus(reference);
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

export async function speedpesaWebhookHandler(req: Request, res: Response): Promise<void> {
  try {
    const secret = (process.env.SPEEDPESA_WEBHOOK_SECRET || "").trim();
    if (secret) {
      const sig = String(req.headers["x-speedpesa-signature"] || req.headers["x-webhook-secret"] || "");
      if (sig !== secret) { res.status(403).json({ error: "Forbidden" }); return; }
    }
    const body = (req.body || {}) as Record<string, unknown>;
    const reference = String(body.reference || body.our_reference || "");
    const status = String(body.status || "").toLowerCase();
    const isPayin = !body.event || body.event === "PAYIN";
    if (!reference || !isPayin) { res.json({ received: true }); return; }

    const tx = await Transaction.findOne({ paystackRef: reference, paystackCountry: "tanzania" });
    if (!tx || tx.status !== "pending") { res.json({ received: true }); return; }

    if (["success", "completed", "paid"].includes(status)) {
      tx.status = "success";
      await tx.save();
      const user = await User.findById(tx.userId);
      if (user) {
        user.txCoins += tx.txAmount;
        await user.save();
        notifyOwner(`💰 *Tanzania Payment Confirmed (Webhook)*\n\nUser: \`${user.email}\`\nAmount: ${tx.txAmount} TX (TZS ${tx.ksAmount})\nRef: \`${reference}\``).catch(() => {});
        createNotification(user._id, "topup", "Top up successful", `You topped up ${tx.txAmount} TX (TZS ${tx.ksAmount}).`).catch(() => {});
      }
    } else if (["failed", "cancelled", "canceled", "rejected", "expired"].includes(status)) {
      tx.status = "failed";
      await tx.save();
    }
    res.json({ received: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
}

router.post("/initiate-drc", authGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    if (!isDRCAvailable()) { res.status(503).json({ error: "DR Congo payments are not available." }); return; }
    const schema = z.object({
      amount: z.number().positive(),
      currency: z.enum(["CDF", "USD"]).default("USD"),
      txAmount: z.number().min(1),
      bonusTx: z.number().min(0).default(0),
      phone: z.string().min(8).max(16),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" }); return; }
    const { amount, currency, txAmount, bonusTx } = parsed.data;
    const phone = normalizeDRCPhone(parsed.data.phone);
    if (!phone) { res.status(400).json({ error: "Enter a valid DR Congo mobile number (e.g. 0997654321)" }); return; }
    const totalTx = txAmount + bonusTx;
    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const result = await initiateWonyaPayment({ amount, currency, phone, reason: `Bmb Tech Hosting: ${totalTx} TX top-up` });
    if (!result.success || !result.refTransa) {
      res.status(500).json({ error: result.message || "Failed to initiate payment" });
      return;
    }

    await Transaction.create({
      userId: user._id,
      type: "topup",
      txAmount: totalTx,
      ksAmount: amount,
      paystackRef: result.refTransa,
      status: "pending",
      paystackCountry: "drc",
    });

    res.json({ refTransa: result.refTransa });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/drc-status/:refTransa", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const refTransa = getParam(req.params.refTransa);
    const result = await getWonyaPaymentStatus(refTransa);
    if (!result.success) { res.json({ status: "pending" }); return; }
    if (result.status === "completed") {
      const tx = await Transaction.findOne({ paystackRef: refTransa, userId: req.user!._id });
      if (tx && tx.status === "pending") {
        tx.status = "success";
        await tx.save();
        const user = await User.findById(req.user!._id);
        if (user) {
          user.txCoins += tx.txAmount;
          await user.save();
          notifyOwner(`💰 *DRC Payment Received*\n\nUser: \`${user.email}\`\nAmount: ${tx.txAmount} TX (${tx.ksAmount})\nRef: \`${refTransa}\``).catch(() => {});
          createNotification(user._id, "topup", "Top up successful", `You topped up ${tx.txAmount} TX.`).catch(() => {});
        }
        res.json({ status: "success", txAmount: tx.txAmount });
        return;
      }
      if (tx && tx.status === "success") { res.json({ status: "success", txAmount: tx.txAmount }); return; }
    }
    if (result.status === "failed") {
      const tx = await Transaction.findOne({ paystackRef: refTransa, userId: req.user!._id });
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

export async function wonyaWebhookHandler(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as WonyaCallbackPayload;
    const refTransa = body.RefTransa;
    if (refTransa && isWonyaCallbackSuccess(body)) {
      const tx = await Transaction.findOne({ paystackRef: refTransa, paystackCountry: "drc" });
      if (tx && tx.status === "pending") {
        tx.status = "success";
        await tx.save();
        const user = await User.findById(tx.userId);
        if (user) {
          user.txCoins += tx.txAmount;
          await user.save();
          notifyOwner(`💰 *DRC Payment Confirmed (Webhook)*\n\nUser: \`${user.email}\`\nAmount: ${tx.txAmount} TX\nRef: \`${refTransa}\``).catch(() => {});
          createNotification(user._id, "topup", "Top up successful", `You topped up ${tx.txAmount} TX.`).catch(() => {});
        }
      }
    }
    res.status(200).json({ received: true });
  } catch {
    res.status(200).json({ received: true });
  }
}

router.get("/cameroon-status/:transId", authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const transId = getParam(req.params.transId);
    const result = await getFapshiPaymentStatus(transId);
    if (!result.success) { res.json({ status: "pending" }); return; }
    if (result.status === "SUCCESSFUL") {
      const tx = await Transaction.findOne({ paystackRef: transId, userId: req.user!._id });
      if (tx && tx.status === "pending") {
        tx.status = "success";
        await tx.save();
        const user = await User.findById(req.user!._id);
        if (user) {
          user.txCoins += tx.txAmount;
          await user.save();
          notifyOwner(`💰 *Cameroon Payment Received*\n\nUser: \`${user.email}\`\nAmount: ${tx.txAmount} TX (XAF ${tx.ksAmount})\nRef: \`${transId}\``).catch(() => {});
          createNotification(user._id, "topup", "Top up successful", `You topped up ${tx.txAmount} TX (XAF ${tx.ksAmount}).`).catch(() => {});
        }
        res.json({ status: "success", txAmount: tx.txAmount });
        return;
      }
      if (tx && tx.status === "success") { res.json({ status: "success", txAmount: tx.txAmount }); return; }
    }
    if (result.status === "FAILED" || result.status === "EXPIRED") {
      const tx = await Transaction.findOne({ paystackRef: transId, userId: req.user!._id });
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

export default router;
