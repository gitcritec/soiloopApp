import { useState } from 'react'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'

function App() {
  // Quando existir auth real (API, token, contexto), isto passa a derivar da sessão.
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  if (isAuthenticated) {
    return <Dashboard onLogout={() => setIsAuthenticated(false)} />
  }

  return <Login />
}

export default App
