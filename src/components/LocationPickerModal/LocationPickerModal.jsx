import { faLocationCrosshairs, faMagnifyingGlass, faMap, faSatellite, faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildGoogleMapsOpenUrl, searchLocationAddress } from '../../lib/locationQuery.js'
import './LocationPickerModal.css'

const DEFAULT_LAT = 38.7223
const DEFAULT_LNG = -9.1393
const LEAFLET_CSS_ID = 'leaflet-css-cdn'
const LEAFLET_JS_ID = 'leaflet-js-cdn'
const OSM_TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const SATELLITE_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const SATELLITE_LABELS =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'

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

function resolveStartCoords(value) {
  const lat = value?.lat != null ? parseCoord(value.lat) : null
  const lng = value?.lng != null ? parseCoord(value.lng) : null
  if (lat != null && lng != null) return { lat, lng }
  return { lat: DEFAULT_LAT, lng: DEFAULT_LNG }
}

const GEO_OPTIONS_CACHED = { enableHighAccuracy: false, timeout: 5000, maximumAge: Infinity }
const GEO_OPTIONS_PRIMARY = { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
const GEO_OPTIONS_FALLBACK = { enableHighAccuracy: false, timeout: 25000, maximumAge: 300000 }

async function isGeoPermissionDenied() {
  if (!navigator.permissions?.query) return false
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' })
    return status.state === 'denied'
  } catch {
    return false
  }
}

async function geoErrorMessage(err) {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'O GPS só funciona em HTTPS ou em localhost. Acede pela app em ligação segura.'
  }

  if (err?.code === 1 && (await isGeoPermissionDenied())) {
    return 'Permissão de localização negada. Ativa o GPS nas definições do browser.'
  }

  if (err?.code === 2) {
    return 'Sinal GPS indisponível. Escolhe a posição no mapa ou tenta novamente.'
  }
  if (err?.code === 3) {
    return 'Tempo esgotado ao obter GPS. Tenta novamente ou escolhe no mapa.'
  }
  return 'Não foi possível obter a posição atual. Escolhe no mapa ou tenta novamente.'
}

function requestCurrentPosition(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

function requestPositionViaWatch(options, maxWaitMs = 30000) {
  return new Promise((resolve, reject) => {
    let watchId = null
    let settled = false

    const finish = (fn, value) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (watchId != null) navigator.geolocation.clearWatch(watchId)
      fn(value)
    }

    const timer = setTimeout(() => finish(reject, { code: 3 }), maxWaitMs)

    watchId = navigator.geolocation.watchPosition(
      (pos) => finish(resolve, pos),
      (err) => {
        if (err?.code === 1) finish(reject, err)
      },
      options,
    )
  })
}

async function getCurrentCoords() {
  const attempts = [
    () => requestCurrentPosition(GEO_OPTIONS_CACHED),
    () => requestCurrentPosition(GEO_OPTIONS_PRIMARY),
    () => requestCurrentPosition(GEO_OPTIONS_FALLBACK),
    () => requestPositionViaWatch({ enableHighAccuracy: false, maximumAge: 60000 }, 30000),
    () => requestPositionViaWatch({ enableHighAccuracy: true, maximumAge: 0 }, 30000),
  ]

  let lastError = { code: 3 }
  for (const attempt of attempts) {
    try {
      return await attempt()
    } catch (err) {
      lastError = err
      if (err?.code === 1 && (await isGeoPermissionDenied())) throw err
    }
  }
  throw lastError
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
  const [mapStyle, setMapStyle] = useState('street')
  const mapElementRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const streetLayerRef = useRef(null)
  const satelliteBaseLayerRef = useRef(null)
  const satelliteLabelsLayerRef = useRef(null)

  const applyMapStyle = useCallback((style) => {
    const map = mapRef.current
    const L = window.L
    if (!map || !L) return

    if (streetLayerRef.current) map.removeLayer(streetLayerRef.current)
    if (satelliteBaseLayerRef.current) map.removeLayer(satelliteBaseLayerRef.current)
    if (satelliteLabelsLayerRef.current) map.removeLayer(satelliteLabelsLayerRef.current)

    if (style === 'satellite') {
      if (!satelliteBaseLayerRef.current) {
        satelliteBaseLayerRef.current = L.tileLayer(SATELLITE_TILES, { maxZoom: 19 })
        satelliteLabelsLayerRef.current = L.tileLayer(SATELLITE_LABELS, { maxZoom: 19, opacity: 0.85 })
      }
      satelliteBaseLayerRef.current.addTo(map)
      satelliteLabelsLayerRef.current.addTo(map)
    } else {
      if (!streetLayerRef.current) {
        streetLayerRef.current = L.tileLayer(OSM_TILES, { maxZoom: 19 })
      }
      streetLayerRef.current.addTo(map)
    }
  }, [])

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
    const start = resolveStartCoords(value)
    setLatText(formatCoord(start.lat))
    setLngText(formatCoord(start.lng))
    setSearchText('')
    setSearchResults([])
    setMapLoadError('')
    setSearchError('')
    setGeoError('')
    setMapStyle('street')
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
          mapRef.current.on('click', (ev) => {
            applyCoords(ev.latlng.lat, ev.latlng.lng)
          })
        }

        applyMapStyle('street')

        const start = resolveStartCoords(value)
        applyCoords(start.lat, start.lng)

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!cancelled) mapRef.current?.invalidateSize()
          })
        })
      })
      .catch((err) => {
        if (!cancelled) {
          setMapLoadError(err instanceof Error ? err.message : 'Não foi possível carregar o mapa.')
        }
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, value?.lat, value?.lng, applyCoords, applyMapStyle])

  useEffect(() => {
    if (!isOpen || !mapRef.current) return
    applyMapStyle(mapStyle)
  }, [isOpen, mapStyle, applyMapStyle])

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

  async function handleUseCurrentPosition() {
    setGeoError('')
    if (!navigator.geolocation) {
      setGeoError('O dispositivo não suporta localização GPS.')
      return
    }
    setLocating(true)
    try {
      const pos = await getCurrentCoords()
      applyCoords(pos.coords.latitude, pos.coords.longitude)
    } catch (err) {
      setGeoError(await geoErrorMessage(err))
    } finally {
      setLocating(false)
    }
  }

  function handleToggleMapStyle() {
    setMapStyle((prev) => (prev === 'street' ? 'satellite' : 'street'))
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
          <button
            type="button"
            className="location-picker-modal__map-style-btn"
            onClick={handleToggleMapStyle}
            aria-pressed={mapStyle === 'satellite'}
          >
            <FontAwesomeIcon
              icon={mapStyle === 'street' ? faSatellite : faMap}
              className="location-picker-modal__map-style-icon"
              aria-hidden
            />
            {mapStyle === 'street' ? 'Satélite' : 'Mapa'}
          </button>
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
