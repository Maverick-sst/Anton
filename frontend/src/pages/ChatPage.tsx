import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import Sidebar from "../components/Sidebar"
import UploadZone from "../components/UploadZone"
import { createChat } from "../lib/api"
import AntonLoader from "../components/AntonLoader"
import "./ChatLayout.css"

export default function ChatPage() {
  const { getToken } = useAuth()
  const navigate = useNavigate()
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  // Create a chat on mount to provide a valid ID for UploadZone
  useEffect(() => {
    const initChat = async () => {
      try {
        const data = await createChat(getToken, "New Chat")
        setCurrentChatId(data.chatId)
      } catch (err) {
        console.error("Failed to initialize chat", err)
      } finally {
        setLoading(false)
      }
    }
    initChat()
  }, [])

  const handleUploadSuccess = async (fileId: string) => {
    if (!currentChatId) return
    navigate(`/chat/${currentChatId}`, { state: { fileId } })
  }

  return (
    <div className={`chat-layout ${collapsed ? "chat-layout--collapsed" : ""}`}>
      <Sidebar activeChatId={undefined} collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main className="chat-main">
        <div className="chat-content chat-content-centered">
          {loading ? (
            <AntonLoader size="md" label="Preparing your workspace" />
          ) : currentChatId ? (
            <UploadZone chatId={currentChatId} onUploadSuccess={handleUploadSuccess} />
          ) : (
            <div className="text-error">Failed to initialize chat. Please refresh.</div>
          )}
        </div>
      </main>
    </div>
  )
}

