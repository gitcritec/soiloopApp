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

/**
 * Guarda JWT e nome de utilizador (plugin::users-permissions.user) após login.
 * @param {{ jwt: string, user?: object }} session
 */
export function persistStrapiSession(session) {
  if (session?.jwt) {
    localStorage.setItem(STRAPI_JWT_STORAGE_KEY, session.jwt)
  }
  const u = session?.user
  const username = typeof u?.username === 'string' && u.username.trim() ? u.username.trim() : ''
  if (username) {
    localStorage.setItem(STRAPI_USER_STORAGE_KEY, JSON.stringify({ username }))
  }
}

/** @returns {string|null} */
export function getStoredStrapiUsername() {
  try {
    const raw = localStorage.getItem(STRAPI_USER_STORAGE_KEY)
    if (!raw) return null
    const j = JSON.parse(raw)
    return typeof j.username === 'string' && j.username ? j.username : null
  } catch {
    return null
  }
}

/** Atualiza só o nome guardado (ex. após /api/users/me). */
export function persistStrapiUsername(username) {
  const u = typeof username === 'string' ? username.trim() : ''
  if (u) localStorage.setItem(STRAPI_USER_STORAGE_KEY, JSON.stringify({ username: u }))
}

/**
 * Utilizador autenticado (ex.: após refresh, se ainda existir JWT).
 * @returns {Promise<{ username?: string, email?: string } | null>}
 */
export async function fetchStrapiCurrentUser() {
  const base = strapiBaseUrl()
  const jwt = localStorage.getItem(STRAPI_JWT_STORAGE_KEY)
  if (!base || !jwt) return null

  try {
    const res = await fetch(`${base}/api/users/me`, {
      headers: { Authorization: `Bearer ${jwt}` },
    })
    if (!res.ok) return null
    const json = await res.json()
    if (json?.username !== undefined) return json
    if (json?.data?.username !== undefined) return json.data
    const attrs = json?.data?.attributes
    if (attrs?.username) return { username: attrs.username, email: attrs.email }
    return null
  } catch {
    return null
  }
}
