/**
 * Clientes — plugin::users-permissions.user (role «Cliente», id 5).
 * Localizações — api::localizacao.localizacao → REST `/api/localizacaos` (relação `localizacaos` no user).
 */

import { STRAPI_JWT_STORAGE_KEY } from './strapiAuth.js'
import { postStrapiUserAndSendInviteEmail, userInviteMetaFromResult } from './strapiUserInvite.js'

/** Role «Cliente» (id 5 por defeito). */
export const STRAPI_CLIENTE_ROLE_ID = Number(import.meta.env.VITE_STRAPI_CLIENTE_ROLE_ID) || 5

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

/** @param {unknown} value */
function pickNumberField(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const digits = String(value).replace(/\D/g, '')
  if (!digits) return null
  const n = Number(digits)
  return Number.isFinite(n) ? n : null
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
 * Users & Permissions usa sobretudo id numérico em /api/users/:id (não documentId).
 * @param {unknown} row
 */
function extractUserApiId(row) {
  if (!row || typeof row !== 'object') return null
  const attrs = row.attributes ?? row
  const numeric = row.id ?? attrs.id
  if (numeric != null && String(numeric).trim() !== '') return String(numeric)
  const doc = row.documentId ?? attrs.documentId
  if (doc != null && String(doc).trim() !== '') return String(doc)
  return null
}

/** @param {unknown} json */
function parseContentListRows(json) {
  if (!json || typeof json !== 'object') return []
  if (Array.isArray(json)) return json
  const d = json.data
  if (Array.isArray(d)) return d
  if (d && typeof d === 'object') {
    if (Array.isArray(d.data)) return d.data
    if (d.id != null || d.documentId != null || d.attributes) return [d]
  }
  return []
}

/** @param {unknown} json */
function parseUsersListRows(json) {
  if (!json || typeof json !== 'object') return []
  if (Array.isArray(json)) return json
  const d = json.data
  if (Array.isArray(d)) return d
  if (d && typeof d === 'object') {
    if (Array.isArray(d.data)) return d.data
    if (Array.isArray(d.results)) return d.results
    if (d.id != null || d.documentId != null || d.attributes || d.username) return [d]
  }
  return []
}

/** @param {unknown} role */
function normalizeRoleRef(role) {
  if (role == null) return null
  if (typeof role === 'number' || typeof role === 'string') return role
  if (Array.isArray(role)) return role.length ? normalizeRoleRef(role[0]) : null
  if (typeof role !== 'object') return null

  const data = role.data
  if (data != null) {
    if (Array.isArray(data)) return data.length ? normalizeRoleRef(data[0]) : null
    if (typeof data === 'object') {
      const attrs = data.attributes
      if (attrs && typeof attrs === 'object') {
        return { ...attrs, id: data.id ?? data.documentId ?? attrs.id }
      }
      return data
    }
  }

  const attrs = role.attributes
  if (attrs && typeof attrs === 'object') {
    return { ...attrs, id: role.id ?? role.documentId ?? attrs.id }
  }

  return role
}

/**
 * @param {unknown} role
 * @returns {boolean}
 */
export function userHasClienteRole(role) {
  const normalized = normalizeRoleRef(role)
  if (normalized == null) return false
  if (typeof normalized === 'number') return normalized === STRAPI_CLIENTE_ROLE_ID
  if (typeof normalized === 'string') {
    const s = normalized.trim().toLowerCase()
    return s === 'cliente' || s === String(STRAPI_CLIENTE_ROLE_ID)
  }
  if (typeof normalized !== 'object') return false

  const id = normalized.id ?? normalized.documentId
  if (id != null && Number(id) === STRAPI_CLIENTE_ROLE_ID) return true
  if (id != null && String(id) === String(STRAPI_CLIENTE_ROLE_ID)) return true

  const name = pickString(normalized.name ?? normalized.slug)
  if (name?.toLowerCase() === 'cliente') return true

  const type = pickString(normalized.type)
  if (type?.toLowerCase() === 'cliente') return true

  return false
}

/** @param {string|null|undefined} raw */
export function formatClienteTelefone(raw) {
  if (raw == null || raw === '') return '—'
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length === 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  }
  return String(raw)
}

