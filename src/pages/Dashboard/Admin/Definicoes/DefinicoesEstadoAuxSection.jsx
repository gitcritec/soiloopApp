import { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPen, faTrash } from '@fortawesome/pro-light-svg-icons'
import {
  createStrapiEstadoAux,
  deleteStrapiEstadoAux,
  ESTADO_AUX_CONFIG,
  ESTADO_AUX_SUGESTOES,
  fetchStrapiEstadosAux,
  updateStrapiEstadoAux,
} from '../../../../lib/strapiEstadosAuxiliares.js'

/**
 * CRUD de uma tabela auxiliar de estados (Definições).
 * @param {{ kind: 'fisico'|'pedido'|'residuo' }} props
 */
export default function DefinicoesEstadoAuxSection({ kind }) {
  const cfg = ESTADO_AUX_CONFIG[kind]
  const sugestoes = ESTADO_AUX_SUGESTOES[kind] ?? []

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [nome, setNome] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    return fetchStrapiEstadosAux(kind)
      .then((rows) => setItems(rows))
      .catch((err) => {
        setError(err instanceof Error ? err.message : `Não foi possível carregar ${cfg.labelPlural}.`)
        setItems([])
      })
      .finally(() => setLoading(false))
  }, [kind, cfg.labelPlural])

  useEffect(() => {
    load()
  }, [load])

  function resetForm() {
    setNome('')
    setEditingId(null)
  }

  function startEdit(item) {
    if (!item?.id) return
    setError('')
    setNotice('')
    setEditingId(item.id)
    setNome(item.nome ?? '')
  }

  async function handleSave(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    const nomeTrim = nome.trim()
    if (!nomeTrim) {
      setError(`Indica o nome do ${cfg.label.toLowerCase()}.`)
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        const updated = await updateStrapiEstadoAux(kind, editingId, { nome: nomeTrim })
        setItems((prev) =>
          [...prev.filter((item) => item.id !== updated.id && item.id !== editingId), updated].sort(
            (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt'),
          ),
        )
        setNotice(`${cfg.label} atualizado.`)
      } else {
        const created = await createStrapiEstadoAux(kind, {
          nome: nomeTrim,
          ordem: items.length,
        })
        setItems((prev) =>
          [...prev.filter((item) => item.id !== created.id), created].sort(
            (a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt'),
          ),
        )
        setNotice(`${cfg.label} adicionado.`)
      }
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Não foi possível guardar ${cfg.label.toLowerCase()}.`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item) {
    if (!item?.id) return
    setError('')
    setNotice('')
    setBusyId(item.id)
    try {
      await deleteStrapiEstadoAux(kind, item.id)
      setItems((prev) => prev.filter((row) => row.id !== item.id))
      if (editingId === item.id) resetForm()
      setNotice(`${cfg.label} removido.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Não foi possível remover ${cfg.label.toLowerCase()}.`)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="definicoes__card" aria-labelledby={`definicoes-${kind}-title`}>
      <h2 id={`definicoes-${kind}-title`} className="definicoes__section-title">
        {cfg.labelPlural}
      </h2>
      <p className="definicoes__section-help">
        {kind === 'fisico' || kind === 'residuo'
          ? 'Associado ao contentor — atualizável na recolha.'
          : 'Associado ao movimento (logística do serviço).'}
        {sugestoes.length > 0 ? ` Sugestões: ${sugestoes.join(', ')}.` : ''}
      </p>

      {loading ? (
        <p className="definicoes__ler-status" role="status">
          A carregar…
        </p>
      ) : null}

      {!loading && items.length === 0 ? (
        <p className="definicoes__ler-status">Ainda não existem registos.</p>
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="definicoes__ler-list">
          {items.map((item) => (
            <li
              key={item.id}
              className={`definicoes__ler-item${editingId === item.id ? ' definicoes__ler-item--editing' : ''}`}
            >
              <div className="definicoes__ler-item-main">
                <p className="definicoes__ler-codigo">{item.nome}</p>
              </div>
              <div className="definicoes__ler-item-actions">
                <button
                  type="button"
                  className="definicoes__ler-edit"
                  aria-label={`Editar ${item.nome}`}
                  disabled={busyId === item.id || saving}
                  onClick={() => startEdit(item)}
                >
                  <FontAwesomeIcon icon={faPen} aria-hidden />
                </button>
                <button
                  type="button"
                  className="definicoes__ler-delete"
                  aria-label={`Remover ${item.nome}`}
                  disabled={busyId === item.id || saving}
                  onClick={() => handleDelete(item)}
                >
                  <FontAwesomeIcon icon={faTrash} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <form className="definicoes__ler-form" onSubmit={handleSave} noValidate>
        <p className="definicoes__ler-form-title">
          {editingId ? `Editar ${cfg.label.toLowerCase()}` : `Adicionar ${cfg.label.toLowerCase()}`}
        </p>
        <label className="definicoes__field">
          <span className="definicoes__label">Nome*</span>
          <input
            type="text"
            className="definicoes__input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={sugestoes[0] ?? 'Nome'}
            required
          />
        </label>

        {error ? (
          <p className="definicoes__form-error" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="definicoes__notice" role="status">
            {notice}
          </p>
        ) : null}

        <div className="definicoes__ler-form-actions">
          <button type="submit" className="definicoes__submit" disabled={saving}>
            {saving ? 'A guardar…' : editingId ? 'Guardar' : 'Adicionar'}
          </button>
          {editingId ? (
            <button type="button" className="definicoes__ler-cancel-btn" disabled={saving} onClick={resetForm}>
              Cancelar
            </button>
          ) : null}
        </div>
      </form>
    </section>
  )
}
