import { useCallback, useEffect, useState } from 'react'
import {
  faComments,
  faHouseChimney,
  faRecycle,
  faUsers,
} from '@fortawesome/pro-light-svg-icons'
import logoSoiloop from '../../../assets/figma-operador/logo-soiloop.png'
import './Admin.css'
import AdminDrawerMenu from '../../../components/AdminDrawerMenu/AdminDrawerMenu.jsx'
import PageHeader from '../../../components/PageHeader/PageHeader.jsx'
import FloatingPrimaryButton from '../../../components/FloatingPrimaryButton/FloatingPrimaryButton.jsx'
import BottomNav from '../../../components/BottomNav/BottomNav.jsx'
import { IconBarcodeScan, IconContentor } from '../../../components/icons/icons.jsx'
import AdminHome from './AdminHome.jsx'
import { readAdminNavId, setAppHash } from '../../../lib/appRoute.js'
import Contentores from './Contentores/Contentores.jsx'
import Clientes from './Clientes/Clientes.jsx'

const ADMIN_BOTTOM_NAV_ITEMS = [
  { id: 'recolhas', label: 'Recolhas', icon: faRecycle },
  {
    id: 'contentores',
    label: 'Contentores',
    iconNode: <IconContentor className="bottom-nav__icon bottom-nav__icon--contentor" />,
  },
  { id: 'dashboard', label: 'Dashboard', icon: faHouseChimney },
  { id: 'clientes', label: 'Clientes', icon: faUsers },
  { id: 'tickets', label: 'Tickets', icon: faComments },
]

const PLACEHOLDER_LABELS = {
  recolhas: 'Recolhas',
  tickets: 'Tickets',
}

/**
 * Shell admin: menu lateral, header, barra inferior e vistas por separador.
 */
export default function Admin({ onLogout, userName, userRole, headerLogoSrc }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [navActiveId, setNavActiveId] = useState(() => readAdminNavId())

  useEffect(() => {
    function syncFromHash() {
      setNavActiveId(readAdminNavId())
    }
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  const selectNav = useCallback((id) => {
    setNavActiveId(id)
    setAppHash('admin', id)
  }, [])

  const drawerRoleLabel =
    typeof userRole === 'string' && userRole.trim() ? userRole.trim() : 'A sincronizar…'

  function handleDrawerNavigate(actionId) {
    if (actionId === 'clientes') selectNav('clientes')
    else if (actionId === 'recolhas') selectNav('recolhas')
    else if (actionId === 'contentores') selectNav('contentores')
    else if (actionId === 'tickets') selectNav('tickets')
    else if (actionId === 'gestao') selectNav('dashboard')
  }

  function renderMain() {
    if (navActiveId === 'contentores') return <Contentores />
    if (navActiveId === 'clientes') return <Clientes />
    if (navActiveId === 'dashboard') return <AdminHome />
    const label = PLACEHOLDER_LABELS[navActiveId]
    if (label) {
      return (
        <p className="admin-dashboard__placeholder">
          A secção <strong>{label}</strong> estará disponível em breve.
        </p>
      )
    }
    return <AdminHome />
  }

  return (
    <div className="admin-dashboard">
      <AdminDrawerMenu
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
          menuAriaControls="admin-drawer-panel"
          onMenuClick={() => setMenuOpen((o) => !o)}
        />
      </div>

      <main className="admin-dashboard__main">{renderMain()}</main>

      {navActiveId === 'dashboard' ? (
        <FloatingPrimaryButton
          variant="operador"
          label="Processar"
          onClick={() => {}}
          icon={<IconBarcodeScan />}
        />
      ) : null}

      <BottomNav
        variant="admin"
        items={ADMIN_BOTTOM_NAV_ITEMS}
        activeId={navActiveId}
        onSelect={selectNav}
      />
    </div>
  )
}
