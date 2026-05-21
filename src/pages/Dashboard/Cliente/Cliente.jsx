import { useCallback, useEffect, useState } from 'react'
import {
  faClipboardList,
  faHouseChimney,
  faRecycle,
} from '@fortawesome/pro-light-svg-icons'
import logoSoiloop from '../../../assets/figma-operador/logo-soiloop.png'
import './Cliente.css'
import PageHeader from '../../../components/PageHeader/PageHeader.jsx'
import SectionTitleWithIcon from '../../../components/SectionTitleWithIcon/SectionTitleWithIcon.jsx'
import CollectionCard from '../../../components/CollectionCard/CollectionCard.jsx'
import BottomNav from '../../../components/BottomNav/BottomNav.jsx'
import OperadorStatsSummary from '../../../components/OperadorStatsSummary/OperadorStatsSummary.jsx'
import LocationMapModal from '../../../components/LocationMapModal/LocationMapModal.jsx'
import { IconContentor } from '../../../components/icons/icons.jsx'
import { readClienteNavId, setAppHash } from '../../../lib/appRoute.js'
import { formatLocationQuery } from '../../../lib/locationQuery.js'
import { fetchStrapiClienteMovimentosAgendados } from '../../../lib/strapiMovimentos.js'
import {
  MOCK_CLIENT_CONTAINERS,
  MOCK_CLIENT_NAME,
  MOCK_CLIENT_REQUESTS,
  MOCK_CLIENT_STATS,
} from './mockData.js'

const CLIENT_BOTTOM_NAV_ITEMS = [
  { id: 'pedidos', label: 'Pedidos', icon: faClipboardList },
  { id: 'dashboard', label: 'Dashboard', icon: faHouseChimney },
  {
    id: 'contentores',
    label: 'Contentores',
    iconNode: <IconContentor className="bottom-nav__icon bottom-nav__icon--contentor" />,
  },
]

export default function Cliente({
  onLogout,
  userName = MOCK_CLIENT_NAME,
  userRole = 'Cliente',
  headerLogoSrc,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [navActiveId, setNavActiveId] = useState(() => readClienteNavId())
  const [locationMap, setLocationMap] = useState(null)
  const [clientRequests, setClientRequests] = useState(MOCK_CLIENT_REQUESTS)

  useEffect(() => {
    function syncFromHash() {
      setNavActiveId(readClienteNavId())
    }
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  const selectNav = useCallback((id) => {
    setNavActiveId(id)
    setAppHash('cliente', id)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchStrapiClienteMovimentosAgendados(MOCK_CLIENT_REQUESTS)
      .then((rows) => {
        if (!cancelled) setClientRequests(rows)
      })
      .catch(() => {
        if (!cancelled) setClientRequests(MOCK_CLIENT_REQUESTS)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function openCollectionLocation(item) {
    const query = formatLocationQuery(item)
    if (!query) return
    setLocationMap({
      query,
      title: item.id,
      subtitle: query,
    })
  }

  const shouldShowRequests = navActiveId === 'dashboard' || navActiveId === 'pedidos'
  const shouldShowContainers = navActiveId === 'dashboard' || navActiveId === 'contentores'
  const drawerRoleLabel =
    typeof userRole === 'string' && userRole.trim() ? userRole.trim() : 'Cliente'

  return (
    <div className="cliente-dashboard">
      <LocationMapModal
        isOpen={Boolean(locationMap)}
        onClose={() => setLocationMap(null)}
        query={locationMap?.query ?? ''}
        title={locationMap?.title}
        subtitle={locationMap?.subtitle}
      />

      <div className="cliente-dashboard__header-slot">
        <PageHeader
          variant="floating"
          logoSrc={headerLogoSrc ?? logoSoiloop}
          userName={userName}
          menuOpen={menuOpen}
          menuAriaControls="cliente-menu-panel"
          onMenuClick={() => setMenuOpen((o) => !o)}
        />
      </div>

      {menuOpen ? (
        <aside
          id="cliente-menu-panel"
          className="cliente-dashboard__menu"
          aria-label="Menu do cliente"
        >
          <p className="cliente-dashboard__menu-name">{userName}</p>
          <p className="cliente-dashboard__menu-role">{drawerRoleLabel}</p>
          <button
            type="button"
            className="cliente-dashboard__menu-logout"
            onClick={onLogout ?? (() => {})}
          >
            Terminar sessão
          </button>
        </aside>
      ) : null}

      <main className="cliente-dashboard__main">
        {shouldShowRequests ? (
          <section className="cliente-dashboard__section" aria-labelledby="cliente-sec-pedidos">
            <SectionTitleWithIcon
              id="cliente-sec-pedidos"
              title="Meus Pedidos"
              icon={faRecycle}
              iconSize="large"
              titleTone="swapped"
            />
            <div className="cliente-dashboard__cards">
              {clientRequests.map((item) => (
                <CollectionCard
                  key={item.id}
                  collectionId={item.id}
                  location={item.location}
                  locationPrefix={item.locationPrefix}
                  locationDetail={item.locationDetail}
                  status={item.status}
                  scheduledAt={item.scheduledAt}
                  binNumber={item.binNumber}
                  taskType={item.taskType}
                  onLocationClick={() => openCollectionLocation(item)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {shouldShowContainers ? (
          <section className="cliente-dashboard__section" aria-labelledby="cliente-sec-contentores">
            <SectionTitleWithIcon
              id="cliente-sec-contentores"
              title="Meu Contentores"
              icon={faRecycle}
              iconSize="large"
            />
            <div className="cliente-dashboard__cards">
              {MOCK_CLIENT_CONTAINERS.map((item) => (
                <CollectionCard
                  key={item.id}
                  collectionId={item.id}
                  location={item.location}
                  locationPrefix={item.locationPrefix}
                  locationDetail={item.locationDetail}
                  status={item.status}
                  scheduledAt={item.scheduledAt}
                  binNumber={item.binNumber}
                  taskType={item.taskType}
                  onLocationClick={() => openCollectionLocation(item)}
                />
              ))}
            </div>
          </section>
        ) : null}

        <OperadorStatsSummary
          recolhasHoje={MOCK_CLIENT_STATS.recolhasHoje}
          recolhasAgendadas={MOCK_CLIENT_STATS.recolhasAgendadas}
          contentoresRecolhidos={MOCK_CLIENT_STATS.contentoresRecolhidos}
          kmPercorridos={MOCK_CLIENT_STATS.kmPercorridos}
        />
      </main>
     
      <BottomNav
        variant="operador"
        items={CLIENT_BOTTOM_NAV_ITEMS}
        activeId={navActiveId}
        onSelect={selectNav}
      />
    </div>
  )
}
