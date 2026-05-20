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
import Formulario from './Formulario/Formulario.jsx'
import Processar from './Processar/Processar.jsx'
import QrScanner from './QrScanner/QrScanner.jsx'
import { readOperadorNavId, setAppHash } from '../../../lib/appRoute.js'
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

  useEffect(() => {
    function syncFromHash() {
      setNavActiveId(readOperadorNavId())
    }
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  const selectNav = useCallback((id) => {
    setNavActiveId(id)
    setAppHash('operador', id)
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

  function openFormulario(mode, payload = null) {
    setFormContext(
      payload
        ? { mode, contentorId: payload.contentorId }
        : { mode, contentorId: '' },
    )
    setScreen('formulario')
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
    openFormulario(mode, parsed)
  }

  function closeFormulario() {
    setFormContext(null)
    setScreen('dashboard')
  }

  async function handleFormularioSubmit(payload) {
    // Próximo passo: POST Strapi com payload (inclui inputs ocultos)
    console.info('[Formulário]', payload)
    closeFormulario()
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
          onMenuClick={() => setMenuOpen((o) => !o)}
        />
      </div>

      <main className="operator-dashboard__main">
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
      </main>

      <FloatingPrimaryButton
        variant="operador"
        label="Processar"
        onClick={() => setScreen('processar')}
        icon={<FontAwesomeIcon icon={faBarcodeRead} aria-hidden />}
      />
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
        onSelectFormulario={() => openFormulario('recolher')}
      />

      <QrScanner
        isOpen={screen === 'qr-scan' && Boolean(qrMode)}
        mode={qrMode ?? 'recolher'}
        onClose={() => setScreen('processar')}
        onDetected={handleQrDetected}
      />

      <Formulario
        isOpen={screen === 'formulario' && Boolean(formContext)}
        mode={formContext?.mode ?? 'recolher'}
        contentorId={formContext?.contentorId ?? ''}
        onClose={closeFormulario}
        onSubmit={handleFormularioSubmit}
      />
    </div>
  )
}
