/** IDs válidos da barra inferior admin. */
export const ADMIN_NAV_IDS = ['recolhas', 'contentores', 'dashboard', 'clientes', 'tickets']

/** IDs válidos da barra inferior operador. */
export const OPERADOR_NAV_IDS = ['movimentos', 'dashboard', 'historico']

/**
 * @returns {{ profile: 'admin'|'operador', section: string, sub: string|null, id: string|null }|null}
 */
export function parseAppHash() {
  const raw = window.location.hash.replace(/^#\/?/, '').trim()
  if (!raw) return null
  const parts = raw.split('/').filter(Boolean)
  if (parts.length < 2) return null
  const profile = parts[0]
  const section = parts[1]
  if (profile !== 'admin' && profile !== 'operador') return null
  const sub = parts[2] ?? null
  const idRaw = parts[3] ?? null
  return {
    profile,
    section,
    sub,
    id: idRaw ? decodeURIComponent(idRaw) : null,
  }
}

/**
 * @param {'admin'|'operador'} profile
 * @param {string} section
 * @param {string|null} [sub]
 * @param {string|null} [id]
 */
export function buildAppHash(profile, section, sub = null, id = null) {
  let path = `/${profile}/${section}`
  if (sub) path += `/${sub}`
  if (id) path += `/${encodeURIComponent(String(id))}`
  return path
}

/**
 * @param {'admin'|'operador'} profile
 * @param {string} section
 * @param {string|null} [sub]
 * @param {string|null} [id]
 */
export function setAppHash(profile, section, sub = null, id = null) {
  const path = buildAppHash(profile, section, sub, id)
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

/** @returns {'list'|'create'|'edit'} */
export function readAdminContentoresView() {
  const parsed = parseAppHash()
  if (parsed?.profile === 'admin' && parsed.section === 'contentores') {
    if (parsed.sub === 'criar') return 'create'
    if (parsed.sub === 'editar' && parsed.id) return 'edit'
  }
  return 'list'
}

/** @returns {'list'|'create'|'edit'} */
export function readAdminClientesView() {
  const parsed = parseAppHash()
  if (parsed?.profile === 'admin' && parsed.section === 'clientes') {
    if (parsed.sub === 'criar') return 'create'
    if (parsed.sub === 'editar' && parsed.id) return 'edit'
  }
  return 'list'
}

/** @returns {string|null} */
export function readAdminClientesEditId() {
  const parsed = parseAppHash()
  if (
    parsed?.profile === 'admin' &&
    parsed.section === 'clientes' &&
    parsed.sub === 'editar' &&
    parsed.id
  ) {
    return parsed.id
  }
  return null
}

/** @returns {string|null} ID do contentor em edição (hash `#/admin/contentores/editar/:id`). */
export function readAdminContentoresEditId() {
  const parsed = parseAppHash()
  if (
    parsed?.profile === 'admin' &&
    parsed.section === 'contentores' &&
    parsed.sub === 'editar' &&
    parsed.id
  ) {
    return parsed.id
  }
  return null
}

/** @returns {string} */
export function readOperadorNavId() {
  const parsed = parseAppHash()
  if (parsed?.profile === 'operador' && OPERADOR_NAV_IDS.includes(parsed.section)) {
    return parsed.section
  }
  return 'dashboard'
}
