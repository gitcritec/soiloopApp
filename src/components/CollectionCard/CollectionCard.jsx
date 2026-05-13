import { faBarcodeRead, faPen } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import './CollectionCard.css'
import { faLocationDot as faLocationDotSharp } from '@fortawesome/sharp-light-svg-icons'
import containerGreen from '../../assets/container-green.svg'
import containerRed from '../../assets/container-red.svg'
import containerYellow from '../../assets/container-yellow.svg'
import { IconCalendarSmall } from '../icons/icons.jsx'

const STATUS_LABEL = {
  hoje: 'Hoje',
  amanha: 'Amanhã',
  agendada: 'Agendada',
}

const STATUS_BIN_ART = {
  hoje: containerRed,
  amanha: containerYellow,
  agendada: containerGreen,
}

function splitScheduledAt(scheduledAt) {
  const t = (scheduledAt ?? '').trim()
  if (!t) return { date: '', time: '' }
  const parts = t.split(/\s+/)
  if (parts.length < 2) return { date: t, time: '' }
  const time = parts[parts.length - 1]
  const date = parts.slice(0, -1).join(' ')
  return { date, time }
}

export default function CollectionCard({
  collectionId,
  location,
  locationPrefix,
  locationDetail,
  status,
  scheduledAt,
  binNumber,
  onLocationClick,
  onScanClick,
  /** @type {'location' | 'edit'} */
  primaryAction = 'location',
  onEditClick,
}) {
  const statusLabel = STATUS_LABEL[status] ?? status
  const { date: datePart, time: timePart } = splitScheduledAt(scheduledAt)

  const hasSplitLocation = Boolean(locationPrefix && locationDetail)
  const binArtSrc = STATUS_BIN_ART[status] ?? containerGreen

  return (
    <article className={`collection-card collection-card--status-${status}`}>
      <div className="collection-card__bin">
        <img src={binArtSrc} alt="" className="collection-card__bin-icon" width={20} height={24} />
        <span className="collection-card__bin-number">{binNumber}</span>
      </div>

      <div className="collection-card__body">
        <p className="collection-card__id">{collectionId}</p>
        {hasSplitLocation ? (
          <p className="collection-card__location collection-card__location--split">
            <span className="collection-card__location-muted">{locationPrefix}</span>
            <span className="collection-card__location-strong">{locationDetail}</span>
          </p>
        ) : (
          <p className="collection-card__location">{location}</p>
        )}
        <div className={`collection-card__meta collection-card__meta--status-${status}`}>
          <span className="collection-card__badge">
            <span className="collection-card__badge-text">{statusLabel}</span>
            <IconCalendarSmall className="collection-card__badge-icon" aria-hidden="true" />
          </span>
          {datePart ? <span className="collection-card__date">{datePart}</span> : null}
          {timePart ? <span className="collection-card__time">{timePart}</span> : null}
        </div>
      </div>

      <div className="collection-card__actions">
        <button
          type="button"
          className="collection-card__btn collection-card__btn--location"
          aria-label="Ver localização"
          onClick={onLocationClick}
        >
          <FontAwesomeIcon icon={faLocationDotSharp} className="collection-card__btn-icon" aria-hidden />
        </button>
        <button
          type="button"
          className="collection-card__btn collection-card__btn--scan"
          aria-label="Digitalizar"
          onClick={onScanClick}
        >
          <FontAwesomeIcon icon={faBarcodeRead} className="collection-card__btn-icon" aria-hidden />
        </button>
      </div>
    </article>
  )
}
