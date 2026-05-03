import { useAuth } from "@clerk/clerk-react"
import { useState } from "react"
type Props = {
  onUploadSuccess: (fileId: string, chatId: string) => void
}
export default function UploadTest({ onUploadSuccess }: Props) {
  const { getToken } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [chatId, setChatId] = useState("")
  const [status, setStatus] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const handleUpload = async () => {
    if (!file || !chatId) return
    setLoading(true)
    setStatus("")

    try {
      const token = await getToken()
      const form = new FormData()
      form.append("file", file)
      form.append("chatId", chatId)

      const res = await fetch("http://localhost:3000/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })

      const data = await res.json()
      onUploadSuccess(data.fileId, chatId)
      setStatus(JSON.stringify(data, null, 2))
    } catch (err) {
      setStatus("Error: " + err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: "2rem", maxWidth: "500px" }}>
      <h2>Upload Test</h2>
      <input
        type="text"
        placeholder="chatId"
        value={chatId}
        onChange={e => setChatId(e.target.value)}
        style={{ display: "block", marginBottom: "1rem", width: "100%" }}
      />
      <input
        type="file"
        accept="application/pdf"
        onChange={e => setFile(e.target.files?.[0] || null)}
        style={{ display: "block", marginBottom: "1rem" }}
      />
      <button onClick={handleUpload} disabled={loading}>
        {loading ? "Uploading..." : "Upload PDF"}
      </button>
      {status && <pre style={{ marginTop: "1rem" }}>{status}</pre>}
    </div>
  )
}