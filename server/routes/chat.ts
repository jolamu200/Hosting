import express, { Router, type Request, type Response, type NextFunction } from "express";
import mongoose, { type Types } from "mongoose";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { ChatMessage } from "../models/ChatMessage.js";
import { Media } from "../models/Media.js";
import { User } from "../models/User.js";
import { authGuard, type AuthRequest } from "../middleware/auth.js";
import { banCheck } from "../middleware/banCheck.js";
import { isAdminEmail } from "../config.js";
import { sniffImage, IMAGE_MIME_TYPES } from "../utils/image.js";

const router = Router();
router.use(authGuard);
router.use(banCheck);

type Role = "owner" | "admin" | "user";

interface RawMsg {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  text?: string;
  imageId?: Types.ObjectId | null;
  replyTo?: Types.ObjectId | null;
  pinned?: boolean;
  deleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface RawUser {
  _id: Types.ObjectId;
  username?: string;
  email?: string;
  avatarUrl?: string;
  isModerator?: boolean;
}

const roleOf = (u: { email?: string; isModerator?: boolean }): Role =>
  isAdminEmail(u.email) ? "owner" : u.isModerator ? "admin" : "user";

// Never expose e-mail addresses: fall back to an anonymous handle.
const nameOf = (u: RawUser | undefined, fallbackId: Types.ObjectId): string =>
  u?.username || `user${String(fallbackId).slice(-4)}`;

const OID_RE = /^[a-f0-9]{24}$/;
const snippet = (t: string, n = 120) => (t.length > n ? `${t.slice(0, n)}…` : t);

async function toDtos(docs: RawMsg[]) {
  const replyIds = [...new Set(docs.map(d => (d.replyTo ? String(d.replyTo) : "")).filter(Boolean))];
  const replyDocs = replyIds.length
    ? await ChatMessage.find({ _id: { $in: replyIds } }).lean<RawMsg[]>()
    : [];
  const userIds = [...new Set([...docs, ...replyDocs].map(d => String(d.userId)))];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select("username email avatarUrl isModerator").lean<RawUser[]>()
    : [];
  const userMap = new Map(users.map(u => [String(u._id), u]));
  const replyMap = new Map(replyDocs.map(d => [String(d._id), d]));

  return docs.map(d => {
    const author = userMap.get(String(d.userId));
    const reply = d.replyTo ? replyMap.get(String(d.replyTo)) : undefined;
    const gone = !!d.deleted;
    return {
      id: String(d._id),
      text: gone ? "" : d.text || "",
      imageUrl: !gone && d.imageId ? `/api/media/${d.imageId}` : "",
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      deleted: gone,
      pinned: !!d.pinned && !gone,
      replyTo: d.replyTo
        ? {
            id: String(d.replyTo),
            username: reply ? nameOf(userMap.get(String(reply.userId)), reply.userId) : "unknown",
            text: reply && !reply.deleted ? snippet(reply.text || "") : "",
            hasImage: !!(reply && !reply.deleted && reply.imageId),
            deleted: !reply || !!reply.deleted,
          }
        : null,
      user: {
        id: String(d.userId),
        username: nameOf(author, d.userId),
        avatarUrl: author?.avatarUrl || "",
        role: author ? roleOf(author) : ("user" as Role),
      },
    };
  });
}

router.get("/messages", async (req: AuthRequest, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 100);
    const afterRaw = typeof req.query.after === "string" ? new Date(req.query.after) : null;
    const beforeRaw = typeof req.query.before === "string" ? new Date(req.query.before) : null;
    const after = afterRaw && !isNaN(afterRaw.getTime()) ? afterRaw : null;
    const before = beforeRaw && !isNaN(beforeRaw.getTime()) ? beforeRaw : null;

    let docs: RawMsg[];
    let hasMore = false;
    if (after) {
      // Polling: everything created / edited / deleted / (un)pinned since `after`
      docs = await ChatMessage.find({ updatedAt: { $gte: after } }).sort({ updatedAt: 1 }).limit(200).lean<RawMsg[]>();
    } else {
      const filter: Record<string, unknown> = { deleted: false };
      if (before) filter.createdAt = { $lt: before };
      const page = await ChatMessage.find(filter).sort({ createdAt: -1 }).limit(limit + 1).lean<RawMsg[]>();
      hasMore = page.length > limit;
      docs = page.slice(0, limit).reverse();
    }

    const pinnedDoc = await ChatMessage.findOne({ pinned: true, deleted: false }).sort({ updatedAt: -1 }).lean<RawMsg>();
    const [messages, pinnedList] = await Promise.all([toDtos(docs), pinnedDoc ? toDtos([pinnedDoc]) : Promise.resolve([])]);

    res.json({
      messages,
      pinned: pinnedList[0] ?? null,
      hasMore,
      serverTime: new Date().toISOString(),
      canModerate: roleOf(req.user!) !== "user",
    });
  } catch {
    res.status(500).json({ error: "Could not load the chat. Please try again." });
  }
});

const sendLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyGenerator: req => String((req as AuthRequest).user?._id ?? "anon"),
  message: { error: "You're sending messages too fast. Please slow down a little." },
  standardHeaders: true,
  legacyHeaders: false,
});

const imageLimiter = rateLimit({
  windowMs: 60_000,
  max: 8,
  keyGenerator: req => String((req as AuthRequest).user?._id ?? "anon"),
  message: { error: "Too many image uploads. Please wait a moment." },
  standardHeaders: true,
  legacyHeaders: false,
});

const sendSchema = z.object({
  text: z.string().max(2000).default(""),
  imageId: z.string().regex(OID_RE).optional(),
  replyTo: z.string().regex(OID_RE).optional(),
});

router.post("/messages", sendLimiter, async (req: AuthRequest, res) => {
  try {
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Message is too long (max 2000 characters)." }); return; }
    const me = req.user!;
    const text = parsed.data.text
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/\n{4,}/g, "\n\n\n")
      .trim();
    const { imageId, replyTo } = parsed.data;
    if (!text && !imageId) { res.status(400).json({ error: "Write a message or attach a picture." }); return; }

    if (imageId) {
      const own = await Media.exists({ _id: imageId, userId: me._id, kind: "chat" });
      if (!own) { res.status(400).json({ error: "Image not found. Please upload it again." }); return; }
    }
    if (replyTo) {
      const target = await ChatMessage.exists({ _id: replyTo, deleted: false });
      if (!target) { res.status(400).json({ error: "The message you are replying to no longer exists." }); return; }
    }

    const created = await ChatMessage.create({
      userId: me._id,
      text,
      imageId: imageId ?? null,
      replyTo: replyTo ?? null,
    });
    const [dto] = await toDtos([created.toObject() as unknown as RawMsg]);
    res.json({ message: dto });
  } catch {
    res.status(500).json({ error: "Could not send your message. Please try again." });
  }
});

router.post(
  "/images",
  imageLimiter,
  express.raw({ type: IMAGE_MIME_TYPES, limit: "5mb" }),
  async (req: AuthRequest, res) => {
    try {
      const buf: unknown = req.body;
      if (!Buffer.isBuffer(buf) || buf.length === 0) {
        res.status(400).json({ error: "Only JPEG, PNG or WebP images up to 5 MB are allowed." });
        return;
      }
      const type = sniffImage(buf);
      if (!type) { res.status(400).json({ error: "That file is not a valid JPEG, PNG or WebP image." }); return; }
      const doc = await Media.create({ userId: req.user!._id, kind: "chat", contentType: type, size: buf.length, data: buf });
      res.json({ id: String(doc._id), url: `/api/media/${doc._id}` });
    } catch {
      res.status(500).json({ error: "Image upload failed. Please try again." });
    }
  },
);

router.delete("/messages/:id", async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) { res.status(404).json({ error: "Message not found" }); return; }
    const msg = await ChatMessage.findById(id);
    if (!msg || msg.deleted) { res.status(404).json({ error: "Message not found" }); return; }

    const me = req.user!;
    const myRole = roleOf(me);
    const isMine = String(msg.userId) === String(me._id);
    if (!isMine) {
      if (myRole === "user") { res.status(403).json({ error: "You can only delete your own messages." }); return; }
      const author = await User.findById(msg.userId).select("email").lean<{ email?: string }>();
      if (author && roleOf(author) === "owner" && myRole !== "owner") {
        res.status(403).json({ error: "Only the owner can delete the owner's messages." });
        return;
      }
    }

    const imageId = msg.imageId;
    msg.deleted = true;
    msg.pinned = false;
    msg.text = "";
    msg.imageId = null;
    await msg.save();
    if (imageId) await Media.deleteOne({ _id: imageId });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Could not delete the message." });
  }
});

router.post("/messages/:id/pin", async (req: AuthRequest, res) => {
  try {
    if (roleOf(req.user!) === "user") { res.status(403).json({ error: "Only the owner and admins can pin messages." }); return; }
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) { res.status(404).json({ error: "Message not found" }); return; }
    const msg = await ChatMessage.findById(id);
    if (!msg || msg.deleted) { res.status(404).json({ error: "Message not found" }); return; }

    if (msg.pinned) {
      msg.pinned = false;
      await msg.save();
      res.json({ pinned: null });
      return;
    }
    await ChatMessage.updateMany({ pinned: true }, { $set: { pinned: false } });
    msg.pinned = true;
    await msg.save();
    const [dto] = await toDtos([msg.toObject() as unknown as RawMsg]);
    res.json({ pinned: dto });
  } catch {
    res.status(500).json({ error: "Could not pin the message." });
  }
});

// Friendly JSON for upload errors (e.g. image over 5 MB).
router.use((err: { type?: string; status?: number }, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) { next(err); return; }
  if (err?.type === "entity.too.large") { res.status(413).json({ error: "Image is too large (max 5 MB)." }); return; }
  res.status(err?.status && err.status < 500 ? err.status : 400).json({ error: "Upload failed. Please try another image." });
});

export default router;
