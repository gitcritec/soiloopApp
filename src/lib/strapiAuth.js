/**
 * Autenticação contra Strapi (Users & Permissions).
 * @see https://docs.strapi.io/dev-docs/plugins/users-permissions
 */

function strapiBaseUrl() {
  const raw = import.meta.env.VITE_STRAPI_URL
  if (!raw || typeof raw !== 'string') return ''
  return raw.replace(/\/+$/, '')
}

function mapErrorMessage(message) {
  if (!message) return 'Não foi possível iniciar sessão.'
  const s = String(message).toLowerCase()
  if (s.includes('invalid identifier') || s.includes('invalid credentials'))
    return 'Email ou palavra-passe incorretos.'
  return String(message)
}

/**
 * @param {string} identifier Email ou username Strapi
 * @param {string} password
 * @returns {Promise<{ jwt: string, user: object }>}
 */
export async function loginStrapi(identifier, password) {
  const base = strapiBaseUrl()
  if (!base) {
    throw new Error('Configura VITE_STRAPI_URL no ficheiro .env (ex.: http://localhost:1337)')
  }

  const res = await fetch(`${base}/api/auth/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: identifier.trim(),
      password,
    }),
  })

  let data
  try {
    data = await res.json()
  } catch {
    data = {}
  }

  if (!res.ok) {
    const raw =
      data?.error?.message ??
      data?.error?.data?.[0]?.messages?.[0]?.message ??
      data?.message
    throw new Error(mapErrorMessage(raw))
  }

  if (!data.jwt) {
    throw new Error('Resposta inválida do servidor.')
  }

  return { jwt: data.jwt, user: data.user ?? {} }
}

export const STRAPI_JWT_STORAGE_KEY = 'soiloop_strapi_jwt'
export const STRAPI_USER_STORAGE_KEY = 'soiloop_strapi_user'

/** Remove JWT e dados locais do utilizador (logout). */
export function clearStrapiSession() {
  localStorage.removeItem(STRAPI_JWT_STORAGE_KEY)
  localStorage.removeItem(STRAPI_USER_STORAGE_KEY)
}

function readStoredUserJson() {
  try {
    const raw = localStorage.getItem(STRAPI_USER_STORAGE_KEY)
    if (!raw) return {}
    const j = JSON.parse(raw)
    return typeof j === 'object' && j !== null ? j : {}
  } catch {
    return {}
  }
}

function writeStoredUserJson(payload) {
  if (!payload.username && !payload.roleLabel) return
  localStorage.setItem(STRAPI_USER_STORAGE_KEY, JSON.stringify(payload))
}

/**
 * Campo `role` do user Strapi: texto, enum, componente ou relação (U&P com `name`).
 * @param {unknown} role
 * @returns {string|null}
 */
export function normalizeStrapiUserRole(role) {
  if (role == null) return null
  if (typeof role === 'string') {
    const s = role.trim()
    return s || null
  }
  if (typeof role === 'number') return null
  if (typeof role === 'object') {
    const tryStr = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    const direct =
      tryStr(role.name) ??
      tryStr(role.slug) ??
      tryStr(role.label) ??
      tryStr(role.title) ??
      tryStr(role.displayName) ??
      tryStr(role.value) ??
      tryStr(role.description)
    if (direct) return direct
    const type = tryStr(role.type)
    if (type) return type
    const attrs = role.attributes ?? role.data?.attributes
    if (attrs && typeof attrs === 'object') {
      const fromAttrs =
        tryStr(attrs.name) ??
        tryStr(attrs.slug) ??
        tryStr(attrs.label) ??
        tryStr(attrs.title) ??
        tryStr(attrs.value)
      if (fromAttrs) return fromAttrs
    }
    const dataFlat = role.data
    if (dataFlat && typeof dataFlat === 'object' && !dataFlat.attributes) {
      const fromData =
        tryStr(dataFlat.name) ??
        tryStr(dataFlat.slug) ??
        tryStr(dataFlat.label) ??
        tryStr(dataFlat.title)
      if (fromData) return fromData
    }
  }
  return null
}

/**
 * Indica se o texto da função corresponde a administrador (Strapi Users & Permissions, `role.name`).
 * @param {string|null|undefined} label
 * @returns {boolean}
 */
export function isStrapiAdminRoleLabel(label) {
  if (label == null) return false
  const s = String(label).trim().toLowerCase()
  if (!s) return false
  return (
    s === 'admin' ||
    s === 'administrator' ||
    s === 'administrador' ||
    s === 'super admin' ||
    s === 'strapi super admin'
  )
}

/**
 * Normaliza o JSON de /users/me ou do login (Strapi v4/v5, `data` / `attributes`).
 * @param {unknown} raw
 * @returns {{ username?: string, email?: string, role?: unknown } | null}
 */
function coerceStrapiUserPayload(raw) {
  if (!raw || typeof raw !== 'object') return null
  if (raw.username !== undefined || raw.email !== undefined || raw.role !== undefined) {
    return { username: raw.username, email: raw.email, role: raw.role }
  }
  const attrs = raw.attributes
  if (attrs && typeof attrs === 'object') {
    if (attrs.username !== undefined || attrs.email !== undefined || attrs.role !== undefined) {
      return { username: attrs.username, email: attrs.email, role: attrs.role }
    }
  }
  const inner = raw.data
  if (inner && typeof inner === 'object') {
    if (inner.username !== undefined || inner.email !== undefined || inner.role !== undefined) {
      return { username: inner.username, email: inner.email, role: inner.role }
    }
    const a = inner.attributes
    if (a && typeof a === 'object') {
      if (a.username !== undefined || a.email !== undefined || a.role !== undefined) {
        return { username: a.username, email: a.email, role: a.role }
      }
    }
  }
  return null
}

/**
 * Guarda JWT, nome e função (`role`) após login.
 * O Strapi costuma **não** incluir `role` no JSON de `/api/auth/local` — usa `persistStrapiSessionAndHydrateUser`.
 * @param {{ jwt: string, user?: object }} session
 */
export function persistStrapiSession(session) {
  if (session?.jwt) {
    localStorage.setItem(STRAPI_JWT_STORAGE_KEY, session.jwt)
  }
  const rawUser = session?.user
  const u = coerceStrapiUserPayload(rawUser) ?? rawUser ?? {}
  const username =
    (typeof u?.username === 'string' && u.username.trim()) ||
    (typeof u?.email === 'string' && u.email.trim()) ||
    ''
  const roleLabel = normalizeStrapiUserRole(u?.role)
  const existing = readStoredUserJson()
  const next = { ...existing }
  if (username) next.username = username
  if (roleLabel) next.roleLabel = roleLabel
  writeStoredUserJson(next)
}

/**
 * Grava a sessão do login e preenche `role` via `/api/users/me` (populate), porque o `user` do auth/local vem sem role.
 * @param {{ jwt: string, user?: object }} session
 * @returns {Promise<void>}
 */
export async function persistStrapiSessionAndHydrateUser(session) {
  persistStrapiSession(session)
  const u = await fetchStrapiCurrentUser()
  if (u) persistStrapiUserCache(u)
}

/** @returns {string|null} */
export function getStoredStrapiUsername() {
  const j = readStoredUserJson()
  return typeof j.username === 'string' && j.username ? j.username : null
}

/** @returns {string|null} */
export function getStoredStrapiRoleLabel() {
  const j = readStoredUserJson()
  return typeof j.roleLabel === 'string' && j.roleLabel.trim() ? j.roleLabel.trim() : null
}

/** Atualiza só o nome guardado (ex. após /api/users/me), mantendo `roleLabel` se existir. */
export function persistStrapiUsername(username) {
  const u = typeof username === 'string' ? username.trim() : ''
  if (!u) return
  const existing = readStoredUserJson()
  writeStoredUserJson({ ...existing, username: u })
}

/**
 * Atualiza cache local com o objeto utilizador (nome + role).
 * @param {{ username?: string, email?: string, role?: unknown } | null} user
 */
export function persistStrapiUserCache(user) {
  if (!user) return
  const existing = readStoredUserJson()
  const username =
    (typeof user.username === 'string' && user.username.trim()) ||
    (typeof user.email === 'string' && user.email.trim()) ||
    existing.username ||
    ''
  const roleLabel = normalizeStrapiUserRole(user.role) ?? existing.roleLabel ?? null
  const next = { ...existing }
  if (username) next.username = username
  if (roleLabel) next.roleLabel = roleLabel
  writeStoredUserJson(next)
}

/**
 * Utilizador autenticado (ex.: após refresh, se ainda existir JWT).
 * @returns {Promise<{ username?: string, email?: string, role?: unknown } | null>}
 */
export async function fetchStrapiCurrentUser() {
  const base = strapiBaseUrl()
  const jwt = localStorage.getItem(STRAPI_JWT_STORAGE_KEY)
  if (!base || !jwt) return null

  const headers = { Authorization: `Bearer ${jwt}` }

  async function fetchMe(search) {
    const url = search ? `${base}/api/users/me${search}` : `${base}/api/users/me`
    const res = await fetch(url, { headers })
    if (!res.ok) return null
    try {
      return await res.json()
    } catch {
      return null
    }
  }

  /** Várias formas de populate (Strapi v4 / v5 REST). */
  const ROLE_POPULATE_QUERIES = [
    '',
    '?populate=role',
    '?populate%5Brole%5D=true',
    `?${new URLSearchParams({
      'populate[role][fields][0]': 'name',
      'populate[role][fields][1]': 'slug',
      'populate[role][fields][2]': 'type',
    }).toString()}`,
  ]

  function userFromJson(json) {
    return coerceStrapiUserPayload(json) ?? coerceStrapiUserPayload(json?.data)
  }

  try {
    let bestUser = null

    for (const q of ROLE_POPULATE_QUERIES) {
      const json = await fetchMe(q)
      if (!json) continue
      const user = userFromJson(json)
      if (!user) continue
      const label = normalizeStrapiUserRole(user.role)
      if (label) return user
      if (!bestUser) bestUser = user
    }

    let user = bestUser
    if (!user) return null

    let label = normalizeStrapiUserRole(user.role)
    const roleOnlyId =
      user.role &&
      typeof user.role === 'object' &&
      typeof user.role.id === 'number' &&
      !label &&
      Object.keys(user.role).length <= 6

    if (roleOnlyId) {
      for (const q of ROLE_POPULATE_QUERIES) {
        if (!q) continue
        const jsonPop = await fetchMe(q)
        if (!jsonPop) continue
        const u2 = userFromJson(jsonPop)
        if (u2?.role) {
          user = { ...user, role: u2.role }
          label = normalizeStrapiUserRole(u2.role)
          if (label) break
        }
      }
    }

    return user
  } catch {
    return null
  }
}
