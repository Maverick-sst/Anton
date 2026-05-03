import express from "express";
import { Webhook } from "svix";
import { prisma } from "../lib/prisma";

type ClerkUserCreatedEvent = {
  type: "user.created";
  data: {
    id: string;
    email_addresses: Array<{
      email_address: string;
    }>;
  };
};

const isP2002Error = (err: unknown): err is { code: "P2002" } => {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
};

const router = express.Router();

router.post(
  "/clerk",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) throw new Error("Missing webhook secret");

    const headers = req.headers;

    const wh = new Webhook(secret);

    let evt: ClerkUserCreatedEvent;

    try {
      evt = wh.verify(req.body, {
        "svix-id": headers["svix-id"] as string,
        "svix-timestamp": headers["svix-timestamp"] as string,
        "svix-signature": headers["svix-signature"] as string,
      }) as ClerkUserCreatedEvent;
    } catch {
      return res.status(400).send("Invalid signature");
    }

    try {
      if (evt.type === "user.created") {
        const email = evt.data.email_addresses?.[0]?.email_address;
        if (!email) {
          return res.status(400).send("Missing email");
        }
        console.log("[webhook:user.created] received", {
          clerkId: evt.data.id,
          email,
        });

        try {
          const user = await prisma.user.upsert({
            where: { clerkId: evt.data.id },
            update: { email },
            create: {
              clerkId: evt.data.id,
              email,
            },
          });
          console.log("[webhook:user.created] upserted", {
            userId: user.id,
            clerkId: user.clerkId,
            email: user.email,
          });
        } catch (err) {
          if (isP2002Error(err)) {
            const existingByEmail = await prisma.user.findUnique({
              where: { email },
            });

            if (!existingByEmail) {
              console.error("[webhook:user.created] unique conflict but no user found", {
                code: err.code,
                field: "email",
                email,
                clerkId: evt.data.id,
              });
              return res.status(409).send("Email conflict");
            }

            if (existingByEmail.clerkId === evt.data.id) {
              console.log("[webhook:user.created] already linked", {
                userId: existingByEmail.id,
                clerkId: existingByEmail.clerkId,
                email: existingByEmail.email,
              });
              return res.status(200).send("OK");
            }

            console.error("[webhook:user.created] email already linked to another clerkId", {
              email,
              incomingClerkId: evt.data.id,
              existingClerkId: existingByEmail.clerkId,
            });
            return res.status(409).send("Email already linked to another account");
          }

          console.error("[webhook:user.created] db error", {
            name: err instanceof Error ? err.name : "UnknownError",
            message: err instanceof Error ? err.message : String(err),
          });
          return res.status(500).send("DB error");
        }

        return res.status(200).send("OK");
      }
    } catch (err) {
      console.error("[webhook] handler error", {
        name: err instanceof Error ? err.name : "UnknownError",
        message: err instanceof Error ? err.message : String(err),
      });
      res.status(500).send("DB error");
    }
  }
);

export default router;