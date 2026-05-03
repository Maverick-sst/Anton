import { inngest } from "../../lib/inngest"
import { prisma } from "../../lib/prisma"
import fetch from "node-fetch"
import FormData from "form-data"
import OpenAI from "openai"
import { v2 as cloudinary } from "cloudinary"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
const EMBEDDING_BATCH_SIZE = 50

export const processFile = inngest.createFunction(
  { id: "process-file", retries: 3, concurrency: 1, triggers: { event: "file/uploaded" } },
  async ({ event, step }) => {
    const { fileId, chatId } = event.data

    try {
      if (!fileId || typeof fileId !== "string") {
        throw new Error("Invalid event payload: 'fileId' is required")
      }
      if (!chatId || typeof chatId !== "string") {
        throw new Error("Invalid event payload: 'chatId' is required")
      }

      const fileRecord = await step.run("fetch-file-record", async () => {
        return prisma.file.findUniqueOrThrow({ where: { id: fileId } })
      })

      // 1. Give the Python service a moment to wake up if it's on a cold start
      await step.sleep("warmup-python", "3s")

      const chunks = await step.run("fetch-and-parse-pdf", async () => {
        // 2. Fetch the buffer
        const pdfRes = await fetch(fileRecord.path)
        if (!pdfRes.ok) throw new Error(`Failed to fetch file (${pdfRes.status})`)
        const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer())

        // 2. Prepare Form Data
        const form = new FormData()
        form.append("file", pdfBuffer, { filename: "file.pdf", contentType: "application/pdf" })

        // 3. Call Python Parser
        const res = await fetch(`${process.env.PYTHON_SERVICE_URL}/parse`, {
          method: "POST",
          body: form,
          headers: form.getHeaders(),
        })

        const raw = await res.text()
        if (!res.ok) throw new Error(`Python parser failed (${res.status}): ${raw}`)

        let data: { chunks: any[] }
        try { data = JSON.parse(raw) } catch {
          throw new Error(`Invalid JSON from parser: ${raw.slice(0, 500)}`)
        }

        if (!Array.isArray(data.chunks)) throw new Error("Missing 'chunks' array")
        return data.chunks
      })

      const chunksWithEmbeddings = await step.run("embed-chunks", async () => {
        const results: Array<{ embedding?: number[] }> = []

        for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
          const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE)
          const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: batch.map(c => c.content),
          })
          results.push(...response.data)
        }

        if (results.length !== chunks.length) {
          throw new Error(`Embedding mismatch: expected ${chunks.length}, got ${results.length}`)
        }

        return chunks.map((chunk, i) => ({
          ...chunk,
          embedding: results[i]?.embedding,
        }))
      })

      await step.run("store-chunks", async () => {
        for (const chunk of chunksWithEmbeddings) {
          const startChar = chunk.startChar ?? 0
          const endChar = chunk.endChar ?? 0
          await prisma.$executeRaw`
            INSERT INTO "DocumentChunk"
              (id, content, "pageNumber", section, "chunkIndex", "tokenCount", "startChar", "endChar", "fileId", embedding)
            VALUES (
              gen_random_uuid(),
              ${chunk.content},
              ${chunk.pageNumber},
              ${chunk.section},
              ${chunk.chunkIndex},
              ${chunk.tokenCount},
              ${startChar},
              ${endChar},
              ${fileId},
              ${JSON.stringify(chunk.embedding)}::vector
            )
          `
        }
      })

      await step.run("update-status", async () => {
        await prisma.file.update({
          where: { id: fileId },
          data: { embeddingStatus: "EMBEDDING_SUCCESSFUL" },
        })
      })
    } catch (err) {
      console.error("[inngest:processFile] error", err)
      await step.run("update-status-error", async () => {
        await prisma.file.update({
          where: { id: fileId },
          data: { embeddingStatus: "EMBEDDING_FAILED" },
        })
      })
      throw err
    }
  }
)