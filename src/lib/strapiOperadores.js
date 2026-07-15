/**
 * Operadores — plugin::users-permissions.user (role «Operador»).
 */

import { fetchStrapiOperadoresStaff, STRAPI_OPERADOR_ROLE_ID } from './strapiUsersStaff.js'
import {
  createStrapiStaffUser,
  fetchStrapiStaffUserById,
  updateStrapiStaffUser,
} from './strapiUsersStaff.js'

export { STRAPI_OPERADOR_ROLE_ID } from './strapiUsersStaff.js'

/** @typedef {import('./strapiUsersStaff.js').StaffUserItem} OperadorItem */

/**
 * Lista operadores (Users & Permissions, role Operador).
 * @returns {Promise<OperadorItem[]>}
 */
export async function fetchStrapiOperadores() {
  return fetchStrapiOperadoresStaff()
}

/** @param {string} operadorId */
export function fetchStrapiOperadorDetail(operadorId) {
  return fetchStrapiStaffUserById(operadorId)
}

/** @param {import('./strapiUsersStaff.js').StaffUserFormPayload} payload */
export function createStrapiOperador(payload) {
  return createStrapiStaffUser('operador', payload)
}

/** @param {string} operadorId @param {import('./strapiUsersStaff.js').StaffUserFormPayload} payload */
export function updateStrapiOperador(operadorId, payload) {
  return updateStrapiStaffUser(operadorId, payload)
}
