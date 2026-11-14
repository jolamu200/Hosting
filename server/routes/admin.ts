import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Bot } from "../models/Bot.js";
import { Transaction } from "../models/Transaction.js";
import { Coupon } from "../models/Coupon.js";
import { Referral } from "../models/Referral.js";
import { Team } from "../models/Team.js";
import { Tutorial } from "../models/Tutorial.js";
import { BlockedTrial } from "../models/BlockedTrial.js";
import { IPRecord } from "../models/IPRecord.js";
import { TrialCheck } from "../models/TrialCheck.js";
import { BotTemplate } from "../models/BotTemplate.js";
import { BroadcastNotification } from "../models/BroadcastNotification.js";
import { BoostOrder } from "../models/BoostOrder.js";
import { syncBoostCatalogue, clearBoostCatalogue, getCatalogueMeta } from "../services/boostCatalogSync.js";
import { BoostServiceCache } from "../models/BoostServiceCache.js";
import { deleteApp, enableMaintenanceMode, disableMaintenanceMode, restartApp, getTeamAppCount, getTeamApps, stopApp, startApp } from "../services/heroku.js";
import type { Request, Response, NextFunction } from "express";
import type { IUser } from "../models/User.js";
import { ADMIN_EMAIL, DEFAULT_HEROKU_TEAM } from "../config.js";

const TEAM_MAX_APPS = 100;
const router = Router();

const KES_PER_USD = 130;
const NGN_PER_USD = 1500;
const XAF_PER_USD = 600;
const TZS_PER_USD = 2600;

interface AdminRequest extends Request {
  user?: IUser;
}

