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

  let data = {}
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
