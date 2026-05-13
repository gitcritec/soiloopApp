import { faPen } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import './CollectionCard.css'
import { IconTrash, IconLocationPin, IconBarcodeScan, IconCalendarSmall } from '../icons/icons.jsx'

const STATUS_LABEL = {
  hoje: 'Hoje',
  amanha: 'Amanhã',
  agendada: 'Agendada',
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

  return (
    <article className={`collection-card collection-card--status-${status}`}>
      <div className="collection-card__bin">
        <IconTrash className="collection-card__bin-icon" aria-hidden="true" />
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
        {primaryAction === 'edit' ? (
          <button
            type="button"
            className="collection-card__btn collection-card__btn--edit"
            aria-label="Editar pedido"
            onClick={onEditClick}
          >
            <FontAwesomeIcon icon={faPen} className="collection-card__btn-fa" />
          </button>
        ) : (
          <button
            type="button"
            className="collection-card__btn collection-card__btn--location"
            aria-label="Ver localização"
            onClick={onLocationClick}
          >
            <IconLocationPin className="collection-card__btn-icon" />
          </button>
        )}
        <button
          type="button"
          className="collection-card__btn collection-card__btn--scan"
          aria-label="Digitalizar"
          onClick={onScanClick}
        >
          <IconBarcodeScan className="collection-card__btn-icon" />
        </button>
      </div>
    </article>
  )
}
