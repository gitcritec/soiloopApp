import { faBarcodeRead, faPen } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconContentor } from '../icons/icons.jsx'
import './ContentorCard.css'

/**
 * Cartão de contentor — layout Figma Contentores (16:793).
 */
export default function ContentorCard({
  cid,
  litros,
  localizacao,
  cliente,
  estado,
  estadoLabel,
  secondaryBadge,
  onEditClick,
  onScanClick,
}) {
  const estadoKey = estado ?? 'default'
  const badgePrimary = estadoLabel?.trim() || '—'
  const badgeSecondary = secondaryBadge?.trim()
  const litrosText = litros != null ? `${litros}L` : '—'
  const cidSpec = cid?.trim() || '—'
  const locationText = localizacao?.trim() || '—'
  const clientText = cliente?.trim() ? cliente.trim() : '—'

  return (
    <article className={`contentor-card contentor-card--estado-${estadoKey}`}>
      <div className="contentor-card__icon-col">
        <IconContentor className="contentor-card__icon" aria-hidden />
      </div>

      <div className="contentor-card__main">
        <p className="contentor-card__cid">{cid}</p>
        <p className="contentor-card__specs">
          <span className="contentor-card__qrcode">{cidSpec}</span>{' '}
          <strong className="contentor-card__litros">{litrosText}</strong>
        </p>
        <p className="contentor-card__field">
          <span className="contentor-card__field-label">Localização</span>
          <span className="contentor-card__field-value">{locationText}</span>
        </p>
        <p className="contentor-card__field">
          <span className="contentor-card__field-label">Cliente</span>
          <span className="contentor-card__field-value">{clientText}</span>
        </p>
        <div className="contentor-card__badges">
          <span className={`contentor-card__badge contentor-card__badge--${estadoKey}`}>
            {badgePrimary}
          </span>
          {badgeSecondary ? (
            <span className="contentor-card__badge contentor-card__badge--secondary">
              {badgeSecondary}
            </span>
          ) : null}
        </div>
      </div>

      <div className="contentor-card__actions">
        <button
          type="button"
          className="contentor-card__btn contentor-card__btn--edit"
          aria-label="Editar contentor"
          onClick={onEditClick}
        >
          <FontAwesomeIcon icon={faPen} className="contentor-card__btn-icon" aria-hidden />
        </button>
        <button
          type="button"
          className="contentor-card__btn contentor-card__btn--scan"
          aria-label="Ver QR code"
          onClick={onScanClick}
        >
          <FontAwesomeIcon icon={faBarcodeRead} className="contentor-card__btn-icon" aria-hidden />
        </button>
      </div>
    </article>
  )
}
