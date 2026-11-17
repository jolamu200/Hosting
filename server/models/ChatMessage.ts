import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, default: "", maxlength: 2000 },
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Media", default: null },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "ChatMessage", default: null },
    pinned: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

ChatMessageSchema.index({ createdAt: -1 });
ChatMessageSchema.index({ updatedAt: 1 });

export const ChatMessage = mongoose.model("ChatMessage", ChatMessageSchema);
