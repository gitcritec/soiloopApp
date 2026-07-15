import { useCallback, useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBell,
  faCircleInfo,
  faClipboardList,
  faComments,
  faHouseChimney,
  faPowerOff,
  faRecycle,
  faClock,
  faUser,
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
import Tickets from './Tickets/Tickets.jsx'
import Contentores from './Contentores/Contentores.jsx'
import Recolhas from './Recolhas/Recolhas.jsx'
import {
  readClienteNavId,
  readClienteShowCriarTicketButton,
  readIsProfileSection,
  setAppHash,
} from '../../../lib/appRoute.js'
import { formatLocationQuery } from '../../../lib/locationQuery.js'
import {
  canDeleteMovimentoCliente,
  canEditMovimentoCliente,
  collapseMovimentosPedidoCards,
  createStrapiClienteSolicitacaoRecolha,
  createStrapiClienteSolicitacaoContentor,
  deleteStrapiMovimentosBatch,
  fetchStrapiClienteContentoresInstalados,
  fetchStrapiClienteMovimentosAgendados,
  getPedidoGroupMovimentoKeys,
  updateStrapiMovimentosBatch,
} from '../../../lib/strapiMovimentos.js'
import SolicitarRecolha from './SolicitarRecolha/SolicitarRecolha.jsx'
import SolicitarContentor from './SolicitarContentor/SolicitarContentor.jsx'
import EditarPedido from './EditarPedido/EditarPedido.jsx'
import ApagarPedido from './ApagarPedido/ApagarPedido.jsx'
import HistoricoPedidos from './HistoricoPedidos/HistoricoPedidos.jsx'
import Perfil from '../../Perfil/Perfil.jsx'
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
  { id: 'perfil', label: 'Perfil', icon: faUser },
  { id: 'ajuda', label: 'Ajuda', icon: faCircleInfo },
  { id: 'sair', label: 'Sair', icon: faPowerOff, isLogout: true },
]

