import { useEffect, useRef } from "react"
import CitationBadge from "./CitationBadge"
import "./MessageList.css"

type Message = {
  id?: string
  role: "USER" | "ASSISTANT"
  content: string | null
  createdAt?: string
}

type Props = {
  messages: Message[]
  streamingContent?: string
}

/** Extract page numbers cited in assistant text — matches "Page N", "[Page N]", "page N" */
function extractCitations(text: string): number[] {
  const regex = /\b[Pp]age\s+(\d+)/g
  const pages = new Set<number>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    pages.add(parseInt(match[1], 10))
  }
  return Array.from(pages).sort((a, b) => a - b)
}

export default function MessageList({ messages, streamingContent }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, streamingContent])

  return (
    <div className="message-list">
      {messages.map((msg, i) => (
        <div
          key={msg.id ?? i}
          className={`message ${msg.role === "USER" ? "message--user" : "message--assistant"}`}
        >
          <div className="message-bubble">
            <div className="message-text">{msg.content ?? ""}</div>
            {msg.role === "ASSISTANT" && msg.content && (
              <div className="message-citations">
                {extractCitations(msg.content).map(page => (
                  <CitationBadge key={page} page={page} />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Streaming message (assistant typing) */}
      {streamingContent !== undefined && streamingContent !== "" && (
        <div className="message message--assistant">
          <div className="message-bubble">
            <div className="message-text">{streamingContent}</div>
            <div className="message-citations">
              {extractCitations(streamingContent).map(page => (
                <CitationBadge key={page} page={page} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
