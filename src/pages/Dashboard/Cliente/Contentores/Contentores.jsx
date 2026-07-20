import { useMemo, useState } from 'react'
import {
  faLocationDot,
  faMagnifyingGlass,
  faPlus,
  faRecycle,
} from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import contentoresHero from '../../../../assets/figma-cliente/contentores-hero.png'
import SectionTitleWithIcon from '../../../../components/SectionTitleWithIcon/SectionTitleWithIcon.jsx'
import { IconContentor } from '../../../../components/icons/icons.jsx'
import './Contentores.css'

function resolveEstadoKey(estadoLabel) {
  const s = (estadoLabel ?? '').toLowerCase()
  if (s.includes('danificado')) return 'danificado'
  if (s.includes('novo')) return 'novo'
  return 'reutilizavel'
}

function ClienteContentorCard({ item, onLocationClick, onRequestPickup }) {
  const primaryEstadoLabel = item.estadoLabel ?? 'Reutilizável'
  const estadoKey = resolveEstadoKey(primaryEstadoLabel)
  const emRecolha = item.emRecolha === true
  const localizacao = item.locationDetail || item.location || item.locationPrefix || ''
  const canRequestPickup = item.canRequestPickup !== false

  return (
    <article className="cliente-contentor-card">
      <div className="cliente-contentor-card__icon-col">
        <IconContentor className="cliente-contentor-card__icon" aria-hidden />
      </div>

      <div className="cliente-contentor-card__body">
        <div className="cliente-contentor-card__head">
          <p className="cliente-contentor-card__id">{item.id}</p>
          <p className="cliente-contentor-card__specs">
            <span className="cliente-contentor-card__specs-litros">{item.litrosLabel ?? '—'}</span>
          </p>
          <p className="cliente-contentor-card__location">{localizacao}</p>
        </div>
      </div>

      <div className="cliente-contentor-card__badges">
        <span className={`cliente-contentor-card__estado cliente-contentor-card__estado--${estadoKey}`}>
          {primaryEstadoLabel}
        </span>
        {emRecolha ? (
          <span className="cliente-contentor-card__recolha-badge">Em recolha</span>
        ) : null}
      </div>

      <div className="cliente-contentor-card__actions">
        <button
          type="button"
          className="cliente-contentor-card__btn cliente-contentor-card__btn--location"
          aria-label="Ver localização"
          onClick={onLocationClick}
        >
          <FontAwesomeIcon icon={faLocationDot} aria-hidden />
        </button>
        <button
          type="button"
          className="cliente-contentor-card__btn cliente-contentor-card__btn--recycle"
          aria-label="Solicitar recolha"
          disabled={!canRequestPickup}
          onClick={onRequestPickup}
        >
          <FontAwesomeIcon icon={faRecycle} aria-hidden />
        </button>
      </div>
    </article>
  )
}

/**
 * Lista de contentores instalados do cliente — Figma 240:10236.
 */
export default function Contentores({
  items = [],
  loading = false,
  loadError = false,
  onLocationClick,
  onRequestPickup,
  onAddContentor,
  variant = 'page',
}) {
  const isDashboard = variant === 'dashboard'
  const [search, setSearch] = useState('')

  const filteredItems = useMemo(() => {
    if (isDashboard) return items
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const haystack = [
        item.id,
        item.qrCode,
        item.litrosLabel,
        item.locationPrefix,
        item.locationDetail,
        item.estadoLabel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [isDashboard, items, search])

  const listContent = (
    <>
      {loading ? (
        <p className={isDashboard ? 'cliente-dashboard__state' : 'cliente-contentores__status'} role="status">
          A carregar contentores…
        </p>
      ) : null}

      {!loading && loadError && items.length === 0 ? (
        <p
          className={
            isDashboard
              ? 'cliente-dashboard__state'
              : 'cliente-contentores__status cliente-contentores__status--error'
          }
          role="alert"
        >
          Não foi possível carregar os contentores instalados.
        </p>
      ) : null}

      {!loading && !loadError && items.length === 0 ? (
        <p className={isDashboard ? 'cliente-dashboard__state' : 'cliente-contentores__status'}>
          Não existem contentores instalados.
        </p>
      ) : null}

      {!loading && !isDashboard && items.length > 0 && filteredItems.length === 0 ? (
        <p className="cliente-contentores__status">Nenhum contentor corresponde à pesquisa.</p>
      ) : null}

      {!loading && filteredItems.length > 0 ? (
        <ul className="cliente-contentores__list">
          {filteredItems.map((item) => (
            <li key={item.id}>
              <ClienteContentorCard
                item={item}
                onLocationClick={() => onLocationClick?.(item)}
                onRequestPickup={() => onRequestPickup?.(item)}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  )

  if (isDashboard) {
    return (
      <section className="cliente-dashboard__section" aria-labelledby="cliente-sec-contentores">
        <SectionTitleWithIcon
          id="cliente-sec-contentores"
          title="Meus Contentores"
          icon={<IconContentor className="cliente-dashboard__section-contentor-icon" />}
          iconSize="large"
          titleTone="swapped"
        />
        <div className="cliente-dashboard__cards">{listContent}</div>
      </section>
    )
  }

  return (
    <div className="cliente-contentores">
      <SectionTitleWithIcon
        id="cliente-sec-contentores"
        title="Meus Contentores"
        icon={<IconContentor className="cliente-dashboard__section-contentor-icon" />}
        iconSize="large"
        titleTone="swapped"
      />

      <div className="cliente-contentores__hero-wrap">
        <img
          src={contentoresHero}
          alt=""
          className="cliente-contentores__hero"
          width={353}
          height={120}
        />
      </div>

      <div className="cliente-contentores__toolbar">
        <label className="cliente-contentores__search">
          <FontAwesomeIcon icon={faMagnifyingGlass} className="cliente-contentores__search-icon" aria-hidden />
          <input
            type="search"
            className="cliente-contentores__search-input"
            placeholder="Pesquisar"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Pesquisar contentores"
          />
        </label>
        <button
          type="button"
          className="cliente-contentores__tool-btn cliente-contentores__tool-btn--add"
          aria-label="Solicitar novo contentor"
          onClick={onAddContentor}
        >
          <FontAwesomeIcon icon={faPlus} aria-hidden />
        </button>
      </div>

      {listContent}
    </div>
  )
}
