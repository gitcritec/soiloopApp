import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  faMagnifyingGlass,
  faShuffle,
  faSliders,
} from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ticketsHero from '../../../../assets/figma-cliente/tickets-hero.svg'
import { IconChevronRight } from '../../../../components/icons/icons.jsx'
import {
  fetchStrapiTicketDetail,
  fetchStrapiTicketsMine,
  mergeTicketUpdates,
  sendClienteTicketMessage,
} from '../../../../lib/strapiTickets.js'
import { TICKET_STATUS_LABEL } from '../../../../lib/ticketStatus.js'
import {
  readClienteTicketsId,
  readClienteTicketsView,
  setAppHash,
} from '../../../../lib/appRoute.js'
import TicketCriar from './TicketCriar.jsx'
import TicketDetalhe from './TicketDetalhe.jsx'
import TicketSucesso from './TicketSucesso.jsx'
import './Tickets.css'

/** Tickets do cliente — listagem, criar, detalhe, mensagem e sucesso. */
export default function Tickets() {
  const [view, setView] = useState(() => readClienteTicketsView())
  const [activeId, setActiveId] = useState(() => readClienteTicketsId())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successRef, setSuccessRef] = useState(null)

  const loadList = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    return fetchStrapiTicketsMine()
      .then((rows) => setItems(rows))
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar os tickets.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    function syncFromHash() {
      setView(readClienteTicketsView())
      setActiveId(readClienteTicketsId())
    }
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  const activeTicket = useMemo(
    () => items.find((item) => item.id === activeId) ?? null,
    [items, activeId],
  )

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const haystack = [item.ref, item.title, item.location, item.message, TICKET_STATUS_LABEL[item.status]]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [items, search])

  const goToList = useCallback(() => {
    setView('list')
    setActiveId(null)
    setActionError(null)
    setSuccessRef(null)
    setAppHash('cliente', 'tickets')
  }, [])

  const openDetail = useCallback((id) => {
    setView('detail')
    setActiveId(id)
    setActionError(null)
    setAppHash('cliente', 'tickets', 'detalhe', id)
  }, [])

  function handleCreateSuccess(created) {
    setItems((prev) => [created, ...prev])
    setSuccessRef(created.ref)
    setActiveId(created.id)
    setView('success')
    setAppHash('cliente', 'tickets', 'sucesso', created.id)
  }

  async function handleMessageSubmit({ text, file }) {
    if (!activeTicket) return
    setSubmitting(true)
    setActionError(null)
    try {
      const updated = await sendClienteTicketMessage(activeTicket.id, { text, file })
      setItems((prev) =>
        prev.map((item) =>
          item.id === updated.id ? mergeTicketUpdates(item, updated) : item,
        ),
      )
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível enviar a mensagem.')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if ((view === 'detail' || view === 'message' || view === 'success') && activeId && !loading && !activeTicket) {
      goToList()
    }
  }, [view, activeId, activeTicket, loading, goToList])

  useEffect(() => {
    if (view === 'message' && activeId) {
      openDetail(activeId)
    }
  }, [view, activeId, openDetail])

  useEffect(() => {
    if (view !== 'detail' || !activeId) return undefined

    let cancelled = false
    let inFlight = false
    let intervalId = null
    const POLL_MS = 15000

    async function refreshTicket() {
      if (cancelled || inFlight || document.visibilityState === 'hidden') return
      inFlight = true
      try {
        const fresh = await fetchStrapiTicketDetail(activeId)
        if (cancelled || !fresh) return
        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== fresh.id) return item
            return mergeTicketUpdates(item, fresh)
          }),
        )
      } finally {
        inFlight = false
      }
    }

    function stopPolling() {
      if (intervalId != null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }

    function startPolling() {
      stopPolling()
      refreshTicket()
      intervalId = window.setInterval(refreshTicket, POLL_MS)
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') startPolling()
      else stopPolling()
    }

    if (document.visibilityState === 'visible') startPolling()
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      stopPolling()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [view, activeId])

  if (view === 'create') {
    return <TicketCriar onCancel={goToList} onSuccess={handleCreateSuccess} />
  }

  if (view === 'success' && activeTicket) {
    return (
      <TicketSucesso
        ticketRef={successRef ?? activeTicket.ref}
        ticketTitle={activeTicket.title}
        onViewDetail={() => openDetail(activeTicket.id)}
        onBackToList={goToList}
      />
    )
  }

  if (view === 'detail' && activeTicket) {
    return (
      <TicketDetalhe
        ticket={activeTicket}
        error={actionError}
        submitting={submitting}
        onBack={goToList}
        onSubmit={handleMessageSubmit}
      />
    )
  }

  if (view === 'message' && activeId) {
    return null
  }

  return (
    <div className="cliente-tickets">
      <div className="cliente-tickets__hero-wrap">
        <img src={ticketsHero} alt="" className="cliente-tickets__hero" width={353} height={120} />
      </div>

      <div className="cliente-tickets__toolbar">
        <label className="cliente-tickets__search">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="cliente-tickets__search-icon" aria-hidden />
          <input
            type="search"
            className="cliente-tickets__search-input"
            placeholder="Pesquisar"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Pesquisar tickets"
          />
        </label>
        <button type="button" className="cliente-tickets__tool-btn" aria-label="Ordenar">
          <FontAwesomeIcon icon={faShuffle} className="cliente-tickets__tool-icon" aria-hidden />
        </button>
        <button type="button" className="cliente-tickets__tool-btn" aria-label="Filtrar">
          <FontAwesomeIcon icon={faSliders} className="cliente-tickets__tool-icon" aria-hidden />
        </button>
      </div>

      {loading ? (
        <p className="cliente-tickets__status" role="status">
          A carregar tickets…
        </p>
      ) : null}

      {!loading && loadError && items.length === 0 ? (
        <p className="cliente-tickets__status cliente-tickets__status--error" role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && !loadError && items.length === 0 ? (
        <p className="cliente-tickets__status">
          Ainda não tem tickets. Use o botão <strong>Criar Ticket</strong> para abrir um pedido.
        </p>
      ) : null}

      {!loading && items.length > 0 && filteredItems.length === 0 ? (
        <p className="cliente-tickets__status">Nenhum ticket corresponde à pesquisa.</p>
      ) : null}

      {!loading && filteredItems.length > 0 ? (
        <ul className="cliente-tickets__list">
          {filteredItems.map((ticket) => (
            <li key={ticket.id}>
              <article className="cliente-ticket-card">
                <div className="cliente-ticket-card__main">
                  <p className="cliente-ticket-card__title">{ticket.title}</p>
                  <p className="cliente-ticket-card__client">
                    <span className="cliente-ticket-card__client-label">Localização</span>{' '}
                    <span className="cliente-ticket-card__client-value">{ticket.location}</span>
                  </p>
                  <p className="cliente-ticket-card__ref">
                    <span className="cliente-ticket-card__ref-code">#{ticket.ref}</span> {ticket.date}{' '}
                    {ticket.time}
                  </p>
                </div>
                <span
                  className={`cliente-ticket-card__badge cliente-ticket-card__badge--${ticket.status}`}
                >
                  {TICKET_STATUS_LABEL[ticket.status] ?? ticket.status}
                </span>
                <button
                  type="button"
                  className="cliente-ticket-card__chevron"
                  aria-label={`Abrir ticket ${ticket.ref}`}
                  onClick={() => openDetail(ticket.id)}
                >
                  <IconChevronRight className="cliente-ticket-card__chevron-icon" />
                </button>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
