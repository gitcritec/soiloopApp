import { faBarcodeRead, faPaperclip, faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { fetchStrapiContentorByCid } from '../../../../lib/strapiContentores.js'
import { parseContentorQr } from '../../../../lib/parseContentorQr.js'
import './MovimentosEntrega.css'

/**
 * Formulário de entrega (Figma SOLO-URBANO-App_v3, nó 25:1864).
 */
export default function MovimentosEntrega({
  isOpen,
  contentorId = '',
  contentorIdLocked = false,
  contentorIdAutoValidateKey = 0,
  observacoes = '',
  qrError = null,
  onDismissQrError,
  onProcessarEntrada,
  onContentorIdChange,
  onObservacoesChange,
  onClose,
  onSubmit,
}) {
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  /** @type {[{ id: string, file: File, previewUrl: string, name: string }]} */
  const [photos, setPhotos] = useState([])
  const [validatingId, setValidatingId] = useState(false)
  const [idValidated, setIdValidated] = useState(false)
  const [idValidationError, setIdValidationError] = useState('')
  const photoInputRef = useRef(null)
  const lastAutoValidateKeyRef = useRef(0)

  const cid = contentorId?.trim() ?? ''

  const canSubmit = useMemo(() => {
    if (submitting || validatingId) return false
    if (!cid) return false
    return idValidated && !idValidationError
  }, [submitting, validatingId, cid, idValidated, idValidationError])

  const validateContentorId = useCallback(async (code) => {
    const trimmed = code?.trim() ?? ''
    if (!trimmed) {
      setIdValidated(false)
      setIdValidationError('')
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
      const item = await fetchStrapiContentorByCid(parsed.contentorId)
      if (!item) {
        setIdValidated(false)
        setIdValidationError('Contentor não encontrado. Verifique o ID.')
        return
      }
      setIdValidated(true)
      if (parsed.contentorId !== trimmed) {
        onContentorIdChange?.(parsed.contentorId, { keepQrLock: contentorIdLocked })
      }
    } catch {
      setIdValidated(false)
      setIdValidationError('Não foi possível validar o ID. Tente novamente.')
    } finally {
      setValidatingId(false)
    }
  }, [onContentorIdChange, contentorIdLocked])

  useEffect(() => {
    if (!isOpen) {
      setSubmitting(false)
      setFormError('')
      setValidatingId(false)
      setIdValidated(false)
      setIdValidationError('')
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
  }

  async function handleContentorIdBlur() {
    await validateContentorId(contentorId)
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
        modo: 'entregar',
        contentorId: cid,
        observacoes: observacoes?.trim() ?? '',
        fotografias: photos.map((photo) => photo.file),
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível registar a entrega.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className={`entrega-form-screen${isOpen ? ' entrega-form-screen--open' : ''}`}
      aria-hidden={!isOpen}
    >
      <div className="entrega-form-screen__backdrop" aria-hidden="true" onClick={onClose} />

      <div
        className="entrega-form-screen__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entrega-form-title"
        aria-hidden={!isOpen}
      >
        <form className="entrega-form-screen__form" onSubmit={handleSubmit} noValidate>
          <div className="entrega-form-screen__card">
            <div className="entrega-form-screen__toolbar">
              <button
                type="button"
                className="entrega-form-screen__close"
                aria-label="Fechar"
                tabIndex={isOpen ? 0 : -1}
                onClick={onClose}
              >
                <FontAwesomeIcon icon={faXmark} aria-hidden />
              </button>
            </div>

            <div className="entrega-form-screen__scroll">
              <button
                type="button"
                id="entrega-form-title"
                className="entrega-form-screen__processar"
                tabIndex={isOpen ? 0 : -1}
                onClick={onProcessarEntrada}
              >
                <FontAwesomeIcon icon={faBarcodeRead} className="entrega-form-screen__processar-icon" aria-hidden />
                Processar Entrada
              </button>

              <hr className="entrega-form-screen__divider" aria-hidden="true" />

              {qrError ? (
                <p className="entrega-form-screen__alert" role="alert">
                  {qrError}
                  {onDismissQrError ? (
                    <button
                      type="button"
                      className="entrega-form-screen__alert-dismiss"
                      onClick={onDismissQrError}
                    >
                      Fechar
                    </button>
                  ) : null}
                </p>
              ) : null}

              {formError ? (
                <p className="entrega-form-screen__alert" role="alert">
                  {formError}
                </p>
              ) : null}

              <label className="entrega-form-screen__field">
                <span className="entrega-form-screen__label">ID*</span>
                <input
                  type="text"
                  className={`entrega-form-screen__input${
                    contentorIdLocked ? ' entrega-form-screen__input--locked' : ''
                  }${idValidationError ? ' entrega-form-screen__input--invalid' : ''}`}
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
                {validatingId ? (
                  <span className="entrega-form-screen__field-hint" role="status">
                    A validar ID…
                  </span>
                ) : null}
                {idValidationError ? (
                  <span className="entrega-form-screen__field-error" role="alert">
                    {idValidationError}
                  </span>
                ) : null}
                {idValidated && cid ? (
                  <span className="entrega-form-screen__field-ok" role="status">
                    Contentor confirmado.
                  </span>
                ) : null}
              </label>

              <label className="entrega-form-screen__field">
                <span className="entrega-form-screen__label">Observações</span>
                <input
                  type="text"
                  className="entrega-form-screen__input"
                  name="observacoes"
                  value={observacoes}
                  onChange={(e) => onObservacoesChange?.(e.target.value)}
                  tabIndex={isOpen ? 0 : -1}
                />
              </label>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="entrega-form-screen__file-input"
                tabIndex={-1}
                aria-hidden="true"
                onChange={handlePhotoSelected}
              />

              <button
                type="button"
                className="entrega-form-screen__photos"
                disabled={!cid || !idValidated}
                tabIndex={isOpen ? 0 : -1}
                onClick={openPhotoCapture}
              >
                <FontAwesomeIcon icon={faPaperclip} className="entrega-form-screen__photos-icon" aria-hidden />
                Fotografias
                {photos.length > 0 ? ` (${photos.length})` : ''}
              </button>

              {photos.length > 0 ? (
                <ul className="entrega-form-screen__photo-list" aria-label="Fotografias anexadas">
                  {photos.map((photo) => (
                    <li key={photo.id} className="entrega-form-screen__photo-item">
                      <img
                        src={photo.previewUrl}
                        alt={photo.name}
                        className="entrega-form-screen__photo-thumb"
                      />
                      <button
                        type="button"
                        className="entrega-form-screen__photo-remove"
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

            <div className="entrega-form-screen__actions">
              <button
                type="submit"
                className="entrega-form-screen__submit"
                disabled={!canSubmit}
                tabIndex={isOpen ? 0 : -1}
              >
                {submitting ? 'A registar…' : 'Confirmar Registo'}
              </button>
              <button
                type="button"
                className="entrega-form-screen__discard"
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
