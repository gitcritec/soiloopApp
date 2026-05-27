import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  faMagnifyingGlass,
  faPlus,
  faShuffle,
  faSliders,
} from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import clientesHero from '../../../../assets/figma-cliente/ListaCliente.png'
import ClienteCard from '../../../../components/ClienteCard/ClienteCard.jsx'
import FloatingPrimaryButton from '../../../../components/FloatingPrimaryButton/FloatingPrimaryButton.jsx'
import { IconBarcodeScan } from '../../../../components/icons/icons.jsx'
import {
  readAdminClientesEditId,
  readAdminClientesView,
  setAppHash,
} from '../../../../lib/appRoute.js'
import { fetchStrapiClientes } from '../../../../lib/strapiClientes.js'
import ClienteRegisto from './ClienteRegisto.jsx'
import './Clientes.css'

/** Lista e registo de clientes (admin). */
export default function Clientes() {
  const [view, setView] = useState(() => readAdminClientesView())
  const [editingId, setEditingId] = useState(() => readAdminClientesEditId())
  const [editingItem, setEditingItem] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')

  const loadList = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    return fetchStrapiClientes()
      .then((rows) => {
        setItems(rows)
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
    setEditingItem(null)
    setAppHash('admin', 'clientes')
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

  function handleRegistoSuccess() {
    goToList()
    loadList()
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
        <button type="button" className="admin-clientes__tool-btn" aria-label="Ordenar">
          <FontAwesomeIcon icon={faShuffle} className="admin-clientes__tool-icon" aria-hidden />
        </button>
        <button type="button" className="admin-clientes__tool-btn" aria-label="Filtrar">
          <FontAwesomeIcon icon={faSliders} className="admin-clientes__tool-icon" aria-hidden />
        </button>
        <button
          type="button"
          className="admin-clientes__add"
          aria-label="Adicionar cliente"
          onClick={openCreate}
        >
          <FontAwesomeIcon icon={faPlus} className="admin-clientes__add-icon" aria-hidden />
        </button>
      </div>

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
                onLocationClick={() => {}}
                onEditClick={() => openEdit(item)}
              />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="admin-clientes__processar">
        <FloatingPrimaryButton
          variant="operador"
          label="Processar"
          onClick={() => {}}
          icon={<IconBarcodeScan />}
        />
      </div>
    </div>
  )
}
