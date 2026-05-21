/**
 * Contentores — api::contentor.contentor (Strapi).
 * Relação `capacidade` → api::capacidade.capacidade (campo Litros).
 */

import { createContentorQrcodePngBlob } from './contentorQrcodeImage.js'
import { STRAPI_JWT_STORAGE_KEY } from './strapiAuth.js'

/** Valores do enum `estado` no Strapi. */
export const CONTENTOR_ESTADOS = ['Novo', 'Usado', 'Danificado']

function strapiBaseUrl() {
  const raw = import.meta.env.VITE_STRAPI_URL
  if (!raw || typeof raw !== 'string') return ''
  return raw.replace(/\/+$/, '')
}

function authHeaders() {
  const jwt = localStorage.getItem(STRAPI_JWT_STORAGE_KEY)
  return jwt ? { Authorization: `Bearer ${jwt}` } : {}
}

function absoluteMediaUrl(base, path) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}

/** @param {unknown} media */
function pickMediaUrl(media, base) {
  if (!media) return null
  if (typeof media === 'string') return absoluteMediaUrl(base, media)
  if (typeof media === 'object') {
    const obj = media
    if (typeof obj.url === 'string') return absoluteMediaUrl(base, obj.url)
    const nested = obj.data?.attributes ?? obj.data
    if (nested && typeof nested === 'object' && typeof nested.url === 'string') {
      return absoluteMediaUrl(base, nested.url)
    }
  }
  return null
}

/** Referência para ligar media single no create/update (Strapi v4/v5). */
function pickMediaRef(media) {
  if (media == null) return null
  if (typeof media === 'number') return media
  if (typeof media === 'string' && /^\d+$/.test(media)) return Number(media)
  if (typeof media !== 'object') return null

  const candidates = [media.id, media.documentId, media.data?.id, media.data?.documentId]
  for (const c of candidates) {
    if (c != null && String(c).trim() !== '') {
      return /^\d+$/.test(String(c)) ? Number(c) : String(c)
    }
  }
  return null
}

/** @param {unknown} uploaded */
function pickUploadedFileRef(uploaded) {
  if (!uploaded) return null
  if (Array.isArray(uploaded)) return pickUploadedFileRef(uploaded[0])
  return pickMediaRef(uploaded) ?? pickMediaRef(uploaded?.data)
}

function pickString(value) {
  if (value == null) return null
  const s = String(value).trim()
  return s || null
}

/** @param {unknown} value */
function tryNum(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

const LITROS_FIELD_KEYS = ['Litros', 'litros', 'L', 'volume', 'capacidade', 'valor', 'Valor']

/** @param {Record<string, unknown>|null|undefined} obj */
function pickLitrosFromObject(obj) {
  if (!obj || typeof obj !== 'object') return null
  for (const key of LITROS_FIELD_KEYS) {
    const n = tryNum(obj[key])
    if (n != null) return n
  }
  return null
}

/** Linhas de uma resposta REST do Strapi (v4/v5). */
function parseStrapiListRows(json) {
  if (!json || typeof json !== 'object') return []
  const d = json.data
  if (Array.isArray(d)) return d
  if (d && typeof d === 'object') {
    if (Array.isArray(d.data)) return d.data
    if (Array.isArray(d.results)) return d.results
    if (d.id != null || d.documentId != null || d.attributes) return [d]
  }
  return []
}

/**
 * @param {unknown} row
 * @returns {string|null}
 */
function extractStrapiEntityId(row) {
  if (!row || typeof row !== 'object') return null
  const attrs = row.attributes
  const candidates = [row.documentId, row.id, attrs?.documentId, attrs?.id]
  for (const c of candidates) {
    if (c != null && String(c).trim() !== '') return String(c)
  }
  return null
}

/**
 * @param {unknown} capacidade
 * @returns {number|null}
 */
export function normalizeCapacidadeLitros(capacidade) {
  if (capacidade == null) return null
  if (typeof capacidade === 'number' && Number.isFinite(capacidade)) return capacidade
  if (typeof capacidade !== 'object') return tryNum(capacidade)

  const direct = pickLitrosFromObject(capacidade)
  if (direct != null) return direct

  const attrs = capacidade.attributes
  if (attrs && typeof attrs === 'object') {
    const fromAttrs = pickLitrosFromObject(attrs)
    if (fromAttrs != null) return fromAttrs
  }

  const data = capacidade.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const flat = pickLitrosFromObject(data)
    if (flat != null) return flat
    const nestedAttrs = data.attributes
    if (nestedAttrs && typeof nestedAttrs === 'object') {
      return pickLitrosFromObject(nestedAttrs)
    }
  }

  return null
}

