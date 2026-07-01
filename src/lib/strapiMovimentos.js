import { STRAPI_JWT_STORAGE_KEY } from './strapiAuth.js'
import { fetchStrapiContentorByCid } from './strapiContentores.js'

const MOVIMENTO_ESTADO_AGENDADO = 'agendado'
const MOVIMENTO_ESTADO_PEDIDO = 'pedido'
const MOVIMENTO_TIPO_RECOLHA = 'recolha'
const MOVIMENTO_TIPO_ENTREGA = 'entrega'

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

const LOCALIZACAO_MORADA_KEYS = ['morada', 'endereco', 'localizacao', 'descricao', 'titulo', 'title']
const LOCALIZACAO_NOME_KEYS = ['nome', 'name', 'designacao', 'denominacao', 'label']

function includesIgnoreCase(haystack, needle) {
  if (!haystack || !needle) return false
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

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
      return { location: m, locationPrefix: null, locationDetail: m }
    }
    return {
      location: `${m} ${n}`.trim(),
      locationPrefix: m,
      locationDetail: n,
    }
  }
  if (m) return { location: m, locationPrefix: null, locationDetail: m }
  if (n) return { location: n, locationPrefix: null, locationDetail: n }
  return { location: null, locationPrefix: null, locationDetail: null }
}

/**
 * @returns {{ location: string|null, locationPrefix: string|null, locationDetail: string|null }}
 */
function pickLocalizacaoDisplay(localizacaoEntity, contentor) {
  const fromContentor = pickString(contentor?.localizacao)
  if (fromContentor) {
    return { location: fromContentor, locationPrefix: null, locationDetail: fromContentor }
  }

  const loc = unwrapEntity(localizacaoEntity)
  if (loc) {
    const moradaLike = pickFirstStringField(loc, LOCALIZACAO_MORADA_KEYS)
    const nome = pickFirstStringField(loc, LOCALIZACAO_NOME_KEYS)
    if (moradaLike && (!nome || includesIgnoreCase(moradaLike, nome))) {
      return { location: moradaLike, locationPrefix: null, locationDetail: moradaLike }
    }
    const joined = joinLocalizacaoParts(moradaLike, nome)
    if (joined.location) return joined
  }

  return { location: null, locationPrefix: null, locationDetail: null }
}

function buildPedidoGroupKey(row) {
  const periodo = normalizeText(row.periodo ?? row.scheduledAt?.split(/\s+/).pop())
  return `${row.localizacaoId ?? 'none'}|${row.dateSortValue}|${periodo}`
}

function pickCanonicalPedidoLocation(items) {
  const recolha = items.find(
    (item) => item.taskType === 'recolher' && item.contentorId && item.location,
  )
  if (recolha) {
    return {
      location: recolha.location,
      locationPrefix: recolha.locationPrefix,
      locationDetail: recolha.locationDetail,
    }
  }

  const withLocation = items.filter((item) => item.location)
  if (withLocation.length === 0) return null

  const best = withLocation.reduce((current, item) =>
    item.location.length > current.location.length ? item : current,
  )
  return {
    location: best.location,
    locationPrefix: best.locationPrefix,
    locationDetail: best.locationDetail,
  }
}

/** Alinha a morada entre recolha + entrega do mesmo pedido (mesma data/período/localização). */
function enrichMovimentosPedidoLocation(rows) {
  const groups = new Map()

  for (const row of rows) {
    const key = buildPedidoGroupKey(row)
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }

  const patchByMovimentoKey = new Map()
  for (const items of groups.values()) {
    const canonical = pickCanonicalPedidoLocation(items)
    if (!canonical?.location) continue
    for (const item of items) {
      patchByMovimentoKey.set(item.movimentoKey, canonical)
    }
  }

  return rows.map((row) => {
    const patch = patchByMovimentoKey.get(row.movimentoKey)
    if (!patch) return row
    return {
      ...row,
      location: patch.location,
      locationPrefix: patch.locationPrefix ?? row.locationPrefix,
      locationDetail: patch.locationDetail ?? row.locationDetail,
    }
  })
}

