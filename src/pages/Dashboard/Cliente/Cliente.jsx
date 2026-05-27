import { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBell,
  faCircleInfo,
  faClipboardList,
  faComments,
  faGear,
  faHouseChimney,
  faLocationDot,
  faPowerOff,
  faRecycle,
  faClock,
} from '@fortawesome/pro-light-svg-icons'
import logoSoiloop from '../../../assets/figma-operador/logo-soiloop.png'
import './Cliente.css'
import PageHeader from '../../../components/PageHeader/PageHeader.jsx'
import SectionTitleWithIcon from '../../../components/SectionTitleWithIcon/SectionTitleWithIcon.jsx'
import CollectionCard from '../../../components/CollectionCard/CollectionCard.jsx'
import BottomNav from '../../../components/BottomNav/BottomNav.jsx'
import OperadorStatsSummary from '../../../components/OperadorStatsSummary/OperadorStatsSummary.jsx'
import OperatorDrawerMenu from '../../../components/OperatorDrawerMenu/OperatorDrawerMenu.jsx'
import LocationMapModal from '../../../components/LocationMapModal/LocationMapModal.jsx'
import { IconContentor } from '../../../components/icons/icons.jsx'
import { readClienteNavId, setAppHash } from '../../../lib/appRoute.js'
import { formatLocationQuery } from '../../../lib/locationQuery.js'
import {
  fetchStrapiClienteContentoresInstalados,
  fetchStrapiClienteMovimentosAgendados,
} from '../../../lib/strapiMovimentos.js'
import {
  MOCK_CLIENT_CONTAINERS,
  MOCK_CLIENT_NAME,
  MOCK_CLIENT_REQUESTS,
  MOCK_CLIENT_STATS,
} from './mockData.js'

const CLIENT_BOTTOM_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: faHouseChimney },
  { id: 'recolhas', label: 'Recolhas', icon: faRecycle },
  {
    id: 'contentores',
    label: 'Contentores',
    iconNode: <IconContentor className="bottom-nav__icon bottom-nav__icon--contentor" />,
  },
  { id: 'tickets', label: 'Tickets', icon: faComments },
]

const CLIENT_DRAWER_PRIMARY_ITEMS = [
  { id: 'notificacoes', label: 'Notificações', icon: faBell },
  { id: 'pedidos', label: 'Pedidos', icon: faClipboardList },
  { id: 'recolhas', label: 'Recolhas', icon: faRecycle },
  { id: 'tickets', label: 'Tickets', icon: faComments },
  { id: 'historico', label: 'Histórico', icon: faClock },
]

const CLIENT_DRAWER_SECONDARY_ITEMS = [
  { id: 'definicoes', label: 'Definições', icon: faGear },
  { id: 'ajuda', label: 'Ajuda', icon: faCircleInfo },
  { id: 'sair', label: 'Sair', icon: faPowerOff, isLogout: true },
]

function ClienteContentorCard({ item, onLocationClick }) {
  const estadoLabel = item.estadoLabel ?? 'Reutilizável'
  const estadoKey = estadoLabel.toLowerCase().includes('recolha') ? 'em-recolha' : 'reutilizavel'
  const localizacao = [item.locationPrefix, item.locationDetail].filter(Boolean).join(' ')
  const canRequestPickup = item.canRequestPickup !== false

  return (
    <article className="cliente-contentor-card">
      <div className="cliente-contentor-card__icon-col">
        <IconContentor className="cliente-contentor-card__icon" />
      </div>

      <div className="cliente-contentor-card__body">
        <p className="cliente-contentor-card__id">{item.id}</p>
        <p className="cliente-contentor-card__specs">
          <span>{item.qrCode ?? item.id}</span>{' '}
          <strong>{item.litrosLabel ?? item.scheduledAt}</strong>
        </p>
        <p className="cliente-contentor-card__location">{localizacao}</p>
      </div>

      <span className={`cliente-contentor-card__badge cliente-contentor-card__badge--${estadoKey}`}>
        {estadoLabel}
      </span>

      <div className="cliente-contentor-card__actions">
        <button
          type="button"
          className="cliente-contentor-card__btn cliente-contentor-card__btn--location"
          aria-label="Ver localização"
          onClick={onLocationClick}
        >
          <FontAwesomeIcon icon={faLocationDot} aria-hidden />
        </button>
        {canRequestPickup ? (
          <button
            type="button"
            className="cliente-contentor-card__btn cliente-contentor-card__btn--recycle"
            aria-label="Solicitar recolha"
          >
            <FontAwesomeIcon icon={faRecycle} aria-hidden />
          </button>
        ) : null}
      </div>
    </article>
  )
}

