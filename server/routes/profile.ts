import express, { Router, type Request, type Response, type NextFunction } from "express";
import type { Types } from "mongoose";
import { z } from "zod";
import { User } from "../models/User.js";
import { Media } from "../models/Media.js";
import { authGuard, type AuthRequest } from "../middleware/auth.js";
import { banCheck } from "../middleware/banCheck.js";
import { authRateLimit } from "../middleware/rateLimit.js";
import { isAdminEmail } from "../config.js";
import { sniffImage, IMAGE_MIME_TYPES } from "../utils/image.js";

/**
 * Profile editing. Mounted at /api/auth (after the main auth router), so the
 * existing client call  PATCH /api/auth/username  now has a handler.
 */
const router = Router();

const RESERVED = new Set([
  "admin", "administrator", "owner", "support", "moderator", "mod", "staff",
  "system", "root", "bmb", "bmbtech", "bmb_tech", "official", "help",
]);

const MEDIA_URL_RE = /^\/api\/media\/([a-f0-9]{24})$/;

router.patch("/username", authRateLimit, authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const parsed = z
      .object({ username: z.string().trim().min(3).max(20).regex(/^[a-z0-9_]+$/i) })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Username must be 3–20 characters: letters, numbers and underscores only." });
      return;
    }
    const username = parsed.data.username.toLowerCase();
    const me = req.user!;
    if (me.username === username) { res.json({ success: true, username }); return; }

    const privileged = isAdminEmail(me.email) || me.isModerator === true;
    if (!privileged && RESERVED.has(username)) {
      res.status(400).json({ error: "That username is reserved. Please choose another one." });
      return;
    }

    const taken = await User.findOne({ username, _id: { $ne: me._id } }).select("_id").lean();
    if (taken) { res.status(409).json({ error: "That username is already taken." }); return; }

    try {
      await User.updateOne({ _id: me._id }, { $set: { username } });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        res.status(409).json({ error: "That username is already taken." });
        return;
      }
      throw err;
    }
    res.json({ success: true, username });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

const avatarUpload = express.raw({ type: IMAGE_MIME_TYPES, limit: "2mb" });

async function dropOldAvatar(userId: Types.ObjectId, previousUrl: string) {
  const m = MEDIA_URL_RE.exec(previousUrl || "");
  if (m) await Media.deleteOne({ _id: m[1], userId, kind: "avatar" });
}

router.post("/avatar", authRateLimit, authGuard, banCheck, avatarUpload, async (req: AuthRequest, res) => {
  try {
    const buf: unknown = req.body;
    if (!Buffer.isBuffer(buf) || buf.length === 0) {
      res.status(400).json({ error: "Send a JPEG, PNG or WebP image (max 2 MB)." });
      return;
    }
    const type = sniffImage(buf);
    if (!type) { res.status(400).json({ error: "That file is not a valid JPEG, PNG or WebP image." }); return; }

    const me = req.user!;
    const doc = await Media.create({ userId: me._id, kind: "avatar", contentType: type, size: buf.length, data: buf });
    const avatarUrl = `/api/media/${doc._id}`;
    await User.updateOne({ _id: me._id }, { $set: { avatarUrl } });
    await dropOldAvatar(me._id, me.avatarUrl || "");
    res.json({ success: true, avatarUrl });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/avatar", authRateLimit, authGuard, banCheck, async (req: AuthRequest, res) => {
  try {
    const me = req.user!;
    await User.updateOne({ _id: me._id }, { $set: { avatarUrl: "" } });
    await dropOldAvatar(me._id, me.avatarUrl || "");
    res.json({ success: true, avatarUrl: "" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// Turns body-parser errors (file too large, etc.) into friendly JSON.
router.use((err: { type?: string; status?: number }, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) { next(err); return; }
  if (err?.type === "entity.too.large") { res.status(413).json({ error: "Image is too large (max 2 MB)." }); return; }
  res.status(err?.status && err.status < 500 ? err.status : 400).json({ error: "Upload failed. Please try another image." });
});

export default router;
