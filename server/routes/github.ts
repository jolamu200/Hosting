import { Router } from "express";
import { searchRepos } from "../services/github.js";

const router = Router();

// tiny per-IP limiter: 20 searches / minute
const hits = new Map<string, { n: number; reset: number }>();
router.get("/search", async (req, res) => {
  const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || h.reset < now) hits.set(ip, { n: 1, reset: now + 60_000 });
  else if (++h.n > 20) { res.status(429).json({ error: "Too many searches. Please wait a minute." }); return; }
  if (hits.size > 5000) hits.clear();

  const q = String(req.query.q || "");
  if (q.trim().length < 2) { res.json({ results: [] }); return; }
  try {
    res.json({ results: await searchRepos(q) });
  } catch {
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
