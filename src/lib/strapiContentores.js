/**
 * Contentores — api::contentor.contentor (Strapi).
 * Relação `capacidade` → api::capacidade.capacidade (campo Litros).
 */

import { createContentorQrcodePngBlob } from './contentorQrcodeImage.js'
import { getStoredStrapiUserRefs, STRAPI_JWT_STORAGE_KEY } from './strapiAuth.js'

/** Valores do enum `estado` no Strapi. */
export const CONTENTOR_ESTADOS = ['Novo', 'Usado', 'Danificado']

/** Valores do enum `situacao` no Strapi. */
export const CONTENTOR_SITUACOES = ['Armazem', 'Cliente', 'EmTransito']

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
function pickNumberField(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
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

/** @param {unknown} value */
function toIsoDateOnly(value) {
  if (value == null || value === '') return ''
  const s = pickString(value)
  if (s && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** @param {unknown} capacidade */
function extractCapacidadeId(capacidade) {
  if (!capacidade || typeof capacidade !== 'object') return ''
  const data = capacidade.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const nestedId = extractStrapiEntityId(data)
    if (nestedId) return nestedId
  }
  return extractStrapiEntityId(capacidade) ?? ''
}

function unwrapEntity(entity) {
  if (!entity || typeof entity !== 'object') return null
  const data = entity.data
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return { ...data, ...(data.attributes ?? {}) }
  }
  return { ...entity, ...(entity.attributes ?? {}) }
}

function pickRelationId(entity) {
  const unwrapped = unwrapEntity(entity)
  if (!unwrapped) return null
  return pickString(unwrapped.documentId ?? unwrapped.id)
}

function pickUserRelationRefs(userEntity) {
  const user = unwrapEntity(userEntity)
  if (!user) return { userId: null, userDocumentId: null }
  return {
    userId: pickString(user.id),
    userDocumentId: pickString(user.documentId),
  }
}

function pickUserDisplayName(userEntity) {
  const user = unwrapEntity(userEntity)
  if (!user) return ''
  return pickString(user.username) ?? pickString(user.email) ?? ''
}

const LOCALIZACAO_MORADA_KEYS = ['morada', 'endereco', 'localizacao', 'descricao', 'titulo', 'title']
const LOCALIZACAO_NOME_KEYS = ['nome', 'name', 'designacao', 'denominacao', 'label']

function includesIgnoreCase(haystack, needle) {
  if (!haystack || !needle) return false
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

/** @param {Record<string, unknown>|null|undefined} obj @param {string[]} keys */
function pickFirstStringField(obj, keys) {
  if (!obj || typeof obj !== 'object') return null
  for (const key of keys) {
    const value = pickString(obj[key])
    if (value) return value
  }
  return null
}

function joinLocalizacaoParts(morada, nome) {
  const m = morada?.trim()
  const n = nome?.trim()
  if (m && n) {
    if (includesIgnoreCase(m, n)) {
      return { location: n, locationPrefix: null, locationDetail: n }
    }
    return {
      location: n,
      locationPrefix: m,
      locationDetail: n,
    }
  }
  if (m) return { location: m, locationPrefix: null, locationDetail: m }
  if (n) return { location: n, locationPrefix: null, locationDetail: n }
  return { location: null, locationPrefix: null, locationDetail: null }
}

/**
 * @param {unknown} localizacaoEntity
 * @param {string|null|undefined} fallbackText
 */
function pickLocalizacaoAtualDisplay(localizacaoEntity, fallbackText) {
  const fromText = pickString(fallbackText)
  const loc = unwrapEntity(localizacaoEntity)
  if (!loc) {
    return fromText
      ? { location: fromText, locationPrefix: null, locationDetail: fromText }
      : { location: null, locationPrefix: null, locationDetail: null }
  }

  const moradaLike = pickFirstStringField(loc, LOCALIZACAO_MORADA_KEYS)
  const nome = pickFirstStringField(loc, LOCALIZACAO_NOME_KEYS)
  if (moradaLike && nome && includesIgnoreCase(moradaLike, nome)) {
    return { location: nome, locationPrefix: null, locationDetail: nome }
  }
  if (moradaLike && !nome) {
    return { location: moradaLike, locationPrefix: null, locationDetail: moradaLike }
  }
  const joined = joinLocalizacaoParts(moradaLike, nome)
  if (joined.location) return joined
  if (fromText) {
    return { location: fromText, locationPrefix: null, locationDetail: fromText }
  }
  return { location: null, locationPrefix: null, locationDetail: null }
}

function belongsToCurrentUser(userId, userDocumentId, currentUserRefs) {
  if (!(currentUserRefs instanceof Set) || currentUserRefs.size === 0) return false
  const refs = [userId, userDocumentId].filter(Boolean).map(String)
  return refs.some((ref) => currentUserRefs.has(ref))
}

function appendContentorPopulateParams(params) {
  params.set('populate[capacidade]', 'true')
  params.set('populate[qrcode]', 'true')
  params.set('populate[localizacaoAtual]', 'true')
  params.set('populate[clienteAtual]', 'true')
  return params
}

/**
 * @param {unknown} row
 * @returns {import('./strapiContentores.js').ContentorItem|null}
 */
function coerceContentorRow(row) {
  if (!row || typeof row !== 'object') return null
  const base = strapiBaseUrl()
  const attrs = row.attributes ?? row
  /** Strapi v5: rotas REST usam documentId; v4 usa id numérico. */
  const id = extractStrapiEntityId(row) ?? extractStrapiEntityId(attrs)
  const cid = pickString(attrs.CID ?? attrs.cid ?? row.CID)
  const localizacao = pickString(attrs.localizacao ?? row.localizacao)
  const numeroEgar = pickString(attrs.numero_egar ?? row.numero_egar)
  const qrcodeMedia = attrs.qrcode ?? row.qrcode
  const qrcodeUrl = pickMediaUrl(qrcodeMedia, base)
  const estadoRaw = pickString(attrs.estado ?? row.estado)
  const estado = normalizeContentorEstado(estadoRaw)
  const situacaoRaw = pickString(attrs.situacao ?? row.situacao)
  const situacao = normalizeContentorEstado(situacaoRaw)
  const dataRaw = attrs.data ?? row.data
  const capacidadeRaw = attrs.capacidade ?? row.capacidade
  const capacidadeId = extractCapacidadeId(capacidadeRaw)
  const litros = normalizeCapacidadeLitros(capacidadeRaw)
  const clienteAtualRaw = attrs.clienteAtual ?? row.clienteAtual
  const { userId: clienteAtualId, userDocumentId: clienteAtualDocumentId } =
    pickUserRelationRefs(clienteAtualRaw)
  const localizacaoAtualRaw = attrs.localizacaoAtual ?? row.localizacaoAtual
  const localizacaoAtualId = pickRelationId(localizacaoAtualRaw)
  const localizacaoAtualDisplay = pickLocalizacaoAtualDisplay(localizacaoAtualRaw, localizacao)
  const localizacaoAtualEntity = unwrapEntity(localizacaoAtualRaw)
  const localizacaoAtualLat = pickNumberField(localizacaoAtualEntity?.lat)
  const localizacaoAtualLng = pickNumberField(localizacaoAtualEntity?.lng)
  const clienteAtualLabel = pickUserDisplayName(clienteAtualRaw)

  if (!cid && id == null) return null

  return {
    id: id != null ? String(id) : cid ?? '',
    cid: cid ?? '—',
    localizacao: localizacao ?? localizacaoAtualDisplay.location ?? '—',
    localizacaoAtualId: localizacaoAtualId ?? '',
    localizacaoAtualMorada: localizacaoAtualDisplay.locationDetail ?? localizacaoAtualDisplay.location ?? '',
    locationPrefix: localizacaoAtualDisplay.locationPrefix,
    locationDetail: localizacaoAtualDisplay.locationDetail ?? localizacao ?? '',
    clienteAtualId: clienteAtualId ?? '',
    clienteAtualDocumentId: clienteAtualDocumentId ?? '',
    clienteAtualLabel,
    localizacaoAtualLat,
    localizacaoAtualLng,
    situacao,
    situacaoLabel: situacaoRaw ?? '',
    numeroEgar: numeroEgar ?? '',
    qrcodeUrl: qrcodeUrl ?? '',
    estado,
    estadoLabel: estadoRaw ?? '—',
    data: formatContentorDate(dataRaw),
    dataIso: toIsoDateOnly(dataRaw),
    capacidadeId,
    litros,
    litrosLabel: litros != null ? `${litros} L` : '—',
  }
}

/**
 * @typedef {object} ContentorItem
 * @property {string} id
 * @property {string} cid
 * @property {string} localizacao
 * @property {string} localizacaoAtualId
 * @property {string} localizacaoAtualMorada
 * @property {string|null} locationPrefix
 * @property {string|null} locationDetail
 * @property {string} clienteAtualId
 * @property {string} clienteAtualDocumentId
 * @property {string} clienteAtualLabel
 * @property {number|null} localizacaoAtualLat
 * @property {number|null} localizacaoAtualLng
 * @property {string|null} situacao
 * @property {string} situacaoLabel
 * @property {string} numeroEgar
 * @property {string} qrcodeUrl URL da imagem QR no Strapi (media)
 * @property {'novo'|'usado'|'danificado'|null} estado
 * @property {string} estadoLabel
 * @property {string} data
 * @property {string} dataIso Data ISO (YYYY-MM-DD) para formulários
 * @property {string} capacidadeId ID Strapi da relação capacidade
 * @property {number|null} litros
 * @property {string} litrosLabel
 */

/**
 * @typedef {object} ClienteContentorCardItem
 * @property {string} id CID do contentor
 * @property {string} contentorId
 * @property {string} [strapiId]
 * @property {string} [qrCode]
 * @property {string} [litrosLabel]
 * @property {string|null} [location]
 * @property {string|null} [locationPrefix]
 * @property {string|null} [locationDetail]
 * @property {string} [localizacaoId]
 * @property {string} [clienteLabel]
 * @property {number|null} [lat]
 * @property {number|null} [lng]
 * @property {string} estadoLabel
 * @property {boolean} [emRecolha]
 * @property {boolean} [canRequestPickup]
 * @property {string} [status]
 * @property {string} [scheduledAt]
 */

/**
 * Mapeia um contentor Strapi para o cartão «Meus Contentores» do cliente.
 * @param {ContentorItem} contentor
 * @param {Partial<ClienteContentorCardItem>} [fallback]
 * @param {Partial<ClienteContentorCardItem>|null} [pendingRecolha]
 * @returns {ClienteContentorCardItem|null}
 */
export function mapContentorToClienteCard(contentor, fallback = {}, pendingRecolha = null) {
  if (!contentor?.cid || contentor.cid === '—') return null

  const locationPrefix = contentor.locationPrefix ?? fallback.locationPrefix ?? null
  const locationDetail =
    contentor.locationDetail ??
    contentor.localizacaoAtualMorada ??
    contentor.localizacao ??
    fallback.locationDetail ??
    null
  const location =
    locationDetail ||
    fallback.location ||
    locationPrefix

  let estadoLabel = 'Reutilizável'
  if ((contentor.estadoLabel ?? '').toLowerCase() === 'danificado') {
    estadoLabel = 'Danificado'
  }
  const emRecolha = Boolean(pendingRecolha)

  const scheduledAt = pickCardDisplayDate(pendingRecolha, contentor, fallback)

  return {
    id: contentor.cid,
    contentorId: contentor.cid,
    strapiId: contentor.id,
    qrCode: fallback.qrCode ?? contentor.cid,
    litrosLabel:
      contentor.litrosLabel?.replace(/\s+L$/, 'L') ??
      fallback.litrosLabel ??
      (contentor.litros != null ? `${contentor.litros}L` : ''),
    location,
    locationPrefix,
    locationDetail,
    localizacaoId: contentor.localizacaoAtualId || fallback.localizacaoId || '',
    clienteLabel: contentor.clienteAtualLabel || fallback.clienteLabel || '',
    lat: contentor.localizacaoAtualLat ?? fallback.lat ?? null,
    lng: contentor.localizacaoAtualLng ?? fallback.lng ?? null,
    estadoLabel,
    emRecolha,
    canRequestPickup: !emRecolha,
    status: pendingRecolha?.status ?? fallback.status,
    scheduledAt,
  }
}

function pickCardDisplayDate(pendingRecolha, contentor, fallback) {
  if (pendingRecolha?.dataIso) {
    return formatContentorDate(pendingRecolha.dataIso)
  }
  const pendingText = pickString(pendingRecolha?.scheduledAt)
  if (pendingText) {
    const match = pendingText.match(/\d{2}\/\d{2}\/\d{4}/)
    if (match) return match[0]
  }
  if (contentor.data) return contentor.data
  const fallbackText = pickString(fallback?.scheduledAt)
  if (fallbackText) {
    const match = fallbackText.match(/\d{2}\/\d{2}\/\d{4}/)
    if (match) return match[0]
  }
  return ''
}

function isClienteSituacao(situacaoLabel) {
  const s = pickString(situacaoLabel)
  if (!s) return false
  return s.toLowerCase().replace(/\s+/g, '') === 'cliente'
}

/**
 * Lista contentores atribuídos ao cliente autenticado (`clienteAtual` + `situacao: Cliente`).
 * @returns {Promise<ContentorItem[]>}
 */
export async function fetchStrapiClienteContentores() {
  const base = strapiBaseUrl()
  if (!base) return []

  const currentUserRefs = getStoredStrapiUserRefs()
  if (currentUserRefs.size === 0) return []

  const numericId = [...currentUserRefs].find((ref) => /^\d+$/.test(ref))
  const documentId = [...currentUserRefs].find((ref) => !/^\d+$/.test(ref))

  /** @type {Record<string, string>[]} */
  const filterAttempts = [
    ...(numericId
      ? [
          {
            'filters[situacao][$eq]': 'Cliente',
            'filters[clienteAtual][id][$eq]': numericId,
          },
          { 'filters[clienteAtual][id][$eq]': numericId },
        ]
      : []),
    ...(documentId
      ? [
          {
            'filters[situacao][$eq]': 'Cliente',
            'filters[clienteAtual][documentId][$eq]': documentId,
          },
          { 'filters[clienteAtual][documentId][$eq]': documentId },
        ]
      : []),
    { 'filters[situacao][$eq]': 'Cliente' },
    {},
  ]

  /** @type {Map<string, ContentorItem>} */
  const byCid = new Map()
  let lastError = null

  for (const filters of filterAttempts) {
    try {
      const params = appendContentorPopulateParams(new URLSearchParams())
      params.set('sort', 'CID:asc')
      params.set('pagination[pageSize]', '100')
      for (const [key, value] of Object.entries(filters)) {
        if (value != null && value !== '') params.set(key, value)
      }

      const url = `${base}/api/contentores?${params.toString()}`
      const res = await fetch(url, { headers: authHeaders() })
      if (!res.ok) {
        throw new Error(`Strapi contentores: HTTP ${res.status}`)
      }
      const json = await res.json()
      const rows = parseStrapiListRows(json)
      for (const row of rows) {
        const item = coerceContentorRow(row)
        if (!item) continue
        if (!belongsToCurrentUser(item.clienteAtualId, item.clienteAtualDocumentId, currentUserRefs)) {
          continue
        }
        if (!isClienteSituacao(item.situacaoLabel)) continue
        byCid.set(item.cid, item)
      }
      if (byCid.size > 0) break
    } catch (err) {
      lastError = err
    }
  }

  if (byCid.size === 0 && lastError) throw lastError
  return [...byCid.values()].sort((a, b) => a.cid.localeCompare(b.cid, 'pt'))
}

/**
 * Lista contentores com capacidade populada.
 * @returns {Promise<ContentorItem[]>}
 */
export async function fetchStrapiContentores() {
  const base = strapiBaseUrl()
  if (!base) return []

  const params = appendContentorPopulateParams(new URLSearchParams())
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

  const params = appendContentorPopulateParams(new URLSearchParams())
  params.set('filters[CID][$eq]', code)
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
    const docId = extractStrapiEntityId(row) ?? item.id
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

/**
 * @typedef {object} UpdateContentorPayload
 * @property {string} capacidadeId
 * @property {string} localizacao
 * @property {string} estado
 * @property {string} data
 */

/**
 * Atualiza um contentor existente (sem alterar CID nem QR).
 * @param {string} documentId
 * @param {UpdateContentorPayload} payload
 * @returns {Promise<ContentorItem>}
 */
export async function updateStrapiContentor(documentId, payload) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  const capacidadeRef = /^\d+$/.test(payload.capacidadeId)
    ? Number(payload.capacidadeId)
    : payload.capacidadeId

  const body = {
    data: {
      localizacao: payload.localizacao.trim(),
      estado: payload.estado,
      data: payload.data,
      capacidade: capacidadeRef,
    },
  }

  const res = await fetch(`${base}/api/contentores/${encodeURIComponent(documentId)}`, {
    method: 'PUT',
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
    if (res.status === 403) {
      throw new Error(
        'Sem permissão para atualizar contentores. No Strapi: Settings → Users & Permissions → Roles → Authenticated → Contentor → ativa «update».',
      )
    }
    if (res.status === 404) {
      throw new Error(
        'Contentor não encontrado na API. Recarrega a lista e tenta de novo (o identificador pode ter mudado após atualização do Strapi).',
      )
    }
    throw new Error(message)
  }

  const json = await res.json()
  let row = json.data ?? json
  let item = coerceContentorRow(row)

  if (item && (!item.capacidadeId || !item.qrcodeUrl)) {
    const params = new URLSearchParams()
    params.set('populate[capacidade]', 'true')
    params.set('populate[qrcode]', 'true')
    const getRes = await fetch(
      `${base}/api/contentores/${encodeURIComponent(documentId)}?${params.toString()}`,
      { headers: authHeaders() },
    )
    if (getRes.ok) {
      const getJson = await getRes.json()
      row = getJson.data ?? getJson
      item = coerceContentorRow(row) ?? item
    }
  }

  if (!item) throw new Error('Resposta inválida ao atualizar contentor.')
  return item
}

function resolveContentorRelationRef(ref) {
  if (ref == null) return null
  const s = String(ref).trim()
  if (!s) return null
  if (/^\d+$/.test(s)) return Number(s)
  return s
}

function toDirectContentorRelationPayload(payload) {
  /** @type {Record<string, unknown>} */
  const next = { ...payload }
  for (const field of ['localizacaoAtual', 'clienteAtual', 'capacidade']) {
    const value = next[field]
    if (value && typeof value === 'object' && Array.isArray(value.connect) && value.connect.length > 0) {
      next[field] = value.connect[0]
    }
  }
  return next
}

async function putStrapiContentorRaw(documentId, data) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  const res = await fetch(`${base}/api/contentores/${encodeURIComponent(documentId)}`, {
    method: 'PUT',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  })

  if (!res.ok) {
    let errorJson = null
    try {
      errorJson = await res.json()
    } catch {
      errorJson = null
    }
    return { ok: false, status: res.status, errorJson }
  }

  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  const row = json?.data ?? json
  return { ok: true, data: coerceContentorRow(row) }
}

function formatContentorApiError(errorJson, fallback) {
  if (!errorJson || typeof errorJson !== 'object') return fallback
  const err = errorJson.error ?? errorJson
  const detail =
    err?.message ?? err?.details?.errors?.[0]?.message ?? errorJson?.message
  return detail ? String(detail) : fallback
}

function isInvalidContentorKeyError(errorJson) {
  const msg = String(errorJson?.error?.message ?? '').toLowerCase()
  return msg.includes('invalid key')
}

/**
 * @param {string} documentId
 * @param {Record<string, unknown>} data
 */
async function putStrapiContentorUpdate(documentId, data) {
  const primary = await putStrapiContentorRaw(documentId, data)
  if (primary.ok) return primary.data

  if (isInvalidContentorKeyError(primary.errorJson)) {
    const fallback = await putStrapiContentorRaw(documentId, toDirectContentorRelationPayload(data))
    if (fallback.ok) return fallback.data
    throw new Error(
      formatContentorApiError(
        fallback.errorJson,
        `Strapi contentores: HTTP ${fallback.errorJson?.error?.status ?? 400}`,
      ),
    )
  }

  if (primary.status === 403) {
    throw new Error(
      'Sem permissão para atualizar contentores. No Strapi: Settings → Users & Permissions → Roles → Authenticated → Contentor → ativa «update».',
    )
  }

  throw new Error(
    formatContentorApiError(primary.errorJson, `Strapi contentores: HTTP ${primary.status ?? 400}`),
  )
}

/**
 * @param {{ localizacaoAtualId?: string|null, clienteAtualId?: string|null, estado?: string|null, localizacao?: string|null }} fields
 */
function buildContentorEntregaUpdateVariants(fields) {
  const loc = resolveContentorRelationRef(fields.localizacaoAtualId)
  const cli = resolveContentorRelationRef(fields.clienteAtualId)
  const estado = pickString(fields.estado)
  const localizacao = pickString(fields.localizacao)

  /** @type {Record<string, unknown>[]} */
  const variants = []

  const scalar = { situacao: 'Cliente' }
  if (estado) scalar.estado = estado
  if (localizacao) scalar.localizacao = localizacao

  if (loc && cli) {
    variants.push({
      ...scalar,
      localizacaoAtual: { connect: [loc] },
      clienteAtual: { connect: [cli] },
    })
    variants.push({
      ...scalar,
      localizacaoAtual: loc,
      clienteAtual: cli,
    })
  }

  variants.push({
    ...scalar,
    ...(loc ? { localizacaoAtual: loc } : {}),
    ...(cli ? { clienteAtual: cli } : {}),
  })

  return variants
}

/**
 * @param {{ estado?: string|null, localizacao?: string|null }} [fields]
 */
function buildContentorRecolhaUpdateVariants(fields = {}) {
  const estado = pickString(fields.estado)
  const localizacao = pickString(fields.localizacao)

  const scalar = { situacao: 'Armazem' }
  if (estado) scalar.estado = estado
  if (localizacao) scalar.localizacao = localizacao

  return [
    { ...scalar, localizacaoAtual: null, clienteAtual: null },
    { ...scalar, localizacaoAtual: { disconnect: true }, clienteAtual: { disconnect: true } },
    { ...scalar, localizacaoAtual: { set: null }, clienteAtual: { set: null } },
  ]
}

/**
 * Atualiza situação do contentor após entrega no cliente.
 * @param {string} documentId
 * @param {{ localizacaoAtualId: string, clienteAtualId: string, estado?: string, localizacao?: string }} payload
 */
export async function applyStrapiContentorAfterEntrega(documentId, payload) {
  const key = pickString(documentId)
  if (!key) throw new Error('Contentor em falta.')

  const localizacaoAtualId = pickString(payload.localizacaoAtualId)
  const clienteAtualId = pickString(payload.clienteAtualId)
  if (!localizacaoAtualId) throw new Error('Localização do movimento em falta.')
  if (!clienteAtualId) throw new Error('Cliente do movimento em falta.')

  const variants = buildContentorEntregaUpdateVariants(payload)
  let lastError = null
  for (const data of variants) {
    try {
      return await putStrapiContentorUpdate(key, data)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Não foi possível atualizar o contentor.')
    }
  }
  throw lastError ?? new Error('Não foi possível atualizar o contentor após a entrega.')
}

/**
 * Atualiza situação do contentor após recolha (volta ao armazém).
 * @param {string} documentId
 * @param {{ estado?: string, localizacao?: string }} [payload]
 */
export async function applyStrapiContentorAfterRecolha(documentId, payload = {}) {
  const key = pickString(documentId)
  if (!key) throw new Error('Contentor em falta.')

  const variants = buildContentorRecolhaUpdateVariants(payload)
  let lastError = null
  for (const data of variants) {
    try {
      return await putStrapiContentorUpdate(key, data)
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Não foi possível atualizar o contentor.')
    }
  }
  throw lastError ?? new Error('Não foi possível atualizar o contentor após a recolha.')
}
