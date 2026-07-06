import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  faMagnifyingGlass,
} from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ticketsHero from '../../../../assets/figma-cliente/tickets-hero.svg'
import { IconChevronRight } from '../../../../components/icons/icons.jsx'
import {
  closeStrapiTicket,
  fetchStrapiTicketDetail,
  fetchStrapiTickets,
  findTicketById,
  mergeTicketUpdates,
  replyStrapiTicket,
  upsertTicketInList,
} from '../../../../lib/strapiTickets.js'
import {
  readAdminTicketsId,
  readAdminTicketsView,
  setAppHash,
} from '../../../../lib/appRoute.js'
import TicketDetalhe from './TicketDetalhe.jsx'
import { TICKET_STATUS_LABEL } from '../../../../lib/ticketStatus.js'
import './Tickets.css'

function formatClientLine(ticket) {
  return ticket.location
}

/** Listagem, detalhe e resposta de tickets (admin). */
export default function Tickets() {
  const [view, setView] = useState(() => readAdminTicketsView())
  const [activeId, setActiveId] = useState(() => readAdminTicketsId())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadList = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    return fetchStrapiTickets()
      .then((rows) => {
        setItems(rows)
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar os tickets.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    function syncFromHash() {
      setView(readAdminTicketsView())
      setActiveId(readAdminTicketsId())
    }
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  const activeTicket = useMemo(
    () => findTicketById(items, activeId),
    [items, activeId],
  )

  const isDetailRoute = (view === 'detail' || view === 'reply') && Boolean(activeId)

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const haystack = [
        item.ref,
        item.title,
        item.clientName,
        item.location,
        item.message,
        TICKET_STATUS_LABEL[item.status],
      ]
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
    setAppHash('admin', 'tickets')
  }, [])

  const openDetail = useCallback((id) => {
    setView('detail')
    setActiveId(id)
    setActionError(null)
    setAppHash('admin', 'tickets', 'detalhe', id)
  }, [])

  async function handleReplySubmit({ text, file }) {
    if (!activeTicket) return
    setSubmitting(true)
    setActionError(null)
    try {
      const updated = await replyStrapiTicket(activeTicket.id, { text, file })
      setItems((prev) =>
        prev.map((item) =>
          String(item.id) === String(updated.id) ? mergeTicketUpdates(item, updated) : item,
        ),
      )
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível enviar a resposta.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCloseTicket() {
    if (!activeTicket) return
    setActionError(null)
    try {
      const updated = await closeStrapiTicket(activeTicket.id)
      setItems((prev) => prev.map((item) => (String(item.id) === String(updated.id) ? updated : item)))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Não foi possível fechar o ticket.')
    }
  }

  useEffect(() => {
    if (!isDetailRoute || activeTicket) return undefined

    let cancelled = false
    setDetailLoading(true)

    fetchStrapiTicketDetail(activeId)
      .then((fresh) => {
        if (cancelled || !fresh) return
        setItems((prev) => upsertTicketInList(prev, fresh))
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isDetailRoute, activeId, activeTicket])

  useEffect(() => {
    if (isDetailRoute && activeId && !loading && !detailLoading && !activeTicket) {
      goToList()
    }
  }, [isDetailRoute, activeId, activeTicket, loading, detailLoading, goToList])

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
            if (String(item.id) !== String(fresh.id)) return item
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

  useEffect(() => {
    if (view === 'reply' && activeId) {
      openDetail(activeId)
    }
  }, [view, activeId, openDetail])

  if (isDetailRoute && (loading || detailLoading) && !activeTicket) {
    return (
      <p className="admin-tickets__status" role="status">
        A carregar ticket…
      </p>
    )
  }

  if (view === 'detail' && activeTicket) {
    return (
      <TicketDetalhe
        ticket={activeTicket}
        error={actionError}
        submitting={submitting}
        onBack={goToList}
        onSubmit={handleReplySubmit}
        onClose={handleCloseTicket}
      />
    )
  }

  if (view === 'reply' && activeId) {
    return null
  }

  return (
    <div className="admin-tickets">
      <div className="admin-tickets__hero-wrap">
        <img
          src={ticketsHero}
          alt=""
          className="admin-tickets__hero"
          width={353}
          height={120}
        />
      </div>

      <div className="admin-tickets__toolbar">
        <label className="admin-tickets__search">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="admin-tickets__search-icon" aria-hidden />
          <input
            type="search"
            className="admin-tickets__search-input"
            placeholder="Pesquisar"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Pesquisar tickets"
          />
        </label>
      </div>

      {loading ? (
        <p className="admin-tickets__status" role="status">
          A carregar tickets…
        </p>
      ) : null}

      {!loading && loadError && items.length === 0 ? (
        <p className="admin-tickets__status admin-tickets__status--error" role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && !loadError && items.length === 0 ? (
        <p className="admin-tickets__status">Ainda não existem tickets registados.</p>
      ) : null}

      {!loading && items.length > 0 && filteredItems.length === 0 ? (
        <p className="admin-tickets__status">Nenhum ticket corresponde à pesquisa.</p>
      ) : null}

      {!loading && filteredItems.length > 0 ? (
        <ul className="admin-tickets__list">
          {filteredItems.map((ticket) => (
            <li key={ticket.id}>
              <article className="admin-ticket-card">
                <div className="admin-ticket-card__main">
                  <p className="admin-ticket-card__title">{ticket.title}</p>
                  <p className="admin-ticket-card__client">
                    <span className="admin-ticket-card__client-label">Cliente</span>{' '}
                    <span className="admin-ticket-card__client-value">{formatClientLine(ticket)}</span>
                  </p>
                  <p className="admin-ticket-card__ref">
                    <span className="admin-ticket-card__ref-code">#{ticket.ref}</span> {ticket.date}{' '}
                    {ticket.time}
                  </p>
                </div>
                <span
                  className={`admin-ticket-card__badge admin-ticket-card__badge--${ticket.status}`}
                >
                  {TICKET_STATUS_LABEL[ticket.status] ?? ticket.status}
                </span>
                <button
                  type="button"
                  className="admin-ticket-card__chevron"
                  aria-label={`Abrir ticket ${ticket.ref}`}
                  onClick={() => openDetail(ticket.id)}
                >
                  <IconChevronRight className="admin-ticket-card__chevron-icon" />
                </button>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
