import { useState, useCallback, useEffect, useRef } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/TextLayer.css"
import "react-pdf/dist/Page/AnnotationLayer.css"
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
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1.0);

  // Jump to cited page when activePage changes
  useEffect(() => {
    if (activePage && pageRefs.current[activePage]) {
      pageRefs.current[activePage]?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [activePage])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
  }

  // Update current page indicator on scroll
  const handleScroll = () => {
    if (!containerRef.current) return
    const container = containerRef.current
    const scrollPos = container.scrollTop + container.clientHeight / 3

    for (let i = 1; i <= numPages; i++) {
      const el = pageRefs.current[i]
      if (el && el.offsetTop <= scrollPos && el.offsetTop + el.clientHeight > scrollPos) {
        setCurrentPage(i)
        break
      }
    }
  }

  // highlight cited text on this page
  const makeTextRenderer = useCallback(
    (pageNumber: number) =>
      ({ str }: { str: string }) => {
        const pageCitations = citations.filter(c => c.pageNumber === pageNumber)
        if (pageCitations.length === 0) return str

        const isHighlighted = pageCitations.some(c =>
          c.content.includes(str) || str.includes(c.content.slice(0, 20))
        )

        return isHighlighted
          ? `<mark class="pdf-highlight">${str}</mark>`
          : str
      },
    [citations]
  )

  const jumpToPage = (page: number) => {
    pageRefs.current[page]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

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
          <div className="pdf-page-indicator">
            <span className="current">{currentPage}</span>
            <span className="separator">/</span>
            <span className="total">{numPages}</span>
          </div>
        </div>
      </div>

      <div className="pdf-zoom-bar">
        <button
          className="pdf-zoom-btn"
          onClick={() => setScale(s => Math.max(0.5, parseFloat((s - 0.2).toFixed(1))))}
          disabled={scale <= 0.5}
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="pdf-zoom-level">{Math.round(scale * 100)}%</span>
        <button
          className="pdf-zoom-btn"
          onClick={() => setScale(s => Math.min(2.0, parseFloat((s + 0.2).toFixed(1))))}
          disabled={scale >= 2.0}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>

      <div className="pdf-viewer-body" ref={containerRef} onScroll={handleScroll}>
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="pdf-loading"><AntonLoader size="sm" /></div>}
          error={<div className="pdf-error">Failed to load PDF.</div>}
        >
          {Array.from(new Array(numPages), (_, index) => (
            <div
              key={`page_${index + 1}`}
              className="pdf-page-wrapper"
              ref={el => { pageRefs.current[index + 1] = el }}
            >
              <div className="pdf-container-inner">
                <Page
                  pageNumber={index + 1}
                  scale={scale}
                  customTextRenderer={makeTextRenderer(index + 1)}
                  renderAnnotationLayer={false}
                  renderTextLayer={true}
                />
              </div>
            </div>
          ))}
        </Document>
      </div>

      {citations.length > 0 && (
        <div className="pdf-citation-pills">
          {citations.map((c, i) => (
            <button
              key={i}
              className={`pdf-citation-pill ${currentPage === c.pageNumber ? "active" : ""}`}
              onClick={() => jumpToPage(c.pageNumber)}
            >
              Page {c.pageNumber}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}