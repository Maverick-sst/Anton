// takes: query embedding + fileId

import { prisma } from "../../lib/prisma"

// returns: top K chunks with similarity scores
export const retrieveChunks = async (
  embedding: number[],
  fileId: string,
  topK: number = 5
) => {
  const results = await prisma.$queryRaw`
    SELECT id, content, "pageNumber", section, "chunkIndex",
      1 - (embedding <=> ${JSON.stringify(embedding)}::vector) AS similarity
    FROM "DocumentChunk"
    WHERE "fileId" = ${fileId}
    ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
    LIMIT ${topK}
  `
  return results as { content: string, pageNumber: number, section: string, similarity: number }[]
}