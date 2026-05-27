import { STRAPI_JWT_STORAGE_KEY } from './strapiAuth.js'

const MOVIMENTO_ESTADO_AGENDADO = 'agendado'
const MOVIMENTO_ESTADO_PEDIDO = 'pedido'

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
  const movimentoId = pickString(attrs.codigo ?? attrs.Codigo ?? attrs.referencia ?? attrs.Referencia)
  const contentorCid = pickString(contentor?.CID ?? contentor?.cid)
  const status = getDateStatus(attrs.data)
  const estado = pickString(attrs.estado) ?? MOVIMENTO_ESTADO_AGENDADO
  const date = formatDate(attrs.data)
  const periodo = pickString(attrs.periodo)
  const scheduledAt = [date, periodo].filter(Boolean).join(' ')

  return {
    id:
      contentorCid ??
      movimentoId ??
      pickString(attrs.documentId ?? row.documentId ?? attrs.id ?? row.id) ??
      fallback.id ??
      'MOV-000',
    location: pickString(contentor?.localizacao ?? attrs.localizacao) ?? fallback.location,
    locationPrefix:
      pickString(contentor?.clienteNome ?? contentor?.cliente ?? attrs.clienteNome) ??
      fallback.locationPrefix,
    locationDetail: pickString(contentor?.localizacao ?? attrs.localizacao) ?? fallback.locationDetail,
    status,
    scheduledAt: scheduledAt || pickContentorLitros(contentor, fallback.scheduledAt ?? ''),
    binNumber: pickBinNumber(contentor, fallback.binNumber ?? '01'),
    taskType: normalizeTipoMovimento(attrs.tipoMovimento, fallback.taskType),
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
        const pedidos = rows
          .map((row, index) => coerceMovimentoRow(row, fallbackRows[index]))
          .filter((item) => item && isEstadoPedidoVisivel(item.estado))
          .sort((a, b) => a.dateSortValue - b.dateSortValue)
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
