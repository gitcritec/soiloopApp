import { useEffect, useState } from 'react'
import { changeStrapiPassword } from '../../lib/strapiAuth.js'
import { fetchStrapiProfileForm, saveStrapiProfileForm } from '../../lib/strapiProfile.js'
import './Perfil.css'

/** @typedef {'admin'|'operador'|'cliente'} ProfileKind */

function emptyStaffForm() {
  return { username: '', email: '' }
}

function emptyClienteForm() {
  return {
    username: '',
    email: '',
    nif: '',
    telefone: '',
    pessoaContacto: '',
    morada: '',
  }
}

function emptyPasswordForm() {
  return {
    currentPassword: '',
    password: '',
    passwordConfirmation: '',
  }
}

/**
 * Edição do perfil do utilizador autenticado.
 * @param {{ profileKind: ProfileKind, onUserUpdated?: (name: string) => void }} props
 */
export default function Perfil({ profileKind, onUserUpdated }) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [roleLabel, setRoleLabel] = useState('')
  const [isClienteProfile, setIsClienteProfile] = useState(profileKind === 'cliente')
  const [staffForm, setStaffForm] = useState(emptyStaffForm)
  const [clienteForm, setClienteForm] = useState(emptyClienteForm)
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileNotice, setProfileNotice] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordNotice, setPasswordNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError('')
    fetchStrapiProfileForm(profileKind)
      .then((result) => {
        if (cancelled) return
        setRoleLabel(result.roleLabel || profileKind)
        setIsClienteProfile(result.kind === 'cliente')
        if (result.kind === 'cliente') {
          setClienteForm(result.form)
        } else {
          setStaffForm(result.form)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar o perfil.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [profileKind])

  function updateStaffField(field, value) {
    setStaffForm((prev) => ({ ...prev, [field]: value }))
    setProfileError('')
    setProfileNotice('')
  }

  function updateClienteField(field, value) {
    setClienteForm((prev) => ({ ...prev, [field]: value }))
    setProfileError('')
    setProfileNotice('')
  }

  function updatePasswordField(field, value) {
    setPasswordForm((prev) => ({ ...prev, [field]: value }))
    setPasswordError('')
    setPasswordNotice('')
  }

  async function handleSaveProfile(e) {
    e.preventDefault()
    setProfileError('')
    setProfileNotice('')

    setSavingProfile(true)
    try {
      const payload = isClienteProfile ? clienteForm : staffForm
      const saved = await saveStrapiProfileForm(profileKind, payload)
      const name =
        saved.username?.trim() ||
        saved.nome?.trim() ||
        saved.email?.trim() ||
        payload.username?.trim() ||
        payload.email?.trim() ||
        ''
      if (name) onUserUpdated?.(name)
      setProfileNotice('Perfil atualizado com sucesso.')
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Não foi possível guardar o perfil.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleSavePassword(e) {
    e.preventDefault()
    setPasswordError('')
    setPasswordNotice('')

    const { currentPassword, password, passwordConfirmation } = passwordForm
    if (!currentPassword) {
      setPasswordError('Indica a palavra-passe atual.')
      return
    }
    if (password.length < 8) {
      setPasswordError('A nova palavra-passe deve ter pelo menos 8 caracteres.')
      return
    }
    if (password !== passwordConfirmation) {
      setPasswordError('As palavras-passe não coincidem.')
      return
    }

    setSavingPassword(true)
    try {
      await changeStrapiPassword(currentPassword, password, passwordConfirmation)
      setPasswordForm(emptyPasswordForm())
      setPasswordNotice('Palavra-passe alterada com sucesso.')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Não foi possível alterar a palavra-passe.')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <p className="perfil__loading" role="status">
        A carregar perfil…
      </p>
    )
  }

  if (loadError) {
    return (
      <p className="perfil__load-error" role="alert">
        {loadError}
      </p>
    )
  }

  const displayRole = roleLabel

  return (
    <div className="perfil">
      <header className="perfil__head">
        <h1 className="perfil__title">Perfil</h1>
        {displayRole ? <p className="perfil__role">{displayRole}</p> : null}
      </header>

      <form className="perfil__card" onSubmit={handleSaveProfile} noValidate>
        <div className="perfil__scroll">
          <h2 className="perfil__section-title">Dados da conta</h2>

          {profileError ? (
            <p className="perfil__error" role="alert">
              {profileError}
            </p>
          ) : null}

          {profileNotice ? (
            <p className="perfil__notice" role="status">
              {profileNotice}
            </p>
          ) : null}

          <label className="perfil__field">
            <span className="perfil__label">
              {isClienteProfile ? 'Nome' : 'Nome de utilizador'}
            </span>
            <input
              type="text"
              className="perfil__input"
              value={isClienteProfile ? clienteForm.username : staffForm.username}
              onChange={(e) =>
                isClienteProfile
                  ? updateClienteField('username', e.target.value)
                  : updateStaffField('username', e.target.value)
              }
              autoComplete="username"
              required
            />
          </label>

          <label className="perfil__field">
            <span className="perfil__label">E-mail</span>
            <input
              type="email"
              className="perfil__input"
              value={isClienteProfile ? clienteForm.email : staffForm.email}
              onChange={(e) =>
                isClienteProfile
                  ? updateClienteField('email', e.target.value)
                  : updateStaffField('email', e.target.value)
              }
              autoComplete="email"
              required
            />
          </label>

          {isClienteProfile ? (
            <>
              <label className="perfil__field">
                <span className="perfil__label">NIF</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="perfil__input"
                  value={clienteForm.nif}
                  onChange={(e) => updateClienteField('nif', e.target.value)}
                  required
                />
              </label>

              <label className="perfil__field">
                <span className="perfil__label">Telefone</span>
                <input
                  type="tel"
                  className="perfil__input"
                  value={clienteForm.telefone}
                  onChange={(e) => updateClienteField('telefone', e.target.value)}
                  required
                />
              </label>

              <label className="perfil__field">
                <span className="perfil__label">Pessoa de contacto</span>
                <input
                  type="text"
                  className="perfil__input"
                  value={clienteForm.pessoaContacto}
                  onChange={(e) => updateClienteField('pessoaContacto', e.target.value)}
                  required
                />
              </label>

              <label className="perfil__field">
                <span className="perfil__label">Morada</span>
                <input
                  type="text"
                  className="perfil__input"
                  value={clienteForm.morada}
                  onChange={(e) => updateClienteField('morada', e.target.value)}
                  required
                />
              </label>
            </>
          ) : null}
        </div>

        <div className="perfil__actions">
          <button
            type="submit"
            className="perfil__btn perfil__btn--primary"
            disabled={savingProfile || savingPassword}
          >
            {savingProfile ? 'A guardar…' : 'Guardar perfil'}
          </button>
        </div>
      </form>

      <section className="perfil__card perfil__card--password" aria-labelledby="perfil-password-title">
        <div className="perfil__scroll">
          <h2 id="perfil-password-title" className="perfil__section-title">
            Palavra-passe
          </h2>

          <form className="perfil__password-form" onSubmit={handleSavePassword} noValidate>
            {passwordError ? (
              <p className="perfil__error" role="alert">
                {passwordError}
              </p>
            ) : null}

            {passwordNotice ? (
              <p className="perfil__notice" role="status">
                {passwordNotice}
              </p>
            ) : null}

            <label className="perfil__field">
              <span className="perfil__label">Palavra-passe atual</span>
              <input
                type="password"
                className="perfil__input"
                value={passwordForm.currentPassword}
                onChange={(e) => updatePasswordField('currentPassword', e.target.value)}
                autoComplete="current-password"
              />
            </label>

            <label className="perfil__field">
              <span className="perfil__label">Nova palavra-passe</span>
              <input
                type="password"
                className="perfil__input"
                value={passwordForm.password}
                onChange={(e) => updatePasswordField('password', e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
            </label>

            <label className="perfil__field">
              <span className="perfil__label">Confirmar nova palavra-passe</span>
              <input
                type="password"
                className="perfil__input"
                value={passwordForm.passwordConfirmation}
                onChange={(e) => updatePasswordField('passwordConfirmation', e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
            </label>

            <button
              type="submit"
              className="perfil__btn perfil__btn--secondary"
              disabled={savingPassword || savingProfile}
            >
              {savingPassword ? 'A guardar…' : 'Alterar palavra-passe'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
