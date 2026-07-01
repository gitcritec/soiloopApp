/**
 * Tickets — api::ticket.ticket (Strapi).
 * Componente `ticket.resposta` no campo `respostas`.
 */

import { STRAPI_JWT_STORAGE_KEY } from './strapiAuth.js'
import { normalizeStrapiMediaUrl } from './strapiMedia.js'
import {
  assignDisplayRefsToTickets,
  generateNextTicketRef,
  pickTicketDisplayRef,
} from './ticketStatus.js'

const TICKETS_API = 'tickets'

/** Nomes possíveis da relação Ticket → User no Strapi (varia por instalação). */
const TICKET_USER_RELATION_KEYS = ['cliente', 'user', 'users_permissions_user']

const PRIORITY_LABELS = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
  na: 'N/A',
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

/** @param {unknown} json */
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

/** @param {unknown} row */
function extractStrapiEntityId(row) {
  if (!row || typeof row !== 'object') return null
  const attrs = row.attributes
  const candidates = [row.documentId, row.id, attrs?.documentId, attrs?.id]
  for (const c of candidates) {
    if (c != null && String(c).trim() !== '') return String(c)
  }
  return null
}

/** @param {unknown} rel */
function unwrapRelation(rel) {
  if (!rel) return null
  if (typeof rel === 'object' && rel.data != null) {
    const d = rel.data
    return Array.isArray(d) ? (d[0] ?? null) : d
  }
  return rel
}

/** @param {unknown} value */
function pickAuthorRef(value) {
  if (value == null) return undefined
  if (typeof value === 'number') return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  if (typeof value !== 'object') return undefined
  const id = value.id ?? value.documentId ?? value.data?.id ?? value.data?.documentId
  if (id == null) return undefined
  return /^\d+$/.test(String(id)) ? Number(id) : String(id)
}

/** @param {unknown} media */
function pickMediaRef(media) {
  if (media == null) return undefined
  if (typeof media === 'number') return media
  if (typeof media === 'string' && /^\d+$/.test(media)) return Number(media)
  if (typeof media !== 'object') return undefined
  const id = media.id ?? media.documentId ?? media.data?.id ?? media.data?.documentId
  if (id == null) return undefined
  return /^\d+$/.test(String(id)) ? Number(id) : String(id)
}

/** @param {unknown} media */
function pickMediaUrl(media) {
  if (!media) return null
  if (typeof media === 'string') return media
  if (typeof media !== 'object') return null

  const attrs = media.attributes ?? media.data?.attributes ?? media.data ?? media
  if (typeof attrs?.url === 'string' && attrs.url) return attrs.url
  if (typeof media.url === 'string' && media.url) return media.url

  const formats = attrs?.formats ?? media.formats
  if (formats && typeof formats === 'object') {
    const sized =
      formats.small?.url ??
      formats.medium?.url ??
      formats.thumbnail?.url ??
      formats.large?.url
    if (sized) return sized
  }

  if (media.data) return pickMediaUrl(media.data)
  return null
}

/** @param {unknown} media */
function pickMediaName(media) {
  if (!media || typeof media !== 'object') return null
  const attrs = media.attributes ?? media.data?.attributes ?? media.data ?? media
  return pickString(attrs?.name ?? media.name)
}

function pickMediaMime(media) {
  if (!media || typeof media !== 'object') return null
  const attrs = media.attributes ?? media.data?.attributes ?? media.data ?? media
  return pickString(attrs?.mime ?? media.mime)
}

function absoluteMediaUrl(path) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return normalizeStrapiMediaUrl(path)
  const base = strapiBaseUrl()
  if (!base) return path
  return normalizeStrapiMediaUrl(`${base}${path.startsWith('/') ? '' : '/'}${path}`)
}

/** @param {unknown} anexo */
function coerceAttachment(anexo) {
  if (anexo == null) return { attachmentUrl: null, attachmentName: null, attachmentMime: null }
  const url = absoluteMediaUrl(pickMediaUrl(anexo))
  const name = pickMediaName(anexo) ?? 'Anexo'
  const attachmentMime = pickMediaMime(anexo)
  return { attachmentUrl: url, attachmentName: name, attachmentMime }
}

