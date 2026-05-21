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
  if (typeof media === 'object') {
    if (typeof media.url === 'string' && media.url) return media.url
    const formats = media.formats
    if (formats && typeof formats === 'object') {
      const sized =
        formats.small?.url ??
        formats.medium?.url ??
        formats.thumbnail?.url ??
        formats.large?.url
      if (sized) return sized
    }
    const nested = media.data?.attributes ?? media.data
    if (nested && typeof nested === 'object') {
      return pickMediaUrl(nested)
    }
  }
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

function removeHeadLinks(rel) {
  document.querySelectorAll(`link[rel="${rel}"]`).forEach((el) => el.remove())
}

/**
 * @param {string} rel
 * @param {string} href
 * @param {{ sizes?: string, type?: string }} [opts]
 */
function appendHeadLink(rel, href, opts = {}) {
  const link = document.createElement('link')
  link.setAttribute('rel', rel)
  link.setAttribute('href', href)
  if (opts.sizes) link.setAttribute('sizes', opts.sizes)
  if (opts.type) link.setAttribute('type', opts.type)
  document.head.appendChild(link)
}

let manifestBlobUrl = null

/**
 * Manifest PWA com ícones do favicon Strapi (ecrã principal no telemóvel).
 * @param {StrapiGlobalDocument} doc
 */
async function applyStrapiGlobalManifest(doc) {
  if (!doc.faviconUrl) return
  try {
    const res = await fetch('/manifest.webmanifest')
    const base = res.ok ? await res.json() : {}
    const name = doc.siteName ?? base.name ?? 'Soiloop'
    const manifest = {
      name,
      short_name: name,
      description: doc.siteDescription ?? base.description ?? '',
      start_url: base.start_url ?? '/',
      scope: base.scope ?? '/',
      display: base.display ?? 'standalone',
      background_color: base.background_color ?? '#ffffff',
      theme_color: base.theme_color ?? '#15d67f',
      icons: [
        {
          src: doc.faviconUrl,
          sizes: '192x192',
          type: faviconMimeFromHref(doc.faviconUrl) ?? 'image/png',
          purpose: 'any',
        },
        {
          src: doc.faviconUrl,
          sizes: '512x512',
          type: faviconMimeFromHref(doc.faviconUrl) ?? 'image/png',
          purpose: 'any',
        },
        {
          src: doc.faviconUrl,
          sizes: '512x512',
          type: faviconMimeFromHref(doc.faviconUrl) ?? 'image/png',
          purpose: 'maskable',
        },
      ],
    }
    const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' })
    const url = URL.createObjectURL(blob)
    if (manifestBlobUrl) URL.revokeObjectURL(manifestBlobUrl)
    manifestBlobUrl = url
    let link = document.querySelector('link[rel="manifest"]')
    if (!link) {
      link = document.createElement('link')
      link.setAttribute('rel', 'manifest')
      document.head.appendChild(link)
    }
    link.setAttribute('href', url)
  } catch {
    /* mantém manifest estático */
  }
}

/**
 * Aplica título, meta e favicon do single type Global (`api::global.global`, campo `favicon`).
 * @param {StrapiGlobalDocument|null} doc
 */
export async function applyStrapiGlobalHead(doc) {
  if (!doc) return

  if (doc.siteName) {
    document.title = doc.siteName
    let appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]')
    if (!appleTitle) {
      appleTitle = document.createElement('meta')
      appleTitle.setAttribute('name', 'apple-mobile-web-app-title')
      document.head.appendChild(appleTitle)
    }
    appleTitle.setAttribute('content', doc.siteName)
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
    const mime = faviconMimeFromHref(doc.faviconUrl) ?? 'image/png'
    removeHeadLinks('icon')
    removeHeadLinks('shortcut icon')
    removeHeadLinks('apple-touch-icon')
    appendHeadLink('icon', doc.faviconUrl, { type: mime })
    appendHeadLink('apple-touch-icon', doc.faviconUrl, { sizes: '180x180' })
    await applyStrapiGlobalManifest(doc)
  }
}

/** @returns {Promise<string|null>} URL do campo `favicon` em Global. */
export async function fetchStrapiGlobalFaviconUrl() {
  const doc = await getStrapiGlobalDocument()
  return doc?.faviconUrl ?? null
}
