import { useEffect, useState } from 'react'
import { faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  IOS_MANUAL_SAVE_HINT,
  IOS_SAVE_ERROR_HINT,
  IOS_SHARE_SAVE_HINT,
  canIosPickSaveLocation,
  fetchImageBlob,
  isIosDevice,
  saveImageBlob,
  saveImageButtonLabel,
} from '../../lib/downloadImage.js'
import { buildQrcodeImageUrl } from '../../lib/strapiContentores.js'
import './ContentorQrModal.css'

/**
 * Pré-visualização do QR do contentor (imagem Strapi ou fallback) + guardar.
 */
export default function ContentorQrModal({ isOpen, onClose, cid, qrcodeImageUrl }) {
  const label = (cid ?? '').trim()
  const imageUrl = (qrcodeImageUrl ?? '').trim() || buildQrcodeImageUrl(label)
  const ios = isIosDevice()
  const iosCanPickFolder = canIosPickSaveLocation()
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [manualHintActive, setManualHintActive] = useState(false)
  const downloadLabel = saveImageButtonLabel()

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
      setManualHintActive(false)
    }
  }, [isOpen])

  async function handleDownload() {
    if (!imageUrl || !label) return
    setDownloadError('')
    setManualHintActive(false)

    if (ios && !window.isSecureContext) {
      setManualHintActive(true)
      return
    }

    setDownloading(true)
    const filename = `${label.replace(/[^a-zA-Z0-9-]/g, '_')}-qrcode.png`

    try {
      const blob = await fetchImageBlob(imageUrl)
      const result = await saveImageBlob(blob, filename)
      if (result.method === 'cancelled') return
      if (result.method === 'manual') {
        setManualHintActive(true)
        if (iosCanPickFolder) setDownloadError(IOS_SAVE_ERROR_HINT)
        return
      }
    } catch {
      if (ios) {
        setManualHintActive(true)
        return
      }
      setDownloadError('Não foi possível guardar a imagem. Tenta outra vez.')
    } finally {
      setDownloading(false)
    }
  }

  if (!isOpen || !label) return null

  const showLocalHint = ios && !window.isSecureContext
  const showShareHint = iosCanPickFolder && !manualHintActive

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
        {showLocalHint ? (
          <p
            className={`contentor-qr-modal__ios-hint${manualHintActive ? ' contentor-qr-modal__ios-hint--active' : ''}`}
          >
            {IOS_MANUAL_SAVE_HINT}
          </p>
        ) : null}
        {showShareHint ? (
          <p className="contentor-qr-modal__ios-hint contentor-qr-modal__ios-hint--share">
            {IOS_SHARE_SAVE_HINT}
          </p>
        ) : null}
        {manualHintActive && !showLocalHint ? (
          <p className="contentor-qr-modal__ios-hint contentor-qr-modal__ios-hint--active">
            {IOS_MANUAL_SAVE_HINT}
          </p>
        ) : null}
        {imageUrl ? (
          <div
            className={`contentor-qr-modal__image-wrap${manualHintActive ? ' contentor-qr-modal__image-wrap--active' : ''}`}
          >
            <img
              src={imageUrl}
              alt={`QR code ${label}`}
              className="contentor-qr-modal__image"
              width={320}
              height={360}
            />
          </div>
        ) : null}
        {imageUrl ? (
          <button
            type="button"
            className="contentor-qr-modal__download"
            onClick={handleDownload}
            disabled={downloading}
          >
            {downloading ? 'A preparar…' : downloadLabel}
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