function formatDate(value) {
  const raw = pickString(value)
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function parseDateOnly(value) {
  const raw = pickString(value)
  if (!raw) return null
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function getDateStatus(value) {
  const date = parseDateOnly(value)
  if (!date) return 'agendada'

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrow = addDays(today, 1)

  if (date.getTime() < today.getTime()) return 'atrasado'
  if (date.getTime() === today.getTime()) return 'hoje'
  if (date.getTime() === tomorrow.getTime()) return 'amanha'
  return 'agendada'
}

function normalizeTipoMovimento(value, fallback = 'recolher') {
  const raw = pickString(value)
  if (!raw) return fallback
  const s = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (s.includes('entrega') || s.includes('entregar')) return 'entregar'
  if (s.includes('recolha') || s.includes('recolher')) return 'recolher'
  return fallback
}

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizePeriodoForStrapi(value) {
  const s = normalizeText(value)
  if (s === 'manha') return 'manha'
  if (s === 'tarde') return 'tarde'
  return pickString(value) ?? ''
}

function isEstadoAgendado(value) {
  const s = normalizeText(value)
  return s === MOVIMENTO_ESTADO_AGENDADO || s === 'agendada'
}

function isEstadoPedido(value) {
  return normalizeText(value) === MOVIMENTO_ESTADO_PEDIDO
}

function isEstadoPedidoVisivel(value) {
  return isEstadoAgendado(value) || isEstadoPedido(value)
}

function normalizeEstadoKey(value) {
  if (isEstadoPedido(value)) return MOVIMENTO_ESTADO_PEDIDO
  if (isEstadoAgendado(value)) return MOVIMENTO_ESTADO_AGENDADO
  return normalizeText(value)
}

function pickContentorLitros(contentor, fallback) {
  const capacidade = unwrapEntity(contentor?.capacidade)
  const direct = [
    contentor?.litros,
    contentor?.Litros,
    contentor?.capacidade,
    capacidade?.Litros,
    capacidade?.litros,
    capacidade?.valor,
  ]
  for (const value of direct) {
    if (value != null && String(value).trim()) return `${String(value).trim()}L`
  }
  return fallback
}

function pickContentorQrCode(contentor, fallback) {
  return (
    pickString(
      contentor?.QRCode ??
        contentor?.qrCode ??
        contentor?.qrcode ??
        contentor?.QR ??
        contentor?.qr ??
        contentor?.codigo ??
        contentor?.Codigo,
    ) ??
    fallback ??
    ''
  )
}

function pickBinNumber(contentor, fallback) {
  const cid = pickString(contentor?.CID ?? contentor?.cid)
  const match = cid?.match(/(\d+)$/)
  if (match) return String(Number(match[1])).padStart(2, '0')
  return fallback
}

function getDateSortValue(value) {
  const raw = pickString(value)
  if (!raw) return Number.POSITIVE_INFINITY
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? Number.POSITIVE_INFINITY : d.getTime()
}

function getTodayEndSortValue() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime()
}

/**
 * @param {unknown} row
 * @param {Partial<import('../pages/Dashboard/Cliente/mockData.js').MockClientRequest>} [fallback]
 */
function coerceMovimentoRow(row, fallback = {}) {
  if (!row || typeof row !== 'object') return null
  const attrs = row.attributes ?? row
  const contentor = unwrapEntity(attrs.contentor)
  const localizacaoEntity = attrs.localizacao
  const localizacaoDisplay = pickLocalizacaoDisplay(localizacaoEntity, contentor)
  const localizacaoId = pickRelationId(localizacaoEntity)
  const movimentoKey =
    pickString(attrs.documentId ?? row.documentId ?? attrs.id ?? row.id) ??
    fallback.movimentoKey ??
    fallback.id ??
    'MOV-000'
  const contentorCid = pickString(contentor?.CID ?? contentor?.cid)
  const status = getDateStatus(attrs.data)
  const estado = pickString(attrs.estado) ?? MOVIMENTO_ESTADO_AGENDADO
  const date = formatDate(attrs.data)
  const periodo = pickString(attrs.periodo)
  const scheduledAt = [date, periodo].filter(Boolean).join(' ')
  const taskType = normalizeTipoMovimento(
    attrs.tipoMovimento ?? (contentorCid ? MOVIMENTO_TIPO_RECOLHA : MOVIMENTO_TIPO_ENTREGA),
    fallback.taskType,
  )
  const locationText =
    localizacaoDisplay.location ?? fallback.locationDetail ?? fallback.location ?? null

  return {
    id: contentorCid ?? 'Não definido',
    movimentoKey,
    location: locationText,
    locationPrefix: localizacaoDisplay.locationPrefix ?? fallback.locationPrefix,
    locationDetail:
      localizacaoDisplay.locationDetail ?? localizacaoDisplay.location ?? fallback.locationDetail,
    localizacaoId: localizacaoId ?? fallback.localizacaoId,
    periodo: normalizePeriodoForStrapi(periodo) || periodo || fallback.periodo,
    status,
    scheduledAt: scheduledAt || pickContentorLitros(contentor, fallback.scheduledAt ?? ''),
    binNumber: pickBinNumber(contentor, fallback.binNumber ?? '01'),
    taskType,
    contentorId: contentorCid ?? fallback.contentorId,
    qrCode: pickContentorQrCode(contentor, fallback.qrCode ?? contentorCid),
    litrosLabel: pickContentorLitros(contentor, fallback.litrosLabel ?? fallback.scheduledAt ?? ''),
    estado,
    estadoKey: normalizeEstadoKey(estado),
    dateSortValue: getDateSortValue(attrs.data),
  }
}

function createContentorCardFromMovimentos(items, fallback = {}) {
  const sorted = [...items].sort((a, b) => a.dateSortValue - b.dateSortValue)
  const todayEnd = getTodayEndSortValue()
  const effectiveItems = sorted.filter(
    (item) => !isEstadoPedido(item.estado) && item.dateSortValue <= todayEnd,
  )
  const lastEffective = effectiveItems[effectiveItems.length - 1]
  if (!lastEffective || lastEffective.taskType !== 'entregar') return null

  const hasPendingPickup = sorted.some(
    (item) => item.taskType === 'recolher' && isEstadoPedidoVisivel(item.estado),
  )

  return {
    ...fallback,
    ...lastEffective,
    id: lastEffective.contentorId ?? lastEffective.id ?? fallback.id,
    qrCode: lastEffective.qrCode ?? fallback.qrCode ?? lastEffective.contentorId,
    litrosLabel: lastEffective.litrosLabel ?? fallback.litrosLabel ?? lastEffective.scheduledAt,
    estadoLabel: hasPendingPickup ? 'Em recolha' : 'Reutilizável',
    canRequestPickup: !hasPendingPickup,
  }
}

async function fetchMovimentosRows(base, params) {
  const res = await fetch(`${base}/api/movimentos?${params.toString()}`, {
    headers: authHeaders(),
  })
  if (!res.ok) {
    let detail = ''
    try {
      const err = await res.json()
      detail = err?.error?.message ? ` — ${err.error.message}` : ''
    } catch {
      detail = ''
    }
    throw new Error(`Strapi movimentos: HTTP ${res.status}${detail}`)
  }

  const json = await res.json()
  return parseStrapiListRows(json)
}

function addMovimentosCommonParams(params) {
  params.set('sort', 'data:asc')
  params.set('pagination[pageSize]', '100')
  return params
}

function createEstadoMovimentosParams(estado, withPopulate = true) {
  const params = new URLSearchParams()
  params.set('filters[estado][$eq]', estado)
  if (withPopulate) params.set('populate', '*')
  return addMovimentosCommonParams(params)
}

function createAllMovimentosParams(withPopulate = true) {
  const params = new URLSearchParams()
  if (withPopulate) params.set('populate', '*')
  return addMovimentosCommonParams(params)
}

/**
 * Lista movimentos nos estados "agendado" e "pedido".
 * @param {Array<object>} [fallbackRows]
 */
export async function fetchStrapiClienteMovimentosAgendados(fallbackRows = []) {
  const base = strapiBaseUrl()
  if (!base) return []

  const attempts = [
    createAllMovimentosParams(true),
    createAllMovimentosParams(false),
    createEstadoMovimentosParams('agendado', true),
    createEstadoMovimentosParams('Agendado', true),
    createEstadoMovimentosParams('agendada', true),
    createEstadoMovimentosParams('Agendada', true),
    createEstadoMovimentosParams('pedido', true),
    createEstadoMovimentosParams('Pedido', true),
    createEstadoMovimentosParams('agendado', false),
    createEstadoMovimentosParams('Agendado', false),
    createEstadoMovimentosParams('agendada', false),
    createEstadoMovimentosParams('Agendada', false),
    createEstadoMovimentosParams('pedido', false),
    createEstadoMovimentosParams('Pedido', false),
  ]

  let lastError = null
  for (const params of attempts) {
    try {
      const rows = await fetchMovimentosRows(base, params)
      if (rows.length > 0) {
        const pedidos = enrichMovimentosPedidoLocation(
          rows
            .map((row, index) => coerceMovimentoRow(row, fallbackRows[index]))
            .filter((item) => item && isEstadoPedidoVisivel(item.estado))
            .sort((a, b) => a.dateSortValue - b.dateSortValue),
        )
        if (pedidos.length > 0 || !params.toString().includes('filters%5Bestado%5D')) {
          return pedidos
        }
      }
    } catch (err) {
      lastError = err
    }
  }

  if (lastError) throw lastError
  return []
}

/**
 * Lista contentores instalados no cliente a partir dos movimentos.
 * Um contentor está instalado quando o último movimento efetivo é uma entrega
 * e ainda não existe uma recolha efetiva posterior.
 * @param {Array<object>} [fallbackRows]
 */
export async function fetchStrapiClienteContentoresInstalados(fallbackRows = []) {
  const base = strapiBaseUrl()
  if (!base) return []

  const attempts = [
    createAllMovimentosParams(true),
    createAllMovimentosParams(false),
  ]

  let lastError = null
  for (const params of attempts) {
    try {
      const rows = await fetchMovimentosRows(base, params)
      if (rows.length === 0) continue

      const grouped = new Map()
      rows
        .map((row, index) => coerceMovimentoRow(row, fallbackRows[index]))
        .filter(Boolean)
        .forEach((item) => {
          const key = item.contentorId ?? item.id
          if (!key) return
          const current = grouped.get(key) ?? []
          current.push(item)
          grouped.set(key, current)
        })

      return Array.from(grouped.values())
        .map((items, index) => createContentorCardFromMovimentos(items, fallbackRows[index]))
        .filter(Boolean)
        .sort((a, b) => a.id.localeCompare(b.id, 'pt'))
    } catch (err) {
      lastError = err
    }
  }

  if (lastError) throw lastError
  return []
}

function resolveRelationRef(ref) {
  if (ref == null) return undefined
  const s = String(ref).trim()
  if (!s) return undefined
  if (/^\d+$/.test(s)) return Number(s)
  return s
}

function buildContentRelationConnect(ref) {
  const resolved = resolveRelationRef(ref)
  if (resolved == null) return undefined
  return { connect: [resolved] }
}

function buildMovimentoCreatePayload(scalars, localizacaoId, contentorId, withContentor) {
  const localizacao = buildContentRelationConnect(localizacaoId)
  if (!localizacao) throw new Error('Localização em falta.')

  /** @type {Record<string, unknown>} */
  const payload = {
    ...scalars,
    localizacao,
  }

  if (withContentor) {
    const contentor = buildContentRelationConnect(contentorId)
    if (!contentor) throw new Error('Contentor em falta.')
    payload.contentor = contentor
  }

  return payload
}

function toDirectRelationPayload(payload) {
  /** @type {Record<string, unknown>} */
  const next = { ...payload }
  for (const field of ['localizacao', 'contentor']) {
    const value = next[field]
    if (value && typeof value === 'object' && Array.isArray(value.connect) && value.connect.length > 0) {
      next[field] = value.connect[0]
    }
  }
  return next
}

function isTrocarContentorSim(value) {
  return normalizeText(value) === 'sim'
}

function formatStrapiErrorJson(errorJson, fallback) {
  if (!errorJson || typeof errorJson !== 'object') return fallback
  const err = errorJson.error ?? errorJson
  const validationErrors = err?.details?.errors
  if (Array.isArray(validationErrors) && validationErrors.length > 0) {
    return validationErrors
      .map((item) => {
        const path = Array.isArray(item?.path) ? item.path.join('.') : pickString(item?.path)
        const message = pickString(item?.message) ?? 'Valor inválido.'
        return path ? `${path}: ${message}` : message
      })
      .join(' · ')
  }

  const detail =
    err?.message ?? err?.details?.errors?.[0]?.message ?? errorJson?.message
  return detail ? String(detail) : fallback
}

function isInvalidKeyError(errorJson) {
  const msg = String(errorJson?.error?.message ?? '').toLowerCase()
  return msg.includes('invalid key')
}

async function parseStrapiMovimentoError(res, fallback) {
  try {
    const err = await res.json()
    return formatStrapiErrorJson(err, fallback)
  } catch {
    /* ignore */
  }
  return fallback
}

/**
 * @param {Record<string, unknown>} data
 * @returns {Promise<{ ok: true, data: unknown } | { ok: false, status: number, errorJson: unknown }>}
 */
async function postStrapiMovimentoRaw(data) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  const res = await fetch(`${base}/api/movimentos`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  })

  let errorJson = null
  if (!res.ok) {
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
  return { ok: true, data: json?.data ?? json }
}

