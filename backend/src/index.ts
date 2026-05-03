import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import secureRoutes from "./routes/secure";
import webhookRoutes from "./routes/webhook";
import uploadRoutes from "./routes/upload.route";
import chatRoutes   from "./routes/chat.route";


import { clerkMiddleware } from '@clerk/express';
import { serve } from "inngest/express";
import { inngest } from './lib/inngest';
import { processFile } from './inngest/functions/processFile';

dotenv.config();

const app = express();
app.use(clerkMiddleware())
app.use(cors());

app.use("/api/webhooks", webhookRoutes);

app.use(express.json({ limit: "10mb" }))

const PORT = process.env.PORT  || 3000; 

app.get("/health", (req,res) => {
    res.json({
        status:"Backend is running"
    })
});

app.use("/api", secureRoutes)

app.use("/api/upload", uploadRoutes )

app.use("/api/inngest", serve({client: inngest, functions: [processFile]}))

app.use("/api/chat", chatRoutes)

app.listen(PORT, ()=> {
    console.log(`Server running on port: ${PORT}`)
});

