import { faPen, faRecycle, faTrashCan } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import './CollectionCard.css'
import { IconCalendarSmall } from '../icons/icons.jsx'
import { formatPeriodoLabel } from '../../lib/movimentoPeriodo.js'

const STATUS_LABEL = {
  atrasado: 'Atrasado',
  hoje: 'Hoje',
  amanha: 'Amanhã',
  agendada: 'Agendada',
  finalizado: 'Finalizado',
}

const TASK_TYPE_LABEL = {
  recolher: 'Recolher',
  entregar: 'Entregar',
  trocar: 'Trocar',
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
  /** @type {'recolher' | 'entregar' | 'trocar'} */
  taskType = 'recolher',
  onLocationClick,
  onEditClick,
  onDeleteClick,
  showEdit = true,
  showDelete = true,
  hideTaskType = false,
  showFullDateTime = false,
  showScheduledTime = false,
  badgeLabel,
  requestState,
}) {
  const statusLabel = badgeLabel ?? STATUS_LABEL[status] ?? status
  const taskTypeLabel = TASK_TYPE_LABEL[taskType] ?? taskType
  const { date: datePart, time: timePart } = splitScheduledAt(scheduledAt)
  const periodLabel = formatPeriodoLabel(timePart)
  const historicoDateLabel = showFullDateTime ? (scheduledAt ?? '').trim() : ''

  const hasSplitLocation = Boolean(locationPrefix && locationDetail)
  const stateClass = requestState ? ` collection-card--request-${requestState}` : ''
  const hasEditAction = showEdit && Boolean(onEditClick || onLocationClick)
  const hasDeleteAction = showDelete && Boolean(onDeleteClick)
  const hasActions = hasEditAction || hasDeleteAction

  return (
    <article
      className={`collection-card collection-card--status-${status}${stateClass}${hasActions ? '' : ' collection-card--no-actions'}`}
    >
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
          {hideTaskType || !taskType ? null : (
            <span
              className={`collection-card__task-type collection-card__task-type--${taskType}`}
            >
              {taskTypeLabel}
            </span>
          )}
          {showFullDateTime ? (
            historicoDateLabel ? (
              <span className="collection-card__date">{historicoDateLabel}</span>
            ) : null
          ) : (
            <>
              {datePart ? <span className="collection-card__date">{datePart}</span> : null}
              {showScheduledTime && timePart ? (
                <span className="collection-card__time">{timePart}</span>
              ) : periodLabel ? (
                <span className="collection-card__period">Periodo: {periodLabel}</span>
              ) : null}
            </>
          )}
        </div>
      </div>

      {hasActions ? (
        <div className="collection-card__actions">
          {hasEditAction ? (
            <button
              type="button"
              className="collection-card__btn collection-card__btn--edit"
              aria-label="Editar"
              onClick={onEditClick ?? onLocationClick}
            >
              <FontAwesomeIcon icon={faPen} className="collection-card__btn-icon" aria-hidden />
            </button>
          ) : null}
          {hasDeleteAction ? (
            <button
              type="button"
              className="collection-card__btn collection-card__btn--delete"
              aria-label="Apagar"
              onClick={onDeleteClick}
            >
              <FontAwesomeIcon icon={faTrashCan} className="collection-card__btn-icon" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