/** @param {string|null|undefined} iso */
function formatDateParts(iso) {
  if (!iso) return { date: '—', time: '—' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: '—', time: '—' }
  return {
    date: d.toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    time: d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }),
  }
}

/**
 * @param {string} estado
 * @param {string|null|undefined} dataAbertura
 */
export function mapEstadoToUiStatus(estado, dataAbertura) {
  if (estado === 'fechado') return 'fechado'
  if (estado === 'respondido') return 'respondido'
  if (estado === 'aberto') {
    const opened = dataAbertura ? new Date(dataAbertura) : null
    if (opened && !Number.isNaN(opened.getTime())) {
      const now = new Date()
      return opened.toDateString() === now.toDateString() ? 'aberto-hoje' : 'aberto-amanha'
    }
    return 'aberto-hoje'
  }
  return 'aberto-hoje'
}

/** @param {unknown} prioridade */
function formatPriorityLabel(prioridade) {
  const key = pickString(prioridade)?.toLowerCase()
  return (key && PRIORITY_LABELS[key]) || 'N/A'
}

/**
 * @typedef {object} TicketReplyItem
 * @property {string} id
 * @property {'cliente'|'admin'} author
 * @property {string} text
 * @property {string} at
 * @property {string|null} [attachmentUrl]
 * @property {string|null} [attachmentName]
 */

/**
 * @typedef {object} TicketItem
 * @property {string} id
 * @property {string} ref
 * @property {string} title
 * @property {string} clientName
 * @property {string} location
 * @property {string} date
 * @property {string} time
 * @property {string} status
 * @property {string} estado
 * @property {string} priority
 * @property {string} message
 * @property {TicketReplyItem[]} replies
 * @property {object[]} _respostasRaw
 */

/** @param {unknown} reply */
function coerceReplyRow(reply, index) {
  if (!reply || typeof reply !== 'object') return null
  const texto = pickString(reply.texto)
  if (!texto) return null
  const autorTipo = reply.autorTipo === 'cliente' ? 'cliente' : 'admin'
  const { date, time } = formatDateParts(reply.dataResposta)
  const { attachmentUrl, attachmentName, attachmentMime } = coerceAttachment(reply.anexo)
  return {
    id: `r-${index}`,
    author: autorTipo,
    text: texto,
    at: `${date} ${time}`,
    attachmentUrl,
    attachmentName,
    attachmentMime,
  }
}

/** @param {unknown} row */
function readTicketUserRelation(row) {
  const attrs = row?.attributes ?? row ?? {}
  for (const key of TICKET_USER_RELATION_KEYS) {
    const rel = unwrapRelation(attrs[key] ?? row?.[key])
    if (rel) return rel
  }
  return null
}

/**
 * @param {unknown} row
 * @param {{ id: string|number|null, documentId: string|null }} userRefs
 */
function ticketRowMatchesUser(row, userRefs) {
  const rel = readTicketUserRelation(row)
  if (!rel) return false

  const relIds = [rel.id, rel.documentId, rel.attributes?.id, rel.attributes?.documentId]
    .filter((v) => v != null && String(v).trim() !== '')
    .map(String)

  const userIds = [userRefs.id, userRefs.documentId]
    .filter((v) => v != null && String(v).trim() !== '')
    .map(String)

  return relIds.some((id) => userIds.includes(id))
}

/** @param {unknown} row */
function readTicketFields(row) {
  const attrs = row?.attributes ?? row ?? {}
  return {
    ref: pickString(attrs.ref ?? row?.ref),
    assunto: pickString(attrs.assunto ?? row?.assunto),
    mensagem: pickString(attrs.mensagem ?? row?.mensagem),
    estado: pickString(attrs.estado ?? row?.estado) ?? 'aberto',
    prioridade: attrs.prioridade ?? row?.prioridade,
    dataAbertura: attrs.dataAbertura ?? row?.dataAbertura,
    cliente: readTicketUserRelation(row),
    localizacao: unwrapRelation(attrs.localizacao ?? row?.localizacao),
    respostas: Array.isArray(attrs.respostas ?? row?.respostas) ? attrs.respostas ?? row?.respostas : [],
  }
}