export default function Cliente({
  onLogout,
  userName = MOCK_CLIENT_NAME,
  userRole = 'Cliente',
  headerLogoSrc,
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [displayName, setDisplayName] = useState(userName)
  const [navActiveId, setNavActiveId] = useState(() => readClienteNavId())
  const [showPerfil, setShowPerfil] = useState(() => readIsProfileSection('cliente'))
  const [showCriarTicket, setShowCriarTicket] = useState(() => readClienteShowCriarTicketButton())
  const [locationMap, setLocationMap] = useState(null)
  const [clientRequests, setClientRequests] = useState([])
  const [clientRequestsLoading, setClientRequestsLoading] = useState(true)
  const [clientRequestsError, setClientRequestsError] = useState(false)
  const [clientContainers, setClientContainers] = useState([])
  const [clientContainersLoading, setClientContainersLoading] = useState(true)
  const [clientContainersError, setClientContainersError] = useState(false)
  const [recolhaContext, setRecolhaContext] = useState(null)
  const [solicitarContentorOpen, setSolicitarContentorOpen] = useState(false)
  const [editPedidoContext, setEditPedidoContext] = useState(null)
  const [deletePedidoContext, setDeletePedidoContext] = useState(null)

  useEffect(() => {
    setDisplayName(userName)
  }, [userName])

  useEffect(() => {
    function syncFromHash() {
      setNavActiveId(readClienteNavId())
      setShowPerfil(readIsProfileSection('cliente'))
      setShowCriarTicket(readClienteShowCriarTicketButton())
    }
    syncFromHash()
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

  const selectNav = useCallback((id) => {
    setShowPerfil(false)
    setNavActiveId(id)
    setAppHash('cliente', id)
  }, [])

  function handleDrawerNavigate(actionId) {
    if (actionId === 'tickets') selectNav('tickets')
    else if (actionId === 'pedidos') selectNav('recolhas')
    else if (actionId === 'contentores') selectNav('contentores')
    else if (actionId === 'historico') selectNav('historico')
    else if (actionId === 'gestao' || actionId === 'recolhas') selectNav('dashboard')
    else if (actionId === 'perfil') {
      setShowPerfil(true)
      setAppHash('cliente', 'perfil')
      setShowCriarTicket(false)
    }
  }

  function openCriarTicket() {
    setNavActiveId('tickets')
    setAppHash('cliente', 'tickets', 'criar')
  }

  function openSolicitarRecolha(item) {
    setRecolhaContext(item)
  }

  function openSolicitarContentor() {
    setSolicitarContentorOpen(true)
  }

  function closeSolicitarContentor() {
    setSolicitarContentorOpen(false)
  }

  function closeSolicitarRecolha() {
    setRecolhaContext(null)
  }

  function reloadClientDashboardData() {
    setClientRequestsLoading(true)
    setClientRequestsError(false)
    fetchStrapiClienteMovimentosAgendados(MOCK_CLIENT_REQUESTS)
      .then((rows) => setClientRequests(rows))
      .catch(() => {
        setClientRequests([])
        setClientRequestsError(true)
      })
      .finally(() => setClientRequestsLoading(false))

    setClientContainersLoading(true)
    setClientContainersError(false)
    fetchStrapiClienteContentoresInstalados(MOCK_CLIENT_CONTAINERS)
      .then((rows) => setClientContainers(rows))
      .catch(() => {
        setClientContainers([])
        setClientContainersError(true)
      })
      .finally(() => setClientContainersLoading(false))
  }

  function openEditPedido(item) {
    setEditPedidoContext(item)
  }

  function closeEditPedido() {
    setEditPedidoContext(null)
  }

  function openDeletePedido(item) {
    setDeletePedidoContext(item)
  }

  function closeDeletePedido() {
    setDeletePedidoContext(null)
  }

  async function handleEditPedidoSubmit(payload) {
    /** @type {{ data: string, periodo?: string, estado?: string }} */
    const updatePayload = {
      data: payload.data,
      periodo: payload.periodo,
    }
    if (payload.resetToApproval) {
      updatePayload.estado = 'pedido'
    }
    const keys = payload.movimentoKeys?.length ? payload.movimentoKeys : []
    await updateStrapiMovimentosBatch(keys, updatePayload)
    closeEditPedido()
    reloadClientDashboardData()
  }

  async function handleDeletePedidoConfirm() {
    if (!deletePedidoContext) return
    const keys = getPedidoGroupMovimentoKeys(deletePedidoContext)
    await deleteStrapiMovimentosBatch(keys)
    closeDeletePedido()
    reloadClientDashboardData()
  }

  function openCollectionLocation(item) {
    const locationLabel = item.locationDetail || item.location || ''
    const query = formatLocationQuery({
      location: locationLabel,
      lat: item.lat,
      lng: item.lng,
    })
    if (!query) return
    setLocationMap({
      query,
      title: item.clienteLabel || userName,
      subtitle: locationLabel || query,
    })
  }

  async function handleSolicitarRecolhaSubmit(payload) {
    await createStrapiClienteSolicitacaoRecolha(payload)
    closeSolicitarRecolha()
    reloadClientDashboardData()
  }

  async function handleSolicitarContentorSubmit(payload) {
    await createStrapiClienteSolicitacaoContentor(payload)
    closeSolicitarContentor()
    reloadClientDashboardData()
  }

  const drawerRoleLabel =
    typeof userRole === 'string' && userRole.trim() ? userRole.trim() : 'Cliente'

  const shouldShowRequests = navActiveId === 'dashboard'
  const displayClientRequests = useMemo(
    () => collapseMovimentosPedidoCards(clientRequests),
    [clientRequests],
  )

  function renderMain() {
    if (showPerfil) {
      return <Perfil profileKind="cliente" onUserUpdated={setDisplayName} />
    }
    if (navActiveId === 'tickets') return <Tickets />
    if (navActiveId === 'historico') return <HistoricoPedidos />
    if (navActiveId === 'recolhas') {
      return (
        <Recolhas
          items={clientRequests}
          loading={clientRequestsLoading}
          loadError={clientRequestsError}
          onEditPedido={openEditPedido}
          onDeletePedido={openDeletePedido}
          onVerHistorico={() => selectNav('historico')}
        />
      )
    }
    if (navActiveId === 'contentores') {
      return (
        <Contentores
          variant="page"
          items={clientContainers}
          loading={clientContainersLoading}
          loadError={clientContainersError}
          onLocationClick={openCollectionLocation}
          onRequestPickup={openSolicitarRecolha}
          onAddContentor={openSolicitarContentor}
        />
      )
    }

    return (
      <>
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
              {!clientRequestsLoading && !clientRequestsError && displayClientRequests.length === 0 ? (
                <p className="cliente-dashboard__state">Não existem pedidos.</p>
              ) : null}
              {!clientRequestsLoading && !clientRequestsError
                ? displayClientRequests.map((item) => (
                    <CollectionCard
                      key={
                        item.pedidoDisplayMode === 'trocar'
                          ? `trocar-${item.pedidoGroupKey}`
                          : item.movimentoKey ?? `${item.id}-${item.taskType}-${item.scheduledAt}`
                      }
                      collectionId={item.pedidoGroupContentorId ?? item.id}
                      location={item.locationDetail || item.location || ''}
                      status={item.status}
                      scheduledAt={item.scheduledAt}
                      binNumber={item.binNumber}
                      taskType={item.taskType}
                      requestState={item.estadoKey}
                      showEdit={canEditMovimentoCliente(item)}
                      showDelete={canDeleteMovimentoCliente(item)}
                      onEditClick={() => openEditPedido(item)}
                      onDeleteClick={() => openDeletePedido(item)}
                      onLocationClick={() => openCollectionLocation(item)}
                    />
                  ))
                : null}
            </div>
          </section>
        ) : null}

        {navActiveId === 'dashboard' ? (
          <Contentores
            variant="dashboard"
            items={clientContainers}
            loading={clientContainersLoading}
            loadError={clientContainersError}
            onLocationClick={openCollectionLocation}
            onRequestPickup={openSolicitarRecolha}
          />
        ) : null}

        {navActiveId === 'dashboard' ? (
          <OperadorStatsSummary
            recolhasHoje={MOCK_CLIENT_STATS.recolhasHoje}
            recolhasAgendadas={MOCK_CLIENT_STATS.recolhasAgendadas}
            contentoresRecolhidos={MOCK_CLIENT_STATS.contentoresRecolhidos}
            kmPercorridos={MOCK_CLIENT_STATS.kmPercorridos}
            contentoresLabel="recolhidos"
          />
        ) : null}
      </>
    )
  }

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
        userName={displayName}
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
          userName={displayName}
          menuOpen={menuOpen}
          menuAriaControls="cliente-drawer-panel"
          onLogoClick={() => selectNav('dashboard')}
          onMenuClick={() => setMenuOpen((o) => !o)}
        />
      </div>

      <main
        className={`cliente-dashboard__main${
          navActiveId === 'tickets' ? ' cliente-dashboard__main--tickets' : ''
        }${navActiveId === 'recolhas' ? ' cliente-dashboard__main--recolhas' : ''}${
          navActiveId === 'historico' ? ' cliente-dashboard__main--historico' : ''
        }${navActiveId === 'contentores' ? ' cliente-dashboard__main--contentores' : ''}`}
      >
        {renderMain()}
      </main>

      <BottomNav
        variant="operador"
        items={CLIENT_BOTTOM_NAV_ITEMS}
        activeId={navActiveId}
        onSelect={selectNav}
      />

      <SolicitarRecolha
        isOpen={Boolean(recolhaContext)}
        containerItem={recolhaContext}
        onClose={closeSolicitarRecolha}
        onSubmit={handleSolicitarRecolhaSubmit}
      />

      <SolicitarContentor
        isOpen={solicitarContentorOpen}
        onClose={closeSolicitarContentor}
        onSubmit={handleSolicitarContentorSubmit}
      />

      <EditarPedido
        isOpen={Boolean(editPedidoContext)}
        movimentoItem={editPedidoContext}
        resetToApproval={editPedidoContext?.estadoKey === 'agendado'}
        onClose={closeEditPedido}
        onSubmit={handleEditPedidoSubmit}
      />

      <ApagarPedido
        isOpen={Boolean(deletePedidoContext)}
        movimentoItem={deletePedidoContext}
        onClose={closeDeletePedido}
        onConfirm={handleDeletePedidoConfirm}
      />
    </div>
  )
}
