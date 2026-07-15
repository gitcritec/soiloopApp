/**
 * Convite por email — criação de utilizadores sem palavra-passe definida pelo admin.
 * Usa POST /api/users com password temporária + POST /api/auth/forgot-password.
 */

import { STRAPI_JWT_STORAGE_KEY } from './strapiAuth.js'

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

/** Password temporária (nunca mostrada); o utilizador define a sua via email. */
export function generateInternalInvitePassword() {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now()}${Math.random().toString(36).slice(2)}`
  return `Iv!${rand}A1`
}

/**
 * Envia email de redefinição de palavra-passe (Strapi Users & Permissions).
 * @param {string} email
 */
export async function sendStrapiPasswordResetEmail(email) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Serviço indisponível. Tenta mais tarde.')

  const e = pickString(email)
  if (!e) throw new Error('E-mail em falta.')

  const res = await fetch(`${base}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: e }),
  })

  if (!res.ok) {
    let message = 'Não foi possível enviar o email de definição de palavra-passe.'
    let errBody = null
    try {
      errBody = await res.json()
      const detail = errBody?.error?.message ?? errBody?.message
      if (detail && detail !== 'Internal Server Error') {
        message = String(detail)
      }
    } catch {
      /* ignore */
    }

    if (res.status === 500) {
      message =
        'O Strapi falhou ao enviar o email (erro 500). No painel: Settings → Users & Permissions → Advanced settings → «Reset password page» deve apontar para a app (ex.: https://o-teu-dominio/#/redefinir-palavra-passe). Confirma também o template «Reset password» e consulta os logs do servidor Strapi.'
    }

    console.error('[sendStrapiPasswordResetEmail]', res.status, errBody)
    throw new Error(message)
  }

  return true
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
  return message
}

/**
 * @typedef {{ row: unknown, inviteEmailSent: boolean, inviteEmailError: string|null }} StrapiUserInviteResult
 */

/**
 * Cria utilizador e envia email para definir palavra-passe.
 * @param {Record<string, unknown>} userBody Campos do POST /api/users (sem password)
 * @param {string} createErrorFallback
 * @returns {Promise<StrapiUserInviteResult>}
 */
export async function postStrapiUserAndSendInviteEmail(userBody, createErrorFallback) {
  const base = strapiBaseUrl()
  if (!base) throw new Error('Serviço indisponível. Tenta mais tarde.')

  const email = pickString(userBody.email)
  if (!email) throw new Error('E-mail em falta.')

  const res = await fetch(`${base}/api/users`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...userBody,
      password: generateInternalInvitePassword(),
      confirmed: true,
      blocked: false,
    }),
  })

  if (!res.ok) {
    throw new Error(await parseUsersApiError(res, createErrorFallback))
  }

  const json = await res.json()
  const row = json?.user ?? json?.data ?? json

  let inviteEmailSent = false
  let inviteEmailError = null
  try {
    await sendStrapiPasswordResetEmail(email)
    inviteEmailSent = true
  } catch (err) {
    inviteEmailError = err instanceof Error ? err.message : 'Não foi possível enviar o email.'
  }

  return { row, inviteEmailSent, inviteEmailError }
}

/**
 * Metadados devolvidos após criar utilizador com convite por email.
 * @typedef {object} UserInviteMeta
 * @property {boolean} inviteEmailSent
 * @property {string|null} [inviteEmailError]
 */

/** @param {StrapiUserInviteResult} result */
export function userInviteMetaFromResult(result) {
  return {
    inviteEmailSent: Boolean(result?.inviteEmailSent),
    inviteEmailError: result?.inviteEmailError ?? null,
  }
}

/** @param {{ inviteEmailSent?: boolean, inviteEmailError?: string|null }} [meta] */
export function formatUserInviteNotice(meta) {
  if (!meta) return null
  if (meta.inviteEmailSent) {
    return 'Conta criada. Foi enviado um email para definir a palavra-passe.'
  }
  if (meta.inviteEmailError) {
    return `Conta criada, mas o email não foi enviado: ${meta.inviteEmailError}`
  }
  return null
}
