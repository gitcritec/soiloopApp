import { useEffect, useState } from 'react'
import { faChevronDown } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import iconCardTrash from '../../../../assets/figma-cliente/icon-card-trash.png'
import {
  CONTENTOR_ESTADOS,
  createStrapiContentor,
  fetchStrapiCapacidades,
  updateStrapiContentor,
} from '../../../../lib/strapiContentores.js'
import './ContentorRegisto.css'

function todayIsoDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function emptyForm(capacidadeId = '') {
  return {
    capacidadeId,
    localizacao: '',
    estado: CONTENTOR_ESTADOS[0],
    data: todayIsoDate(),
  }
}

/** @param {import('../../../../lib/strapiContentores.js').ContentorItem} contentor */
function formFromContentor(contentor) {
  const estado =
    CONTENTOR_ESTADOS.includes(contentor.estadoLabel) ? contentor.estadoLabel : CONTENTOR_ESTADOS[0]
  const localizacao =
    contentor.localizacao && contentor.localizacao !== '—' ? contentor.localizacao : ''
  return {
    capacidadeId: contentor.capacidadeId ?? '',
    localizacao,
    estado,
    data: contentor.dataIso || todayIsoDate(),
  }
}

/**
 * Formulário de registo ou edição de contentor (Figma).
 * Criação: CID gerado automaticamente no envio.
 * @param {import('../../../../lib/strapiContentores.js').ContentorItem} [contentorToEdit]
 */
export default function ContentorRegisto({ contentorToEdit, onCancel, onSuccess }) {
  const isEdit = Boolean(contentorToEdit)
  const [form, setForm] = useState(() =>
    contentorToEdit ? formFromContentor(contentorToEdit) : emptyForm(),
  )
  const [capacidades, setCapacidades] = useState([])
  const [loadingCaps, setLoadingCaps] = useState(true)
  const [capsError, setCapsError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoadingCaps(true)
    setCapsError(null)
    fetchStrapiCapacidades()
      .then((rows) => {
        if (cancelled) return
        setCapacidades(rows)
        if (rows.length > 0) {
          setForm((prev) => {
            if (prev.capacidadeId) return prev
            if (isEdit && contentorToEdit?.capacidadeId) {
              return { ...prev, capacidadeId: contentorToEdit.capacidadeId }
            }
            return { ...prev, capacidadeId: rows[0].id }
          })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCapsError(
            err instanceof Error
              ? err.message
              : 'Não foi possível carregar as capacidades.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCaps(false)
      })
    return () => {
      cancelled = true
    }
  }, [isEdit, contentorToEdit])

  useEffect(() => {
    if (contentorToEdit) {
      setForm(formFromContentor(contentorToEdit))
      setFormError('')
    }
  }, [contentorToEdit])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFormError('')
  }

  function handleDiscard() {
    if (isEdit && contentorToEdit) {
      setForm(formFromContentor(contentorToEdit))
    } else {
      setForm(emptyForm(capacidades[0]?.id ?? ''))
    }
    setFormError('')
    onCancel?.()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    const localizacao = form.localizacao.trim()

    if (!form.capacidadeId) {
      setFormError('Seleciona uma capacidade.')
      return
    }
    if (!localizacao) {
      setFormError('A localização é obrigatória.')
      return
    }
    if (!form.estado) {
      setFormError('Seleciona o estado.')
      return
    }
    if (!form.data) {
      setFormError('A data de registo é obrigatória.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        capacidadeId: form.capacidadeId,
        localizacao,
        estado: form.estado,
        data: form.data,
      }
      const saved = isEdit
        ? await updateStrapiContentor(contentorToEdit.id, payload)
        : await createStrapiContentor(payload)
      onSuccess?.(saved)
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : isEdit
            ? 'Não foi possível guardar as alterações.'
            : 'Não foi possível registar o contentor.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="contentor-registo" aria-labelledby="contentor-registo-title">
      <form className="contentor-registo__form" onSubmit={handleSubmit} noValidate>
        <h2 id="contentor-registo-title" className="visually-hidden">
          {isEdit ? 'Editar contentor' : 'Registo de contentor'}
        </h2>

        <div className="contentor-registo__card">
          <div className="contentor-registo__scroll">
            <div className="contentor-registo__illus" aria-hidden="true">
              <img src={iconCardTrash} alt="" className="contentor-registo__illus-icon" width={80} height={106} />
            </div>

            {formError ? (
              <p className="contentor-registo__error" role="alert">
                {formError}
              </p>
            ) : null}

            {isEdit ? (
              <label className="contentor-registo__field">
                <span className="contentor-registo__label">CID</span>
                <input
                  type="text"
                  className="contentor-registo__input contentor-registo__input--readonly"
                  value={contentorToEdit.cid}
                  readOnly
                  aria-readonly="true"
                />
              </label>
            ) : null}

            <label className="contentor-registo__field">
              <span className="contentor-registo__label">Capacidade (L)*</span>
              <span className="contentor-registo__select-wrap">
                <select
                  className="contentor-registo__select"
                  value={form.capacidadeId}
                  onChange={(e) => updateField('capacidadeId', e.target.value)}
                  disabled={loadingCaps || capacidades.length === 0}
                  required
                >
                  {loadingCaps ? <option value="">A carregar…</option> : null}
                  {!loadingCaps && capacidades.length === 0 ? (
                    <option value="">Sem capacidades</option>
                  ) : null}
                  {capacidades.map((cap) => (
                    <option key={cap.id} value={cap.id}>
                      {cap.label}
                    </option>
                  ))}
                </select>
                <FontAwesomeIcon icon={faChevronDown} className="contentor-registo__select-icon" aria-hidden />
              </span>
            </label>

            {capsError ? (
              <p className="contentor-registo__hint contentor-registo__hint--error" role="alert">
                {capsError}
                {capsError.includes('403') ? ' Contacta o suporte se o problema continuar.' : null}
              </p>
            ) : null}
            {!loadingCaps && !capsError && capacidades.length === 0 ? (
              <p className="contentor-registo__hint contentor-registo__hint--error" role="status">
                Não há capacidades disponíveis. Contacta o suporte.
              </p>
            ) : null}

            <label className="contentor-registo__field">
              <span className="contentor-registo__label">Localização*</span>
              <input
                type="text"
                className="contentor-registo__input"
                value={form.localizacao}
                onChange={(e) => updateField('localizacao', e.target.value)}
                required
              />
            </label>

            <label className="contentor-registo__field">
              <span className="contentor-registo__label">Estado*</span>
              <span className="contentor-registo__select-wrap">
                <select
                  className="contentor-registo__select"
                  value={form.estado}
                  onChange={(e) => updateField('estado', e.target.value)}
                  required
                >
                  {CONTENTOR_ESTADOS.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                </select>
                <FontAwesomeIcon icon={faChevronDown} className="contentor-registo__select-icon" aria-hidden />
              </span>
            </label>

            <label className="contentor-registo__field">
              <span className="contentor-registo__label">Data de Registo*</span>
              <input
                type="date"
                className="contentor-registo__input"
                value={form.data}
                onChange={(e) => updateField('data', e.target.value)}
                required
              />
            </label>
          </div>

          <div className="contentor-registo__actions">
            <button type="submit" className="contentor-registo__submit" disabled={submitting}>
              {submitting ? 'A guardar…' : isEdit ? 'Guardar alterações' : 'Confirmar Registo'}
            </button>
            <button
              type="button"
              className="contentor-registo__discard"
              disabled={submitting}
              onClick={handleDiscard}
            >
              Descartar Alterações
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
