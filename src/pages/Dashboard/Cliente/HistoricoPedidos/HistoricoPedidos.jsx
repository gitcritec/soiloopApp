import { useCallback, useEffect, useMemo, useState } from 'react'
import { faClock } from '@fortawesome/pro-light-svg-icons'
import CollectionCard from '../../../../components/CollectionCard/CollectionCard.jsx'
import SectionTitleWithIcon from '../../../../components/SectionTitleWithIcon/SectionTitleWithIcon.jsx'
import {
  collapseMovimentosPedidoCards,
  fetchStrapiClienteMovimentosHistorico,
} from '../../../../lib/strapiMovimentos.js'
import { MOCK_CLIENT_HISTORICO } from '../mockData.js'

/**
 * Histórico de pedidos concluídos do cliente.
 */
export default function HistoricoPedidos() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadHistorico = useCallback(() => {
    setLoading(true)
    setError(false)
    return fetchStrapiClienteMovimentosHistorico(MOCK_CLIENT_HISTORICO)
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
    <section className="cliente-dashboard__section" aria-labelledby="cliente-sec-historico">
      <SectionTitleWithIcon
        id="cliente-sec-historico"
        title="Histórico de Pedidos"
        icon={faClock}
        iconSize="large"
        titleTone="swapped"
      />
      <div className="cliente-dashboard__cards">
        {loading ? (
          <p className="cliente-dashboard__state">A carregar histórico…</p>
        ) : null}
        {!loading && error ? (
          <p className="cliente-dashboard__state" role="alert">
            Não foi possível carregar o histórico.
          </p>
        ) : null}
        {!loading && !error && displayItems.length === 0 ? (
          <p className="cliente-dashboard__state">Não existem pedidos concluídos.</p>
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
