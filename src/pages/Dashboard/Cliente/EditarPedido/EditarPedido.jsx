import { faChevronDown, faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useMemo, useRef, useState } from 'react'
import '../SolicitarRecolha/SolicitarRecolha.css'

const PERIODOS = [
  { value: 'manha', label: 'manhã' },
  { value: 'tarde', label: 'tarde' },
]

function formatLocalizacao(item) {
  if (!item) return ''
  const detail = item.locationDetail?.replace(/\s*-\s*/g, ', ')
  if (detail) return detail
  if (item.location) return item.location
  return [item.locationPrefix, item.locationDetail].filter(Boolean).join(', ')
}

/**
 * Edição de pedido/recolha — apenas data e período.
 */
export default function EditarPedido({
  isOpen,
  movimentoItem = null,
  resetToApproval = false,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState({ data: '', periodo: '' })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const dateInputRef = useRef(null)

  const contentorId = movimentoItem?.pedidoGroupContentorId ?? movimentoItem?.id ?? '—'
  const localizacao = formatLocalizacao(movimentoItem)
  const hasMovimento = Boolean(movimentoItem?.movimentoKey)
  const groupTasks = movimentoItem?.pedidoGroupTasks ?? []
  const hasGroup = groupTasks.length > 1

  const canSubmit = useMemo(() => {
    if (!hasMovimento || submitting) return false
    return Boolean(form.data.trim()) && Boolean(form.periodo.trim())
  }, [hasMovimento, submitting, form.data, form.periodo])

  useEffect(() => {
    if (!isOpen || !movimentoItem) {
      setForm({ data: '', periodo: '' })
      setSubmitting(false)
      setFormError('')
      return
    }
    setForm({
      data: movimentoItem.dataIso ?? '',
      periodo: movimentoItem.periodo ?? '',
    })
    setFormError('')
  }, [isOpen, movimentoItem])

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

  function openDatePicker() {
    const input = dateInputRef.current
    if (!input || input.disabled) return
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker()
        return
      } catch {
        /* Safari pode bloquear fora de gesto direto */
      }
    }
    input.focus()
    input.click()
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFormError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    setFormError('')
    setSubmitting(true)
    try {
      await onSubmit?.({
        movimentoKeys: movimentoItem.pedidoGroupMovimentoKeys?.length
          ? movimentoItem.pedidoGroupMovimentoKeys
          : [movimentoItem.movimentoKey],
        data: form.data.trim(),
        periodo: form.periodo.trim(),
        resetToApproval,
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível guardar as alterações.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={`solicitar-recolha${isOpen ? ' solicitar-recolha--open' : ''}`}
      aria-hidden={!isOpen}
    >
      <div className="solicitar-recolha__backdrop" aria-hidden="true" onClick={onClose} />

      <div
        className="solicitar-recolha__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editar-pedido-title"
        aria-hidden={!isOpen}
      >
        <form className="solicitar-recolha__form" onSubmit={handleSubmit} noValidate>
          <div className="solicitar-recolha__card">
            <button
              type="button"
              className="solicitar-recolha__close"
              aria-label="Fechar"
              tabIndex={isOpen ? 0 : -1}
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faXmark} aria-hidden />
            </button>

            <div className="solicitar-recolha__scroll">
              <h2 id="editar-pedido-title" className="solicitar-recolha__title">
                Editar Pedido{resetToApproval ? ' — requer aprovação' : ''}
              </h2>

              {hasGroup ? (
                <p className="solicitar-recolha__locked-value" style={{ marginBottom: 12 }}>
                  Alterações aplicam-se à recolha e entrega associadas ({contentorId}).
                </p>
              ) : null}

              {formError ? (
                <p className="solicitar-recolha__alert" role="alert">
                  {formError}
                </p>
              ) : null}

              <div className="solicitar-recolha__fields">
                <div className="solicitar-recolha__field solicitar-recolha__field--locked">
                  <span className="solicitar-recolha__locked-value">{localizacao || '—'}</span>
                  <FontAwesomeIcon icon={faChevronDown} className="solicitar-recolha__locked-icon" aria-hidden />
                </div>

                <div className="solicitar-recolha__field solicitar-recolha__field--locked">
                  <span className="solicitar-recolha__locked-value">{contentorId}</span>
                  <FontAwesomeIcon icon={faChevronDown} className="solicitar-recolha__locked-icon" aria-hidden />
                </div>

                <label
                  className="solicitar-recolha__field solicitar-recolha__field--date"
                  onClick={openDatePicker}
                >
                  <input
                    ref={dateInputRef}
                    type="date"
                    className={`solicitar-recolha__input${form.data ? '' : ' solicitar-recolha__input--empty'}`}
                    name="data"
                    value={form.data}
                    onChange={(e) => updateField('data', e.target.value)}
                    disabled={!hasMovimento}
                    required
                    tabIndex={isOpen ? 0 : -1}
                    aria-label="Data"
                  />
                  {!form.data ? (
                    <span className="solicitar-recolha__placeholder">Data*</span>
                  ) : null}
                </label>

                <label className="solicitar-recolha__field">
                  <span className="solicitar-recolha__select-wrap">
                    <select
                      className={`solicitar-recolha__select${form.periodo ? '' : ' solicitar-recolha__select--empty'}`}
                      value={form.periodo}
                      onChange={(e) => updateField('periodo', e.target.value)}
                      disabled={!hasMovimento}
                      required
                      tabIndex={isOpen ? 0 : -1}
                      aria-label="Período"
                    >
                      <option value="" disabled>
                        Período*
                      </option>
                      {PERIODOS.map((periodo) => (
                        <option key={periodo.value} value={periodo.value}>
                          {periodo.label}
                        </option>
                      ))}
                    </select>
                    <FontAwesomeIcon icon={faChevronDown} className="solicitar-recolha__select-icon" aria-hidden />
                  </span>
                </label>
              </div>
            </div>

            <div className="solicitar-recolha__actions">
              <button
                type="submit"
                className="solicitar-recolha__submit"
                disabled={!canSubmit}
                tabIndex={isOpen ? 0 : -1}
              >
                {submitting ? 'A guardar…' : 'Guardar Alterações'}
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
        </form>
      </div>
    </div>
  )
}
