import type {Request , Response} from "express"
import { fileTypeFromBuffer } from "file-type";
import { randomUUID } from "node:crypto";
import { uploadToCloudinary } from "../lib/storage";
import { prisma } from "../lib/prisma";
import { inngest } from "../lib/inngest";

export const handleUpload = async (req: Request, res: Response) => {
    const user = (req as any).user
    const { chatId } = req.body;

    if(!req.file) return res.status(400).json({error: "No file provided"});
    if(!chatId) return res.status(400).json({error: "chatId required"});

    const mime = await fileTypeFromBuffer(req.file.buffer)
    if( !mime || mime.mime !== "application/pdf")return res.status(400).json({error: "Invalid file type"});

    const fileId = randomUUID();
    const url = await uploadToCloudinary(req.file.buffer, fileId);

    const file = await prisma.file.create({
        data: {
            id: fileId,
            name: req.file.originalname,
            path: url,
            chatId: chatId,
            embeddingStatus: "EMBEDDING_PENDING",
        }
    })

    // fire inngest event
    await inngest.send({
        name: "file/uploaded",
        data: { fileId: file.id, chatId },
    })

    return res.status(201).json({
        fileId: file.id,
        status: "EMBEDDING_PENDING"
    })
}