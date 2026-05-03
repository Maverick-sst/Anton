import { useState, useCallback, useEffect } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/esm/Page/TextLayer.css"
import "react-pdf/dist/esm/Page/AnnotationLayer.css"
import AntonLoader from "./AntonLoader"
import "./PDFViewer.css"

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
        <div className="pdf-header-left">
          <div className="pdf-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <span className="pdf-viewer-title">{fileName}</span>
        </div>
        <div className="pdf-viewer-nav">
          <button
            className="pdf-nav-btn"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            ‹
          </button>
          <div className="pdf-page-indicator">
            <span className="current">{currentPage}</span>
            <span className="separator">/</span>
            <span className="total">{numPages}</span>
          </div>
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
        <div className="pdf-container-inner">
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={<div className="pdf-loading"><AntonLoader size="sm" /></div>}
            error={<div className="pdf-error">Failed to load PDF.</div>}
          >
            <Page
              pageNumber={currentPage}
              scale={1.2}
              customTextRenderer={makeTextRenderer(currentPage)}
              renderAnnotationLayer={false}
            />
          </Document>
        </div>
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