import { faBarcodeRead, faChevronDown, faPaperclip, faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  fetchStrapiContentorByCid,
} from '../../../../lib/strapiContentores.js'
import { fetchStrapiCodigosLer } from '../../../../lib/strapiCodigoLer.js'
import {
  fetchStrapiEstadosFisicos,
  fetchStrapiEstadosPedido,
  fetchStrapiEstadosResiduo,
} from '../../../../lib/strapiEstadosAuxiliares.js'
import { parseContentorQr } from '../../../../lib/parseContentorQr.js'
import { resolveStrapiOperadorRecolhaMovimentoKey } from '../../../../lib/strapiMovimentos.js'
import './MovimentosRecolha.css'

/** Enchimento do contentor: 0% a 100%, de 5 em 5. */
const PESO_PERCENT_OPTIONS = Array.from({ length: 21 }, (_, i) => String(i * 5))

function emptyForm(defaults = {}) {
  return {
    estadoFisicoId: defaults.estadoFisicoId ?? '',
    estadoResiduoId: defaults.estadoResiduoId ?? '',
    estadoPedidoId: defaults.estadoPedidoId ?? '',
    peso: '',
    numeroEgar: '',
    codigoLerIds: [],
    observacoes: '',
  }
}

/**
 * Formulário de recolha do operador (Figma SOLO-URBANO-App_v3, nó 228:8816).
 * @param {object} props
 * @param {Array<{ movimentoKey: string, contentorId: string, locationDetail?: string, clienteLabel?: string }>} [props.siblingCandidates]
 */
