import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { faArrowDownToLine, faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { fetchStrapiMediaBlob } from '../../lib/strapiMedia.js'
import PdfScrollViewer from './PdfScrollViewer.jsx'
import './TicketAttachmentModal.css'

/**
 * Pré-visualização de anexo na mesma página (sem novo separador).
 */
export default function TicketAttachmentModal({ isOpen, onClose, url, name, kind = 'file' }) {
  const [previewSrc, setPreviewSrc] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    if (!isOpen) return undefined
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !url || kind === 'file') {
      setPreviewSrc(null)
      setLoadError(null)
      setLoading(false)
      return undefined
    }

    let objectUrl = null
    let cancelled = false

    async function loadPreview() {
      setLoading(true)
      setLoadError(null)
      setPreviewSrc(null)

      try {
        const blob = await fetchStrapiMediaBlob(url)
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setPreviewSrc(objectUrl)
      } catch {
        if (!cancelled) {
          setLoadError('Não foi possível carregar o ficheiro. Tenta descarregar.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPreview()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [isOpen, url, kind])

  async function handleDownload() {
    if (!url) return
    try {
      const blob = await fetchStrapiMediaBlob(url)
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = name?.trim() || 'anexo'
      anchor.click()
      URL.revokeObjectURL(objectUrl)
    } catch {
      setLoadError('Não foi possível descarregar o ficheiro.')
    }
  }

  if (!isOpen || !url) return null

  const title = name?.trim() || 'Anexo'

  const modal = (
    <div
      className={`ticket-attachment-modal${kind === 'pdf' ? ' ticket-attachment-modal--pdf' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-attachment-modal-title"
    >
      <button
        type="button"
        className="ticket-attachment-modal__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />

      <div className="ticket-attachment-modal__panel">
        <header className="ticket-attachment-modal__head">
          <h2 id="ticket-attachment-modal-title" className="ticket-attachment-modal__title">
            {title}
          </h2>
          <div className="ticket-attachment-modal__actions">
            {kind === 'pdf' || kind === 'file' ? (
              <button
                type="button"
                className="ticket-attachment-modal__action"
                aria-label="Descarregar ficheiro"
                onClick={handleDownload}
              >
                <FontAwesomeIcon icon={faArrowDownToLine} aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              className="ticket-attachment-modal__action ticket-attachment-modal__action--close"
              aria-label="Fechar"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faXmark} aria-hidden />
            </button>
          </div>
        </header>

        <div className="ticket-attachment-modal__body">
          {loading ? (
            <p className="ticket-attachment-modal__status" role="status">
              A carregar ficheiro…
            </p>
          ) : null}

          {!loading && loadError ? (
            <div className="ticket-attachment-modal__file">
              <p className="ticket-attachment-modal__file-text" role="alert">
                {loadError}
              </p>
              <button type="button" className="ticket-attachment-modal__download" onClick={handleDownload}>
                Descarregar ficheiro
              </button>
            </div>
          ) : null}

          {!loading && !loadError && kind === 'image' && previewSrc ? (
            <img src={previewSrc} alt={title} className="ticket-attachment-modal__image" />
          ) : null}

          {!loading && !loadError && kind === 'pdf' && previewSrc ? (
            <PdfScrollViewer blobUrl={previewSrc} />
          ) : null}

          {!loading && kind === 'file' ? (
            <div className="ticket-attachment-modal__file">
              <p className="ticket-attachment-modal__file-text">
                Pré-visualização não disponível para este tipo de ficheiro.
              </p>
              <button type="button" className="ticket-attachment-modal__download" onClick={handleDownload}>
                Descarregar ficheiro
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
