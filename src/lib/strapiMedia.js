import { STRAPI_JWT_STORAGE_KEY } from './strapiAuth.js'

function strapiBaseUrl() {
  const raw = import.meta.env.VITE_STRAPI_URL
  if (!raw || typeof raw !== 'string') return ''
  return raw.replace(/\/+$/, '')
}

function mediaAuthHeaders() {
  const jwt = localStorage.getItem(STRAPI_JWT_STORAGE_KEY)
  return jwt ? { Authorization: `Bearer ${jwt}` } : {}
}

/**
 * Corrige URLs de media com host errado (ex.: IP interno do servidor Strapi).
 * @param {string} url
 */
export function normalizeStrapiMediaUrl(url) {
  if (!url || typeof url !== 'string') return url
  const base = strapiBaseUrl()
  if (!base) return url

  if (url.startsWith('/')) return `${base}${url}`

  try {
    const media = new URL(url)
    const origin = new URL(base).origin
    if (media.pathname.includes('/uploads/') && media.origin !== origin) {
      return `${origin}${media.pathname}${media.search}`
    }
  } catch {
    return url
  }

  return url
}

/**
 * Obtém media do Strapi com JWT (necessário para PDF em iframe e ficheiros protegidos).
 * @param {string} url
 * @returns {Promise<Blob>}
 */
export async function fetchStrapiMediaBlob(url) {
  const target = normalizeStrapiMediaUrl(url)
  const res = await fetch(target, {
    headers: mediaAuthHeaders(),
    mode: 'cors',
  })
  if (!res.ok) {
    throw new Error('Não foi possível carregar o ficheiro.')
  }
  const blob = await res.blob()
  if (!blob.size) {
    throw new Error('Ficheiro vazio ou indisponível.')
  }
  return blob
}