/**
 * Slug CSS para badge de estado (Strapi + valores do design).
 * @param {string|null|undefined} estado
 * @returns {string|null}
 */
export function normalizeContentorEstado(estado) {
  const s = pickString(estado)
  if (!s) return null
  const lower = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const known = {
    novo: 'novo',
    usado: 'usado',
    danificado: 'danificado',
    'em transito': 'em-transito',
    cliente: 'cliente',
    infetado: 'infetado',
    armazem: 'armazem',
    reutilizavel: 'reutilizavel',
  }
  if (known[lower]) return known[lower]
  return lower.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || null
}

/** @param {string|null|undefined} iso */
export function formatContentorDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return pickString(iso) ?? ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

/**
 * @param {unknown} row
 * @returns {import('./strapiContentores.js').ContentorItem|null}
 */
function coerceContentorRow(row) {
  if (!row || typeof row !== 'object') return null
  const base = strapiBaseUrl()
  const attrs = row.attributes ?? row
  const id = row.id ?? row.documentId ?? attrs.id ?? attrs.documentId
  const cid = pickString(attrs.CID ?? attrs.cid ?? row.CID)
  const localizacao = pickString(attrs.localizacao ?? row.localizacao)
  const numeroEgar = pickString(attrs.numero_egar ?? row.numero_egar)
  const qrcodeMedia = attrs.qrcode ?? row.qrcode
  const qrcodeUrl = pickMediaUrl(qrcodeMedia, base)
  const estadoRaw = pickString(attrs.estado ?? row.estado)
  const estado = normalizeContentorEstado(estadoRaw)
  const dataRaw = attrs.data ?? row.data
  const litros = normalizeCapacidadeLitros(attrs.capacidade ?? row.capacidade)

  if (!cid && id == null) return null

  return {
    id: id != null ? String(id) : cid ?? '',
    cid: cid ?? '—',
    localizacao: localizacao ?? '—',
    numeroEgar: numeroEgar ?? '',
    qrcodeUrl: qrcodeUrl ?? '',
    estado,
    estadoLabel: estadoRaw ?? '—',
    data: formatContentorDate(dataRaw),
    litros,
    litrosLabel: litros != null ? `${litros} L` : '—',
  }
}

/**
 * @typedef {object} ContentorItem
 * @property {string} id
 * @property {string} cid
 * @property {string} localizacao
 * @property {string} numeroEgar
 * @property {string} qrcodeUrl URL da imagem QR no Strapi (media)
 * @property {'novo'|'usado'|'danificado'|null} estado
 * @property {string} estadoLabel
 * @property {string} data
 * @property {number|null} litros
 * @property {string} litrosLabel
 */

/**
 * Lista contentores com capacidade populada.
 * @returns {Promise<ContentorItem[]>}
 */
export async function fetchStrapiContentores() {
  const base = strapiBaseUrl()
  if (!base) return []

  const params = new URLSearchParams()
  params.set('populate[capacidade]', 'true')
  params.set('populate[qrcode]', 'true')
  params.set('sort', 'CID:asc')
  params.set('pagination[pageSize]', '100')

  const url = `${base}/api/contentores?${params.toString()}`

  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) {
    throw new Error(`Strapi contentores: HTTP ${res.status}`)
  }
  const json = await res.json()
  const rows = parseStrapiListRows(json)
  return rows.map(coerceContentorRow).filter(Boolean)
}

/**
 * Obtém um contentor pelo CID (ex.: CNT-001), para o formulário pós-QR.
 * @param {string} cid
 * @returns {Promise<ContentorItem|null>}
 */
