import mongoose from "mongoose";

/**
 * Small binary store for user-uploaded images (profile photos + chat pictures).
 * Heroku's filesystem is ephemeral, so the bytes live in MongoDB and are served
 * by GET /api/media/:id.
 */
const MediaSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  kind: { type: String, enum: ["avatar", "chat"], required: true },
  contentType: { type: String, required: true },
  size: { type: Number, required: true },
  data: { type: Buffer, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Media = mongoose.model("Media", MediaSchema);
