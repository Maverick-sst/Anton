import express from "express";
import type { Request, Response } from "express";
import { requireDbUser } from "../middleware/requireDbUser";

const router = express.Router();

type RequestWithUser = Request & {
  user?: {
    id: string;
    clerkId: string;
    email: string;
  };
};

router.get("/me", requireDbUser, (req: RequestWithUser, res: Response) => {
  res.json({
    userId: req.user?.clerkId,
    message: "You are authenticated 🚀",
  });
});

export default router;