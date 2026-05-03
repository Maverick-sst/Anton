import express from "express"
import { requireDbUser } from "../middleware/requireDbUser"
import { handleChat } from "../controllers/chat.controller"

const router = express.Router()
router.post("/", requireDbUser, handleChat)
export default router