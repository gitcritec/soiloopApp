import { fetchStrapiCurrentUser, STRAPI_JWT_STORAGE_KEY } from './strapiAuth.js'

const MOVIMENTO_ESTADO_AGENDADO = 'agendado'

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

function pickBinNumber(contentor, fallback) {
  const cid = pickString(contentor?.CID ?? contentor?.cid)
  const match = cid?.match(/(\d+)$/)
  if (match) return String(Number(match[1])).padStart(2, '0')
  return fallback
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
  const date = formatDate(attrs.data)
  const periodo = pickString(attrs.periodo)
  const scheduledAt = [date, periodo].filter(Boolean).join(' ')

  return {
    id:
      movimentoId ??
      pickString(attrs.documentId ?? row.documentId ?? attrs.id ?? row.id) ??
      fallback.id ??
      'MOV-000',
    location: pickString(contentor?.localizacao ?? attrs.localizacao) ?? fallback.location,
    locationPrefix:
      pickString(contentor?.clienteNome ?? contentor?.cliente ?? attrs.clienteNome) ??
      fallback.locationPrefix,
    locationDetail: pickString(contentor?.localizacao ?? attrs.localizacao) ?? fallback.locationDetail,
    status: 'agendada',
    scheduledAt: scheduledAt || pickContentorLitros(contentor, fallback.scheduledAt ?? ''),
    binNumber: pickBinNumber(contentor, fallback.binNumber ?? '01'),
    taskType: normalizeTipoMovimento(attrs.tipoMovimento, fallback.taskType),
    contentorId: contentorCid ?? fallback.contentorId,
    estado: pickString(attrs.estado) ?? MOVIMENTO_ESTADO_AGENDADO,
  }
}

/**
 * Lista movimentos do cliente autenticado no estado "agendado".
 * @param {Array<object>} [fallbackRows]
 */
export async function fetchStrapiClienteMovimentosAgendados(fallbackRows = []) {
  const base = strapiBaseUrl()
  if (!base) return []

  const user = await fetchStrapiCurrentUser()
  const userId = user?.id
  if (userId == null || String(userId).trim() === '') return []

  const params = new URLSearchParams()
  params.set('filters[cliente][id][$eq]', String(userId))
  params.set('filters[estado][$eq]', MOVIMENTO_ESTADO_AGENDADO)
  params.set('populate[contentor][populate][capacidade]', 'true')
  params.set('populate[cliente]', 'true')
  params.set('sort', 'data:asc')
  params.set('pagination[pageSize]', '100')

  const res = await fetch(`${base}/api/movimentos?${params.toString()}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`Strapi movimentos: HTTP ${res.status}`)

  const json = await res.json()
  return parseStrapiListRows(json)
    .map((row, index) => coerceMovimentoRow(row, fallbackRows[index]))
    .filter(Boolean)
}
