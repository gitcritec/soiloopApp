/**
 * Códigos LER (api::codigo-ler.codigo-ler) — tabela auxiliar.
 */

import { STRAPI_JWT_STORAGE_KEY } from './strapiAuth.js'

function strapiBaseUrl() {
  const raw = import.meta.env.VITE_STRAPI_URL
  if (!raw || typeof raw !== 'string') return ''
  return raw.replace(/\/+$/, '')
}

function authHeaders() {
  const jwt = localStorage.getItem(STRAPI_JWT_STORAGE_KEY)
  return jwt ? { Authorization: `Bearer ${jwt}` } : {}
}

function pickString(value) {
  if (value == null) return null
  const s = String(value).trim()
  return s || null
}

function parseStrapiListRows(json) {
  const data = json?.data
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') return [data]
  return []
}

/**
 * @typedef {object} CodigoLerItem
 * @property {string} id
 * @property {string} [documentId]
 * @property {string} codigo
 * @property {string} descricao
 * @property {string} label
 */

/**
 * @param {unknown} row
 * @returns {CodigoLerItem|null}
 */
export function coerceCodigoLerRow(row) {
  if (!row || typeof row !== 'object') return null
  const attrs = row.attributes && typeof row.attributes === 'object' ? row.attributes : row
  const id = pickString(row.documentId ?? attrs.documentId ?? row.id ?? attrs.id)
  if (!id) return null
  const codigo = pickString(attrs.codigo ?? row.codigo)
  if (!codigo) return null
  const descricao = pickString(attrs.descricao ?? row.descricao) ?? ''
  return {
    id,
    documentId: pickString(row.documentId ?? attrs.documentId) ?? undefined,
    codigo,
    descricao,
    label: descricao ? `${codigo} — ${descricao}` : codigo,
  }
}

/**
 * Extrai lista de códigos LER de uma relação Strapi no movimento.
 * @param {unknown} raw
 * @returns {CodigoLerItem[]}
 */
export function coerceCodigosLerRelation(raw) {
  if (raw == null) return []
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.data)
      ? raw.data
      : raw?.data
        ? [raw.data]
        : []
  /** @type {Map<string, CodigoLerItem>} */
  const byId = new Map()
  for (const row of list) {
    const item = coerceCodigoLerRow(row)
    if (item) byId.set(item.id, item)
  }
  return [...byId.values()].sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt'))
}

/**
 * @returns {Promise<CodigoLerItem[]>}
 */
export async function fetchStrapiCodigosLer() {
  const base = strapiBaseUrl()
  if (!base) return []

  const params = new URLSearchParams()
  params.set('sort', 'codigo:asc')
  params.set('pagination[pageSize]', '200')

  const res = await fetch(`${base}/api/codigo-lers?${params.toString()}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error('Sem permissão para ver códigos LER. Contacta o suporte.')
    }
    throw new Error(`Não foi possível carregar os códigos LER (HTTP ${res.status}).`)
  }

  const json = await res.json().catch(() => ({}))
  return parseStrapiListRows(json)
    .map(coerceCodigoLerRow)
    .filter(Boolean)
    .sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt'))
}

/**
 * @param {{ codigo: string, descricao?: string }} payload
 * @returns {Promise<CodigoLerItem>}
 */
export async function createStrapiCodigoLer(payload) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  const codigo = pickString(payload.codigo)
  if (!codigo) throw new Error('Indica o código LER.')

  const data = {
    codigo,
    descricao: pickString(payload.descricao) ?? '',
  }

  const res = await fetch(`${base}/api/codigo-lers`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  })

  if (!res.ok) {
    let message = `Não foi possível criar o código LER (HTTP ${res.status}).`
    try {
      const json = await res.json()
      const detail = json?.error?.message
      if (detail) message = detail
    } catch {
      /* ignore */
    }
    if (res.status === 403) {
      throw new Error('Sem permissão para criar códigos LER. No Strapi: ativa create em Código LER.')
    }
    throw new Error(message)
  }

  const json = await res.json().catch(() => ({}))
  const item = coerceCodigoLerRow(json?.data ?? json)
  if (!item) throw new Error('Resposta inválida ao criar código LER.')
  return item
}

/**
 * @param {string} id documentId ou id
 * @param {{ codigo: string, descricao?: string }} payload
 * @returns {Promise<CodigoLerItem>}
 */
export async function updateStrapiCodigoLer(id, payload) {
  const key = pickString(id)
  if (!key) throw new Error('Código LER em falta.')

  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  const codigo = pickString(payload.codigo)
  if (!codigo) throw new Error('Indica o código LER.')

  const data = {
    codigo,
    descricao: pickString(payload.descricao) ?? '',
  }

  const res = await fetch(`${base}/api/codigo-lers/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  })

  if (!res.ok) {
    let message = `Não foi possível atualizar o código LER (HTTP ${res.status}).`
    try {
      const json = await res.json()
      const detail = json?.error?.message
      if (detail) message = detail
    } catch {
      /* ignore */
    }
    if (res.status === 403) {
      throw new Error('Sem permissão para editar códigos LER. No Strapi: ativa update em Código LER.')
    }
    throw new Error(message)
  }

  const json = await res.json().catch(() => ({}))
  const item = coerceCodigoLerRow(json?.data ?? json)
  if (!item) throw new Error('Resposta inválida ao atualizar código LER.')
  return item
}

/**
 * @param {string} id documentId ou id
 */
export async function deleteStrapiCodigoLer(id) {
  const key = pickString(id)
  if (!key) throw new Error('Código LER em falta.')

  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  const res = await fetch(`${base}/api/codigo-lers/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })

  if (!res.ok) {
    if (res.status === 403) {
      throw new Error('Sem permissão para apagar códigos LER. No Strapi: ativa delete em Código LER.')
    }
    throw new Error(`Não foi possível apagar o código LER (HTTP ${res.status}).`)
  }
}

/**
 * Payload de relação manyToMany para gravar no movimento.
 * @param {string[]} ids
 * @returns {Record<string, unknown>|undefined}
 */
export function buildCodigosLerRelationWrite(ids = []) {
  const refs = [...new Set(ids.map((value) => pickString(value)).filter(Boolean))]
  if (refs.length === 0) return undefined
  const resolved = refs.map((ref) => (/^\d+$/.test(ref) ? Number(ref) : ref))
  return {
    set: resolved,
  }
}
