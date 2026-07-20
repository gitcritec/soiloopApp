import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
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
import OperadorRecolhaCard from '../../../components/OperadorRecolhaCard/OperadorRecolhaCard.jsx'
import FloatingPrimaryButton from '../../../components/FloatingPrimaryButton/FloatingPrimaryButton.jsx'
import BottomNav from '../../../components/BottomNav/BottomNav.jsx'
import OperadorStatsSummary from '../../../components/OperadorStatsSummary/OperadorStatsSummary.jsx'
import OperatorDrawerMenu from '../../../components/OperatorDrawerMenu/OperatorDrawerMenu.jsx'
import LocationMapModal from '../../../components/LocationMapModal/LocationMapModal.jsx'
import { formatLocationQuery } from '../../../lib/locationQuery.js'
import { parseContentorQr } from '../../../lib/parseContentorQr.js'
import { fetchStrapiOperadorDashboardMovimentos, completeStrapiOperadorEntrega, completeStrapiOperadorRecolha, resolveOperadorEntregaContentorIdFromCard, resolveOperadorEntregaMovimentoKeyFromCard, resolveOperadorRecolhaContentorIdFromCard, resolveOperadorRecolhaMovimentoKeyFromCard } from '../../../lib/strapiMovimentos.js'
import MovimentosRecolha from './MovimentosRecolha/MovimentosRecolha.jsx'
import MovimentosEntrega from './MovimentosEntrega/MovimentosEntrega.jsx'
import Processar from './Processar/Processar.jsx'
import QrScanner from './QrScanner/QrScanner.jsx'
import Historico from './Historico/Historico.jsx'
import Perfil from '../../Perfil/Perfil.jsx'
import { readIsProfileSection, readOperadorNavId, readOperadorShowProcessarButton, readOperadorScreen, setAppHash } from '../../../lib/appRoute.js'
import {
  MOCK_DAY_COLLECTIONS,
  MOCK_OPERATOR_NAME,
  MOCK_OPERATOR_STATS,
  MOCK_UPCOMING_COLLECTIONS,
} from './mockData.js'

const OPERATOR_BOTTOM_NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: faHouseChimney },
  { id: 'historico', label: 'Histórico', icon: faClockSharp },
]

