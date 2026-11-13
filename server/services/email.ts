import nodemailer from "nodemailer";
import { MAIL_FROM, SITE_HOST, SITE_URL } from "../config.js";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.resend.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "resend",
    pass: process.env.SMTP_PASS,
  },
});

function wrap(body: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#111827;border:1px solid #1f2937;border-radius:16px;overflow:hidden;max-width:520px;width:100%">
<tr><td style="padding:28px 32px;background:linear-gradient(135deg,#1e1b4b,#0f172a);border-bottom:1px solid #1f2937;text-align:center">
<span style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px"> Bmb Tech Hosting</span>
</td></tr>
<tr><td style="padding:36px 32px">${body}</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #1f2937;text-align:center">
<p style="margin:0;font-size:12px;color:#4b5563">This is an automated service notification from Bmb Tech Hosting.</p>
<p style="margin:6px 0 0;font-size:12px;color:#374151">Regards, <strong style="color:#9ca3af">Bmb Tech</strong> &mdash; Bmb Tech Hosting &middot; <a href="${SITE_URL}" style="color:#6b7280;text-decoration:none">${SITE_HOST}</a></p>
</td></tr>
</table></td></tr></table>
</body></html>`;
}

export async function sendBotExpiryEmail(to: string, appName: string, daysLeft: number): Promise<void> {
  const urgency = daysLeft <= 3 ? "⚠️ Urgent:" : "⏰";
  const subject = `${urgency} Your bot "${appName}" expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} — Bmb Tech Hosting`;
  const btnStyle = `display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border-radius:10px;text-decoration:none;font-size:15px;font-weight:700`;
  const html = wrap(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#fff">Your Bot Is Expiring Soon</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;line-height:1.6">
      Your bot <strong style="color:#d1d5db">${appName}</strong> will expire in
      <strong style="color:${daysLeft <= 3 ? "#f87171" : "#fbbf24"}">${daysLeft} day${daysLeft !== 1 ? "s" : ""}</strong>.
      After expiry there is a <strong style="color:#d1d5db">48-hour grace period</strong> before it is permanently deleted.
    </p>
    <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6">Renew now to keep your bot running without interruption.</p>
    <a href="${SITE_URL}/mybots" style="${btnStyle}">Renew Bot &rarr;</a>
  `);
  await transporter.sendMail({ from: MAIL_FROM, to, subject, html });
}

export async function sendPanelExpiryEmail(to: string, planName: string, daysLeft: number): Promise<void> {
  const urgency = daysLeft <= 3 ? "⚠️ Urgent:" : "⏰";
  const subject = `${urgency} Your panel "${planName}" expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} — Bmb Tech Hosting`;
  const btnStyle = `display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border-radius:10px;text-decoration:none;font-size:15px;font-weight:700`;
  const html = wrap(`
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#fff">Your Panel Is Expiring Soon</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#9ca3af;line-height:1.6">
      Your panel plan <strong style="color:#d1d5db">${planName}</strong> will expire in
      <strong style="color:${daysLeft <= 3 ? "#f87171" : "#fbbf24"}">${daysLeft} day${daysLeft !== 1 ? "s" : ""}</strong>.
      After expiry it will be <strong style="color:#d1d5db">permanently deleted</strong> without a grace period.
    </p>
    <p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.6">Purchase a new panel plan now to continue without interruption.</p>
    <a href="${SITE_URL}/services/panels/purchasepanel" style="${btnStyle}">Get a New Panel &rarr;</a>
  `);
  await transporter.sendMail({ from: MAIL_FROM, to, subject, html });
}
