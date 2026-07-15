import { useEffect, useState } from 'react'
import StrapiGlobalHead from './components/StrapiGlobalHead/StrapiGlobalHead.jsx'
import { AppLoadingProvider } from './context/AppLoadingContext.jsx'
import Login from './pages/Login/Login.jsx'
import Dashboard from './pages/Dashboard/Dashboard.jsx'
import RedefinirPalavraPasse from './pages/RedefinirPalavraPasse/RedefinirPalavraPasse.jsx'
import {
  STRAPI_JWT_STORAGE_KEY,
  clearStrapiSession,
  persistStrapiSessionAndHydrateUser,
} from './lib/strapiAuth.js'

function readIsResetPasswordRoute() {
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  return raw === 'redefinir-palavra-passe'
}

function AppShell() {
  const [isResetRoute, setIsResetRoute] = useState(readIsResetPasswordRoute)
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(localStorage.getItem(STRAPI_JWT_STORAGE_KEY)),
  )

  useEffect(() => {
    function onHashChange() {
      setIsResetRoute(readIsResetPasswordRoute())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  async function handleAuthSuccess(session) {
    await persistStrapiSessionAndHydrateUser(session)
    setIsAuthenticated(true)
  }

  function handleLogout() {
    clearStrapiSession()
    setIsAuthenticated(false)
  }

  if (isResetRoute) {
    return <RedefinirPalavraPasse />
  }

  if (isAuthenticated) {
    return <Dashboard onLogout={handleLogout} />
  }

  return <Login onAuthSuccess={handleAuthSuccess} />
}

export default function App() {
  return (
    <AppLoadingProvider>
      <StrapiGlobalHead />
      <AppShell />
    </AppLoadingProvider>
  )
}
