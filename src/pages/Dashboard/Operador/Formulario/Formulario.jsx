import { faArrowLeft } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useState } from 'react'
import './Formulario.css'

const MODE_LABEL = {
  recolher: 'Recolha',
  entregar: 'Entrega',
}

/**
 * Formulário de processamento após leitura QR (Figma SOLO-URBANO-App_v3).
 * Campos do QR em inputs ocultos; cliente/localização vêm do backend no futuro.
 */
export default function Formulario({
  isOpen,
  mode = 'recolher',
  contentorId = '',
  onClose,
  onSubmit,
}) {
  const [observacoes, setObservacoes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setObservacoes('')
      setSubmitting(false)
    }
  }, [isOpen])

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

  const modeLabel = MODE_LABEL[mode] ?? mode
  const hasContentor = Boolean(contentorId?.trim())

  async function handleSubmit(event) {
    event.preventDefault()
    if (!hasContentor) return
    setSubmitting(true)
    try {
      await onSubmit?.({
        modo: mode,
        contentorId: contentorId.trim(),
        observacoes: observacoes.trim(),
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={`formulario-screen${isOpen ? ' formulario-screen--open' : ''}`}
      aria-hidden={!isOpen}
    >
      <div
        className="formulario-screen__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="formulario-title"
        aria-hidden={!isOpen}
      >
        <header className="formulario-screen__header">
          <button
            type="button"
            className="formulario-screen__back"
            aria-label="Voltar"
            tabIndex={isOpen ? 0 : -1}
            onClick={onClose}
          >
            <FontAwesomeIcon icon={faArrowLeft} aria-hidden />
          </button>
          <p className={`formulario-screen__mode formulario-screen__mode--${mode}`}>
            {modeLabel}
          </p>
        </header>

        <div className="formulario-screen__scroll">
          <div className="formulario-screen__inner">
            <h1 id="formulario-title" className="formulario-screen__title">
              Formulário
            </h1>

            {hasContentor ? (
              <dl className="formulario-screen__summary">
                <div>
                  <dt>Contentor</dt>
                  <dd>{contentorId}</dd>
                </div>
              </dl>
            ) : (
              <p className="formulario-screen__summary">
                Leia o código QR do contentor para preencher os dados automaticamente.
              </p>
            )}

            <form className="formulario-screen__form" onSubmit={handleSubmit}>
              <input
                type="hidden"
                name="contentorId"
                className="formulario-screen__hidden"
                value={contentorId}
                readOnly
                tabIndex={-1}
                aria-hidden="true"
              />
              <input
                type="hidden"
                name="modo"
                className="formulario-screen__hidden"
                value={mode}
                readOnly
                tabIndex={-1}
                aria-hidden="true"
              />

              <label className="formulario-screen__label" htmlFor="formulario-observacoes">
                Observações
              </label>
              <textarea
                id="formulario-observacoes"
                className="formulario-screen__textarea"
                name="observacoes"
                placeholder="Indique observações relevantes (opcional)"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                tabIndex={isOpen ? 0 : -1}
              />

              <button
                type="submit"
                className={`formulario-screen__submit${
                  mode === 'entregar' ? ' formulario-screen__submit--entregar' : ''
                }`}
                disabled={!hasContentor || submitting}
                tabIndex={isOpen ? 0 : -1}
              >
                {submitting ? 'A registar…' : 'Registar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
