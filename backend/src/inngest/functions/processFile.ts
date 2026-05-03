import { inngest } from "../../lib/inngest"
import { prisma } from "../../lib/prisma"
import fetch from "node-fetch"
import FormData from "form-data"
import OpenAI from "openai"
import { v2 as cloudinary } from "cloudinary"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const EMBEDDING_BATCH_SIZE = 50

export const processFile = inngest.createFunction(
  { id: "process-file", retries: 3 , triggers: { event: "file/uploaded" } },

  async ({ event, step }) => {
    const { fileId, chatId } = event.data

    if (!fileId || typeof fileId !== "string") {
      throw new Error("Invalid event payload: 'fileId' is required")
    }

    if (!chatId || typeof chatId !== "string") {
      throw new Error("Invalid event payload: 'chatId' is required")
    }

    // step 1 → fetch PDF from Cloudinary
    const fileRecord = await step.run("fetch-file-record", async () => {
      return prisma.file.findUniqueOrThrow({ where: { id: fileId } })
    })

    const pdfBuffer = await step.run("fetch-pdf-buffer", async () => {
      let res = await fetch(fileRecord.path)

      // Fallback for protected/stale delivery URLs.
      // Cloudinary may store raw public_id with or without .pdf suffix.
      if (!res.ok) {
        const canonicalPublicIds = [`anton/${fileId}`, `anton/${fileId}.pdf`]
        console.log("[cloudinary:fetch-fallback]", {
          originalPath: fileRecord.path,
          canonicalPublicIds,
          initialStatus: res.status,
        })

        for (const publicId of canonicalPublicIds) {
          const signedUrl = cloudinary.utils.private_download_url(
            publicId,
            "pdf",
            {
              resource_type: "raw",
              type: "upload",
            }
          )

          const retry = await fetch(signedUrl)
          if (retry.ok) {
            res = retry
            break
          }
        }
      }

      const contentType = res.headers.get("content-type") || ""

      if (!res.ok) {
        throw new Error(`Failed to fetch file from storage (${res.status}) path=${fileRecord.path}`)
      }

      if (!contentType.includes("application/pdf")) {
        throw new Error(`Storage URL did not return a PDF. content-type=${contentType}`)
      }

      const arrayBuffer = await res.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Quick PDF signature check: %PDF
      const header = buffer.subarray(0, 4).toString("utf8")
      if (header !== "%PDF") {
        throw new Error("Fetched file is not a valid PDF binary (missing %PDF header)")
      }

      return buffer
    })

    // step 2 → call Python service
    const chunks = await step.run("parse-pdf", async () => {
      const form = new FormData()
      form.append("file", pdfBuffer, { filename: "file.pdf", contentType: "application/pdf" })

      const res = await fetch("http://localhost:8000/parse", {
        method: "POST",
        body: form,
        headers: form.getHeaders(),
      })

      const raw = await res.text()

      if (!res.ok) {
        throw new Error(`Python parser failed (${res.status}): ${raw}`)
      }

      let data: { chunks: any[] }
      try {
        data = JSON.parse(raw) as { chunks: any[] }
      } catch {
        throw new Error(`Invalid JSON from parser service: ${raw.slice(0, 500)}`)
      }

      if (!Array.isArray(data.chunks)) {
        throw new Error("Parser response missing 'chunks' array")
      }

      return data.chunks
    })

    // step 3 → embed each chunk
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
        throw new Error(
          `Embedding count mismatch: expected ${chunks.length}, got ${results.length}`
        )
      }

      return chunks.map((chunk, i) => ({
        ...chunk,
        embedding: results[i]?.embedding,
      }))
    })

    // step 4 → bulk insert
    await step.run("store-chunks", async () => {
      for (const chunk of chunksWithEmbeddings) {
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
            ${chunk.startChar},
            ${chunk.endChar},
            ${fileId},
            ${JSON.stringify(chunk.embedding)}::vector
          )
        `
      }
    })

    // step 5 → update status
    await step.run("update-status", async () => {
      await prisma.file.update({
        where: { id: fileId },
        data: { embeddingStatus: "EMBEDDING_SUCCESSFUL" },
      })
    })
  }
)