import './Login.css'
import logoImg from '../assets/logo.png'
import loginImage from '../assets/imagem-login.png'

export default function Login() {
  return (
    <main className="login-page">
      <section className="login-card">
        <header className="brand-area">
          <img className="brand-logo" src={logoImg} alt="Logo Soiloop" />

          <p className="hero-text">
            Entra no loop infinito <br />
            da <strong>regeneração</strong> dos solos.
          </p>
        </header>

        <img
          className="hero-illustration"
          src={loginImage}
          alt="Ilustração de reciclagem e regeneração dos solos"
        />

        <form className="login-form" onSubmit={(event) => event.preventDefault()}>
          <label className="sr-only" htmlFor="username">
            Utilizador
          </label>
          <div className="input-wrap">
            <span className="input-icon" aria-hidden="true">
              👤
            </span>
            <input id="username" type="text" placeholder="Utilizador" />
          </div>

          <label className="sr-only" htmlFor="password">
            Palavra-Passe
          </label>
          <div className="input-wrap">
            <span className="input-icon" aria-hidden="true">
              🔒
            </span>
            <input id="password" type="password" placeholder="Palavra-Passe" />
          </div>

          <p className="helper-text">
            Esqueceu a Palavra-passe? <a href="#recuperar">Recuperar Password</a>
          </p>

          <button type="submit" className="submit-button" disabled>
            Entrar
          </button>

          <p className="signup-text">
            Novo Utilizador? <a href="#criar">Criar Conta</a>
          </p>
        </form>

        <footer className="footer">
          <p>
            <strong>© 2025 SOLO URBANO.</strong> Todos os direitos reservados.
          </p>
          <p>
            Developed by <strong>CRITEC</strong>
          </p>
        </footer>
      </section>
    </main>
  )
}
