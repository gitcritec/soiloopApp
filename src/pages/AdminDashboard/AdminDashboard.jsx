import { useState } from 'react'
import { faComments, faRecycle } from '@fortawesome/pro-light-svg-icons'
import logoSoiloop from '../../assets/figma-operador/logo-soiloop.png'
import './AdminDashboard.css'
import OperatorDrawerMenu from '../../components/OperatorDrawerMenu/OperatorDrawerMenu.jsx'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import SectionTitleWithIcon from '../../components/SectionTitleWithIcon/SectionTitleWithIcon.jsx'
import CollectionCard from '../../components/CollectionCard/CollectionCard.jsx'
import FloatingPrimaryButton from '../../components/FloatingPrimaryButton/FloatingPrimaryButton.jsx'
import BottomNav from '../../components/BottomNav/BottomNav.jsx'
import {
  IconBarcodeScan,
  IconHome,
  IconRecycle,
  IconTickets,
  IconTrash,
  IconUsersGroup,
  IconChevronRight,
} from '../../components/icons/icons.jsx'
import { MOCK_ADMIN_PEDIDOS, MOCK_ADMIN_TICKETS } from './mockData.js'

const ADMIN_BOTTOM_NAV_ITEMS = [
  { id: 'recolhas', label: 'Recolhas', Icon: IconRecycle },
  { id: 'contentores', label: 'Contentores', Icon: IconTrash },
  { id: 'dashboard', label: 'Dashboard', Icon: IconHome },
  { id: 'clientes', label: 'Clientes', Icon: IconUsersGroup },
  { id: 'tickets', label: 'Tickets', Icon: IconTickets },
]

const TICKET_STATUS_LABEL = {
  'aberto-hoje': 'Aberto',
  'aberto-amanha': 'Aberto',
  respondido: 'Respondido',
}

/**
 * Painel principal para utilizadores com role Admin no Strapi (Users & Permissions).
 * @param {object} props
 * @param {() => void} props.onLogout
 * @param {string} props.userName
 * @param {string|null|undefined} props.userRole
 * @param {string|null} [props.headerLogoSrc]
 */
export default function AdminDashboard({ onLogout, userName, userRole, headerLogoSrc }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [navActiveId, setNavActiveId] = useState('dashboard')

  const drawerRoleLabel =
    typeof userRole === 'string' && userRole.trim() ? userRole.trim() : 'A sincronizar…'

  function handleDrawerNavigate(actionId) {
    if (actionId === 'movimentos') setNavActiveId('contentores')
    else if (actionId === 'historico') setNavActiveId('tickets')
    else if (actionId === 'recolhas') setNavActiveId('recolhas')
  }

  return (
    <div className="admin-dashboard">
      <OperatorDrawerMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        userName={userName}
        userRole={drawerRoleLabel}
        avatarSrc={headerLogoSrc ?? logoSoiloop}
        onLogout={onLogout ?? (() => {})}
        onNavigate={handleDrawerNavigate}
      />

      <div className="admin-dashboard__header-slot">
        <PageHeader
          variant="floating"
          logoSrc={headerLogoSrc ?? logoSoiloop}
          userName={userName}
          menuOpen={menuOpen}
          onMenuClick={() => setMenuOpen((o) => !o)}
        />
      </div>

      <main className="admin-dashboard__main">
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
      </main>

      <FloatingPrimaryButton
        variant="operador"
        label="Processar"
        onClick={() => {}}
        icon={<IconBarcodeScan />}
      />
      <BottomNav
        variant="admin"
        items={ADMIN_BOTTOM_NAV_ITEMS}
        activeId={navActiveId}
        onSelect={setNavActiveId}
      />
    </div>
  )
}
