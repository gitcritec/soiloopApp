import { faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useMemo, useState } from 'react'
import { buildGoogleMapsEmbedUrl, buildGoogleMapsOpenUrl } from '../../lib/locationQuery.js'
import './LocationPickerModal.css'

const DEFAULT_LAT = 38.7223
const DEFAULT_LNG = -9.1393

function parseCoord(value) {
  if (value === '' || value == null) return null
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function formatCoord(value) {
  if (value == null || Number.isNaN(value)) return ''
  return String(Math.round(value * 1e6) / 1e6)
}

/**
 * Define coordenadas de uma localização (visual; gravação no registo em fase posterior).
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {{ lat?: number|null, lng?: number|null, label?: string }} [props.value]
 * @param {(coords: { lat: number, lng: number }) => void} props.onConfirm
 */
export default function LocationPickerModal({ isOpen, onClose, value, onConfirm }) {
  const [latText, setLatText] = useState('')
  const [lngText, setLngText] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setLatText(formatCoord(value?.lat ?? DEFAULT_LAT))
    setLngText(formatCoord(value?.lng ?? DEFAULT_LNG))
  }, [isOpen, value?.lat, value?.lng])

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  const lat = parseCoord(latText)
  const lng = parseCoord(lngText)
  const mapQuery = useMemo(() => {
    if (lat != null && lng != null) return `${lat},${lng}`
    const label = (value?.label ?? '').trim()
    return label || `${DEFAULT_LAT},${DEFAULT_LNG}`
  }, [lat, lng, value?.label])

  const embedSrc = buildGoogleMapsEmbedUrl(mapQuery)
  const openHref = buildGoogleMapsOpenUrl(mapQuery)
  const canConfirm = lat != null && lng != null

  function handleConfirm() {
    if (!canConfirm) return
    onConfirm?.({ lat, lng })
    onClose()
  }

  return (
    <div
      className={`location-picker-modal${isOpen ? ' location-picker-modal--open' : ''}`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        className="location-picker-modal__backdrop"
        aria-label="Fechar"
        tabIndex={isOpen ? 0 : -1}
        onClick={onClose}
      />
      <div
        className="location-picker-modal__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-picker-modal-title"
      >
        <header className="location-picker-modal__header">
          <div className="location-picker-modal__titles">
            <h2 id="location-picker-modal-title" className="location-picker-modal__title">
              Definir localização
            </h2>
            {value?.label ? (
              <p className="location-picker-modal__subtitle">{value.label}</p>
            ) : null}
          </div>
          <button type="button" className="location-picker-modal__close" aria-label="Fechar" onClick={onClose}>
            <FontAwesomeIcon icon={faXmark} className="location-picker-modal__close-icon" aria-hidden />
          </button>
        </header>

        <div className="location-picker-modal__map-wrap">
          {isOpen ? (
            <iframe
              className="location-picker-modal__map"
              title="Mapa para definir coordenadas"
              src={embedSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : null}
        </div>

        <div className="location-picker-modal__coords">
          <label className="location-picker-modal__coord-field">
            <span className="location-picker-modal__coord-label">Latitude</span>
            <input
              type="text"
              inputMode="decimal"
              className="location-picker-modal__coord-input"
              value={latText}
              onChange={(e) => setLatText(e.target.value)}
              placeholder="38.7223"
            />
          </label>
          <label className="location-picker-modal__coord-field">
            <span className="location-picker-modal__coord-label">Longitude</span>
            <input
              type="text"
              inputMode="decimal"
              className="location-picker-modal__coord-input"
              value={lngText}
              onChange={(e) => setLngText(e.target.value)}
              placeholder="-9.1393"
            />
          </label>
        </div>

        <p className="location-picker-modal__hint">
          Ajusta as coordenadas no mapa (valores abaixo). A gravação na ficha do cliente ficará disponível em breve.
        </p>

        <footer className="location-picker-modal__footer">
          <button
            type="button"
            className="location-picker-modal__confirm"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            Confirmar posição
          </button>
          <a
            className="location-picker-modal__open-link"
            href={openHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir no Google Maps
          </a>
        </footer>
      </div>
    </div>
  )
}
