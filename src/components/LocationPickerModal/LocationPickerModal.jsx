import { faLocationCrosshairs, faMagnifyingGlass, faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildGoogleMapsOpenUrl, searchLocationAddress } from '../../lib/locationQuery.js'
import './LocationPickerModal.css'

const DEFAULT_LAT = 38.7223
const DEFAULT_LNG = -9.1393
const LEAFLET_CSS_ID = 'leaflet-css-cdn'
const LEAFLET_JS_ID = 'leaflet-js-cdn'

let leafletPromise = null

function parseCoord(value) {
  if (value === '' || value == null) return null
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function formatCoord(value) {
  if (value == null || Number.isNaN(value)) return ''
  return String(Math.round(value * 1e6) / 1e6)
}

function ensureLeafletLoaded() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Janela indisponível.'))
  if (window.L) return Promise.resolve(window.L)
  if (leafletPromise) return leafletPromise

  leafletPromise = new Promise((resolve, reject) => {
    let css = document.getElementById(LEAFLET_CSS_ID)
    if (!css) {
      css = document.createElement('link')
      css.id = LEAFLET_CSS_ID
      css.rel = 'stylesheet'
      css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(css)
    }

    let js = document.getElementById(LEAFLET_JS_ID)
    if (js && window.L) {
      resolve(window.L)
      return
    }

    if (!js) {
      js = document.createElement('script')
      js.id = LEAFLET_JS_ID
      js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      js.async = true
      document.body.appendChild(js)
    }

    js.addEventListener('load', () => {
      if (window.L) resolve(window.L)
      else reject(new Error('Leaflet indisponível.'))
    })
    js.addEventListener('error', () => reject(new Error('Não foi possível carregar o mapa.')))
  })

  return leafletPromise
}

/**
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {{ lat?: number|null, lng?: number|null, label?: string }} [props.value]
 * @param {(coords: { lat: number, lng: number }) => void} props.onConfirm
 */
export default function LocationPickerModal({ isOpen, onClose, value, onConfirm }) {
  const [latText, setLatText] = useState('')
  const [lngText, setLngText] = useState('')
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [mapLoadError, setMapLoadError] = useState('')
  const [searchError, setSearchError] = useState('')
  const [geoError, setGeoError] = useState('')
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const mapElementRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  const applyCoords = useCallback((lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    setLatText(formatCoord(lat))
    setLngText(formatCoord(lng))
    setSearchResults([])
    if (mapRef.current) {
      const currentZoom = mapRef.current.getZoom()
      const nextZoom = Number.isFinite(currentZoom) ? Math.max(currentZoom, 15) : 15
      mapRef.current.setView([lat, lng], nextZoom)
      if (!markerRef.current && window.L) {
        markerRef.current = window.L.marker([lat, lng]).addTo(mapRef.current)
      } else if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng])
      }
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setLatText(formatCoord(value?.lat ?? DEFAULT_LAT))
    setLngText(formatCoord(value?.lng ?? DEFAULT_LNG))
    setSearchText('')
    setSearchResults([])
    setMapLoadError('')
    setSearchError('')
    setGeoError('')
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

  const openHref = buildGoogleMapsOpenUrl(mapQuery)
  const canConfirm = lat != null && lng != null

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    ensureLeafletLoaded()
      .then((L) => {
        if (cancelled || !mapElementRef.current) return
        if (!mapRef.current) {
          mapRef.current = L.map(mapElementRef.current, {
            zoomControl: true,
            attributionControl: false,
          })
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
          }).addTo(mapRef.current)
          mapRef.current.on('click', (ev) => {
            applyCoords(ev.latlng.lat, ev.latlng.lng)
          })
        }

        const startLat = value?.lat ?? DEFAULT_LAT
        const startLng = value?.lng ?? DEFAULT_LNG
        applyCoords(startLat, startLng)

        setTimeout(() => {
          if (!cancelled) mapRef.current?.invalidateSize()
        }, 0)
      })
      .catch((err) => {
        if (!cancelled) {
          setMapLoadError(err instanceof Error ? err.message : 'Não foi possível carregar o mapa.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, value?.lat, value?.lng, applyCoords])

  useEffect(() => {
    if (!isOpen || !mapRef.current || !markerRef.current) return
    if (lat == null || lng == null) return
    markerRef.current.setLatLng([lat, lng])
  }, [isOpen, lat, lng])

  async function handleSearch(e) {
    e.preventDefault()
    setSearchError('')
    const q = searchText.trim()
    if (q.length < 2) {
      setSearchError('Escreve pelo menos 2 caracteres para pesquisar.')
      return
    }

    setSearching(true)
    try {
      const results = await searchLocationAddress(q)
      setSearchResults(results)
      if (results.length === 0) setSearchError('Nenhum resultado encontrado.')
    } catch (err) {
      setSearchResults([])
      setSearchError(err instanceof Error ? err.message : 'Não foi possível pesquisar.')
    } finally {
      setSearching(false)
    }
  }

  function handlePickResult(result) {
    applyCoords(result.lat, result.lng)
    setSearchText(result.label.split(',')[0] ?? result.label)
    setSearchResults([])
  }

  function handleUseCurrentPosition() {
    setGeoError('')
    if (!navigator.geolocation) {
      setGeoError('O dispositivo não suporta localização GPS.')
      return
    }

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        applyCoords(pos.coords.latitude, pos.coords.longitude)
      },
      (err) => {
        setLocating(false)
        if (err.code === err.PERMISSION_DENIED) {
          setGeoError('Permissão de localização negada. Ativa o GPS nas definições do browser.')
        } else {
          setGeoError('Não foi possível obter a posição atual.')
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  }

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

        <form className="location-picker-modal__search-row" onSubmit={handleSearch}>
          <input
            type="search"
            className="location-picker-modal__search-input"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value)
              setSearchError('')
            }}
            placeholder="Pesquisar morada ou local…"
            aria-label="Pesquisar morada"
          />
          <button type="submit" className="location-picker-modal__search-btn" disabled={searching}>
            <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden />
          </button>
        </form>
        {searchError ? (
          <p className="location-picker-modal__inline-msg location-picker-modal__inline-msg--error">{searchError}</p>
        ) : null}
        {searchResults.length > 0 ? (
          <ul className="location-picker-modal__results">
            {searchResults.map((result) => (
              <li key={`${result.lat}-${result.lng}-${result.label}`}>
                <button type="button" className="location-picker-modal__result-btn" onClick={() => handlePickResult(result)}>
                  {result.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="location-picker-modal__map-toolbar">
          <button
            type="button"
            className="location-picker-modal__geo-btn"
            onClick={handleUseCurrentPosition}
            disabled={locating}
          >
            <FontAwesomeIcon icon={faLocationCrosshairs} className="location-picker-modal__geo-icon" aria-hidden />
            {locating ? 'A obter posição…' : 'Usar posição atual'}
          </button>
        </div>
        {geoError ? (
          <p className="location-picker-modal__inline-msg location-picker-modal__inline-msg--error">{geoError}</p>
        ) : null}

        <div className="location-picker-modal__map-wrap">
          <div ref={mapElementRef} className="location-picker-modal__map" />
        </div>
        {mapLoadError ? (
          <p className="location-picker-modal__hint location-picker-modal__hint--error">{mapLoadError}</p>
        ) : null}

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

        <p className="location-picker-modal__hint">Clica no mapa, pesquisa uma morada ou usa a tua posição atual.</p>

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
