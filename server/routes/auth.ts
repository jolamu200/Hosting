import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { User } from "../models/User.js";
import { Bot } from "../models/Bot.js";
import { Package } from "../models/Package.js";
import { Referral } from "../models/Referral.js";
import { EmailQuota } from "../models/EmailQuota.js";
import { authRateLimit } from "../middleware/rateLimit.js";
import { authGuard, type AuthRequest } from "../middleware/auth.js";
import { getClientIP, generateReferralCode, canRegisterWithIP, recordIPAndFingerprint } from "../utils/fingerprint.js";
import { IPRecord } from "../models/IPRecord.js";
import { isAcceptableEmail } from "../utils/disposableEmails.js";
import { ADMIN_EMAIL, MAIL_FROM, SITE_HOST, SITE_URL, isAdminEmail } from "../config.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "";
const CLIENT_URL = process.env.CLIENT_URL || SITE_URL;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.resend.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "resend",
    pass: process.env.SMTP_PASS,
  },
});

const magicLinkTokens = new Map<string, { email: string; expires: number; referralCode?: string; passwordHash?: string }>();
const pendingTokens = new Map<string, { email: string; referralCode?: string; expires: number; passwordHash?: string }>();
const resetTokens = new Map<string, { userId: string; email: string; expires: number }>();

const EMAIL_DAILY_LIMIT = 3;

async function checkEmailQuota(email: string): Promise<{ allowed: boolean; error?: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const key = email.toLowerCase();
  const expiresAt = new Date(Date.now() + 49 * 60 * 60 * 1000);
  const limitError = `You've reached the daily email limit (${EMAIL_DAILY_LIMIT} per day). Please try again tomorrow.`;

  const updated = await EmailQuota.findOneAndUpdate(
    { email: key, date: today, count: { $lt: EMAIL_DAILY_LIMIT } },
    { $inc: { count: 1 } },
    { new: true }
  );
  if (updated) return { allowed: true };

  try {
    await EmailQuota.create({ email: key, date: today, count: 1, expiresAt });
    return { allowed: true };
  } catch (err: any) {
    if (err.code === 11000) {
      const retry = await EmailQuota.findOneAndUpdate(
        { email: key, date: today, count: { $lt: EMAIL_DAILY_LIMIT } },
        { $inc: { count: 1 } },
        { new: true }
      );
      if (retry) return { allowed: true };
    }
    return { allowed: false, error: limitError };
  }
}

function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

function generatePendingToken(email: string, referralCode?: string, passwordHash?: string): string {
  const token = crypto.randomBytes(32).toString("hex");
  pendingTokens.set(token, { email, referralCode, expires: Date.now() + 30 * 60 * 1000, passwordHash });
  return token;
}

