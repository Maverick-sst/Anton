/* ═══════════════════════════════════════════════════════
   Anton — Centralized API Layer
   All backend calls go through here.
   Every function gets Clerk token → sets Bearer header.
   ═══════════════════════════════════════════════════════ */

const BASE = "http://localhost:3000"

type GetToken = () => Promise<string | null>

/* ── Chat CRUD ─────────────────────────────────────── */

export const createChat = async (getToken: GetToken, name: string) => {
  const token = await getToken()
  const res = await fetch(`${BASE}/api/chat/create`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error("Failed to create chat")
  return res.json() as Promise<{ chatId: string; name: string; createdAt: string }>
}

export const getChats = async (getToken: GetToken) => {
  const token = await getToken()
  const res = await fetch(`${BASE}/api/chat`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error("Failed to fetch chats")
  return res.json() as Promise<{
    chats: Array<{
      id: string
      name: string
      createdAt: string
      updatedAt: string
      files: Array<{ id: string; embeddingStatus: string }>
    }>
  }>
}

export const getChatById = async (getToken: GetToken, chatId: string) => {
  const token = await getToken()
  const res = await fetch(`${BASE}/api/chat/${chatId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error("Failed to fetch chat")
  return res.json() as Promise<{
    chat: { id: string; name: string }
    messages: Array<{
      id: string
      chatId: string
      content: string | null
      role: "USER" | "ASSISTANT"
      createdAt: string
    }>
    file: {
      id: string
      name: string
      path: string
      embeddingStatus: string
    } | null
  }>
}

export const deleteChat = async (getToken: GetToken, chatId: string) => {
  const token = await getToken()
  const res = await fetch(`${BASE}/api/chat/${chatId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error("Failed to delete chat")
  return res.json() as Promise<{ success: boolean }>
}

/* ── Upload ────────────────────────────────────────── */

export const uploadPDF = async (
  getToken: GetToken,
  file: File,
  chatId: string
) => {
  const token = await getToken()
  const form = new FormData()
  form.append("file", file)
  form.append("chatId", chatId)

  const res = await fetch(`${BASE}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) throw new Error("Failed to upload PDF")
  return res.json() as Promise<{ fileId: string; status: string }>
}

/* ── Chat Streaming ────────────────────────────────── */

export const sendMessage = async (
  getToken: GetToken,
  message: string,
  chatId: string,
  fileId: string
): Promise<Response> => {
  const token = await getToken()
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, chatId, fileId }),
  })
  if (!res.ok) throw new Error("Failed to send message")
  return res
}