/** @param {number} index */
export function formatClienteCliCode(index) {
  return `CLI-${String(index + 1).padStart(3, '0')}`
}

/**
 * @typedef {object} ClienteItem
 * @property {string} id
 * @property {string} documentId
 * @property {string[]} idAliases
 * @property {string} username
 * @property {string} nome — igual a username (UI)
 * @property {string} email
 * @property {string} cliCode
 * @property {string} telefone — formatado
 * @property {number|null} telefoneNum
 * @property {number|null} nif
 * @property {string} pessoaContacto
 * @property {string} morada
 * @property {string} contentorCount
 * @property {ClienteLocalizacaoItem[]} localizacoes
 */

/**
 * @typedef {object} ClienteLocalizacaoItem
 * @property {string} [strapiId]
 * @property {string} nome — designação (guardada em morada no Strapi)
 * @property {string} morada
 * @property {number} ordem
 * @property {boolean} estado
 * @property {number|null} [lat]
 * @property {number|null} [lng]
 */

/**
 * @typedef {object} ClienteLocalizacaoInput
 * @property {string} [strapiId]
 * @property {string} nome
 * @property {number|null} [lat]
 * @property {number|null} [lng]
 */

/** @param {unknown} row */
function coerceLocalizacaoRow(row, index = 0) {
  if (!row || typeof row !== 'object') return null
  const attrs = row.attributes ?? row
  const id = extractStrapiEntityId(row)
  const morada = pickString(attrs.morada ?? row.morada) ?? ''
  const ordem = pickNumberField(attrs.ordem ?? row.ordem) ?? index + 1
  const estadoRaw = attrs.estado ?? row.estado
  const estado = estadoRaw === false ? false : true
  const lat = pickNumberField(attrs.lat ?? row.lat)
  const lng = pickNumberField(attrs.lng ?? row.lng)

  return {
    strapiId: id ?? undefined,
    nome: morada,
    morada,
    ordem,
    estado,
    lat,
    lng,
  }
}

/** @param {unknown} userRow */
function extractLocalizacoesFromUser(userRow) {
  if (!userRow || typeof userRow !== 'object') return []
  const attrs = userRow.attributes ?? userRow
  const raw = attrs.localizacaos ?? userRow.localizacaos
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((r, i) => coerceLocalizacaoRow(r, i)).filter(Boolean)
  }
  if (typeof raw === 'object' && raw.data != null) {
    const arr = Array.isArray(raw.data) ? raw.data : [raw.data]
    return arr.map((r, i) => coerceLocalizacaoRow(r, i)).filter(Boolean)
  }
  return []
}

/** @param {unknown} row */
function readUserFields(row) {
  const attrs = row?.attributes ?? row ?? {}
  return {
    username: pickString(attrs.username ?? row?.username),
    email: pickString(attrs.email ?? row?.email),
    nif: pickNumberField(attrs.nif ?? row?.nif),
    telefone: pickNumberField(attrs.telefone ?? row?.telefone),
    pessoaContacto: pickString(attrs.pessoaContacto ?? row?.pessoaContacto) ?? '',
    morada: pickString(attrs.morada ?? row?.morada) ?? '',
    role: attrs.role ?? row?.role,
  }
}

/**
 * @param {unknown} row
 * @param {number} index
 * @param {{ requireRoleMatch?: boolean }} [opts]
 * @returns {ClienteItem|null}
 */
