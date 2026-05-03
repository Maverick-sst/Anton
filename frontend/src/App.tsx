import { SignedIn, SignedOut, SignIn, UserButton, useAuth, useClerk } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import UploadTest from './pages/UploadTest'

export default function App() {
  const { getToken, isSignedIn } = useAuth()
  const { signOut } = useClerk()

  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [fileId, setFileId] = useState("")
  const [chatId, setChatId] = useState("")

  useEffect(() => {
    const verifySession = async () => {
      if (!isSignedIn) return
      try {
        const token = await getToken()
        if (!token) return
        const res = await fetch('http://localhost:3000/api/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.status === 401) await signOut({ redirectUrl: '/' })
      } catch (error) {
        console.error('Session verification failed', error)
      }
    }
    verifySession()
  }, [getToken, isSignedIn, signOut])

  const handleChat = async () => {
    if (!question || !chatId || !fileId) return
    setAnswer("")

    const token = await getToken()
    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: question, chatId, fileId }),
    })

    if (!res.body) return

    const reader = res.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value)
      const lines = text.split("\n\n").filter(Boolean)
      for (const line of lines) {
        try {
          const data = JSON.parse(line.replace("data: ", ""))
          if (data.token) setAnswer(prev => prev + data.token)
        } catch {}
      }
    }
  }

  return (
    <div>
      <SignedOut>
        <SignIn />
      </SignedOut>
      <SignedIn>
        <UserButton />
        <h1>You're in 🚀</h1>

        <UploadTest
          onUploadSuccess={(fId, cId) => {
            setFileId(fId)
            setChatId(cId)
          }}
        />

        {fileId && (
          <div style={{ padding: "1rem", maxWidth: "600px" }}>
            <h3>Chat with your PDF</h3>
            <input
              type="text"
              placeholder="Ask a question..."
              value={question}
              onChange={e => setQuestion(e.target.value)}
              style={{ width: "100%", marginBottom: "0.5rem" }}
            />
            <button onClick={handleChat}>Ask</button>
            {answer && (
              <pre style={{ marginTop: "1rem", whiteSpace: "pre-wrap" }}>
                {answer}
              </pre>
            )}
          </div>
        )}
      </SignedIn>
    </div>
  )
}