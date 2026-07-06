import { faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useState } from 'react'
import '../SolicitarRecolha/SolicitarRecolha.css'

function formatLocalizacao(item) {
  if (!item) return ''
  const detail = item.locationDetail?.replace(/\s*-\s*/g, ', ')
  if (detail) return detail
  if (item.location) return item.location
  return [item.locationPrefix, item.locationDetail].filter(Boolean).join(', ')
}

function formatPeriod(period) {
  const value = (period ?? '').trim()
  if (!value) return ''
  const normalized = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (normalized === 'manha') return 'manhã'
  if (normalized === 'tarde') return 'tarde'
  return value
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
 * Confirmação de apagar pedido (recolha + entrega associados).
 */
export default function ApagarPedido({ isOpen, movimentoItem = null, onClose, onConfirm }) {
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const localizacao = formatLocalizacao(movimentoItem)
  const contentorId = movimentoItem?.pedidoGroupContentorId ?? movimentoItem?.id ?? '—'
  const periodoLabel = formatPeriod(movimentoItem?.periodo)
  const dataLabel = formatDateLabel(movimentoItem?.dataIso, movimentoItem?.scheduledAt)
  const groupTasks = movimentoItem?.pedidoGroupTasks ?? []
  const hasGroup = groupTasks.length > 1

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

  async function handleConfirm() {
    setFormError('')
    setSubmitting(true)
    try {
      await onConfirm?.()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível apagar o pedido.')
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
                Apagar Pedido
              </h2>

              {formError ? (
                <p className="solicitar-recolha__alert" role="alert">
                  {formError}
                </p>
              ) : null}

              <p className="solicitar-recolha__locked-value" style={{ marginBottom: 16 }}>
                {hasGroup
                  ? 'Este pedido inclui recolha e entrega associadas. Ambos os movimentos serão apagados.'
                  : 'Tem a certeza que deseja apagar este pedido?'}
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
              <button
                type="button"
                className="solicitar-recolha__submit"
                disabled={submitting || !movimentoItem}
                tabIndex={isOpen ? 0 : -1}
                onClick={handleConfirm}
              >
                {submitting ? 'A apagar…' : hasGroup ? 'Apagar recolha e entrega' : 'Apagar pedido'}
              </button>
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
