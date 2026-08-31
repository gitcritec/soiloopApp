import { useCallback, useEffect, useMemo, useState } from 'react'
import { faMagnifyingGlass, faPlus, faTrash } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import recolhasHero from '../../../../assets/figma-operador/processar-bg.jpg'
import CollectionCard from '../../../../components/CollectionCard/CollectionCard.jsx'
import RecolhaAgendarModal from '../../../../components/RecolhaAgendarModal/RecolhaAgendarModal.jsx'
import {
  readAdminRecolhasView,
  setAppHash,
} from '../../../../lib/appRoute.js'
import {
  approveStrapiAdminCancelamento,
  cancelamentoAdminBadgeLabel,
  collapseMovimentosListagemCards,
  deleteStrapiAdminMovimentoComSerie,
  fetchStrapiAdminMovimentosAgendados,
  fetchStrapiAdminMovimentosCancelamento,
  fetchStrapiAdminMovimentosPedido,
  pedidoAdminBadgeLabel,
  pedidoHasTroca,
  pedidoIsEntregaSimples,
  rejectStrapiAdminCancelamento,
} from '../../../../lib/strapiMovimentos.js'
import ServicoRegisto from './ServicoRegisto.jsx'
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

function agendadoLabel(item) {
  if (item.taskType === 'entregar') {
    return item.id && item.id !== 'Não definido' ? item.id : 'Entrega'
  }
  return item.id ?? item.contentorId ?? '—'
}