/**
 * Cria um movimento com no máximo 2 tentativas (connect → ids diretos).
 * @param {Record<string, unknown>} data
 */
async function postStrapiMovimentoCreate(data) {
  const primary = await postStrapiMovimentoRaw(data)
  if (primary.ok) return primary.data

  if (isInvalidKeyError(primary.errorJson)) {
    const fallback = await postStrapiMovimentoRaw(toDirectRelationPayload(data))
    if (fallback.ok) return fallback.data
    throw new Error(
      formatStrapiErrorJson(
        fallback.errorJson,
        `Strapi movimentos: HTTP ${fallback.errorJson?.error?.status ?? 400}`,
      ),
    )
  }

  throw new Error(
    formatStrapiErrorJson(
      primary.errorJson,
      `Strapi movimentos: HTTP ${primary.errorJson?.error?.status ?? 400}`,
    ),
  )
}

/**
 * @typedef {object} CreateClienteSolicitacaoRecolhaPayload
 * @property {string} contentorId CID do contentor (ex.: CNT-001)
 * @property {string} [localizacaoId] ID/documentId da relação Localização
 * @property {string} localizacao
 * @property {string} data Data no formato YYYY-MM-DD
 * @property {string} periodo
 * @property {string} [observacoes]
 * @property {string} trocarContentor Sim/Não
 */

