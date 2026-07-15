import { useCallback, useEffect, useState } from 'react'
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
import LocationMapModal from '../../../components/LocationMapModal/LocationMapModal.jsx'
import { formatLocationQuery } from '../../../lib/locationQuery.js'
import { parseContentorQr } from '../../../lib/parseContentorQr.js'
import MovimentosRecolha from './MovimentosRecolha/MovimentosRecolha.jsx'
import Processar from './Processar/Processar.jsx'
import QrScanner from './QrScanner/QrScanner.jsx'
import Perfil from '../../Perfil/Perfil.jsx'
import { readIsProfileSection, readOperadorNavId, readOperadorShowProcessarButton, setAppHash } from '../../../lib/appRoute.js'
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
  const [navActiveId, setNavActiveId] = useState(() => readOperadorNavId())
  const [showPerfil, setShowPerfil] = useState(() => readIsProfileSection('operador'))
  const [showProcessarFab, setShowProcessarFab] = useState(() => readOperadorShowProcessarButton())

  useEffect(() => {
    function syncFromHash() {
      setNavActiveId(readOperadorNavId())
      setShowPerfil(readIsProfileSection('operador'))
      setShowProcessarFab(readOperadorShowProcessarButton())
    }
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  const selectNav = useCallback((id) => {
    setNavActiveId(id)
    setShowPerfil(false)
    setAppHash('operador', id)
    setShowProcessarFab(readOperadorShowProcessarButton())
  }, [])

  const [headerLogoSrc, setHeaderLogoSrc] = useState(null)
  const [userName, setUserName] = useState(
    () => getStoredStrapiUsername() ?? MOCK_OPERATOR_NAME,
  )
  const [userRole, setUserRole] = useState(() => getStoredStrapiRoleLabel() ?? '')
  const [locationMap, setLocationMap] = useState(null)
  const [screen, setScreen] = useState('dashboard')
  const [qrMode, setQrMode] = useState(null)
  const [qrError, setQrError] = useState(null)
  /** @type {{ mode: 'recolher' | 'entregar', contentorId: string } | null} */
  const [formContext, setFormContext] = useState(null)

  function openQrScanner(mode) {
    setQrError(null)
    setQrMode(mode)
    setScreen('qr-scan')
  }

  function openMovimentosRecolha(mode, payload = null) {
    setFormContext(
      payload
        ? { mode, contentorId: payload.contentorId }
        : { mode, contentorId: '' },
    )
    setScreen('movimentos-recolha')
  }

  function handleQrDetected({ mode, value }) {
    const parsed = parseContentorQr(value)
    setQrMode(null)
    if (!parsed) {
      setQrError('Código QR inválido. O QR deve conter apenas o código do contentor (ex.: CNT-001).')
      setScreen('processar')
      return
    }
    setQrError(null)
    openMovimentosRecolha(mode, parsed)
  }

  function closeMovimentosRecolha() {
    setFormContext(null)
    setScreen('dashboard')
  }

  async function handleMovimentosRecolhaSubmit(payload) {
    // Próximo passo: POST Strapi com payload (inclui inputs ocultos)
    console.info('[MovimentosRecolha]', payload)
    closeMovimentosRecolha()
  }

  function openCollectionLocation(item) {
    const query = formatLocationQuery(item)
    if (!query) return
    setLocationMap({
      query,
      title: item.id,
      subtitle: query,
    })
  }

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
    if (actionId === 'movimentos') selectNav('movimentos')
    else if (actionId === 'historico') selectNav('historico')
    else if (actionId === 'recolhas') selectNav('dashboard')
    else if (actionId === 'perfil') {
      setShowPerfil(true)
      setShowProcessarFab(false)
      setAppHash('operador', 'perfil')
    }
  }

  const drawerRoleLabel =
    (typeof userRole === 'string' && userRole.trim()) || 'A sincronizar…'

  return (
    <div className="operator-dashboard">
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
        <PageHeader
          variant="floating"
          logoSrc={headerLogoSrc ?? logoSoiloop}
          userName={userName}
          menuOpen={menuOpen}
          onLogoClick={() => selectNav('dashboard')}
          onMenuClick={() => setMenuOpen((o) => !o)}
        />
      </div>

      <main className="operator-dashboard__main">
        {showPerfil ? (
          <Perfil profileKind="operador" onUserUpdated={setUserName} />
        ) : (
          <>
        <section className="operator-dashboard__section" aria-labelledby="sec-day">
          <SectionTitleWithIcon
            id="sec-day"
            title="Tarefas do Dia"
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
                taskType={item.taskType}
                onLocationClick={() => openCollectionLocation(item)}
              />
            ))}
          </div>
        </section>

        <section className="operator-dashboard__section" aria-labelledby="sec-upcoming">
          <SectionTitleWithIcon
            id="sec-upcoming"
            title="Próximas Tarefas"
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
                taskType={item.taskType}
                onLocationClick={() => openCollectionLocation(item)}
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
          </>
        )}
      </main>

      {showProcessarFab ? (
      <FloatingPrimaryButton
        variant="operador"
        label="Processar"
        onClick={() => setScreen('processar')}
        icon={<FontAwesomeIcon icon={faBarcodeRead} aria-hidden />}
      />
      ) : null}
      <BottomNav
        variant="operador"
        items={OPERATOR_BOTTOM_NAV_ITEMS}
        activeId={navActiveId}
        onSelect={selectNav}
      />

      <Processar
        isOpen={screen === 'processar'}
        qrError={qrError}
        onDismissQrError={() => setQrError(null)}
        onClose={() => {
          setQrError(null)
          setScreen('dashboard')
        }}
        onSelectRecolha={() => openQrScanner('recolher')}
        onSelectEntrega={() => openQrScanner('entregar')}
        onSelectMovimentosRecolha={() => openMovimentosRecolha('recolher')}
      />

      <QrScanner
        isOpen={screen === 'qr-scan' && Boolean(qrMode)}
        mode={qrMode ?? 'recolher'}
        onClose={() => setScreen('processar')}
        onDetected={handleQrDetected}
      />

      <MovimentosRecolha
        isOpen={screen === 'movimentos-recolha' && Boolean(formContext)}
        mode={formContext?.mode ?? 'recolher'}
        contentorId={formContext?.contentorId ?? ''}
        onClose={closeMovimentosRecolha}
        onSubmit={handleMovimentosRecolhaSubmit}
      />
    </div>
  )
}
