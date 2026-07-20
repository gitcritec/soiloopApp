import { useCallback, useEffect, useMemo, useState } from 'react'
import { faClock } from '@fortawesome/pro-light-svg-icons'
import CollectionCard from '../../../../components/CollectionCard/CollectionCard.jsx'
import SectionTitleWithIcon from '../../../../components/SectionTitleWithIcon/SectionTitleWithIcon.jsx'
import {
  collapseMovimentosPedidoCards,
  fetchStrapiOperadorMovimentosHistorico,
} from '../../../../lib/strapiMovimentos.js'
import { MOCK_OPERATOR_HISTORICO } from '../mockData.js'

/**
 * Histórico de entregas e recolhas concluídas do operador.
 */
export default function Historico() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadHistorico = useCallback(() => {
    setLoading(true)
    setError(false)
    return fetchStrapiOperadorMovimentosHistorico(MOCK_OPERATOR_HISTORICO)
      .then((rows) => setItems(rows))
      .catch(() => {
        setItems([])
        setError(true)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadHistorico()
  }, [loadHistorico])

  const displayItems = useMemo(() => collapseMovimentosPedidoCards(items), [items])

  return (
    <section className="operator-dashboard__section" aria-labelledby="operador-sec-historico">
      <SectionTitleWithIcon
        id="operador-sec-historico"
        title="Histórico de Serviços"
        icon={faClock}
        iconSize="large"
        titleTone="swapped"
      />
      <div className="operator-dashboard__cards">
        {loading ? (
          <p className="operator-dashboard__state" role="status">
            A carregar histórico…
          </p>
        ) : null}
        {!loading && error ? (
          <p className="operator-dashboard__state" role="alert">
            Não foi possível carregar o histórico.
          </p>
        ) : null}
        {!loading && !error && displayItems.length === 0 ? (
          <p className="operator-dashboard__state">Não existem serviços concluídos.</p>
        ) : null}
        {!loading && !error
          ? displayItems.map((item) => (
              <CollectionCard
                key={
                  item.pedidoDisplayMode === 'trocar'
                    ? `trocar-${item.pedidoGroupKey}`
                    : item.movimentoKey ?? `${item.id}-${item.taskType}-${item.historicoScheduledAt}`
                }
                collectionId={item.pedidoGroupContentorId ?? item.id}
                clientName={item.clienteLabel || item.clientName || ''}
                location={item.location}
                locationPrefix={item.locationPrefix}
                locationDetail={item.locationDetail}
                status="finalizado"
                scheduledAt={item.historicoScheduledAt || item.scheduledAt}
                binNumber={item.binNumber}
                taskType={item.taskType}
                showFullDateTime
                showEdit={false}
                showDelete={false}
              />
            ))
          : null}
      </div>
    </section>
  )
}
