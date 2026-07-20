/** IDs válidos da barra inferior admin. */
export const ADMIN_NAV_IDS = ['recolhas', 'contentores', 'dashboard', 'clientes', 'tickets']

/** Secções admin só no menu lateral (não aparecem na barra inferior). */
export const ADMIN_DRAWER_SECTION_IDS = ['admins', 'operadores', 'perfil', 'definicoes']

/** Secção de perfil (menu lateral nas 3 roles). */
export const PROFILE_SECTION_ID = 'perfil'

/** IDs válidos da barra inferior cliente. */
export const CLIENTE_NAV_IDS = ['dashboard', 'recolhas', 'contentores', 'tickets', 'historico']

/** IDs válidos da barra inferior operador. */
export const OPERADOR_NAV_IDS = ['dashboard', 'historico']

/** Secções operador fora da barra inferior. */
export const OPERADOR_SCREEN_IDS = ['processar', ...OPERADOR_NAV_IDS]

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
  if (profile !== 'admin' && profile !== 'operador' && profile !== 'cliente') return null
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
 * @param {'admin'|'operador'|'cliente'} profile
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
 * @param {'admin'|'operador'|'cliente'} profile
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

/** @returns {string} Secção principal do admin (barra inferior ou menu lateral). */
export function readAdminSection() {
  const parsed = parseAppHash()
  if (parsed?.profile !== 'admin') return 'dashboard'
  const section = parsed.section
  if ([...ADMIN_NAV_IDS, ...ADMIN_DRAWER_SECTION_IDS].includes(section)) return section
  return 'dashboard'
}

/** @returns {boolean} */
export function readIsProfileSection(profile) {
  const parsed = parseAppHash()
  return parsed?.profile === profile && parsed.section === PROFILE_SECTION_ID
}

/** @returns {string} */
export function readAdminNavId() {
  const section = readAdminSection()
  if (ADMIN_NAV_IDS.includes(section)) return section
  return 'dashboard'
}

/** @returns {'list'|'create'|'edit'} */
export function readAdminAdminsView() {
  const parsed = parseAppHash()
  if (parsed?.profile === 'admin' && parsed.section === 'admins') {
    if (parsed.sub === 'criar') return 'create'
    if (parsed.sub === 'editar' && parsed.id) return 'edit'
  }
  return 'list'
}

/** @returns {string|null} */
export function readAdminAdminsEditId() {
  const parsed = parseAppHash()
  if (
    parsed?.profile === 'admin' &&
    parsed.section === 'admins' &&
    parsed.sub === 'editar' &&
    parsed.id
  ) {
    return parsed.id
  }
  return null
}

/** @returns {'list'|'create'|'edit'} */
export function readAdminOperadoresView() {
  const parsed = parseAppHash()
  if (parsed?.profile === 'admin' && parsed.section === 'operadores') {
    if (parsed.sub === 'criar') return 'create'
    if (parsed.sub === 'editar' && parsed.id) return 'edit'
  }
  return 'list'
}

/** @returns {string|null} */
export function readAdminOperadoresEditId() {
  const parsed = parseAppHash()
  if (
    parsed?.profile === 'admin' &&
    parsed.section === 'operadores' &&
    parsed.sub === 'editar' &&
    parsed.id
  ) {
    return parsed.id
  }
  return null
}

/** @returns {'list'|'create'|'edit'|'detail'} */
export function readAdminContentoresView() {
  const parsed = parseAppHash()
  if (parsed?.profile === 'admin' && parsed.section === 'contentores') {
    if (parsed.sub === 'criar') return 'create'
    if (parsed.sub === 'editar' && parsed.id) return 'edit'
    if (parsed.sub === 'detalhe' && parsed.id) return 'detail'
  }
  return 'list'
}

/** @returns {string|null} */
export function readAdminContentoresDetailId() {
  const parsed = parseAppHash()
  if (
    parsed?.profile === 'admin' &&
    parsed.section === 'contentores' &&
    parsed.sub === 'detalhe' &&
    parsed.id
  ) {
    return parsed.id
  }
  return null
}

/** @returns {'list'|'create'|'edit'|'detail'} */
export function readAdminClientesView() {
  const parsed = parseAppHash()
  if (parsed?.profile === 'admin' && parsed.section === 'clientes') {
    if (parsed.sub === 'criar') return 'create'
    if (parsed.sub === 'editar' && parsed.id) return 'edit'
    if (parsed.sub === 'detalhe' && parsed.id) return 'detail'
  }
  return 'list'
}

