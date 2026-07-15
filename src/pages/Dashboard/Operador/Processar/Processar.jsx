import { faRecycle, faTruck } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import processarBg from '../../../../assets/figma-operador/processar-bg.jpg'
import processarIllustration from '../../../../assets/figma-cliente/icon-section-contentores.png'
import './Processar.css'

/**
 * Ecrã «Processar» (Figma SOLO-URBANO-App_v3, nó 48:3104).
 */
export default function Processar({
  isOpen,
  qrError,
  onDismissQrError,
  onClose,
  onSelectRecolha,
  onSelectEntrega,
}) {
  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prev
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="processar-screen processar-screen--open">
      <div
        className="processar-screen__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="processar-intro"
      >
        <img src={processarBg} alt="" className="processar-screen__bg" />
        <div className="processar-screen__overlay" aria-hidden="true" />

        <div className="processar-screen__content">
          <p id="processar-intro" className="processar-screen__intro">
            Para dar continuidade ao processamento,
            <br />
            por favor selecione uma das opções
          </p>

          <img
            src={processarIllustration}
            alt=""
            className="processar-screen__illustration"
            width={266}
            height={120}
          />

          {qrError ? (
            <p className="processar-screen__qr-error" role="alert">
              {qrError}
              <button
                type="button"
                className="processar-screen__qr-error-dismiss"
                onClick={onDismissQrError}
              >
                Fechar
              </button>
            </p>
          ) : null}

          <div className="processar-screen__actions">
            <button
              type="button"
              className="processar-screen__action processar-screen__action--recolha"
              onClick={onSelectRecolha}
            >
              <FontAwesomeIcon icon={faRecycle} className="processar-screen__action-icon" aria-hidden />
              Recolha
            </button>
            <button
              type="button"
              className="processar-screen__action processar-screen__action--entrega"
              onClick={onSelectEntrega}
            >
              <FontAwesomeIcon icon={faTruck} className="processar-screen__action-icon" aria-hidden />
              Entrega
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