function setAuthCookie(res: any, token: string) {
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function userPayload(user: any) {
  return {
    id: user._id,
    email: user.email,
    username: user.username,
    txCoins: user.txCoins,
    isBanned: user.isBanned,
    referralCode: user.referralCode,
    avatarUrl: user.avatarUrl || "",
    authProvider: user.authProvider || "local",
    isModerator: user.isModerator || false,
    isAdmin: isAdminEmail(user.email),
    currency: user.currency || "KES",
    currencySet: !!user.currencySet,
  };
}

function buildEmailHtml(type: "login" | "signup" | "reset", url: string, username?: string): { subject: string; html: string } {
  const wrap = (body: string) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#111827;border:1px solid #1f2937;border-radius:16px;overflow:hidden;max-width:520px;width:100%">
<tr><td style="padding:28px 32px;background:linear-gradient(135deg,#1e1b4b,#0f172a);border-bottom:1px solid #1f2937;text-align:center">
<span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px"> Bmb Tech Hosting</span>
</td></tr>
<tr><td style="padding:36px 32px">${body}</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #1f2937;text-align:center">
<p style="margin:0;font-size:12px;color:#4b5563">If you didn't request this, you can safely ignore this email.</p>
<p style="margin:6px 0 0;font-size:12px;color:#374151">Regards, <strong style="color:#9ca3af">Bmb Tech</strong> &mdash; Bmb Tech Hosting &middot; <a href="${SITE_URL}" style="color:#6b7280;text-decoration:none">${SITE_HOST}</a></p>
</td></tr>
</table></td></tr></table>
</body></html>`;

  const btnStyle = `display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border-radius:10px;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:0.2px`;
  const linkStyle = `color:#7c3aed;word-break:break-all`;

  if (type === "signup") {
    return {
      subject: "Welcome to Bmb Tech Hosting — Complete Your Sign Up",
      html: wrap(`
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#fff">Welcome to Bmb Tech Hosting! 🎉</h1>
        <p style="margin:0 0 6px;font-size:15px;color:#9ca3af;line-height:1.6">Thanks for signing up. You're one step away from deploying your first bot.</p>
        <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6">Click the button below to verify your email and complete your account setup. This link expires in <strong style="color:#9ca3af">15 minutes</strong>.</p>
        <a href="${url}" style="${btnStyle}">Complete Sign Up &rarr;</a>
        <p style="margin:28px 0 0;font-size:12px;color:#4b5563;line-height:1.8">Or copy this link into your browser:<br><a href="${url}" style="${linkStyle}">${url}</a></p>
      `),
    };
  }

  if (type === "reset") {
    return {
      subject: "Reset Your Password — Bmb Tech Hosting",
      html: wrap(`
        <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#fff">Reset Your Password</h1>
        ${username ? `<p style="margin:0 0 6px;font-size:14px;color:#6b7280">Hi <strong style="color:#9ca3af">@${username}</strong>,</p>` : ""}
        <p style="margin:0 0 28px;font-size:14px;color:#9ca3af;line-height:1.6">We received a request to reset the password for your Bmb Tech Hosting account. Click the button below to set a new password. This link expires in <strong style="color:#d1d5db">30 minutes</strong> and can only be used once.</p>
        <a href="${url}" style="${btnStyle}">Reset Password &rarr;</a>
        <p style="margin:28px 0 0;font-size:12px;color:#4b5563;line-height:1.8">Or copy this link:<br><a href="${url}" style="${linkStyle}">${url}</a></p>
        <p style="margin:16px 0 0;font-size:12px;color:#4b5563">If you didn't request a password reset, your password will remain unchanged — no action is needed.</p>
      `),
    };
  }

  return {
    subject: "Your Login Link — Bmb Tech Hosting",
    html: wrap(`
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#fff">Your Login Link</h1>
      ${username ? `<p style="margin:0 0 6px;font-size:14px;color:#6b7280">Hi <strong style="color:#9ca3af">@${username}</strong>,</p>` : ""}
      <p style="margin:0 0 28px;font-size:14px;color:#9ca3af;line-height:1.6">Click the button below to sign in to your Bmb Tech Hosting account. This link expires in <strong style="color:#d1d5db">15 minutes</strong> and can only be used once.</p>
      <a href="${url}" style="${btnStyle}">Sign In to Bmb Tech Hosting &rarr;</a>
      <p style="margin:28px 0 0;font-size:12px;color:#4b5563;line-height:1.8">Or copy this link:<br><a href="${url}" style="${linkStyle}">${url}</a></p>
    `),
  };
}

async function syncDefaultPackages(): Promise<void> {
  const packages = [
    { name: "Starter", ksPrice: 50, txAmount: 10, bonusTx: 0, isBestDeal: false, order: 1, active: true },
    { name: "Basic", ksPrice: 100, txAmount: 20, bonusTx: 0, isBestDeal: false, order: 2, active: true },
    { name: "Standard", ksPrice: 150, txAmount: 30, bonusTx: 0, isBestDeal: false, order: 3, active: true },
    { name: "Pro", ksPrice: 250, txAmount: 50, bonusTx: 5, isBestDeal: true, order: 4, active: true },
    { name: "Elite", ksPrice: 500, txAmount: 100, bonusTx: 10, isBestDeal: false, order: 5, active: true },
    { name: "Ultimate", ksPrice: 1000, txAmount: 200, bonusTx: 20, isBestDeal: false, order: 6, active: true },
  ];
  for (const pkg of packages) {
    await Package.findOneAndUpdate({ order: pkg.order }, { $set: pkg }, { upsert: true });
  }
}

async function handleReferral(userId: any, referralCode: string | null | undefined, ip: string) {
  if (!referralCode) return;
  const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
  if (!referrer) return;
  const referrerId = referrer._id;
  const existingReferral = await Referral.findOne({ referredId: userId });
  if (existingReferral) return;
  const { Transaction } = await import("../models/Transaction.js");
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [referrerIPRecords, recentReferralCount] = await Promise.all([
    IPRecord.find({ userId: referrerId.toString() }, { ip: 1 }).lean(),
    Referral.countDocuments({ referrerId, createdAt: { $gte: hourAgo } }),
  ]);
  const referrerIPs = new Set(referrerIPRecords.map((r: { ip: string }) => r.ip));
  const sameIP = referrerIPs.has(ip);
  const isAbuse = sameIP || recentReferralCount >= 3;
  if (isAbuse) {
    const flagReason = sameIP ? "referrer_ip_match" : "referral_rate_limit";
    await Referral.create({ referrerId, referredId: userId, txRewarded: 0, flagged: true, flagReason });
    if (sameIP) {
      await User.findByIdAndUpdate(referrerId, { $set: { isBanned: true, banReason: "Referral abuse detected: same-IP self-referral" } });
    }
  } else {
    await Referral.create({ referrerId, referredId: userId, txRewarded: 2 });
    await User.findByIdAndUpdate(referrerId, { $inc: { txCoins: 2 } });
    const { Transaction } = await import("../models/Transaction.js");
    await Transaction.create({ userId: referrerId, type: "admin_grant", txAmount: 2, ksAmount: 0, status: "success" });
    await User.findByIdAndUpdate(userId, { $inc: { txCoins: 2 } });
    await Transaction.create({ userId, type: "admin_grant", txAmount: 2, ksAmount: 0, status: "success" });
  }
}

router.post("/login", authRateLimit, async (req, res) => {
  try {
    const schema = z.object({ usernameOrEmail: z.string().min(1), password: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { usernameOrEmail, password } = parsed.data;
    const isEmail = usernameOrEmail.includes("@");
    const user = isEmail
      ? await User.findOne({ email: usernameOrEmail.toLowerCase() })
      : await User.findOne({ username: usernameOrEmail.toLowerCase() });
    if (!user) { res.status(401).json({ error: "Invalid credentials" }); return; }
    if (user.isBanned) { res.status(403).json({ error: "Your account has been banned. Contact support for assistance." }); return; }
    if (!user.passwordHash) { res.status(400).json({ error: "This account uses GitHub or email link login." }); return; }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }
    const token = generateToken(user._id.toString());
    setAuthCookie(res, token);
    res.json({ token, user: userPayload(user) });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/magic-link/send", authRateLimit, async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      referralCode: z.string().optional(),
      type: z.enum(["login", "signup"]).optional(),
      password: z.string().min(8).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid email or password" }); return; }
    const { email, referralCode, type, password } = parsed.data;

    const isAdmin = email.toLowerCase() === ADMIN_EMAIL;

    if (!isAdmin && !isAcceptableEmail(email)) {
      res.status(400).json({ error: "Please use a real email address from a recognised provider. Temporary, disposable, or unofficial email services are not allowed." });
      return;
    }

    if (!isAdmin) {
      const quota = await checkEmailQuota(email);
      if (!quota.allowed) {
        res.status(429).json({ error: quota.error });
        return;
      }
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (type === "login" && !existingUser) {
      res.status(404).json({ error: "No account found with this email. Please sign up first." });
      return;
    }

    if ((type === "signup" || !type) && existingUser) {
      res.status(409).json({ error: "An account with this email already exists. Please log in instead." });
      return;
    }

    if (existingUser?.isBanned) {
      res.status(403).json({ error: "Your account has been banned. Contact support." });
      return;
    }

    let passwordHash: string | undefined;
    if (password && !existingUser) {
      passwordHash = await bcrypt.hash(password, 12);
    }

    const linkToken = crypto.randomBytes(32).toString("hex");
    magicLinkTokens.set(linkToken, { email: email.toLowerCase(), expires: Date.now() + 15 * 60 * 1000, referralCode, passwordHash });

    const linkUrl = `${CLIENT_URL}/auth/login?token=${linkToken}`;
    const emailType = existingUser ? "login" : "signup";
    const { subject, html } = buildEmailHtml(emailType, linkUrl, existingUser?.username ?? undefined);

    await transporter.sendMail({
      from: MAIL_FROM,
      to: email,
      subject,
      html,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Magic link error:", err);
    res.status(500).json({ error: "Failed to send link. Please try again." });
  }
});

router.get("/magic-link/verify", async (req, res) => {
  try {
    const { token } = req.query as { token: string };
    if (!token) { res.status(400).json({ error: "Missing token" }); return; }

    const record = magicLinkTokens.get(token);
    if (!record || record.expires < Date.now()) {
      magicLinkTokens.delete(token);
      res.status(400).json({ error: "Link expired or invalid. Please request a new one." });
      return;
    }
    magicLinkTokens.delete(token);

    const { email, referralCode } = record;
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.isBanned) { res.status(403).json({ error: "Your account has been banned." }); return; }
      const jwtToken = generateToken(existingUser._id.toString());
      setAuthCookie(res, jwtToken);
      res.json({ token: jwtToken, user: userPayload(existingUser) });
    } else {
      const pendingToken = generatePendingToken(email, referralCode, record.passwordHash);
      res.json({ needsUsername: true, pendingToken });
    }
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/set-username", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const pendingToken = authHeader?.replace("Bearer ", "");
    if (!pendingToken) { res.status(401).json({ error: "Missing token" }); return; }

    const record = pendingTokens.get(pendingToken);
    if (!record || record.expires < Date.now()) {
      pendingTokens.delete(pendingToken);
      res.status(400).json({ error: "Session expired. Please start again." });
      return;
    }

    const schema = z.object({
      username: z.string().max(20).regex(/^[a-z0-9_]*$/i).optional().or(z.literal("")).optional(),
      fingerprint: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid username. Up to 20 characters, letters/numbers/underscores only." }); return; }

    const { email, referralCode, passwordHash: storedPasswordHash } = record;
    const ip = getClientIP(req);

    const ipCheck = await canRegisterWithIP(ip, parsed.data.fingerprint || "");
    if (!ipCheck.allowed) { res.status(403).json({ error: ipCheck.reason }); return; }

    const providedUsername = (parsed.data.username || "").trim();
    if (providedUsername && (providedUsername.length < 3 || providedUsername.length > 20)) {
      res.status(400).json({ error: "Username must be 3-20 characters." }); return;
    }

    let uname: string;
    if (!providedUsername) {
      let candidate = `user${crypto.randomBytes(4).toString("hex")}`;
      const exists = await User.findOne({ username: candidate });
      if (exists) candidate = `user${crypto.randomBytes(4).toString("hex")}`;
      uname = candidate;
    } else {
      uname = providedUsername.toLowerCase();
    }

    const [existingEmail, existingUsername] = await Promise.all([
      User.findOne({ email }),
      providedUsername ? User.findOne({ username: uname }) : Promise.resolve(null),
    ]);
    if (existingEmail) { res.status(409).json({ error: "Account already exists. Please login instead." }); return; }
    if (existingUsername) { res.status(409).json({ error: "Username already taken" }); return; }

    await syncDefaultPackages();
    const refCode = generateReferralCode();
    const user = await User.create({
      email,
      username: uname,
      passwordHash: storedPasswordHash || "",
      txCoins: 0,
      referralCode: refCode,
      authProvider: "local",
      currency: "KES",
      currencySet: true,
    });

    pendingTokens.delete(pendingToken);
    await recordIPAndFingerprint(ip, user._id.toString(), parsed.data.fingerprint || "");
    await handleReferral(user._id, referralCode, ip);

    const jwtToken = generateToken(user._id.toString());
    setAuthCookie(res, jwtToken);
    res.json({ token: jwtToken, user: userPayload(user) });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/forgot-password", authRateLimit, async (req, res) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid email" }); return; }
    const { email } = parsed.data;

    if (!isAcceptableEmail(email)) {
      res.status(400).json({ error: "Please use a real email address from a recognised provider." });
      return;
    }

    const quota = await checkEmailQuota(email);
    if (!quota.allowed) {
      res.status(429).json({ error: quota.error });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(404).json({ error: "No account found with this email." });
      return;
    }
    if (!user.passwordHash) {
      res.status(400).json({ error: "This account uses GitHub or email-link login. Use those methods to sign in instead." });
      return;
    }
    if (user.isBanned) {
      res.status(403).json({ error: "Your account has been banned. Contact support." });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    resetTokens.set(resetToken, { userId: user._id.toString(), email: user.email, expires: Date.now() + 30 * 60 * 1000 });

    const resetUrl = `${CLIENT_URL}/auth/reset-password?token=${resetToken}`;
    const { subject, html } = buildEmailHtml("reset", resetUrl, user.username ?? undefined);

    await transporter.sendMail({
      from: MAIL_FROM,
      to: email,
      subject,
      html,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Failed to send reset link. Please try again." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const schema = z.object({ token: z.string(), password: z.string().min(8, "Password must be at least 8 characters") });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" }); return; }
    const { token, password } = parsed.data;

    const record = resetTokens.get(token);
    if (!record || record.expires < Date.now()) {
      resetTokens.delete(token);
      res.status(400).json({ error: "Reset link expired or invalid. Please request a new one." });
      return;
    }
    resetTokens.delete(token);

    const hash = await bcrypt.hash(password, 12);
    await User.findByIdAndUpdate(record.userId, { passwordHash: hash });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/google", (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) { res.redirect(`${CLIENT_URL}/login?error=google_not_configured`); return; }
  const referralCode = (req.query.ref as string) || "";
  const intent = (req.query.intent as string) || "signup";
  const state = Buffer.from(JSON.stringify({ referralCode, csrf: crypto.randomBytes(8).toString("hex"), intent })).toString("base64url");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${CLIENT_URL}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "offline",
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get("/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query as { code: string; state: string };
    if (!code) { res.redirect(`${CLIENT_URL}/login?error=google_denied`); return; }

    let referralCode = "";
    let intent = "signup";
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
      referralCode = decoded.referralCode || "";
      intent = decoded.intent || "signup";
    } catch { }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: `${CLIENT_URL}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json() as any;
    if (!tokenData.access_token) { res.redirect(`${CLIENT_URL}/login?error=google_token`); return; }

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json() as any;

    const primaryEmail = profile.email;
    if (!primaryEmail) { res.redirect(`${CLIENT_URL}/login?error=google_no_email`); return; }

    const ip = getClientIP(req);
    let isNew = false;
    let user = await User.findOne({ googleId: String(profile.id) });

    if (!user) {
      user = await User.findOne({ email: primaryEmail });
      if (user) {
        await User.findByIdAndUpdate(user._id, { googleId: String(profile.id), avatarUrl: profile.picture || user.avatarUrl || "" });
        user = await User.findById(user._id);
      } else {
        if (intent === "login") { res.redirect(`${CLIENT_URL}/login?error=google_no_account`); return; }
        const ipCheck = await canRegisterWithIP(ip, "");
        if (!ipCheck.allowed) { res.redirect(`${CLIENT_URL}/login?error=google_server`); return; }

        await syncDefaultPackages();
        const refCode = generateReferralCode();
        let username = (profile.name || "").toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 20);
        if (username.length < 3) username = `user${crypto.randomBytes(3).toString("hex")}`;
        const existingUsername = await User.findOne({ username });
        if (existingUsername) username = `${username.slice(0, 16)}${crypto.randomBytes(2).toString("hex")}`;

        user = await User.create({
          email: primaryEmail,
          username,
          googleId: String(profile.id),
          avatarUrl: profile.picture || "",
          passwordHash: "",
          txCoins: 0,
          referralCode: refCode,
          authProvider: "google",
          currency: "KES",
          currencySet: true,
        });
        isNew = true;
        await recordIPAndFingerprint(ip, user._id.toString(), "");
        await handleReferral(user._id, referralCode, ip);
      }
    }

    if (!user) { res.redirect(`${CLIENT_URL}/login?error=google_server`); return; }
    if (user.isBanned) { res.redirect(`${CLIENT_URL}/login?error=banned`); return; }

    const jwtToken = generateToken(user._id.toString());
    setAuthCookie(res, jwtToken);
    res.redirect(`${CLIENT_URL}/auth/github/success?token=${jwtToken}&provider=google${isNew ? "&is_new=1" : ""}`);
  } catch (err) {
    console.error("Google OAuth error:", err);
    res.redirect(`${CLIENT_URL}/login?error=google_server`);
  }
});

router.get("/github", (req, res) => {
  const referralCode = (req.query.ref as string) || "";
  const intent = (req.query.intent as string) || "signup";
  const state = Buffer.from(JSON.stringify({ referralCode, csrf: crypto.randomBytes(8).toString("hex"), intent })).toString("base64url");
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID || "",
    redirect_uri: `${CLIENT_URL}/api/auth/github/callback`,
    scope: "user:email",
    state,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

router.get("/github/callback", async (req, res) => {
  try {
    const { code, state } = req.query as { code: string; state: string };
    if (!code) { res.redirect(`${CLIENT_URL}/login?error=github_denied`); return; }

    let referralCode = "";
    let intent = "signup";
    try {
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
      referralCode = decoded.referralCode || "";
      intent = decoded.intent || "signup";
    } catch { }

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenRes.json() as any;
    if (!tokenData.access_token) { res.redirect(`${CLIENT_URL}/login?error=github_token`); return; }

    const [profileRes, emailsRes] = await Promise.all([
      fetch("https://api.github.com/user", { headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "Bmb-Tech-Hosting" } }),
      fetch("https://api.github.com/user/emails", { headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "Bmb-Tech-Hosting" } }),
    ]);
    const profile = await profileRes.json() as any;
    const emails = await emailsRes.json() as any[];

    const primaryEmail = (emails.find((e: any) => e.primary && e.verified) || emails[0])?.email || profile.email;
    if (!primaryEmail) { res.redirect(`${CLIENT_URL}/login?error=github_no_email`); return; }

    const ip = getClientIP(req);
    let isNew = false;
    let user = await User.findOne({ githubId: String(profile.id) });

    if (!user) {
      user = await User.findOne({ email: primaryEmail });
      if (user) {
        await User.findByIdAndUpdate(user._id, { githubId: String(profile.id), avatarUrl: profile.avatar_url || "" });
      } else {
        if (intent === "login") { res.redirect(`${CLIENT_URL}/login?error=github_no_account`); return; }
        const ipCheck = await canRegisterWithIP(ip, "");
        if (!ipCheck.allowed) { res.redirect(`${CLIENT_URL}/login?error=github_server`); return; }

        await syncDefaultPackages();
        const refCode = generateReferralCode();
        let username = (profile.login || "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);
        if (username.length < 3) username = `user${crypto.randomBytes(3).toString("hex")}`;
        const existingUsername = await User.findOne({ username });
        if (existingUsername) username = `${username}${crypto.randomBytes(2).toString("hex")}`;

        user = await User.create({
          email: primaryEmail,
          username,
          githubId: String(profile.id),
          avatarUrl: profile.avatar_url || "",
          passwordHash: "",
          txCoins: 0,
          referralCode: refCode,
          authProvider: "github",
          currency: "KES",
          currencySet: true,
        });
        isNew = true;
        await recordIPAndFingerprint(ip, user._id.toString(), "");
        await handleReferral(user._id, referralCode, ip);
      }
    }

    if (user.isBanned) { res.redirect(`${CLIENT_URL}/login?error=banned`); return; }

    const jwtToken = generateToken(user._id.toString());
    setAuthCookie(res, jwtToken);
    res.redirect(`${CLIENT_URL}/auth/github/success?token=${jwtToken}&provider=github${isNew ? "&is_new=1" : ""}`);
  } catch (err) {
    console.error("GitHub OAuth error:", err);
    res.redirect(`${CLIENT_URL}/login?error=github_server`);
  }
});

router.get("/me", authGuard, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.user?._id);
    if (!user) { res.status(401).json({ error: "User not found" }); return; }
    res.json({ user: userPayload(user) });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ success: true });
});

router.delete("/me", authGuard, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
    const { deleteApp } = await import("../services/heroku.js");
    const userBots = await Bot.find({ userId });
    await Promise.all(userBots.map(async b => { try { await deleteApp(b.herokuAppName); } catch {} }));
    await Bot.deleteMany({ userId });
    const deleted = await User.findByIdAndDelete(userId);
    if (!deleted) { res.status(404).json({ error: "User not found" }); return; }
    res.clearCookie("token");
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
