/**
 * Tabelas auxiliares de estados (físico, pedido, resíduo).
 * Mesmo padrão que códigos LER — CRUD em Definições.
 */

import { STRAPI_JWT_STORAGE_KEY } from './strapiAuth.js'

/** @typedef {'fisico'|'pedido'|'residuo'} EstadoAuxKind */

/** @type {Record<EstadoAuxKind, { path: string, label: string, labelPlural: string }>} */
export const ESTADO_AUX_CONFIG = {
  fisico: {
    path: 'estado-fisicos',
    label: 'Estado físico',
    labelPlural: 'Estados físicos',
  },
  pedido: {
    path: 'estado-pedidos',
    label: 'Estado pedido',
    labelPlural: 'Estados de pedido',
  },
  residuo: {
    path: 'estado-residuos',
    label: 'Estado do resíduo',
    labelPlural: 'Estados do resíduo',
  },
}

/** Valores sugeridos para seed manual no Strapi / Definições. */
export const ESTADO_AUX_SUGESTOES = {
  fisico: ['Bom', 'Danificado', 'Inativo'],
  pedido: ['Em trânsito', 'Pronto a Sair'],
  residuo: ['Contaminado', 'Não Contaminado'],
}

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
 * @typedef {object} EstadoAuxItem
 * @property {string} id
 * @property {string} [documentId]
 * @property {string} nome
 * @property {number} ordem
 * @property {string} label
 */

/**
 * @param {unknown} row
 * @returns {EstadoAuxItem|null}
 */
export function coerceEstadoAuxRow(row) {
  if (!row || typeof row !== 'object') return null
  const attrs = row.attributes && typeof row.attributes === 'object' ? row.attributes : row
  const id = pickString(row.documentId ?? attrs.documentId ?? row.id ?? attrs.id)
  if (!id) return null
  const nome = pickString(attrs.nome ?? row.nome)
  if (!nome) return null
  const ordemRaw = attrs.ordem ?? row.ordem
  const ordem = Number.isFinite(Number(ordemRaw)) ? Number(ordemRaw) : 0
  return {
    id,
    documentId: pickString(row.documentId ?? attrs.documentId) ?? undefined,
    nome,
    ordem,
    label: nome,
  }
}

/**
 * Extrai item de uma relação manyToOne Strapi.
 * @param {unknown} raw
 * @returns {EstadoAuxItem|null}
 */
export function coerceEstadoAuxRelation(raw) {
  if (raw == null) return null
  if (typeof raw === 'string' || typeof raw === 'number') {
    return { id: String(raw), nome: String(raw), ordem: 0, label: String(raw) }
  }
  const data = raw?.data ?? raw
  if (Array.isArray(data)) return coerceEstadoAuxRow(data[0])
  return coerceEstadoAuxRow(data)
}

/**
 * @param {string[]} ids
 * @returns {Record<string, unknown>|undefined}
 */
export function buildEstadoAuxRelationWrite(id) {
  const ref = pickString(id)
  if (!ref) return undefined
  const resolved = /^\d+$/.test(ref) ? Number(ref) : ref
  return { connect: [resolved] }
}

/**
 * @param {EstadoAuxKind} kind
 * @returns {Promise<EstadoAuxItem[]>}
 */
