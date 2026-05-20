/** IDs válidos da barra inferior admin. */
export const ADMIN_NAV_IDS = ['recolhas', 'contentores', 'dashboard', 'clientes', 'tickets']

/** IDs válidos da barra inferior operador. */
export const OPERADOR_NAV_IDS = ['movimentos', 'dashboard', 'historico']

/**
 * @returns {{ profile: 'admin'|'operador', section: string, sub: string|null }|null}
 */
export function parseAppHash() {
  const raw = window.location.hash.replace(/^#\/?/, '').trim()
  if (!raw) return null
  const parts = raw.split('/').filter(Boolean)
  if (parts.length < 2) return null
  const [profile, section, sub] = parts
  if (profile !== 'admin' && profile !== 'operador') return null
  return { profile, section, sub: sub ?? null }
}

/**
 * @param {'admin'|'operador'} profile
 * @param {string} section
 * @param {string|null} [sub]
 */
export function buildAppHash(profile, section, sub = null) {
  let path = `/${profile}/${section}`
  if (sub) path += `/${sub}`
  return path
}

/**
 * @param {'admin'|'operador'} profile
 * @param {string} section
 * @param {string|null} [sub]
 */
export function setAppHash(profile, section, sub = null) {
  const path = buildAppHash(profile, section, sub)
  const target = `#${path}`
  if (window.location.hash !== target) {
    window.location.hash = path
  }
}

/** @returns {string} */
export function readAdminNavId() {
  const parsed = parseAppHash()
  if (parsed?.profile === 'admin' && ADMIN_NAV_IDS.includes(parsed.section)) {
    return parsed.section
  }
  return 'dashboard'
}

/** @returns {'list'|'create'} */
export function readAdminContentoresView() {
  const parsed = parseAppHash()
  if (parsed?.profile === 'admin' && parsed.section === 'contentores' && parsed.sub === 'criar') {
    return 'create'
  }
  return 'list'
}

/** @returns {string} */
export function readOperadorNavId() {
  const parsed = parseAppHash()
  if (parsed?.profile === 'operador' && OPERADOR_NAV_IDS.includes(parsed.section)) {
    return parsed.section
  }
  return 'dashboard'
}
