import "dotenv/config";
import { ADMIN_EMAIL, APP_NAME, SITE_HOST, OG_IMAGE_URL, DEFAULT_BOT_NAME, DEFAULT_BOT_REPO, DEFAULT_BOT_SESSION_URL, DEFAULT_BOT_SLUG } from "./config.js";
import express from "express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import authRouter from "./routes/auth.js";
import profileRouter from "./routes/profile.js";
import mediaRouter from "./routes/media.js";
import chatRouter from "./routes/chat.js";
import botRouter from "./routes/bots.js";
import paymentsRouter, { paystackWebhookHandler, ablinerWebhookHandler } from "./routes/payments.js";
import adminRouter from "./routes/admin.js";
import couponRouter from "./routes/coupons.js";
import botTemplatesRouter from "./routes/bot-templates.js";
import githubRouter from "./routes/github.js";
import tutorialsRouter from "./routes/tutorials.js";
import notificationsRouter from "./routes/notifications.js";
import currencyRouter from "./routes/currency.js";
import boostRouter from "./routes/boost.js";
import apiKeysRouter from "./routes/apikeys.js";
import publicApiRouter from "./routes/publicApi.js";
import { publicApiRateLimit } from "./middleware/rateLimit.js";
import { logger } from "./logger.js";
import { BotTemplate } from "./models/BotTemplate.js";
import { Bot } from "./models/Bot.js";
import { startCronJobs } from "./services/cron.js";
import { ensureBoostCatalogueSynced, warmBoostMemCache } from "./services/boostCatalogSync.js";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || "";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "";
const ALLOWED_ORIGINS = FRONTEND_ORIGIN.split(",").map(o => o.trim()).filter(Boolean);
if (ALLOWED_ORIGINS.length === 0) logger.warn("FRONTEND_ORIGIN is not set — cross-origin requests will be rejected. Set FRONTEND_ORIGIN to your site's URL(s), comma-separated.");
const JWT_SECRET = process.env.JWT_SECRET || "";

if (!JWT_SECRET) {
  logger.error("JWT_SECRET is not set. Refusing to start — running with an empty JWT secret lets anyone forge login tokens.");
  process.exit(1);
}
if (!MONGO_URI) {
  logger.error("MONGODB_URI is not set. Refusing to start.");
  process.exit(1);
}

// In-memory maintenance mode cache to avoid hitting DB on every request
let _maintenanceCached: { on: boolean; ts: number } = { on: false, ts: 0 };
const MAINTENANCE_CACHE_TTL = 30_000;
async function getMaintenanceCached(): Promise<boolean> {
  const now = Date.now();
  if (now - _maintenanceCached.ts < MAINTENANCE_CACHE_TTL) return _maintenanceCached.on;
  try {
    const { getSetting } = await import("./models/AppSettings.js");
    const val = await getSetting("maintenanceMode", false);
    _maintenanceCached = { on: !!val, ts: now };
    return _maintenanceCached.on;
  } catch { return _maintenanceCached.on; }
}

app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});
app.use(express.json({
  limit: "2mb",
  // keep the raw body: needed to verify Abliner webhook signatures
  verify: (req, _res, buf) => { (req as unknown as { rawBody?: Buffer }).rawBody = buf; },
}));
app.use(cookieParser());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    let originHost = "";
    try { originHost = new URL(origin).host; } catch { originHost = ""; }
    const allowed = originHost === req.headers.host || ALLOWED_ORIGINS.includes(origin);
    if (allowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
    }
  }
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "Content-Type,Authorization,x-api-key");
    res.sendStatus(204);
    return;
  }
  next();
});

app.post("/webhook", paystackWebhookHandler);
app.post("/webhook/abliner", ablinerWebhookHandler);

// Public maintenance status (bypass maintenance check)
// (applied before the maintenance middleware below)
app.use("/api/auth", authRouter);
app.use("/api/auth", profileRouter);

// ── Server-side maintenance mode enforcement ───────────────────────────────
// Only block /api/* calls — the React SPA must always load so its own
// maintenance gate can run (and so /login remains accessible).
app.use(async (req: any, res: any, next: any) => {
  if (!req.path.startsWith("/api/")) return next();
  if (
    req.path.startsWith("/api/auth") ||
    req.path.startsWith("/api/settings/") ||
    req.path === "/webhook"
  ) return next();

  const maintenanceOn = await getMaintenanceCached();
  if (!maintenanceOn) return next();

  try {
    const token = (req.headers.authorization || "").replace("Bearer ", "") ||
                  (req.cookies?.token || "");
    if (token && JWT_SECRET) {
      const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
      if (decoded.userId) {
        const { User } = await import("./models/User.js");
        const u = await (User as any).findById(decoded.userId).lean() as { email?: string; isModerator?: boolean } | null;
        if (u && ((!!ADMIN_EMAIL && u.email === ADMIN_EMAIL) || u.isModerator === true)) return next();
      }
    }
  } catch {}

  return res.status(503).json({ error: "Site is under maintenance. Please try again later.", maintenanceMode: true });
});