/** @param {unknown} row */
function coerceTicketRow(row) {
  if (!row || typeof row !== 'object') return null
  const id = extractStrapiEntityId(row)
  const fields = readTicketFields(row)

  const clienteAttrs = fields.cliente?.attributes ?? fields.cliente ?? {}
  const locAttrs = fields.localizacao?.attributes ?? fields.localizacao ?? {}
  const { date, time } = formatDateParts(fields.dataAbertura)

  const replies = fields.respostas
    .map((r, i) => coerceReplyRow(r, i))
    .filter(Boolean)

  const displayRef = pickTicketDisplayRef(fields.ref, id)

  return {
    id: id ?? fields.ref ?? String(Math.random()),
    ref: displayRef ?? '—',
    title: fields.assunto ?? '—',
    clientName: pickString(clienteAttrs.username) ?? 'Cliente',
    location: pickString(locAttrs.morada) ?? '—',
    date,
    time,
    status: mapEstadoToUiStatus(fields.estado, fields.dataAbertura),
    estado: fields.estado,
    priority: formatPriorityLabel(fields.prioridade),
    message: fields.mensagem ?? '',
    dataAbertura: fields.dataAbertura ?? null,
    replies,
    _respostasRaw: fields.respostas,
  }
}

function ticketsUrl(base, entityId = '') {
  const path = `${base}/api/${TICKETS_API}`
  return entityId ? `${path}/${encodeURIComponent(entityId)}` : path
}

const TICKET_POPULATE_QUERIES = [
  'populate[respostas][populate][anexo]=true&populate[localizacao]=true',
  'populate=*',
  'populate[localizacao]=true&populate[respostas]=true',
  '',
]

/** Populate mínimo para detalhe (sem chaves inválidas como autor/cliente). */
const TICKET_DETAIL_POPULATE_CANDIDATES = [
  'populate[respostas][populate][anexo]=true&populate[localizacao]=true',
  'populate[localizacao]=true&populate[respostas]=true',
  'populate=*',
  '',
]

/** @type {string | null} */
let cachedDetailPopulate = null

function allTicketPopulateQueries() {
  const seen = new Set()
  const out = []

  function add(query) {
    const q = String(query ?? '')
    if (seen.has(q)) return
    seen.add(q)
    out.push(q)
  }

  for (const relKey of TICKET_USER_RELATION_KEYS) {
    add(
      `populate[${relKey}]=true&populate[localizacao]=true&populate[respostas][populate][autor]=true&populate[respostas][populate][anexo]=true`,
    )
    add(
      `populate[${relKey}][fields][0]=username&populate[localizacao][fields][0]=morada&populate[respostas]=true`,
    )
    add(`populate[${relKey}]=true&populate=*`)
  }

  for (const query of TICKET_POPULATE_QUERIES) add(query)
  return out
}

/**
 * @param {string} base
 * @param {string} ticketId
 * @param {string} populateQs
 * @returns {Promise<TicketItem|null>}
 */
async function fetchTicketRowWithPopulate(base, ticketId, populateQs) {
  const qs = populateQs ? `?${populateQs}` : ''
  const url = `${ticketsUrl(base, ticketId)}${qs}`
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) return null
  let json = {}
  try {
    json = await res.json()
  } catch {
    json = {}
  }
  const row = json.data ?? json
  return coerceTicketRow(row)
}

/**
 * @param {string} base
 * @param {string} ticketId
 * @returns {Promise<TicketItem|null>}
 */
async function discoverTicketDetail(base, ticketId) {
  let best = null
  let bestQuery = null

  for (const populateQs of TICKET_DETAIL_POPULATE_CANDIDATES) {
    const item = await fetchTicketRowWithPopulate(base, ticketId, populateQs)
    if (!item) continue
    if (!best || item.replies.length > best.replies.length) {
      best = item
      bestQuery = populateQs
    }
    const hasAttachments = item.replies.some((r) => r.attachmentUrl)
    if (item.replies.length > 0 && (hasAttachments || !populateQs.includes('anexo'))) {
      break
    }
  }

  if (best && bestQuery != null) cachedDetailPopulate = bestQuery
  return best
}

/**
 * @param {Response} res
 * @param {string} fallback
 */
