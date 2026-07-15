import { useCallback, useEffect, useMemo, useState } from 'react'
import { faMagnifyingGlass, faPlus } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import StaffUserCard from '../../../../components/StaffUserCard/StaffUserCard.jsx'
import StaffUserRegisto from '../../../../components/StaffUserRegisto/StaffUserRegisto.jsx'
import { formatUserInviteNotice } from '../../../../lib/strapiUserInvite.js'
import {
  createStrapiOperador,
  fetchStrapiOperadorDetail,
  fetchStrapiOperadores,
  updateStrapiOperador,
} from '../../../../lib/strapiOperadores.js'
import {
  readAdminOperadoresEditId,
  readAdminOperadoresView,
  setAppHash,
} from '../../../../lib/appRoute.js'
import './Operadores.css'

/** Lista e registo de operadores (menu lateral). */
export default function Operadores() {
  const [view, setView] = useState(() => readAdminOperadoresView())
  const [editingId, setEditingId] = useState(() => readAdminOperadoresEditId())
  const [editingItem, setEditingItem] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState(null)

  const loadList = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    return fetchStrapiOperadores()
      .then((rows) => setItems(rows))
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar os operadores.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    function syncViewFromHash() {
      const nextView = readAdminOperadoresView()
      setView(nextView)
      setEditingId(nextView === 'edit' ? readAdminOperadoresEditId() : null)
    }
    window.addEventListener('hashchange', syncViewFromHash)
    return () => window.removeEventListener('hashchange', syncViewFromHash)
  }, [])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const haystack = [item.nome, item.username, item.email].filter(Boolean).join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [items, search])

  function goToList() {
    setView('list')
    setEditingId(null)
    setEditingItem(null)
    setAppHash('admin', 'operadores')
  }

  function openCreate() {
    setEditingId(null)
    setEditingItem(null)
    setView('create')
    setAppHash('admin', 'operadores', 'criar')
  }

  function openEdit(item) {
    setEditingId(item.id)
    setEditingItem(item)
    setView('edit')
    setAppHash('admin', 'operadores', 'editar', item.id)
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
    return (
      <StaffUserRegisto
        title="operador"
        onCreate={createStrapiOperador}
        onUpdate={updateStrapiOperador}
        onCancel={goToList}
        onSuccess={handleRegistoSuccess}
      />
    )
  }

  if (view === 'edit' && editingId) {
    return (
      <StaffUserRegisto
        title="operador"
        userId={editingId}
        userToEdit={editingItem ?? undefined}
        fetchDetail={fetchStrapiOperadorDetail}
        onCreate={createStrapiOperador}
        onUpdate={updateStrapiOperador}
        onCancel={goToList}
        onSuccess={handleRegistoSuccess}
      />
    )
  }

  return (
    <div className="admin-staff">
      <header className="admin-staff__head">
        <h1 className="admin-staff__title">Operadores</h1>
        <p className="admin-staff__subtitle">Adicionar e editar contas de operadores.</p>
      </header>

      {notice ? (
        <p className="admin-staff__status admin-staff__status--notice" role="status">
          {notice}
        </p>
      ) : null}

      <div className="admin-staff__toolbar">
        <label className="admin-staff__search">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="admin-staff__search-icon" aria-hidden />
          <input
            type="search"
            className="admin-staff__search-input"
            placeholder="Pesquisar"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Pesquisar operadores"
          />
        </label>
        <button
          type="button"
          className="admin-staff__add"
          aria-label="Adicionar operador"
          onClick={openCreate}
        >
          <FontAwesomeIcon icon={faPlus} className="admin-staff__add-icon" aria-hidden />
        </button>
      </div>

      {loading ? (
        <p className="admin-staff__status" role="status">
          A carregar operadores…
        </p>
      ) : null}

      {!loading && loadError && items.length === 0 ? (
        <p className="admin-staff__status admin-staff__status--muted" role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && !loadError && items.length === 0 ? (
        <p className="admin-staff__status admin-staff__status--muted">
          Ainda não existem operadores registados.
        </p>
      ) : null}

      {!loading && items.length > 0 && filteredItems.length === 0 ? (
        <p className="admin-staff__status admin-staff__status--muted">
          Nenhum operador corresponde à pesquisa.
        </p>
      ) : null}

      {!loading && filteredItems.length > 0 ? (
        <ul className="admin-staff__list">
          {filteredItems.map((item) => (
            <li key={item.id}>
              <StaffUserCard
                nome={item.nome}
                email={item.email}
                roleLabel="Operador"
                onEditClick={() => openEdit(item)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
