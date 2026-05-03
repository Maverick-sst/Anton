import express from "express"
import multer from "multer"
import { requireDbUser } from "../middleware/requireDbUser"
import { handleUpload } from "../controllers/upload.controller"

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {fileSize: 10 * 1024 * 1024},
    fileFilter: (_, file, cb) => {
        if(file.mimetype === "application/pdf") cb(null,true)
        else cb(new Error("Only PDFs are allowed"))
    },
})
const router = express.Router()

router.post("/",requireDbUser, upload.single("file"), handleUpload )
export default router;