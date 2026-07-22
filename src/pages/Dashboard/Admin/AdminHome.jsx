import { useCallback, useEffect, useState } from 'react'
import { faComments, faRecycle } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import SectionTitleWithIcon from '../../../components/SectionTitleWithIcon/SectionTitleWithIcon.jsx'
import CollectionCard from '../../../components/CollectionCard/CollectionCard.jsx'
import RecolhaAgendarModal from '../../../components/RecolhaAgendarModal/RecolhaAgendarModal.jsx'
import { IconChevronRight } from '../../../components/icons/icons.jsx'
import { setAppHash } from '../../../lib/appRoute.js'
import {
  fetchStrapiAdminMovimentosPedido,
  pedidoAdminBadgeLabel,
  pedidoHasTroca,
  pedidoIsEntregaSimples,
} from '../../../lib/strapiMovimentos.js'
import { fetchStrapiTickets } from '../../../lib/strapiTickets.js'
import { TICKET_STATUS_LABEL } from '../../../lib/ticketStatus.js'

const DASHBOARD_PREVIEW_LIMIT = 4

function pedidoKey(item) {
  return item.pedidoGroupKey ?? item.movimentoKey ?? `${item.id}-${item.taskType}`
}

function pedidoCollectionLabel(item) {
  if (pedidoHasTroca(item)) {
    const cid = item.recolhaContentorCid ?? item.id
    if (cid && cid !== 'Não definido') return cid
  }
  if (item.id && item.id !== 'Não definido') return item.id
  if (pedidoIsEntregaSimples(item)) {
    const litros = item.entregaLitrosLabel ?? item.pedidoLitrosLabel
    return litros ? `Entrega · ${litros}` : 'Entrega'
  }
  return item.id ?? '—'
}

function takeLatestPedidos(rows) {
  return [...rows]
    .sort((a, b) => (b.dateSortValue ?? 0) - (a.dateSortValue ?? 0))
    .slice(0, DASHBOARD_PREVIEW_LIMIT)
}

function takeLatestTickets(rows) {
  return rows.slice(0, DASHBOARD_PREVIEW_LIMIT)
}

