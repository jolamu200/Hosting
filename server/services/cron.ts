import cron from "node-cron";
  import { Bot } from "../models/Bot.js";
  import { User } from "../models/User.js";
  import { Transaction } from "../models/Transaction.js";
  import { TrialCheck } from "../models/TrialCheck.js";
  import { deleteApp, getAppStatus, enableMaintenanceMode, disableMaintenanceMode, setConfigVar, appExists } from "./heroku.js";
  import { notifyOwner } from "./notify.js";
  import { createNotification } from "./notifications.js";
  import { sendBotExpiryEmail } from "./email.js";
  import { reconcileFailedBotRefunds } from "./botRefund.js";
  import { syncBoostCatalogue } from "./boostCatalogSync.js";
  import { BoostOrder } from "../models/BoostOrder.js";
  import { getProviderOrderStatus } from "./boostProvider.js";
  import { normalizeBoostStatus } from "../utils/boostStatus.js";

  const GRACE_PERIOD_MS = 2 * 24 * 60 * 60 * 1000;

  export function startCronJobs(): void {
    cron.schedule("0 * * * *", async () => {
      try {
        const now = new Date();

        const expiredTrials = await Bot.find({
          isTrial: true,
          expiresAt: { $lte: now },
          status: { $nin: ["deleted"] }
        });
        for (const bot of expiredTrials) {
          try { await deleteApp(bot.herokuAppName); } catch {}
          bot.status = "deleted";
          await bot.save();
          await TrialCheck.findOneAndUpdate({ phoneNumber: bot.phoneNumber }, { status: "trial_ended" });
          try {
            const owner = await User.findById(bot.userId);
            notifyOwner(`⏰ *Trial Ended*\n\nUser: \`${owner?.email ?? bot.userId}\`\nApp: \`${bot.herokuAppName}\`\nPhone: \`${bot.phoneNumber}\``).catch(() => {});
            createNotification(bot.userId, "deleted", "Free trial ended", `Your free trial bot "${bot.herokuAppName}" has expired and been removed.`).catch(() => {});
          } catch {}
        }

        const justExpired = await Bot.find({
          isTrial: false,
          expiresAt: { $lte: now },
          status: { $in: ["running", "stopped", "building"] },
          gracePeriodEnd: null
        });
        for (const bot of justExpired) {
          try {
            await setConfigVar(bot.herokuAppName, "EXPIRY_NOTICE", "1");
            await new Promise(r => setTimeout(r, 8000));
            await enableMaintenanceMode(bot.herokuAppName);
          } catch {}
          bot.status = "expired";
          bot.gracePeriodEnd = new Date(now.getTime() + GRACE_PERIOD_MS);
          await bot.save();
          try {
            const owner = await User.findById(bot.userId);
            notifyOwner(`⌛ *Bot Days Ended*\n\nUser: \`${owner?.email ?? bot.userId}\`\nApp: \`${bot.herokuAppName}\`\nPhone: \`${bot.phoneNumber}\`\n48h grace period started.`).catch(() => {});
            createNotification(bot.userId, "expiring", "Bot subscription expired", `"${bot.herokuAppName}" has expired. Renew within 2 days or it will be permanently deleted.`).catch(() => {});
          } catch {}
        }

        const pastGrace = await Bot.find({
          isTrial: false,
          gracePeriodEnd: { $lte: now },
          status: "expired"
        });
        for (const bot of pastGrace) {
          try { await deleteApp(bot.herokuAppName); } catch {}
          bot.status = "deleted";
          bot.gracePeriodEnd = null;
          await bot.save();
          try {
            const owner = await User.findById(bot.userId);
            notifyOwner(`🗑️ *Bot Deleted*\n\nUser: \`${owner?.email ?? bot.userId}\`\nApp: \`${bot.herokuAppName}\`\nPhone: \`${bot.phoneNumber}\`\nReason: Expired — grace period ended.`).catch(() => {});
            createNotification(bot.userId, "deleted", "Bot permanently deleted", `"${bot.herokuAppName}" was not renewed in time and has been permanently deleted.`).catch(() => {});
          } catch {}
        }

        const staleCutoff = new Date(now.getTime() - 60 * 60 * 1000);
        await Transaction.updateMany(
          { status: "pending", createdAt: { $lt: staleCutoff } },
          { $set: { status: "failed" } }
        );

        const bannedCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        const expiredBanned = await User.find({ isBanned: true, bannedAt: { $lte: bannedCutoff, $ne: null } });
        for (const u of expiredBanned) {
          const userBots = await Bot.find({ userId: u._id, status: { $ne: "deleted" } });
          for (const b of userBots) {
            try { await deleteApp(b.herokuAppName); } catch {}
            b.status = "deleted";
            await b.save();
          }
          await User.findByIdAndDelete(u._id);
        }
      } catch {}
    });

    cron.schedule("*/15 * * * *", async () => {
      try {
        const cutoff = new Date(Date.now() - 30 * 60 * 1000);
        const stuckBots = await Bot.find({ status: "building", deployedAt: { $lt: cutoff } });
        for (const bot of stuckBots) {
          try {
            const exists = await appExists(bot.herokuAppName);
            await Bot.findByIdAndUpdate(bot._id, { status: exists ? "running" : "stopped" });
          } catch {}
        }
      } catch {}
    });

    cron.schedule("*/15 * * * *", async () => {
      await reconcileFailedBotRefunds();
    });

    cron.schedule("*/10 * * * *", async () => {
      try {
        const activeBots = await Bot.find({ status: { $in: ["running", "stopped"] } });
        for (const bot of activeBots) {
          const liveStatus = await getAppStatus(bot.herokuAppName);
          if (liveStatus === "unknown") continue;
          if (liveStatus === "deleted") {
            bot.status = "stopped";
            await bot.save();
            continue;
          }
          if (liveStatus === "stopped" && bot.status === "running") {
            bot.status = "stopped";
            await bot.save();
          } else if (liveStatus === "running" && bot.status === "stopped") {
            bot.status = "running";
            await bot.save();
          }
        }
      } catch {}
    });

    // Expiry warnings — runs daily at 1am
    cron.schedule("0 1 * * *", async () => {
      try {
        const now = new Date();

        // Warn paid bots expiring in 5 days (window: 4.5–5.5 days from now)
        const botWarnStart = new Date(now.getTime() + 4.5 * 24 * 60 * 60 * 1000);
        const botWarnEnd = new Date(now.getTime() + 5.5 * 24 * 60 * 60 * 1000);
        const soonBots = await Bot.find({
          isTrial: false,
          expiresAt: { $gte: botWarnStart, $lte: botWarnEnd },
          status: { $in: ["running", "stopped", "building"] }
        });
        for (const bot of soonBots) {
          try {
            const owner = await User.findById(bot.userId);
            if (!owner) continue;
            const daysLeft = Math.ceil((new Date(bot.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            createNotification(bot.userId, "expiring", "Bot expiring soon", `Your bot "${bot.herokuAppName}" expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}. Renew now to avoid interruption.`).catch(() => {});
            sendBotExpiryEmail(owner.email, bot.herokuAppName, daysLeft).catch(() => {});
          } catch {}
        }
      } catch {}
    });

    cron.schedule("0 */2 * * *", async () => {
      try {
        await syncBoostCatalogue();
      } catch {}
    });

    cron.schedule("*/20 * * * *", async () => {
      try {
        await syncBoostCatalogue();
      } catch {}
    });

    cron.schedule("*/12 * * * *", async () => {
      try {
        const open = await BoostOrder.find({
          status: { $in: ["pending", "processing", "partial"] },
          providerOrderId: { $ne: "" },
        }).sort({ updatedAt: 1 }).limit(40);
        for (const order of open) {
          try {
            const providerStatus = await getProviderOrderStatus(order.providerOrderId);
            if (!providerStatus?.status) continue;
            const mapped = normalizeBoostStatus(providerStatus.status, order.status as any);
            if (mapped !== order.status) {
              order.status = mapped;
              order.updatedAt = new Date();
              await order.save();
              if (mapped === "completed") {
                createNotification(order.userId, "boost", "Boost order completed", `Your order for ${order.serviceName} is complete.`).catch(() => {});
              }
            }
          } catch {}
        }
      } catch {}
    });

  }
