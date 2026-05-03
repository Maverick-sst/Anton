import { useEffect, useState, useRef } from "react"
import { useAuth, useUser } from "@clerk/clerk-react"
import AntonLoader from "./AntonLoader"

import { useNavigate, useLocation } from "react-router-dom"
import { getChats, deleteChat, createChat } from "../lib/api"
import { UserButton } from "@clerk/clerk-react"
import "./Sidebar.css"


type ChatItem = {
  id: string
  name: string
  updatedAt: string
  files: Array<{ id: string; embeddingStatus: string }>
}

type Props = {
  activeChatId?: string
  onChatsChange?: () => void
  collapsed?: boolean
  onToggle?: () => void
}

export default function Sidebar({ activeChatId, onChatsChange, collapsed, onToggle }: Props) {
  const { getToken } = useAuth()
  const { user } = useUser()

  const navigate = useNavigate()
  const location = useLocation()
  const cache = useRef<ChatItem[] | null>(null)
  const [chats, setChats] = useState<ChatItem[]>(cache.current || [])
  const [loading, setLoading] = useState(!cache.current)
  const [creatingChat, setCreatingChat] = useState(false)

  const fetchChats = async (isBackground = false) => {
    if (!isBackground) setLoading(true)
    try {
      const data = await getChats(getToken)
      setChats(data.chats)
      cache.current = data.chats
    } catch (err) {
      console.error("Failed to load chats", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchChats(!!cache.current)
  }, [location.pathname])

  const handleNewChat = async () => {
    if (creatingChat) return
    setCreatingChat(true)
    try {
      const data = await createChat(getToken, "New Chat")
      cache.current = null // invalidate cache
      navigate(`/chat/${data.chatId}`)
      onChatsChange?.()
    } catch (err) {
      console.error("Failed to create chat", err)
    } finally {
      setCreatingChat(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation()
    try {
      await deleteChat(getToken, chatId)
      cache.current = null // invalidate cache
      setChats(prev => prev.filter(c => c.id !== chatId))
      if (activeChatId === chatId) {
        navigate("/chat")
      }
      onChatsChange?.()
    } catch (err) {
      console.error("Failed to delete chat", err)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return "Today"
    if (days === 1) return "Yesterday"
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  return (
    <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
      <div className="sidebar-header">
        {!collapsed && <span className="sidebar-brand">Anton</span>}
        <button className="sidebar-toggle" onClick={onToggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {/* Claude-style Sidebar Toggle Icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
      </div>

      {collapsed && (
        <div className="sidebar-collapsed-actions">
          <button className="sidebar-mini-btn" onClick={handleNewChat} title="New Chat" disabled={creatingChat}>
            {creatingChat ? (
              <AntonLoader size="sm" label="" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            )}
          </button>
        </div>
      )}

      {!collapsed && (
        <>
          <div className="sidebar-actions">
            <button className="btn btn-primary sidebar-new-btn" onClick={handleNewChat} disabled={creatingChat}>
              {creatingChat ? <AntonLoader size="sm" label="" /> : "+ New Chat"}
            </button>
          </div>


          <nav className="sidebar-list scrollbar-dark">
            {loading ? (
              <div className="sidebar-empty">
                <AntonLoader size="sm" label="" />
              </div>
            ) : chats.length === 0 ? (
              <div className="sidebar-empty">
                No conversations yet
              </div>
            ) : (
              chats.map(chat => (
                <div
                  key={chat.id}
                  className={`sidebar-item ${chat.id === activeChatId ? "sidebar-item--active" : ""}`}
                  onClick={() => navigate(`/chat/${chat.id}`)}
                >
                  <div className="sidebar-item-content">
                    <span className="sidebar-item-name">{chat.name}</span>
                    <span className="sidebar-item-date">{formatDate(chat.updatedAt)}</span>
                  </div>
                  <button
                    className="sidebar-item-delete"
                    onClick={(e) => handleDelete(e, chat.id)}
                    title="Delete chat"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </nav>
        </>
      )}

      <div className="sidebar-footer">
        <div className="sidebar-user-wrapper">
          <UserButton afterSignOutUrl="/" showName={false} />
          {!collapsed && (
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.fullName || user?.username || "Account"}</span>
            </div>
          )}

        </div>
      </div>
    </aside>
  )
}