export async function fetchStrapiContentorByCid(cid) {
  const code = pickString(cid)
  if (!code) return null

  const base = strapiBaseUrl()
  if (!base) return null

  const params = new URLSearchParams()
  params.set('filters[CID][$eq]', code)
  params.set('populate[capacidade]', 'true')
  params.set('populate[qrcode]', 'true')
  params.set('pagination[pageSize]', '1')

  const url = `${base}/api/contentores?${params.toString()}`
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) {
    throw new Error(`Strapi contentor: HTTP ${res.status}`)
  }
  const json = await res.json()
  const rows = parseStrapiListRows(json)
  const item = rows.map(coerceContentorRow).find(Boolean)
  return item ?? null
}

/**
 * @typedef {object} CapacidadeOption
 * @property {string} id
 * @property {number|null} litros
 * @property {string} label
 */

/**
 * @param {unknown} row
 * @returns {CapacidadeOption|null}
 */
function coerceCapacidadeRow(row) {
  if (!row || typeof row !== 'object') return null
  const attrs = row.attributes ?? row
  const id = extractStrapiEntityId(row)
  const litros = normalizeCapacidadeLitros(row) ?? normalizeCapacidadeLitros(attrs)
  if (!id) return null
  return {
    id,
    litros,
    label: litros != null ? `${litros} L` : `Capacidade ${id}`,
  }
}

/**
 * @param {string} path
 * @param {Record<string, string>} [extraParams]
 */
async function strapiGetCollection(path, extraParams = {}) {
  const base = strapiBaseUrl()
  if (!base) return { ok: false, status: 0, rows: [] }

  const params = new URLSearchParams()
  params.set('pagination[pageSize]', '100')
  for (const [key, value] of Object.entries(extraParams)) {
    if (value != null && value !== '') params.set(key, value)
  }

  const url = `${base}${path}?${params.toString()}`
  const res = await fetch(url, { headers: authHeaders() })
  let json = {}
  try {
    json = await res.json()
  } catch {
    json = {}
  }
  return { ok: res.ok, status: res.status, rows: parseStrapiListRows(json) }
}

/**
 * Lista opções de capacidade (api::capacidade.capacidade).
 * @returns {Promise<CapacidadeOption[]>}
 */
export async function fetchStrapiCapacidades() {
  const base = strapiBaseUrl()
  if (!base) return []

  /** @type {Map<string, CapacidadeOption>} */
  const byId = new Map()
  let lastStatus = 0
  let anyOk = false

  function mergeRows(rows) {
    for (const row of rows) {
      const opt = coerceCapacidadeRow(row)
      if (opt) byId.set(opt.id, opt)
    }
  }

  const attempts = [
    {},
    { sort: 'Litros:asc' },
    { sort: 'litros:asc' },
    { status: 'draft' },
    { publicationState: 'preview' },
  ]

  for (const extra of attempts) {
    const { ok, status, rows } = await strapiGetCollection('/api/capacidades', extra)
    lastStatus = status
    if (ok) {
      anyOk = true
      mergeRows(rows)
      if (byId.size > 0) break
    }
  }

  if (byId.size > 0) {
    return [...byId.values()].sort((a, b) => {
      if (a.litros == null && b.litros == null) return a.label.localeCompare(b.label, 'pt')
      if (a.litros == null) return 1
      if (b.litros == null) return -1
      return a.litros - b.litros
    })
  }

  if (!anyOk) {
    throw new Error(`Strapi capacidades: HTTP ${lastStatus || 0}`)
  }

  return []
}

const CONTENTOR_CID_PREFIX = 'CNT-'
const CONTENTOR_CID_PAD = 3
const CONTENTOR_CID_PATTERN = /^CNT-(\d+)$/i

/**
 * Próximo CID sequencial (CNT-001, CNT-002, …) a partir dos existentes.
 * @param {string[]} existingCids
 * @returns {string}
 */
export function generateNextContentorCid(existingCids = []) {
  let max = 0
  for (const raw of existingCids) {
    const s = pickString(raw)
    if (!s) continue
    const match = s.match(CONTENTOR_CID_PATTERN)
    if (match) max = Math.max(max, parseInt(match[1], 10))
  }
  return `${CONTENTOR_CID_PREFIX}${String(max + 1).padStart(CONTENTOR_CID_PAD, '0')}`
}

