import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { Transaction } from "../models/Transaction.js";
import { BoostOrder } from "../models/BoostOrder.js";
import type { AuthRequest } from "../middleware/auth.js";
import { sessionOrApiKeyGuard } from "../middleware/sessionOrApiKey.js";
import { banCheck } from "../middleware/banCheck.js";
import { paymentRateLimit } from "../middleware/rateLimit.js";
import { createNotification } from "../services/notifications.js";
import { placeProviderOrder, getProviderOrderStatus } from "../services/boostProvider.js";
import { listCachedServices, getCachedServiceById, listCachedCategories, ensureBoostCatalogueSynced, getCatalogueMeta, syncBoostCatalogue } from "../services/boostCatalogSync.js";
import { normalizeBoostStatus, countsAsCompleted } from "../utils/boostStatus.js";
import { convertFromKes, isValidCurrency } from "../utils/currency.js";
import { sellPriceKesPer1000 } from "../utils/boostPricing.js";
import { chargeMobileMoney, getChargeStatus, normalizePhone, initializeTransaction, verifyTransaction } from "../services/paystack.js";
import { isTanzaniaAvailable, initiateAblinerPayment, getAblinerPaymentStatus } from "../services/abliner.js";
import { fulfillPaidBoostOrder } from "../services/boostFulfillment.js";
import { notifyOwner } from "../services/notify.js";
import { isAdminEmail } from "../config.js";

const router = Router();

const TX_RATE_KES = 5;

