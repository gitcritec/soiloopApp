import { useEffect, useState } from 'react'
import { faChevronDown } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import iconCardTrash from '../../../../assets/figma-cliente/icon-card-trash.png'
import {
  createStrapiContentor,
  fetchStrapiCapacidades,
  resolveNextContentorCid,
  updateStrapiContentor,
} from '../../../../lib/strapiContentores.js'
import {
  fetchStrapiEstadosFisicos,
  fetchStrapiEstadosResiduo,
} from '../../../../lib/strapiEstadosAuxiliares.js'
import './ContentorRegisto.css'

function todayIsoDate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function emptyForm(capacidadeId = '', estadoFisicoId = '', estadoResiduoId = '', cid = '') {
  return {
    cid,
    capacidadeId,
    localizacao: '',
    estadoFisicoId,
    estadoResiduoId,
    data: todayIsoDate(),
  }
}

/** @param {import('../../../../lib/strapiContentores.js').ContentorItem} contentor */
function formFromContentor(contentor) {
  const localizacao =
    contentor.localizacao && contentor.localizacao !== '—' ? contentor.localizacao : ''
  return {
    cid: contentor.cid && contentor.cid !== '—' ? contentor.cid : '',
    capacidadeId: contentor.capacidadeId ?? '',
    localizacao,
    estadoFisicoId: contentor.estadoFisicoId ?? '',
    estadoResiduoId: contentor.estadoResiduoId ?? '',
    data: contentor.dataIso || todayIsoDate(),
  }
}

/**
 * Formulário de registo ou edição de contentor (Figma).
 * Criação: CID pré-preenchido (próximo sequencial), editável para contentores externos.
 * @param {import('../../../../lib/strapiContentores.js').ContentorItem} [contentorToEdit]
 */
export default function ContentorRegisto({ contentorToEdit, onCancel, onSuccess }) {
  const isEdit = Boolean(contentorToEdit)
  const [form, setForm] = useState(() =>
    contentorToEdit ? formFromContentor(contentorToEdit) : emptyForm(),
  )
  const [capacidades, setCapacidades] = useState([])
  const [estadosFisicos, setEstadosFisicos] = useState([])
  const [estadosResiduo, setEstadosResiduo] = useState([])
  const [loadingCaps, setLoadingCaps] = useState(true)
  const [capsError, setCapsError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [cidSuggested, setCidSuggested] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingCaps(true)
    setCapsError(null)
    Promise.all([
      fetchStrapiCapacidades(),
      fetchStrapiEstadosFisicos().catch(() => []),
      fetchStrapiEstadosResiduo().catch(() => []),
      isEdit ? Promise.resolve(null) : resolveNextContentorCid().catch(() => ''),
    ])
      .then(([rows, fisicoRows, residuoRows, nextCid]) => {
        if (cancelled) return
        setCapacidades(rows)
        setEstadosFisicos(fisicoRows)
        setEstadosResiduo(residuoRows)
        setForm((prev) => {
          let next = prev
          if (!prev.capacidadeId && rows.length > 0) {
            if (isEdit && contentorToEdit?.capacidadeId) {
              next = { ...next, capacidadeId: contentorToEdit.capacidadeId }
            } else {
              next = { ...next, capacidadeId: rows[0].id }
            }
          }
          if (!prev.estadoFisicoId && fisicoRows.length > 0 && !isEdit) {
            next = { ...next, estadoFisicoId: fisicoRows[0].id }
          }
          if (!prev.estadoResiduoId && residuoRows.length > 0 && !isEdit) {
            next = { ...next, estadoResiduoId: residuoRows[0].id }
          }
          if (!isEdit && !prev.cid && nextCid) {
            next = { ...next, cid: nextCid }
          }
          return next
        })
        if (!isEdit && nextCid) setCidSuggested(true)
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
      setCidSuggested(false)
    }
  }, [contentorToEdit])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (field === 'cid') setCidSuggested(false)
    setFormError('')
  }

  function handleDiscard() {
    if (isEdit && contentorToEdit) {
      setForm(formFromContentor(contentorToEdit))
    } else {
      setForm(
        emptyForm(
          capacidades[0]?.id ?? '',
          estadosFisicos[0]?.id ?? '',
          estadosResiduo[0]?.id ?? '',
          form.cid,
        ),
      )
    }
    setFormError('')
    onCancel?.()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')

    const cid = form.cid.trim()
    const localizacao = form.localizacao.trim()

    if (!isEdit && !cid) {
      setFormError('Indica a referência do contentor.')
      return
    }
    if (!form.capacidadeId) {
      setFormError('Seleciona uma capacidade.')
      return
    }
    if (!localizacao) {
      setFormError('A localização é obrigatória.')
      return
    }
    if (!form.estadoFisicoId) {
      setFormError('Seleciona o estado físico.')
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
        estadoFisicoId: form.estadoFisicoId,
        estadoResiduoId: form.estadoResiduoId || undefined,
        data: form.data,
      }
      const saved = isEdit
        ? await updateStrapiContentor(contentorToEdit.id, payload)
        : await createStrapiContentor({ ...payload, cid })
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

            <label className="contentor-registo__field">
              <span className="contentor-registo__label">Referência (CID)*</span>
              <input
                type="text"
                className="contentor-registo__input"
                value={form.cid}
                onChange={(e) => updateField('cid', e.target.value)}
                placeholder={loadingCaps && !isEdit ? 'A gerar…' : 'Ex.: CNT-001'}
                disabled={isEdit || (loadingCaps && !form.cid)}
                readOnly={isEdit}
                required={!isEdit}
                autoComplete="off"
                spellCheck={false}
              />
              {!isEdit ? (
                <span className="contentor-registo__hint">
                  {cidSuggested
                    ? 'Sugestão automática — podes alterar se for um contentor externo.'
                    : 'Podes usar a sugestão automática ou o ID externo do contentor.'}
                </span>
              ) : null}
            </label>

            <label className="contentor-registo__field">
              <span className="contentor-registo__label">Capacidade*</span>
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
              <span className="contentor-registo__label">Estado físico*</span>
              <span className="contentor-registo__select-wrap">
                <select
                  className="contentor-registo__select"
                  value={form.estadoFisicoId}
                  onChange={(e) => updateField('estadoFisicoId', e.target.value)}
                  required
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
                <FontAwesomeIcon icon={faChevronDown} className="contentor-registo__select-icon" aria-hidden />
              </span>
            </label>

            <label className="contentor-registo__field">
              <span className="contentor-registo__label">Estado do resíduo</span>
              <span className="contentor-registo__select-wrap">
                <select
                  className="contentor-registo__select"
                  value={form.estadoResiduoId}
                  onChange={(e) => updateField('estadoResiduoId', e.target.value)}
                >
                  <option value="">—</option>
                  {estadosResiduo.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
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
              Descartar
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}
