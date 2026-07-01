import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import './PdfScrollViewer.css'

GlobalWorkerOptions.workerSrc = pdfjsWorker

/**
 * PDF página a página com scroll vertical (sem iframe / visualizador nativo).
 */
export default function PdfScrollViewer({ blobUrl }) {
  const hostRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pageCount, setPageCount] = useState(0)

  useEffect(() => {
    const host = hostRef.current
    if (!host || !blobUrl) return undefined

    let cancelled = false
    let renderTask = null
    let lastWidth = 0

    async function renderPdf() {
      const width = Math.floor(host.clientWidth || 320)
      if (width < 50) return
      lastWidth = width

      setLoading(true)
      setError(null)
      setPageCount(0)
      host.innerHTML = ''

      try {
        const pdf = await getDocument(blobUrl).promise
        if (cancelled) return

        const total = pdf.numPages
        setPageCount(total)

        for (let pageNum = 1; pageNum <= total; pageNum += 1) {
          if (cancelled) return

          const page = await pdf.getPage(pageNum)
          const baseViewport = page.getViewport({ scale: 1 })
          const scale = width / baseViewport.width
          const viewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          canvas.className = 'pdf-scroll-viewer__page'
          canvas.width = Math.floor(viewport.width)
          canvas.height = Math.floor(viewport.height)

          renderTask = page.render({
            canvasContext: canvas.getContext('2d'),
            viewport,
          })
          await renderTask.promise
          renderTask = null

          if (cancelled) return
          host.appendChild(canvas)
        }
      } catch {
        if (!cancelled) {
          setError('Não foi possível mostrar o PDF.')
          host.innerHTML = ''
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    renderPdf()

    const observer = new ResizeObserver(() => {
      const width = Math.floor(host.clientWidth || 0)
      if (width < 50 || width === lastWidth) return
      renderPdf()
    })
    observer.observe(host)

    return () => {
      cancelled = true
      observer.disconnect()
      renderTask?.cancel?.()
      host.innerHTML = ''
    }
  }, [blobUrl])

  return (
    <div className="pdf-scroll-viewer">
      {loading ? (
        <p className="pdf-scroll-viewer__status" role="status">
          A preparar PDF…
        </p>
      ) : null}

      {!loading && error ? (
        <p className="pdf-scroll-viewer__status pdf-scroll-viewer__status--error" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && pageCount > 1 ? (
        <p className="pdf-scroll-viewer__hint">{pageCount} páginas — desliza para ver</p>
      ) : null}

      <div ref={hostRef} className="pdf-scroll-viewer__pages" />
    </div>
  )
}
