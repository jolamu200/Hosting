import { Router } from "express";
import { apiKeyGuard } from "../middleware/apiKeyAuth.js";
import type { AuthRequest } from "../middleware/auth.js";

const router = Router();

router.get("/me", apiKeyGuard, async (req: AuthRequest, res) => {
  const user = req.user!;
  res.json({
    success: true,
    data: {
      email: user.email,
      txCoins: user.txCoins,
      currency: user.currency || "KES",
      apiCallCount: user.apiCallCount || 0,
    },
  });
});

export default router;