export default function Cliente({
  onLogout,
  userName = MOCK_CLIENT_NAME,
  userRole = 'Cliente',
  headerLogoSrc,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [navActiveId, setNavActiveId] = useState(() => readClienteNavId())
  const [locationMap, setLocationMap] = useState(null)
  const [clientRequests, setClientRequests] = useState([])
  const [clientRequestsLoading, setClientRequestsLoading] = useState(true)
  const [clientRequestsError, setClientRequestsError] = useState(false)
  const [clientContainers, setClientContainers] = useState([])
  const [clientContainersLoading, setClientContainersLoading] = useState(true)
  const [clientContainersError, setClientContainersError] = useState(false)

  useEffect(() => {
    function syncFromHash() {
      setNavActiveId(readClienteNavId())
    }
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  useEffect(() => {
    let cancelled = false
    setClientContainersLoading(true)
    setClientContainersError(false)
    fetchStrapiClienteContentoresInstalados(MOCK_CLIENT_CONTAINERS)
      .then((rows) => {
        if (!cancelled) setClientContainers(rows)
      })
      .catch(() => {
        if (!cancelled) {
          setClientContainers([])
          setClientContainersError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setClientContainersLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const selectNav = useCallback((id) => {
    setNavActiveId(id)
    setAppHash('cliente', id)
  }, [])

  useEffect(() => {
    let cancelled = false
    setClientRequestsLoading(true)
    setClientRequestsError(false)
    fetchStrapiClienteMovimentosAgendados(MOCK_CLIENT_REQUESTS)
      .then((rows) => {
        if (!cancelled) setClientRequests(rows)
      })
      .catch(() => {
        if (!cancelled) {
          setClientRequests([])
          setClientRequestsError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setClientRequestsLoading(false)
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

  function handleDrawerNavigate(actionId) {
    if (actionId === 'pedidos') selectNav('recolhas')
    else if (actionId === 'recolhas') selectNav('dashboard')
    else if (actionId === 'tickets') selectNav('tickets')
    else if (actionId === 'historico') selectNav('dashboard')
  }

  const shouldShowRequests = navActiveId === 'dashboard' || navActiveId === 'recolhas'
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

      <OperatorDrawerMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        userName={userName}
        userRole={drawerRoleLabel}
        avatarSrc={headerLogoSrc ?? logoSoiloop}
        onLogout={onLogout ?? (() => {})}
        onNavigate={handleDrawerNavigate}
        primaryItems={CLIENT_DRAWER_PRIMARY_ITEMS}
        secondaryItems={CLIENT_DRAWER_SECONDARY_ITEMS}
      />

      <div className="cliente-dashboard__header-slot">
        <PageHeader
          variant="floating"
          logoSrc={headerLogoSrc ?? logoSoiloop}
          userName={userName}
          menuOpen={menuOpen}
          onMenuClick={() => setMenuOpen((o) => !o)}
        />
      </div>

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
              {clientRequestsLoading ? (
                <p className="cliente-dashboard__state">A carregar pedidos…</p>
              ) : null}
              {!clientRequestsLoading && clientRequestsError ? (
                <p className="cliente-dashboard__state" role="alert">
                  Não foi possível carregar os pedidos.
                </p>
              ) : null}
              {!clientRequestsLoading && !clientRequestsError && clientRequests.length === 0 ? (
                <p className="cliente-dashboard__state">
                  Não existem pedidos.
                </p>
              ) : null}
              {!clientRequestsLoading && !clientRequestsError ? clientRequests.map((item) => (
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
                  requestState={item.estadoKey}
                  onLocationClick={() => openCollectionLocation(item)}
                />
              )) : null}
            </div>
          </section>
        ) : null}

        {shouldShowContainers ? (
          <section className="cliente-dashboard__section" aria-labelledby="cliente-sec-contentores">
            <SectionTitleWithIcon
              id="cliente-sec-contentores"
              title="Meu Contentores"
              icon={<IconContentor className="cliente-dashboard__section-contentor-icon" />}
              iconSize="large"
            />
            <div className="cliente-dashboard__cards">
              {clientContainersLoading ? (
                <p className="cliente-dashboard__state">A carregar contentores…</p>
              ) : null}
              {!clientContainersLoading && clientContainersError ? (
                <p className="cliente-dashboard__state" role="alert">
                  Não foi possível carregar os contentores instalados.
                </p>
              ) : null}
              {!clientContainersLoading && !clientContainersError && clientContainers.length === 0 ? (
                <p className="cliente-dashboard__state">
                  Não existem contentores instalados.
                </p>
              ) : null}
              {!clientContainersLoading && !clientContainersError ? clientContainers.map((item) => (
                <ClienteContentorCard
                  key={item.id}
                  item={item}
                  onLocationClick={() => openCollectionLocation(item)}
                />
              )) : null}
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

      <div className="cliente-dashboard__floating-actions" aria-label="Ações rápidas">
        <button type="button" className="cliente-dashboard__floating-btn cliente-dashboard__floating-btn--primary">
          <FontAwesomeIcon icon={faRecycle} aria-hidden />
          Solicitar Recolha
        </button>
        <button type="button" className="cliente-dashboard__floating-btn cliente-dashboard__floating-btn--secondary">
          <FontAwesomeIcon icon={faComments} aria-hidden />
          Criar Novo Ticket
        </button>
      </div>
     
      <BottomNav
        variant="operador"
        items={CLIENT_BOTTOM_NAV_ITEMS}
        activeId={navActiveId}
        onSelect={selectNav}
      />
    </div>
  )
}