app.use("/api/bots", botRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/coupons", couponRouter);
app.use("/api/media", mediaRouter);
app.use("/api/chat", chatRouter);

// Public maintenance status endpoint (no auth required)
app.get("/api/settings/maintenance", async (_req, res) => {
  try {
    const { getSetting } = await import("./models/AppSettings.js");
    const maintenanceMode = await getSetting("maintenanceMode", false);
    res.json({ maintenanceMode: !!maintenanceMode });
  } catch { res.json({ maintenanceMode: false }); }
});
app.use("/api/bot-templates", botTemplatesRouter);
app.use("/api/github", githubRouter);
app.use("/api/tutorials", tutorialsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/currency", currencyRouter);
app.use("/api/boost", boostRouter);
app.use("/api/apikeys", apiKeysRouter);
app.use("/api/v1/bots", publicApiRateLimit, botRouter);
app.use("/api/v1/bot-templates", publicApiRateLimit, botTemplatesRouter);
app.use("/api/v1/boost", publicApiRateLimit, boostRouter);
app.use("/api/v1", publicApiRateLimit, publicApiRouter);

const CRAWLER_RE = /whatsapp|facebookexternalhit|twitterbot|telegrambot|linkedinbot|slackbot|discord|googlebot|bingbot|curl|wget|python-requests/i;

app.get(["/services/bots/:slug", "/services/bots/:slug/*"], async (req, res, next) => {
  const ua = req.headers["user-agent"] || "";
  if (!CRAWLER_RE.test(ua)) { next(); return; }
  try {
    const template = await BotTemplate.findOne({ shareableSlug: req.params.slug, active: true }).lean();
    if (!template) { next(); return; }
    const name = (template as unknown as { name?: string }).name || "Bmb Bot";
    const imageUrl = (template as unknown as { imageUrl?: string }).imageUrl || OG_IMAGE_URL;
    const host = req.get("host") || SITE_HOST;
    const url = `https://${host}/services/bots/${req.params.slug}`;
    const title = `${name} — Deploy on ${APP_NAME}`;
    const desc = `Deploy ${name} bot instantly on ${APP_NAME}. Fast, reliable WhatsApp bot hosting in seconds.`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<meta name="description" content="${desc}"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${desc}"/>
<meta property="og:image" content="${imageUrl}"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:url" content="${url}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${title}"/>
<meta name="twitter:description" content="${desc}"/>
<meta name="twitter:image" content="${imageUrl}"/>
</head><body><p>${title}</p><script>window.location.replace("${url}");</script></body></html>`);
  } catch { next(); }
});

const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));
app.get(/.*/, (_req, res) => { res.sendFile(path.join(distPath, "index.html")); });


async function seedDefaultTemplate() {
  if (!DEFAULT_BOT_REPO) return; // set DEFAULT_BOT_REPO in .env to seed a default bot template
  try {
    const count = await BotTemplate.countDocuments({ isDefault: true });
    if (count > 0) return;
    await BotTemplate.create({
      name: DEFAULT_BOT_NAME,
      githubRepo: DEFAULT_BOT_REPO,
      sessionIdUrl: DEFAULT_BOT_SESSION_URL,
      imageUrl: OG_IMAGE_URL,
      costTx: 0,
      isDefault: true,
      active: true,
      shareableSlug: DEFAULT_BOT_SLUG
    });
    logger.info("Seeded default bot template");
  } catch (err) {
    logger.error({ err }, "Failed to seed default template");
  }
}

async function fixDefaultBotTemplate() {
  if (!DEFAULT_BOT_REPO) return;
  try {
    const result = await BotTemplate.updateMany(
      { isDefault: true },
      { $set: { name: DEFAULT_BOT_NAME, githubRepo: DEFAULT_BOT_REPO, imageUrl: OG_IMAGE_URL } }
    );
    if (result.modifiedCount > 0) logger.info(`Corrected ${result.modifiedCount} default bot template(s) to point at the configured default bot`);
  } catch (err) {
    logger.warn({ err }, "Default bot template fix failed (safe to ignore)");
  }
}


async function cleanupOrphanedBots() {
  try {
    const bots = await Bot.find({}).lean();
    const { User: UserModel } = await import("./models/User.js");
    const userIds = [...new Set(bots.map(b => (b as unknown as { userId?: { toString(): string } }).userId?.toString()).filter(Boolean))] as string[];
    const existingUsers = await UserModel.find({ _id: { $in: userIds } }).select("_id").lean();
    const existingSet = new Set(existingUsers.map(u => u._id.toString()));
    const orphans = bots.filter(b => {
      const uid = (b as unknown as { userId?: { toString(): string } }).userId?.toString();
      return uid && !existingSet.has(uid);
    });
    if (orphans.length > 0) {
      await Bot.deleteMany({ _id: { $in: orphans.map(b => b._id) } });
      logger.info(`Removed ${orphans.length} orphaned bot documents`);
    }
  } catch (err) {
    logger.warn({ err }, "Orphaned bot cleanup failed (safe to ignore)");
  }
}

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    logger.info("MongoDB connected");
    await cleanupOrphanedBots();
    await fixDefaultBotTemplate();
    await seedDefaultTemplate();
    startCronJobs();
    ensureBoostCatalogueSynced().then(() => warmBoostMemCache()).catch(() => {});
    app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
  })
  .catch(err => {
    logger.error({ err }, "MongoDB connection failed");
    process.exit(1);
  });