export default function MovimentosRecolha({
  isOpen,
  mode = 'recolher',
  contentorId = '',
  contentorIdLocked = false,
  contentorIdAutoValidateKey = 0,
  movimentoKey = '',
  siblingCandidates = [],
  qrError = null,
  onDismissQrError,
  onProcessarRecolha,
  onContentorIdChange,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() => emptyForm())
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [validatingId, setValidatingId] = useState(false)
  const [idValidated, setIdValidated] = useState(false)
  const [idValidationError, setIdValidationError] = useState('')
  const [loadingContext, setLoadingContext] = useState(false)
  const [contextError, setContextError] = useState('')
  const [codigosLerOptions, setCodigosLerOptions] = useState([])
  const [codigosLerLoading, setCodigosLerLoading] = useState(false)
  const [codigosLerError, setCodigosLerError] = useState('')
  const [estadosFisicos, setEstadosFisicos] = useState([])
  const [estadosResiduo, setEstadosResiduo] = useState([])
  const [estadosPedido, setEstadosPedido] = useState([])
  const [estadosError, setEstadosError] = useState('')
  const [lerMenuOpen, setLerMenuOpen] = useState(false)
  const [groupedMovimentoKeys, setGroupedMovimentoKeys] = useState([])
  /** @type {[{ id: string, file: File, previewUrl: string, name: string }]} */
  const [photos, setPhotos] = useState([])
  const photoInputRef = useRef(null)
  const lerMenuRef = useRef(null)
  const lastAutoValidateKeyRef = useRef(0)

  const cid = contentorId?.trim() ?? ''

  const siblingOptions = useMemo(() => {
    const currentKey = String(movimentoKey ?? '').trim()
    return (siblingCandidates ?? []).filter((item) => {
      if (!item?.movimentoKey || !item?.contentorId) return false
      if (currentKey && item.movimentoKey === currentKey) return false
      if (cid && item.contentorId === cid) return false
      return true
    })
  }, [siblingCandidates, movimentoKey, cid])

  const canSubmit = useMemo(() => {
    if (submitting || validatingId || loadingContext) return false
    if (!cid || !idValidated || idValidationError) return false
    return (
      Boolean(form.estadoFisicoId) &&
      Boolean(form.estadoResiduoId) &&
      Boolean(form.estadoPedidoId) &&
      Boolean(form.peso.trim())
    )
  }, [
    submitting,
    validatingId,
    loadingContext,
    cid,
    idValidated,
    idValidationError,
    form.estadoFisicoId,
    form.estadoResiduoId,
    form.estadoPedidoId,
    form.peso,
  ])

  const selectedCodigosLer = useMemo(() => {
    const selected = new Set(form.codigoLerIds ?? [])
    return codigosLerOptions.filter((item) => selected.has(item.id))
  }, [codigosLerOptions, form.codigoLerIds])

  const lerSummaryLabel = useMemo(() => {
    if (selectedCodigosLer.length === 0) return 'Selecionar'
    if (selectedCodigosLer.length <= 2) {
      return selectedCodigosLer.map((item) => item.codigo).join(', ')
    }
    return `${selectedCodigosLer.length} selecionados`
  }, [selectedCodigosLer])

  const applyMovimentoContext = useCallback(async (code, explicitMovimentoKey = '') => {
    setLoadingContext(true)
    setContextError('')
    try {
      const contentor = await fetchStrapiContentorByCid(code)
      if (!contentor) {
        setContextError('Contentor não encontrado.')
        return null
      }

      let resolvedKey = pickString(explicitMovimentoKey) ?? ''
      if (!resolvedKey) {
        resolvedKey = await resolveStrapiOperadorRecolhaMovimentoKey({ contentorId: code })
      }
      if (!resolvedKey) {
        setContextError('Movimento de recolha em falta.')
        return null
      }

      setForm((prev) => ({
        ...emptyForm({
          estadoFisicoId: contentor.estadoFisicoId ?? '',
          estadoResiduoId: contentor.estadoResiduoId ?? '',
        }),
        numeroEgar: contentor.numeroEgar ?? '',
        observacoes: prev.observacoes,
      }))

      return contentor
    } catch (err) {
      setContextError(
        err instanceof Error ? err.message : 'Não foi possível carregar os dados do movimento.',
      )
      return null
    } finally {
      setLoadingContext(false)
    }
  }, [])

  const validateContentorId = useCallback(
    async (code) => {
      const trimmed = code?.trim() ?? ''
      if (!trimmed) {
        setIdValidated(false)
        setIdValidationError('')
        setForm(emptyForm())
        return
      }

      const parsed = parseContentorQr(trimmed)
      if (!parsed) {
        setIdValidated(false)
        setIdValidationError('ID inválido. Use o formato do contentor (ex.: CNT-001).')
        return
      }

      setValidatingId(true)
      setIdValidationError('')
      try {
        const contentor = await fetchStrapiContentorByCid(parsed.contentorId)
        if (!contentor) {
          setIdValidated(false)
          setIdValidationError('Contentor não encontrado. Verifique o ID.')
          return
        }

        setIdValidated(true)
        if (parsed.contentorId !== trimmed) {
          onContentorIdChange?.(parsed.contentorId, { keepQrLock: contentorIdLocked })
        }

        await applyMovimentoContext(parsed.contentorId, movimentoKey)
      } catch {
        setIdValidated(false)
        setIdValidationError('Não foi possível validar o ID. Tente novamente.')
      } finally {
        setValidatingId(false)
      }
    },
    [applyMovimentoContext, contentorIdLocked, movimentoKey, onContentorIdChange],
  )

  useEffect(() => {
    if (!isOpen) {
      setSubmitting(false)
      setFormError('')
      setValidatingId(false)
      setIdValidated(false)
      setIdValidationError('')
      setLoadingContext(false)
      setContextError('')
      setCodigosLerError('')
      setLerMenuOpen(false)
      setGroupedMovimentoKeys([])
      setForm(emptyForm())
      setPhotos((current) => {
        current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
        return []
      })
      if (photoInputRef.current) photoInputRef.current.value = ''
      lastAutoValidateKeyRef.current = 0
    }
  }, [isOpen])

  useEffect(() => {
    const valid = new Set(siblingOptions.map((item) => item.movimentoKey))
    setGroupedMovimentoKeys((prev) => prev.filter((key) => valid.has(key)))
  }, [siblingOptions])

  useEffect(() => {
    if (!lerMenuOpen) return undefined
    function onPointerDown(event) {
      if (!lerMenuRef.current?.contains(event.target)) {
        setLerMenuOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [lerMenuOpen])

  useEffect(() => {
    if (!isOpen) return undefined
    let cancelled = false
    setCodigosLerLoading(true)
    setCodigosLerError('')
    setEstadosError('')
    Promise.all([
      fetchStrapiCodigosLer(),
      fetchStrapiEstadosFisicos().catch(() => []),
      fetchStrapiEstadosResiduo().catch(() => []),
      fetchStrapiEstadosPedido().catch(() => []),
    ])
      .then(([lerRows, fisicoRows, residuoRows, pedidoRows]) => {
        if (cancelled) return
        setCodigosLerOptions(lerRows)
        setEstadosFisicos(fisicoRows)
        setEstadosResiduo(residuoRows)
        setEstadosPedido(pedidoRows)
        if (fisicoRows.length === 0 || residuoRows.length === 0 || pedidoRows.length === 0) {
          setEstadosError(
            'Faltam estados auxiliares em Definições (físico, resíduo e pedido).',
          )
        }
      })
      .catch((err) => {
        if (cancelled) return
        setCodigosLerOptions([])
        setCodigosLerError(
          err instanceof Error ? err.message : 'Não foi possível carregar os códigos LER.',
        )
      })
      .finally(() => {
        if (!cancelled) setCodigosLerLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen])

  useLayoutEffect(() => {
    if (!isOpen || !cid || !contentorIdAutoValidateKey) return
    if (lastAutoValidateKeyRef.current === contentorIdAutoValidateKey) return
    lastAutoValidateKeyRef.current = contentorIdAutoValidateKey
    void validateContentorId(cid)
  }, [isOpen, cid, contentorIdAutoValidateKey, validateContentorId])

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

  function handleContentorIdChange(value) {
    onContentorIdChange?.(value)
    setIdValidated(false)
    setIdValidationError('')
    setContextError('')
    setForm(emptyForm())
  }

  async function handleContentorIdBlur() {
    await validateContentorId(contentorId)
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFormError('')
  }

  function toggleCodigoLer(id) {
    const key = String(id)
    setForm((prev) => {
      const selected = prev.codigoLerIds ?? []
      const next = selected.includes(key)
        ? selected.filter((value) => value !== key)
        : [...selected, key]
      return { ...prev, codigoLerIds: next }
    })
    setFormError('')
  }

  function toggleGroupedSibling(movimentoKeyValue) {
    const key = String(movimentoKeyValue)
    setGroupedMovimentoKeys((prev) =>
      prev.includes(key) ? prev.filter((value) => value !== key) : [...prev, key],
    )
    setFormError('')
  }

  function selectAllGroupedSiblings() {
    setGroupedMovimentoKeys(siblingOptions.map((item) => item.movimentoKey))
    setFormError('')
  }

  function clearGroupedSiblings() {
    setGroupedMovimentoKeys([])
    setFormError('')
  }

  function openPhotoCapture() {
    photoInputRef.current?.click()
  }

  function handlePhotoSelected(event) {
    const file = event.target.files?.[0] ?? null
    if (photoInputRef.current) photoInputRef.current.value = ''
    if (!file || !file.type.startsWith('image/')) return

    const previewUrl = URL.createObjectURL(file)
    setPhotos((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${file.name}`,
        file,
        previewUrl,
        name: file.name,
      },
    ])
  }

  function removePhoto(photoId) {
    setPhotos((prev) => {
      const target = prev.find((photo) => photo.id === photoId)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((photo) => photo.id !== photoId)
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    setFormError('')
    setSubmitting(true)
    try {
      await onSubmit?.({
        modo: mode,
        contentorId: cid,
        movimentoKey,
        estadoFisicoId: form.estadoFisicoId,
        estadoResiduoId: form.estadoResiduoId,
        estadoPedidoId: form.estadoPedidoId,
        peso: form.peso.trim(),
        numeroEgar: form.numeroEgar.trim(),
        codigoLerIds: form.codigoLerIds ?? [],
        codigoLerLabels: (form.codigoLerIds ?? [])
          .map((id) => codigosLerOptions.find((item) => item.id === id)?.label ?? id)
          .filter(Boolean),
        observacoes: form.observacoes.trim(),
        fotografias: photos.map((photo) => photo.file),
        extraItems: siblingOptions
          .filter((item) => groupedMovimentoKeys.includes(item.movimentoKey))
          .map((item) => ({
            movimentoKey: item.movimentoKey,
            contentorId: item.contentorId,
          })),
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível registar a recolha.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={`recolha-form-screen${isOpen ? ' recolha-form-screen--open' : ''}`}
      aria-hidden={!isOpen}
    >
      <div className="recolha-form-screen__backdrop" aria-hidden="true" onClick={onClose} />

      <div
        className="recolha-form-screen__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recolha-form-title"
        aria-hidden={!isOpen}
      >
        <form className="recolha-form-screen__form" onSubmit={handleSubmit} noValidate>
          <div className="recolha-form-screen__card">
            <div className="recolha-form-screen__toolbar">
              <button
                type="button"
                className="recolha-form-screen__close"
                aria-label="Fechar"
                tabIndex={isOpen ? 0 : -1}
                onClick={onClose}
              >
                <FontAwesomeIcon icon={faXmark} aria-hidden />
              </button>
            </div>

            <div className="recolha-form-screen__scroll">
              <button
                type="button"
                id="recolha-form-title"
                className="recolha-form-screen__processar"
                tabIndex={isOpen ? 0 : -1}
                onClick={onProcessarRecolha}
              >
                <FontAwesomeIcon icon={faBarcodeRead} className="recolha-form-screen__processar-icon" aria-hidden />
                Processar Recolha
              </button>

              <hr className="recolha-form-screen__divider" aria-hidden="true" />

              {qrError ? (
                <p className="recolha-form-screen__alert" role="alert">
                  {qrError}
                  {onDismissQrError ? (
                    <button
                      type="button"
                      className="recolha-form-screen__alert-dismiss"
                      onClick={onDismissQrError}
                    >
                      Fechar
                    </button>
                  ) : null}
                </p>
              ) : null}

              {formError ? (
                <p className="recolha-form-screen__alert" role="alert">
                  {formError}
                </p>
              ) : null}

              {contextError ? (
                <p className="recolha-form-screen__alert" role="alert">
                  {contextError}
                </p>
              ) : null}

              <label className="recolha-form-screen__field">
                <span className="recolha-form-screen__label">ID*</span>
                <input
                  type="text"
                  className={`recolha-form-screen__input${
                    contentorIdLocked ? ' recolha-form-screen__input--locked' : ''
                  }${idValidationError ? ' recolha-form-screen__input--invalid' : ''}`}
                  name="contentorId"
                  value={contentorId}
                  onChange={(e) => handleContentorIdChange(e.target.value)}
                  onBlur={handleContentorIdBlur}
                  placeholder={
                    contentorIdLocked
                      ? 'ID preenchido pelo QR'
                      : 'Leia o QR ou escreva o ID manualmente'
                  }
                  autoComplete="off"
                  spellCheck={false}
                  readOnly={contentorIdLocked}
                  aria-readonly={contentorIdLocked}
                  required
                  tabIndex={isOpen && !contentorIdLocked ? 0 : -1}
                />
                {validatingId || loadingContext ? (
                  <span className="recolha-form-screen__field-hint" role="status">
                    {validatingId ? 'A validar ID…' : 'A carregar dados…'}
                  </span>
                ) : null}
                {idValidationError ? (
                  <span className="recolha-form-screen__field-error" role="alert">
                    {idValidationError}
                  </span>
                ) : null}
                {idValidated && cid ? (
                  <span className="recolha-form-screen__field-ok" role="status">
                    Contentor confirmado.
                  </span>
                ) : null}
              </label>

              {idValidated && siblingOptions.length > 0 ? (
                <div className="recolha-form-screen__group">
                  <div className="recolha-form-screen__group-head">
                    <p className="recolha-form-screen__label">Agrupar recolhas da empresa</p>
                    <div className="recolha-form-screen__group-actions">
                      <button
                        type="button"
                        className="recolha-form-screen__group-link"
                        disabled={!idValidated || loadingContext || submitting}
                        tabIndex={isOpen ? 0 : -1}
                        onClick={selectAllGroupedSiblings}
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        className="recolha-form-screen__group-link"
                        disabled={
                          !idValidated ||
                          loadingContext ||
                          submitting ||
                          groupedMovimentoKeys.length === 0
                        }
                        tabIndex={isOpen ? 0 : -1}
                        onClick={clearGroupedSiblings}
                      >
                        Limpar
                      </button>
                    </div>
                  </div>
                  <p className="recolha-form-screen__field-hint">
                    Há mais contentores para recolher nesta empresa. Seleciona os que queres
                    registar com os mesmos dados.
                  </p>
                  <ul className="recolha-form-screen__group-list">
                    {siblingOptions.map((item) => {
                      const selected = groupedMovimentoKeys.includes(item.movimentoKey)
                      return (
                        <li key={item.movimentoKey}>
                          <button
                            type="button"
                            className={`recolha-form-screen__group-item${selected ? ' recolha-form-screen__group-item--selected' : ''}`}
                            aria-pressed={selected}
                            disabled={!idValidated || loadingContext || submitting}
                            tabIndex={isOpen ? 0 : -1}
                            onClick={() => toggleGroupedSibling(item.movimentoKey)}
                          >
                            <span className="recolha-form-screen__group-check" aria-hidden>
                              {selected ? '✓' : ''}
                            </span>
                            <span className="recolha-form-screen__group-main">
                              <span className="recolha-form-screen__group-cid">{item.contentorId}</span>
                              {item.locationDetail ? (
                                <span className="recolha-form-screen__group-loc">{item.locationDetail}</span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  {groupedMovimentoKeys.length > 0 ? (
                    <p className="recolha-form-screen__field-ok" role="status">
                      +{groupedMovimentoKeys.length} contentor
                      {groupedMovimentoKeys.length === 1 ? '' : 'es'} no mesmo registo
                    </p>
                  ) : null}
                </div>
              ) : null}

              {estadosError ? (
                <p className="recolha-form-screen__field-error" role="alert">
                  {estadosError}
                </p>
              ) : null}

              <label className="recolha-form-screen__field">
                <span className="recolha-form-screen__label">Estado físico*</span>
                <span className="recolha-form-screen__select-wrap">
                  <select
                    className={`recolha-form-screen__select${form.estadoFisicoId ? '' : ' recolha-form-screen__select--empty'}`}
                    value={form.estadoFisicoId}
                    onChange={(e) => updateField('estadoFisicoId', e.target.value)}
                    disabled={!idValidated || loadingContext}
                    required
                    tabIndex={isOpen ? 0 : -1}
                    aria-label="Estado físico"
                  >
                    <option value="" disabled>
                      Selecionar
                    </option>
                    {estadosFisicos.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                  <FontAwesomeIcon icon={faChevronDown} className="recolha-form-screen__select-icon" aria-hidden />
                </span>
              </label>

              <label className="recolha-form-screen__field">
                <span className="recolha-form-screen__label">Estado do resíduo*</span>
                <span className="recolha-form-screen__select-wrap">
                  <select
                    className={`recolha-form-screen__select${form.estadoResiduoId ? '' : ' recolha-form-screen__select--empty'}`}
                    value={form.estadoResiduoId}
                    onChange={(e) => updateField('estadoResiduoId', e.target.value)}
                    disabled={!idValidated || loadingContext}
                    required
                    tabIndex={isOpen ? 0 : -1}
                    aria-label="Estado do resíduo"
                  >
                    <option value="" disabled>
                      Selecionar
                    </option>
                    {estadosResiduo.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                  <FontAwesomeIcon icon={faChevronDown} className="recolha-form-screen__select-icon" aria-hidden />
                </span>
              </label>

              <label className="recolha-form-screen__field">
                <span className="recolha-form-screen__label">Estado pedido*</span>
                <span className="recolha-form-screen__select-wrap">
                  <select
                    className={`recolha-form-screen__select${form.estadoPedidoId ? '' : ' recolha-form-screen__select--empty'}`}
                    value={form.estadoPedidoId}
                    onChange={(e) => updateField('estadoPedidoId', e.target.value)}
                    disabled={!idValidated || loadingContext}
                    required
                    tabIndex={isOpen ? 0 : -1}
                    aria-label="Estado pedido"
                  >
                    <option value="" disabled>
                      Selecionar
                    </option>
                    {estadosPedido.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                  <FontAwesomeIcon icon={faChevronDown} className="recolha-form-screen__select-icon" aria-hidden />
                </span>
              </label>

              <label className="recolha-form-screen__field">
                <span className="recolha-form-screen__label">Peso (%)*</span>
                <span className="recolha-form-screen__select-wrap">
                  <select
                    className={`recolha-form-screen__select${form.peso ? '' : ' recolha-form-screen__select--empty'}`}
                    name="peso"
                    value={form.peso}
                    onChange={(e) => updateField('peso', e.target.value)}
                    disabled={!idValidated || loadingContext}
                    required
                    tabIndex={isOpen ? 0 : -1}
                    aria-label="Peso em percentagem"
                  >
                    <option value="" disabled>
                      Selecionar
                    </option>
                    {PESO_PERCENT_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}%
                      </option>
                    ))}
                  </select>
                  <FontAwesomeIcon icon={faChevronDown} className="recolha-form-screen__select-icon" aria-hidden />
                </span>
              </label>

              <label className="recolha-form-screen__field">
                <span className="recolha-form-screen__label">Número EGAR</span>
                <input
                  type="text"
                  className="recolha-form-screen__input"
                  name="numeroEgar"
                  value={form.numeroEgar}
                  onChange={(e) => updateField('numeroEgar', e.target.value)}
                  disabled={!idValidated || loadingContext}
                  tabIndex={isOpen ? 0 : -1}
                />
              </label>

              <div className="recolha-form-screen__field recolha-form-screen__field--ler">
                <span className="recolha-form-screen__label">Códigos LER</span>
                {codigosLerLoading ? (
                  <p className="recolha-form-screen__field-hint" role="status">
                    A carregar códigos LER…
                  </p>
                ) : null}
                {!codigosLerLoading && codigosLerError ? (
                  <p className="recolha-form-screen__field-error" role="alert">
                    {codigosLerError}
                  </p>
                ) : null}
                {!codigosLerLoading && !codigosLerError && codigosLerOptions.length === 0 ? (
                  <p className="recolha-form-screen__field-hint">
                    Sem códigos LER. O admin pode adicioná-los em Definições.
                  </p>
                ) : null}
                {!codigosLerLoading && codigosLerOptions.length > 0 ? (
                  <div className="recolha-form-screen__ler-select" ref={lerMenuRef}>
                    <button
                      type="button"
                      className={`recolha-form-screen__ler-trigger${selectedCodigosLer.length === 0 ? ' recolha-form-screen__ler-trigger--empty' : ''}`}
                      aria-haspopup="listbox"
                      aria-expanded={lerMenuOpen}
                      aria-label="Códigos LER"
                      disabled={!idValidated || loadingContext}
                      tabIndex={isOpen ? 0 : -1}
                      onClick={() => setLerMenuOpen((open) => !open)}
                    >
                      <span className="recolha-form-screen__ler-trigger-text">{lerSummaryLabel}</span>
                      <FontAwesomeIcon icon={faChevronDown} className="recolha-form-screen__select-icon" aria-hidden />
                    </button>
                    {lerMenuOpen ? (
                      <ul className="recolha-form-screen__ler-menu" role="listbox" aria-multiselectable="true">
                        {codigosLerOptions.map((item) => {
                          const selected = (form.codigoLerIds ?? []).includes(item.id)
                          return (
                            <li key={item.id} role="option" aria-selected={selected}>
                              <button
                                type="button"
                                className={`recolha-form-screen__ler-option${selected ? ' recolha-form-screen__ler-option--selected' : ''}`}
                                onClick={() => toggleCodigoLer(item.id)}
                              >
                                <span className="recolha-form-screen__ler-option-check" aria-hidden>
                                  {selected ? '✓' : ''}
                                </span>
                                <span className="recolha-form-screen__ler-option-main">
                                  <span className="recolha-form-screen__ler-option-code">{item.codigo}</span>
                                  {item.descricao ? (
                                    <span className="recolha-form-screen__ler-option-desc">{item.descricao}</span>
                                  ) : null}
                                </span>
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <label className="recolha-form-screen__field">
                <span className="recolha-form-screen__label">Observações</span>
                <input
                  type="text"
                  className="recolha-form-screen__input"
                  name="observacoes"
                  value={form.observacoes}
                  onChange={(e) => updateField('observacoes', e.target.value)}
                  disabled={!idValidated || loadingContext}
                  tabIndex={isOpen ? 0 : -1}
                />
              </label>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="recolha-form-screen__file-input"
                tabIndex={-1}
                aria-hidden="true"
                onChange={handlePhotoSelected}
              />

              <button
                type="button"
                className="recolha-form-screen__photos"
                disabled={!idValidated || loadingContext}
                tabIndex={isOpen ? 0 : -1}
                onClick={openPhotoCapture}
              >
                <FontAwesomeIcon icon={faPaperclip} className="recolha-form-screen__photos-icon" aria-hidden />
                Fotografias
                {photos.length > 0 ? ` (${photos.length})` : ''}
              </button>

              {photos.length > 0 ? (
                <ul className="recolha-form-screen__photo-list" aria-label="Fotografias anexadas">
                  {photos.map((photo) => (
                    <li key={photo.id} className="recolha-form-screen__photo-item">
                      <img
                        src={photo.previewUrl}
                        alt={photo.name}
                        className="recolha-form-screen__photo-thumb"
                      />
                      <button
                        type="button"
                        className="recolha-form-screen__photo-remove"
                        aria-label={`Remover ${photo.name}`}
                        onClick={() => removePhoto(photo.id)}
                      >
                        <FontAwesomeIcon icon={faXmark} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="recolha-form-screen__actions">
              <button
                type="submit"
                className="recolha-form-screen__submit"
                disabled={!canSubmit}
                tabIndex={isOpen ? 0 : -1}
              >
                {submitting
                  ? 'A registar…'
                  : groupedMovimentoKeys.length > 0
                    ? `Confirmar ${groupedMovimentoKeys.length + 1} recolhas`
                    : 'Confirmar Registo'}
              </button>
              <button
                type="button"
                className="recolha-form-screen__discard"
                disabled={submitting}
                tabIndex={isOpen ? 0 : -1}
                onClick={onClose}
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

function pickString(value) {
  if (value == null) return null
  const s = String(value).trim()
  return s || null
}
