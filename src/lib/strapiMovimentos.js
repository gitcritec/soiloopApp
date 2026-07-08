import { STRAPI_JWT_STORAGE_KEY, getStoredStrapiUserRefs } from './strapiAuth.js'
import { fetchStrapiContentorByCid, fetchStrapiClienteContentores, mapContentorToClienteCard } from './strapiContentores.js'
import { normalizePeriodoForStrapi } from './movimentoPeriodo.js'

const MOVIMENTO_ESTADO_AGENDADO = 'agendado'
const MOVIMENTO_ESTADO_PEDIDO = 'pedido'
const MOVIMENTO_ESTADO_CONCLUIDO = 'concluido'
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

function pickClienteRelationRefs(clienteEntity) {
  const cliente = unwrapEntity(clienteEntity)
  if (!cliente) {
    return { clienteId: null, clienteDocumentId: null }
  }
  return {
    clienteId: pickString(cliente.id),
    clienteDocumentId: pickString(cliente.documentId),
  }
}

function movimentoBelongsToCliente(item, currentClienteIds) {
  if (!item || !(currentClienteIds instanceof Set) || currentClienteIds.size === 0) {
    return false
  }
  const refs = [item.clienteId, item.clienteDocumentId].filter(Boolean).map(String)
  if (refs.length > 0) {
    return refs.some((ref) => currentClienteIds.has(ref))
  }
  // Movimentos da API do cliente sem relação `cliente` preenchida (legado / permissões).
  return true
}

function movimentoBelongsToOtherCliente(item, currentClienteIds) {
  if (!item || !(currentClienteIds instanceof Set) || currentClienteIds.size === 0) {
    return false
  }
  const refs = [item.clienteId, item.clienteDocumentId].filter(Boolean).map(String)
  if (refs.length === 0) return false
  return !refs.some((ref) => currentClienteIds.has(ref))
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
    if (moradaLike && nome && includesIgnoreCase(moradaLike, nome)) {
      return { location: nome, locationPrefix: null, locationDetail: nome }
    }
    if (moradaLike && !nome) {
      return { location: moradaLike, locationPrefix: null, locationDetail: moradaLike }
    }
    const joined = joinLocalizacaoParts(moradaLike, nome)
    if (joined.location) return joined
  }

  return { location: null, locationPrefix: null, locationDetail: null }
}

function buildPedidoLocGroupKey(row) {
  const periodo = normalizeText(row.periodo ?? row.scheduledAt?.split(/\s+/).pop())
  return `${row.localizacaoId ?? 'none'}|${row.dateSortValue}|${periodo}`
}

function buildPedidoContainerGroupKey(contentorId, dateSortValue, periodo) {
  const periodoNorm = normalizeText(periodo)
  return `${contentorId ?? 'none'}|${dateSortValue}|${periodoNorm}`
}

function pickPedidoGroupContentorId(items) {
  const recolha = items.find(
    (item) =>
      item.taskType === 'recolher' &&
      item.contentorId &&
      item.contentorId !== 'Não definido',
  )
  if (recolha?.contentorId) return recolha.contentorId
  const withId = items.find((item) => item.id && item.id !== 'Não definido')
  return withId?.contentorId ?? withId?.id ?? null
}

