import { faBarcodeRead, faEye } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconContentor } from '../icons/icons.jsx'
import { contentorCardBadges, formatContentorQrLabel } from './contentorBadge.js'
import './ContentorCard.css'

/**
 * Cartão de contentor — Figma SOLO-URBANO App_v3 (494:7592 / 39:829).
 */
export default function ContentorCard({
  cid,
  litros,
  localizacao,
  cliente,
  estado,
  estadoLabel,
  situacao,
  situacaoLabel,
  onViewClick,
  onScanClick,
  onEditClick,
}) {
  const cidText = cid?.trim() || '—'
  const qrLabel = formatContentorQrLabel(cid)
  const litrosText = litros != null ? `${litros}L` : '—'
  const localizacaoText =
    localizacao?.trim() && localizacao !== '—' ? localizacao.trim() : '—'
  const clienteText = cliente?.trim() ? cliente.trim() : '—'
  const badges = contentorCardBadges(situacaoLabel, estadoLabel, situacao, estado)

  return (
    <article className="contentor-card">
      <div className="contentor-card__lead">
        <div className="contentor-card__icon-col">
          <IconContentor className="contentor-card__icon-svg" aria-hidden />
        </div>

        <div className="contentor-card__text">
          <button
            type="button"
            className="contentor-card__cid"
            onClick={onEditClick}
            aria-label={`Editar contentor ${cidText}`}
          >
            {cidText}
          </button>

          <div className="contentor-card__details">
            <p className="contentor-card__specs">
              <span className="contentor-card__qrcode">{qrLabel}</span>
              <span className="contentor-card__litros">{litrosText}</span>
            </p>
            <div className="contentor-card__meta">
              <p className="contentor-card__meta-line contentor-card__meta-line--loc">{localizacaoText}</p>
              <p className="contentor-card__meta-line contentor-card__meta-line--cli">{clienteText}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="contentor-card__badges-col">
        <span className={`contentor-card__badge contentor-card__badge--${badges.topVariant}`}>
          {badges.topText}
        </span>
        <span className={`contentor-card__badge contentor-card__badge--${badges.bottomVariant}`}>
          {badges.bottomText}
        </span>
      </div>

      <div className="contentor-card__actions">
        <button
          type="button"
          className="contentor-card__btn contentor-card__btn--view"
          aria-label="Ver mais"
          onClick={onViewClick}
        >
          <FontAwesomeIcon icon={faEye} className="contentor-card__btn-icon" aria-hidden />
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
