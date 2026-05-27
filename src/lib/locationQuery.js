/**
 * Monta texto de pesquisa para Google Maps a partir dos campos do cartão / API.
 * @param {{ location?: string, locationPrefix?: string, locationDetail?: string, lat?: number, lng?: number }} fields
 */
export function formatLocationQuery({ location, locationPrefix, locationDetail, lat, lng }) {
  if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
    return `${lat},${lng}`
  }
  const single = (location ?? '').trim()
  if (single) return single
  const prefix = (locationPrefix ?? '').trim()
  const detail = (locationDetail ?? '').trim()
  if (prefix && detail) return `${prefix}, ${detail}`
  return prefix || detail
}

/** Mapa embutido na app (iframe), sem API key. */
export function buildGoogleMapsEmbedUrl(query) {
  const q = encodeURIComponent(query)
  return `https://www.google.com/maps?q=${q}&hl=pt&z=16&output=embed`
}

/** Abre a app / browser do Google Maps (navegação). */
export function buildGoogleMapsOpenUrl(query) {
  const q = encodeURIComponent(query)
  return `https://www.google.com/maps/search/?api=1&query=${q}`
}

const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'SoiloopApp/1.0 (location-picker)',
}

/**
 * Pesquisa de moradas (OpenStreetMap Nominatim).
 * @param {string} query
 * @returns {Promise<Array<{ label: string, lat: number, lng: number }>>}
 */
export async function searchLocationAddress(query) {
  const q = String(query ?? '').trim()
  if (q.length < 2) return []

  const params = new URLSearchParams({
    format: 'json',
    limit: '5',
    q,
    countrycodes: 'pt',
    'accept-language': 'pt',
  })

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: NOMINATIM_HEADERS,
  })
  if (!res.ok) throw new Error('Não foi possível pesquisar o endereço.')

  const rows = await res.json()
  if (!Array.isArray(rows)) return []

  return rows
    .map((row) => ({
      label: row.display_name,
      lat: Number(row.lat),
      lng: Number(row.lon),
    }))
    .filter((row) => row.label && Number.isFinite(row.lat) && Number.isFinite(row.lng))
}