function buildPedidoGroupTasks(siblings) {
  return siblings.map((item) => ({
    movimentoKey: item.movimentoKey,
    taskType: item.taskType,
    label: item.taskType === 'entregar' ? 'Entrega de contentor' : 'Recolha de contentor',
    collectionId: item.id,
  }))
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

/** Alinha morada e metadados de grupo (recolha + entrega: contentor + data + período). */
function enrichMovimentosPedidoGroups(rows) {
  const groups = new Map()

  for (const row of rows) {
    const key = buildPedidoLocGroupKey(row)
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }

  return rows.map((row) => {
    const siblings = groups.get(buildPedidoLocGroupKey(row)) ?? [row]
    const canonical = pickCanonicalPedidoLocation(siblings)
    const contentorId = pickPedidoGroupContentorId(siblings)
    const periodo = normalizeText(row.periodo ?? row.scheduledAt?.split(/\s+/).pop())
    const pedidoGroupKey = buildPedidoContainerGroupKey(contentorId, row.dateSortValue, periodo)
    const pedidoGroupMovimentoKeys = siblings.map((item) => item.movimentoKey).filter(Boolean)
    const pedidoGroupTasks = buildPedidoGroupTasks(siblings)

    return {
      ...row,
      pedidoGroupKey,
      pedidoGroupMovimentoKeys,
      pedidoGroupTasks,
      pedidoGroupContentorId: contentorId,
      pedidoGroupSiblingCount: siblings.length,
      ...(canonical?.location
        ? {
            location: canonical.location,
            locationPrefix: canonical.locationPrefix ?? row.locationPrefix,
            locationDetail: canonical.locationDetail ?? row.locationDetail,
          }
        : {}),
    }
  })
}

/** @param {object} item */
export function getPedidoGroupMovimentoKeys(item) {
  const keys = item?.pedidoGroupMovimentoKeys
  if (Array.isArray(keys) && keys.length > 0) {
    return keys.filter(Boolean)
  }
  const single = pickString(item?.movimentoKey)
  return single ? [single] : []
}

function isPedidoTrocarGroup(items) {
  if (!Array.isArray(items) || items.length < 2) return false
  const types = new Set(items.map((item) => item.taskType))
  return types.has('recolher') && types.has('entregar')
}

function pickRecolhaFromPedidoGroup(items) {
  return (
    items.find((item) => item.taskType === 'recolher') ??
    items.find((item) => item.contentorId && item.contentorId !== 'Não definido') ??
    items[0]
  )
}

function buildTrocarDisplayCard(siblings) {
  const recolha = pickRecolhaFromPedidoGroup(siblings)
  const contentorId =
    recolha.pedidoGroupContentorId ?? recolha.contentorId ?? recolha.id ?? 'Não definido'

  return {
    ...recolha,
    id: contentorId,
    taskType: 'trocar',
    pedidoDisplayMode: 'trocar',
    pedidoGroupMovimentoKeys: siblings.map((item) => item.movimentoKey).filter(Boolean),
    pedidoGroupTasks: buildPedidoGroupTasks(siblings),
    pedidoGroupContentorId: contentorId,
    pedidoGroupSiblingCount: siblings.length,
  }
}

/**
 * Agrupa par recolha+entrega (trocar contentor) num único card de listagem.
 * @param {Array<object>} rows
 */
export function collapseMovimentosPedidoCards(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return []

  const groups = new Map()
  const groupOrder = []

  for (const row of rows) {
    const key =
      row.pedidoGroupKey ??
      pickString(row.movimentoKey) ??
      `${row.id ?? 'item'}|${row.dateSortValue}|${row.taskType}`
    if (!groups.has(key)) {
      groups.set(key, [])
      groupOrder.push(key)
    }
    groups.get(key).push(row)
  }

  return groupOrder.map((key) => {
    const siblings = groups.get(key) ?? []
    if (isPedidoTrocarGroup(siblings)) return buildTrocarDisplayCard(siblings)
    return siblings[0]
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

function formatDateTime(value) {
  const raw = pickString(value)
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${minutes}`
}

function pickHistoricoScheduledAt(attrs, dateLabel, periodo) {
  const updated = formatDateTime(attrs.updatedAt ?? attrs.publishedAt)
  if (updated) return updated
  if (dateLabel && periodo) {
    const p = normalizeText(periodo)
    if (p === 'indiferente') return dateLabel
    const periodTime = p === 'tarde' ? '14:00' : '10:00'
    return `${dateLabel} ${periodTime}`
  }
  return dateLabel
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

function isEstadoConcluido(value) {
  const s = normalizeText(value)
  return (
    s === MOVIMENTO_ESTADO_CONCLUIDO ||
    s === 'concluida' ||
    s === 'finalizado' ||
    s === 'finalizada'
  )
}

function normalizeEstadoKey(value) {
  if (isEstadoPedido(value)) return MOVIMENTO_ESTADO_PEDIDO
  if (isEstadoAgendado(value)) return MOVIMENTO_ESTADO_AGENDADO
  if (isEstadoConcluido(value)) return MOVIMENTO_ESTADO_CONCLUIDO
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

function pickDataIso(value) {
  const raw = pickString(value)
  if (!raw) return ''
  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) return isoMatch[1]
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Data estritamente posterior a hoje (fim do dia). */
export function isMovimentoDateAfterToday(dateSortValue) {
  return Number.isFinite(dateSortValue) && dateSortValue > getTodayEndSortValue()
}

export function canDeleteMovimentoCliente(item) {
  if (!item) return false
  if (item.estadoKey === MOVIMENTO_ESTADO_PEDIDO) return true
  return isMovimentoDateAfterToday(item.dateSortValue)
}

export function canEditMovimentoCliente(item) {
  if (!item) return false
  return item.estadoKey === MOVIMENTO_ESTADO_PEDIDO || item.estadoKey === MOVIMENTO_ESTADO_AGENDADO
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
  const { clienteId, clienteDocumentId } = pickClienteRelationRefs(attrs.cliente)
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
    clienteId: clienteId ?? fallback.clienteId,
    clienteDocumentId: clienteDocumentId ?? fallback.clienteDocumentId,
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
    dataIso: pickDataIso(attrs.data) || pickDataIso(fallback.dataIso),
    historicoScheduledAt:
      pickHistoricoScheduledAt(attrs, date, periodo) || fallback.historicoScheduledAt || '',
    completedAtSortValue: getDateSortValue(attrs.updatedAt ?? attrs.publishedAt ?? attrs.data),
  }
}

function getMovimentoTimelineSortValue(item) {
  const completed = item?.completedAtSortValue
  if (Number.isFinite(completed)) return completed
  return item?.dateSortValue ?? Number.POSITIVE_INFINITY
}

function pickLastConcluidoMovimento(items) {
  const concluidos = items.filter((item) => isEstadoConcluido(item.estado))
  if (concluidos.length === 0) return null
  return [...concluidos].sort(
    (a, b) => getMovimentoTimelineSortValue(a) - getMovimentoTimelineSortValue(b),
  ).at(-1)
}

function pickPendingRecolhaMovimento(items, currentClienteIds) {
  const pending = items.filter(
    (item) =>
      item.taskType === 'recolher' &&
      isEstadoPedidoVisivel(item.estado) &&
      movimentoBelongsToCliente(item, currentClienteIds),
  )
  if (pending.length === 0) return null
  return [...pending].sort(
    (a, b) => getMovimentoTimelineSortValue(a) - getMovimentoTimelineSortValue(b),
  ).at(-1)
}

/**
 * Contentor instalado no cliente quando o último movimento concluído do contentor
 * é uma entrega associada a este cliente. Recolha concluída posterior remove o contentor.
 */
function pickInstalledContentorMovimento(items, currentClienteIds) {
  const lastConcluido = pickLastConcluidoMovimento(items)
  if (!lastConcluido) return null
  if (lastConcluido.taskType === 'recolher') return null
  if (movimentoBelongsToOtherCliente(lastConcluido, currentClienteIds)) return null
  if (!movimentoBelongsToCliente(lastConcluido, currentClienteIds)) return null

  return lastConcluido
}

function resolveContentorDisplayMovimento(items, currentClienteIds) {
  const lastConcluido = pickLastConcluidoMovimento(items)
  const pendingRecolha = pickPendingRecolhaMovimento(items, currentClienteIds)
  const installedMovimento = pickInstalledContentorMovimento(items, currentClienteIds)

  if (lastConcluido?.taskType === 'recolher') return null

  if (
    lastConcluido?.taskType === 'entregar' &&
    movimentoBelongsToOtherCliente(lastConcluido, currentClienteIds)
  ) {
    return null
  }

  if (installedMovimento) {
    return { movimento: installedMovimento, hasPendingPickup: Boolean(pendingRecolha) }
  }

  if (pendingRecolha) {
    return { movimento: pendingRecolha, hasPendingPickup: true }
  }

  return null
}

function createContentorCardFromMovimentos(items, fallback = {}, currentClienteIds) {
  if (!items?.length) return null
  if (!(currentClienteIds instanceof Set) || currentClienteIds.size === 0) return null

  const resolved = resolveContentorDisplayMovimento(items, currentClienteIds)
  if (!resolved) return null

  const { movimento: displayMovimento, hasPendingPickup } = resolved

  return {
    ...fallback,
    ...displayMovimento,
    id: displayMovimento.contentorId ?? displayMovimento.id ?? fallback.id,
    qrCode:
      displayMovimento.qrCode ?? fallback.qrCode ?? displayMovimento.contentorId,
    litrosLabel:
      displayMovimento.litrosLabel ??
      fallback.litrosLabel ??
      displayMovimento.scheduledAt,
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

function addHistoricoSortParams(params) {
  params.set('sort', 'data:desc')
  params.set('pagination[pageSize]', '100')
  return params
}

function createEstadoMovimentosParamsHistorico(estado, withPopulate = true) {
  const params = new URLSearchParams()
  params.set('filters[estado][$eq]', estado)
  if (withPopulate) params.set('populate', '*')
  return addHistoricoSortParams(params)
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
        const pedidos = enrichMovimentosPedidoGroups(
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
 * Lista movimentos concluídos, ordenados por data (mais recentes primeiro).
 * @param {Array<object>} [fallbackRows]
 */
export async function fetchStrapiClienteMovimentosHistorico(fallbackRows = []) {
  const base = strapiBaseUrl()
  if (!base) return []

  const attempts = [
    createEstadoMovimentosParamsHistorico('concluido', true),
    createEstadoMovimentosParamsHistorico('Concluido', true),
    createEstadoMovimentosParamsHistorico('concluído', true),
    createEstadoMovimentosParamsHistorico('Concluído', true),
    createEstadoMovimentosParamsHistorico('concluido', false),
    createEstadoMovimentosParamsHistorico('Concluido', false),
  ]

  let lastError = null
  for (const params of attempts) {
    try {
      const rows = await fetchMovimentosRows(base, params)
      const historico = enrichMovimentosPedidoGroups(
        rows
          .map((row, index) => coerceMovimentoRow(row, fallbackRows[index]))
          .filter((item) => item && isEstadoConcluido(item.estado))
          .sort((a, b) => b.dateSortValue - a.dateSortValue),
      )
      if (historico.length > 0) return historico
    } catch (err) {
      lastError = err
    }
  }

  if (lastError) throw lastError
  return []
}

/**
 * Recolhas pendentes do cliente indexadas por CID do contentor.
 * @returns {Promise<Map<string, ReturnType<typeof coerceMovimentoRow>>>}
 */
async function fetchStrapiClientePendingRecolhasByContentor() {
  const base = strapiBaseUrl()
  /** @type {Map<string, NonNullable<ReturnType<typeof coerceMovimentoRow>>>} */
  const byContentor = new Map()
  if (!base) return byContentor

  const currentClienteIds = getStoredStrapiUserRefs()
  if (currentClienteIds.size === 0) return byContentor

  const attempts = [
    createEstadoMovimentosParams('pedido', true),
    createEstadoMovimentosParams('agendado', true),
    createEstadoMovimentosParams('Pedido', true),
    createEstadoMovimentosParams('Agendado', true),
  ]

  /** @type {Map<string, NonNullable<ReturnType<typeof coerceMovimentoRow>>>} */
  const merged = new Map()

  for (const params of attempts) {
    try {
      const rows = await fetchMovimentosRows(base, params)
      for (const row of rows) {
        const item = coerceMovimentoRow(row)
        if (!item?.contentorId || item.contentorId === 'Não definido') continue
        if (item.taskType !== 'recolher') continue
        if (!movimentoBelongsToCliente(item, currentClienteIds)) continue
        merged.set(item.movimentoKey, item)
      }
    } catch {
      /* tenta próximo estado */
    }
  }

  for (const item of merged.values()) {
    const cid = pickString(item.contentorId)
    if (!cid) continue
    const existing = byContentor.get(cid)
    if (!existing || item.dateSortValue < existing.dateSortValue) {
      byContentor.set(cid, item)
    }
  }

  return byContentor
}

/**
 * Lista contentores do cliente a partir da entidade Contentor (`clienteAtual`, `situacao`).
 * Enriquece com recolhas pendentes dos movimentos (estado «Em recolha»).
 * @param {Array<object>} [fallbackRows]
 */
export async function fetchStrapiClienteContentoresInstalados(fallbackRows = []) {
  const base = strapiBaseUrl()
  if (!base) return []

  const [contentores, pendingByCid] = await Promise.all([
    fetchStrapiClienteContentores(),
    fetchStrapiClientePendingRecolhasByContentor(),
  ])

  return contentores
    .map((contentor, index) =>
      mapContentorToClienteCard(contentor, fallbackRows[index], pendingByCid.get(contentor.cid) ?? null),
    )
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id, 'pt'))
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

function appendCapacidadeObservacoes(observacoes, capacidadeLabel) {
  const label = pickString(capacidadeLabel)
  if (!label) return pickString(observacoes) ?? ''
  const line = `Capacidade solicitada: ${label}`
  const base = pickString(observacoes)
  return base ? `${base}\n${line}` : line
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

/**
 * @typedef {object} CreateClienteSolicitacaoContentorPayload
 * @property {string} localizacaoId ID/documentId da relação Localização
 * @property {string} [localizacao]
 * @property {string} data Data no formato YYYY-MM-DD
 * @property {string} periodo
 * @property {string} [observacoes]
 * @property {string} capacidadeId ID Strapi da capacidade (referência interna)
 * @property {string} [capacidadeLabel] Ex.: "800 L" — gravado em observacoesCliente
 */

/**
 * Regista pedido de entrega de novo contentor (estado `pedido`, sem contentor associado).
 * @param {CreateClienteSolicitacaoContentorPayload} payload
 */
export async function createStrapiClienteSolicitacaoContentor(payload) {
  const data = pickString(payload.data)
  if (!data) throw new Error('Data em falta.')

  const periodo = normalizePeriodoForStrapi(payload.periodo)
  if (!periodo) throw new Error('Período em falta.')

  const capacidadeId = pickString(payload.capacidadeId)
  if (!capacidadeId) throw new Error('Capacidade em falta.')

  const localizacaoId = pickString(payload.localizacaoId)
  if (!localizacaoId) {
    throw new Error('Localização em falta. Não foi possível associar o pedido.')
  }

  const observacoes = appendCapacidadeObservacoes(payload.observacoes, payload.capacidadeLabel)

  /** @type {Record<string, unknown>} */
  const scalars = {
    estado: MOVIMENTO_ESTADO_PEDIDO,
    data,
    periodo,
    tipoMovimento: MOVIMENTO_TIPO_ENTREGA,
    ...(observacoes ? { observacoesCliente: observacoes } : {}),
  }

  await postStrapiMovimentoCreate(
    buildMovimentoCreatePayload(scalars, localizacaoId, null, false),
  )
}

/**
 * @param {string} movimentoKey documentId ou id do movimento
 * @param {{ data?: string, periodo?: string, estado?: string }} payload
 */
export async function updateStrapiMovimento(movimentoKey, payload) {
  const key = pickString(movimentoKey)
  if (!key) throw new Error('Movimento em falta.')

  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  /** @type {Record<string, unknown>} */
  const data = {}
  const nextData = pickString(payload.data)
  const nextPeriodo = normalizePeriodoForStrapi(payload.periodo)
  const nextEstado = pickString(payload.estado)

  if (nextData) data.data = nextData
  if (nextPeriodo) data.periodo = nextPeriodo
  if (nextEstado) data.estado = nextEstado

  if (Object.keys(data).length === 0) {
    throw new Error('Nada para atualizar.')
  }

  const res = await fetch(`${base}/api/movimentos/${encodeURIComponent(key)}`, {
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
    throw new Error(formatStrapiErrorJson(errorJson, `Strapi movimentos: HTTP ${res.status}`))
  }

  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return json?.data ?? json
}

/**
 * @param {string[]} movimentoKeys
 * @param {{ data?: string, periodo?: string, estado?: string }} payload
 */
export async function updateStrapiMovimentosBatch(movimentoKeys, payload) {
  const keys = [...new Set((movimentoKeys ?? []).map((key) => pickString(key)).filter(Boolean))]
  if (keys.length === 0) throw new Error('Movimento em falta.')
  await Promise.all(keys.map((key) => updateStrapiMovimento(key, payload)))
}

/**
 * @param {string} movimentoKey documentId ou id do movimento
 */
export async function deleteStrapiMovimento(movimentoKey) {
  const key = pickString(movimentoKey)
  if (!key) throw new Error('Movimento em falta.')

  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  const res = await fetch(`${base}/api/movimentos/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })

  if (!res.ok) {
    let errorJson = null
    try {
      errorJson = await res.json()
    } catch {
      errorJson = null
    }
    throw new Error(formatStrapiErrorJson(errorJson, `Strapi movimentos: HTTP ${res.status}`))
  }
}

/**
 * @param {string[]} movimentoKeys
 */
export async function deleteStrapiMovimentosBatch(movimentoKeys) {
  const keys = [...new Set((movimentoKeys ?? []).map((key) => pickString(key)).filter(Boolean))]
  if (keys.length === 0) throw new Error('Movimento em falta.')
  await Promise.all(keys.map((key) => deleteStrapiMovimento(key)))
}