/** Dashboard admin (pedidos por aprovar + tickets). */
export default function AdminHome() {
  const [pedidos, setPedidos] = useState([])
  const [tickets, setTickets] = useState([])
  const [pedidosLoading, setPedidosLoading] = useState(true)
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [pedidosError, setPedidosError] = useState(null)
  const [ticketsError, setTicketsError] = useState(null)
  const [pedidoAgendar, setPedidoAgendar] = useState(null)

  const loadPedidos = useCallback(() => {
    setPedidosLoading(true)
    setPedidosError(null)
    return fetchStrapiAdminMovimentosPedido()
      .then((rows) => {
        setPedidos(takeLatestPedidos(rows))
      })
      .catch((err) => {
        setPedidosError(err instanceof Error ? err.message : 'Não foi possível carregar os pedidos.')
        setPedidos([])
      })
      .finally(() => {
        setPedidosLoading(false)
      })
  }, [])

  const loadTickets = useCallback(() => {
    setTicketsLoading(true)
    setTicketsError(null)
    return fetchStrapiTickets()
      .then((rows) => {
        setTickets(takeLatestTickets(rows))
      })
      .catch((err) => {
        setTicketsError(err instanceof Error ? err.message : 'Não foi possível carregar os tickets.')
        setTickets([])
      })
      .finally(() => {
        setTicketsLoading(false)
      })
  }, [])

  useEffect(() => {
    loadPedidos()
    loadTickets()
  }, [loadPedidos, loadTickets])

  function handleAgendarSuccess() {
    setPedidoAgendar(null)
    loadPedidos()
  }

  return (
    <>
      <section className="admin-dashboard__section" aria-labelledby="sec-pedidos">
        <div className="admin-dashboard__section-head">
          <SectionTitleWithIcon
            id="sec-pedidos"
            title="Pedidos de Recolha"
            icon={faRecycle}
            iconSize="large"
            titleTone="swapped"
          />
          <button
            type="button"
            className="admin-dashboard__see-all"
            onClick={() => setAppHash('admin', 'recolhas')}
          >
            Ver todos
          </button>
        </div>
        <div className="admin-dashboard__cards">
          {pedidosLoading ? (
            <p className="admin-dashboard__status" role="status">
              A carregar pedidos…
            </p>
          ) : null}

          {!pedidosLoading && pedidosError && pedidos.length === 0 ? (
            <p className="admin-dashboard__status admin-dashboard__status--error" role="alert">
              {pedidosError}
            </p>
          ) : null}

          {!pedidosLoading && !pedidosError && pedidos.length === 0 ? (
            <div className="admin-dashboard__empty-card" role="status">
              <span className="admin-dashboard__empty-card-icon" aria-hidden>
                <FontAwesomeIcon icon={faRecycle} />
              </span>
              <div className="admin-dashboard__empty-card-body">
                <p className="admin-dashboard__empty-card-title">Sem pedidos por aprovar</p>
                <p className="admin-dashboard__empty-card-text">
                  Quando chegarem novos pedidos de recolha, aparecem aqui.
                </p>
              </div>
            </div>
          ) : null}

          {!pedidosLoading && pedidos.length > 0
            ? pedidos.map((item) => (
                <button
                  key={pedidoKey(item)}
                  type="button"
                  className="admin-dashboard__pick"
                  aria-label={`Agendar pedido ${item.clientName ? `${item.clientName}, ` : ''}${item.id}`}
                  onClick={() => setPedidoAgendar(item)}
                >
                  <CollectionCard
                    collectionId={pedidoCollectionLabel(item)}
                    clientName={item.clientName}
                    location={item.location}
                    locationPrefix={item.locationPrefix}
                    locationDetail={item.locationDetail}
                    status={item.status}
                    scheduledAt={item.scheduledAt}
                    binNumber={item.binNumber}
                    taskType={item.taskType}
                    badgeLabel={pedidoAdminBadgeLabel(item)}
                    showEdit={false}
                    showDelete={false}
                  />
                </button>
              ))
            : null}
        </div>
      </section>

      <section className="admin-dashboard__section" aria-labelledby="sec-tickets">
        <div className="admin-dashboard__section-head">
          <SectionTitleWithIcon
            id="sec-tickets"
            title="Tickets para si"
            icon={faComments}
            iconSize="large"
          />
          <button
            type="button"
            className="admin-dashboard__see-all"
            onClick={() => setAppHash('admin', 'tickets')}
          >
            Ver todos
          </button>
        </div>
        <ul className="admin-dashboard__ticket-list">
          {ticketsLoading ? (
            <li>
              <p className="admin-dashboard__status" role="status">
                A carregar tickets…
              </p>
            </li>
          ) : null}

          {!ticketsLoading && ticketsError && tickets.length === 0 ? (
            <li>
              <p className="admin-dashboard__status admin-dashboard__status--error" role="alert">
                {ticketsError}
              </p>
            </li>
          ) : null}

          {!ticketsLoading && !ticketsError && tickets.length === 0 ? (
            <li>
              <div className="admin-dashboard__empty-card" role="status">
                <span className="admin-dashboard__empty-card-icon" aria-hidden>
                  <FontAwesomeIcon icon={faComments} />
                </span>
                <div className="admin-dashboard__empty-card-body">
                  <p className="admin-dashboard__empty-card-title">Sem tickets</p>
                  <p className="admin-dashboard__empty-card-text">
                    Ainda não existem tickets registados.
                  </p>
                </div>
              </div>
            </li>
          ) : null}

          {!ticketsLoading && tickets.length > 0
            ? tickets.map((ticket) => (
                <li key={ticket.id}>
                  <article className="admin-ticket-card">
                    <div className="admin-ticket-card__main">
                      <p className="admin-ticket-card__title">{ticket.title}</p>
                      <p className="admin-ticket-card__client">
                        <span className="admin-ticket-card__client-label">Cliente</span>{' '}
                        <span className="admin-ticket-card__client-value">
                          {ticket.location || ticket.clientName || '—'}
                        </span>
                      </p>
                      <p className="admin-ticket-card__ref">
                        <span className="admin-ticket-card__ref-code">#{ticket.ref}</span>{' '}
                        {ticket.date} {ticket.time}
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
                      onClick={() => setAppHash('admin', 'tickets', 'detalhe', ticket.id)}
                    >
                      <IconChevronRight className="admin-ticket-card__chevron-icon" />
                    </button>
                  </article>
                </li>
              ))
            : null}
        </ul>
      </section>

      <RecolhaAgendarModal
        isOpen={pedidoAgendar != null}
        pedido={pedidoAgendar}
        onClose={() => setPedidoAgendar(null)}
        onSuccess={handleAgendarSuccess}
      />
    </>
  )
}
