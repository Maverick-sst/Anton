import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { clerkClient } from "../lib/clerk";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type RequestWithUser = Request & {
  user?: Awaited<ReturnType<typeof prisma.user.findUnique>>;
};

export const requireDbUser = async (
  req: RequestWithUser,
  res: Response,
  next: NextFunction
) => {
  const auth = getAuth(req);

  if (!auth.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
  });

  if (!user) {
    await wait(300);
    user = await prisma.user.findUnique({
      where: { clerkId: auth.userId },
    });
  }

  // Always verify the user exists in Clerk (not just in JWT claims/DB), so
  // deleted dashboard users are immediately rejected.
  let email: string | null = null;
  try {
    const clerkUser = await clerkClient.users.getUser(auth.userId);
    email = clerkUser.emailAddresses?.[0]?.emailAddress || null;
  } catch (err) {
    console.error("Clerk fetch failed", err);

    const msg = err instanceof Error ? err.message.toLowerCase() : "";
    const maybeClerkNotFound =
      msg.includes("not found") || msg.includes("resource") || msg.includes("404");

    if (maybeClerkNotFound) {
      return res.status(401).json({
        error: "Session invalid. Please sign in again.",
      });
    }

    return res.status(500).json({ error: "Clerk fetch failed" });
  }

  if (!email) {
    return res.status(503).json({
      error: "User sync failed: no email",
    });
  }

  // Keep DB record in sync with verified Clerk user.
  if (!user) {
    const existingByEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingByEmail) {
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: { clerkId: auth.userId, email },
      });
    } else {
      user = await prisma.user.create({
        data: {
          clerkId: auth.userId,
          email,
        },
      });
    }
  } else if (user.email !== email) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { email },
    });
  }

  req.user = user;
  next();
};