async function parseTicketApiError(res, fallback) {
  let message = fallback
  try {
    const err = await res.json()
    const errors = err?.error?.details?.errors
    if (Array.isArray(errors) && errors.length > 0) {
      const parts = errors
        .map((e) => {
          const path = Array.isArray(e.path) ? e.path.join('.') : e.path
          return path ? `${path}: ${e.message}` : e.message
        })
        .filter(Boolean)
      if (parts.length) message = parts.join(' · ')
    } else {
      const detail = err?.error?.message ?? err?.message
      if (detail) message = String(detail)
    }
  } catch {
    /* ignore */
  }
  if (res.status === 403) {
    return 'Não tens permissão para ver ou gerir tickets. Contacta o suporte.'
  }
  if (res.status === 404) {
    return 'Ticket não encontrado.'
  }
  return message
}

/**
 * @param {Response} res
 * @param {string} fallback
 */
async function parseUploadApiError(res, fallback) {
  let message = fallback
  try {
    const err = await res.json()
    const detail = err?.error?.message ?? err?.message
    if (detail) message = String(detail)
  } catch {
    /* ignore */
  }
  if (res.status === 403) {
    return 'Sem permissão para enviar ficheiros. No Strapi: Settings → Users & Permissions → Roles → ativa «upload» em Upload para o teu perfil.'
  }
  return message
}

async function collectExistingTicketRefs() {
  const refs = []
  const { ok, rows } = await fetchTicketsRequest({})
  if (!ok) return refs

  for (const row of rows) {
    const fields = readTicketFields(row)
    const rawRef = pickString(fields.ref)
    if (rawRef) refs.push(rawRef)
  }
  return refs
}

async function resolveNextTicketRef() {
  const refs = await collectExistingTicketRefs()
  return generateNextTicketRef(refs)
}

function relationRef(id) {
  if (id == null || String(id).trim() === '') return null
  return /^\d+$/.test(String(id)) ? Number(id) : String(id)
}

/** Variantes de relação (Strapi v4/v5). */
function buildRelationWriteVariants(relKey, refId) {
  const ref = relationRef(refId)
  if (ref == null) return []

  const variants = [
    { [relKey]: ref },
    { [relKey]: { connect: [ref] } },
    { [relKey]: { connect: [{ id: ref }] } },
    { [relKey]: { set: [ref] } },
  ]

  if (typeof ref === 'string' && !/^\d+$/.test(ref)) {
    variants.push({ [relKey]: { connect: [{ documentId: ref }] } })
  }

  return variants
}

/**
 * @returns {Promise<{ id: string|number|null, documentId: string|null }>}
 */
async function fetchCurrentUserRefs() {
  const base = strapiBaseUrl()
  const jwt = localStorage.getItem(STRAPI_JWT_STORAGE_KEY)
  if (!base || !jwt) return { id: null, documentId: null }

  const res = await fetch(`${base}/api/users/me`, {
    headers: { Authorization: `Bearer ${jwt}` },
  })
  if (!res.ok) return { id: null, documentId: null }

  let json = {}
  try {
    json = await res.json()
  } catch {
    json = {}
  }

  const user = json.data ?? json
  const numericId = user?.id
  const documentId = user?.documentId

  let id = null
  if (numericId != null && String(numericId).trim() !== '') {
    id = /^\d+$/.test(String(numericId)) ? Number(numericId) : String(numericId)
  } else if (documentId != null && String(documentId).trim() !== '') {
    id = /^\d+$/.test(String(documentId)) ? Number(documentId) : String(documentId)
  }

  return {
    id,
    documentId: documentId != null && String(documentId).trim() !== '' ? String(documentId) : null,
  }
}

/**
 * @param {string} url
 * @param {object} data
 */
async function postTicket(url, data) {
  return fetch(url, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })
}

/**
 * @param {object} core
 * @param {string} userRelKey
 * @param {string|number|null} clienteRef
 * @param {string|number|null|undefined} localizacaoRef
 */