export async function fetchStrapiEstadosAux(kind) {
  const cfg = ESTADO_AUX_CONFIG[kind]
  if (!cfg) return []

  const base = strapiBaseUrl()
  if (!base) return []

  const params = new URLSearchParams()
  params.set('sort[0]', 'ordem:asc')
  params.set('sort[1]', 'nome:asc')
  params.set('pagination[pageSize]', '100')

  const res = await fetch(`${base}/api/${cfg.path}?${params.toString()}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(`Sem permissão para ver ${cfg.labelPlural}. Contacta o suporte.`)
    }
    throw new Error(`Não foi possível carregar ${cfg.labelPlural} (HTTP ${res.status}).`)
  }

  const json = await res.json().catch(() => ({}))
  return parseStrapiListRows(json)
    .map(coerceEstadoAuxRow)
    .filter(Boolean)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt'))
}

/**
 * @param {EstadoAuxKind} kind
 * @param {{ nome: string, ordem?: number }} payload
 * @returns {Promise<EstadoAuxItem>}
 */
export async function createStrapiEstadoAux(kind, payload) {
  const cfg = ESTADO_AUX_CONFIG[kind]
  if (!cfg) throw new Error('Tipo de estado inválido.')

  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  const nome = pickString(payload.nome)
  if (!nome) throw new Error(`Indica o nome do ${cfg.label.toLowerCase()}.`)

  const data = {
    nome,
    ordem: Number.isFinite(Number(payload.ordem)) ? Number(payload.ordem) : 0,
  }

  const res = await fetch(`${base}/api/${cfg.path}`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  })

  if (!res.ok) {
    let message = `Não foi possível criar ${cfg.label.toLowerCase()} (HTTP ${res.status}).`
    try {
      const json = await res.json()
      if (json?.error?.message) message = json.error.message
    } catch {
      /* ignore */
    }
    if (res.status === 403) {
      throw new Error(`Sem permissão para criar ${cfg.labelPlural}. No Strapi: ativa create.`)
    }
    throw new Error(message)
  }

  const json = await res.json().catch(() => ({}))
  const item = coerceEstadoAuxRow(json?.data ?? json)
  if (!item) throw new Error('Resposta inválida ao criar estado.')
  return item
}

/**
 * @param {EstadoAuxKind} kind
 * @param {string} id
 * @param {{ nome: string, ordem?: number }} payload
 * @returns {Promise<EstadoAuxItem>}
 */
export async function updateStrapiEstadoAux(kind, id, payload) {
  const cfg = ESTADO_AUX_CONFIG[kind]
  if (!cfg) throw new Error('Tipo de estado inválido.')

  const key = pickString(id)
  if (!key) throw new Error('Estado em falta.')

  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  const nome = pickString(payload.nome)
  if (!nome) throw new Error(`Indica o nome do ${cfg.label.toLowerCase()}.`)

  const data = {
    nome,
    ordem: Number.isFinite(Number(payload.ordem)) ? Number(payload.ordem) : 0,
  }

  const res = await fetch(`${base}/api/${cfg.path}/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  })

  if (!res.ok) {
    let message = `Não foi possível atualizar ${cfg.label.toLowerCase()} (HTTP ${res.status}).`
    try {
      const json = await res.json()
      if (json?.error?.message) message = json.error.message
    } catch {
      /* ignore */
    }
    if (res.status === 403) {
      throw new Error(`Sem permissão para editar ${cfg.labelPlural}. No Strapi: ativa update.`)
    }
    throw new Error(message)
  }

  const json = await res.json().catch(() => ({}))
  const item = coerceEstadoAuxRow(json?.data ?? json)
  if (!item) throw new Error('Resposta inválida ao atualizar estado.')
  return item
}

/**
 * @param {EstadoAuxKind} kind
 * @param {string} id
 */
export async function deleteStrapiEstadoAux(kind, id) {
  const cfg = ESTADO_AUX_CONFIG[kind]
  if (!cfg) throw new Error('Tipo de estado inválido.')

  const key = pickString(id)
  if (!key) throw new Error('Estado em falta.')

  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  const res = await fetch(`${base}/api/${cfg.path}/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })

  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(`Sem permissão para apagar ${cfg.labelPlural}. No Strapi: ativa delete.`)
    }
    throw new Error(`Não foi possível apagar ${cfg.label.toLowerCase()} (HTTP ${res.status}).`)
  }
}

export const fetchStrapiEstadosFisicos = () => fetchStrapiEstadosAux('fisico')
export const fetchStrapiEstadosPedido = () => fetchStrapiEstadosAux('pedido')
export const fetchStrapiEstadosResiduo = () => fetchStrapiEstadosAux('residuo')

function normalizeEstadoAuxNome(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * @param {string|null|undefined} estadoResiduoId
 * @param {EstadoAuxItem[]} [estadosResiduo]
 */
export function isEstadoResiduoContaminado(estadoResiduoId, estadosResiduo = []) {
  const id = pickString(estadoResiduoId)
  if (!id || !Array.isArray(estadosResiduo) || estadosResiduo.length === 0) return false
  const match = estadosResiduo.find((item) => item.id === id || item.documentId === id)
  if (!match) return false
  return normalizeEstadoAuxNome(match.nome) === 'contaminado'
}

/** @param {string|null|undefined} estadoResiduoId */
export async function isEstadoResiduoIdContaminado(estadoResiduoId) {
  if (!pickString(estadoResiduoId)) return false
  const estados = await fetchStrapiEstadosResiduo()
  return isEstadoResiduoContaminado(estadoResiduoId, estados)
}
