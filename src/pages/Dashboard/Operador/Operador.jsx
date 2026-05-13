import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowsRotate,
  faBarcodeRead,
  faHouseChimney,
  faRecycle,
} from '@fortawesome/pro-light-svg-icons'
import { faClock as faClockSharp } from '@fortawesome/sharp-light-svg-icons'
import logoSoiloop from '../../../assets/figma-operador/logo-soiloop.png'
import './Operador.css'
import {
  fetchStrapiCurrentUser,
  getStoredStrapiRoleLabel,
  getStoredStrapiUsername,
  normalizeStrapiUserRole,
  persistStrapiUserCache,
  persistStrapiUsername,
} from '../../../lib/strapiAuth.js'
import { fetchStrapiGlobalLogoSmallUrl } from '../../../lib/strapiGlobal.js'
import PageHeader from '../../../components/PageHeader/PageHeader.jsx'
import SectionTitleWithIcon from '../../../components/SectionTitleWithIcon/SectionTitleWithIcon.jsx'
import CollectionCard from '../../../components/CollectionCard/CollectionCard.jsx'
import FloatingPrimaryButton from '../../../components/FloatingPrimaryButton/FloatingPrimaryButton.jsx'
import BottomNav from '../../../components/BottomNav/BottomNav.jsx'
import OperadorStatsSummary from '../../../components/OperadorStatsSummary/OperadorStatsSummary.jsx'
import OperatorDrawerMenu from '../../../components/OperatorDrawerMenu/OperatorDrawerMenu.jsx'
import {
  MOCK_DAY_COLLECTIONS,
  MOCK_OPERATOR_NAME,
  MOCK_OPERATOR_STATS,
  MOCK_UPCOMING_COLLECTIONS,
} from './mockData.js'

const OPERATOR_BOTTOM_NAV_ITEMS = [
  { id: 'movimentos', label: 'Movimentos', icon: faArrowsRotate },
  { id: 'dashboard', label: 'Dashboard', icon: faHouseChimney },
  { id: 'historico', label: 'Histórico', icon: faClockSharp },
]

export default function Operador({ onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [navActiveId, setNavActiveId] = useState('dashboard')
  const [headerLogoSrc, setHeaderLogoSrc] = useState(null)
  const [userName, setUserName] = useState(
    () => getStoredStrapiUsername() ?? MOCK_OPERATOR_NAME,
  )
  const [userRole, setUserRole] = useState(() => getStoredStrapiRoleLabel() ?? '')

  useEffect(() => {
    let cancelled = false
    fetchStrapiGlobalLogoSmallUrl().then((url) => {
      if (!cancelled && url) setHeaderLogoSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchStrapiCurrentUser().then((u) => {
      if (cancelled || !u) return
      persistStrapiUserCache(u)
      const name = u.username?.trim() || u.email?.trim()
      if (name) {
        persistStrapiUsername(name)
        setUserName(name)
      }
      const label = normalizeStrapiUserRole(u.role) ?? getStoredStrapiRoleLabel() ?? ''
      setUserRole(label)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function handleDrawerNavigate(actionId) {
    if (actionId === 'movimentos') setNavActiveId('movimentos')
    else if (actionId === 'historico') setNavActiveId('historico')
    else if (actionId === 'recolhas') setNavActiveId('dashboard')
  }

  const drawerRoleLabel =
    (typeof userRole === 'string' && userRole.trim()) || 'A sincronizar…'

  return (
    <div className="operator-dashboard">
      <OperatorDrawerMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        userName={userName}
        userRole={drawerRoleLabel}
        avatarSrc={headerLogoSrc ?? logoSoiloop}
        onLogout={onLogout ?? (() => {})}
        onNavigate={handleDrawerNavigate}
      />

      <div className="operator-dashboard__header-slot">
        <PageHeader
          variant="floating"
          logoSrc={headerLogoSrc ?? logoSoiloop}
          userName={userName}
          menuOpen={menuOpen}
          onMenuClick={() => setMenuOpen((o) => !o)}
        />
      </div>

      <main className="operator-dashboard__main">
        <section className="operator-dashboard__section" aria-labelledby="sec-day">
          <SectionTitleWithIcon
            id="sec-day"
            title="Recolhas do Dia"
            icon={faRecycle}
            iconSize="large"
            titleTone="swapped"
          />
          <div className="operator-dashboard__cards">
            {MOCK_DAY_COLLECTIONS.map((item) => (
              <CollectionCard
                key={item.id}
                collectionId={item.id}
                location={item.location}
                locationPrefix={item.locationPrefix}
                locationDetail={item.locationDetail}
                status={item.status}
                scheduledAt={item.scheduledAt}
                binNumber={item.binNumber}
                onLocationClick={() => {}}
                onScanClick={() => {}}
              />
            ))}
          </div>
        </section>

        <section className="operator-dashboard__section" aria-labelledby="sec-upcoming">
          <SectionTitleWithIcon
            id="sec-upcoming"
            title="Próximas Recolhas"
            icon={faRecycle}
            iconSize="large"
          />
          <div className="operator-dashboard__cards">
            {MOCK_UPCOMING_COLLECTIONS.map((item) => (
              <CollectionCard
                key={item.id}
                collectionId={item.id}
                location={item.location}
                locationPrefix={item.locationPrefix}
                locationDetail={item.locationDetail}
                status={item.status}
                scheduledAt={item.scheduledAt}
                binNumber={item.binNumber}
                onLocationClick={() => {}}
                onScanClick={() => {}}
              />
            ))}
          </div>
        </section>

        <OperadorStatsSummary
          recolhasHoje={MOCK_OPERATOR_STATS.recolhasHoje}
          recolhasAgendadas={MOCK_OPERATOR_STATS.recolhasAgendadas}
          contentoresRecolhidos={MOCK_OPERATOR_STATS.contentoresRecolhidos}
          kmPercorridos={MOCK_OPERATOR_STATS.kmPercorridos}
        />
      </main>

      <FloatingPrimaryButton
        variant="operador"
        label="Processar"
        onClick={() => {}}
        icon={<FontAwesomeIcon icon={faBarcodeRead} aria-hidden />}
      />
      <BottomNav
        variant="operador"
        items={OPERATOR_BOTTOM_NAV_ITEMS}
        activeId={navActiveId}
        onSelect={setNavActiveId}
      />
    </div>
  )
}
