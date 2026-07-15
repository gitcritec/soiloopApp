/**
 * Utilizadores internos (admin / operador) — plugin::users-permissions.user.
 */

import { STRAPI_JWT_STORAGE_KEY } from './strapiAuth.js'
import {
  postStrapiUserAndSendInviteEmail,
  userInviteMetaFromResult,
} from './strapiUserInvite.js'

export const STRAPI_ADMIN_ROLE_ID = Number(import.meta.env.VITE_STRAPI_ADMIN_ROLE_ID) || null
export const STRAPI_OPERADOR_ROLE_ID =
  Number(import.meta.env.VITE_STRAPI_OPERADOR_ROLE_ID) || null

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

function roleName(role) {
  const normalized = normalizeRoleRef(role)
  if (normalized == null) return ''
  if (typeof normalized === 'object') {
    return pickString(normalized.name ?? normalized.type)?.toLowerCase() ?? ''
  }
  return String(normalized).toLowerCase()
}

function roleId(role) {
  const normalized = normalizeRoleRef(role)
  if (normalized == null) return null
  if (typeof normalized === 'number') return normalized
  if (typeof normalized === 'string' && /^\d+$/.test(normalized)) return Number(normalized)
  if (typeof normalized === 'object' && normalized.id != null) {
    const n = Number(normalized.id)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function matchesRole(role, { roleId: expectedId, roleNames = [] }) {
  if (expectedId != null && roleId(role) === expectedId) return true
  const name = roleName(role)
  return roleNames.some((label) => name === label.toLowerCase())
}

/**
 * @param {unknown} row
 * @returns {string|null}
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

/**
 * @typedef {{ id: string, nome: string, email: string|null, username: string|null }} StaffUserItem
 */

/**
 * @param {unknown} row
 * @returns {StaffUserItem|null}
 */
export function coerceStaffUserRow(row) {
  if (!row || typeof row !== 'object') return null
  const attrs = row.attributes ?? row
  const id = extractUserApiId(row)
  if (!id) return null
  const username = pickString(attrs.username)
  const email = pickString(attrs.email)
  const nome = username ?? email ?? `Utilizador ${id}`
  return { id, nome, email, username }
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
      err?.error?.message ?? err?.error?.details?.errors?.[0]?.message ?? err?.message
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
 * @param {{ roleId?: number|null, roleNames?: string[], filterAttempts?: Record<string, string>[] }} config
 * @returns {Promise<StaffUserItem[]>}
 */
async function fetchStaffUsersByRole(config) {
  const base = strapiBaseUrl()
  if (!base) return []

  const roleNames = config.roleNames ?? []
  const filterAttempts = [...(config.filterAttempts ?? [])]
  if (config.roleId != null) {
    filterAttempts.push(
      { 'filters[role][id][$eq]': String(config.roleId) },
      { 'filters[role][$eq]': String(config.roleId) },
    )
  }
  for (const name of roleNames) {
    filterAttempts.push({ 'filters[role][name][$eq]': name })
  }

  for (const extra of filterAttempts) {
    const { ok, rows } = await fetchUsersRequest(extra)
    if (!ok) continue
    const items = rows.map((row) => coerceStaffUserRow(row)).filter(Boolean)
    if (items.length > 0) {
      return items.sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
    }
  }

  const { ok, rows } = await fetchUsersRequest({})
  if (!ok) return []

  return rows
    .filter((row) =>
      matchesRole(row.role ?? row.attributes?.role, {
        roleId: config.roleId ?? null,
        roleNames,
      }),
    )
    .map((row) => coerceStaffUserRow(row))
    .filter(Boolean)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt'))
}

/**
 * @param {string} userId
 * @returns {Promise<StaffUserItem|null>}
 */
export async function fetchStrapiStaffUserById(userId) {
  const id = pickString(userId)
  if (!id) return null

  const base = strapiBaseUrl()
  if (!base) return null

  const res = await fetch(`${base}/api/users/${encodeURIComponent(id)}?populate[role]=true`, {
    headers: authHeaders(),
  })
  if (!res.ok) return null

  let json = null
  try {
    json = await res.json()
  } catch {
    return null
  }

  const row = json?.user ?? json?.data ?? json
  return coerceStaffUserRow(row)
}

/**
 * @typedef {{ username: string, email: string }} StaffUserFormPayload
 * @typedef {import('./strapiUserInvite.js').UserInviteMeta} UserInviteMeta
 */

function resolveRoleIdForCreate(kind) {
  if (kind === 'admin') {
    if (STRAPI_ADMIN_ROLE_ID != null) return STRAPI_ADMIN_ROLE_ID
    throw new Error('Configura VITE_STRAPI_ADMIN_ROLE_ID no .env (id da role Admin no Strapi).')
  }
  if (STRAPI_OPERADOR_ROLE_ID != null) return STRAPI_OPERADOR_ROLE_ID
  throw new Error('Configura VITE_STRAPI_OPERADOR_ROLE_ID no .env (id da role Operador no Strapi).')
}

/**
 * @param {'admin'|'operador'} kind
 * @param {StaffUserFormPayload} payload
 */
export async function createStrapiStaffUser(kind, payload) {
  const username = payload.username.trim()
  const email = payload.email.trim()
  if (!username) throw new Error('O nome de utilizador é obrigatório.')
  if (!email) throw new Error('O e-mail é obrigatório.')

  const { row, inviteEmailSent, inviteEmailError } = await postStrapiUserAndSendInviteEmail(
    {
      username,
      email,
      role: resolveRoleIdForCreate(kind),
    },
    kind === 'admin'
      ? 'Não foi possível criar o administrador.'
      : 'Não foi possível criar o operador.',
  )

  const item = coerceStaffUserRow(row)
  if (!item) throw new Error('Resposta inválida ao criar utilizador.')

  return {
    ...item,
    ...userInviteMetaFromResult({ row, inviteEmailSent, inviteEmailError }),
  }
}

/**
 * @param {string} userId
 * @param {StaffUserFormPayload} payload
 */
export async function updateStrapiStaffUser(userId, payload) {
  const id = pickString(userId)
  if (!id) throw new Error('Utilizador em falta.')

  const base = strapiBaseUrl()
  if (!base) throw new Error('Serviço indisponível. Tenta mais tarde.')

  const username = payload.username.trim()
  const email = payload.email.trim()
  if (!username) throw new Error('O nome de utilizador é obrigatório.')
  if (!email) throw new Error('O e-mail é obrigatório.')

  /** @type {Record<string, unknown>} */
  const body = { username, email }

  const res = await fetch(`${base}/api/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(await parseUsersApiError(res, 'Não foi possível guardar as alterações.'))
  }

  const json = await res.json()
  const item = coerceStaffUserRow(json?.user ?? json?.data ?? json)
  if (!item) throw new Error('Resposta inválida ao atualizar utilizador.')
  return item
}

/** @returns {Promise<StaffUserItem[]>} */
export function fetchStrapiAdmins() {
  return fetchStaffUsersByRole({
    roleId: STRAPI_ADMIN_ROLE_ID,
    roleNames: ['Admin', 'Administrador', 'Administrator'],
  })
}

/** @returns {Promise<StaffUserItem[]>} */
export function fetchStrapiOperadoresStaff() {
  return fetchStaffUsersByRole({
    roleId: STRAPI_OPERADOR_ROLE_ID,
    roleNames: ['Operador'],
  })
}
