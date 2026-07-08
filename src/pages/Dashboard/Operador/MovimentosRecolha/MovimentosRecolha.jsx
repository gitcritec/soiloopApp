import { faBarcodeRead, faChevronDown, faPaperclip, faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  fetchStrapiContentorByCid,
} from '../../../../lib/strapiContentores.js'
import { parseContentorQr } from '../../../../lib/parseContentorQr.js'
import { resolveStrapiOperadorRecolhaMovimentoKey } from '../../../../lib/strapiMovimentos.js'
import './MovimentosRecolha.css'

const RECOLHA_ESTADOS = ['Usado', 'Danificado']

function resolveRecolhaEstadoInicial(contentorEstadoLabel) {
  const normalized = (contentorEstadoLabel ?? '').trim().toLowerCase()
  if (normalized === 'danificado') return 'Danificado'
  return 'Usado'
}

function emptyForm(estado = RECOLHA_ESTADOS[0]) {
  return {
    estado,
    peso: '',
    numeroEgar: '',
    observacoes: '',
  }
}

/**
 * Formulário de recolha do operador (Figma SOLO-URBANO-App_v3, nó 228:8816).
 */
export default function MovimentosRecolha({
  isOpen,
  mode = 'recolher',
  contentorId = '',
  contentorIdLocked = false,
  contentorIdAutoValidateKey = 0,
  movimentoKey = '',
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
  /** @type {[{ id: string, file: File, previewUrl: string, name: string }]} */
  const [photos, setPhotos] = useState([])
  const photoInputRef = useRef(null)
  const lastAutoValidateKeyRef = useRef(0)

  const cid = contentorId?.trim() ?? ''

  const canSubmit = useMemo(() => {
    if (submitting || validatingId || loadingContext) return false
    if (!cid || !idValidated || idValidationError) return false
    return Boolean(form.estado?.trim()) && Boolean(form.peso.trim())
  }, [submitting, validatingId, loadingContext, cid, idValidated, idValidationError, form.estado, form.peso])

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
        ...emptyForm(resolveRecolhaEstadoInicial(contentor.estadoLabel)),
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
      setForm(emptyForm())
      setPhotos((current) => {
        current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
        return []
      })
      if (photoInputRef.current) photoInputRef.current.value = ''
      lastAutoValidateKeyRef.current = 0
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
        estado: form.estado.trim(),
        peso: form.peso.trim(),
        numeroEgar: form.numeroEgar.trim(),
        observacoes: form.observacoes.trim(),
        fotografias: photos.map((photo) => photo.file),
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
            <button
              type="button"
              className="recolha-form-screen__close"
              aria-label="Fechar"
              tabIndex={isOpen ? 0 : -1}
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faXmark} aria-hidden />
            </button>

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

              <label className="recolha-form-screen__field">
                <span className="recolha-form-screen__label">Estado*</span>
                <span className="recolha-form-screen__select-wrap">
                  <select
                    className="recolha-form-screen__select"
                    value={form.estado}
                    onChange={(e) => updateField('estado', e.target.value)}
                    disabled={!idValidated || loadingContext}
                    required
                    tabIndex={isOpen ? 0 : -1}
                    aria-label="Estado"
                  >
                    {RECOLHA_ESTADOS.map((estado) => (
                      <option key={estado} value={estado}>
                        {estado}
                      </option>
                    ))}
                  </select>
                  <FontAwesomeIcon icon={faChevronDown} className="recolha-form-screen__select-icon" aria-hidden />
                </span>
              </label>

              <label className="recolha-form-screen__field">
                <span className="recolha-form-screen__label">Peso*</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="recolha-form-screen__input"
                  name="peso"
                  value={form.peso}
                  onChange={(e) => updateField('peso', e.target.value)}
                  disabled={!idValidated || loadingContext}
                  required
                  tabIndex={isOpen ? 0 : -1}
                />
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
                {submitting ? 'A registar…' : 'Confirmar Registo'}
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
