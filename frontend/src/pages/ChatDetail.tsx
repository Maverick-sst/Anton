import { useEffect, useRef, useState } from "react"
import { useParams } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import Sidebar from "../components/Sidebar"
import MessageList from "../components/MessageList"
import ChatInput from "../components/ChatInput"
import UploadZone from "../components/UploadZone"
import PDFViewer from "../components/PDFViewer"
import AntonLoader from "../components/AntonLoader"
import { getChatById, sendMessage } from "../lib/api"
import "./ChatLayout.css"

type Message = {
  id?: string
  role: "USER" | "ASSISTANT"
  content: string | null
  createdAt?: string
}
type Citation = {
  pageNumber: number
  startChar: number
  endChar: number
  content: string
}

export default function ChatDetail() {
  const { id: chatId } = useParams<{ id: string }>()
  const { getToken } = useAuth()

  const [file, setFile] = useState<{ id: string; path: string; name: string; embeddingStatus: string } | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [streamingContent, setStreamingContent] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(() => window.innerWidth <= 768)
  const [citations, setCitations] = useState<Citation[]>([])
  const [activePage, setActivePage] = useState<number>(1)
  const previousChatIdRef = useRef<string | undefined>(undefined)


  const fetchChat = async () => {
    if (!chatId) return
    try {
      if (previousChatIdRef.current !== chatId) {
        setCitations([])
        setActivePage(1)
        previousChatIdRef.current = chatId
      }

      const data = await getChatById(getToken, chatId)
      setMessages(data.messages)
      setFile(data.file)

      // If we just uploaded a file from ChatPage, it might not be linked in DB immediately,
      // but the route state might have it. However, the background worker will link it soon.
    } catch (err) {
      console.error(err)
      setError("Failed to load chat.")
    } finally {
      setLoading(false)
    }
  }

  // Poll for status if pending/processing
  useEffect(() => {
    const initialFetchTimeout = setTimeout(() => {
      void fetchChat()
    }, 0)

    let intervalId: ReturnType<typeof setInterval>
    if (file?.embeddingStatus === "EMBEDDING_PENDING" || file?.embeddingStatus === "EMBEDDING_PROCESSING") {
      intervalId = setInterval(() => {
        void fetchChat()
      }, 3000)
    }

    return () => {
      clearTimeout(initialFetchTimeout)
      if (intervalId) clearInterval(intervalId)
    }
  }, [chatId, file?.embeddingStatus])

  const handleUploadSuccess = () => {
    fetchChat()
  }

  const handleSend = async (content: string) => {
    setCitations([]);
    setActivePage(1);
    if (!chatId || !file?.id) return

    // Optimistic UI update
    const userMsg: Message = { role: "USER", content }
    setMessages(prev => [...prev, userMsg])
    setStreamingContent("")

    try {
      const res = await sendMessage(getToken, content, chatId, file.id)
      if (!res.body) throw new Error("No response body")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantMsg = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split("\n\n").filter(Boolean)

        for (const line of lines) {
          try {
            const data = JSON.parse(line.replace("data: ", ""))
            if (data.citations) {
              setCitations(data.citations)
              if (data.citations[0]?.pageNumber) {
                setActivePage(data.citations[0].pageNumber)
              }
            }
            if (data.token) {
              assistantMsg += data.token
              setStreamingContent(assistantMsg)
            }
          } catch {
            // Ignore parse errors on partial streams
          }
        }
      }

      // Finalize message
      setMessages(prev => [...prev, { role: "ASSISTANT", content: assistantMsg }])
      setStreamingContent("")

    } catch (err) {
      console.error("Failed to send message", err)
      // Remove optimistic message on error or show error indicator
    }
  }

  return (
    <div className={`chat-layout ${collapsed ? "chat-layout--collapsed" : ""}`}>
      <Sidebar activeChatId={chatId} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />

      <main className="chat-main">


        {loading ? (
          <div className="chat-content chat-content-centered">
            <AntonLoader size="md" label="Loading chat" />
          </div>
        ) : error ? (
          <div className="chat-content chat-content-centered text-error">{error}</div>
        ) : !file ? (
          <div className="chat-content chat-content-centered">
            <UploadZone chatId={chatId!} onUploadSuccess={handleUploadSuccess} />
          </div>
        ) : file.embeddingStatus !== "EMBEDDING_SUCCESSFUL" ? (
          <div className="chat-content chat-content-centered">
            <div className="chat-processing">
              <AntonLoader size="lg" label="Analyzing" />
              <p className="text-muted-soft text-sm mt-4">This may take a minute depending on document size.</p>
            </div>
          </div>
        ) : (
          <div className="chat-split-view">
            <div className="chat-panel chat-panel-pdf">
              <PDFViewer
                url={file.path}
                fileName={file.name}
                citations={citations}
                activePage={activePage}
              />
            </div>
            <div className="chat-panel chat-panel-messages">
              <MessageList messages={messages} streamingContent={streamingContent} />
              <ChatInput onSend={handleSend} disabled={!!streamingContent} />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
