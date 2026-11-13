import { BoostOrder } from "../models/BoostOrder.js";
import { User } from "../models/User.js";
import { placeProviderOrder } from "./boostProvider.js";
import { normalizeBoostStatus } from "../utils/boostStatus.js";
import { syncBoostCatalogue, listCachedServices } from "./boostCatalogSync.js";
import { createNotification } from "./notifications.js";
import { notifyOwner } from "./notify.js";

async function resolveServiceIds(order: { providerServiceId: number; providerCode: string; serviceName: string }): Promise<{ service_id: number; provider: string }> {
  let serviceId = order.providerServiceId;
  let provider = order.providerCode;
  try {
    const cached = await listCachedServices();
    const byId = cached.find(s => s.providerId === serviceId);
    if (byId) {
      return { service_id: byId.providerId, provider: byId.provider || provider };
    }
    const name = (order.serviceName || "").toLowerCase().trim();
    if (name) {
      const byName = cached.find(s => s.name.toLowerCase().trim() === name)
        || cached.find(s => s.name.toLowerCase().includes(name) || name.includes(s.name.toLowerCase()));
      if (byName) {
        return { service_id: byName.providerId, provider: byName.provider || provider };
      }
    }
  } catch {}
  return { service_id: serviceId, provider };
}

export async function fulfillPaidBoostOrder(boostOrderId: string): Promise<void> {
  const order = await BoostOrder.findById(boostOrderId);
  if (!order || order.status !== "awaiting_payment") return;

  try {
    let ids = await resolveServiceIds(order);
    let result;
    try {
      result = await placeProviderOrder({
        service_id: ids.service_id,
        provider: ids.provider,
        link: order.link,
        quantity: order.quantity,
      });
    } catch (firstErr) {
      const msg = firstErr instanceof Error ? firstErr.message : "";
      if (/not found|not priced|invalid service|unknown service/i.test(msg)) {
        await syncBoostCatalogue().catch(() => {});
        ids = await resolveServiceIds(order);
        order.providerServiceId = ids.service_id;
        order.providerCode = ids.provider;
        result = await placeProviderOrder({
          service_id: ids.service_id,
          provider: ids.provider,
          link: order.link,
          quantity: order.quantity,
        });
      } else {
        throw firstErr;
      }
    }

    order.providerOrderId = String(result.order_id);
    order.providerServiceId = ids.service_id;
    order.providerCode = ids.provider;
    order.status = normalizeBoostStatus(result.status, "pending");
    order.updatedAt = new Date();
    await order.save();

    await createNotification(order.userId, "boost", "Boost order placed", `Your order for ${order.quantity} ${order.serviceName} is now ${order.status}.`);
    const owner = await User.findById(order.userId).select("email username").lean().catch(() => null);
    notifyOwner(
      `📈 *Boost Order Paid & Placed*\n\n` +
      `Order: \`${order._id}\`\n` +
      `User: \`${owner?.email || order.userId}\` (@${owner?.username || "n/a"})\n` +
      `Service: \`${order.serviceName}\`\n` +
      `Category: ${order.category || "n/a"}\n` +
      `Qty: ${order.quantity}\n` +
      `Link: ${order.link}\n` +
      `Amount: KES ${order.costKes}\n` +
      `Gateway: ${order.paymentGateway || "n/a"}\n` +
      `Payment ref: \`${order.paymentRef || "n/a"}\`\n` +
      `Provider order: \`${order.providerOrderId || "n/a"}\`\n` +
      `Status: ${order.status}`
    ).catch(() => {});
  } catch (err) {
    order.status = "failed";
    order.updatedAt = new Date();
    await order.save();
    const msg = err instanceof Error ? err.message : "Order failed";
    await createNotification(order.userId, "refund", "Boost order failed", `Your paid order for ${order.serviceName} couldn't be placed (${msg}). Contact support — this was a real-money payment, not TX, so it needs a manual refund.`);
    const owner = await User.findById(order.userId).select("email username").lean().catch(() => null);
    notifyOwner(
      `⚠️ *Paid boost order failed*\n\n` +
      `Order: \`${order._id}\`\n` +
      `User: \`${owner?.email || order.userId}\` (@${owner?.username || "n/a"})\n` +
      `Service: \`${order.serviceName}\`\n` +
      `Qty: ${order.quantity}\n` +
      `Link: ${order.link}\n` +
      `Amount: KES ${order.costKes}\n` +
      `Gateway: ${order.paymentGateway || "n/a"}\n` +
      `Reason: ${msg}\n` +
      `Needs manual refund.`
    ).catch(() => {});
  }
}
