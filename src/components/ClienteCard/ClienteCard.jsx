import { faEye, faPen } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconContentor } from '../icons/icons.jsx'
import './ClienteCard.css'

/**
 * Cartão de cliente na listagem admin (Figma Clientes).
 */
export default function ClienteCard({
  nome,
  cliCode,
  telefone,
  contentorCount = '00',
  onDetailsClick,
  onEditClick,
}) {
  const nameText = nome?.trim() || 'Cliente'
  const codeText = cliCode?.trim() || '—'
  const phoneText = telefone?.trim() || '—'
  const countText = contentorCount?.trim() || '00'

  return (
    <article className="cliente-card">
      <div className="cliente-card__lead">
        <div className="cliente-card__icon-col">
          <IconContentor className="cliente-card__icon" aria-hidden />
          <span className="cliente-card__count">{countText}</span>
        </div>

        <div className="cliente-card__main">
          <p className="cliente-card__nome">{nameText}</p>
          <p className="cliente-card__cli">{codeText}</p>
          <p className="cliente-card__telefone">{phoneText}</p>
        </div>
      </div>

      <div className="cliente-card__actions">
        <button
          type="button"
          className="cliente-card__btn cliente-card__btn--details"
          aria-label="Ver detalhes"
          onClick={onDetailsClick}
        >
          <FontAwesomeIcon icon={faEye} className="cliente-card__btn-icon" aria-hidden />
        </button>
        <button
          type="button"
          className="cliente-card__btn cliente-card__btn--edit"
          aria-label="Editar cliente"
          onClick={onEditClick}
        >
          <FontAwesomeIcon icon={faPen} className="cliente-card__btn-icon" aria-hidden />
        </button>
      </div>
    </article>
  )
}
