import express from "express"
import { requireDbUser } from "../middleware/requireDbUser"
import {
  handleChat,
  createChat,
  getChats,
  getChatById,
  deleteChat,
} from "../controllers/chat.controller"

const router = express.Router()

router.post("/create", requireDbUser, createChat)
router.get("/", requireDbUser, getChats)
router.get("/:id", requireDbUser, getChatById)
router.delete("/:id", requireDbUser, deleteChat)
router.post("/", requireDbUser, handleChat)

export default router