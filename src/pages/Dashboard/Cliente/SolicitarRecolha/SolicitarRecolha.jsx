import { faChevronDown, faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useMemo, useRef, useState } from 'react'
import './SolicitarRecolha.css'

const PERIODOS = [
  { value: 'manha', label: 'manhã' },
  { value: 'tarde', label: 'tarde' },
]
const TROCAR_CONTENTOR_OPCOES = ['Sim', 'Não']

function emptyForm() {
  return {
    data: '',
    periodo: '',
    observacoes: '',
    trocarContentor: '',
  }
}

function formatLocalizacao(item) {
  if (!item) return ''
  const detail = item.locationDetail?.replace(/\s*-\s*/g, ', ')
  if (detail) return detail
  if (item.location) return item.location
  return [item.locationPrefix, item.locationDetail].filter(Boolean).join(', ')
}

/**
 * Formulário cliente — solicitar nova recolha (Figma SOLO-URBANO-App_v3, nó 166:4503).
 */
export default function SolicitarRecolha({
  isOpen,
  containerItem = null,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() => emptyForm())
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const dateInputRef = useRef(null)

  const contentorId = containerItem?.id ?? containerItem?.contentorId ?? ''
  const localizacao = formatLocalizacao(containerItem)
  const hasContainer = Boolean(contentorId)

  const canSubmit = useMemo(() => {
    if (!hasContainer || submitting) return false
    return Boolean(form.data.trim()) && Boolean(form.periodo.trim()) && Boolean(form.trocarContentor.trim())
  }, [hasContainer, submitting, form.data, form.periodo, form.trocarContentor])

  const canDiscard = useMemo(() => {
    return Boolean(
      form.data.trim() ||
        form.periodo.trim() ||
        form.observacoes.trim() ||
        form.trocarContentor.trim(),
    )
  }, [form.data, form.periodo, form.observacoes, form.trocarContentor])

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyForm())
      setSubmitting(false)
      setFormError('')
      return
    }
    setForm(emptyForm())
    setFormError('')
  }, [isOpen, contentorId])

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

  function handleDiscard() {
    setForm(emptyForm())
    setFormError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    setFormError('')
    setSubmitting(true)
    try {
      await onSubmit?.({
        contentorId,
        localizacaoId: containerItem?.localizacaoId ?? '',
        localizacao,
        data: form.data.trim(),
        periodo: form.periodo.trim(),
        observacoes: form.observacoes.trim(),
        trocarContentor: form.trocarContentor.trim(),
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível solicitar a recolha.')
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
        aria-labelledby="solicitar-recolha-title"
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
              <h2 id="solicitar-recolha-title" className="solicitar-recolha__title">
                Solicitar Nova Recolha
              </h2>

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
                  <span className="solicitar-recolha__locked-value">{contentorId || '—'}</span>
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
                    disabled={!hasContainer}
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
                      disabled={!hasContainer}
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

                <label className="solicitar-recolha__field">
                  <input
                    type="text"
                    className={`solicitar-recolha__input${form.observacoes ? '' : ' solicitar-recolha__input--placeholder-only'}`}
                    name="observacoes"
                    value={form.observacoes}
                    onChange={(e) => updateField('observacoes', e.target.value)}
                    disabled={!hasContainer}
                    tabIndex={isOpen ? 0 : -1}
                    aria-label="Observações"
                  />
                  {!form.observacoes ? (
                    <span className="solicitar-recolha__placeholder">Observações</span>
                  ) : null}
                </label>

                <label className="solicitar-recolha__field">
                  <span className="solicitar-recolha__select-wrap">
                    <select
                      className={`solicitar-recolha__select${form.trocarContentor ? '' : ' solicitar-recolha__select--empty'}`}
                      value={form.trocarContentor}
                      onChange={(e) => updateField('trocarContentor', e.target.value)}
                      disabled={!hasContainer}
                      required
                      tabIndex={isOpen ? 0 : -1}
                      aria-label="Trocar Contentor"
                    >
                      <option value="" disabled>
                        Trocar Contentor*
                      </option>
                      {TROCAR_CONTENTOR_OPCOES.map((opcao) => (
                        <option key={opcao} value={opcao}>
                          {opcao}
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
                {submitting ? 'A registar…' : 'Confirmar Registo'}
              </button>
              <button
                type="button"
                className="solicitar-recolha__discard"
                disabled={!canDiscard || submitting}
                tabIndex={isOpen ? 0 : -1}
                onClick={handleDiscard}
              >
                Descartar Alterações
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