/**
 * Regista pedido(s) no Strapi (estado `pedido`).
 * Sempre cria `tipoMovimento: recolha` com contentor; se Trocar Contentor = Sim,
 * cria também `tipoMovimento: entrega` sem contentor associado.
 * @param {CreateClienteSolicitacaoRecolhaPayload} payload
 */
export async function createStrapiClienteSolicitacaoRecolha(payload) {
  const contentorCid = pickString(payload.contentorId)
  if (!contentorCid) throw new Error('Contentor em falta.')

  const data = pickString(payload.data)
  if (!data) throw new Error('Data em falta.')

  const periodo = normalizePeriodoForStrapi(payload.periodo)
  if (!periodo) throw new Error('Período em falta.')

  const localizacaoId = pickString(payload.localizacaoId)
  const observacoes = pickString(payload.observacoes)

  const contentor = await fetchStrapiContentorByCid(contentorCid)
  if (!contentor?.id) throw new Error('Contentor não encontrado.')

  if (!localizacaoId) {
    throw new Error('Localização do contentor em falta. Não foi possível associar o pedido.')
  }

  /** @type {Record<string, unknown>} */
  const scalars = {
    estado: MOVIMENTO_ESTADO_PEDIDO,
    data,
    periodo,
    ...(observacoes ? { observacoesCliente: observacoes } : {}),
  }

  await postStrapiMovimentoCreate(
    buildMovimentoCreatePayload(
      { ...scalars, tipoMovimento: MOVIMENTO_TIPO_RECOLHA },
      localizacaoId,
      contentor.id,
      true,
    ),
  )

  if (isTrocarContentorSim(payload.trocarContentor)) {
    await postStrapiMovimentoCreate(
      buildMovimentoCreatePayload(
        { ...scalars, tipoMovimento: MOVIMENTO_TIPO_ENTREGA },
        localizacaoId,
        null,
        false,
      ),
    )
  }
}
