/**
 * Administradores — reexporta API de utilizadores internos.
 */

import {
  createStrapiStaffUser,
  fetchStrapiAdmins,
  fetchStrapiStaffUserById,
  updateStrapiStaffUser,
} from './strapiUsersStaff.js'

export { fetchStrapiAdmins, STRAPI_ADMIN_ROLE_ID } from './strapiUsersStaff.js'

/** @typedef {import('./strapiUsersStaff.js').StaffUserItem} AdminItem */

/** @param {string} adminId */
export function fetchStrapiAdminDetail(adminId) {
  return fetchStrapiStaffUserById(adminId)
}

/** @param {import('./strapiUsersStaff.js').StaffUserFormPayload} payload */
export function createStrapiAdmin(payload) {
  return createStrapiStaffUser('admin', payload)
}

/** @param {string} adminId @param {import('./strapiUsersStaff.js').StaffUserFormPayload} payload */
export function updateStrapiAdmin(adminId, payload) {
  return updateStrapiStaffUser(adminId, payload)
}
