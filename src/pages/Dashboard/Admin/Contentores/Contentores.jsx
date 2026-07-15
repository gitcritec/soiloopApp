import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  faMagnifyingGlass,
  faPlus,
} from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import contentoresHero from '../../../../assets/figma-cliente/contentores-hero.png'
import ContentorCard from '../../../../components/ContentorCard/ContentorCard.jsx'
import ContentorQrModal from '../../../../components/ContentorQrModal/ContentorQrModal.jsx'
import {
  readAdminContentoresDetailId,
  readAdminContentoresEditId,
  readAdminContentoresView,
  setAppHash,
} from '../../../../lib/appRoute.js'
import { fetchStrapiContentores } from '../../../../lib/strapiContentores.js'
import ContentorDetalhe from './ContentorDetalhe.jsx'
import { formatLocationQuery } from '../../../../lib/locationQuery.js'
import ContentorRegisto from './ContentorRegisto.jsx'
import './Contentores.css'

/** Lista e registo de contentores (admin) — Figma 16:793. */
export default function Contentores() {
  const [view, setView] = useState(() => readAdminContentoresView())
  const [editingId, setEditingId] = useState(() => readAdminContentoresEditId())
  const [detailId, setDetailId] = useState(() => readAdminContentoresDetailId())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [search, setSearch] = useState('')
  const [qrPreview, setQrPreview] = useState(null)

  const loadList = useCallback(() => {
    setLoading(true)
    setLoadError(false)
    return fetchStrapiContentores()
      .then((rows) => {
        setItems(rows)
      })
      .catch(() => {
        setLoadError(true)
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
      const nextView = readAdminContentoresView()
      setView(nextView)
      setEditingId(nextView === 'edit' ? readAdminContentoresEditId() : null)
      setDetailId(nextView === 'detail' ? readAdminContentoresDetailId() : null)
    }
    window.addEventListener('hashchange', syncViewFromHash)
    return () => window.removeEventListener('hashchange', syncViewFromHash)
  }, [])

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const haystack = [item.cid, item.localizacao, item.clienteAtualNome, item.estadoLabel, item.litrosLabel]
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
    setAppHash('admin', 'contentores')
  }

  function openCreate() {
    setEditingId(null)
    setDetailId(null)
    setView('create')
    setAppHash('admin', 'contentores', 'criar')
  }

  function openEdit(item) {
    setDetailId(null)
    setEditingId(item.id)
    setView('edit')
    setAppHash('admin', 'contentores', 'editar', item.id)
  }

  function openDetail(item) {
    setEditingId(null)
    setDetailId(item.id)
    setView('detail')
    setAppHash('admin', 'contentores', 'detalhe', item.id)
  }

  const editingItem = useMemo(() => {
    if (!editingId) return null
    return items.find((item) => item.id === editingId) ?? null
  }, [items, editingId])

  function handleRegistoSuccess() {
    goToList()
    loadList()
  }

  if (view === 'detail' && detailId) {
    return (
      <ContentorDetalhe
        contentorId={detailId}
        onBack={goToList}
        onEdit={openEdit}
      />
    )
  }

  if (view === 'create') {
    return (
      <ContentorRegisto
        onCancel={goToList}
        onSuccess={handleRegistoSuccess}
      />
    )
  }

  if (view === 'edit') {
    if (loading) {
      return (
        <p className="admin-contentores__status" role="status">
          A carregar contentor…
        </p>
      )
    }
    if (!editingItem) {
      return (
        <p className="admin-contentores__status admin-contentores__status--muted">
          Contentor não encontrado.{' '}
          <button type="button" className="admin-contentores__back-link" onClick={goToList}>
            Voltar à lista
          </button>
        </p>
      )
    }
    return (
      <ContentorRegisto
        contentorToEdit={editingItem}
        onCancel={goToList}
        onSuccess={handleRegistoSuccess}
      />
    )
  }

  return (
    <>
      <div className="admin-contentores">
        <div className="admin-contentores__hero-wrap">
          <img
            src={contentoresHero}
            alt=""
            className="admin-contentores__hero"
            width={353}
            height={130}
          />
        </div>

        <div className="admin-contentores__toolbar">
          <label className="admin-contentores__search">
            <FontAwesomeIcon icon={faMagnifyingGlass} className="admin-contentores__search-icon" aria-hidden />
            <input
              type="search"
              className="admin-contentores__search-input"
              placeholder="Pesquisar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Pesquisar contentores"
            />
          </label>
          <button
            type="button"
            className="admin-contentores__add"
            aria-label="Adicionar contentor"
            onClick={openCreate}
          >
            <FontAwesomeIcon icon={faPlus} className="admin-contentores__add-icon" aria-hidden />
          </button>
        </div>

        {loading ? (
          <p className="admin-contentores__status" role="status">
            A carregar contentores…
          </p>
        ) : null}

        {!loading && loadError && items.length === 0 ? (
          <p className="admin-contentores__status admin-contentores__status--muted">
            Não foi possível carregar os contentores. Tenta novamente mais tarde ou contacta o suporte.
          </p>
        ) : null}

        {!loading && !loadError && items.length === 0 ? (
          <p className="admin-contentores__status admin-contentores__status--muted">
            Ainda não existem contentores registados.
          </p>
        ) : null}

        {!loading && items.length > 0 && filteredItems.length === 0 ? (
          <p className="admin-contentores__status admin-contentores__status--muted">
            Nenhum contentor corresponde à pesquisa.
          </p>
        ) : null}

        {!loading && filteredItems.length > 0 ? (
          <ul className="admin-contentores__list">
            {filteredItems.map((item) => (
              <li key={item.id}>
                <ContentorCard
                  cid={item.cid}
                  litros={item.litros}
                  localizacao={item.localizacaoAtualMorada || item.localizacao}
                  cliente={item.clienteAtualLabel || '—'}
                  estado={item.estado}
                  estadoLabel={item.estadoLabel}
                  onEditClick={() => openEdit(item)}
                  onLocationClick={() => {
                    const locationLabel =
                      item.locationDetail ||
                      item.localizacaoAtualMorada ||
                      item.localizacao ||
                      ''
                    const query = formatLocationQuery({
                      location: locationLabel,
                      lat: item.localizacaoAtualLat,
                      lng: item.localizacaoAtualLng,
                    })
                    if (!query) return
                    setLocationMap({
                      query,
                      title: item.clienteAtualLabel || item.cid,
                      subtitle: locationLabel || query,
                    })
                  }}
                  onScanClick={() =>
                    setQrPreview({ cid: item.cid, qrcodeImageUrl: item.qrcodeUrl })
                  }
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <ContentorQrModal
        isOpen={Boolean(qrPreview)}
        cid={qrPreview?.cid ?? ''}
        qrcodeImageUrl={qrPreview?.qrcodeImageUrl ?? ''}
        onClose={() => setQrPreview(null)}
      />
    </>
  )
}
