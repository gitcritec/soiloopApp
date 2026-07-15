import { useEffect, useState } from 'react'
import {
  fetchStrapiCurrentUser,
  getStoredStrapiRoleLabel,
  getStoredStrapiUsername,
  normalizeStrapiUserRole,
  persistStrapiUserCache,
  resolveDashboardProfile,
} from '../../lib/strapiAuth.js'
import { fetchStrapiGlobalLogoSmallUrl } from '../../lib/strapiGlobal.js'
import { ensureAppHashProfile } from '../../lib/appRoute.js'
import Admin from './Admin/Admin.jsx'
import Cliente from './Cliente/Cliente.jsx'
import Operador from './Operador/Operador.jsx'
import { MOCK_OPERATOR_NAME } from './Operador/mockData.js'

/**
 * Encaminha para o painel Admin, Cliente ou Operador consoante a role do Strapi.
 */
export default function Dashboard({ onLogout }) {
  const [headerLogoSrc, setHeaderLogoSrc] = useState(null)
  const [userName, setUserName] = useState(
    () => getStoredStrapiUsername() ?? MOCK_OPERATOR_NAME,
  )
  const [userRole, setUserRole] = useState(() => getStoredStrapiRoleLabel() ?? '')
  const profile = resolveDashboardProfile(userRole)

  useEffect(() => {
    const storedProfile = resolveDashboardProfile(getStoredStrapiRoleLabel())
    ensureAppHashProfile(storedProfile)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchStrapiGlobalLogoSmallUrl().then((url) => {
      if (!cancelled && url) setHeaderLogoSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchStrapiCurrentUser().then((u) => {
      if (cancelled || !u) return
      persistStrapiUserCache(u)
      const name = u.username?.trim() || u.email?.trim()
      if (name) setUserName(name)
      const label = normalizeStrapiUserRole(u.role) ?? getStoredStrapiRoleLabel() ?? ''
      setUserRole(label)
      ensureAppHashProfile(resolveDashboardProfile(label))
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (profile === 'admin') {
    return (
      <Admin
        onLogout={onLogout}
        userName={userName}
        userRole={userRole}
        headerLogoSrc={headerLogoSrc}
      />
    )
  }

  if (profile === 'cliente') {
    return (
      <Cliente
        onLogout={onLogout}
        userName={userName}
        userRole={userRole}
        headerLogoSrc={headerLogoSrc}
      />
    )
  }

  return <Operador onLogout={onLogout} />
}
