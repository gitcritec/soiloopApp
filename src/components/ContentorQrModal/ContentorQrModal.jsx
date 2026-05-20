import { useEffect, useState } from 'react'
import { faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { buildQrcodeImageUrl } from '../../lib/strapiContentores.js'
import './ContentorQrModal.css'

/**
 * Pré-visualização do QR do contentor (imagem Strapi ou fallback) + download.
 */
export default function ContentorQrModal({ isOpen, onClose, cid, qrcodeImageUrl }) {
  const label = (cid ?? '').trim()
  const imageUrl = (qrcodeImageUrl ?? '').trim() || buildQrcodeImageUrl(label)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  useEffect(() => {
    if (!isOpen) return undefined
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) {
      setDownloading(false)
      setDownloadError('')
    }
  }, [isOpen])

  async function handleDownload() {
    if (!imageUrl || !label) return
    setDownloadError('')
    setDownloading(true)

    const filename = `${label.replace(/[^a-zA-Z0-9-]/g, '_')}-qrcode.png`

    try {
      const res = await fetch(imageUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      link.rel = 'noopener'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
    } catch {
      try {
        const link = document.createElement('a')
        link.href = imageUrl
        link.download = filename
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        document.body.appendChild(link)
        link.click()
        link.remove()
      } catch {
        setDownloadError('Não foi possível transferir a imagem. Tenta outra vez.')
      }
    } finally {
      setDownloading(false)
    }
  }

  if (!isOpen || !label) return null

  return (
    <div className="contentor-qr-modal" role="dialog" aria-modal="true" aria-labelledby="contentor-qr-title">
      <button type="button" className="contentor-qr-modal__backdrop" aria-label="Fechar" onClick={onClose} />
      <div className="contentor-qr-modal__panel">
        <button type="button" className="contentor-qr-modal__close" aria-label="Fechar" onClick={onClose}>
          <FontAwesomeIcon icon={faXmark} />
        </button>
        <h2 id="contentor-qr-title" className="contentor-qr-modal__title">
          QR Code
        </h2>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`QR code ${label}`}
            className="contentor-qr-modal__image"
            width={320}
            height={360}
          />
        ) : null}
        {imageUrl ? (
          <button
            type="button"
            className="contentor-qr-modal__download"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? 'A descarregar…' : 'Descarregar QR code'}
          </button>
        ) : null}
        {downloadError ? (
          <p className="contentor-qr-modal__error" role="alert">
            {downloadError}
          </p>
        ) : null}
      </div>
    </div>
  )
}
