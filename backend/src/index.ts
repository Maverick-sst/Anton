import dotenv from 'dotenv';
dotenv.config();


import express from 'express';
import cors from 'cors';
import secureRoutes from "./routes/secure";
import webhookRoutes from "./routes/webhook";
import uploadRoutes from "./routes/upload.route";
import chatRoutes from "./routes/chat.route";
import { clerkMiddleware } from '@clerk/express';
import { serve } from "inngest/express";
import { inngest } from './lib/inngest';
import { processFile } from './inngest/functions/processFile';

const app = express();
app.use(clerkMiddleware())
app.use(cors());
const PYTHON_URL = process.env.PYTHON_SERVICE_URL!

app.use("/api/webhooks", webhookRoutes);

app.use(express.json({ limit: "10mb" }))

const PORT = process.env.PORT || 3000;

app.get("/health", (req, res) => {
    res.json({
        status: "Backend is running"
    })
});

if (PYTHON_URL) {
    setInterval(async () => {
        try {
            await fetch(`${PYTHON_URL}/health`)
            console.log("[PYTHON_SERVICE] pinged successfully")
        } catch (error) {
            console.log("[PYTHON_SERVICE] ping failed: ", error)
        }
    }, 1000 * 60 * 10)
}
app.use("/api", secureRoutes)

app.use("/api/upload", uploadRoutes)

app.use("/api/inngest", serve({ client: inngest, functions: [processFile] }))

app.use("/api/chat", chatRoutes)

app.use((err: any, req: any, res: any, next: any) => {
    console.error("[Global Error Handler]", err);
    res.status(err.status || 500).json({
        error: err.message || "Internal server error",
        details: typeof err === "object" ? err : undefined
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port: ${PORT}`)
});