async function adminAuth(req: AdminRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace("Bearer ", "");
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as { userId: string };
    const user = await User.findById(decoded.userId).lean();
    if (!user || user.email !== ADMIN_EMAIL) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    req.user = user as unknown as IUser;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

router.use(adminAuth);

router.get("/stats", async (_req, res) => {
  try {
    const [allUsers, allBots, allTx, allCoupons, allReferrals] = await Promise.all([
      User.find({}).lean(),
      Bot.find({}).lean(),
      Transaction.find({ status: "success" }).lean(),
      Coupon.find({}).lean(),
      Referral.find({}).lean()
    ]);
    const nonAdminUsers = allUsers.filter(u => u.email !== ADMIN_EMAIL);
    const totalTxInCirculation = nonAdminUsers.reduce((s, u) => s + (u.txCoins || 0), 0);
    const revenueTx = allTx.filter(t => t.type !== "admin_grant");
    const totalRevenue = revenueTx.reduce((s, t) => s + (t.ksAmount || 0), 0);
    res.json({
      totalUsers: nonAdminUsers.length,
      totalBots: allBots.length,
      activeBots: allBots.filter(b => b.status === "running").length,
      totalRevenue,
      totalTxInCirculation,
      totalTransactions: allTx.length,
      totalCoupons: allCoupons.length,
      claimedCoupons: allCoupons.filter(c => c.claimedBy).length,
      totalReferrals: allReferrals.length
    });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.get("/revenue", async (_req, res) => {
  try {
    const allTx = await Transaction.find({ status: "success", type: { $ne: "admin_grant" } }).lean();
    const byCountry: Record<string, { amount: number; count: number }> = {};
    for (const tx of allTx) {
      const country = (tx.paystackCountry as string) || "kenya";
      if (!byCountry[country]) byCountry[country] = { amount: 0, count: 0 };
      byCountry[country].amount += tx.ksAmount || 0;
      byCountry[country].count += 1;
    }
    const kenyaKes = byCountry["kenya"]?.amount || 0;
    const nigeriaNgn = byCountry["nigeria"]?.amount || 0;
    const nigeriaKes = nigeriaNgn * (KES_PER_USD / NGN_PER_USD);
    const tanzaniaTzs = byCountry["tanzania"]?.amount || 0;
    const tanzaniaKes = tanzaniaTzs * (KES_PER_USD / TZS_PER_USD);
    const totalKes = kenyaKes + nigeriaKes + tanzaniaKes;
    const totalUsd = totalKes / KES_PER_USD;
    res.json({
      countries: [
        {
          name: "Kenya",
          flag: "🇰🇪",
          currency: "KES",
          amount: kenyaKes,
          amountKes: kenyaKes,
          amountUsd: kenyaKes / KES_PER_USD,
          count: byCountry["kenya"]?.count || 0
        },
        {
          name: "Nigeria",
          flag: "🇳🇬",
          currency: "NGN",
          amount: nigeriaNgn,
          amountKes: nigeriaKes,
          amountUsd: nigeriaNgn / NGN_PER_USD,
          count: byCountry["nigeria"]?.count || 0
        },
          {
            name: "Tanzania",
            flag: "🇹🇿",
            currency: "TZS",
            amount: tanzaniaTzs,
            amountKes: tanzaniaKes,
            amountUsd: tanzaniaTzs / TZS_PER_USD,
            count: byCountry["tanzania"]?.count || 0
          }
        ],
      totalKes,
      totalUsd
    });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.get("/broadcast-notifications", async (_req, res) => {
  try {
    const notifications = await BroadcastNotification.find({}).sort({ createdAt: -1 }).lean();
    res.json(notifications);
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/broadcast-notifications", async (req, res) => {
  try {
    const { title, message, type } = req.body || {};
    if (!title || !message) { res.status(400).json({ error: "Title and message are required" }); return; }
    const notification = await BroadcastNotification.create({
      title,
      message,
      type: type || "general"
    });
    res.json({ ok: true, notification });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.delete("/broadcast-notifications/:id", async (req, res) => {
  try {
    await BroadcastNotification.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.get("/users", async (_req, res) => {
  try {
    const users = await User.find({ email: { $ne: ADMIN_EMAIL } }).lean();
    const bots = await Bot.find({}).lean();
    const botCountMap: Record<string, number> = {};
    for (const b of bots) { const id = b.userId?.toString(); if (id) botCountMap[id] = (botCountMap[id] || 0) + 1; }
    res.json(users.map(u => ({
      _id: u._id,
      email: u.email,
      username: u.username || "",
      txCoins: u.txCoins,
      botCount: botCountMap[u._id.toString()] || 0,
      isBanned: (u as unknown as { isBanned?: boolean }).isBanned || false,
      banReason: (u as unknown as { banReason?: string }).banReason || "",
      createdAt: (u as unknown as { createdAt?: Date }).createdAt,
      usedFreeTrial: (u as unknown as { usedFreeTrial?: boolean }).usedFreeTrial || false,
      referralCode: (u as unknown as { referralCode?: string }).referralCode || "",
      authProvider: (u as unknown as { authProvider?: string }).authProvider || "local",
      isModerator: (u as unknown as { isModerator?: boolean }).isModerator || false,
    })));
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/users/:id/ban", async (req, res) => {
  try {
    const { reason } = req.body || {};
    const user = await User.findByIdAndUpdate(req.params.id, {
      isBanned: true,
      banReason: reason || "Banned by admin",
      bannedAt: new Date()
    }, { new: true });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/users/:id/unban", async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, {
      isBanned: false,
      banReason: "",
      bannedAt: null
    }, { new: true });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/users/:id/tx", async (req, res) => {
  try {
    const { amount } = req.body || {};
    const num = Number(amount);
    if (!num || num <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }
    const user = await User.findByIdAndUpdate(req.params.id, { $inc: { txCoins: num } }, { new: true });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    await Transaction.create({ userId: req.params.id, type: "admin_grant", txAmount: num, ksAmount: 0, status: "success" });
    res.json({ ok: true, txCoins: user.txCoins });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/users/:id/subtract-tx", async (req, res) => {
  try {
    const { amount } = req.body || {};
    const num = Number(amount);
    if (!num || num <= 0) { res.status(400).json({ error: "Invalid amount" }); return; }
    const user = await User.findById(req.params.id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    user.txCoins = Math.max(0, user.txCoins - num);
    await user.save();
    res.json({ ok: true, txCoins: user.txCoins });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/users/:id/password", async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password || password.length < 6) { res.status(400).json({ error: "Password too short" }); return; }
    const hash = await bcrypt.hash(password, 12);
    const user = await User.findByIdAndUpdate(req.params.id, { passwordHash: hash }, { new: true });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/users/:id/notify", async (req, res) => {
  try {
    const { title, message } = req.body || {};
    const cleanTitle = String(title || "").trim();
    const cleanMessage = String(message || "").trim();
    if (!cleanTitle || !cleanMessage) { res.status(400).json({ error: "Title and message are required" }); return; }
    const user = await User.findById(req.params.id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const { createNotification } = await import("../services/notifications.js");
    await createNotification(user._id, "general", cleanTitle.slice(0, 200), cleanMessage.slice(0, 2000));
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const userBots = await Bot.find({ userId: req.params.id });
    await Promise.all(userBots.map(async b => { try { await deleteApp(b.herokuAppName); } catch {} }));
    await Bot.deleteMany({ userId: req.params.id });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.get("/bots", async (_req, res) => {
  try {
    const bots = await Bot.find({}).lean();
    const userMap: Record<string, { email: string; username?: string }> = {};
    const users = await User.find({}).select("email username").lean();
    for (const u of users) { userMap[u._id.toString()] = { email: u.email, username: u.username || "" }; }
    res.json(bots.map(b => ({
      ...b,
      ownerEmail: userMap[b.userId?.toString()]?.email || "unknown",
      ownerUsername: userMap[b.userId?.toString()]?.username || ""
    })));
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/bots/:id/stop", async (req, res) => {
  try {
    const bot = await Bot.findById(req.params.id);
    if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
    await stopApp(bot.herokuAppName);
    await Bot.findByIdAndUpdate(req.params.id, { status: "stopped" });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/bots/:id/start", async (req, res) => {
  try {
    const bot = await Bot.findById(req.params.id);
    if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
    await startApp(bot.herokuAppName);
    await Bot.findByIdAndUpdate(req.params.id, { status: "running" });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/bots/:id/restart", async (req, res) => {
  try {
    const bot = await Bot.findById(req.params.id);
    if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
    await restartApp(bot.herokuAppName);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.delete("/bots/:id", async (req, res) => {
  try {
    const bot = await Bot.findById(req.params.id);
    if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
    try { await deleteApp(bot.herokuAppName); } catch {}
    if (bot.isTrial && bot.phoneNumber) {
      await TrialCheck.findOneAndUpdate({ phoneNumber: bot.phoneNumber }, { status: "trial_ended" });
      const botOwner = await User.findById(bot.userId);
      if (botOwner) {
        const { BlockedTrial } = await import("../models/BlockedTrial.js");
        await BlockedTrial.findOneAndUpdate(
          { phoneNumber: bot.phoneNumber },
          { phoneNumber: bot.phoneNumber, email: botOwner.email },
          { upsert: true }
        );
      }
    }
    await Bot.findByIdAndUpdate(req.params.id, { status: "deleted" });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.get("/bots/:id/logs", async (req, res) => {
  try {
    const bot = await Bot.findById(req.params.id);
    if (!bot) { res.status(404).json({ error: "Bot not found" }); return; }
    const { getAppLogs } = await import("../services/heroku.js");
    const logs = await getAppLogs(bot.herokuAppName);
    res.json({ logs });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.get("/transactions", async (_req, res) => {
  try {
    const txs = await Transaction.find({}).sort({ createdAt: -1 }).limit(500).lean();
    const userMap: Record<string, { email: string; username?: string }> = {};
    const users = await User.find({}).select("email username").lean();
    for (const u of users) { userMap[u._id.toString()] = { email: u.email, username: u.username || "" }; }
    const countryMeta: Record<string, { code: string; rateFromKes: number }> = {
      kenya: { code: "KES", rateFromKes: 1 },
      nigeria: { code: "NGN", rateFromKes: NGN_PER_USD / KES_PER_USD },
      cameroon: { code: "XAF", rateFromKes: XAF_PER_USD / KES_PER_USD },
      tanzania: { code: "TZS", rateFromKes: TZS_PER_USD / KES_PER_USD },
      drc: { code: "USD", rateFromKes: 1 / KES_PER_USD },
    };
    res.json(txs.map(t => {
      const country = (t.paystackCountry as string) || "kenya";
      const meta = countryMeta[country] || countryMeta.kenya;
      const localAmount = Math.round((t.ksAmount || 0) * meta.rateFromKes * 100) / 100;
      return {
        _id: t._id,
        type: t.type,
        txAmount: t.txAmount,
        txSign: t.type === "admin_grant" || t.type === "topup" || t.type === "refund" ? "+" : "-",
        ksAmount: t.ksAmount,
        localAmount,
        localCurrency: meta.code,
        status: t.status,
        paystackRef: t.paystackRef,
        paystackCountry: country,
        ownerEmail: userMap[t.userId?.toString()]?.email || "unknown",
        ownerUsername: userMap[t.userId?.toString()]?.username || "",
        userId: t.userId?.toString() || "",
        createdAt: t.createdAt
      };
    }));
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.delete("/transactions/:id", async (req, res) => {
  try {
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.delete("/transactions/bulk", async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: "No IDs provided" }); return; }
    await Transaction.deleteMany({ _id: { $in: ids } });
    res.json({ ok: true, deleted: ids.length });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/transactions/resolve-stale", async (_req, res) => {
  try {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    const result = await Transaction.updateMany(
      { status: "pending", createdAt: { $lt: cutoff } },
      { $set: { status: "failed" } }
    );
    res.json({ ok: true, updated: result.modifiedCount });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.get("/coupons", async (_req, res) => {
  try {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 }).lean();
    res.json(coupons);
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/coupons", async (req, res) => {
  try {
    const { code, txAmount, maxUses, expiresAt } = req.body || {};
    if (!code || !txAmount) { res.status(400).json({ error: "Code and TX amount are required" }); return; }
    const coupon = await Coupon.create({ code: code.toUpperCase(), txAmount, maxUses: maxUses || 1, expiresAt: expiresAt ? new Date(expiresAt) : null });
    res.json({ ok: true, coupon });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.delete("/coupons/:id", async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.get("/referrals", async (_req, res) => {
  try {
    const referrals = await Referral.find({}).sort({ createdAt: -1 }).lean();
    const userMap: Record<string, { email: string }> = {};
    const users = await User.find({}).select("email").lean();
    for (const u of users) { userMap[u._id.toString()] = { email: u.email }; }
    res.json(referrals.map(r => ({
      ...r,
      referrerEmail: userMap[(r as unknown as { referrerId: { toString(): string } }).referrerId?.toString()]?.email || "unknown",
      referredEmail: userMap[(r as unknown as { referredId: { toString(): string } }).referredId?.toString()]?.email || "unknown"
    })));
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.delete("/referrals/all", async (_req, res) => {
  try {
    await Referral.deleteMany({});
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.get("/teams", async (_req, res) => {
  try {
    const teams = await Team.find({}).lean();
    const counts = await Promise.all(teams.map(async t => {
      const count = await getTeamAppCount((t as unknown as { name: string }).name).catch(() => 0);
      return { ...(t as object), appCount: count, remaining: TEAM_MAX_APPS - count };
    }));
    res.json(counts);
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/teams", async (req, res) => {
  try {
    const { name, label, active } = req.body || {};
    if (!name) { res.status(400).json({ error: "Team name is required" }); return; }
    const team = await Team.create({ name, label: label || name, active: active !== false });
    res.json({ ok: true, team });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.patch("/teams/:id", async (req, res) => {
  try {
    const { label, active } = req.body || {};
    const team = await Team.findByIdAndUpdate(req.params.id, { label, active }, { new: true });
    if (!team) { res.status(404).json({ error: "Team not found" }); return; }
    res.json({ ok: true, team });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.delete("/teams/:id", async (req, res) => {
  try {
    await Team.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.get("/db/stats", async (_req, res) => {
  try {
    const db = mongoose.connection.db;
    let storageInfo: { dataSize: number; storageSize: number; totalSize: number } | null = null;
    try {
      const stats = await db!.command({ dbStats: 1, scale: 1 });
      storageInfo = {
        dataSize: stats.dataSize as number,
        storageSize: stats.storageSize as number,
        totalSize: (stats.dataSize as number) + (stats.indexSize as number)
      };
    } catch {}
    const collections = [
      { key: "users", label: "Users", canPurge: false },
      { key: "bots", label: "Bots", canPurge: false },
      { key: "transactions", label: "Transactions", canPurge: true },
      { key: "blockedtrials", label: "Blocked Trials", canPurge: true },
      { key: "iprecords", label: "IP Records", canPurge: true },
      { key: "trialchecks", label: "Trial Checks", canPurge: true },
      { key: "coupons", label: "Coupons", canPurge: true },
      { key: "referrals", label: "Referrals", canPurge: false },
      { key: "boostservicecaches", label: "Social Media Boosting", canPurge: true },
      { key: "boostorders", label: "Boost Orders", canPurge: true },
    ];
    const counts = await Promise.all(collections.map(async c => {
      try {
        let count = 0;
        if (c.key === "boostservicecaches") {
          count = await BoostServiceCache.countDocuments().maxTimeMS(5000);
        } else if (c.key === "boostorders") {
          count = await BoostOrder.countDocuments().maxTimeMS(5000);
        } else {
          count = await db!.collection(c.key).countDocuments();
        }
        return { name: c.key, label: c.label, count, canPurge: c.canPurge };
      } catch {
        return { name: c.key, label: c.label, count: 0, canPurge: c.canPurge };
      }
    }));
    const quotaMb = Number(process.env.MONGO_STORAGE_QUOTA_MB || "512");
    let quota: { quotaMb: number; usedMb: number; remainingMb: number; usedPercent: number } | null = null;
    if (storageInfo) {
      const usedMb = storageInfo.storageSize / (1024 * 1024);
      const remainingMb = Math.max(0, quotaMb - usedMb);
      const usedPercent = Math.min(100, (usedMb / quotaMb) * 100);
      quota = { quotaMb, usedMb, remainingMb, usedPercent };
    }
    res.json({ collections: counts, storage: storageInfo, quota });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.delete("/db/purge/:collection", async (req, res) => {
  try {
    const allowed = ["transactions", "blockedtrials", "iprecords", "trialchecks", "coupons", "boostservicecaches", "boostorders"];
    const col = req.params.collection.toLowerCase();
    if (!allowed.includes(col)) { res.status(403).json({ error: "Cannot purge this collection" }); return; }
    const db = mongoose.connection.db;
    if (col === "boostservicecaches") {
      await clearBoostCatalogue();
    } else if (col === "boostorders") {
      await BoostOrder.deleteMany({});
    } else {
      await db!.collection(col).deleteMany({});
    }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.get("/orphan-apps", async (_req, res) => {
  try {
    const teams = await Team.find({ active: true }).lean();
    const teamNames = teams.length > 0 ? (teams as { name: string }[]).map(t => t.name) : (DEFAULT_HEROKU_TEAM ? [DEFAULT_HEROKU_TEAM] : []);
    const allAppNames: string[] = [];
    await Promise.all(teamNames.map(async team => {
      const apps = await getTeamApps(team);
      for (const name of apps) allAppNames.push(name);
    }));
    const siteApps = allAppNames.filter(n => n.startsWith("bmbhost"));
    const dbBots = await Bot.find({ herokuAppName: { $in: siteApps }, status: { $ne: "deleted" } }).select("herokuAppName").lean();
    const dbNames = new Set(dbBots.map(b => b.herokuAppName));
    const orphans = siteApps.filter(n => !dbNames.has(n));
    res.json({ orphans });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.delete("/orphan-apps/:appName", async (req, res) => {
  try {
    await deleteApp(req.params.appName);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.get("/blocked-trials", async (_req, res) => {
  try {
    const blocked = await BlockedTrial.find({}).sort({ _id: -1 }).lean();
    res.json({ blocked });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.delete("/blocked-trials/:phone", async (req, res) => {
  try {
    const result = await BlockedTrial.deleteOne({ phoneNumber: req.params.phone });
    res.json({ ok: true, deleted: result.deletedCount || 0 });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.get("/tutorials", async (_req, res) => {
  try {
    const tutorials = await Tutorial.find({}).sort({ order: 1, createdAt: -1 }).lean();
    res.json(tutorials);
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/tutorials", async (req, res) => {
  try {
    const { title, youtubeUrl, order } = req.body || {};
    if (!title || !youtubeUrl) { res.status(400).json({ error: "Title and YouTube URL are required" }); return; }
    const tutorial = await Tutorial.create({ title, youtubeUrl, order: order ?? 0 });
    res.json({ ok: true, tutorial });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.delete("/tutorials/:id", async (req, res) => {
  try {
    await Tutorial.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.get("/bot-templates", async (_req, res) => {
  try {
    const templates = await BotTemplate.find({}).sort({ order: 1, createdAt: -1 }).lean();
    const deployCountMap: Record<string, number> = {};
    const counts = await Bot.aggregate([
      { $match: { templateId: { $exists: true, $ne: "" }, status: { $ne: "deleted" } } },
      { $group: { _id: "$templateId", count: { $sum: 1 } } }
    ]);
    for (const c of counts) { deployCountMap[c._id] = c.count; }
    res.json(templates.map(t => ({ ...t, deployCount: deployCountMap[(t as unknown as { _id: { toString(): string } })._id.toString()] || 0 })));
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/bot-templates", async (req, res) => {
  try {
    const { name, description, repoUrl, shareableSlug, sessionIdUrl, order } = req.body || {};
    if (!name || !repoUrl) { res.status(400).json({ error: "Name and repo URL are required" }); return; }
    const template = await BotTemplate.create({ name, description: description || "", repoUrl, shareableSlug: shareableSlug || name.toLowerCase().replace(/\s+/g, "-"), sessionIdUrl: sessionIdUrl || "", order: order ?? 0 });
    res.json({ ok: true, template });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.delete("/bot-templates/:id", async (req, res) => {
  try {
    await BotTemplate.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: "Server error" }); }
});

// ── Moderator management ───────────────────────────────────────────────────
router.post("/users/:id/moderator", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const newStatus = !user.isModerator;
    user.isModerator = newStatus;
    if (newStatus) {
      // Grant 100 TX bonus on promotion
      user.txCoins += 100;
      await user.save();
      await Transaction.create({ userId: user._id, type: "admin_grant", txAmount: 100, ksAmount: 0, status: "success" });
      const { createNotification } = await import("../services/notifications.js");
      await createNotification(user._id, "general", "You've been promoted to Moderator!", "Congratulations! You now have moderator status on Bmb Tech Hosting. You've received 100 TX as a welcome bonus.").catch(() => {});
    } else {
      await user.save();
    }
    res.json({ ok: true, isModerator: newStatus });
  } catch { res.status(500).json({ error: "Server error" }); }
});

// ── Maintenance mode ───────────────────────────────────────────────────────
router.get("/maintenance", async (_req, res) => {
  try {
    const { getSetting } = await import("../models/AppSettings.js");
    const maintenanceMode = await getSetting("maintenanceMode", false);
    res.json({ maintenanceMode: !!maintenanceMode });
  } catch { res.status(500).json({ error: "Server error" }); }
});

router.post("/maintenance", async (req, res) => {
  try {
    const { enabled } = req.body ?? {};
    const { setSetting } = await import("../models/AppSettings.js");
    await setSetting("maintenanceMode", !!enabled);
    res.json({ ok: true, maintenanceMode: !!enabled });
  } catch { res.status(500).json({ error: "Server error" }); }
});


router.get("/boost-orders", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (q) {
      const users = await User.find({
        $or: [
          { email: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
          { username: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } },
        ],
      }).select("_id").limit(50).lean();
      const userIds = users.map(u => u._id);
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { serviceName: { $regex: escaped, $options: "i" } },
        { link: { $regex: escaped, $options: "i" } },
        { providerOrderId: { $regex: escaped, $options: "i" } },
        { category: { $regex: escaped, $options: "i" } },
        ...(userIds.length ? [{ userId: { $in: userIds } }] : []),
      ];
    }
    const skip = (page - 1) * limit;
    const [orders, total, completed, pending, failed, processing] = await Promise.all([
      BoostOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("userId", "email username").lean(),
      BoostOrder.countDocuments(filter).maxTimeMS(5000),
      BoostOrder.countDocuments({ status: { $in: ["completed", "partial"] } }).maxTimeMS(3000),
      BoostOrder.countDocuments({ status: { $in: ["pending", "awaiting_payment"] } }).maxTimeMS(3000),
      BoostOrder.countDocuments({ status: { $in: ["failed", "refunded"] } }).maxTimeMS(3000),
      BoostOrder.countDocuments({ status: { $in: ["processing"] } }).maxTimeMS(3000),
    ]);
    const mapped = orders.map((o: Record<string, unknown>) => {
      const u = o.userId as { _id?: unknown; email?: string; username?: string } | null;
      return {
        _id: o._id,
        serviceName: o.serviceName,
        category: o.category,
        link: o.link,
        quantity: o.quantity,
        costKes: o.costKes,
        costTx: o.costTx,
        paymentMethod: o.paymentMethod,
        paymentGateway: o.paymentGateway,
        paymentRef: o.paymentRef,
        providerOrderId: o.providerOrderId,
        providerServiceId: o.providerServiceId,
        status: o.status,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        user: u ? { id: u._id, email: u.email || "", username: u.username || "" } : null,
      };
    });
    res.json({
      orders: mapped,
      total,
      page,
      limit,
      stats: { total, completed, pending, failed, processing, globalCompleted: 3 + completed },
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});



router.post("/boost-orders/:id/complete", async (req, res) => {
  try {
    const order = await BoostOrder.findById(req.params.id);
    if (!order) { res.status(404).json({ error: "Order not found" }); return; }
    if (["completed", "refunded"].includes(order.status)) {
      res.json({ ok: true, status: order.status, message: "Already final" });
      return;
    }
    order.status = "completed";
    order.updatedAt = new Date();
    await order.save();
    try {
      const { createNotification } = await import("../services/notifications.js");
      await createNotification(order.userId, "boost", "Boost order completed", `Your order for ${order.serviceName} is complete.`);
    } catch {}
    try {
      const { notifyOwner } = await import("../services/notify.js");
      notifyOwner(
        `✅ *Boost marked completed (admin)*\n\nOrder: \`${order._id}\`\nService: \`${order.serviceName}\`\nQty: ${order.quantity}\nLink: ${order.link}`
      ).catch(() => {});
    } catch {}
    res.json({ ok: true, status: "completed" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/api-keys", async (_req, res) => {
  try {
    const users = await User.find({ apiKeyHash: { $ne: "" } })
      .select("email username apiKeyPrefix apiKeyActive apiKeyCreatedAt apiKeyLastUsedAt apiCallCount txCoins isBanned createdAt")
      .sort({ apiKeyLastUsedAt: -1, apiCallCount: -1 })
      .lean();
    const userIds = users.map(u => u._id);
    const boostByApi = await BoostOrder.aggregate([
      { $match: { userId: { $in: userIds }, paymentMethod: "tx" } },
      { $group: { _id: "$userId", orders: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } } } },
    ]);
    const orderMap: Record<string, { orders: number; completed: number }> = {};
    for (const row of boostByApi) {
      orderMap[String(row._id)] = { orders: row.orders, completed: row.completed };
    }
    const mapped = users.map(u => ({
      id: u._id,
      email: u.email,
      username: u.username || "",
      prefix: u.apiKeyPrefix || "",
      active: !!u.apiKeyActive,
      callCount: u.apiCallCount || 0,
      lastUsedAt: u.apiKeyLastUsedAt || null,
      createdAt: u.apiKeyCreatedAt || null,
      txCoins: u.txCoins || 0,
      isBanned: !!u.isBanned,
      boostOrders: orderMap[String(u._id)]?.orders || 0,
      boostCompleted: orderMap[String(u._id)]?.completed || 0,
    }));
    const stats = {
      totalKeys: mapped.length,
      activeKeys: mapped.filter(m => m.active).length,
      totalCalls: mapped.reduce((s, m) => s + m.callCount, 0),
      totalBoostOrders: mapped.reduce((s, m) => s + m.boostOrders, 0),
    };
    res.json({ keys: mapped, stats });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});


router.get("/boost-catalogue/meta", async (_req, res) => {
  try {
    const meta = getCatalogueMeta();
    let mongoCount = 0;
    try { mongoCount = await BoostServiceCache.countDocuments().maxTimeMS(3000); } catch {}
    res.json({ ...meta, mongoCount });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/boost-catalogue/sync", async (_req, res) => {
  try {
    const result = await syncBoostCatalogue();
    if (!result) {
      res.status(502).json({ error: "Catalogue sync returned no services. Try again shortly." });
      return;
    }
    res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    res.status(502).json({ error: msg });
  }
});

router.delete("/boost-catalogue", async (_req, res) => {
  try {
    await clearBoostCatalogue();
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