function getParam(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

router.get("/services", sessionOrApiKeyGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    await ensureBoostCatalogueSynced();
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const currencyParam = typeof req.query.currency === "string" ? req.query.currency.toUpperCase() : "KES";
    const currency = isValidCurrency(currencyParam) ? currencyParam : "KES";

    let services = await listCachedServices(q, category);
    if (!services.length) {
      await ensureBoostCatalogueSynced();
      services = await listCachedServices(q, category);
    }
    const mapped = services.map(s => {
      const sellKesPer1000 = sellPriceKesPer1000(s.baseKesPer1000);
      return {
        id: s.providerId,
        name: s.name,
        category: s.category,
        pricePer1000: Math.round(convertFromKes(sellKesPer1000, currency) * 100) / 100,
        pricePer1000Kes: sellKesPer1000,
        currency,
        min: s.min,
        max: s.max,
        platformId: s.platformId,
        serviceType: s.serviceType,
        isRegionVariant: s.isRegionVariant,
      };
    });
    mapped.sort((a, b) => a.pricePer1000 - b.pricePer1000);
    const meta = getCatalogueMeta();
    res.json({ services: mapped, currency, catalogueCount: meta.count, catalogueUpdatedAt: meta.updatedAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load services";
    res.status(502).json({ error: msg });
  }
});

router.get("/categories", sessionOrApiKeyGuard, banCheck, async (_req, res) => {
  try {
    await ensureBoostCatalogueSynced();
    const categories = (await listCachedCategories()).sort();
    res.json(categories);
  } catch {
    res.status(502).json({ error: "Failed to load categories" });
  }
});

const orderSchema = z.object({
  serviceId: z.number(),
  link: z.string().url(),
  quantity: z.number().positive(),
});

router.post("/order", sessionOrApiKeyGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" }); return; }
    const { serviceId, link, quantity } = parsed.data;

    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (!user.isModerator && !isAdminEmail(user.email) && !req.viaApiKey) {
      res.status(403).json({ error: "Balance payment isn't available for boosting on the website. Use /boost/order/prepare to pay directly.", code: "TX_NOT_ALLOWED" });
      return;
    }

    const service = await getCachedServiceById(serviceId);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }
    if (quantity < service.min || quantity > service.max) {
      res.status(400).json({ error: `Quantity must be between ${service.min} and ${service.max}` });
      return;
    }

    const sellKesPer1000 = sellPriceKesPer1000(service.baseKesPer1000);
    const costKes = Math.round((sellKesPer1000 / 1000) * quantity * 100) / 100;
    const costTx = Math.max(1, Math.ceil(costKes / TX_RATE_KES));

    if (user.txCoins < costTx) {
      res.status(402).json({
        error: `Insufficient balance. Top up at /topup then retry.`,
        code: "INSUFFICIENT_COINS",
        requiredTx: costTx,
        balanceTx: user.txCoins,
        shortfallTx: costTx - user.txCoins,
      });
      return;
    }

    user.txCoins -= costTx;
    await user.save();

    const order = await BoostOrder.create({
      userId: user._id,
      serviceName: service.name,
      category: service.category,
      link,
      quantity,
      costKes,
      costTx,
      paymentMethod: "tx",
      providerServiceId: service.providerId,
      providerCode: service.provider,
      status: "pending",
    });

    try {
      const result = await placeProviderOrder({
        service_id: service.providerId,
        provider: service.provider,
        link,
        quantity,
      });
      order.providerOrderId = String(result.order_id);
      order.status = (result.status as typeof order.status) || "pending";
      await order.save();

      await Transaction.create({ userId: user._id, type: "boost", txAmount: costTx, ksAmount: costKes, status: "success" });
      await createNotification(user._id, "boost", "Boost order placed", `Your order for ${quantity} ${service.name} is now ${order.status}.`);
      notifyOwner(
        `📈 *Boost Order (TX)*\n\n` +
        `Order: \`${order._id}\`\n` +
        `User: \`${user.email}\` (@${user.username || "n/a"})\n` +
        `Service: \`${service.name}\`\n` +
        `Category: ${service.category}\n` +
        `Qty: ${quantity}\n` +
        `Link: ${link}\n` +
        `Cost: ${costTx} TX (KES ${costKes})\n` +
        `Provider order: \`${order.providerOrderId || "n/a"}\`\n` +
        `Status: ${order.status}\n` +
        `Method: TX${req.viaApiKey ? " (API)" : ""}`
      ).catch(() => {});

      res.json({ ok: true, order: { id: order._id, status: order.status, costTx, costKes, requiredTx: costTx, balanceLeft: user.txCoins } });
    } catch (providerErr) {
      user.txCoins += costTx;
      await user.save();
      order.status = "refunded";
      await order.save();
      await createNotification(user._id, "refund", "Boost order failed", `Your order for ${service.name} couldn't be placed and the amount was refunded to your balance.`);
      const msg = providerErr instanceof Error ? providerErr.message : "Order failed";
      res.status(502).json({ error: msg });
    }
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/order/prepare", sessionOrApiKeyGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const parsed = orderSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" }); return; }
    const { serviceId, link, quantity } = parsed.data;

    const service = await getCachedServiceById(serviceId);
    if (!service) { res.status(404).json({ error: "Service not found" }); return; }
    if (quantity < service.min || quantity > service.max) {
      res.status(400).json({ error: `Quantity must be between ${service.min} and ${service.max}` });
      return;
    }

    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const sellKesPer1000 = sellPriceKesPer1000(service.baseKesPer1000);
    const costKes = Math.round((sellKesPer1000 / 1000) * quantity * 100) / 100;

    const order = await BoostOrder.create({
      userId: user._id,
      serviceName: service.name,
      category: service.category,
      link,
      quantity,
      costKes,
      costTx: Math.max(1, Math.ceil(costKes / TX_RATE_KES)),
      paymentMethod: "direct",
      providerServiceId: service.providerId,
      providerCode: service.provider,
      status: "awaiting_payment",
    });

    res.json({ boostOrderId: order._id, costKes, serviceName: service.name });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

async function loadAwaitingOrder(userId: string, boostOrderId: string) {
  const order = await BoostOrder.findOne({ _id: boostOrderId, userId });
  if (!order || order.status !== "awaiting_payment") return null;
  return order;
}

