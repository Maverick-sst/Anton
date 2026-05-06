# Anton

**A strictly grounded conversational agent. It answers only from what's in your document — nothing else.**

Built over a weekend. Learned a lot. Shipped it anyway.

---

## What is this?

Anton is a RAG (Retrieval-Augmented Generation) agent that takes any PDF and lets you have a conversation with it. The hard constraint — and the whole point — is that it will only answer from the content of the uploaded document. Ask it something outside the PDF, it tells you it doesn't know. No hallucinations, no confident guessing, no slipping past the grounding prompt.

The name Anton came from nowhere in particular. It stuck.

---

## Why I built this

I wanted to understand RAG from first principles, not from a tutorial that wires three abstractions together and calls it done. That meant building the chunking pipeline by hand, understanding why embeddings exist, figuring out what a context window actually costs you, and learning why job queues matter when the thing you're doing takes 45 seconds and your user is waiting.

A weekend turned into a full build. This is the result.

---

## The Stack

| Layer | Technology |
|---|---|
| Frontend | ![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB) ![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) |
| Auth | ![Clerk](https://img.shields.io/badge/Clerk-6C47FF?style=flat-square&logo=clerk&logoColor=white) |
| Backend | ![Bun](https://img.shields.io/badge/Bun-000000?style=flat-square&logo=bun&logoColor=white) ![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white) |
| PDF Parsing | ![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=flat-square&logo=fastapi&logoColor=white) |
| Embeddings + LLM | ![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white) text-embedding-3-small · gpt-4o-mini |
| Background Jobs | ![Inngest](https://img.shields.io/badge/Inngest-FF4D4D?style=flat-square&logoColor=white) |
| ORM | ![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white) |
| Database | ![Postgres](https://img.shields.io/badge/Neon_Postgres-4169E1?style=flat-square&logo=postgresql&logoColor=white) + pgvector |
| File Storage | ![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white) |
| Deploy | ![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white) ![Render](https://img.shields.io/badge/Render-46E3B7?style=flat-square&logo=render&logoColor=white) |

---

## Architecture

### The Two-Runtime Decision

The first real decision was splitting the backend into two services. Node handles everything that's I/O-bound: API requests, auth, database, streaming responses. Python handles everything that's CPU-bound: PDF parsing and tokenization. This isn't over-engineering — PyMuPDF is genuinely the best tool for extracting clean text from a PDF, and tiktoken is tied to OpenAI's tokenizer. Trying to replicate that in Node would have been worse in every way.

The contract between them is simple. Node uploads the PDF buffer to Supabase, fires an Inngest job, and the job sends the buffer to the Python service via a multipart POST. Python returns a JSON array of chunks. Node takes it from there.

### Why Inngest for the Upload Pipeline

PDF processing is not a fast operation. A 150-page book takes around 50 seconds end to end — parsing, tokenizing, embedding in batches, bulk inserting into Postgres. If that ran synchronously inside the upload request, the user would sit on a loading screen for a minute with no feedback and a high chance of a timeout.

Inngest turns that into a background job with three properties that matter: the user gets an immediate response, each step retries independently if it fails, and you get full observability into which step errored and why. The upload endpoint fires the event and returns in under a second. The pipeline runs behind the scenes.

### Why pgvector Instead of a Vector Database

The honest answer is simplicity. You already need Postgres for users, chats, messages, and file metadata. Adding a separate vector database means another service to manage, another connection to maintain, and a join across network boundaries every time you need to combine vector results with relational data. pgvector gives you vector similarity search inside the same database with the same ORM. For this scale it's the right call.

### The RAG Pipeline in Detail

When a user sends a message:

1. The question is embedded using the same model that embedded the document chunks — `text-embedding-3-small`. This is non-negotiable. If you embed chunks with one model and queries with another, the vector spaces don't align and similarity scores become meaningless.

2. A cosine similarity search runs against all chunks belonging to that file. The top 5 are returned with their similarity scores.

3. Any chunk scoring below 0.3 is discarded. If nothing passes the threshold, the request never reaches the LLM — the refusal is immediate and cheap.

4. The passing chunks are formatted into a context block with page markers. The last 6 messages are pulled from the database for conversation history. These are assembled into a single prompt with a strict grounding instruction.

5. The response streams back via SSE. The frontend reads the token stream and appends each piece as it arrives. When the stream closes, the complete message is written to the database.

### Chunking Strategy

This is where most of the real learning happened.

Chunks are 300 tokens with a 50-token overlap. The overlap exists because a sentence at the end of one chunk and the beginning of the next can carry meaning that neither chunk preserves alone. Without overlap, you get context fragmentation — the retrieval finds the right page but the answer is half a thought.

Each chunk carries its page number, character offsets within the page, token count, and an index. The character offsets exist for future text highlighting in the PDF viewer. The token count matters at prompt construction time — you need to know if your retrieved chunks plus conversation history fit inside the model's context window before you make the API call.

Text is preprocessed before chunking — headers, footers, and repeated boilerplate are stripped. Garbage in means garbage embeddings means bad retrieval. Fixing chunking fixes more problems than tuning the model ever will.

---

## What I Learned

**On RAG:** The quality of retrieval determines the quality of answers, not the quality of the model. Get retrieval right and even a small model performs well. Get retrieval wrong and GPT-4 will still confidently answer the wrong question.

**On embeddings:** An embedding is a compressed representation of meaning, not just keywords. The model that generates them has a significant impact on how well cross-lingual queries work. text-embedding-3-small handles multilingual inputs surprisingly well without any translation layer.

**On job queues:** You don't reach for a job queue because it's architecturally fashionable. You reach for it when the operation is too slow, too unreliable, or too important to run inline. Document processing hits all three.

**On context windows:** Every token costs money and adds latency. The token budget check before an LLM call — truncating oldest history first, then lowest-scoring chunks — is not premature optimization. It's what separates a pipeline that works on a resume from one that also works on a 300-page legal document.

**On strictness:** The grounding prompt took more iteration than expected. Jailbreaks, prompt injections, indirect questions — the model is creative in finding ways around a loose instruction. The final prompt is minimal and direct: answer only from this context, cite the page, say you don't know if it isn't there.

---

## Running Locally

```bash
# Terminal 1 — Backend
cd backend && bun run dev

# Terminal 2 — Python Service
cd python-service && uvicorn app.main:app --port 8000 --reload

# Terminal 3 — Inngest Dev Server
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest

# Terminal 4 — Frontend
cd frontend && bun run dev
```

**Environment variables required:**

```
# backend/.env
DATABASE_URL=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
SUPABASE_BUCKET=
PYTHON_SERVICE_URL=

# frontend/.env
VITE_CLERK_PUBLISHABLE_KEY=
VITE_API_URL=
```

---

## What's Next

- Audio transcription via Faster-Whisper — ask questions by voice in any language
- Multi-document support per chat session
- Some Improvements---> Making it a little better towards answering follow up questions!
- fixing frontend:--> div overflow in chatDetails.tsx page
---

## Deployment

| Service | Platform |
|---|---|
| Frontend | ![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white) |
| Backend | ![Render](https://img.shields.io/badge/Render-46E3B7?style=flat-square&logo=render&logoColor=white) |
| Python Service | ![Render](https://img.shields.io/badge/Render-46E3B7?style=flat-square&logo=render&logoColor=white) |
| Database | ![Neon](https://img.shields.io/badge/Neon_Postgres-4169E1?style=flat-square&logo=postgresql&logoColor=white) |
| File Storage | ![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white) |
| Auth | ![Clerk](https://img.shields.io/badge/Clerk-6C47FF?style=flat-square&logo=clerk&logoColor=white) |
| Job Queue | ![Inngest](https://img.shields.io/badge/Inngest-FF4D4D?style=flat-square&logoColor=white) |

---

Built by [Rehan](https://github.com/Maverick-sst) as a weekend project. -shipped