import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  faMagnifyingGlass,
  faPlus,
} from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import clientesHero from '../../../../assets/figma-cliente/ListaCliente.png'
import ClienteCard from '../../../../components/ClienteCard/ClienteCard.jsx'
import {
  readAdminClientesDetailId,
  readAdminClientesEditId,
  readAdminClientesView,
  setAppHash,
} from '../../../../lib/appRoute.js'
import { formatUserInviteNotice } from '../../../../lib/strapiUserInvite.js'
import { fetchStrapiClientes } from '../../../../lib/strapiClientes.js'
import { fetchStrapiContentorCountsByClienteId } from '../../../../lib/strapiMovimentos.js'
import ClienteDetalhe from './ClienteDetalhe.jsx'
import ClienteRegisto from './ClienteRegisto.jsx'
import './Clientes.css'

function formatContentorCount(count) {
  const n = Number(count)
  if (!Number.isFinite(n) || n < 0) return '00'
  return String(n).padStart(2, '0')
}

/** Lista e registo de clientes (admin). */
export default function Clientes() {
  const [view, setView] = useState(() => readAdminClientesView())
  const [editingId, setEditingId] = useState(() => readAdminClientesEditId())
  const [detailId, setDetailId] = useState(() => readAdminClientesDetailId())
  const [editingItem, setEditingItem] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState(null)

  const loadList = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    return fetchStrapiClientes()
      .then(async (rows) => {
        const counts = await fetchStrapiContentorCountsByClienteId(rows)
        setItems(
          rows.map((item) => ({
            ...item,
            contentorCount: formatContentorCount(counts.get(String(item.id)) ?? 0),
          })),
        )
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar os clientes.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    function syncViewFromHash() {
      const nextView = readAdminClientesView()
      setView(nextView)
      setEditingId(nextView === 'edit' ? readAdminClientesEditId() : null)
      setDetailId(nextView === 'detail' ? readAdminClientesDetailId() : null)
    }
    window.addEventListener('hashchange', syncViewFromHash)
    return () => window.removeEventListener('hashchange', syncViewFromHash)
  }, [])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const haystack = [item.nome, item.username, item.email, item.cliCode, item.telefone, item.pessoaContacto]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [items, search])

  function goToList() {
    setView('list')
    setEditingId(null)
    setDetailId(null)
    setEditingItem(null)
    setAppHash('admin', 'clientes')
  }

  function openDetail(item) {
    setDetailId(item.id)
    setView('detail')
    setAppHash('admin', 'clientes', 'detalhe', item.id)
  }

  function openCreate() {
    setEditingId(null)
    setEditingItem(null)
    setView('create')
    setAppHash('admin', 'clientes', 'criar')
  }

  function openEdit(item) {
    setEditingId(item.id)
    setEditingItem(item)
    setView('edit')
    setAppHash('admin', 'clientes', 'editar', item.id)
  }

  useEffect(() => {
    if (!editingId || editingItem) return
    const fromList = items.find((item) => String(item.id) === String(editingId))
    if (fromList) setEditingItem(fromList)
  }, [editingId, editingItem, items])

  function handleRegistoSuccess(meta) {
    goToList()
    loadList()
    setNotice(formatUserInviteNotice(meta))
  }

  if (view === 'create') {
    return <ClienteRegisto onCancel={goToList} onSuccess={handleRegistoSuccess} />
  }

  if (view === 'edit' && editingId) {
    return (
      <ClienteRegisto
        clienteId={editingId}
        clienteToEdit={editingItem ?? undefined}
        onCancel={goToList}
        onSuccess={handleRegistoSuccess}
      />
    )
  }

  if (view === 'detail' && detailId) {
    return (
      <ClienteDetalhe
        clienteId={detailId}
        onBack={goToList}
        onEdit={(cliente) => openEdit(cliente)}
        onViewContentor={(contentorId) => setAppHash('admin', 'contentores', 'detalhe', contentorId)}
      />
    )
  }

  return (
    <div className="admin-clientes">
      <div className="admin-clientes__hero-wrap">
        <img
          src={clientesHero}
          alt=""
          className="admin-clientes__hero"
          width={353}
          height={130}
        />
      </div>

      <div className="admin-clientes__toolbar">
        <label className="admin-clientes__search">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="admin-clientes__search-icon" aria-hidden />
          <input
            type="search"
            className="admin-clientes__search-input"
            placeholder="Pesquisar"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Pesquisar clientes"
          />
        </label>
        <button
          type="button"
          className="admin-clientes__add"
          aria-label="Adicionar cliente"
          onClick={openCreate}
        >
          <FontAwesomeIcon icon={faPlus} className="admin-clientes__add-icon" aria-hidden />
        </button>
        </div>

        {notice ? (
          <p className="admin-clientes__status admin-clientes__status--notice" role="status">
            {notice}
          </p>
        ) : null}

        {loading ? (
        <p className="admin-clientes__status" role="status">
          A carregar clientes…
        </p>
      ) : null}

      {!loading && loadError && items.length === 0 ? (
        <p className="admin-clientes__status admin-clientes__status--muted" role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && !loadError && items.length === 0 ? (
        <p className="admin-clientes__status admin-clientes__status--muted">
          Ainda não existem clientes registados.
        </p>
      ) : null}

      {!loading && items.length > 0 && filteredItems.length === 0 ? (
        <p className="admin-clientes__status admin-clientes__status--muted">
          Nenhum cliente corresponde à pesquisa.
        </p>
      ) : null}

      {!loading && filteredItems.length > 0 ? (
        <ul className="admin-clientes__list">
          {filteredItems.map((item) => (
            <li key={item.id}>
              <ClienteCard
                nome={item.nome}
                cliCode={item.cliCode}
                telefone={item.telefone}
                contentorCount={item.contentorCount}
                onDetailsClick={() => openDetail(item)}
                onEditClick={() => openEdit(item)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