function buildTicketCreatePayloadsForUserKey(core, userRelKey, clienteRef, localizacaoRef) {
  const clienteVariants = buildRelationWriteVariants(userRelKey, clienteRef)
  const locVariants =
    localizacaoRef != null && String(localizacaoRef).trim() !== ''
      ? buildRelationWriteVariants('localizacao', localizacaoRef)
      : [{}]

  const payloads = []
  const seen = new Set()

  for (const clientePart of clienteVariants.length ? clienteVariants : [{}]) {
    for (const locPart of locVariants) {
      const data = { ...core, ...clientePart, ...locPart }
      const key = JSON.stringify(data)
      if (seen.has(key)) continue
      seen.add(key)
      payloads.push(data)
    }
  }

  if (localizacaoRef) {
    for (const clientePart of clienteVariants.length ? clienteVariants : [{}]) {
      const data = { ...core, ...clientePart }
      const key = JSON.stringify(data)
      if (!seen.has(key)) {
        seen.add(key)
        payloads.push(data)
      }
    }
  }

  return payloads
}

/**
 * @param {object} core
 * @param {string|number|null} clienteRef
 * @param {string|number|null|undefined} localizacaoRef
 */
function buildTicketCreatePayloads(core, clienteRef, localizacaoRef) {
  const payloads = []
  const seen = new Set()

  for (const relKey of TICKET_USER_RELATION_KEYS) {
    for (const data of buildTicketCreatePayloadsForUserKey(core, relKey, clienteRef, localizacaoRef)) {
      const key = JSON.stringify(data)
      if (seen.has(key)) continue
      seen.add(key)
      payloads.push(data)
    }
  }

  return payloads
}

async function fetchTicketsRequest(extraParams = {}) {
  const base = strapiBaseUrl()
  if (!base) return { ok: false, status: 0, rows: [] }

  const params = new URLSearchParams()
  params.set('pagination[pageSize]', '100')
  params.set('sort', 'dataAbertura:desc')
  for (const [key, value] of Object.entries(extraParams)) {
    if (value != null && value !== '') params.set(key, value)
  }

  const url = `${ticketsUrl(base)}?${params.toString()}`
  const res = await fetch(url, { headers: authHeaders() })
  let json = {}
  try {
    json = await res.json()
  } catch {
    json = {}
  }
  return { ok: res.ok, status: res.status, rows: parseStrapiListRows(json) }
}

/** @returns {Promise<TicketItem[]>} */
export async function fetchStrapiTickets() {
  const base = strapiBaseUrl()
  if (!base) return []

  let lastStatus = 0

  for (const populateQs of allTicketPopulateQueries()) {
    const extra = populateQs ? Object.fromEntries(new URLSearchParams(populateQs)) : {}
    const { ok, status, rows } = await fetchTicketsRequest(extra)
    lastStatus = status
    if (!ok) continue
    const items = rows.map((row) => coerceTicketRow(row)).filter(Boolean)
    if (items.length > 0 || ok) return assignDisplayRefsToTickets(items)
  }

  const { ok, status, rows } = await fetchTicketsRequest({})
  lastStatus = status
  if (!ok) {
    if (status === 403) {
      throw new Error('Não tens permissão para ver tickets. Contacta o suporte.')
    }
    if (status > 0) {
      throw new Error('Não foi possível carregar os tickets. Tenta novamente mais tarde.')
    }
    return []
  }

  return assignDisplayRefsToTickets(rows.map((row) => coerceTicketRow(row)).filter(Boolean))
}

/**
 * @param {string} ticketId
 * @returns {Promise<TicketItem|null>}
 */
export async function fetchStrapiTicketDetail(ticketId) {
  const base = strapiBaseUrl()
  if (!base || !ticketId) return null

  if (cachedDetailPopulate != null) {
    const cached = await fetchTicketRowWithPopulate(base, ticketId, cachedDetailPopulate)
    if (cached) return cached
    cachedDetailPopulate = null
  }

  return discoverTicketDetail(base, ticketId)
}

/** Mantém thread/ref ao atualizar estado local (evita flash sem mensagens). */
export function mergeTicketUpdates(prev, fresh) {
  if (!fresh) return prev
  if (!prev || prev.id !== fresh.id) return fresh

  const ref = fresh.ref === '—' && prev.ref !== '—' ? prev.ref : fresh.ref
  const keepPrevThread = fresh.replies.length < prev.replies.length

  return {
    ...fresh,
    ref,
    replies: keepPrevThread ? prev.replies : fresh.replies,
    _respostasRaw: keepPrevThread ? prev._respostasRaw : fresh._respostasRaw,
  }
}

