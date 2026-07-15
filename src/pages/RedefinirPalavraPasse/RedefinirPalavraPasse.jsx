import { faLock } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect, useState } from 'react'
import logoImg from '../../assets/logo.png'
import { resetStrapiPassword } from '../../lib/strapiAuth.js'
import { fetchStrapiGlobalLogoUrl } from '../../lib/strapiGlobal.js'
import '../Login/Login.css'
import './RedefinirPalavraPasse.css'

function readResetCodeFromHash() {
  const hash = window.location.hash
  const qIndex = hash.indexOf('?')
  if (qIndex === -1) return null
  const params = new URLSearchParams(hash.slice(qIndex + 1))
  const code = params.get('code')
  return code?.trim() || null
}

export default function RedefinirPalavraPasse({ onDone }) {
  const [code, setCode] = useState(() => readResetCodeFromHash())
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
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

  useEffect(() => {
    function syncCode() {
      setCode(readResetCodeFromHash())
    }
    window.addEventListener('hashchange', syncCode)
    return () => window.removeEventListener('hashchange', syncCode)
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    if (!code) {
      setError('Link inválido ou expirado. Pede um novo email de palavra-passe.')
      return
    }
    if (password.length < 8) {
      setError('A palavra-passe deve ter pelo menos 8 caracteres.')
      return
    }
    if (password !== passwordConfirm) {
      setError('As palavras-passe não coincidem.')
      return
    }

    setLoading(true)
    try {
      await resetStrapiPassword(code, password, passwordConfirm)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível redefinir a palavra-passe.')
    } finally {
      setLoading(false)
    }
  }

  function handleGoToLogin() {
    window.location.hash = ''
    onDone?.()
  }

  return (
    <main className="login-page redefinir-palavra-passe">
      <div className="login-page__column">
        <header className="brand-area">
          <img
            className="brand-logo redefinir-palavra-passe__logo"
            src={brandLogoSrc ?? logoImg}
            alt="Logo Soiloop"
          />
        </header>

        <h1 className="redefinir-palavra-passe__title">Definir palavra-passe</h1>

        {success ? (
          <div className="redefinir-palavra-passe__success">
            <p>A palavra-passe foi atualizada com sucesso.</p>
            <button type="button" className="submit-button" onClick={handleGoToLogin}>
              Ir para o login
            </button>
          </div>
        ) : (
          <form className="login-form redefinir-palavra-passe__form" onSubmit={handleSubmit}>
            {error ? (
              <p className="login-form__error" role="alert">
                {error}
              </p>
            ) : null}

            {!code ? (
              <p className="redefinir-palavra-passe__hint" role="status">
                Abre o link que recebeste por email para definir a tua palavra-passe.
              </p>
            ) : null}

            <label className="sr-only" htmlFor="new-password">
              Nova palavra-passe
            </label>
            <div className="input-wrap">
              <span className="input-icon" aria-hidden="true">
                <FontAwesomeIcon icon={faLock} className="input-icon__svg" />
              </span>
              <input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Nova palavra-passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading || !code}
                required
                minLength={8}
              />
            </div>

            <label className="sr-only" htmlFor="confirm-password">
              Confirmar palavra-passe
            </label>
            <div className="input-wrap">
              <span className="input-icon" aria-hidden="true">
                <FontAwesomeIcon icon={faLock} className="input-icon__svg" />
              </span>
              <input
                id="confirm-password"
                name="passwordConfirmation"
                type="password"
                autoComplete="new-password"
                placeholder="Confirmar palavra-passe"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                disabled={loading || !code}
                required
                minLength={8}
              />
            </div>

            <button type="submit" className="submit-button" disabled={loading || !code}>
              {loading ? 'A guardar…' : 'Guardar palavra-passe'}
            </button>

            <p className="helper-text">
              <a href="#" onClick={(e) => { e.preventDefault(); handleGoToLogin() }}>
                Voltar ao login
              </a>
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