function coerceClienteRow(row, index, opts = {}) {
  if (!row || typeof row !== 'object') return null
  const id = extractUserApiId(row) ?? extractStrapiEntityId(row)
  const fields = readUserFields(row)
  const role = normalizeRoleRef(fields.role)
  const strictRole = opts.requireRoleMatch !== false

  if (strictRole && !userHasClienteRole(role)) return null

  const username = fields.username ?? 'Cliente'
  if (!id && !username) return null

  const localizacoes = extractLocalizacoesFromUser(row)
  const documentId = extractStrapiEntityId(row)
  const idAliases = [...new Set([id, documentId].map((value) => pickString(value)).filter(Boolean))]

  return {
    id: id ?? String(index),
    documentId: documentId ?? id ?? String(index),
    idAliases,
    username,
    nome: username,
    email: fields.email ?? '',
    cliCode: formatClienteCliCode(index),
    telefone: formatClienteTelefone(fields.telefone),
    telefoneNum: fields.telefone,
    nif: fields.nif,
    pessoaContacto: fields.pessoaContacto,
    morada: fields.morada,
    contentorCount: '00',
    localizacoes: localizacoes.length > 0 ? localizacoes : [],
  }
}

function reindexClienteCliCodes(items) {
  return items.map((item, index) => ({
    ...item,
    cliCode: formatClienteCliCode(index),
  }))
}

/**
 * @param {Response} res
 * @param {string} fallback
 */
async function parseUsersApiError(res, fallback) {
  let message = fallback
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
    return 'Não tens permissão para esta operação. Contacta o suporte.'
  }
  if (res.status === 404) {
    return 'Registo não encontrado. Recarrega a lista e tenta de novo.'
  }
  return message
}

/**
 * @param {Record<string, string>} [extraParams]
 */
async function fetchUsersRequest(extraParams = {}) {
  const base = strapiBaseUrl()
  if (!base) return { ok: false, status: 0, rows: [] }

  const params = new URLSearchParams()
  params.set('pagination[pageSize]', '100')
  params.set('populate[role]', 'true')
  params.set('populate[localizacaos]', 'true')
  for (const [key, value] of Object.entries(extraParams)) {
    if (value != null && value !== '') params.set(key, value)
  }

  const url = `${base}/api/users?${params.toString()}`
  const res = await fetch(url, { headers: authHeaders() })
  let json = {}
  try {
    json = await res.json()
  } catch {
    json = {}
  }
  return { ok: res.ok, status: res.status, rows: parseUsersListRows(json) }
}

/**
 * @returns {Promise<ClienteItem[]>}
 */
export async function fetchStrapiClientes() {
  const base = strapiBaseUrl()
  if (!base) return []

  const filterAttempts = [
    { 'filters[role][id][$eq]': String(STRAPI_CLIENTE_ROLE_ID) },
    { 'filters[role][$eq]': String(STRAPI_CLIENTE_ROLE_ID) },
    { 'filters[role][name][$eq]': 'Cliente' },
  ]

  let lastStatus = 0
  let forbidden = false

  for (const extra of filterAttempts) {
    const { ok, status, rows } = await fetchUsersRequest(extra)
    lastStatus = status
    if (status === 403) {
      forbidden = true
      break
    }
    if (!ok) continue

    const items = rows
      .map((row, index) => coerceClienteRow(row, index, { requireRoleMatch: false }))
      .filter(Boolean)

    if (items.length > 0) return reindexClienteCliCodes(items)
  }

  const { ok, status, rows } = await fetchUsersRequest({})
  lastStatus = status
  if (status === 403) forbidden = true
  else if (ok && rows.length > 0) {
    const items = rows
      .map((row, index) => coerceClienteRow(row, index, { requireRoleMatch: true }))
      .filter(Boolean)
    if (items.length > 0) return reindexClienteCliCodes(items)
  }

  if (forbidden) {
    throw new Error('Não tens permissão para ver a lista de clientes. Contacta o suporte.')
  }
  if (lastStatus > 0 && lastStatus !== 403) {
    throw new Error('Não foi possível carregar os clientes. Tenta novamente mais tarde.')
  }
  return []
}