/** @returns {Promise<TicketItem[]>} */
export async function fetchStrapiTicketsMine() {
  const userRefs = await fetchCurrentUserRefs()
  if (!userRefs.id && !userRefs.documentId) return []

  const base = strapiBaseUrl()
  if (!base) return []

  const userIds = [...new Set([userRefs.id, userRefs.documentId].filter(Boolean).map(String))]
  let lastStatus = 0

  for (const relKey of TICKET_USER_RELATION_KEYS) {
    let relKeyInvalid = false

    for (const userId of userIds) {
      const filterVariants = [
        { [`filters[${relKey}][id][$eq]`]: userId },
        { [`filters[${relKey}][documentId][$eq]`]: userId },
      ]

      for (const filterParams of filterVariants) {
        for (const populateQs of allTicketPopulateQueries()) {
          const extra = {
            ...filterParams,
            ...(populateQs ? Object.fromEntries(new URLSearchParams(populateQs)) : {}),
          }
          const { ok, status, rows } = await fetchTicketsRequest(extra)
          lastStatus = status

          if (status === 400) {
            relKeyInvalid = true
            break
          }
          if (status === 403) {
            throw new Error('Não tens permissão para ver os teus tickets.')
          }
          if (ok) {
            return assignDisplayRefsToTickets(
              rows.map((row) => coerceTicketRow(row)).filter(Boolean),
            )
          }
        }
        if (relKeyInvalid) break
      }
      if (relKeyInvalid) break
    }
  }

  for (const populateQs of allTicketPopulateQueries()) {
    const extra = populateQs ? Object.fromEntries(new URLSearchParams(populateQs)) : {}
    const { ok, status, rows } = await fetchTicketsRequest(extra)
    lastStatus = status

    if (status === 403) {
      throw new Error('Não tens permissão para ver os teus tickets.')
    }
    if (!ok) continue

    const matched = rows.filter((row) => ticketRowMatchesUser(row, userRefs))
    const sourceRows = matched.length > 0 ? matched : rows

    return assignDisplayRefsToTickets(
      sourceRows.map((row) => coerceTicketRow(row)).filter(Boolean),
    )
  }

  if (lastStatus === 403) {
    throw new Error('Não tens permissão para ver os teus tickets.')
  }
  if (lastStatus > 0) {
    throw new Error('Não foi possível carregar os tickets.')
  }
  return []
}

/**
 * @param {{ assunto: string, mensagem: string, prioridade?: string, localizacaoId?: string|null }} payload
 * @returns {Promise<TicketItem>}
 */
