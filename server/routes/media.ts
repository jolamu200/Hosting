import { Router } from "express";
import mongoose from "mongoose";
import { Media } from "../models/Media.js";

const router = Router();

/** Public image endpoint. IDs are unguessable ObjectIds; content is immutable so it caches forever. */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) { res.status(404).end(); return; }
    const doc = await Media.findById(id).select("contentType data");
    if (!doc) { res.status(404).end(); return; }
    const data = doc.data as unknown as Buffer;
    res.setHeader("Content-Type", doc.contentType);
    res.setHeader("Content-Length", String(data.length));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    res.end(data);
  } catch {
    res.status(500).end();
  }
});

export default router;
