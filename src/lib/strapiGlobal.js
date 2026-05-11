/**
 * Conteúdo do single type Global (api::global.global) no Strapi.
 */

function strapiBaseUrl() {
  const raw = import.meta.env.VITE_STRAPI_URL
  if (!raw || typeof raw !== 'string') return ''
  return raw.replace(/\/+$/, '')
}

function pickMediaUrl(logo) {
  if (!logo) return null
  if (typeof logo === 'string') return logo
  if (logo.url) return logo.url
  const nested = logo.data?.attributes ?? logo.data
  if (nested?.url) return nested.url
  return null
}

function absoluteMediaUrl(base, path) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

/**
 * URL pública do campo `logo` do Global.
 * @returns {Promise<string|null>}
 */
export async function fetchStrapiGlobalLogoUrl() {
  const base = strapiBaseUrl()
  if (!base) return null

  const endpoint = `${base}/api/global?populate=logo`

  try {
    const res = await fetch(endpoint)
    if (!res.ok) return null
    const json = await res.json()
    const row = json.data
    if (!row) return null
    const attrs = row.attributes ?? row
    const path = pickMediaUrl(attrs.logo)
    return absoluteMediaUrl(base, path)
  } catch {
    return null
  }
}
