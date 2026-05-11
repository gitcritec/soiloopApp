import { faLock, faUser } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useState } from 'react'
import './Login.css'
import logoImg from '../../assets/logo.png'
import loginImage from '../../assets/imagem-login.png'
import { useAppLoading } from '../../context/AppLoadingContext.jsx'
import { loginStrapi } from '../../lib/strapiAuth.js'
import { fetchStrapiGlobalLogoUrl } from '../../lib/strapiGlobal.js'

export default function Login({ onAuthSuccess }) {
  const { beginLoading, endLoading } = useAppLoading()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [brandLogoSrc, setBrandLogoSrc] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchStrapiGlobalLogoUrl().then((url) => {
      if (!cancelled && url) setBrandLogoSrc(url)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)
    beginLoading()
    try {
      const session = await loginStrapi(identifier, password)
      onAuthSuccess?.(session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido.')
    } finally {
      endLoading()
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-page__column">
        <header className="brand-area">
          <img
            className="brand-logo"
            src={brandLogoSrc ?? logoImg}
            alt="Logo Soiloop"
          />
        </header>

        <p className="hero-text">
          Entra no loop infinito <br />
          da <strong>regeneração</strong> dos solos.
        </p>

        <img
          className="hero-illustration"
          src={loginImage}
          alt="Ilustração de reciclagem e regeneração dos solos"
        />

        <form className="login-form" onSubmit={handleSubmit}>
          {error ? (
            <p className="login-form__error" role="alert">
              {error}
            </p>
          ) : null}

          <label className="sr-only" htmlFor="username">
            Email ou utilizador
          </label>
          <div className="input-wrap">
            <span className="input-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faUser} className="input-icon__svg" />
            </span>
            <input
              id="username"
              name="identifier"
              type="text"
              autoComplete="username"
              placeholder="Email ou utilizador"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <label className="sr-only" htmlFor="password">
            Palavra-Passe
          </label>
          <div className="input-wrap">
            <span className="input-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faLock} className="input-icon__svg" />
            </span>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Palavra-Passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <p className="helper-text">
            <span className="helper-text__muted">Esqueceu a Palavra-passe? </span>
            <a href="#recuperar">Recuperar Password</a>
          </p>

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? 'A entrar…' : 'Entrar'}
          </button>

          <p className="signup-text">
            <span className="signup-text__muted">Novo Utilizador? </span>
            <a href="#criar">Criar Conta</a>
          </p>
        </form>

        <footer className="footer">
          <p className="footer__copyright">
            <strong>© 2026 SOLO URBANO</strong>
            <span className="footer__copyright-gap"> </span>
            <span>Todos os direitos reservados.</span>
          </p>
          <p className="footer__dev">
            Developed by <strong>CRITEC</strong>
          </p>
        </footer>
      </div>
    </main>
  )
}