router.post("/order/pay/mpesa", sessionOrApiKeyGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      boostOrderId: z.string(),
      phone: z.string().min(9),
      provider: z.enum(["mpesa", "airtel"]).default("mpesa"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { boostOrderId, phone, provider } = parsed.data;

    const order = await loadAwaitingOrder(String(req.user!._id), boostOrderId);
    if (!order) { res.status(404).json({ error: "Order not found or already paid" }); return; }

    const user = await User.findById(req.user!._id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const reference = `BOOST_${Date.now()}_${user._id.toString().slice(-6)}`;
    const paystackProvider: "mpesa" | "atl" = provider === "airtel" ? "atl" : "mpesa";
    const charge = await chargeMobileMoney({
      email: user.email,
      amountKes: Math.round(order.costKes * 100),
      phone: normalizePhone(phone),
      provider: paystackProvider,
      reference,
    });

    order.paymentGateway = "mpesa";
    order.paymentRef = charge.reference;
    await order.save();

    res.json({ reference: charge.reference, message: charge.display_text ?? "Check your phone for the payment prompt." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Charge failed";
    res.status(400).json({ error: message });
  }
});

router.get("/order/pay/mpesa/status/:reference", sessionOrApiKeyGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const reference = getParam(req.params.reference);
    const order = await BoostOrder.findOne({ userId: req.user!._id, paymentRef: reference, paymentGateway: "mpesa" });
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.status !== "awaiting_payment") { res.json({ status: order.status }); return; }

    const status = await getChargeStatus(reference);
    if (status === "success") {
      await fulfillPaidBoostOrder(String(order._id));
      const fresh = await BoostOrder.findById(order._id);
      res.json({ status: fresh?.status || "pending" });
      return;
    }
    if (status === "failed" || status === "abandoned") {
      order.status = "failed";
      await order.save();
      res.json({ status: "failed" });
      return;
    }
    res.json({ status: "awaiting_payment" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/order/pay/tanzania", sessionOrApiKeyGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    if (!isTanzaniaAvailable()) { res.status(503).json({ error: "Tanzania payments are not available." }); return; }
    const schema = z.object({
      boostOrderId: z.string(),
      phone: z.string().min(8).max(16),
      amount: z.number().positive(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { boostOrderId, phone, amount } = parsed.data;

    const order = await loadAwaitingOrder(String(req.user!._id), boostOrderId);
    if (!order) { res.status(404).json({ error: "Order not found or already paid" }); return; }

    const result = await initiateAblinerPayment({ phone, amount });
    if (!result.success || !result.reference) {
      res.status(500).json({ error: result.message || "Failed to initiate payment" });
      return;
    }

    order.paymentGateway = "tanzania";
    order.paymentRef = result.reference;
    await order.save();

    res.json({ reference: result.reference });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/order/pay/tanzania/status/:reference", sessionOrApiKeyGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const reference = getParam(req.params.reference);
    const order = await BoostOrder.findOne({ userId: req.user!._id, paymentRef: reference, paymentGateway: "tanzania" });
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.status !== "awaiting_payment") { res.json({ status: order.status }); return; }

    const result = await getAblinerPaymentStatus(reference);
    if (!result.success) { res.json({ status: "awaiting_payment" }); return; }
    if (result.status === "SUCCESS") {
      await fulfillPaidBoostOrder(String(order._id));
      const fresh = await BoostOrder.findById(order._id);
      res.json({ status: fresh?.status || "pending" });
      return;
    }
    if (result.status === "FAILED") {
      order.status = "failed";
      await order.save();
      res.json({ status: "failed" });
      return;
    }
    res.json({ status: "awaiting_payment" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/order/pay/card", sessionOrApiKeyGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ boostOrderId: z.string(), email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { boostOrderId, email } = parsed.data;

    const order = await loadAwaitingOrder(String(req.user!._id), boostOrderId);
    if (!order) { res.status(404).json({ error: "Order not found or already paid" }); return; }

    const reference = `BOOSTCARD_${Date.now()}_${req.user!._id.toString().slice(-6)}`;
    order.paymentGateway = "card";
    order.paymentRef = reference;
    await order.save();

    res.json({ reference, email });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/order/pay/card/init", sessionOrApiKeyGuard, banCheck, paymentRateLimit, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ boostOrderId: z.string(), email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { boostOrderId, email } = parsed.data;

    const order = await loadAwaitingOrder(String(req.user!._id), boostOrderId);
    if (!order) { res.status(404).json({ error: "Order not found or already paid" }); return; }

    const reference = `BOOSTAPAY_${Date.now()}_${req.user!._id.toString().slice(-6)}`;
    const result = await initializeTransaction(email, order.costKes, reference, { boostOrderId: String(order._id) });
    if (!result.success || !result.accessCode) { res.status(500).json({ error: "Failed to initialize payment" }); return; }

    order.paymentGateway = "card";
    order.paymentRef = reference;
    await order.save();

    res.json({ accessCode: result.accessCode, reference });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/order/pay/card/verify", sessionOrApiKeyGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({ reference: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { reference } = parsed.data;

    const order = await BoostOrder.findOne({ userId: req.user!._id, paymentRef: reference, paymentGateway: "card" });
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (order.status !== "awaiting_payment") { res.json({ success: true, status: order.status }); return; }

    const result = await verifyTransaction(reference);
    if (!result.success) { res.json({ success: false }); return; }

    await fulfillPaidBoostOrder(String(order._id));
    const fresh = await BoostOrder.findById(order._id);
    res.json({ success: true, status: fresh?.status || "pending" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/orders", sessionOrApiKeyGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const orders = await BoostOrder.find({ userId: req.user!._id }).sort({ createdAt: -1 }).limit(200).lean();
    const stats = { total: orders.length, completed: 0, pending: 0, failed: 0, globalCompleted: 3 };
    for (const o of orders) {
      if (countsAsCompleted(o.status)) stats.completed++;
      else if (o.status === "failed" || o.status === "refunded") stats.failed++;
      else if (o.status !== "awaiting_payment") stats.pending++;
    }
    const realCompleted = await BoostOrder.countDocuments({ status: { $in: ["completed", "partial"] } }).maxTimeMS(3000).catch(() => 0);
    const realPlaced = await BoostOrder.countDocuments({ status: { $nin: ["awaiting_payment", "failed", "refunded"] } }).maxTimeMS(3000).catch(() => 0);
    stats.globalCompleted = 3 + Math.max(realCompleted, 0);
    if (stats.globalCompleted === 3 && realPlaced > 0) {
      stats.globalCompleted = 3 + realPlaced;
    }
    res.json({ orders, stats });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/orders/:id/refresh", sessionOrApiKeyGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const order = await BoostOrder.findOne({ _id: req.params.id, userId: req.user!._id });
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (!order.providerOrderId || ["completed", "failed", "refunded"].includes(order.status)) {
      res.json({ status: order.status });
      return;
    }
    const providerStatus = await getProviderOrderStatus(order.providerOrderId);
    if (providerStatus.status) {
      const mapped = normalizeBoostStatus(providerStatus.status, order.status as any);
      if (mapped !== order.status) {
        order.status = mapped;
        order.updatedAt = new Date();
        await order.save();
        if (order.status === "completed") {
          await createNotification(order.userId, "boost", "Boost order completed", `Your order for ${order.serviceName} is complete.`);
          notifyOwner(
            `✅ *Boost Order Completed*\n\n` +
            `Order: \`${order._id}\`\n` +
            `Service: \`${order.serviceName}\`\n` +
            `Qty: ${order.quantity}\n` +
            `Link: ${order.link}\n` +
            `Provider order: \`${order.providerOrderId || "n/a"}\``
          ).catch(() => {});
        }
      }
    }
    res.json({ status: order.status });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
