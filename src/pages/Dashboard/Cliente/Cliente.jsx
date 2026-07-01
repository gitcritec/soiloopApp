import { useCallback, useEffect, useState } from 'react'
import {
  faComments,
  faHouseChimney,
  faPlus,
  faRecycle,
} from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import logoSoiloop from '../../../assets/figma-operador/logo-soiloop.png'
import './Cliente.css'
import ClienteDrawerMenu from './ClienteDrawerMenu.jsx'
import PageHeader from '../../../components/PageHeader/PageHeader.jsx'
import FloatingPrimaryButton from '../../../components/FloatingPrimaryButton/FloatingPrimaryButton.jsx'
import BottomNav from '../../../components/BottomNav/BottomNav.jsx'
import { IconContentor } from '../../../components/icons/icons.jsx'
import ClienteHome from './ClienteHome.jsx'
import Tickets from './Tickets/Tickets.jsx'
import {
  readClienteNavId,
  readClienteShowCriarTicketButton,
  setAppHash,
} from '../../../lib/appRoute.js'

const CLIENTE_BOTTOM_NAV_ITEMS = [
  { id: 'pedidos', label: 'Pedidos', icon: faRecycle },
  {
    id: 'contentores',
    label: 'Contentores',
    iconNode: <IconContentor className="bottom-nav__icon bottom-nav__icon--contentor" />,
  },
  { id: 'dashboard', label: 'Dashboard', icon: faHouseChimney },
  { id: 'tickets', label: 'Tickets', icon: faComments },
]

const PLACEHOLDER_LABELS = {
  pedidos: 'Pedidos',
  contentores: 'Contentores',
}

/** Shell cliente: header, menu, barra inferior e vistas por separador. */
export default function Cliente({ onLogout, userName, userRole, headerLogoSrc }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [navActiveId, setNavActiveId] = useState(() => readClienteNavId())
  const [showCriarTicket, setShowCriarTicket] = useState(() => readClienteShowCriarTicketButton())

  useEffect(() => {
    function syncFromHash() {
      setNavActiveId(readClienteNavId())
      setShowCriarTicket(readClienteShowCriarTicketButton())
    }
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  const selectNav = useCallback((id) => {
    setNavActiveId(id)
    setAppHash('cliente', id)
    setShowCriarTicket(readClienteShowCriarTicketButton())
  }, [])

  const drawerRoleLabel =
    typeof userRole === 'string' && userRole.trim() ? userRole.trim() : 'Cliente'

  function handleDrawerNavigate(actionId) {
    if (actionId === 'tickets') selectNav('tickets')
    else if (actionId === 'pedidos') selectNav('pedidos')
    else if (actionId === 'contentores') selectNav('contentores')
    else if (actionId === 'gestao') selectNav('dashboard')
  }

  function openCriarTicket() {
    setAppHash('cliente', 'tickets', 'criar')
    setShowCriarTicket(false)
  }

  function renderMain() {
    if (navActiveId === 'tickets') return <Tickets />
    if (navActiveId === 'dashboard') return <ClienteHome />
    const label = PLACEHOLDER_LABELS[navActiveId]
    if (label) {
      return (
        <p className="cliente-dashboard__placeholder">
          A secção <strong>{label}</strong> estará disponível em breve.
        </p>
      )
    }
    return <ClienteHome />
  }

  return (
    <div className="cliente-dashboard">
      <ClienteDrawerMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        userName={userName}
        userRole={drawerRoleLabel}
        avatarSrc={headerLogoSrc ?? logoSoiloop}
        onLogout={onLogout ?? (() => {})}
        onNavigate={handleDrawerNavigate}
      />

      <div className="cliente-dashboard__header-slot">
        <PageHeader
          variant="floating"
          logoSrc={headerLogoSrc ?? logoSoiloop}
          userName={userName}
          menuOpen={menuOpen}
          menuAriaControls="cliente-drawer-panel"
          onMenuClick={() => setMenuOpen((o) => !o)}
        />
      </div>

      <main className="cliente-dashboard__main">{renderMain()}</main>

      {showCriarTicket ? (
        <FloatingPrimaryButton
          variant="operador"
          label="Criar Ticket"
          onClick={openCriarTicket}
          icon={<FontAwesomeIcon icon={faPlus} aria-hidden />}
        />
      ) : null}

      <BottomNav
        variant="admin"
        items={CLIENTE_BOTTOM_NAV_ITEMS}
        activeId={navActiveId}
        onSelect={selectNav}
      />
    </div>
  )
}
