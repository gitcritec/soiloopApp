import { useEffect, useState } from 'react'
import { sendStrapiPasswordResetEmail } from '../../lib/strapiUserInvite.js'
import './StaffUserRegisto.css'

function emptyForm() {
  return {
    username: '',
    email: '',
  }
}

/** @param {import('../../lib/strapiUsersStaff.js').StaffUserItem} user */
function formFromUser(user) {
  return {
    username: user.username && user.username !== user.email ? user.username : (user.nome ?? ''),
    email: user.email ?? '',
  }
}

/**
 * Formulário partilhado para administrador / operador.
 */
export default function StaffUserRegisto({
  title,
  userId,
  userToEdit,
  fetchDetail,
  onCreate,
  onUpdate,
  onCancel,
  onSuccess,
}) {
  const resolvedId = userId ?? userToEdit?.id ?? null
  const isEdit = Boolean(resolvedId)
  const [form, setForm] = useState(() => (userToEdit ? formFromUser(userToEdit) : emptyForm()))
  const [loadingDetail, setLoadingDetail] = useState(Boolean(resolvedId && !userToEdit))
  const [submitting, setSubmitting] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)
  const [formError, setFormError] = useState('')
  const [formNotice, setFormNotice] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteNotice, setInviteNotice] = useState('')

  useEffect(() => {
    if (!resolvedId || !fetchDetail) {
      setLoadingDetail(false)
      return
    }
    let cancelled = false
    setLoadingDetail(true)
    setFormError('')
    fetchDetail(resolvedId)
      .then((detail) => {
        if (cancelled) return
        if (detail) {
          setForm(formFromUser(detail))
        } else if (!userToEdit) {
          setFormError('Não foi possível carregar os dados.')
        }
      })
      .catch(() => {
        if (!cancelled && !userToEdit) {
          setFormError('Não foi possível carregar os dados.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false)
      })
    return () => {
      cancelled = true
    }
  }, [resolvedId, userToEdit, fetchDetail])

  useEffect(() => {
    if (userToEdit) {
      setForm(formFromUser(userToEdit))
      setFormError('')
      setFormNotice('')
    }
  }, [userToEdit])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFormError('')
    setFormNotice('')
    setInviteError('')
    setInviteNotice('')
  }

  function handleDiscard() {
    if (isEdit && userToEdit) {
      setForm(formFromUser(userToEdit))
    } else {
      setForm(emptyForm())
    }
    setFormError('')
    setFormNotice('')
    setInviteError('')
    setInviteNotice('')
    onCancel?.()
  }

  async function handleSendPasswordEmail() {
    const email = form.email.trim()
    if (!email) {
      setInviteError('Indica um e-mail válido antes de enviar o convite.')
      setInviteNotice('')
      return
    }
    setSendingInvite(true)
    setInviteError('')
    setInviteNotice('')
    setFormError('')
    setFormNotice('')
    try {
      await sendStrapiPasswordResetEmail(email)
      setInviteNotice('Foi enviado um email para definir ou redefinir a palavra-passe.')
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Não foi possível enviar o email.')
    } finally {
      setSendingInvite(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    setFormNotice('')

    const username = form.username.trim()
    const email = form.email.trim()

    if (!username) {
      setFormError('O nome de utilizador é obrigatório.')
      return
    }
    if (!email) {
      setFormError('O e-mail é obrigatório.')
      return
    }

    const payload = { username, email }

    setSubmitting(true)
    try {
      if (isEdit && resolvedId) {
        await onUpdate(resolvedId, payload)
        onSuccess?.()
        return
      }

      const result = await onCreate(payload)
      onSuccess?.({
        inviteEmailSent: Boolean(result?.inviteEmailSent),
        inviteEmailError: result?.inviteEmailError ?? null,
      })
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível guardar.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingDetail) {
    return (
      <p className="staff-user-registo__loading" role="status">
        A carregar…
      </p>
    )
  }

  return (
    <div className="staff-user-registo">
      <form className="staff-user-registo__form" onSubmit={handleSubmit} noValidate>
        <div className="staff-user-registo__card">
          <div className="staff-user-registo__scroll">
            <h1 className="staff-user-registo__title">{isEdit ? `Editar ${title}` : `Novo ${title}`}</h1>

            {formError ? (
              <p className="staff-user-registo__error" role="alert">
                {formError}
              </p>
            ) : null}

            {formNotice && !isEdit ? (
              <p className="staff-user-registo__notice" role="status">
                {formNotice}
              </p>
            ) : null}

            {!isEdit ? (
              <p className="staff-user-registo__hint">
                Após criar a conta, é enviado um email para o utilizador definir a palavra-passe.
              </p>
            ) : null}

            <label className="staff-user-registo__field">
              <span className="staff-user-registo__label">Nome de utilizador</span>
              <input
                type="text"
                className="staff-user-registo__input"
                value={form.username}
                onChange={(e) => updateField('username', e.target.value)}
                autoComplete="username"
                required
              />
            </label>

            <label className="staff-user-registo__field">
              <span className="staff-user-registo__label">E-mail</span>
              <input
                type="email"
                className="staff-user-registo__input"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                autoComplete="email"
                required
              />
            </label>

            {isEdit ? (
              <div className="staff-user-registo__invite">
                <p className="staff-user-registo__hint">
                  Para alterar a palavra-passe, envia um email de redefinição ao utilizador.
                </p>
                <button
                  type="button"
                  className="staff-user-registo__btn staff-user-registo__btn--ghost staff-user-registo__btn--invite"
                  onClick={handleSendPasswordEmail}
                  disabled={submitting || sendingInvite}
                >
                  {sendingInvite ? 'A enviar…' : 'Enviar email de palavra-passe'}
                </button>
                {inviteError || inviteNotice ? (
                  <div className="staff-user-registo__invite-feedback">
                    {inviteError ? (
                      <p className="staff-user-registo__error" role="alert">
                        {inviteError}
                      </p>
                    ) : null}
                    {inviteNotice ? (
                      <p className="staff-user-registo__notice" role="status">
                        {inviteNotice}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="staff-user-registo__actions">
            <button
              type="button"
              className="staff-user-registo__btn staff-user-registo__btn--ghost"
              onClick={handleDiscard}
              disabled={submitting || sendingInvite}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="staff-user-registo__btn staff-user-registo__btn--primary"
              disabled={submitting || sendingInvite}
            >
              {submitting ? 'A guardar…' : isEdit ? 'Guardar' : 'Criar'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
