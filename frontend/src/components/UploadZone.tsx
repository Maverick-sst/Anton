import { useState, useRef } from "react"
import { useAuth } from "@clerk/clerk-react"
import { uploadPDF } from "../lib/api"
import "./UploadZone.css"

type Props = {
  chatId: string
  onUploadSuccess: (fileId: string) => void
}

export default function UploadZone({ chatId, onUploadSuccess }: Props) {
  const { getToken } = useAuth()
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const validateFile = (selectedFile: File) => {
    setError(null)
    if (selectedFile.type !== "application/pdf") {
      setError("Please select a valid PDF file.")
      return false
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("File must be smaller than 10MB.")
      return false
    }
    return true
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && validateFile(droppedFile)) {
      setFile(droppedFile)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile && validateFile(selectedFile)) {
      setFile(selectedFile)
    }
  }

  const handleUpload = async () => {
    if (!file || !chatId) return
    setUploading(true)
    setError(null)
    try {
      const data = await uploadPDF(getToken, file, chatId)
      onUploadSuccess(data.fileId)
    } catch (err) {
      console.error(err)
      setError("Failed to upload file. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="upload-zone-container">
      <div 
        className={`upload-zone ${isDragging ? "upload-zone--dragging" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !file && fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          accept="application/pdf" 
          ref={fileInputRef} 
          style={{ display: "none" }} 
          onChange={handleFileChange}
        />
        
        {file ? (
          <div className="upload-zone-file">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="upload-icon-file">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <p className="upload-filename">{file.name}</p>
            <button className="btn btn-text upload-clear" onClick={(e) => { e.stopPropagation(); setFile(null); }}>Clear selection</button>
          </div>
        ) : (
          <div className="upload-zone-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="upload-icon">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            <h3>Upload your document</h3>
            <p className="text-muted">Drag and drop a PDF file here, or click to browse</p>
            <p className="text-muted-soft" style={{ marginTop: "4px" }}>Maximum file size: 10MB</p>
          </div>
        )}
      </div>

      {error && <div className="upload-error">{error}</div>}

      <button 
        className="btn btn-primary upload-submit" 
        disabled={!file || uploading}
        onClick={handleUpload}
      >
        {uploading ? "Uploading and processing..." : "Start analyzing document"}
      </button>
    </div>
  )
}
