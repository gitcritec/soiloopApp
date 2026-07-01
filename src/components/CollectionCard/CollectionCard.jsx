import { faPen, faRecycle, faTrashCan } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import './CollectionCard.css'
import { IconCalendarSmall } from '../icons/icons.jsx'

const STATUS_LABEL = {
  atrasado: 'Atrasado',
  hoje: 'Hoje',
  amanha: 'Amanhã',
  agendada: 'Agendada',
}

const TASK_TYPE_LABEL = {
  recolher: 'Recolher',
  entregar: 'Entregar',
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

function formatPeriod(period) {
  const value = (period ?? '').trim()
  if (!value) return ''
  const normalized = value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (normalized === 'manha') return 'manhã'
  if (normalized === 'tarde') return 'tarde'
  return value
}

export default function CollectionCard({
  collectionId,
  location,
  locationPrefix,
  locationDetail,
  status,
  scheduledAt,
  binNumber,
  /** @type {'recolher' | 'entregar'} */
  taskType = 'recolher',
  onLocationClick,
  onEditClick,
  onDeleteClick,
  requestState,
}) {
  const statusLabel = STATUS_LABEL[status] ?? status
  const taskTypeLabel = TASK_TYPE_LABEL[taskType] ?? taskType
  const { date: datePart, time: timePart } = splitScheduledAt(scheduledAt)
  const periodLabel = formatPeriod(timePart)

  const hasSplitLocation = Boolean(locationPrefix && locationDetail)
  const stateClass = requestState ? ` collection-card--request-${requestState}` : ''

  return (
    <article className={`collection-card collection-card--status-${status}${stateClass}`}>
      <div className="collection-card__bin">
        <FontAwesomeIcon icon={faRecycle} className="collection-card__bin-icon" aria-hidden />
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
          {taskType ? (
            <span
              className={`collection-card__task-type collection-card__task-type--${taskType}`}
            >
              {taskTypeLabel}
            </span>
          ) : null}
          {datePart ? <span className="collection-card__date">{datePart}</span> : null}
          {periodLabel ? (
            <span className="collection-card__period">Periodo: {periodLabel}</span>
          ) : null}
        </div>
      </div>

      <div className="collection-card__actions">
        <button
          type="button"
          className="collection-card__btn collection-card__btn--edit"
          aria-label="Editar"
          onClick={onEditClick ?? onLocationClick}
        >
          <FontAwesomeIcon icon={faPen} className="collection-card__btn-icon" aria-hidden />
        </button>
        <button
          type="button"
          className="collection-card__btn collection-card__btn--delete"
          aria-label="Apagar"
          onClick={onDeleteClick}
        >
          <FontAwesomeIcon icon={faTrashCan} className="collection-card__btn-icon" aria-hidden />
        </button>
      </div>
    </article>
  )
}