export async function createStrapiTicket(payload) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Serviço indisponível. Tenta mais tarde.')

  const userRefs = await fetchCurrentUserRefs()
  const clienteRef = userRefs.id
  if (!clienteRef) throw new Error('Sessão inválida. Inicia sessão novamente.')

  const assunto = pickString(payload.assunto)
  const mensagem = pickString(payload.mensagem)
  if (!assunto) throw new Error('O assunto é obrigatório.')
  if (!mensagem) throw new Error('A mensagem é obrigatória.')

  const prioridade = pickString(payload.prioridade) ?? 'na'
  const locId = payload.localizacaoId
  const dataAbertura = new Date().toISOString()
  const nextRef = await resolveNextTicketRef()

  /** Núcleos mínimos — tenta variantes se enum/campos extra falharem no Strapi. */
  const coreVariants = [
    {
      ref: nextRef,
      assunto,
      mensagem,
      estado: 'aberto',
      prioridade,
      dataAbertura,
    },
    {
      ref: nextRef,
      assunto,
      mensagem,
      dataAbertura,
    },
    {
      ref: nextRef,
      assunto,
      mensagem,
      estado: 'aberto',
      dataAbertura,
    },
    {
      assunto,
      mensagem,
      estado: 'aberto',
      prioridade,
      dataAbertura,
    },
    {
      assunto,
      mensagem,
      dataAbertura,
    },
  ]

  const clienteIdsToTry = [...new Set([clienteRef, userRefs.documentId].filter(Boolean))]
  const allPayloads = []
  const seenPayloads = new Set()

  for (const core of coreVariants) {
    for (const cid of clienteIdsToTry) {
      for (const data of buildTicketCreatePayloads(core, cid, locId)) {
        const key = JSON.stringify(data)
        if (seenPayloads.has(key)) continue
        seenPayloads.add(key)
        allPayloads.push(data)
      }
      const withoutCliente = { ...core }
      if (locId) {
        for (const locPart of buildRelationWriteVariants('localizacao', locId)) {
          const data = { ...withoutCliente, ...locPart }
          const key = JSON.stringify(data)
          if (!seenPayloads.has(key)) {
            seenPayloads.add(key)
            allPayloads.push(data)
          }
        }
      } else {
        const key = JSON.stringify(withoutCliente)
        if (!seenPayloads.has(key)) {
          seenPayloads.add(key)
          allPayloads.push(withoutCliente)
        }
      }
    }
  }

  const url = ticketsUrl(base)
  let lastError = 'Não foi possível criar o ticket.'

  for (const data of allPayloads) {
    const res = await postTicket(url, data)
    if (res.ok) {
      const json = await res.json()
      let item = coerceTicketRow(json.data ?? json)
      if (!item) throw new Error('Ticket criado mas resposta da API inválida.')

      const detail = await fetchStrapiTicketDetail(item.id)
      if (detail) {
        item = {
          ...item,
          ...detail,
          ref: pickTicketDisplayRef(detail.ref, nextRef) ?? nextRef,
        }
      } else {
        item = { ...item, ref: nextRef }
      }

      return item
    }
    lastError = await parseTicketApiError(res, lastError)
  }

  throw new Error(lastError)
}

/**
 * Mensagem de seguimento do cliente (reabre ticket se estava respondido).
 * @param {string} ticketId
 * @param {{ text: string, file?: File|null }} payload
 */
export async function sendClienteTicketMessage(ticketId, payload) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Serviço indisponível. Tenta mais tarde.')

  const text = pickString(payload.text)
  if (!text) throw new Error('Escreve uma mensagem antes de enviar.')

  const current = await fetchStrapiTicketDetail(ticketId)
  if (!current) throw new Error('Ticket não encontrado.')
  if (current.estado === 'fechado') {
    throw new Error('Este ticket está fechado e já não aceita mensagens.')
  }

  const novaResposta = {
    texto: text,
    autorTipo: 'cliente',
    dataResposta: new Date().toISOString(),
  }

  const respostas = [
    ...serializeRespostasForWrite(current._respostasRaw),
    novaResposta,
  ]

  if (payload.file) {
    try {
      const anexoRef = await uploadStrapiFile(payload.file)
      if (anexoRef != null) novaResposta.anexo = anexoRef
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível enviar o ficheiro.'
      throw new Error(`${message} A mensagem não foi enviada.`)
    }
  }

  return putTicketRespostas(ticketId, respostas, 'aberto')
}

export async function getStrapiCurrentUserId() {
  const refs = await fetchCurrentUserRefs()
  return refs.id
}

async function fetchCurrentUserId() {
  const refs = await fetchCurrentUserRefs()
  return refs.id
}

