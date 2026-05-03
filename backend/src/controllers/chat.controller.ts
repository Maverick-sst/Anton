import type { Request, Response } from "express"
import OpenAI from "openai"
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import { prisma } from "../lib/prisma"
import { retrieveChunks } from "../services/rag/retrieval"
import { buildPrompt } from "../services/rag/promptBuilder"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export const handleChat = async (req: Request, res: Response) => {
  const user = (req as any).user
  const { message, chatId, fileId } = req.body

  if (!message || !chatId || !fileId) {
    return res.status(400).json({ error: "message, chatId, fileId required" })
  }

  // step 1 → save user message
  await prisma.message.create({
    data: { chatId, content: message, role: "USER" }
  })

  // step 2 → embed question
  const embeddingRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: message,
  })
  const embedding = embeddingRes.data[0]?.embedding
  if (!embedding) {
    return res.status(502).json({ error: "Failed to generate query embedding" })
  }

  // step 3 → retrieve chunks
  const chunks = await retrieveChunks(embedding, fileId)

  // step 4 → build prompt → check refusal
  const result = buildPrompt(message, chunks, [])
  if (!result) {
    await prisma.message.create({
      data: {
        chatId,
        role: "ASSISTANT",
        content: "I don't have enough information in this document to answer that.",
      }
    })
    return res.status(200).json({
      answer: "I don't have enough information in this document to answer that.",
      citations: [],
    })
  }

  // step 5 → fetch conversation history
  const history = await prisma.message.findMany({
    where: { chatId },
    orderBy: { createdAt: "asc" },
    take: 6,
  })

  // step 6 → stream LLM response
  res.setHeader("Content-Type", "text/event-stream")
  res.setHeader("Cache-Control", "no-cache")
  res.setHeader("Connection", "keep-alive")

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: result.systemPrompt },
    ...history.map((m): ChatCompletionMessageParam => ({
      role: m.role === "USER" ? "user" : "assistant",
      content: m.content ?? "",
    })),
    {
      role: "user",
      content: `Context:\n${result.context}\n\nQuestion: ${message}`,
    },
  ]

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    stream: true,
    messages,
  })

  let fullResponse = ""

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? ""
    if (token) {
      fullResponse += token
      res.write(`data: ${JSON.stringify({ token })}\n\n`)
    }
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
  res.end()

  // step 7 → save assistant message
  await prisma.message.create({
    data: { chatId, role: "ASSISTANT", content: fullResponse }
  })
}