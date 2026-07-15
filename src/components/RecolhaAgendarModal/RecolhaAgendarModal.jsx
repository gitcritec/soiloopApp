import { useEffect, useMemo, useState } from 'react'
import { faCalendarDays, faChevronLeft, faChevronRight, faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { fetchStrapiContentorByCid } from '../../lib/strapiContentores.js'
import { fetchStrapiOperadores } from '../../lib/strapiOperadores.js'
import {
  fetchStrapiContentoresParaEntrega,
  fetchStrapiOperadorAgenda,
  getPedidoEntregaCapacidadeId,
  getPedidoEntregaCapacidadeLabel,
  getPedidoEntregaMovimentoKey,
  getPedidoGroupMovimentoKeys,
  pedidoHasTroca,
  pedidoIsEntregaSimples,
  pedidoNeedsEntregaContentor,
  pickPedidoClienteId,
  scheduleStrapiMovimentoPedido,
} from '../../lib/strapiMovimentos.js'
import './RecolhaAgendarModal.css'

function formatPeriodoLabel(value) {
  const normalized = String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (normalized === 'manha') return 'Manhã'
  if (normalized === 'tarde') return 'Tarde'
  return 'Indiferente'
}

function formatDateLabel(dataIso) {
  if (!dataIso) return '—'
  const match = String(dataIso).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return dataIso
  return `${match[3]}/${match[2]}/${match[1]}`
}

function shiftDateIso(dataIso, days) {
  const match = String(dataIso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return dataIso ?? ''
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  date.setDate(date.getDate() + days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function taskTypeLabel(taskType) {
  return taskType === 'entregar' ? 'Entrega' : 'Recolha'
}

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {object|null} props.pedido
 * @param {() => void} props.onClose
 * @param {() => void} props.onSuccess
 */
export default function RecolhaAgendarModal({ isOpen, pedido, onClose, onSuccess }) {
  const [operadores, setOperadores] = useState([])
  const [operadoresLoading, setOperadoresLoading] = useState(false)
  const [operadorId, setOperadorId] = useState('')
  const [dataIso, setDataIso] = useState('')
  const [agenda, setAgenda] = useState([])
  const [agendaLoading, setAgendaLoading] = useState(false)
  const [insertIndex, setInsertIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [entregaContentorId, setEntregaContentorId] = useState('')
  const [contentoresEntrega, setContentoresEntrega] = useState([])
  const [semContentoresMesmaCapacidade, setSemContentoresMesmaCapacidade] = useState(false)
  const [contentoresLoading, setContentoresLoading] = useState(false)
  const [recolhaMeta, setRecolhaMeta] = useState({
    litrosLabel: null,
    capacidadeId: null,
    capacidadeLitros: null,
    loading: false,
  })

  const hasTroca = pedidoHasTroca(pedido)
  const isEntregaSimples = pedidoIsEntregaSimples(pedido)
  const needsEntregaContentor = pedidoNeedsEntregaContentor(pedido)

  const recolhaCapacidadeLabel = useMemo(() => {
    return (
      recolhaMeta.litrosLabel ??
      pedido?.recolhaLitrosLabel ??
      pedido?.litrosLabel ??
      (pedido?.recolhaCapacidadeLitros != null ? `${pedido.recolhaCapacidadeLitros} L` : null) ??
      (pedido?.contentorLitros != null ? `${pedido.contentorLitros} L` : null) ??
      '—'
    )
  }, [recolhaMeta.litrosLabel, pedido])

  const recolhaCapacidadeId = recolhaMeta.capacidadeId ?? pedido?.recolhaCapacidadeId ?? null
  const recolhaCapacidadeLitros =
    recolhaMeta.capacidadeLitros ?? pedido?.recolhaCapacidadeLitros ?? pedido?.contentorLitros ?? null

  const entregaCapacidadeId = useMemo(
    () => (hasTroca ? recolhaCapacidadeId : getPedidoEntregaCapacidadeId(pedido)),
    [hasTroca, pedido, recolhaCapacidadeId],
  )

  const entregaCapacidadeLabel = useMemo(() => {
    if (hasTroca) return recolhaCapacidadeLabel
    return getPedidoEntregaCapacidadeLabel(pedido)
  }, [hasTroca, pedido, recolhaCapacidadeLabel])

  const entregaCapacidadeLitros = useMemo(() => {
    if (hasTroca) return recolhaCapacidadeLitros
    return (
      pedido?.entregaCapacidadeLitros ??
      pedido?.pedidoCapacidadeLitros ??
      pedido?.contentorLitros ??
      null
    )
  }, [hasTroca, pedido, recolhaCapacidadeLitros])

  useEffect(() => {
    if (!isOpen) return
    setOperadorId('')
    setDataIso(pedido?.dataIso ?? '')
    setAgenda([])
    setInsertIndex(0)
    setFormError('')
    setSubmitting(false)
    setEntregaContentorId('')
    setContentoresEntrega([])
    setSemContentoresMesmaCapacidade(false)
    setRecolhaMeta({ litrosLabel: null, capacidadeId: null, capacidadeLitros: null, loading: false })

    setOperadoresLoading(true)
    fetchStrapiOperadores()
      .then((rows) => setOperadores(rows))
      .catch(() => setOperadores([]))
      .finally(() => setOperadoresLoading(false))
  }, [isOpen, pedido?.dataIso, pedido?.movimentoKey])

  useEffect(() => {
    if (!isOpen || !pedido) {
      setRecolhaMeta({ litrosLabel: null, capacidadeId: null, capacidadeLitros: null, loading: false })
      return
    }

    const initialLabel = pedido.recolhaLitrosLabel ?? pedido.litrosLabel
    const initialCapacidadeId = pedido.recolhaCapacidadeId
    const initialLitros = pedido.recolhaCapacidadeLitros ?? pedido.contentorLitros

    if (initialLabel || initialCapacidadeId || initialLitros != null) {
      setRecolhaMeta({
        litrosLabel: initialLabel ?? (initialLitros != null ? `${initialLitros} L` : null),
        capacidadeId: initialCapacidadeId,
        capacidadeLitros: initialLitros,
        loading: false,
      })
      return
    }

    if (!hasTroca) return

    const cid = pedido.recolhaContentorCid ?? pedido.id
    if (!cid || cid === 'Não definido') return

    let cancelled = false
    setRecolhaMeta((prev) => ({ ...prev, loading: true }))
    fetchStrapiContentorByCid(cid)
      .then((contentor) => {
        if (cancelled) return
        if (!contentor) {
          setRecolhaMeta({ litrosLabel: null, capacidadeId: null, capacidadeLitros: null, loading: false })
          return
        }
        setRecolhaMeta({
          litrosLabel: contentor.litrosLabel,
          capacidadeId: contentor.capacidadeId,
          capacidadeLitros: contentor.litros,
          loading: false,
        })
      })
      .catch(() => {
        if (!cancelled) {
          setRecolhaMeta({ litrosLabel: null, capacidadeId: null, capacidadeLitros: null, loading: false })
        }
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, pedido, hasTroca])

  useEffect(() => {
    if (!isOpen || !needsEntregaContentor) {
      setContentoresEntrega([])
      setEntregaContentorId('')
      setSemContentoresMesmaCapacidade(false)
      return
    }

    let cancelled = false
    setContentoresLoading(true)
    setFormError('')
    fetchStrapiContentoresParaEntrega(entregaCapacidadeId)
      .then((result) => {
        if (!cancelled) {
          setContentoresEntrega(result.contentores)
          setSemContentoresMesmaCapacidade(result.semContentoresMesmaCapacidade)
          setEntregaContentorId('')
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setContentoresEntrega([])
          setFormError(err instanceof Error ? err.message : 'Não foi possível carregar contentores.')
        }
      })
      .finally(() => {
        if (!cancelled) setContentoresLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, needsEntregaContentor, entregaCapacidadeId, pedido?.movimentoKey])

  useEffect(() => {
    if (!isOpen || !operadorId || !dataIso) {
      setAgenda([])
      return
    }

    let cancelled = false
    setAgendaLoading(true)
    setFormError('')
    fetchStrapiOperadorAgenda(operadorId, dataIso)
      .then((rows) => {
        if (!cancelled) {
          setAgenda(rows)
          setInsertIndex((prev) => Math.min(prev, rows.length))
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAgenda([])
          setFormError(err instanceof Error ? err.message : 'Não foi possível carregar a agenda.')
        }
      })
      .finally(() => {
        if (!cancelled) setAgendaLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, operadorId, dataIso])

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  const operadorNome = useMemo(
    () => operadores.find((item) => String(item.id) === String(operadorId))?.nome ?? '',
    [operadores, operadorId],
  )

  const contentoresEntregaOpcoes = useMemo(() => {
    const recolhaCid = pedido?.recolhaContentorCid ?? pedido?.id
    if (!recolhaCid) return contentoresEntrega
    return contentoresEntrega.filter((item) => item.cid !== recolhaCid)
  }, [contentoresEntrega, pedido?.recolhaContentorCid, pedido?.id])

  async function handleConfirm() {
    if (!pedido) return
    const keys = getPedidoGroupMovimentoKeys(pedido)
    if (keys.length === 0) {
      setFormError('Pedido inválido.')
      return
    }
    if (!operadorId) {
      setFormError('Seleciona um operador.')
      return
    }
    if (!dataIso) {
      setFormError('Escolhe uma data.')
      return
    }
    if (needsEntregaContentor && !entregaContentorId) {
      setFormError('Seleciona o contentor a entregar.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      await scheduleStrapiMovimentoPedido({
        movimentoKeys: keys,
        operadorId,
        data: dataIso,
        periodo: pedido.periodo,
        insertIndex,
        entregaMovimentoKey: needsEntregaContentor ? getPedidoEntregaMovimentoKey(pedido) : undefined,
        entregaContentorId: needsEntregaContentor ? entregaContentorId : undefined,
        entregaClienteId: pickPedidoClienteId(pedido),
        entregaLocalizacaoId: pedido.localizacaoId,
        entregaLocalizacaoLabel: pedido.locationDetail ?? pedido.location,
      })
      onSuccess?.()
      onClose()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível agendar o pedido.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || !pedido) return null

  return (
    <div className={`recolha-agendar-modal${isOpen ? ' recolha-agendar-modal--open' : ''}`} aria-hidden={!isOpen}>
      <button type="button" className="recolha-agendar-modal__backdrop" aria-label="Fechar" onClick={onClose} />
      <div
        className="recolha-agendar-modal__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recolha-agendar-modal-title"
      >
        <header className="recolha-agendar-modal__header">
          <div className="recolha-agendar-modal__titles">
            <h2 id="recolha-agendar-modal-title" className="recolha-agendar-modal__title">
              {hasTroca
                ? 'Agendar recolha e entrega'
                : isEntregaSimples
                  ? 'Agendar entrega'
                  : 'Agendar recolha'}
            </h2>
            <p className="recolha-agendar-modal__subtitle">
              {pedido.id !== 'Não definido' ? `${pedido.id} · ` : ''}
              {pedido.clientName ?? 'Cliente'} · {pedido.location ?? 'Localização'}
              {hasTroca ? ' · Troca de contentor' : isEntregaSimples ? ' · Entrega de contentor' : ''}
            </p>
          </div>
          <button type="button" className="recolha-agendar-modal__close" aria-label="Fechar" onClick={onClose}>
            <FontAwesomeIcon icon={faXmark} aria-hidden />
          </button>
        </header>

        <div className="recolha-agendar-modal__body">
          {formError ? (
            <p className="recolha-agendar-modal__error" role="alert">
              {formError}
            </p>
          ) : null}

          <label className="recolha-agendar-modal__field">
            <span className="recolha-agendar-modal__label">Operador*</span>
            <select
              className="recolha-agendar-modal__select"
              value={operadorId}
              onChange={(e) => {
                setOperadorId(e.target.value)
                setInsertIndex(0)
              }}
              disabled={submitting || operadoresLoading}
              required
            >
              <option value="">
                {operadoresLoading ? 'A carregar operadores…' : 'Selecionar operador'}
              </option>
              {operadores.map((operador) => (
                <option key={operador.id} value={operador.id}>
                  {operador.nome}
                </option>
              ))}
            </select>
          </label>

          {needsEntregaContentor ? (
            <section
              className="recolha-agendar-modal__troca"
              aria-label={hasTroca ? 'Troca de contentor' : 'Entrega de contentor'}
            >
              <h3 className="recolha-agendar-modal__troca-title">
                {hasTroca ? 'Troca de contentor' : 'Entrega de contentor'}
              </h3>
              {hasTroca ? (
                <p className="recolha-agendar-modal__troca-recolha">
                  Contentor a recolher:{' '}
                  <strong>
                    {pedido.recolhaContentorCid ?? pedido.id}
                    {recolhaCapacidadeLabel !== '—' ? ` · ${recolhaCapacidadeLabel}` : ''}
                  </strong>
                  {recolhaMeta.loading ? ' (a carregar capacidade…)' : null}
                </p>
              ) : (
                <p className="recolha-agendar-modal__troca-recolha">
                  Capacidade pedida:{' '}
                  <strong>{entregaCapacidadeLabel !== '—' ? entregaCapacidadeLabel : '—'}</strong>
                </p>
              )}
              <p className="recolha-agendar-modal__troca-help">
                {semContentoresMesmaCapacidade
                  ? 'Sem contentores livres com a capacidade pedida — a lista abaixo inclui todas as outras opções disponíveis.'
                  : `O contentor de entrega deve ter a mesma capacidade (${
                      entregaCapacidadeLitros != null
                        ? `${entregaCapacidadeLitros} L`
                        : entregaCapacidadeLabel !== '—'
                          ? entregaCapacidadeLabel
                          : hasTroca
                            ? 'capacidade do contentor recolhido'
                            : 'capacidade pedida pelo cliente'
                    }).`}
              </p>
              {semContentoresMesmaCapacidade ? (
                <p className="recolha-agendar-modal__capacidade-alert" role="status">
                  Não existem contentores disponíveis com a mesma capacidade (
                  {entregaCapacidadeLitros != null
                    ? `${entregaCapacidadeLitros} L`
                    : entregaCapacidadeLabel !== '—'
                      ? entregaCapacidadeLabel
                      : 'pedida'}
                  ).
                </p>
              ) : null}
              <label className="recolha-agendar-modal__field">
                <span className="recolha-agendar-modal__label">Contentor a entregar*</span>
                <select
                  className="recolha-agendar-modal__select"
                  value={entregaContentorId}
                  onChange={(e) => setEntregaContentorId(e.target.value)}
                  disabled={submitting || contentoresLoading}
                  required
                >
                  <option value="">
                    {contentoresLoading
                      ? 'A carregar contentores…'
                      : contentoresEntregaOpcoes.length === 0
                        ? semContentoresMesmaCapacidade
                          ? 'Sem contentores disponíveis'
                          : 'Sem contentores livres nesta capacidade'
                        : 'Selecionar contentor'}
                  </option>
                  {contentoresEntregaOpcoes.map((contentor) => (
                    <option key={contentor.id} value={contentor.id}>
                      {contentor.cid} · {contentor.litrosLabel}
                      {contentor.estadoLabel ? ` · ${contentor.estadoLabel}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </section>
          ) : null}

          {operadorId ? (
            <div className="recolha-agendar-modal__day">
              <span className="recolha-agendar-modal__label">Dia da agenda</span>
              <div className="recolha-agendar-modal__day-row">
                <button
                  type="button"
                  className="recolha-agendar-modal__day-btn"
                  aria-label="Dia anterior"
                  disabled={submitting}
                  onClick={() => setDataIso((prev) => shiftDateIso(prev, -1))}
                >
                  <FontAwesomeIcon icon={faChevronLeft} aria-hidden />
                </button>
                <label className="recolha-agendar-modal__date-field">
                  <FontAwesomeIcon icon={faCalendarDays} className="recolha-agendar-modal__date-icon" aria-hidden />
                  <input
                    type="date"
                    className="recolha-agendar-modal__date-input"
                    value={dataIso}
                    onChange={(e) => {
                      setDataIso(e.target.value)
                      setInsertIndex(0)
                    }}
                    disabled={submitting}
                    aria-label="Data da agenda"
                  />
                </label>
                <button
                  type="button"
                  className="recolha-agendar-modal__day-btn"
                  aria-label="Dia seguinte"
                  disabled={submitting}
                  onClick={() => setDataIso((prev) => shiftDateIso(prev, 1))}
                >
                  <FontAwesomeIcon icon={faChevronRight} aria-hidden />
                </button>
              </div>
              <p className="recolha-agendar-modal__day-hint">
                Agenda de <strong>{operadorNome}</strong> em {formatDateLabel(dataIso)} ·{' '}
                {agendaLoading ? 'a carregar…' : `${agenda.length} recolha(s) agendada(s)`}
              </p>
            </div>
          ) : null}

          {operadorId && dataIso ? (
            <section className="recolha-agendar-modal__timeline" aria-label="Ordem das recolhas no dia">
              <h3 className="recolha-agendar-modal__timeline-title">Onde inserir este pedido?</h3>
              <p className="recolha-agendar-modal__timeline-help">
                Escolhe a posição na rota. Podes mudar o dia acima se a agenda estiver cheia.
              </p>

              <ol className="recolha-agendar-modal__slots">
                {agenda.map((item, index) => (
                  <li key={item.movimentoKey ?? `${item.id}-${index}`} className="recolha-agendar-modal__slot-group">
                    <button
                      type="button"
                      className={`recolha-agendar-modal__insert${insertIndex === index ? ' recolha-agendar-modal__insert--active' : ''}`}
                      aria-pressed={insertIndex === index}
                      disabled={submitting || agendaLoading}
                      onClick={() => setInsertIndex(index)}
                    >
                      {insertIndex === index ? 'Inserir pedido aqui' : `Inserir antes da posição ${index + 1}`}
                    </button>
                    {insertIndex === index ? (
                      <article className="recolha-agendar-modal__preview" aria-label="Pedido a agendar">
                        <p className="recolha-agendar-modal__preview-tag">Novo pedido</p>
                        <p className="recolha-agendar-modal__preview-title">{pedido.id}</p>
                        <p className="recolha-agendar-modal__preview-meta">
                          {pedido.location} · {formatPeriodoLabel(pedido.periodo)}
                          {hasTroca
                            ? ' · Recolha + entrega'
                            : isEntregaSimples
                              ? ' · Entrega'
                              : ''}
                        </p>
                      </article>
                    ) : null}
                    <article className="recolha-agendar-modal__agenda-item">
                      <p className="recolha-agendar-modal__agenda-pos">#{index + 1}</p>
                      <div className="recolha-agendar-modal__agenda-main">
                        <p className="recolha-agendar-modal__agenda-title">{item.id}</p>
                        <p className="recolha-agendar-modal__agenda-meta">
                          {item.clientName ?? 'Cliente'} · {item.location ?? '—'}
                        </p>
                        <p className="recolha-agendar-modal__agenda-meta">
                          {taskTypeLabel(item.taskType)} · {formatPeriodoLabel(item.periodo)}
                        </p>
                      </div>
                    </article>
                  </li>
                ))}
                <li className="recolha-agendar-modal__slot-group">
                  <button
                    type="button"
                    className={`recolha-agendar-modal__insert${insertIndex === agenda.length ? ' recolha-agendar-modal__insert--active' : ''}`}
                    aria-pressed={insertIndex === agenda.length}
                    disabled={submitting || agendaLoading}
                    onClick={() => setInsertIndex(agenda.length)}
                  >
                    {insertIndex === agenda.length
                      ? 'Inserir pedido aqui'
                      : agenda.length === 0
                        ? 'Inserir como primeira recolha do dia'
                        : 'Inserir no fim do dia'}
                  </button>
                  {insertIndex === agenda.length ? (
                    <article className="recolha-agendar-modal__preview" aria-label="Pedido a agendar">
                      <p className="recolha-agendar-modal__preview-tag">Novo pedido</p>
                      <p className="recolha-agendar-modal__preview-title">{pedido.id}</p>
                      <p className="recolha-agendar-modal__preview-meta">
                        {pedido.location} · {formatPeriodoLabel(pedido.periodo)}
                        {hasTroca ? ' · Recolha + entrega' : ''}
                      </p>
                    </article>
                  ) : null}
                </li>
              </ol>
            </section>
          ) : null}
        </div>

        <footer className="recolha-agendar-modal__footer">
          <button
            type="button"
            className="recolha-agendar-modal__confirm"
            disabled={
              submitting ||
              !operadorId ||
              !dataIso ||
              operadoresLoading ||
              agendaLoading ||
              (needsEntregaContentor &&
                (!entregaContentorId || contentoresLoading || (hasTroca && recolhaMeta.loading)))
            }
            onClick={handleConfirm}
          >
            {submitting ? 'A agendar…' : 'Confirmar agendamento'}
          </button>
          <button type="button" className="recolha-agendar-modal__cancel" disabled={submitting} onClick={onClose}>
            Cancelar
          </button>
        </footer>
      </div>
    </div>
  )
}