/**
 * Obtém o próximo CID consultando os contentores no Strapi.
 * @returns {Promise<string>}
 */
export async function resolveNextContentorCid() {
  const items = await fetchStrapiContentores()
  return generateNextContentorCid(items.map((item) => item.cid))
}

/** URL de imagem QR (fallback se ainda não existir media no Strapi). */
export function buildQrcodeImageUrl(text, size = 240) {
  const value = String(text ?? '').trim()
  if (!value) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`
}

/**
 * Faz upload de um ficheiro para o Strapi (`POST /api/upload`).
 * @param {Blob} blob
 * @param {string} filename
 * @returns {Promise<unknown>}
 */
async function uploadStrapiMedia(blob, filename) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  const form = new FormData()
  form.append('files', blob, filename)

  const res = await fetch(`${base}/api/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })

  if (!res.ok) {
    let message = `Strapi upload: HTTP ${res.status}`
    try {
      const err = await res.json()
      const detail = err?.error?.message ?? err?.message
      if (detail) message = String(detail)
    } catch {
      /* ignore */
    }
    if (res.status === 403) {
      throw new Error(
        'Sem permissão para enviar ficheiros (POST /api/upload). No Strapi: Settings → Users & Permissions → Roles → Authenticated → Upload → ativa «upload». Confirma também create em Contentor.',
      )
    }
    throw new Error(message)
  }

  return res.json()
}

/**
 * Gera QR com o CID, faz upload e devolve a referência do media.
 * @param {string} cid
 * @returns {Promise<string|number>}
 */
async function uploadContentorQrcodeMedia(cid) {
  const blob = await createContentorQrcodePngBlob(cid)
  const safeName = cid.replace(/[^a-zA-Z0-9-]/g, '_')
  const uploaded = await uploadStrapiMedia(blob, `${safeName}-qrcode.png`)
  const ref = pickUploadedFileRef(uploaded)
  if (ref == null) throw new Error('Upload do QR code sem ID de ficheiro na resposta do Strapi.')
  return ref
}

/**
 * @typedef {object} CreateContentorPayload
 * @property {string} [cid] Gerado automaticamente (CNT-001, …) se omitido
 * @property {string} capacidadeId
 * @property {string} localizacao
 * @property {string} estado
 * @property {string} data
 */

/**
 * Cria um contentor no Strapi.
 * @param {CreateContentorPayload} payload
 * @returns {Promise<ContentorItem>}
 */
export async function createStrapiContentor(payload) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  const cid = pickString(payload.cid) ?? (await resolveNextContentorCid())
  const qrcodeRef = await uploadContentorQrcodeMedia(cid)

  const capacidadeRef = /^\d+$/.test(payload.capacidadeId)
    ? Number(payload.capacidadeId)
    : payload.capacidadeId

  const body = {
    data: {
      CID: cid,
      localizacao: payload.localizacao.trim(),
      estado: payload.estado,
      data: payload.data,
      capacidade: capacidadeRef,
      qrcode: qrcodeRef,
    },
  }

  const res = await fetch(`${base}/api/contentores`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let message = `Strapi contentores: HTTP ${res.status}`
    try {
      const err = await res.json()
      const detail =
        err?.error?.message ??
        err?.error?.details?.errors?.[0]?.message ??
        err?.message
      if (detail) message = String(detail)
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }

  const json = await res.json()
  let row = json.data ?? json
  let item = coerceContentorRow(row)

  if (item && !item.qrcodeUrl) {
    const docId = row?.documentId ?? row?.id ?? item.id
    if (docId != null) {
      const params = new URLSearchParams()
      params.set('populate[qrcode]', 'true')
      const getRes = await fetch(`${base}/api/contentores/${docId}?${params.toString()}`, {
        headers: authHeaders(),
      })
      if (getRes.ok) {
        const getJson = await getRes.json()
        row = getJson.data ?? getJson
        item = coerceContentorRow(row) ?? item
      }
    }
  }

  if (!item) throw new Error('Resposta inválida ao criar contentor.')
  return item
}
