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
import {
  readAdminNavId,
  readAdminSection,
  readAdminShowProcessarButton,
  setAppHash,
} from '../../../lib/appRoute.js'
import Contentores from './Contentores/Contentores.jsx'
import Clientes from './Clientes/Clientes.jsx'
import Tickets from './Tickets/Tickets.jsx'
import Recolhas from './Recolhas/Recolhas.jsx'
import Admins from './Admins/Admins.jsx'
import Operadores from './Operadores/Operadores.jsx'
import Perfil from '../../Perfil/Perfil.jsx'
import Definicoes from './Definicoes/Definicoes.jsx'

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

/**
 * Shell admin: menu lateral, header, barra inferior e vistas por separador.
 */
export default function Admin({ onLogout, userName, userRole, headerLogoSrc }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [displayName, setDisplayName] = useState(userName)
  const [mainSection, setMainSection] = useState(() => readAdminSection())
  const [navActiveId, setNavActiveId] = useState(() => readAdminNavId())
  const [showProcessar, setShowProcessar] = useState(() => readAdminShowProcessarButton())

  useEffect(() => {
    setDisplayName(userName)
  }, [userName])

  useEffect(() => {
    function syncFromHash() {
      setMainSection(readAdminSection())
      setNavActiveId(readAdminNavId())
      setShowProcessar(readAdminShowProcessarButton())
    }
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  const selectNav = useCallback((id) => {
    setMainSection(id)
    setNavActiveId(id)
    setAppHash('admin', id)
    setShowProcessar(readAdminShowProcessarButton())
  }, [])

  const drawerRoleLabel =
    typeof userRole === 'string' && userRole.trim() ? userRole.trim() : 'A sincronizar…'

  function handleDrawerNavigate(actionId) {
    if (actionId === 'clientes') selectNav('clientes')
    else if (actionId === 'recolhas') selectNav('recolhas')
    else if (actionId === 'contentores') selectNav('contentores')
    else if (actionId === 'tickets') selectNav('tickets')
    else if (actionId === 'gestao') selectNav('dashboard')
    else if (actionId === 'admins') {
      setMainSection('admins')
      setAppHash('admin', 'admins')
      setShowProcessar(readAdminShowProcessarButton())
    } else if (actionId === 'operadores') {
      setMainSection('operadores')
      setAppHash('admin', 'operadores')
      setShowProcessar(readAdminShowProcessarButton())
    } else if (actionId === 'perfil') {
      setMainSection('perfil')
      setAppHash('admin', 'perfil')
      setShowProcessar(false)
    } else if (actionId === 'definicoes') {
      setMainSection('definicoes')
      setAppHash('admin', 'definicoes')
      setShowProcessar(false)
    }
  }

  function renderMain() {
    if (mainSection === 'perfil') {
      return <Perfil profileKind="admin" onUserUpdated={setDisplayName} />
    }
    if (mainSection === 'definicoes') return <Definicoes />
    if (mainSection === 'recolhas') return <Recolhas />
    if (mainSection === 'contentores') return <Contentores />
    if (mainSection === 'clientes') return <Clientes />
    if (mainSection === 'tickets') return <Tickets />
    if (mainSection === 'admins') return <Admins />
    if (mainSection === 'operadores') return <Operadores />
    if (mainSection === 'dashboard') return <AdminHome />
    return <AdminHome />
  }

  return (
    <div className="admin-dashboard">
      <AdminDrawerMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        userName={displayName}
        userRole={drawerRoleLabel}
        avatarSrc={headerLogoSrc ?? logoSoiloop}
        onLogout={onLogout ?? (() => {})}
        onNavigate={handleDrawerNavigate}
      />

      <div className="admin-dashboard__header-slot">
        <PageHeader
          variant="floating"
          logoSrc={headerLogoSrc ?? logoSoiloop}
          userName={displayName}
          menuOpen={menuOpen}
          menuAriaControls="admin-drawer-panel"
          onLogoClick={() => selectNav('dashboard')}
          onMenuClick={() => setMenuOpen((o) => !o)}
        />
      </div>

      <main className="admin-dashboard__main">{renderMain()}</main>

      {showProcessar ? (
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
