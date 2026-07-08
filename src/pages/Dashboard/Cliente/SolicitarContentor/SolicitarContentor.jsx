import { faChevronDown, faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useMemo, useRef, useState } from 'react'
import '../SolicitarRecolha/SolicitarRecolha.css'
import { IconContentor } from '../../../../components/icons/icons.jsx'
import { fetchStrapiCapacidades } from '../../../../lib/strapiContentores.js'
import { fetchStrapiClienteDetail } from '../../../../lib/strapiClientes.js'
import { getStrapiCurrentUserId } from '../../../../lib/strapiTickets.js'
import { MOVIMENTO_PERIODO_OPTIONS } from '../../../../lib/movimentoPeriodo.js'

const PERIODOS = MOVIMENTO_PERIODO_OPTIONS

function emptyForm(capacidadeId = '') {
  return {
    data: '',
    periodo: '',
    observacoes: '',
    capacidadeId,
  }
}

/**
 * Formulário cliente — solicitar novo contentor (Figma SOLO-URBANO-App_v3, nó 166:4574).
 */
export default function SolicitarContentor({ isOpen, onClose, onSubmit }) {
  const [form, setForm] = useState(() => emptyForm())
  const [capacidades, setCapacidades] = useState([])
  const [loadingCaps, setLoadingCaps] = useState(false)
  const [capsError, setCapsError] = useState('')
  const [localizacaoId, setLocalizacaoId] = useState('')
  const [localizacaoLabel, setLocalizacaoLabel] = useState('')
  const [loadingContext, setLoadingContext] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const dateInputRef = useRef(null)

  const hasLocalizacao = Boolean(localizacaoId)
  const ready = hasLocalizacao && capacidades.length > 0 && !loadingContext && !loadingCaps

  const canSubmit = useMemo(() => {
    if (!ready || submitting) return false
    return (
      Boolean(form.data.trim()) &&
      Boolean(form.periodo.trim()) &&
      Boolean(form.capacidadeId.trim())
    )
  }, [ready, submitting, form.data, form.periodo, form.capacidadeId])

  const canDiscard = useMemo(() => {
    return Boolean(
      form.data.trim() ||
        form.periodo.trim() ||
        form.observacoes.trim() ||
        form.capacidadeId.trim(),
    )
  }, [form.data, form.periodo, form.observacoes, form.capacidadeId])

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyForm())
      setSubmitting(false)
      setFormError('')
      setCapsError('')
      return
    }

    let cancelled = false
    setLoadingContext(true)
    setLoadingCaps(true)
    setFormError('')
    setCapsError('')

    Promise.all([
      fetchStrapiCapacidades().catch((err) => {
        if (!cancelled) {
          setCapsError(
            err instanceof Error ? err.message : 'Não foi possível carregar as capacidades.',
          )
        }
        return []
      }),
      getStrapiCurrentUserId().then(async (id) => {
        if (!id) return null
        return fetchStrapiClienteDetail(String(id))
      }),
    ])
      .then(([caps, detail]) => {
        if (cancelled) return
        setCapacidades(caps)
        if (caps.length > 0) {
          setForm(emptyForm(caps[0].id))
        } else {
          setForm(emptyForm())
        }

        const locs = detail?.localizacoes ?? []
        const first = locs[0]
        if (first?.strapiId) {
          setLocalizacaoId(String(first.strapiId))
          setLocalizacaoLabel(first.nome || first.morada || '')
        } else {
          setLocalizacaoId('')
          setLocalizacaoLabel('')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingContext(false)
          setLoadingCaps(false)
        }
      })

    return () => {
      cancelled = true
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
    setForm(emptyForm(capacidades[0]?.id ?? ''))
    setFormError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    setFormError('')
    setSubmitting(true)
    try {
      const selectedCap = capacidades.find((cap) => cap.id === form.capacidadeId.trim())
      await onSubmit?.({
        localizacaoId,
        localizacao: localizacaoLabel,
        data: form.data.trim(),
        periodo: form.periodo.trim(),
        observacoes: form.observacoes.trim(),
        capacidadeId: form.capacidadeId.trim(),
        capacidadeLabel: selectedCap?.label ?? '',
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível solicitar o contentor.')
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
        aria-labelledby="solicitar-contentor-title"
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
              <h2 id="solicitar-contentor-title" className="solicitar-recolha__title">
                Solicitar Novo Contentor
              </h2>

              {formError ? (
                <p className="solicitar-recolha__alert" role="alert">
                  {formError}
                </p>
              ) : null}

              {capsError ? (
                <p className="solicitar-recolha__alert" role="alert">
                  {capsError}
                </p>
              ) : null}

              {!loadingContext && !hasLocalizacao ? (
                <p className="solicitar-recolha__alert" role="alert">
                  Não foi possível identificar a localização do cliente.
                </p>
              ) : null}

              <div className="solicitar-recolha__illustration" aria-hidden>
                <IconContentor className="solicitar-recolha__illustration-icon" />
              </div>

              <div className="solicitar-recolha__fields">
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
                    disabled={!ready}
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
                      disabled={!ready}
                      required
                      tabIndex={isOpen ? 0 : -1}
                      aria-label="Preferência de horário"
                    >
                      <option value="" disabled>
                        Preferência de horário*
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
                    disabled={!ready}
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
                      className={`solicitar-recolha__select${form.capacidadeId ? '' : ' solicitar-recolha__select--empty'}`}
                      value={form.capacidadeId}
                      onChange={(e) => updateField('capacidadeId', e.target.value)}
                      disabled={!ready || loadingCaps || capacidades.length === 0}
                      required
                      tabIndex={isOpen ? 0 : -1}
                      aria-label="Capacidade"
                    >
                      <option value="" disabled>
                        Capacidade*
                      </option>
                      {capacidades.map((cap) => (
                        <option key={cap.id} value={cap.id}>
                          {cap.label}
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
