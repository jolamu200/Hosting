import "dotenv/config";

/**
 * Central, env-driven configuration for Bmb Tech Hosting.
 * Everything that used to be hard-coded (admin e-mail, support contacts,
 * public URLs, brand name ...) is read from .env here.
 */
const clean = (v: string | undefined, fallback = ""): string => (v ?? fallback).trim();

export const APP_NAME = clean(process.env.APP_NAME, "Bmb Tech Hosting");
export const APP_SHORT_NAME = clean(process.env.APP_SHORT_NAME, "Bmb Tech");
export const SITE_URL = clean(process.env.SITE_URL || process.env.APP_URL || process.env.CLIENT_URL, "https://bmbtech.zone.id").replace(/\/+$/, "");
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

/** The single super-admin account. Set ADMIN_EMAIL in .env. */
export const ADMIN_EMAIL = clean(process.env.ADMIN_EMAIL).toLowerCase();
export const isAdminEmail = (email?: string | null): boolean =>
  !!ADMIN_EMAIL && !!email && email.trim().toLowerCase() === ADMIN_EMAIL;

export const SUPPORT_TELEGRAM = clean(process.env.SUPPORT_TELEGRAM, "bmb_tech").replace(/^@/, "");
export const SUPPORT_WHATSAPP = clean(process.env.SUPPORT_WHATSAPP, "255767862457");
export const WHATSAPP_CHANNEL_URL = clean(process.env.WHATSAPP_CHANNEL_URL, "https://whatsapp.com/channel/0029VawO6hgF6sn7k3SuVU3z");

// Sender address. The domain MUST be verified in your mail provider (Resend).
// Set MAIL_FROM in .env / Heroku Config Vars, e.g.  "Bmb Tech Hosting" <auth@bmbtech.online>
export const MAIL_FROM = clean(
  process.env.MAIL_FROM,
  `"${APP_NAME}" <${clean(process.env.SMTP_FROM_EMAIL, `auth@${SITE_HOST}`)}>`,
);
export const OG_IMAGE_URL = clean(process.env.IMAGE_URL, "https://url.bmbxmd.workers.dev/KC0DC3.png");

/** Heroku team(s) used when no team has been added in the admin panel yet. */
export const DEFAULT_HEROKU_TEAM = clean(process.env.HEROKU_TEAM, "");

/** Default bot template (seeded on first start). All optional. */
export const DEFAULT_BOT_NAME = clean(process.env.DEFAULT_BOT_NAME, "Bmb-Bot");
export const DEFAULT_BOT_REPO = clean(process.env.DEFAULT_BOT_REPO, "");
export const DEFAULT_BOT_SESSION_URL = clean(process.env.DEFAULT_BOT_SESSION_URL, "");
export const DEFAULT_BOT_SLUG = clean(process.env.DEFAULT_BOT_SLUG, "bmb-bot");