/** @param {File} file */
async function uploadStrapiFile(file) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Serviço indisponível. Tenta mais tarde.')

  const form = new FormData()
  form.append('files', file, file.name)

  const res = await fetch(`${base}/api/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  })

  if (!res.ok) {
    throw new Error(await parseUploadApiError(res, 'Não foi possível enviar o ficheiro.'))
  }

  const json = await res.json()
  const uploaded = Array.isArray(json) ? json[0] : json
  const ref = pickMediaRef(uploaded)
  if (ref == null) throw new Error('Upload concluído mas sem referência de ficheiro.')
  return ref
}

/** Campos opcionais no componente resposta — só `autor` é removido em fallback. */
const RESPOSTA_OPTIONAL_KEYS = ['autor']

/**
 * @param {unknown} r
 * @param {{ includeAutor?: boolean, includeAnexo?: boolean }} [opts]
 */
function stripRespostaForWrite(r, opts = {}) {
  if (!r || typeof r !== 'object') return null

  const texto = pickString(r.texto)
  if (!texto) return null

  const item = {
    texto,
    autorTipo: r.autorTipo === 'cliente' ? 'cliente' : 'admin',
    dataResposta: r.dataResposta ?? new Date().toISOString(),
  }

  if (opts.includeAutor) {
    const autor = pickAuthorRef(r.autor)
    if (autor != null) item.autor = autor
  }

  const anexo = pickMediaRef(r.anexo)
  if (anexo != null) item.anexo = anexo

  return item
}

/** @param {unknown[]} respostasRaw */
function serializeRespostasForWrite(respostasRaw = [], opts = {}) {
  return respostasRaw
    .map((r) => stripRespostaForWrite(r, opts))
    .filter(Boolean)
}

/**
 * @param {object[]} respostas
 * @returns {object[][]}
 */
function buildRespostasWriteVariants(respostas) {
  const minimal = respostas.map((r) => ({
    texto: r.texto,
    autorTipo: r.autorTipo,
    dataResposta: r.dataResposta,
  }))

  const seen = new Set()
  const variants = []

  function add(list) {
    const key = JSON.stringify(list)
    if (seen.has(key)) return
    seen.add(key)
    variants.push(list)
  }

  add(respostas)

  for (const optionalKey of RESPOSTA_OPTIONAL_KEYS) {
    const stripped = respostas.map((r) => {
      const copy = { ...r }
      delete copy[optionalKey]
      return copy
    })
    add(stripped)
  }

  add(minimal)

  return variants
}

/**
 * @param {string} ticketId
 * @param {object[]} respostas
 * @param {string} estado
 */
async function putTicketRespostas(ticketId, respostas, estado) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Serviço indisponível. Tenta mais tarde.')

  let lastError = 'Não foi possível guardar as mensagens.'

  for (const list of buildRespostasWriteVariants(respostas)) {
    const res = await fetch(ticketsUrl(base, ticketId), {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { estado, respostas: list } }),
    })

    if (res.ok) {
      const detail = await fetchStrapiTicketDetail(ticketId)
      if (detail) return detail

      const json = await res.json()
      const item = coerceTicketRow(json.data ?? json)
      if (!item) throw new Error('Mensagem guardada mas resposta da API inválida.')
      return item
    }

    lastError = await parseTicketApiError(res, lastError)
    if (res.status !== 400) break
  }

  throw new Error(lastError)
}

/**
 * @param {string} ticketId
 * @param {{ text: string, file?: File|null }} payload
 * @returns {Promise<TicketItem>}
 */
export async function replyStrapiTicket(ticketId, payload) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Serviço indisponível. Tenta mais tarde.')

  const text = pickString(payload.text)
  if (!text) throw new Error('Escreve uma resposta antes de enviar.')

  const current = await fetchStrapiTicketDetail(ticketId)
  if (!current) throw new Error('Ticket não encontrado.')

  const novaResposta = {
    texto: text,
    autorTipo: 'admin',
    dataResposta: new Date().toISOString(),
  }

  const respostas = [
    ...serializeRespostasForWrite(current._respostasRaw),
    novaResposta,
  ]

  if (payload.file) {
    try {
      const anexoRef = await uploadStrapiFile(payload.file)
      if (anexoRef != null) novaResposta.anexo = anexoRef
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível enviar o ficheiro.'
      throw new Error(`${message} A resposta não foi enviada.`)
    }
  }

  return putTicketRespostas(ticketId, respostas, 'respondido')
}

/**
 * @param {string} ticketId
 * @returns {Promise<TicketItem>}
 */
export async function closeStrapiTicket(ticketId) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Serviço indisponível. Tenta mais tarde.')

  const res = await fetch(ticketsUrl(base, ticketId), {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: {
        estado: 'fechado',
        dataFecho: new Date().toISOString(),
      },
    }),
  })

  if (!res.ok) {
    throw new Error(await parseTicketApiError(res, 'Não foi possível fechar o ticket.'))
  }

  const json = await res.json()
  const item = coerceTicketRow(json.data ?? json)
  if (!item) throw new Error('Ticket fechado mas resposta da API inválida.')
  return item
}
