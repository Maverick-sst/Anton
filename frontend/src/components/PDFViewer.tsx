import { useState, useCallback, useEffect } from "react"
import { Document, Page, pdfjs } from "react-pdf"

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString()

type Citation = {
  pageNumber: number
  startChar: number
  endChar: number
  content: string
}

type Props = {
  url: string
  fileName: string
  citations?: Citation[]
  activePage?: number
}

export default function PDFViewer({ url, fileName, citations = [], activePage }: Props) {
  const [numPages, setNumPages] = useState<number>(0)
  const [currentPage, setCurrentPage] = useState(activePage ?? 1)

  // jump to cited page when activePage changes
  useEffect(() => {
    if (activePage) setCurrentPage(activePage)
  }, [activePage])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  // highlight cited text on this page
  const makeTextRenderer = useCallback(
    (pageNumber: number) =>
      ({ str }: { str: string }) => {
        const pageCitations = citations.filter(c => c.pageNumber === pageNumber)
        if (pageCitations.length === 0) return str

        // check if this text item overlaps any citation content
        const isHighlighted = pageCitations.some(c =>
          c.content.includes(str) || str.includes(c.content.slice(0, 20))
        )

        return isHighlighted
          ? `<mark class="pdf-highlight">${str}</mark>`
          : str
      },
    [citations]
  )

  return (
    <div className="pdf-viewer">
      <div className="pdf-viewer-header">
        <span className="pdf-viewer-title">{fileName}</span>
        <div className="pdf-viewer-nav">
          <button
            className="pdf-nav-btn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            ‹
          </button>
          <span className="pdf-page-info">{currentPage} / {numPages}</span>
          <button
            className="pdf-nav-btn"
            disabled={currentPage >= numPages}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            ›
          </button>
        </div>
      </div>

      <div className="pdf-viewer-body">
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="pdf-loading">Loading document...</div>}
          error={<div className="pdf-error">Failed to load PDF.</div>}
        >
          <Page
            pageNumber={currentPage}
            width={480}
            customTextRenderer={makeTextRenderer(currentPage)}
            renderAnnotationLayer={false}
          />
        </Document>
      </div>

      {citations.length > 0 && (
        <div className="pdf-citation-pills">
          {citations.map((c, i) => (
            <button
              key={i}
              className={`pdf-citation-pill ${currentPage === c.pageNumber ? "active" : ""}`}
              onClick={() => setCurrentPage(c.pageNumber)}
            >
              Page {c.pageNumber}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}