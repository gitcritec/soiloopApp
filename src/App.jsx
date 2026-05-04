import { useState } from 'react'
import Login from './pages/Login/Login.jsx'
import Dashboard from './pages/Dashboard/Dashboard.jsx'

function App() {
  // Quando existir auth real (API, token, contexto), isto passa a derivar da sessão.
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  if (isAuthenticated) {
    return <Dashboard />
  }

  return <Login onEnter={() => setIsAuthenticated(true)} />
}

export default App
