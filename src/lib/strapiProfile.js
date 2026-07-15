/**
 * Perfil do utilizador autenticado (admin, operador, cliente).
 */

import { fetchStrapiClienteDetail, updateStrapiCliente } from './strapiClientes.js'
import {
  fetchStrapiCurrentUser,
  getStoredStrapiUserId,
  isStrapiClienteRoleLabel,
  normalizeStrapiUserRole,
  persistStrapiUserCache,
} from './strapiAuth.js'
import { updateStrapiStaffUser } from './strapiUsersStaff.js'

/**
 * @typedef {'admin'|'operador'|'cliente'} ProfileKind
 */

/**
 * @typedef {object} StaffProfileForm
 * @property {string} username
 * @property {string} email
 */

/**
 * @typedef {StaffProfileForm & {
 *   nif: string
 *   telefone: string
 *   pessoaContacto: string
 *   morada: string
 * }} ClienteProfileForm
 */

/**
 * @param {ProfileKind} profileKind
 */
export async function fetchStrapiProfileForm(profileKind) {
  const user = await fetchStrapiCurrentUser()
  const userId = user?.id ?? getStoredStrapiUserId()
  if (!userId) throw new Error('Sessão inválida. Inicia sessão novamente.')

  const roleLabel = normalizeStrapiUserRole(user?.role) ?? ''
  const isCliente = profileKind === 'cliente' || isStrapiClienteRoleLabel(roleLabel)

  if (isCliente) {
    const detail = await fetchStrapiClienteDetail(String(userId))
    if (detail) {
      return {
        kind: 'cliente',
        roleLabel: roleLabel || 'Cliente',
        form: {
          username: detail.username ?? detail.nome ?? '',
          email: detail.email ?? '',
          nif: detail.nif != null ? String(detail.nif) : '',
          telefone: detail.telefone ?? '',
          pessoaContacto: detail.pessoaContacto ?? '',
          morada: detail.morada ?? '',
        },
      }
    }
  }

  return {
    kind: 'staff',
    roleLabel: roleLabel || profileKind,
    form: {
      username: user?.username?.trim() || user?.email?.trim() || '',
      email: user?.email?.trim() || '',
    },
  }
}

/**
 * @param {ProfileKind} profileKind
 * @param {StaffProfileForm|ClienteProfileForm} form
 */
export async function saveStrapiProfileForm(profileKind, form) {
  const userId = getStoredStrapiUserId()
  if (!userId) throw new Error('Sessão inválida. Inicia sessão novamente.')

  if (profileKind === 'cliente') {
    /** @type {ClienteProfileForm} */
    const clienteForm = form
    const saved = await updateStrapiCliente(String(userId), {
      username: clienteForm.username,
      email: clienteForm.email,
      nif: clienteForm.nif,
      telefone: clienteForm.telefone,
      pessoaContacto: clienteForm.pessoaContacto,
      morada: clienteForm.morada,
    })
    persistStrapiUserCache({
      id: saved.id,
      username: saved.username ?? saved.nome,
      email: saved.email,
    })
    return saved
  }

  /** @type {StaffProfileForm} */
  const staffForm = form
  const saved = await updateStrapiStaffUser(String(userId), staffForm)
  persistStrapiUserCache({
    id: saved.id,
    username: saved.username ?? saved.nome,
    email: saved.email,
  })
  return saved
}