/** @returns {string|null} */
export function readAdminClientesDetailId() {
  const parsed = parseAppHash()
  if (
    parsed?.profile === 'admin' &&
    parsed.section === 'clientes' &&
    parsed.sub === 'detalhe' &&
    parsed.id
  ) {
    return parsed.id
  }
  return null
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

/** @returns {'list'|'detail'|'reply'} */
export function readAdminTicketsView() {
  const parsed = parseAppHash()
  if (parsed?.profile === 'admin' && parsed.section === 'tickets') {
    if (parsed.sub === 'detalhe' && parsed.id) return 'detail'
    if (parsed.sub === 'responder' && parsed.id) return 'reply'
  }
  return 'list'
}

/** @returns {string|null} */
export function readAdminTicketsId() {
  const parsed = parseAppHash()
  if (
    parsed?.profile === 'admin' &&
    parsed.section === 'tickets' &&
    (parsed.sub === 'detalhe' || parsed.sub === 'responder') &&
    parsed.id
  ) {
    return parsed.id
  }
  return null
}

/** @returns {boolean} Mostrar FAB «Processar» (listagens admin; ocultar em formulários/detalhe). */
export function readAdminShowProcessarButton() {
  const parsed = parseAppHash()
  if (parsed?.profile !== 'admin') return false

  const section = parsed.section
  if (section === 'contentores') return readAdminContentoresView() === 'list'
  if (section === 'clientes') return readAdminClientesView() === 'list'
  if (section === 'tickets') return readAdminTicketsView() === 'list'
  if (section === 'admins') return readAdminAdminsView() === 'list'
  if (section === 'operadores') return readAdminOperadoresView() === 'list'
  if (section === PROFILE_SECTION_ID) return false
  if (section === 'definicoes') return false

  return ['dashboard', 'recolhas', 'contentores', 'clientes', 'tickets'].includes(section)
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
export function readClienteNavId() {
  const parsed = parseAppHash()
  if (parsed?.profile !== 'cliente') return 'dashboard'
  if (parsed.section === PROFILE_SECTION_ID) return 'dashboard'
  if (parsed.section === 'tickets') return 'tickets'
  if (CLIENTE_NAV_IDS.includes(parsed.section)) return parsed.section
  return 'dashboard'
}

/** @returns {string|null} */
function normalizeClienteTicketsSub(sub) {
  if (!sub) return null
  if (sub === 'detalha') return 'detalhe'
  return sub
}

/** @returns {'list'|'create'|'detail'|'message'|'success'} */
export function readClienteTicketsView() {
  const parsed = parseAppHash()
  if (parsed?.profile === 'cliente' && parsed.section === 'tickets') {
    const sub = normalizeClienteTicketsSub(parsed.sub)
    if (sub === 'criar') return 'create'
    if (sub === 'detalhe' && parsed.id) return 'detail'
    if (sub === 'mensagem' && parsed.id) return 'message'
    if (sub === 'sucesso' && parsed.id) return 'success'
  }
  return 'list'
}

/** @returns {string|null} */
export function readClienteTicketsId() {
  const parsed = parseAppHash()
  const sub = normalizeClienteTicketsSub(parsed?.sub)
  if (
    parsed?.profile === 'cliente' &&
    parsed.section === 'tickets' &&
    sub &&
    ['detalhe', 'mensagem', 'sucesso'].includes(sub) &&
    parsed.id
  ) {
    return parsed.id
  }
  return null
}

/** @returns {boolean} */
export function readClienteShowCriarTicketButton() {
  const parsed = parseAppHash()
  if (parsed?.profile !== 'cliente') return false
  if (parsed.section === PROFILE_SECTION_ID) return false
  if (parsed.section === 'tickets') return readClienteTicketsView() === 'list'
  return false
}

/** @returns {string} */
export function readOperadorNavId() {
  const parsed = parseAppHash()
  if (parsed?.profile !== 'operador') return 'dashboard'
  if (parsed.section === PROFILE_SECTION_ID) return 'dashboard'
  if (OPERADOR_NAV_IDS.includes(parsed.section)) {
    return parsed.section
  }
  return 'dashboard'
}

/** @returns {boolean} */
export function readOperadorProcessarOpen() {
  const parsed = parseAppHash()
  return parsed?.profile === 'operador' && parsed.section === 'processar'
}

/** @returns {'dashboard'|'processar'} */
export function readOperadorScreen() {
  return readOperadorProcessarOpen() ? 'processar' : 'dashboard'
}

/** @returns {boolean} Mostrar FAB «Processar» no dashboard do operador. */
export function readOperadorShowProcessarButton() {
  const parsed = parseAppHash()
  if (parsed?.profile !== 'operador') return false
  if (parsed.section === PROFILE_SECTION_ID) return false
  if (parsed.section === 'processar') return false
  return parsed.section === 'dashboard' || OPERADOR_NAV_IDS.includes(parsed.section)
}

/**
 * Alinha o hash da app ao perfil autenticado (evita operador preso em #/cliente/...).
 * @param {'admin'|'cliente'|'operador'} expectedProfile
 */
export function ensureAppHashProfile(expectedProfile) {
  const parsed = parseAppHash()
  if (parsed?.profile === expectedProfile) return

  if (expectedProfile === 'operador') {
    setAppHash('operador', 'dashboard')
    return
  }
  if (expectedProfile === 'cliente') {
    setAppHash('cliente', 'dashboard')
    return
  }
  setAppHash('admin', 'dashboard')
}
