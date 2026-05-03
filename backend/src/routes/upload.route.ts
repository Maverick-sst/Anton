import express from "express"
import multer from "multer"
import { rateLimit } from "express-rate-limit"
import { requireDbUser } from "../middleware/requireDbUser"
import { handleUpload } from "../controllers/upload.controller"

const uploadLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 2,
    keyGenerator: (req) => (req as any).user?.id ?? req["ip"],
    message: { error: "Upload limit reached. Max 2 PDFs per minute." },
    standardHeaders: true,
    legacyHeaders: false,
})

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {fileSize: 10 * 1024 * 1024},
    fileFilter: (_, file, cb) => {
        if(file.mimetype === "application/pdf") cb(null,true)
        else cb(new Error("Only PDFs are allowed"))
    },
})
const router = express.Router()

router.post("/", requireDbUser, uploadLimiter, upload.single("file"), handleUpload)
export default router;