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
const BUFFER = window.innerWidth < 768 ? 2 : 5
const PAGE_HEIGHT_ESTIMATE = 842 // A4 at 96dpi, used for placeholder sizing

export default function PDFViewer({ url, fileName, citations = [], activePage }: Props) {
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [containerWidth, setContainerWidth] = useState(480)
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1]))
  const containerRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const observerRef = useRef<IntersectionObserver | null>(null)

  // responsive width
  useEffect(() => {
    const updateWidth = () => {
      const panel = document.querySelector(".chat-panel-pdf")
      if (panel) setContainerWidth((panel as HTMLElement).clientWidth - 32)
    }
    updateWidth()
    window.addEventListener("resize", updateWidth)
    return () => window.removeEventListener("resize", updateWidth)
  }, [])

  // jump to cited page
  useEffect(() => {
    if (activePage && pageRefs.current[activePage]) {
      pageRefs.current[activePage]?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [activePage])

  // IntersectionObserver → track which pages are visible
  useEffect(() => {
    if (!numPages) return

    // disconnect previous observer
    observerRef.current?.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const pageNum = parseInt(entry.target.getAttribute("data-page") ?? "0")
          if (!pageNum) return

          if (entry.isIntersecting) {
            // page entered viewport → render it + buffer pages
            setVisiblePages(prev => {
              const next = new Set(prev)
              for (let i = Math.max(1, pageNum - BUFFER); i <= Math.min(numPages, pageNum + BUFFER); i++) {
                next.add(i)
              }
              return next
            })
            setCurrentPage(pageNum)
          } else {
            // page left viewport → remove pages far from viewport
            setVisiblePages(prev => {
              const next = new Set(prev)
              // only remove if far away (more than 2 pages from current)
              if (Math.abs(pageNum - currentPage) > 2) {
                next.delete(pageNum)
              }
              return next
            })
          }
        })
      },
      {
        root: containerRef.current,
        rootMargin: "200px 0px", // start loading 200px before page enters view
        threshold: 0.1,
      }
    )

    // observe all page wrapper divs
    Object.values(pageRefs.current).forEach(el => {
      if (el) observerRef.current?.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [numPages, currentPage])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    // seed first 3 pages
    setVisiblePages(new Set([1, 2, 3]))
  }

  const makeTextRenderer = useCallback(
    (pageNumber: number) =>
      ({ str }: { str: string }) => {
        const pageCitations = citations.filter(c => c.pageNumber === pageNumber)
        if (!pageCitations.length) return str
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
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
        >−</button>
        <span className="pdf-zoom-level">{Math.round(scale * 100)}%</span>
        <button
          className="pdf-zoom-btn"
          onClick={() => setScale(s => Math.min(2.0, parseFloat((s + 0.2).toFixed(1))))}
          disabled={scale >= 2.0}
          aria-label="Zoom in"
        >+</button>
      </div>

      <div className="pdf-viewer-body" ref={containerRef}>
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={<div className="pdf-loading"><AntonLoader size="sm" /></div>}
          error={<div className="pdf-error">Failed to load PDF.</div>}
          options={{ disableAutoFetch: true }}
        >
          {Array.from({ length: numPages }, (_, i) => {
            const pageNum = i + 1
            const isRendered = visiblePages.has(pageNum)

            return (
              <div
                key={pageNum}
                data-page={pageNum}
                className="pdf-page-wrapper"
                ref={el => { pageRefs.current[pageNum] = el }}
                style={{
                  // placeholder height keeps scroll position stable
                  minHeight: isRendered ? undefined : `${PAGE_HEIGHT_ESTIMATE * scale}px`,
                }}
              >
                {isRendered ? (
                  <div className="pdf-container-inner">
                    <Page
                      pageNumber={pageNum}
                      scale={scale}
                      width={Math.min(containerWidth, 600)}
                      customTextRenderer={makeTextRenderer(pageNum)}
                      renderAnnotationLayer={false}
                      renderTextLayer={true}
                    />
                  </div>
                ) : (
                  // placeholder → no canvas, no memory
                  <div
                    className="pdf-page-placeholder"
                    style={{ height: `${PAGE_HEIGHT_ESTIMATE * scale}px` }}
                  />
                )}
              </div>
            )
          })}
        </Document>
      </div>

      {citations.length > 0 && (
        <div className="pdf-citation-pills">
          {citations.map((c, i) => (
            <button
              key={i}
              className={`pdf-citation-pill ${currentPage === c.pageNumber ? "active" : ""}`}
              onClick={() => {
                pageRefs.current[c.pageNumber]?.scrollIntoView({ behavior: "smooth", block: "start" })
              }}
            >
              Page {c.pageNumber}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}