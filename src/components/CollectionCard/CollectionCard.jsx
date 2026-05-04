import './CollectionCard.css'
import { IconTrash, IconLocationPin, IconBarcodeScan, IconCalendarSmall } from '../icons/icons.jsx'

const STATUS_LABEL = {
  hoje: 'Hoje',
  amanha: 'Amanhã',
  agendada: 'Agendada',
}

export default function CollectionCard({
  collectionId,
  location,
  status,
  scheduledAt,
  binNumber,
  onLocationClick,
  onScanClick,
}) {
  const statusLabel = STATUS_LABEL[status] ?? status

  return (
    <article className={`collection-card collection-card--status-${status}`}>
      <div className="collection-card__bin">
        <IconTrash className="collection-card__bin-icon" aria-hidden="true" />
        <span className="collection-card__bin-number">{binNumber}</span>
      </div>

      <div className="collection-card__body">
        <p className="collection-card__id">{collectionId}</p>
        <p className="collection-card__location">{location}</p>
        <div className="collection-card__meta">
          <span className="collection-card__badge">
            <IconCalendarSmall className="collection-card__badge-icon" aria-hidden="true" />
            {statusLabel}
          </span>
          <span className="collection-card__datetime">{scheduledAt}</span>
        </div>
      </div>

      <div className="collection-card__actions">
        <button
          type="button"
          className="collection-card__btn collection-card__btn--location"
          aria-label="Ver localização"
          onClick={onLocationClick}
        >
          <IconLocationPin className="collection-card__btn-icon" />
        </button>
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
