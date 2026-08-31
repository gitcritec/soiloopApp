import { faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useState } from 'react'
import { formatPeriodoLabel } from '../../../../lib/movimentoPeriodo.js'
import '../SolicitarRecolha/SolicitarRecolha.css'

function formatLocalizacao(item) {
  if (!item) return ''
  const detail = item.locationDetail?.replace(/\s*-\s*/g, ', ')
  if (detail) return detail
  if (item.location) return item.location
  return [item.locationPrefix, item.locationDetail].filter(Boolean).join(', ')
}

function formatDateLabel(dataIso, scheduledAt) {
  if (dataIso) {
    const [year, month, day] = dataIso.split('-')
    if (year && month && day) return `${day}/${month}/${year}`
  }
  const datePart = (scheduledAt ?? '').trim().split(/\s+/)[0]
  return datePart || '—'
}

/**
 * Confirmação de pedido de cancelamento (recolha + entrega associados).
 * Séries semanais: pergunta só esta vs esta e futuras (estilo calendário).
 * O cancelamento fica pendente até o admin aprovar.
 */
export default function ApagarPedido({ isOpen, movimentoItem = null, onClose, onConfirm }) {
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const localizacao = formatLocalizacao(movimentoItem)
  const contentorId = movimentoItem?.pedidoGroupContentorId ?? movimentoItem?.id ?? '—'
  const periodoLabel = formatPeriodoLabel(movimentoItem?.periodo)
  const dataLabel = formatDateLabel(movimentoItem?.dataIso, movimentoItem?.scheduledAt)
  const groupTasks = movimentoItem?.pedidoGroupTasks ?? []
  const hasGroup = groupTasks.length > 1
  const isSerie = Boolean(movimentoItem?.recorrenciaId)

  useEffect(() => {
    if (!isOpen) {
      setSubmitting(false)
      setFormError('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prev
    }
  }, [isOpen, onClose, submitting])

  async function handleConfirm(mode = 'single') {
    setFormError('')
    setSubmitting(true)
    try {
      await onConfirm?.(mode)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível pedir o cancelamento.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={`solicitar-recolha${isOpen ? ' solicitar-recolha--open' : ''}`}
      aria-hidden={!isOpen}
    >
      <div className="solicitar-recolha__backdrop" aria-hidden="true" onClick={submitting ? undefined : onClose} />

      <div
        className="solicitar-recolha__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="apagar-pedido-title"
        aria-hidden={!isOpen}
      >
        <div className="solicitar-recolha__form">
          <div className="solicitar-recolha__card">
            <button
              type="button"
              className="solicitar-recolha__close"
              aria-label="Fechar"
              tabIndex={isOpen ? 0 : -1}
              disabled={submitting}
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faXmark} aria-hidden />
            </button>

            <div className="solicitar-recolha__scroll">
              <h2 id="apagar-pedido-title" className="solicitar-recolha__title">
                Pedir cancelamento
              </h2>

              {formError ? (
                <p className="solicitar-recolha__alert" role="alert">
                  {formError}
                </p>
              ) : null}

              <p className="solicitar-recolha__locked-value" style={{ marginBottom: 16 }}>
                {isSerie
                  ? 'Este serviço faz parte de uma série semanal. Queres pedir o cancelamento só desta ocorrência ou também das futuras? O admin terá de aprovar.'
                  : hasGroup
                    ? 'Este pedido inclui recolha e entrega associadas. O cancelamento de ambos será enviado para aprovação do admin.'
                    : 'O cancelamento será enviado para aprovação do admin. Tem a certeza?'}
              </p>

              <div className="solicitar-recolha__fields">
                <div className="solicitar-recolha__field solicitar-recolha__field--locked">
                  <span className="solicitar-recolha__locked-value">{localizacao || '—'}</span>
                </div>

                <div className="solicitar-recolha__field solicitar-recolha__field--locked">
                  <span className="solicitar-recolha__locked-value">{contentorId}</span>
                </div>

                <div className="solicitar-recolha__field solicitar-recolha__field--locked">
                  <span className="solicitar-recolha__locked-value">
                    {dataLabel}
                    {periodoLabel ? ` · ${periodoLabel}` : ''}
                    {isSerie ? ' · Semanal' : ''}
                  </span>
                </div>

                {hasGroup ? (
                  <ul className="solicitar-recolha__field" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {groupTasks.map((task) => (
                      <li key={task.movimentoKey ?? task.label} className="solicitar-recolha__locked-value">
                        {task.label}
                        {task.collectionId && task.collectionId !== 'Não definido'
                          ? ` (${task.collectionId})`
                          : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>

            <div className="solicitar-recolha__actions">
              {isSerie ? (
                <>
                  <button
                    type="button"
                    className="solicitar-recolha__submit"
                    disabled={submitting || !movimentoItem}
                    tabIndex={isOpen ? 0 : -1}
                    onClick={() => handleConfirm('single')}
                  >
                    {submitting ? 'A enviar…' : 'Só esta'}
                  </button>
                  <button
                    type="button"
                    className="solicitar-recolha__submit"
                    disabled={submitting || !movimentoItem}
                    tabIndex={isOpen ? 0 : -1}
                    onClick={() => handleConfirm('future')}
                  >
                    Esta e futuras
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="solicitar-recolha__submit"
                  disabled={submitting || !movimentoItem}
                  tabIndex={isOpen ? 0 : -1}
                  onClick={() => handleConfirm('single')}
                >
                  {submitting
                    ? 'A enviar…'
                    : hasGroup
                      ? 'Pedir cancelamento (recolha e entrega)'
                      : 'Pedir cancelamento'}
                </button>
              )}
              <button
                type="button"
                className="solicitar-recolha__discard"
                disabled={submitting}
                tabIndex={isOpen ? 0 : -1}
                onClick={onClose}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