function matchesSearch(item, q) {
  if (!q) return true
  const haystack = [
    item.id,
    item.clientName,
    item.clienteLabel,
    item.location,
    item.locationPrefix,
    item.locationDetail,
    item.scheduledAt,
    item.taskType,
    item.estado,
    item.dataIso,
    item.badgeLabel,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

/** Listagem de pedidos + cancelamentos + serviços agendados (admin). */
export default function Recolhas() {
  const [view, setView] = useState(() => readAdminRecolhasView())
  const [items, setItems] = useState([])
  const [cancelamentos, setCancelamentos] = useState([])
  const [agendados, setAgendados] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingCancelamentos, setLoadingCancelamentos] = useState(true)
  const [loadingAgendados, setLoadingAgendados] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [pedidoAgendar, setPedidoAgendar] = useState(null)
  const [notice, setNotice] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelActionBusy, setCancelActionBusy] = useState(false)
  const [cancelActionError, setCancelActionError] = useState('')

  const loadPedidos = useCallback(() => {
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

  const loadCancelamentos = useCallback(() => {
    setLoadingCancelamentos(true)
    return fetchStrapiAdminMovimentosCancelamento()
      .then((rows) => {
        setCancelamentos(rows)
      })
      .catch(() => {
        setCancelamentos([])
      })
      .finally(() => {
        setLoadingCancelamentos(false)
      })
  }, [])

  const loadAgendados = useCallback(() => {
    setLoadingAgendados(true)
    return fetchStrapiAdminMovimentosAgendados()
      .then((rows) => {
        setAgendados(rows)
      })
      .catch(() => {
        setAgendados([])
      })
      .finally(() => {
        setLoadingAgendados(false)
      })
  }, [])

  useEffect(() => {
    loadPedidos()
    loadCancelamentos()
    loadAgendados()
  }, [loadPedidos, loadCancelamentos, loadAgendados])

  useEffect(() => {
    function syncFromHash() {
      setView(readAdminRecolhasView())
    }
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((item) => matchesSearch(item, q))
  }, [items, search])

  const filteredCancelamentos = useMemo(() => {
    const q = search.trim().toLowerCase()
    return cancelamentos.filter((item) => matchesSearch(item, q))
  }, [cancelamentos, search])

  const filteredAgendados = useMemo(() => {
    const q = search.trim().toLowerCase()
    const rows = collapseMovimentosListagemCards(agendados)
    if (!q) return rows
    return rows.filter((item) => matchesSearch(item, q))
  }, [agendados, search])

  function goToList() {
    setView('list')
    setAppHash('admin', 'recolhas')
  }

  function openCreate() {
    setView('create')
    setAppHash('admin', 'recolhas', 'criar')
  }

  function openAgendar(item) {
    setPedidoAgendar(item)
  }

  function closeAgendar() {
    setPedidoAgendar(null)
  }

  function handleAgendarSuccess() {
    setPedidoAgendar(null)
    loadPedidos()
    loadAgendados()
  }

  function handleCreateSuccess(result) {
    goToList()
    loadPedidos()
    loadAgendados()
    if (result?.repetirSemanalmente) {
      setNotice('Série semanal criada. As próximas semanas ficam agendadas e renovam-se automaticamente.')
    } else {
      setNotice('Serviço criado e agendado.')
    }
  }

  async function confirmDelete(mode) {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteStrapiAdminMovimentoComSerie(deleteTarget.movimentoKey, {
        mode,
        recorrenciaId: deleteTarget.recorrenciaId,
        dataIso: deleteTarget.dataIso,
      })
      setDeleteTarget(null)
      setNotice(mode === 'future' ? 'Ocorrência e futuras removidas.' : 'Ocorrência removida.')
      loadAgendados()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Não foi possível apagar.')
    } finally {
      setDeleting(false)
    }
  }

  async function confirmCancelamento(action) {
    if (!cancelTarget) return
    setCancelActionBusy(true)
    setCancelActionError('')
    try {
      if (action === 'approve') {
        await approveStrapiAdminCancelamento(cancelTarget)
        setNotice('Cancelamento aprovado. Serviço removido.')
      } else {
        await rejectStrapiAdminCancelamento(cancelTarget)
        setNotice('Cancelamento recusado. Serviço restaurado.')
      }
      setCancelTarget(null)
      loadCancelamentos()
      loadPedidos()
      loadAgendados()
    } catch (err) {
      setCancelActionError(
        err instanceof Error ? err.message : 'Não foi possível processar o cancelamento.',
      )
    } finally {
      setCancelActionBusy(false)
    }
  }

  if (view === 'create') {
    return <ServicoRegisto onCancel={goToList} onSuccess={handleCreateSuccess} />
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
          <button
            type="button"
            className="admin-recolhas__add"
            aria-label="Novo serviço"
            onClick={openCreate}
          >
            <FontAwesomeIcon icon={faPlus} aria-hidden />
          </button>
        </div>

        {notice ? (
          <p className="admin-recolhas__status admin-recolhas__status--notice" role="status">
            {notice}
          </p>
        ) : null}

        <h2 className="admin-recolhas__section-title">Pedidos por aprovar</h2>

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

        <h2 className="admin-recolhas__section-title">Cancelamentos por aprovar</h2>

        {loadingCancelamentos ? (
          <p className="admin-recolhas__status" role="status">
            A carregar cancelamentos…
          </p>
        ) : null}

        {!loadingCancelamentos && cancelamentos.length === 0 ? (
          <p className="admin-recolhas__status">Não existem cancelamentos por aprovar.</p>
        ) : null}

        {!loadingCancelamentos && cancelamentos.length > 0 && filteredCancelamentos.length === 0 ? (
          <p className="admin-recolhas__status">Nenhum cancelamento corresponde à pesquisa.</p>
        ) : null}

        {!loadingCancelamentos && filteredCancelamentos.length > 0 ? (
          <ul className="admin-recolhas__list">
            {filteredCancelamentos.map((item) => (
              <li key={`cancel-${pedidoKey(item)}`}>
                <button
                  type="button"
                  className="admin-recolhas__pick"
                  aria-label={`Gerir cancelamento ${item.clientName ? `${item.clientName}, ` : ''}${item.id}`}
                  onClick={() => {
                    setCancelActionError('')
                    setCancelTarget(item)
                  }}
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
                    requestState="cancelamento"
                    badgeLabel={item.badgeLabel ?? cancelamentoAdminBadgeLabel(item)}
                    showEdit={false}
                    showDelete={false}
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <h2 className="admin-recolhas__section-title">Serviços agendados</h2>

        {loadingAgendados ? (
          <p className="admin-recolhas__status" role="status">
            A carregar agendados…
          </p>
        ) : null}

        {!loadingAgendados && filteredAgendados.length === 0 ? (
          <p className="admin-recolhas__status">Não existem serviços agendados.</p>
        ) : null}

        {!loadingAgendados && filteredAgendados.length > 0 ? (
          <ul className="admin-recolhas__list">
            {filteredAgendados.map((item) => (
              <li
                key={
                  item.recorrenciaId
                    ? `serie-${item.recorrenciaId}`
                    : item.movimentoKey ?? `${item.id}-${item.taskType}`
                }
                className="admin-recolhas__agendado-row"
              >
                <CollectionCard
                  collectionId={agendadoLabel(item)}
                  clientName={item.clientName ?? item.clienteLabel}
                  location={item.location}
                  locationPrefix={item.locationPrefix}
                  locationDetail={item.locationDetail}
                  status={item.status}
                  scheduledAt={item.scheduledAt || item.dataIso}
                  binNumber={item.binNumber}
                  taskType={item.taskType}
                  badgeLabel={item.recorrenciaId ? 'Semanal' : item.taskType === 'entregar' ? 'Entrega' : 'Recolha'}
                  showEdit={false}
                  showDelete={false}
                />
                <button
                  type="button"
                  className="admin-recolhas__delete"
                  aria-label={`Apagar ${agendadoLabel(item)}`}
                  onClick={() => {
                    setDeleteError('')
                    setDeleteTarget(item)
                  }}
                >
                  <FontAwesomeIcon icon={faTrash} aria-hidden />
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

      {cancelTarget ? (
        <div
          className="admin-recolhas-delete"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-recolhas-cancel-title"
        >
          <button
            type="button"
            className="admin-recolhas-delete__backdrop"
            aria-label="Fechar"
            onClick={() => !cancelActionBusy && setCancelTarget(null)}
          />
          <div className="admin-recolhas-delete__card">
            <h2 id="admin-recolhas-cancel-title" className="admin-recolhas-delete__title">
              Cancelamento pendente
            </h2>
            <p className="admin-recolhas-delete__text">
              O cliente pediu o cancelamento deste serviço
              {pedidoHasTroca(cancelTarget)
                ? ' (troca)'
                : pedidoIsEntregaSimples(cancelTarget)
                  ? ' (entrega)'
                  : ' (recolha)'}
              . Queres aprovar (apagar) ou recusar (manter o serviço)?
            </p>
            {cancelActionError ? (
              <p className="admin-recolhas-delete__error" role="alert">
                {cancelActionError}
              </p>
            ) : null}
            <div className="admin-recolhas-delete__actions">
              <button
                type="button"
                className="admin-recolhas-delete__btn admin-recolhas-delete__btn--ghost"
                disabled={cancelActionBusy}
                onClick={() => setCancelTarget(null)}
              >
                Fechar
              </button>
              <button
                type="button"
                className="admin-recolhas-delete__btn admin-recolhas-delete__btn--ghost"
                disabled={cancelActionBusy}
                onClick={() => confirmCancelamento('reject')}
              >
                {cancelActionBusy ? 'A processar…' : 'Recusar'}
              </button>
              <button
                type="button"
                className="admin-recolhas-delete__btn admin-recolhas-delete__btn--danger"
                disabled={cancelActionBusy}
                onClick={() => confirmCancelamento('approve')}
              >
                {cancelActionBusy ? 'A processar…' : 'Aprovar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="admin-recolhas-delete" role="dialog" aria-modal="true" aria-labelledby="admin-recolhas-delete-title">
          <button
            type="button"
            className="admin-recolhas-delete__backdrop"
            aria-label="Fechar"
            onClick={() => !deleting && setDeleteTarget(null)}
          />
          <div className="admin-recolhas-delete__card">
            <h2 id="admin-recolhas-delete-title" className="admin-recolhas-delete__title">
              Apagar serviço
            </h2>
            <p className="admin-recolhas-delete__text">
              {deleteTarget.recorrenciaId
                ? 'Este serviço faz parte de uma série semanal. Queres apagar só esta ocorrência ou também as futuras?'
                : 'Tens a certeza que queres apagar este serviço agendado?'}
            </p>
            {deleteError ? (
              <p className="admin-recolhas-delete__error" role="alert">
                {deleteError}
              </p>
            ) : null}
            <div className="admin-recolhas-delete__actions">
              <button
                type="button"
                className="admin-recolhas-delete__btn admin-recolhas-delete__btn--ghost"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="admin-recolhas-delete__btn admin-recolhas-delete__btn--danger"
                disabled={deleting}
                onClick={() => confirmDelete('single')}
              >
                {deleting ? 'A apagar…' : 'Só esta'}
              </button>
              {deleteTarget.recorrenciaId ? (
                <button
                  type="button"
                  className="admin-recolhas-delete__btn admin-recolhas-delete__btn--danger-strong"
                  disabled={deleting}
                  onClick={() => confirmDelete('future')}
                >
                  Esta e futuras
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