export default function Operador({ onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [navActiveId, setNavActiveId] = useState(() => readOperadorNavId())
  const [screen, setScreen] = useState(() => readOperadorScreen())
  const [headerLogoSrc, setHeaderLogoSrc] = useState(null)
  const [userName, setUserName] = useState(
    () => getStoredStrapiUsername() ?? MOCK_OPERATOR_NAME,
  )
  const [userRole, setUserRole] = useState(() => getStoredStrapiRoleLabel() ?? '')
  const [locationMap, setLocationMap] = useState(null)
  const [qrMode, setQrMode] = useState(null)
  const [qrError, setQrError] = useState(null)
  /** @type {{ contentorId: string, contentorIdFromQr: boolean, movimentoKey: string } | null} */
  const [recolhaForm, setRecolhaForm] = useState(null)
  const [recolhaValidateKey, setRecolhaValidateKey] = useState(0)
  /** Cartão de serviço (ex. troca) que abriu o ecrã Processar. */
  const [pendingProcessCard, setPendingProcessCard] = useState(null)
  /** @type {{ contentorId: string, observacoes: string, contentorIdFromQr: boolean, movimentoKey: string } | null} */
  const [entregaForm, setEntregaForm] = useState(null)
  const [entregaValidateKey, setEntregaValidateKey] = useState(0)
  /** @type {'processar' | 'entrega-form' | 'recolha-form' | 'dashboard' | null} */
  const [qrReturnTarget, setQrReturnTarget] = useState(null)
  const [dayCollections, setDayCollections] = useState([])
  const [upcomingCollections, setUpcomingCollections] = useState([])
  const [overdueCount, setOverdueCount] = useState(0)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [dashboardError, setDashboardError] = useState(false)
  const [operatorStats, setOperatorStats] = useState(MOCK_OPERATOR_STATS)
  const [showPerfil, setShowPerfil] = useState(() => readIsProfileSection('operador'))

  const syncOperadorRouteFromHash = useCallback(() => {
    setNavActiveId(readOperadorNavId())
    setShowPerfil(readIsProfileSection('operador'))
    const routeScreen = readOperadorScreen()
    setScreen((current) => {
      if (routeScreen === 'processar') return 'processar'
      if (current === 'processar') return 'dashboard'
      return current
    })
  }, [])

  useLayoutEffect(() => {
    syncOperadorRouteFromHash()
  }, [syncOperadorRouteFromHash])

  useEffect(() => {
    window.addEventListener('hashchange', syncOperadorRouteFromHash)
    return () => window.removeEventListener('hashchange', syncOperadorRouteFromHash)
  }, [syncOperadorRouteFromHash])

  const selectNav = useCallback((id) => {
    setNavActiveId(id)
    setShowPerfil(false)
    setScreen('dashboard')
    setAppHash('operador', id)
  }, [])

  function openQrScanner(mode, returnTarget = 'processar') {
    setQrError(null)
    setQrMode(mode)
    setQrReturnTarget(returnTarget)
    setScreen('qr-scan')
  }

  function openMovimentosEntrega(context = {}) {
    setQrError(null)
    setEntregaForm({
      contentorId: context.contentorId ?? '',
      observacoes: '',
      contentorIdFromQr: false,
      movimentoKey: context.movimentoKey ?? '',
    })
    if (context.contentorId?.trim()) {
      setEntregaValidateKey((key) => key + 1)
    }
    setScreen('movimentos-entrega')
  }

  function closeMovimentosEntrega() {
    setEntregaForm(null)
    setQrError(null)
    setScreen('dashboard')
  }

  function openEntregaQrScanner() {
    openQrScanner('entregar', 'entrega-form')
  }

  function openMovimentosRecolha(context = {}) {
    setQrError(null)
    setRecolhaForm({
      contentorId: context.contentorId ?? '',
      contentorIdFromQr: false,
      movimentoKey: context.movimentoKey ?? '',
    })
    if (context.contentorId?.trim()) {
      setRecolhaValidateKey((key) => key + 1)
    }
    setScreen('movimentos-recolha')
  }

  function closeMovimentosRecolha() {
    setRecolhaForm(null)
    setQrError(null)
    setScreen('dashboard')
  }

  function openRecolhaQrScanner() {
    openQrScanner('recolher', 'recolha-form')
  }

  function handleQrDetected({ mode, value }) {
    const parsed = parseContentorQr(value)
    const returnTarget = qrReturnTarget
    setQrMode(null)
    setQrReturnTarget(null)

    if (!parsed) {
      setQrError('Código QR inválido. O QR deve conter apenas o código do contentor (ex.: CNT-001).')
      if (mode === 'entregar' && returnTarget === 'entrega-form') {
        setScreen('movimentos-entrega')
      } else if (mode === 'recolher' && returnTarget === 'recolha-form') {
        setScreen('movimentos-recolha')
      } else if (returnTarget === 'dashboard') {
        setScreen('dashboard')
      } else {
        setScreen('processar')
      }
      return
    }

    setQrError(null)

    if (mode === 'entregar' && returnTarget === 'entrega-form') {
      setEntregaForm((prev) => ({
        contentorId: parsed.contentorId,
        observacoes: prev?.observacoes ?? '',
        contentorIdFromQr: true,
        movimentoKey: prev?.movimentoKey ?? '',
      }))
      setEntregaValidateKey((key) => key + 1)
      setScreen('movimentos-entrega')
      return
    }

    if (mode === 'recolher') {
      setRecolhaForm((prev) => ({
        contentorId: parsed.contentorId,
        contentorIdFromQr: true,
        movimentoKey: prev?.movimentoKey ?? '',
      }))
      setRecolhaValidateKey((key) => key + 1)
      setScreen('movimentos-recolha')
      return
    }
  }

  function closeQrScanner() {
    const returnTarget = qrReturnTarget
    setQrMode(null)
    setQrReturnTarget(null)
    if (returnTarget === 'entrega-form') {
      setScreen('movimentos-entrega')
      return
    }
    if (returnTarget === 'recolha-form') {
      setScreen('movimentos-recolha')
      return
    }
    if (returnTarget === 'dashboard') {
      setScreen('dashboard')
      return
    }
    setScreen('processar')
  }

  const reloadDashboard = useCallback(async () => {
    setDashboardLoading(true)
    setDashboardError(false)
    try {
      const result = await fetchStrapiOperadorDashboardMovimentos(
        MOCK_DAY_COLLECTIONS,
        MOCK_UPCOMING_COLLECTIONS,
      )
      setDayCollections(result.dayCollections ?? [])
      setUpcomingCollections(result.upcomingCollections ?? [])
      setOverdueCount(result.overdueCount ?? 0)
      setOperatorStats((prev) => ({
        ...prev,
        recolhasHoje: result.stats?.recolhasHoje ?? prev.recolhasHoje,
        recolhasAgendadas: result.stats?.recolhasAgendadas ?? prev.recolhasAgendadas,
      }))
    } catch {
      setDayCollections([])
      setUpcomingCollections([])
      setOverdueCount(0)
      setDashboardError(true)
    } finally {
      setDashboardLoading(false)
    }
  }, [])

  async function handleMovimentosEntregaSubmit(payload) {
    await completeStrapiOperadorEntrega({
      movimentoKey: entregaForm?.movimentoKey,
      contentorId: payload.contentorId,
      observacoes: payload.observacoes,
      fotografias: payload.fotografias,
    })
    closeMovimentosEntrega()
    await reloadDashboard()
  }

  async function handleMovimentosRecolhaSubmit(payload) {
    await completeStrapiOperadorRecolha({
      movimentoKey: payload.movimentoKey ?? recolhaForm?.movimentoKey,
      contentorId: payload.contentorId,
      observacoes: payload.observacoes,
      estado: payload.estado,
      peso: payload.peso,
      numeroEgar: payload.numeroEgar,
      fotografias: payload.fotografias,
    })
    closeMovimentosRecolha()
    await reloadDashboard()
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
      title: item.clienteLabel || '',
      subtitle: locationLabel || query,
    })
  }

  function openProcessar(card = null) {
    setQrError(null)
    setPendingProcessCard(card ?? null)
    setScreen('processar')
    setAppHash('operador', 'processar')
  }

  function closeProcessar() {
    setQrError(null)
    setPendingProcessCard(null)
    setScreen('dashboard')
    setAppHash('operador', 'dashboard')
  }

  function handleSelectEntregaFromProcessar() {
    if (pendingProcessCard) {
      openMovimentosEntrega({
        movimentoKey: resolveOperadorEntregaMovimentoKeyFromCard(pendingProcessCard),
        contentorId: resolveOperadorEntregaContentorIdFromCard(pendingProcessCard),
      })
      setPendingProcessCard(null)
      return
    }
    openMovimentosEntrega()
  }

  function handleSelectRecolhaFromProcessar() {
    if (pendingProcessCard) {
      openMovimentosRecolha({
        movimentoKey: resolveOperadorRecolhaMovimentoKeyFromCard(pendingProcessCard),
        contentorId: resolveOperadorRecolhaContentorIdFromCard(pendingProcessCard),
      })
      setPendingProcessCard(null)
      return
    }
    openMovimentosRecolha()
  }

  function resolveCardProcessMode(item) {
    const lines = Array.isArray(item?.taskLines) ? item.taskLines : []
    if (lines.length === 0) return null
    const types = new Set(lines.map((line) => line.type))
    if (types.size !== 1) return null
    return types.has('entregar') ? 'entregar' : 'recolher'
  }

  function openServiceFromCard(item) {
    setQrError(null)
    const mode = resolveCardProcessMode(item)
    if (!mode) {
      openProcessar(item)
      return
    }
    if (mode === 'entregar') {
      openMovimentosEntrega({
        movimentoKey: resolveOperadorEntregaMovimentoKeyFromCard(item),
        contentorId: resolveOperadorEntregaContentorIdFromCard(item),
      })
      return
    }
    openMovimentosRecolha({
      movimentoKey: resolveOperadorRecolhaMovimentoKeyFromCard(item),
      contentorId: resolveOperadorRecolhaContentorIdFromCard(item),
    })
  }

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      setDashboardLoading(true)
      setDashboardError(false)
      try {
        const user = await fetchStrapiCurrentUser()
        if (cancelled) return
        if (user) {
          persistStrapiUserCache(user)
          const name = user.username?.trim() || user.email?.trim()
          if (name) {
            persistStrapiUsername(name)
            setUserName(name)
          }
          const label = normalizeStrapiUserRole(user.role) ?? getStoredStrapiRoleLabel() ?? ''
          setUserRole(label)
        }

        const result = await fetchStrapiOperadorDashboardMovimentos(
          MOCK_DAY_COLLECTIONS,
          MOCK_UPCOMING_COLLECTIONS,
        )
        if (cancelled) return
        setDayCollections(result.dayCollections ?? [])
        setUpcomingCollections(result.upcomingCollections ?? [])
        setOverdueCount(result.overdueCount ?? 0)
        setOperatorStats((prev) => ({
          ...prev,
          recolhasHoje: result.stats?.recolhasHoje ?? prev.recolhasHoje,
          recolhasAgendadas: result.stats?.recolhasAgendadas ?? prev.recolhasAgendadas,
        }))
      } catch {
        if (!cancelled) {
          setDayCollections([])
          setUpcomingCollections([])
          setOverdueCount(0)
          setDashboardError(true)
        }
      } finally {
        if (!cancelled) setDashboardLoading(false)
      }
    }

    loadDashboard()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchStrapiGlobalLogoSmallUrl().then((url) => {
      if (!cancelled && url) setHeaderLogoSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function handleDrawerNavigate(actionId) {
    if (actionId === 'historico') selectNav('historico')
    else if (actionId === 'dashboard') selectNav('dashboard')
    else if (actionId === 'perfil') {
      setShowPerfil(true)
      setAppHash('operador', 'perfil')
    }
  }

  const drawerRoleLabel =
    (typeof userRole === 'string' && userRole.trim()) || 'A sincronizar…'

  const isDashboardScreen = screen === 'dashboard'
  const showsOperadorChrome =
    screen === 'dashboard' || screen === 'movimentos-entrega' || screen === 'movimentos-recolha'

  return (
    <div
      className={`operator-dashboard${showsOperadorChrome ? '' : ' operator-dashboard--overlay'}`}
    >
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
      />

      <div className="operator-dashboard__header-slot">
        {showsOperadorChrome ? (
        <PageHeader
          variant="floating"
          logoSrc={headerLogoSrc ?? logoSoiloop}
          userName={userName}
          menuOpen={menuOpen}
          onLogoClick={() => selectNav('dashboard')}
          onMenuClick={() => setMenuOpen((o) => !o)}
        />
        ) : null}
      </div>

      {isDashboardScreen ? (
      <main className="operator-dashboard__main">
        {showPerfil ? (
          <Perfil profileKind="operador" onUserUpdated={setUserName} />
        ) : navActiveId === 'historico' ? (
          <Historico />
        ) : (
          <>
        <section className="operator-dashboard__section" aria-labelledby="sec-day">
          <SectionTitleWithIcon
            id="sec-day"
            title="Serviços do Dia"
            icon={faRecycle}
            iconSize="large"
            titleTone="swapped"
          />
          {overdueCount > 0 ? (
            <p className="operator-dashboard__alert" role="alert">
              {overdueCount === 1
                ? 'Tem 1 recolha em atraso que deveria ter sido feita em dias anteriores.'
                : `Tem ${overdueCount} recolhas em atraso que deveriam ter sido feitas em dias anteriores.`}
            </p>
          ) : null}
          {dashboardLoading ? (
            <p className="operator-dashboard__state" role="status">
              A carregar recolhas…
            </p>
          ) : dashboardError ? (
            <p className="operator-dashboard__state" role="alert">
              Não foi possível carregar as recolhas. Tente novamente mais tarde.
            </p>
          ) : dayCollections.length === 0 ? (
            <p className="operator-dashboard__state">Não existem recolhas para hoje.</p>
          ) : (
            <div className="operator-dashboard__cards">
              {dayCollections.map((item) => (
                <OperadorRecolhaCard
                  key={item.id}
                  collectionId={item.collectionId}
                  locationDetail={item.locationDetail}
                  status={item.status}
                  scheduledAt={item.scheduledAt}
                  taskLines={item.taskLines}
                  onLocationClick={() => openCollectionLocation(item)}
                  onProcessClick={() => openServiceFromCard(item)}
                />
              ))}
            </div>
          )}
        </section>

        <section className="operator-dashboard__section" aria-labelledby="sec-upcoming">
          <SectionTitleWithIcon
            id="sec-upcoming"
            title="Próximos Serviços"
            icon={faRecycle}
            iconSize="large"
          />
          {!dashboardLoading && !dashboardError && upcomingCollections.length === 0 ? (
            <p className="operator-dashboard__state">Não existem recolhas agendadas.</p>
          ) : null}
          {!dashboardLoading && !dashboardError && upcomingCollections.length > 0 ? (
            <div className="operator-dashboard__cards">
              {upcomingCollections.map((item) => (
                <OperadorRecolhaCard
                  key={item.id}
                  collectionId={item.collectionId}
                  locationDetail={item.locationDetail}
                  status={item.status}
                  scheduledAt={item.scheduledAt}
                  taskLines={item.taskLines}
                  onLocationClick={() => openCollectionLocation(item)}
                  onProcessClick={() => openServiceFromCard(item)}
                />
              ))}
            </div>
          ) : null}
        </section>

        <OperadorStatsSummary
          recolhasHoje={operatorStats.recolhasHoje}
          recolhasAgendadas={operatorStats.recolhasAgendadas}
          contentoresAtivos={operatorStats.contentoresAtivos}
          kmPercorridos={operatorStats.kmPercorridos}
          contentoresLabel="ativos"
          activityLabel="Serviços"
        />
          </>
        )}
      </main>
      ) : null}

      {isDashboardScreen &&
      readOperadorShowProcessarButton() &&
      !showPerfil &&
      navActiveId === 'dashboard' ? (
        <FloatingPrimaryButton
          variant="operador"
          label="Processar"
          onClick={openProcessar}
          icon={<FontAwesomeIcon icon={faBarcodeRead} aria-hidden />}
        />
      ) : null}

      {showsOperadorChrome ? (
        <BottomNav
          variant="operador"
          items={OPERATOR_BOTTOM_NAV_ITEMS}
          activeId={navActiveId}
          onSelect={selectNav}
        />
      ) : null}

      <Processar
        isOpen={screen === 'processar'}
        qrError={qrError}
        onDismissQrError={() => setQrError(null)}
        onClose={closeProcessar}
        onSelectRecolha={handleSelectRecolhaFromProcessar}
        onSelectEntrega={handleSelectEntregaFromProcessar}
      />

      <QrScanner
        isOpen={screen === 'qr-scan' && Boolean(qrMode)}
        mode={qrMode ?? 'recolher'}
        onClose={closeQrScanner}
        onDetected={handleQrDetected}
      />

      <MovimentosEntrega
        isOpen={screen === 'movimentos-entrega' && Boolean(entregaForm)}
        contentorId={entregaForm?.contentorId ?? ''}
        contentorIdLocked={Boolean(entregaForm?.contentorIdFromQr)}
        contentorIdAutoValidateKey={entregaValidateKey}
        observacoes={entregaForm?.observacoes ?? ''}
        qrError={qrError}
        onDismissQrError={() => setQrError(null)}
        onProcessarEntrada={openEntregaQrScanner}
        onContentorIdChange={(value, options) =>
          setEntregaForm((prev) =>
            prev
              ? {
                  ...prev,
                  contentorId: value,
                  contentorIdFromQr: options?.keepQrLock ? prev.contentorIdFromQr : false,
                }
              : prev,
          )
        }
        onObservacoesChange={(value) =>
          setEntregaForm((prev) => (prev ? { ...prev, observacoes: value } : prev))
        }
        onClose={closeMovimentosEntrega}
        onSubmit={handleMovimentosEntregaSubmit}
      />

      <MovimentosRecolha
        isOpen={screen === 'movimentos-recolha' && Boolean(recolhaForm)}
        contentorId={recolhaForm?.contentorId ?? ''}
        contentorIdLocked={Boolean(recolhaForm?.contentorIdFromQr)}
        contentorIdAutoValidateKey={recolhaValidateKey}
        movimentoKey={recolhaForm?.movimentoKey ?? ''}
        qrError={qrError}
        onDismissQrError={() => setQrError(null)}
        onProcessarRecolha={openRecolhaQrScanner}
        onContentorIdChange={(value, options) =>
          setRecolhaForm((prev) =>
            prev
              ? {
                  ...prev,
                  contentorId: value,
                  contentorIdFromQr: options?.keepQrLock ? prev.contentorIdFromQr : false,
                }
              : prev,
          )
        }
        onClose={closeMovimentosRecolha}
        onSubmit={handleMovimentosRecolhaSubmit}
      />
    </div>
  )
}
