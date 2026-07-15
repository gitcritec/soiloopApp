import { useCallback, useEffect, useMemo, useState } from 'react'
import { faMagnifyingGlass } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import recolhasHero from '../../../../assets/figma-operador/processar-bg.jpg'
import CollectionCard from '../../../../components/CollectionCard/CollectionCard.jsx'
import RecolhaAgendarModal from '../../../../components/RecolhaAgendarModal/RecolhaAgendarModal.jsx'
import {
  fetchStrapiAdminMovimentosPedido,
  pedidoAdminBadgeLabel,
  pedidoHasTroca,
  pedidoIsEntregaSimples,
} from '../../../../lib/strapiMovimentos.js'
import './Recolhas.css'

function pedidoKey(item) {
  return item.pedidoGroupKey ?? item.movimentoKey ?? `${item.id}-${item.taskType}`
}

function pedidoCollectionLabel(item) {
  if (pedidoHasTroca(item)) {
    const cid = item.recolhaContentorCid ?? item.id
    if (cid && cid !== 'Não definido') return cid
  }
  if (item.id && item.id !== 'Não definido') return item.id
  if (pedidoIsEntregaSimples(item)) {
    const litros = item.entregaLitrosLabel ?? item.pedidoLitrosLabel
    return litros ? `Entrega · ${litros}` : 'Entrega'
  }
  return item.id ?? '—'
}

/** Listagem de pedidos de recolha para aprovar (admin). */
export default function Recolhas() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [pedidoAgendar, setPedidoAgendar] = useState(null)

  const loadList = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    return fetchStrapiAdminMovimentosPedido()
      .then((rows) => {
        setItems(rows)
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar os pedidos.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const haystack = [
        item.id,
        item.clientName,
        item.location,
        item.locationPrefix,
        item.locationDetail,
        item.scheduledAt,
        item.taskType,
        item.estado,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [items, search])

  function openAgendar(item) {
    setPedidoAgendar(item)
  }

  function closeAgendar() {
    setPedidoAgendar(null)
  }

  function handleAgendarSuccess() {
    setPedidoAgendar(null)
    loadList()
  }

  return (
    <>
      <div className="admin-recolhas">
        <div className="admin-recolhas__hero-wrap">
          <img
            src={recolhasHero}
            alt=""
            className="admin-recolhas__hero"
            width={353}
            height={120}
          />
        </div>

        <div className="admin-recolhas__toolbar">
          <label className="admin-recolhas__search">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="admin-recolhas__search-icon" aria-hidden />
            <input
              type="search"
              className="admin-recolhas__search-input"
              placeholder="Pesquisar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Pesquisar pedidos de recolha"
            />
          </label>
        </div>

        {loading ? (
          <p className="admin-recolhas__status" role="status">
            A carregar pedidos…
          </p>
        ) : null}

        {!loading && loadError && items.length === 0 ? (
          <p className="admin-recolhas__status admin-recolhas__status--error" role="alert">
            {loadError}
          </p>
        ) : null}

        {!loading && !loadError && items.length === 0 ? (
          <p className="admin-recolhas__status">Não existem pedidos por aprovar.</p>
        ) : null}

        {!loading && items.length > 0 && filteredItems.length === 0 ? (
          <p className="admin-recolhas__status">Nenhum pedido corresponde à pesquisa.</p>
        ) : null}

        {!loading && filteredItems.length > 0 ? (
          <ul className="admin-recolhas__list">
            {filteredItems.map((item) => (
              <li key={pedidoKey(item)}>
                <button
                  type="button"
                  className="admin-recolhas__pick"
                  aria-label={`Agendar pedido ${item.clientName ? `${item.clientName}, ` : ''}${item.id}`}
                  onClick={() => openAgendar(item)}
                >
                  <CollectionCard
                    collectionId={pedidoCollectionLabel(item)}
                    clientName={item.clientName}
                    location={item.location}
                    locationPrefix={item.locationPrefix}
                    locationDetail={item.locationDetail}
                    status={item.status}
                    scheduledAt={item.scheduledAt}
                    binNumber={item.binNumber}
                    taskType={item.taskType}
                    badgeLabel={pedidoAdminBadgeLabel(item)}
                    showEdit={false}
                    showDelete={false}
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <RecolhaAgendarModal
        isOpen={pedidoAgendar != null}
        pedido={pedidoAgendar}
        onClose={closeAgendar}
        onSuccess={handleAgendarSuccess}
      />
    </>
  )
}
