import { faPen } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import './StaffUserCard.css'

/**
 * Cartão de administrador / operador na listagem admin.
 */
export default function StaffUserCard({ nome, email, roleLabel, onEditClick }) {
  const nameText = nome?.trim() || 'Utilizador'
  const emailText = email?.trim() || '—'
  const roleText = roleLabel?.trim() || ''

  return (
    <article className="staff-user-card">
      <div className="staff-user-card__main">
        <p className="staff-user-card__nome">{nameText}</p>
        {roleText ? <p className="staff-user-card__role">{roleText}</p> : null}
        <p className="staff-user-card__email">{emailText}</p>
      </div>

      <button
        type="button"
        className="staff-user-card__btn"
        aria-label={`Editar ${nameText}`}
        onClick={onEditClick}
      >
        <FontAwesomeIcon icon={faPen} className="staff-user-card__btn-icon" aria-hidden />
      </button>
    </article>
  )
}
