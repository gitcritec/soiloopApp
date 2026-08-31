import { faLocationDot, faBarcodeRead, faPen } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconCalendarSmall, IconContentor } from '../icons/icons.jsx'
import './OperadorRecolhaCard.css'

const STATUS_LABEL = {
  atrasado: 'Atrasado',
  hoje: 'Hoje',
  amanha: 'Amanhã',
  agendada: 'Agendada',
}

function pickScheduledDate(scheduledAt) {
  const t = (scheduledAt ?? '').trim()
  if (!t) return ''
  const parts = t.split(/\s+/)
  if (parts.length < 2) return t
  return parts.slice(0, -1).join(' ')
}

function normalizeTaskLines(taskLines, collectionId) {
  if (Array.isArray(taskLines) && taskLines.length > 0) return taskLines
  return [
    {
      key: collectionId ?? 'recolher',
      type: 'recolher',
      label: 'Recolha',
      collectionId: collectionId ?? '',
    },
  ]
}

export default function OperadorRecolhaCard({
  collectionId,
  locationDetail,
  status,
  scheduledAt,
  taskLines,
  onLocationClick,
  onEditClick,
  onProcessClick,
  showEdit = true,
}) {
  const statusLabel = STATUS_LABEL[status] ?? status
  const date = pickScheduledDate(scheduledAt)
  const localizacao = (locationDetail ?? '').trim()
  const lines = normalizeTaskLines(taskLines, collectionId)

  return (
    <article className={`operador-recolha-card operador-recolha-card--status-${status}`}>
      <div className="operador-recolha-card__lead">
        <div className="operador-recolha-card__bin">
          <IconContentor className="operador-recolha-card__bin-icon" aria-hidden />
        </div>

        <div className="operador-recolha-card__body">
          <div className="operador-recolha-card__tasks">
            {lines.map((task) => (
              <p key={task.key} className="operador-recolha-card__task-line">
                <span
                  className={`operador-recolha-card__task-type operador-recolha-card__task-type--${task.type}`}
                >
                  {task.label}
                </span>
                {task.collectionId ? (
                  <span className="operador-recolha-card__task-id">{task.collectionId}</span>
                ) : null}
              </p>
            ))}
          </div>
          {localizacao ? (
            <p className="operador-recolha-card__location">
              <span className="operador-recolha-card__location-strong">{localizacao}</span>
            </p>
          ) : null}
          <div className="operador-recolha-card__meta">
            <span className="operador-recolha-card__badge">
              <span className="operador-recolha-card__badge-text">{statusLabel}</span>
              <IconCalendarSmall className="operador-recolha-card__badge-icon" aria-hidden />
            </span>
            {date ? <span className="operador-recolha-card__date">{date}</span> : null}
          </div>
        </div>
      </div>

      <div className="operador-recolha-card__actions">
        <button
          type="button"
          className="operador-recolha-card__btn operador-recolha-card__btn--location"
          aria-label="Ver localização"
          onClick={onLocationClick}
        >
          <FontAwesomeIcon icon={faLocationDot} className="operador-recolha-card__btn-icon" aria-hidden />
        </button>
        {showEdit && onEditClick ? (
          <button
            type="button"
            className="operador-recolha-card__btn operador-recolha-card__btn--edit"
            aria-label="Alterar data"
            onClick={onEditClick}
          >
            <FontAwesomeIcon icon={faPen} className="operador-recolha-card__btn-icon" aria-hidden />
          </button>
        ) : null}
        <button
          type="button"
          className="operador-recolha-card__btn operador-recolha-card__btn--process"
          aria-label="Ler código QR"
          onClick={onProcessClick}
        >
          <FontAwesomeIcon icon={faBarcodeRead} className="operador-recolha-card__btn-icon" aria-hidden />
        </button>
      </div>
    </article>
  )
}
