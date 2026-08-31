/**
 * Recorrências semanais de serviços (api::recorrencia.recorrencia).
 * Horizonte rolante (estilo calendário): a série continua ativa sem data fim;
 * o app garante N semanas à frente sempre que lista/cria serviços.
 */

import { STRAPI_JWT_STORAGE_KEY } from './strapiAuth.js'

/** Semanas à frente a manter materializadas como movimentos `agendado`. */
export const RECORRENCIA_HORIZONTE_SEMANAS = 26

/** Se faltarem menos do que isto até ao fim do horizonte, gera mais semanas. */
export const RECORRENCIA_EXTEND_THRESHOLD_SEMANAS = 8

export const DIAS_SEMANA_OPTIONS = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]

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

function resolveRelationRef(ref) {
  if (ref == null) return undefined
  const s = String(ref).trim()
  if (!s) return undefined
  if (/^\d+$/.test(s)) return Number(s)
  return s
}

function buildRelationConnect(ref) {
  const resolved = resolveRelationRef(ref)
  if (resolved == null) return undefined
  return { connect: [resolved] }
}

function parseIsoDateLocal(iso) {
  const s = pickString(iso)
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (Number.isNaN(date.getTime())) return null
  return date
}

export function formatIsoDateLocal(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function unwrapEntity(entity) {
  if (entity == null) return null
  if (typeof entity !== 'object') return null
  const data = entity.data ?? entity
  if (Array.isArray(data)) return data[0] ? unwrapEntity(data[0]) : null
  if (data?.attributes && typeof data.attributes === 'object') {
    return { ...data.attributes, id: data.id, documentId: data.documentId }
  }
  return data
}

function pickRelationId(entity) {
  const row = unwrapEntity(entity)
  if (!row) return null
  return pickString(row.documentId ?? row.id)
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

/**
 * Ajusta a data de início para o próximo dia da semana (inclui o próprio dia).
 * @param {string} dataIso YYYY-MM-DD
 * @param {number} diaSemana 0=domingo … 6=sábado
 */
export function alignDateToWeekday(dataIso, diaSemana) {
  const start = parseIsoDateLocal(dataIso)
  if (!start) return dataIso
  const target = Number(diaSemana)
  if (!Number.isFinite(target) || target < 0 || target > 6) return dataIso
  const diff = (target - start.getDay() + 7) % 7
  start.setDate(start.getDate() + diff)
  return formatIsoDateLocal(start)
}

/**
 * Gera datas semanais a partir de dataInicio (já alinhada), inclusive.
 * @param {string} dataInicioIso
 * @param {number} [semanas]
 * @returns {string[]}
 */
export function generateWeeklyOccurrenceDates(dataInicioIso, semanas = RECORRENCIA_HORIZONTE_SEMANAS) {
  const start = parseIsoDateLocal(dataInicioIso)
  if (!start) return []
  const count = Math.max(1, Math.min(104, Number(semanas) || RECORRENCIA_HORIZONTE_SEMANAS))
  /** @type {string[]} */
  const dates = []
  for (let i = 0; i < count; i += 1) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * 7)
    dates.push(formatIsoDateLocal(d))
  }
  return dates
}

/**
 * Datas semanais estritamente após `afterIso`, até `untilIso` (inclusive).
 * @param {string|null} afterIso
 * @param {number} diaSemana
 * @param {string} untilIso
 * @returns {string[]}
 */
export function generateWeeklyDatesAfter(afterIso, diaSemana, untilIso) {
  const until = parseIsoDateLocal(untilIso)
  if (!until) return []
  const after = parseIsoDateLocal(afterIso)
  let cursor = after
    ? new Date(after.getFullYear(), after.getMonth(), after.getDate() + 7)
    : parseIsoDateLocal(alignDateToWeekday(untilIso, diaSemana))
  if (!cursor) return []

  const targetDow = Number(diaSemana)
  if (Number.isFinite(targetDow) && targetDow >= 0 && targetDow <= 6) {
    const diff = (targetDow - cursor.getDay() + 7) % 7
    if (diff) cursor.setDate(cursor.getDate() + diff)
  }

  /** @type {string[]} */
  const dates = []
  let guard = 0
  while (cursor.getTime() <= until.getTime() && guard < 120) {
    dates.push(formatIsoDateLocal(cursor))
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7)
    guard += 1
  }
  return dates
}

/**
 * Horizonte alvo: hoje + N semanas, alinhado ao dia da semana da série.
 * @param {number} diaSemana
 * @param {number} [semanas]
 */
export function computeRecorrenciaHorizonEndIso(diaSemana, semanas = RECORRENCIA_HORIZONTE_SEMANAS) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + semanas * 7)
  return alignDateToWeekday(formatIsoDateLocal(end), diaSemana)
}

export function todayIsoLocal() {
  return formatIsoDateLocal(new Date())
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{ id: string, documentId?: string }>}
 */
