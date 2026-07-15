import { useCallback, useEffect, useMemo, useState } from 'react'
import { faMagnifyingGlass, faPlus } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import StaffUserCard from '../../../../components/StaffUserCard/StaffUserCard.jsx'
import StaffUserRegisto from '../../../../components/StaffUserRegisto/StaffUserRegisto.jsx'
import { formatUserInviteNotice } from '../../../../lib/strapiUserInvite.js'
import {
  createStrapiAdmin,
  fetchStrapiAdminDetail,
  fetchStrapiAdmins,
  updateStrapiAdmin,
} from '../../../../lib/strapiAdmins.js'
import {
  readAdminAdminsEditId,
  readAdminAdminsView,
  setAppHash,
} from '../../../../lib/appRoute.js'
import './Admins.css'

/** Lista e registo de administradores (menu lateral). */
export default function Admins() {
  const [view, setView] = useState(() => readAdminAdminsView())
  const [editingId, setEditingId] = useState(() => readAdminAdminsEditId())
  const [editingItem, setEditingItem] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState(null)

  const loadList = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    return fetchStrapiAdmins()
      .then((rows) => setItems(rows))
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar os administradores.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadList()
  }, [loadList])

  useEffect(() => {
    function syncViewFromHash() {
      const nextView = readAdminAdminsView()
      setView(nextView)
      setEditingId(nextView === 'edit' ? readAdminAdminsEditId() : null)
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
    setAppHash('admin', 'admins')
  }

  function openCreate() {
    setEditingId(null)
    setEditingItem(null)
    setView('create')
    setAppHash('admin', 'admins', 'criar')
  }

  function openEdit(item) {
    setEditingId(item.id)
    setEditingItem(item)
    setView('edit')
    setAppHash('admin', 'admins', 'editar', item.id)
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
        title="administrador"
        onCreate={createStrapiAdmin}
        onUpdate={updateStrapiAdmin}
        onCancel={goToList}
        onSuccess={handleRegistoSuccess}
      />
    )
  }

  if (view === 'edit' && editingId) {
    return (
      <StaffUserRegisto
        title="administrador"
        userId={editingId}
        userToEdit={editingItem ?? undefined}
        fetchDetail={fetchStrapiAdminDetail}
        onCreate={createStrapiAdmin}
        onUpdate={updateStrapiAdmin}
        onCancel={goToList}
        onSuccess={handleRegistoSuccess}
      />
    )
  }

  return (
    <div className="admin-staff">
      <header className="admin-staff__head">
        <h1 className="admin-staff__title">Administradores</h1>
        <p className="admin-staff__subtitle">Adicionar e editar contas com acesso admin.</p>
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
            aria-label="Pesquisar administradores"
          />
        </label>
        <button
          type="button"
          className="admin-staff__add"
          aria-label="Adicionar administrador"
          onClick={openCreate}
        >
          <FontAwesomeIcon icon={faPlus} className="admin-staff__add-icon" aria-hidden />
        </button>
      </div>

      {loading ? (
        <p className="admin-staff__status" role="status">
          A carregar administradores…
        </p>
      ) : null}

      {!loading && loadError && items.length === 0 ? (
        <p className="admin-staff__status admin-staff__status--muted" role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && !loadError && items.length === 0 ? (
        <p className="admin-staff__status admin-staff__status--muted">
          Ainda não existem administradores registados.
        </p>
      ) : null}

      {!loading && items.length > 0 && filteredItems.length === 0 ? (
        <p className="admin-staff__status admin-staff__status--muted">
          Nenhum administrador corresponde à pesquisa.
        </p>
      ) : null}

      {!loading && filteredItems.length > 0 ? (
        <ul className="admin-staff__list">
          {filteredItems.map((item) => (
            <li key={item.id}>
              <StaffUserCard
                nome={item.nome}
                email={item.email}
                roleLabel="Administrador"
                onEditClick={() => openEdit(item)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
