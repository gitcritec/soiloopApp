import { faChevronDown, faPaperclip, faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useMemo, useState } from 'react'
import iconCardTrash from '../../../../assets/figma-cliente/icon-card-trash.png'
import {
  CONTENTOR_ESTADOS,
  fetchStrapiContentorByCid,
} from '../../../../lib/strapiContentores.js'
import './MovimentosRecolha.css'

/** Rótulo QR alinhado ao design (CNT-001 → QR001). */
function formatQrLabel(cid) {
  const code = String(cid ?? '').trim()
  const match = code.match(/^CNT-0*(\d+)$/i)
  if (match) return `QR${match[1].padStart(3, '0')}`
  return code || '—'
}

function emptyForm(estado = CONTENTOR_ESTADOS[0]) {
  return {
    estado,
    peso: '',
    numeroEgar: '',
    observacoes: '',
  }
}

/**
 * Formulário de movimento/recolha após leitura QR (Figma SOLO-URBANO-App_v3, nó 52:4377).
 */
export default function MovimentosRecolha({
  isOpen,
  mode = 'recolher',
  contentorId = '',
  onClose,
  onSubmit,
}) {
  const [contentor, setContentor] = useState(null)
  const [loadingContentor, setLoadingContentor] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState(() => emptyForm())
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const cid = contentorId?.trim() ?? ''
  const hasContentor = Boolean(cid)

  const canSubmit = useMemo(() => {
    if (!hasContentor || submitting) return false
    return Boolean(form.estado?.trim()) && Boolean(form.peso.trim())
  }, [hasContentor, submitting, form.estado, form.peso])

  useEffect(() => {
    if (!isOpen) {
      setContentor(null)
      setLoadingContentor(false)
      setLoadError('')
      setForm(emptyForm())
      setSubmitting(false)
      setFormError('')
      return
    }

    if (!cid) {
      setContentor(null)
      setLoadError('')
      return
    }

    let cancelled = false
    setLoadingContentor(true)
    setLoadError('')
    fetchStrapiContentorByCid(cid)
      .then((item) => {
        if (cancelled) return
        setContentor(item)
        if (!item) {
          setLoadError('Contentor não encontrado.')
          return
        }
        const estadoInicial =
          CONTENTOR_ESTADOS.find(
            (e) => e.toLowerCase() === (item.estadoLabel ?? '').toLowerCase(),
          ) ?? CONTENTOR_ESTADOS[0]
        setForm((prev) => ({
          ...emptyForm(estadoInicial),
          numeroEgar: item.numeroEgar ?? '',
          observacoes: prev.observacoes,
        }))
      })
      .catch(() => {
        if (!cancelled) setLoadError('Não foi possível carregar os dados do contentor.')
      })
      .finally(() => {
        if (!cancelled) setLoadingContentor(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, cid])

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

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFormError('')
  }

  function handleDiscard() {
    setForm(
      emptyForm(
        contentor?.estadoLabel && CONTENTOR_ESTADOS.includes(contentor.estadoLabel)
          ? contentor.estadoLabel
          : CONTENTOR_ESTADOS[0],
      ),
    )
    setFormError('')
    onClose()
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
        estado: form.estado.trim(),
        peso: form.peso.trim(),
        numeroEgar: form.numeroEgar.trim(),
        observacoes: form.observacoes.trim(),
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível registar o movimento.')
    } finally {
      setSubmitting(false)
    }
  }

  const displayCid = contentor?.cid ?? cid
  const displayLitros = contentor?.litrosLabel ?? '—'
  const displayLocal = contentor?.localizacao ?? '—'
  const displayQr = formatQrLabel(displayCid)

  return (
    <div
      className={`formulario-screen${isOpen ? ' formulario-screen--open' : ''}`}
      aria-hidden={!isOpen}
    >
      <div
        className="formulario-screen__backdrop"
        aria-hidden="true"
        onClick={onClose}
      />

      <div
        className="formulario-screen__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="formulario-cid"
        aria-hidden={!isOpen}
      >
        <form className="formulario-screen__form" onSubmit={handleSubmit} noValidate>
          <div className="formulario-screen__card">
            <button
              type="button"
              className="formulario-screen__close"
              aria-label="Fechar"
              tabIndex={isOpen ? 0 : -1}
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faXmark} aria-hidden />
            </button>

            <div className="formulario-screen__scroll">
              <div className="formulario-screen__illus" aria-hidden="true">
                <img
                  src={iconCardTrash}
                  alt=""
                  className="formulario-screen__illus-icon"
                  width={80}
                  height={106}
                />
              </div>

              {hasContentor ? (
                <div className="formulario-screen__summary">
                  <p id="formulario-cid" className="formulario-screen__cid">
                    {loadingContentor ? 'A carregar…' : displayCid}
                  </p>
                  <p className="formulario-screen__specs">
                    <span className="formulario-screen__qr">{displayQr}</span>{' '}
                    <strong className="formulario-screen__litros">{displayLitros}</strong>
                  </p>
                  <p className="formulario-screen__local">{displayLocal}</p>
                </div>
              ) : (
                <p className="formulario-screen__summary formulario-screen__summary--empty">
                  Leia o código QR do contentor para preencher os dados automaticamente.
                </p>
              )}

              {loadError ? (
                <p className="formulario-screen__alert" role="alert">
                  {loadError}
                </p>
              ) : null}

              {formError ? (
                <p className="formulario-screen__alert" role="alert">
                  {formError}
                </p>
              ) : null}

              <input
                type="hidden"
                name="contentorId"
                className="formulario-screen__hidden"
                value={cid}
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

              <label className="formulario-screen__field">
                <span className="formulario-screen__label">Estado*</span>
                <span className="formulario-screen__select-wrap">
                  <select
                    className="formulario-screen__select"
                    value={form.estado}
                    onChange={(e) => updateField('estado', e.target.value)}
                    disabled={!hasContentor || loadingContentor}
                    required
                    tabIndex={isOpen ? 0 : -1}
                  >
                    {CONTENTOR_ESTADOS.map((estado) => (
                      <option key={estado} value={estado}>
                        {estado}
                      </option>
                    ))}
                  </select>
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className="formulario-screen__select-icon"
                    aria-hidden
                  />
                </span>
              </label>

              <label className="formulario-screen__field">
                <span className="formulario-screen__label">Peso*</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="formulario-screen__input"
                  name="peso"
                  value={form.peso}
                  onChange={(e) => updateField('peso', e.target.value)}
                  disabled={!hasContentor || loadingContentor}
                  required
                  tabIndex={isOpen ? 0 : -1}
                />
              </label>

              <label className="formulario-screen__field">
                <span className="formulario-screen__label">Número EGAR</span>
                <input
                  type="text"
                  className="formulario-screen__input"
                  name="numeroEgar"
                  value={form.numeroEgar}
                  onChange={(e) => updateField('numeroEgar', e.target.value)}
                  disabled={!hasContentor || loadingContentor}
                  tabIndex={isOpen ? 0 : -1}
                />
              </label>

              <label className="formulario-screen__field">
                <span className="formulario-screen__label">Observações</span>
                <input
                  type="text"
                  className="formulario-screen__input"
                  name="observacoes"
                  value={form.observacoes}
                  onChange={(e) => updateField('observacoes', e.target.value)}
                  disabled={!hasContentor || loadingContentor}
                  tabIndex={isOpen ? 0 : -1}
                />
              </label>

              <button
                type="button"
                className="formulario-screen__photos"
                disabled={!hasContentor || loadingContentor}
                tabIndex={isOpen ? 0 : -1}
                onClick={() => {
                  /* Próximo passo: captura/upload de fotografias */
                }}
              >
                <FontAwesomeIcon icon={faPaperclip} className="formulario-screen__photos-icon" aria-hidden />
                Fotografias
              </button>
            </div>

            <div className="formulario-screen__actions">
              <button
                type="submit"
                className="formulario-screen__submit"
                disabled={!canSubmit}
                tabIndex={isOpen ? 0 : -1}
              >
                {submitting ? 'A registar…' : 'Confirmar Registo'}
              </button>
              <button
                type="button"
                className="formulario-screen__discard"
                disabled={submitting}
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