/**
 * @typedef {object} ClienteFormPayload
 * @property {string} username
 * @property {string} email
 * @property {string} [password]
 * @property {string} nif
 * @property {string} telefone
 * @property {string} pessoaContacto
 * @property {string} morada
 * @property {ClienteLocalizacaoInput[]} [localizacoes]
 */

/** PluralName da collection no Strapi (não é `localizacoes`). */
const LOCALIZACAO_API = 'localizacaos'

/** Campo de relação inversa no content-type Localização → User. */
const LOCALIZACAO_USER_RELATION_KEYS = ['user', 'users_permissions_user', 'cliente']

function localizacaoCollectionUrl(base, entityId = '') {
  const path = `${base}/api/${LOCALIZACAO_API}`
  return entityId ? `${path}/${encodeURIComponent(entityId)}` : path
}

/** @param {string} userId */
function userRelationRef(userId) {
  if (/^\d+$/.test(String(userId))) return Number(userId)
  return userId
}

/**
 * @param {ClienteLocalizacaoInput} loc
 * @param {number} ordem
 * @returns {{ morada: string, ordem: number, estado: boolean, lat?: number, lng?: number }|null}
 */
function buildLocalizacaoData(loc, ordem) {
  const nome = pickString(loc.nome)
  if (!nome) return null

  const data = { morada: nome, ordem, estado: true }
  const lat = loc.lat != null ? pickNumberField(loc.lat) : null
  const lng = loc.lng != null ? pickNumberField(loc.lng) : null
  if (lat != null) data.lat = lat
  if (lng != null) data.lng = lng
  return data
}

/**
 * Corpos POST/PUT a tentar (Strapi v4/v5 + relação com User).
 * @param {string} relKey
 * @param {string|number} userId
 * @param {{ morada: string, ordem: number, estado: boolean, lat?: number, lng?: number }} data
 */
function buildLocalizacaoWritePayloads(relKey, userId, data) {
  const ref = userRelationRef(userId)
  const base = { morada: data.morada, ordem: data.ordem, estado: data.estado }
  if (data.lat != null) base.lat = data.lat
  if (data.lng != null) base.lng = data.lng
  return [
    { data: { ...base, [relKey]: ref } },
    { data: { ...base, [relKey]: { connect: [ref] } } },
    { data: { ...base, [relKey]: { set: [ref] } } },
  ]
}

async function updateLocalizacaoRecord(url, data) {
  const res = await requestLocalizacao('PUT', url, { data })
  if (!res.ok) {
    throw new Error(await parseContentApiError(res, 'Não foi possível atualizar uma localização.'))
  }
}

/**
 * @param {Response} res
 * @param {string} fallback
 */
async function parseContentApiError(res, fallback) {
  let message = fallback
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
    return 'Não tens permissão para gerir localizações. Contacta o suporte.'
  }
  if (res.status === 404) {
    return 'Serviço de localizações indisponível. Contacta o suporte.'
  }
  return message
}

/**
 * @param {string} method
 * @param {string} url
 * @param {object} body
 */
async function requestLocalizacao(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res
}

/**
 * @param {string} userId
 * @param {{ morada: string, ordem: number, estado: boolean, lat?: number, lng?: number }} data
 */
async function createLocalizacaoForUser(userId, data) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Serviço indisponível. Tenta mais tarde.')

  let lastError = 'Não foi possível guardar a localização.'

  for (const relKey of LOCALIZACAO_USER_RELATION_KEYS) {
    for (const body of buildLocalizacaoWritePayloads(relKey, userId, data)) {
      const res = await requestLocalizacao('POST', localizacaoCollectionUrl(base), body)
      if (res.ok) {
        let json = {}
        try {
          json = await res.json()
        } catch {
          json = {}
        }
        const row = json.data ?? json
        const created = coerceLocalizacaoRow(row)
        const id = created?.strapiId ?? extractStrapiEntityId(row)
        if (id) return String(id)
      }
      lastError = await parseContentApiError(res, lastError)
    }
  }

  throw new Error(lastError)
}