export async function createStrapiRecorrencia(payload) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Configura VITE_STRAPI_URL no .env')

  const tipo = pickString(payload.tipo)
  const clienteId = pickString(payload.clienteId)
  const localizacaoId = pickString(payload.localizacaoId)
  const dataInicio = pickString(payload.dataInicio)
  if (!tipo || !clienteId || !localizacaoId || !dataInicio) {
    throw new Error('Recorrência incompleta (tipo, cliente, localização e data).')
  }

  /** @type {Record<string, unknown>} */
  const data = {
    tipo,
    diaSemana: Number(payload.diaSemana),
    periodo: pickString(payload.periodo) ?? 'indiferente',
    dataInicio,
    ativo: payload.ativo !== false,
    cliente: buildRelationConnect(clienteId),
    localizacao: buildRelationConnect(localizacaoId),
  }

  // Sem dataFim = série aberta (estilo calendário). Só grava se for pedida explicitamente.
  const dataFim = pickString(payload.dataFim)
  if (dataFim) data.dataFim = dataFim
  const contentorId = pickString(payload.contentorId)
  if (contentorId) data.contentor = buildRelationConnect(contentorId)
  const operadorId = pickString(payload.operadorId)
  if (operadorId) data.operador = buildRelationConnect(operadorId)
  const capacidadeLabel = pickString(payload.capacidadeLabel)
  if (capacidadeLabel) data.capacidadeLabel = capacidadeLabel
  const observacoes = pickString(payload.observacoes)
  if (observacoes) data.observacoes = observacoes

  const attempts = [data, toDirectRelations(data)]
  let lastError = null
  for (const body of attempts) {
    const res = await fetch(`${base}/api/recorrencias`, {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: body }),
    })
    if (res.ok) {
      const json = await res.json().catch(() => ({}))
      const row = json?.data ?? json
      const id = pickString(row?.documentId ?? row?.id)
      if (!id) throw new Error('Resposta inválida ao criar recorrência.')
      return { id, documentId: pickString(row?.documentId) ?? undefined }
    }
    let message = `Não foi possível criar a recorrência (HTTP ${res.status}).`
    try {
      const json = await res.json()
      if (json?.error?.message) message = json.error.message
    } catch {
      /* ignore */
    }
    lastError = new Error(message)
  }
  throw lastError ?? new Error('Não foi possível criar a recorrência.')
}

/**
 * Desativa série (após apagar esta + futuras).
 * @param {string} recorrenciaId
 * @param {string} [dataFimIso]
 */
export async function deactivateStrapiRecorrencia(recorrenciaId, dataFimIso) {
  const id = pickString(recorrenciaId)
  if (!id) return
  const base = strapiBaseUrl()
  if (!base) return

  /** @type {Record<string, unknown>} */
  const data = { ativo: false }
  const fim = pickString(dataFimIso)
  if (fim) data.dataFim = fim

  await fetch(`${base}/api/recorrencias/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  }).catch(() => null)
}

/**
 * @returns {Promise<Array<{
 *   id: string,
 *   tipo: string,
 *   diaSemana: number,
 *   periodo: string|null,
 *   dataInicio: string|null,
 *   dataFim: string|null,
 *   ativo: boolean,
 *   clienteId: string|null,
 *   localizacaoId: string|null,
 *   contentorId: string|null,
 *   operadorId: string|null,
 *   capacidadeLabel: string|null,
 *   observacoes: string|null,
 * }>>}
 */
export async function fetchStrapiRecorrenciasAtivas() {
  const base = strapiBaseUrl()
  if (!base) return []

  const params = new URLSearchParams()
  params.set('filters[ativo][$eq]', 'true')
  params.set('populate[cliente]', 'true')
  params.set('populate[localizacao]', 'true')
  params.set('populate[contentor]', 'true')
  params.set('populate[operador]', 'true')
  params.set('pagination[pageSize]', '100')

  const res = await fetch(`${base}/api/recorrencias?${params}`, {
    headers: { ...authHeaders() },
  })
  if (!res.ok) return []
  const json = await res.json().catch(() => ({}))
  return parseStrapiListRows(json)
    .map((row) => coerceRecorrenciaRow(row))
    .filter((item) => item && item.id && item.ativo)
}

/**
 * @param {unknown} row
 */
export function coerceRecorrenciaRow(row) {
  if (!row || typeof row !== 'object') return null
  const attrs = row.attributes ?? row
  const id = pickString(row.documentId ?? attrs.documentId ?? row.id ?? attrs.id)
  if (!id) return null
  return {
    id,
    tipo: pickString(attrs.tipo) ?? 'recolha',
    diaSemana: Number(attrs.diaSemana),
    periodo: pickString(attrs.periodo),
    dataInicio: pickString(attrs.dataInicio),
    dataFim: pickString(attrs.dataFim),
    ativo: attrs.ativo !== false,
    clienteId: pickRelationId(attrs.cliente),
    localizacaoId: pickRelationId(attrs.localizacao),
    contentorId: pickRelationId(attrs.contentor),
    operadorId: pickRelationId(attrs.operador),
    capacidadeLabel: pickString(attrs.capacidadeLabel),
    observacoes: pickString(attrs.observacoes),
  }
}

function toDirectRelations(payload) {
  /** @type {Record<string, unknown>} */
  const next = { ...payload }
  for (const field of ['cliente', 'localizacao', 'contentor', 'operador']) {
    const value = next[field]
    if (value && typeof value === 'object' && Array.isArray(value.connect) && value.connect.length > 0) {
      next[field] = value.connect[0]
    }
  }
  return next
}

/**
 * Extrai id da relação recorrência num row de movimento.
 * @param {unknown} raw
 */
export function pickRecorrenciaIdFromRelation(raw) {
  if (raw == null) return null
  if (typeof raw === 'string' || typeof raw === 'number') return pickString(raw)
  if (typeof raw !== 'object') return null
  const data = raw.data ?? raw
  if (Array.isArray(data)) {
    return pickString(data[0]?.documentId ?? data[0]?.id)
  }
  return pickString(data?.documentId ?? data?.id ?? data?.attributes?.documentId)
}
