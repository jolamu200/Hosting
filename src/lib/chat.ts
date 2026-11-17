/** Client helpers for Community Chat + profile photos. */

export type ChatRole = "owner" | "admin" | "user";

export interface ChatUser {
  id: string;
  username: string;
  avatarUrl: string;
  role: ChatRole;
}

export interface ChatReply {
  id: string;
  username: string;
  text: string;
  hasImage: boolean;
  deleted: boolean;
}

export interface ChatMessage {
  id: string;
  text: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  pinned: boolean;
  replyTo: ChatReply | null;
  user: ChatUser;
}

export interface ChatPage {
  messages: ChatMessage[];
  pinned: ChatMessage | null;
  hasMore: boolean;
  serverTime: string;
  canModerate: boolean;
}

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const CHAT_IMAGE_MAX = 5 * 1024 * 1024;
export const AVATAR_MAX = 2 * 1024 * 1024;

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}`, ...extra } : { ...extra };
}

async function parse<T>(res: Response): Promise<T> {
  let data: unknown = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return data as T;
}

/** Reads `avatarUrl` from any user-shaped object without depending on the User type. */
export function userAvatar(u: object | null | undefined): string {
  const a = (u as { avatarUrl?: unknown } | null | undefined)?.avatarUrl;
  return typeof a === "string" ? a : "";
}

export async function fetchMessages(opts: { after?: string; before?: string; limit?: number } = {}): Promise<ChatPage> {
  const q = new URLSearchParams();
  if (opts.after) q.set("after", opts.after);
  if (opts.before) q.set("before", opts.before);
  if (opts.limit) q.set("limit", String(opts.limit));
  const res = await fetch(`/api/chat/messages?${q.toString()}`, { headers: authHeaders() });
  return parse<ChatPage>(res);
}

export async function sendMessage(body: { text: string; imageId?: string; replyTo?: string }): Promise<ChatMessage> {
  const res = await fetch("/api/chat/messages", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  const data = await parse<{ message: ChatMessage }>(res);
  return data.message;
}

export async function uploadChatImage(file: File): Promise<{ id: string; url: string }> {
  const res = await fetch("/api/chat/images", {
    method: "POST",
    headers: authHeaders({ "Content-Type": file.type }),
    body: file,
  });
  return parse<{ id: string; url: string }>(res);
}

export async function deleteMessage(id: string): Promise<void> {
  const res = await fetch(`/api/chat/messages/${id}`, { method: "DELETE", headers: authHeaders() });
  await parse<{ success: boolean }>(res);
}

export async function togglePin(id: string): Promise<ChatMessage | null> {
  const res = await fetch(`/api/chat/messages/${id}/pin`, { method: "POST", headers: authHeaders() });
  const data = await parse<{ pinned: ChatMessage | null }>(res);
  return data.pinned;
}

/** Crops to a centred square and shrinks so profile photos stay tiny. */
export async function prepareAvatar(file: File, size = 320): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not process this image.");
  ctx.fillStyle = "#101c20";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Could not process this image."))), "image/jpeg", 0.86);
  });
}

export async function uploadAvatar(blob: Blob): Promise<string> {
  const res = await fetch("/api/auth/avatar", {
    method: "POST",
    headers: authHeaders({ "Content-Type": blob.type || "image/jpeg" }),
    body: blob,
  });
  const data = await parse<{ avatarUrl: string }>(res);
  return data.avatarUrl;
}

export async function removeAvatar(): Promise<void> {
  const res = await fetch("/api/auth/avatar", { method: "DELETE", headers: authHeaders() });
  await parse<{ success: boolean }>(res);
}
