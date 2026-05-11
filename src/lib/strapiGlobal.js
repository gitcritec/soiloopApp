/**
 * Conteúdo do single type Global (api::global.global) no Strapi.
 */

function strapiBaseUrl() {
  const raw = import.meta.env.VITE_STRAPI_URL
  if (!raw || typeof raw !== 'string') return ''
  return raw.replace(/\/+$/, '')
}

function pickMediaUrl(media) {
  if (!media) return null
  if (typeof media === 'string') return media
  if (media.url) return media.url
  const nested = media.data?.attributes ?? media.data
  if (nested?.url) return nested.url
  return null
}

function absoluteMediaUrl(base, path) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

function pickString(value) {
  if (value == null) return null
  const s = String(value).trim()
  return s || null
}

/**
 * @typedef {object} StrapiGlobalDocument
 * @property {string|null} siteName
 * @property {string|null} siteDescription
 * @property {string|null} logoUrl
 * @property {string|null} logoSmallUrl
 * @property {string|null} faviconUrl
 */

let globalDocumentPromise = null

/**
 * Um único GET ao Global com populate dos media; resultado em cache na sessão da página.
 * @returns {Promise<StrapiGlobalDocument|null>}
 */
export function getStrapiGlobalDocument() {
  if (!globalDocumentPromise) {
    const base = strapiBaseUrl()
    if (!base) {
      globalDocumentPromise = Promise.resolve(null)
    } else {
      const params = new URLSearchParams()
      params.set('populate[logo]', 'true')
      params.set('populate[favicon]', 'true')
      params.set('populate[logo_small]', 'true')
      const endpoint = `${base}/api/global?${params.toString()}`
      globalDocumentPromise = (async () => {
        try {
          const res = await fetch(endpoint)
          if (!res.ok) return null
          const json = await res.json()
          const row = json.data
          if (!row) return null
          const attrs = row.attributes ?? row
          return {
            siteName: pickString(attrs.siteName ?? attrs.site_name),
            siteDescription: pickString(attrs.siteDescription ?? attrs.site_description),
            logoUrl: absoluteMediaUrl(base, pickMediaUrl(attrs.logo)),
            logoSmallUrl: absoluteMediaUrl(base, pickMediaUrl(attrs.logo_small)),
            faviconUrl: absoluteMediaUrl(base, pickMediaUrl(attrs.favicon)),
          }
        } catch {
          return null
        }
      })()
    }
  }
  return globalDocumentPromise
}

/**
 * URL pública do campo `logo` do Global.
 * @returns {Promise<string|null>}
 */
export async function fetchStrapiGlobalLogoUrl() {
  const doc = await getStrapiGlobalDocument()
  return doc?.logoUrl ?? null
}

/**
 * URL pública do campo `logo_small` do Global (api::global.global).
 * @returns {Promise<string|null>}
 */
export async function fetchStrapiGlobalLogoSmallUrl() {
  const doc = await getStrapiGlobalDocument()
  return doc?.logoSmallUrl ?? null
}

function faviconMimeFromHref(href) {
  const clean = href.split('?')[0].split('#')[0]
  const ext = clean.includes('.') ? clean.slice(clean.lastIndexOf('.') + 1).toLowerCase() : ''
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'ico') return 'image/x-icon'
  if (ext === 'webp') return 'image/webp'
  return null
}

/**
 * Aplica `document.title`, meta description e `link[rel="icon"]` a partir do documento Global.
 * @param {StrapiGlobalDocument|null} doc
 */
export function applyStrapiGlobalHead(doc) {
  if (!doc) return

  if (doc.siteName) {
    document.title = doc.siteName
  }

  if (doc.siteDescription) {
    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', doc.siteDescription)
  }

  if (doc.faviconUrl) {
    let link = document.querySelector('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', 'icon')
      document.head.appendChild(link)
    }
    link.setAttribute('href', doc.faviconUrl)
    const mime = faviconMimeFromHref(doc.faviconUrl)
    if (mime) link.setAttribute('type', mime)
    else link.removeAttribute('type')
  }
}
