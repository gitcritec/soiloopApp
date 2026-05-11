import { useState } from 'react'
import { faRecycle } from '@fortawesome/free-solid-svg-icons'
import './Dashboard.css'
import PageHeader from '../../components/PageHeader/PageHeader.jsx'
import SectionTitleWithIcon from '../../components/SectionTitleWithIcon/SectionTitleWithIcon.jsx'
import CollectionCard from '../../components/CollectionCard/CollectionCard.jsx'
import FloatingPrimaryButton from '../../components/FloatingPrimaryButton/FloatingPrimaryButton.jsx'
import BottomNav from '../../components/BottomNav/BottomNav.jsx'
import { IconBarcodeScan, IconHistorico, IconHome, IconMovimentos } from '../../components/icons/icons.jsx'
import {
  MOCK_DAY_COLLECTIONS,
  MOCK_OPERATOR_NAME,
  MOCK_UPCOMING_COLLECTIONS,
} from './mockData.js'

const OPERATOR_BOTTOM_NAV_ITEMS = [
  { id: 'movimentos', label: 'Movimentos', Icon: IconMovimentos },
  { id: 'dashboard', label: 'Dashboard', Icon: IconHome },
  { id: 'historico', label: 'Histórico', Icon: IconHistorico },
]

export default function Dashboard() {
  const [navActiveId, setNavActiveId] = useState('dashboard')

  return (
    <div className="operator-dashboard">
      <PageHeader userName={MOCK_OPERATOR_NAME} onMenuClick={() => {}} />

      <main className="operator-dashboard__main">
        <section className="operator-dashboard__section" aria-labelledby="sec-day">
          <SectionTitleWithIcon id="sec-day" title="Recolhas do Dia" icon={faRecycle} />
          <div className="operator-dashboard__cards">
            {MOCK_DAY_COLLECTIONS.map((item) => (
              <CollectionCard
                key={item.id}
                collectionId={item.id}
                location={item.location}
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
          <SectionTitleWithIcon id="sec-upcoming" title="Próximas Recolhas" icon={faRecycle} />
          <div className="operator-dashboard__cards">
            {MOCK_UPCOMING_COLLECTIONS.map((item) => (
              <CollectionCard
                key={item.id}
                collectionId={item.id}
                location={item.location}
                status={item.status}
                scheduledAt={item.scheduledAt}
                binNumber={item.binNumber}
                onLocationClick={() => {}}
                onScanClick={() => {}}
              />
            ))}
          </div>
        </section>
      </main>

      <FloatingPrimaryButton
        label="Processar"
        onClick={() => {}}
        icon={<IconBarcodeScan />}
      />
      <BottomNav items={OPERATOR_BOTTOM_NAV_ITEMS} activeId={navActiveId} onSelect={setNavActiveId} />
    </div>
  )
}
