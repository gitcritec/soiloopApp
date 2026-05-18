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
