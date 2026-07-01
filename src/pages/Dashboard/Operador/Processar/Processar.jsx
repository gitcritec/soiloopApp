import { faMemo, faRecycle, faTruck, faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect } from 'react'
import processarBg from '../../../../assets/figma-operador/processar-bg.jpg'
import processarIllustration from '../../../../assets/figma-cliente/icon-section-contentores.png'
import './Processar.css'

/**
 * Ecrã «Processar» (Figma SOLO-URBANO-App_v3, nó 52:4219).
 * Slide da direita para a esquerda, largura total (padrão do menu operador).
 */
export default function Processar({
  isOpen,
  qrError,
  onDismissQrError,
  onClose,
  onSelectRecolha,
  onSelectEntrega,
  onSelectMovimentosRecolha,
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

  return (
    <div
      className={`processar-screen${isOpen ? ' processar-screen--open' : ''}`}
      aria-hidden={!isOpen}
    >
      <div
        className="processar-screen__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="processar-title"
        aria-hidden={!isOpen}
      >
        <img src={processarBg} alt="" className="processar-screen__bg" />
        <div className="processar-screen__overlay" aria-hidden="true" />

        <button
          type="button"
          className="processar-screen__close"
          aria-label="Fechar"
          tabIndex={isOpen ? 0 : -1}
          onClick={onClose}
        >
          <FontAwesomeIcon icon={faXmark} aria-hidden />
        </button>

        <div className="processar-screen__content">
          <h1 id="processar-title" className="processar-screen__title">
            Processar
          </h1>
          <p className="processar-screen__intro">
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
              tabIndex={isOpen ? 0 : -1}
              onClick={onSelectRecolha}
            >
              <FontAwesomeIcon icon={faRecycle} className="processar-screen__action-icon" aria-hidden />
              Recolha
            </button>
            <button
              type="button"
              className="processar-screen__action processar-screen__action--entrega"
              tabIndex={isOpen ? 0 : -1}
              onClick={onSelectEntrega}
            >
              <FontAwesomeIcon icon={faTruck} className="processar-screen__action-icon" aria-hidden />
              Entrega
            </button>
            <button
              type="button"
              className="processar-screen__action processar-screen__action--movimentos-recolha"
              tabIndex={isOpen ? 0 : -1}
              onClick={onSelectMovimentosRecolha}
            >
              <FontAwesomeIcon icon={faMemo} className="processar-screen__action-icon" aria-hidden />
              Preencher Formulário
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