/**
 * @param {string} userId
 */
async function fetchLocalizacoesForUser(userId) {
  const base = strapiBaseUrl()
  if (!base || !userId) return []

  for (const relKey of LOCALIZACAO_USER_RELATION_KEYS) {
    const params = new URLSearchParams()
    params.set(`filters[${relKey}][id][$eq]`, userId)
    params.set('sort', 'ordem:asc')
    params.set('pagination[pageSize]', '50')

    const res = await fetch(`${localizacaoCollectionUrl(base)}?${params.toString()}`, {
      headers: authHeaders(),
    })
    if (!res.ok) continue

    let json = {}
    try {
      json = await res.json()
    } catch {
      json = {}
    }
    const rows = parseContentListRows(json)
    if (rows.length > 0) {
      return rows.map((r, i) => coerceLocalizacaoRow(r, i)).filter(Boolean)
    }
  }

  return []
}

/**
 * @param {string} userId
 * @param {ClienteItem|null} [listFallback] Dados já obtidos na lista (se findOne falhar)
 * @returns {Promise<ClienteItem|null>}
 */
export async function fetchStrapiClienteDetail(userId, listFallback = null) {
  const base = strapiBaseUrl()
  if (!base || !userId) return listFallback ?? null

  const idsToTry = [...new Set([userId, listFallback?.id].filter(Boolean).map(String))]

  const queryVariants = [
    'populate[role]=true',
    '',
    'populate[role]=true&populate[localizacaos]=true',
    'populate=role',
  ]

  for (const id of idsToTry) {
    for (const qs of queryVariants) {
      const url = qs
        ? `${base}/api/users/${encodeURIComponent(id)}?${qs}`
        : `${base}/api/users/${encodeURIComponent(id)}`
      const res = await fetch(url, { headers: authHeaders() })
      if (!res.ok) continue

      let json = {}
      try {
        json = await res.json()
      } catch {
        json = {}
      }

      const row = json.user ?? json.data ?? json
      let item = coerceClienteRow(row, 0, { requireRoleMatch: false })
      if (!item) continue

      const locs = await fetchLocalizacoesForUser(item.id)
      if (locs.length > 0) item = { ...item, localizacoes: locs }
      else if (!item.localizacoes?.length && listFallback?.localizacoes?.length) {
        item = { ...item, localizacoes: listFallback.localizacoes }
      }

      return item
    }
  }

  if (listFallback) {
    const locs = await fetchLocalizacoesForUser(listFallback.id)
    return {
      ...listFallback,
      localizacoes: locs.length > 0 ? locs : listFallback.localizacoes ?? [],
    }
  }

  try {
    const list = await fetchStrapiClientes()
    const fromList = list.find(
      (c) => c.id === userId || String(c.id) === String(userId),
    )
    if (!fromList) return null
    const locs = await fetchLocalizacoesForUser(fromList.id)
    return {
      ...fromList,
      localizacoes: locs.length > 0 ? locs : fromList.localizacoes ?? [],
    }
  } catch {
    return null
  }
}

/**
 * @param {string} userId
 * @param {ClienteLocalizacaoInput[]} localizacoes
 */
