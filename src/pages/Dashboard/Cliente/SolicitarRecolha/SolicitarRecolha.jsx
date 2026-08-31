import { faChevronDown, faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useMemo, useRef, useState } from 'react'
import './SolicitarRecolha.css'
import { MOVIMENTO_PERIODO_OPTIONS } from '../../../../lib/movimentoPeriodo.js'

const PERIODOS = MOVIMENTO_PERIODO_OPTIONS
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

function contentorKey(item) {
  return String(item?.id ?? item?.contentorId ?? '').trim()
}

function isContentorDisponivelParaRecolha(item) {
  if (!item || !contentorKey(item)) return false
  if (item.canRequestPickup === false) return false
  if (item.emRecolha === true) return false
  return true
}

/**
 * Formulário cliente — solicitar nova recolha (Figma SOLO-URBANO-App_v3, nó 166:4503).
 * Permite selecionar vários contentores no mesmo pedido.
 */
export default function SolicitarRecolha({
  isOpen,
  containerItem = null,
  availableContainers = [],
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() => emptyForm())
  const [selectedIds, setSelectedIds] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const dateInputRef = useRef(null)

  const selectableContainers = useMemo(() => {
    const byId = new Map()
    for (const item of availableContainers ?? []) {
      if (!isContentorDisponivelParaRecolha(item)) continue
      const key = contentorKey(item)
      if (key) byId.set(key, item)
    }
    const initialKey = contentorKey(containerItem)
    if (initialKey && containerItem && !byId.has(initialKey) && isContentorDisponivelParaRecolha(containerItem)) {
      byId.set(initialKey, containerItem)
    }
    return [...byId.values()]
  }, [availableContainers, containerItem])

  const selectedContainers = useMemo(
    () => selectableContainers.filter((item) => selectedIds.includes(contentorKey(item))),
    [selectableContainers, selectedIds],
  )

  const hasSelection = selectedContainers.length > 0
  const allSelected =
    selectableContainers.length > 0 && selectedIds.length === selectableContainers.length

  const canSubmit = useMemo(() => {
    if (!hasSelection || submitting) return false
    return Boolean(form.data.trim()) && Boolean(form.periodo.trim()) && Boolean(form.trocarContentor.trim())
  }, [hasSelection, submitting, form.data, form.periodo, form.trocarContentor])

  const canDiscard = useMemo(() => {
    return Boolean(
      form.data.trim() ||
        form.periodo.trim() ||
        form.observacoes.trim() ||
        form.trocarContentor.trim() ||
        selectedIds.length > 1 ||
        (selectedIds.length === 1 && selectedIds[0] !== contentorKey(containerItem)),
    )
  }, [form.data, form.periodo, form.observacoes, form.trocarContentor, selectedIds, containerItem])

  useEffect(() => {
    if (!isOpen) {
      setForm(emptyForm())
      setSelectedIds([])
      setSubmitting(false)
      setFormError('')
      return
    }
    setForm(emptyForm())
    setFormError('')
    const initialKey = contentorKey(containerItem)
    setSelectedIds(initialKey ? [initialKey] : [])
  }, [isOpen, containerItem])

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

  function toggleContentor(id) {
    const key = String(id ?? '').trim()
    if (!key) return
    setSelectedIds((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]))
    setFormError('')
  }

  function selectAllContentores() {
    setSelectedIds(selectableContainers.map((item) => contentorKey(item)).filter(Boolean))
    setFormError('')
  }

  function clearContentores() {
    setSelectedIds([])
    setFormError('')
  }

  function handleDiscard() {
    setForm(emptyForm())
    const initialKey = contentorKey(containerItem)
    setSelectedIds(initialKey ? [initialKey] : [])
    setFormError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    setFormError('')
    setSubmitting(true)
    try {
      await onSubmit?.({
        contentorIds: selectedIds,
        contentorId: selectedIds[0] ?? '',
        localizacaoId:
          selectedContainers.length === 1 ? selectedContainers[0]?.localizacaoId ?? '' : '',
        localizacao:
          selectedContainers.length === 1
            ? formatLocalizacao(selectedContainers[0])
            : `${selectedContainers.length} contentores`,
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
                <div className="solicitar-recolha__group">
                  <div className="solicitar-recolha__group-head">
                    <span className="solicitar-recolha__group-label">Contentores*</span>
                    {selectableContainers.length > 1 ? (
                      <div className="solicitar-recolha__group-actions">
                        <button
                          type="button"
                          className="solicitar-recolha__group-link"
                          tabIndex={isOpen ? 0 : -1}
                          disabled={allSelected || submitting}
                          onClick={selectAllContentores}
                        >
                          Todos
                        </button>
                        <button
                          type="button"
                          className="solicitar-recolha__group-link"
                          tabIndex={isOpen ? 0 : -1}
                          disabled={selectedIds.length === 0 || submitting}
                          onClick={clearContentores}
                        >
                          Limpar
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {selectableContainers.length === 0 ? (
                    <p className="solicitar-recolha__group-empty">
                      Não há contentores disponíveis para recolha.
                    </p>
                  ) : (
                    <ul className="solicitar-recolha__group-list">
                      {selectableContainers.map((item) => {
                        const id = contentorKey(item)
                        const selected = selectedIds.includes(id)
                        const loc = formatLocalizacao(item)
                        return (
                          <li key={id}>
                            <button
                              type="button"
                              className={`solicitar-recolha__group-item${selected ? ' solicitar-recolha__group-item--selected' : ''}`}
                              tabIndex={isOpen ? 0 : -1}
                              disabled={submitting}
                              aria-pressed={selected}
                              onClick={() => toggleContentor(id)}
                            >
                              <span className="solicitar-recolha__group-check" aria-hidden>
                                {selected ? '✓' : ''}
                              </span>
                              <span className="solicitar-recolha__group-main">
                                <span className="solicitar-recolha__group-cid">{id}</span>
                                {loc ? (
                                  <span className="solicitar-recolha__group-loc">{loc}</span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  {selectedIds.length > 0 ? (
                    <p className="solicitar-recolha__group-status" role="status">
                      {selectedIds.length} contentor{selectedIds.length === 1 ? '' : 'es'} selecionado
                      {selectedIds.length === 1 ? '' : 's'}
                    </p>
                  ) : null}
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
                    disabled={!hasSelection}
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
                      disabled={!hasSelection}
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
                    disabled={!hasSelection}
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
                      disabled={!hasSelection}
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
                {submitting
                  ? 'A registar…'
                  : selectedIds.length > 1
                    ? `Confirmar (${selectedIds.length})`
                    : 'Confirmar Registo'}
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
