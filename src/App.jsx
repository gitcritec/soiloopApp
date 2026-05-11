import { useState } from 'react'
import StrapiGlobalHead from './components/StrapiGlobalHead/StrapiGlobalHead.jsx'
import { AppLoadingProvider } from './context/AppLoadingContext.jsx'
import Login from './pages/Login/Login.jsx'
import Dashboard from './pages/Dashboard/Dashboard.jsx'
import {
  STRAPI_JWT_STORAGE_KEY,
  clearStrapiSession,
  persistStrapiSession,
} from './lib/strapiAuth.js'

function AppShell() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(localStorage.getItem(STRAPI_JWT_STORAGE_KEY)),
  )

  function handleAuthSuccess(session) {
    persistStrapiSession(session)
    setIsAuthenticated(true)
  }

  function handleLogout() {
    clearStrapiSession()
    setIsAuthenticated(false)
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
