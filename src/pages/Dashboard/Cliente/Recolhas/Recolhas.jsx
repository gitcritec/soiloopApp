import { useCallback, useEffect, useMemo, useState } from 'react'
import { faClock, faRecycle } from '@fortawesome/pro-light-svg-icons'
import CollectionCard from '../../../../components/CollectionCard/CollectionCard.jsx'
import SectionTitleWithIcon from '../../../../components/SectionTitleWithIcon/SectionTitleWithIcon.jsx'
import {
  canDeleteMovimentoCliente,
  canEditMovimentoCliente,
  collapseMovimentosPedidoCards,
  fetchStrapiClienteMovimentosHistorico,
} from '../../../../lib/strapiMovimentos.js'
import { MOCK_CLIENT_HISTORICO } from '../mockData.js'
import recolhasHero from '../../../../assets/figma-cliente/recolhas-hero.svg'
import './Recolhas.css'

const HISTORICO_PREVIEW_LIMIT = 2

function pickLocationLabel(item) {
  return item.locationDetail || item.location || item.locationPrefix || ''
}

/**
 * Página «Recolhas» do cliente — pedidos ativos + pré-visualização do histórico.
 */
export default function Recolhas({
  items = [],
  loading = false,
  loadError = false,
  onEditPedido,
  onDeletePedido,
  onVerHistorico,
}) {
  const [historicoItems, setHistoricoItems] = useState([])
  const [historicoLoading, setHistoricoLoading] = useState(true)
  const [historicoError, setHistoricoError] = useState(false)

  const loadHistorico = useCallback(() => {
    setHistoricoLoading(true)
    setHistoricoError(false)
    return fetchStrapiClienteMovimentosHistorico(MOCK_CLIENT_HISTORICO)
      .then((rows) => setHistoricoItems(rows))
      .catch(() => {
        setHistoricoItems([])
        setHistoricoError(true)
      })
      .finally(() => setHistoricoLoading(false))
  }, [])

  useEffect(() => {
    loadHistorico()
  }, [loadHistorico])

  const displayPedidos = useMemo(() => collapseMovimentosPedidoCards(items), [items])
  const displayHistorico = useMemo(
    () => collapseMovimentosPedidoCards(historicoItems).slice(0, HISTORICO_PREVIEW_LIMIT),
    [historicoItems],
  )

  function renderPedidoCard(item) {
    return (
      <CollectionCard
        key={
          item.pedidoDisplayMode === 'trocar'
            ? `trocar-${item.pedidoGroupKey}`
            : item.movimentoKey ?? `${item.id}-${item.taskType}-${item.scheduledAt}`
        }
        collectionId={item.pedidoGroupContentorId ?? item.id}
        location={pickLocationLabel(item)}
        status={item.status}
        scheduledAt={item.scheduledAt}
        binNumber={item.binNumber}
        taskType={item.taskType}
        requestState={item.estadoKey}
        hideTaskType
        showScheduledTime
        showEdit={canEditMovimentoCliente(item)}
        showDelete={canDeleteMovimentoCliente(item)}
        onEditClick={() => onEditPedido?.(item)}
        onDeleteClick={() => onDeletePedido?.(item)}
      />
    )
  }

  function renderHistoricoCard(item) {
    return (
      <CollectionCard
        key={
          item.pedidoDisplayMode === 'trocar'
            ? `trocar-${item.pedidoGroupKey}`
            : item.movimentoKey ?? `${item.id}-${item.taskType}-${item.historicoScheduledAt}`
        }
        collectionId={item.pedidoGroupContentorId ?? item.id}
        location={pickLocationLabel(item)}
        status="finalizado"
        scheduledAt={item.historicoScheduledAt || item.scheduledAt}
        binNumber={item.binNumber}
        taskType={item.taskType}
        hideTaskType
        showScheduledTime
        showEdit={false}
        showDelete={false}
      />
    )
  }

  return (
    <div className="cliente-recolhas">
      <section className="cliente-recolhas__section" aria-labelledby="cliente-sec-pedidos-recolha">
        <SectionTitleWithIcon
          id="cliente-sec-pedidos-recolha"
          title="Pedidos de Recolhas"
          icon={faRecycle}
          iconSize="large"
          titleTone="swapped"
        />

        <div className="cliente-recolhas__hero-wrap">
          <img
            src={recolhasHero}
            alt=""
            className="cliente-recolhas__hero"
            width={353}
            height={120}
          />
        </div>

        <div className="cliente-recolhas__cards">
          {loading ? (
            <p className="cliente-dashboard__state" role="status">
              A carregar pedidos…
            </p>
          ) : null}

          {!loading && loadError ? (
            <p className="cliente-dashboard__state" role="alert">
              Não foi possível carregar os pedidos.
            </p>
          ) : null}

          {!loading && !loadError && displayPedidos.length === 0 ? (
            <p className="cliente-dashboard__state">Não existem pedidos.</p>
          ) : null}

          {!loading && !loadError ? displayPedidos.map(renderPedidoCard) : null}
        </div>
      </section>

      <section className="cliente-recolhas__section" aria-labelledby="cliente-sec-historico-recolha">
        <div className="cliente-recolhas__section-head">
          <SectionTitleWithIcon
            id="cliente-sec-historico-recolha"
            title="Histórico de Recolhas"
            icon={faClock}
            iconSize="large"
            titleTone="swapped"
          />
          <button type="button" className="cliente-recolhas__ver-todos" onClick={onVerHistorico}>
            Ver todos
          </button>
        </div>

        <div className="cliente-recolhas__cards">
          {historicoLoading ? (
            <p className="cliente-dashboard__state" role="status">
              A carregar histórico…
            </p>
          ) : null}

          {!historicoLoading && historicoError ? (
            <p className="cliente-dashboard__state" role="alert">
              Não foi possível carregar o histórico.
            </p>
          ) : null}

          {!historicoLoading && !historicoError && displayHistorico.length === 0 ? (
            <p className="cliente-dashboard__state">Não existem recolhas concluídas.</p>
          ) : null}

          {!historicoLoading && !historicoError ? displayHistorico.map(renderHistoricoCard) : null}
        </div>
      </section>
    </div>
  )
}
