import { useState } from 'react'
import { AppLoadingProvider } from './context/AppLoadingContext.jsx'
import Login from './pages/Login/Login.jsx'
import Dashboard from './pages/Dashboard/Dashboard.jsx'
import { STRAPI_JWT_STORAGE_KEY, persistStrapiSession } from './lib/strapiAuth.js'

function AppShell() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(localStorage.getItem(STRAPI_JWT_STORAGE_KEY)),
  )

  function handleAuthSuccess(session) {
    persistStrapiSession(session)
    setIsAuthenticated(true)
  }

  if (isAuthenticated) {
    return <Dashboard />
  }

  return <Login onAuthSuccess={handleAuthSuccess} />
}

export default function App() {
  return (
    <AppLoadingProvider>
      <AppShell />
    </AppLoadingProvider>
  )
}