async function syncLocalizacoesForUser(userId, localizacoes = []) {
  const base = strapiBaseUrl()
  if (!base) return

  const existing = await fetchLocalizacoesForUser(userId)
  const existingById = new Map(existing.map((l) => [l.strapiId, l]))
  const keepIds = new Set()
  const toCreate = []

  for (let i = 0; i < localizacoes.length; i += 1) {
    const loc = localizacoes[i]
    const data = buildLocalizacaoData(loc, i + 1)
    if (!data) continue

    if (loc.strapiId && existingById.has(loc.strapiId)) {
      await updateLocalizacaoRecord(localizacaoCollectionUrl(base, loc.strapiId), data)
      keepIds.add(loc.strapiId)
    } else {
      toCreate.push(data)
    }
  }

  for (const data of toCreate) {
    const createdId = await createLocalizacaoForUser(userId, data)
    if (typeof createdId === 'string') keepIds.add(createdId)
  }

  for (const prev of existing) {
    if (!prev.strapiId || keepIds.has(prev.strapiId)) continue
    const delRes = await fetch(localizacaoCollectionUrl(base, prev.strapiId), {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (!delRes.ok && delRes.status !== 404) {
      throw new Error(await parseContentApiError(delRes, 'Não foi possível remover uma localização.'))
    }
  }
}

/** @param {ClienteFormPayload} payload */
function buildUserCreateBody(payload) {
  const nif = pickNumberField(payload.nif)
  const telefone = pickNumberField(payload.telefone)
  const body = {
    username: payload.username.trim(),
    email: payload.email.trim(),
    role: STRAPI_CLIENTE_ROLE_ID,
    nif,
    telefone,
    pessoaContacto: payload.pessoaContacto.trim(),
    morada: payload.morada.trim(),
  }
  return body
}

/** @param {ClienteFormPayload} payload */
function buildUserUpdateBody(payload) {
  const nif = pickNumberField(payload.nif)
  const telefone = pickNumberField(payload.telefone)
  const body = {
    username: payload.username.trim(),
    email: payload.email.trim(),
    nif,
    telefone,
    pessoaContacto: payload.pessoaContacto.trim(),
    morada: payload.morada.trim(),
  }
  return body
}

/**
 * @param {ClienteFormPayload} payload
 * @returns {Promise<ClienteItem>}
 */
export async function createStrapiCliente(payload) {
  const nif = pickNumberField(payload.nif)
  const telefone = pickNumberField(payload.telefone)
  if (nif == null) throw new Error('NIF inválido.')
  if (telefone == null) throw new Error('Telefone inválido.')

  const { row, inviteEmailSent, inviteEmailError } = await postStrapiUserAndSendInviteEmail(
    buildUserCreateBody(payload),
    'Não foi possível registar o cliente.',
  )

  let item = coerceClienteRow(row, 0, { requireRoleMatch: false })
  if (!item) throw new Error('Resposta inválida ao criar cliente.')

  const userId = item.id
  if (payload.localizacoes?.length) {
    await syncLocalizacoesForUser(userId, payload.localizacoes)
    const detail = await fetchStrapiClienteDetail(userId)
    if (detail) item = detail
  }

  return {
    ...item,
    ...userInviteMetaFromResult({ row, inviteEmailSent, inviteEmailError }),
  }
}

/**
 * @param {string} userId
 * @param {ClienteFormPayload} payload
 * @returns {Promise<ClienteItem>}
 */
export async function updateStrapiCliente(userId, payload) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Serviço indisponível. Tenta mais tarde.')

  const nif = pickNumberField(payload.nif)
  const telefone = pickNumberField(payload.telefone)
  if (nif == null) throw new Error('NIF inválido.')
  if (telefone == null) throw new Error('Telefone inválido.')

  const res = await fetch(`${base}/api/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildUserUpdateBody(payload)),
  })

  if (!res.ok) {
    throw new Error(await parseUsersApiError(res, 'Não foi possível guardar as alterações.'))
  }

  const json = await res.json()
  const row = json.user ?? json.data ?? json
  let item = coerceClienteRow(row, 0, { requireRoleMatch: false })
  if (!item) throw new Error('Resposta inválida ao atualizar cliente.')

  if (payload.localizacoes) {
    await syncLocalizacoesForUser(userId, payload.localizacoes)
    const detail = await fetchStrapiClienteDetail(userId)
    if (detail) item = detail
  }

  return item
}
