const SIMILARITY_THRESHOLD = 0.3

export const buildPrompt = (
  question: string,
  chunks: { content: string; pageNumber: number; similarity: number }[],
  history: { role: string; content: string }[]
) => {
  const relevant = chunks.filter(c => c.similarity >= SIMILARITY_THRESHOLD)
  if (relevant.length === 0) return null // signal refusal

  const context = relevant.map((c, i) =>
    `[Source ${i + 1} | Page ${c.pageNumber}]\n${c.content}`
  ).join("\n\n")

  const systemPrompt = `
You are a strict document assistant. Answer ONLY using the provided context.
If the answer is not in the context, say "I don't have enough information in this document to answer that."
Always cite the source page number in your answer.
Never hallucinate or use outside knowledge.
`.trim()

  return { systemPrompt, context, relevant }
}