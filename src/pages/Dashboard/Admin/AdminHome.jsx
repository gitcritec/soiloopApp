import { faComments, faRecycle } from '@fortawesome/pro-light-svg-icons'
import SectionTitleWithIcon from '../../../components/SectionTitleWithIcon/SectionTitleWithIcon.jsx'
import CollectionCard from '../../../components/CollectionCard/CollectionCard.jsx'
import { IconChevronRight } from '../../../components/icons/icons.jsx'
import { MOCK_ADMIN_PEDIDOS, MOCK_ADMIN_TICKETS } from './mockData.js'

const TICKET_STATUS_LABEL = {
  'aberto-hoje': 'Aberto',
  'aberto-amanha': 'Aberto',
  respondido: 'Respondido',
}

/** Dashboard admin (pedidos + tickets). */
export default function AdminHome() {
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
          <button type="button" className="admin-dashboard__see-all">
            Ver todos
          </button>
        </div>
        <div className="admin-dashboard__cards">
          {MOCK_ADMIN_PEDIDOS.map((item) => (
            <CollectionCard
              key={item.id}
              collectionId={item.id}
              location={item.location}
              status={item.status}
              scheduledAt={item.scheduledAt}
              binNumber={item.binNumber}
              primaryAction="edit"
              onEditClick={() => {}}
              onScanClick={() => {}}
            />
          ))}
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
          <button type="button" className="admin-dashboard__see-all">
            Ver todos
          </button>
        </div>
        <ul className="admin-dashboard__ticket-list">
          {MOCK_ADMIN_TICKETS.map((ticket) => (
            <li key={ticket.id}>
              <article className="admin-ticket-card">
                <div className="admin-ticket-card__main">
                  <p className="admin-ticket-card__title">{ticket.title}</p>
                  <p className="admin-ticket-card__client">{ticket.clientLine}</p>
                  <p className="admin-ticket-card__ref">{ticket.refLine}</p>
                </div>
                <span
                  className={`admin-ticket-card__badge admin-ticket-card__badge--${ticket.status}`}
                >
                  {TICKET_STATUS_LABEL[ticket.status]}
                </span>
                <button
                  type="button"
                  className="admin-ticket-card__chevron"
                  aria-label="Abrir ticket"
                >
                  <IconChevronRight className="admin-ticket-card__chevron-icon" />
                </button>
              </article>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
