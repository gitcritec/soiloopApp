import { useEffect, useMemo, useState } from 'react'
import { faChevronLeft, faChevronRight } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { fetchStrapiAdminCalendarioRecolhas } from '../../lib/strapiMovimentos.js'
import './AdminRecolhasCalendario.css'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const KIND_LABEL = {
  agendado: 'Agendado',
  'em-transito': 'Em trânsito',
  historico: 'Histórico',
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1)
}

function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatMonthTitle(date) {
  const raw = date.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function buildMonthCells(monthDate) {
  const first = startOfMonth(monthDate)
  const year = first.getFullYear()
  const month = first.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // Segunda = 0 … Domingo = 6
  const startWeekday = (first.getDay() + 6) % 7

  /** @type {Array<{ iso: string|null, day: number|null, inMonth: boolean }>} */
  const cells = []
  for (let i = 0; i < startWeekday; i += 1) {
    cells.push({ iso: null, day: null, inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day)
    cells.push({ iso: toIsoDate(date), day, inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ iso: null, day: null, inMonth: false })
  }
  return cells
}

function eventLabel(item) {
  const client = item.clientName || item.clienteLabel || ''
  const cid = item.id && item.id !== 'Não definido' ? item.id : item.contentorId
  const tipo = item.taskType === 'entregar' ? 'Entrega' : 'Recolha'
  if (client && cid) return `${tipo} · ${cid} · ${client}`
  if (cid) return `${tipo} · ${cid}`
  if (client) return `${tipo} · ${client}`
  return tipo
}

/**
 * Calendário mensal de recolhas (admin) — agendado / em trânsito / histórico.
 */
export default function AdminRecolhasCalendario() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [selectedIso, setSelectedIso] = useState(() => toIsoDate(new Date()))

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    fetchStrapiAdminCalendarioRecolhas()
      .then((rows) => {
        if (!cancelled) setEvents(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar o calendário.')
          setEvents([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const cells = useMemo(() => buildMonthCells(month), [month])
  const todayIso = toIsoDate(new Date())

  const eventsByDay = useMemo(() => {
    /** @type {Map<string, object[]>} */
    const map = new Map()
    for (const item of events) {
      const iso = item.dataIso
      if (!iso) continue
      const list = map.get(iso) ?? []
      list.push(item)
      map.set(iso, list)
    }
    return map
  }, [events])

  const selectedEvents = useMemo(
    () => eventsByDay.get(selectedIso) ?? [],
    [eventsByDay, selectedIso],
  )

  const kindsOnSelected = useMemo(() => {
    const set = new Set(selectedEvents.map((item) => item.calendarioKind).filter(Boolean))
    return [...set]
  }, [selectedEvents])

  function goPrev() {
    setMonth((prev) => addMonths(prev, -1))
  }

  function goNext() {
    setMonth((prev) => addMonths(prev, 1))
  }

  function selectDay(iso) {
    if (!iso) return
    setSelectedIso(iso)
  }

  return (
    <section className="admin-recolhas-cal" aria-labelledby="admin-recolhas-cal-title">
      <div className="admin-recolhas-cal__head">
        <h2 id="admin-recolhas-cal-title" className="admin-recolhas-cal__title">
          Calendário de recolhas
        </h2>
        <div className="admin-recolhas-cal__nav">
          <button
            type="button"
            className="admin-recolhas-cal__nav-btn"
            aria-label="Mês anterior"
            onClick={goPrev}
          >
            <FontAwesomeIcon icon={faChevronLeft} aria-hidden />
          </button>
          <p className="admin-recolhas-cal__month">{formatMonthTitle(month)}</p>
          <button
            type="button"
            className="admin-recolhas-cal__nav-btn"
            aria-label="Mês seguinte"
            onClick={goNext}
          >
            <FontAwesomeIcon icon={faChevronRight} aria-hidden />
          </button>
        </div>
      </div>

      <ul className="admin-recolhas-cal__legend" aria-label="Legenda">
        <li>
          <span className="admin-recolhas-cal__dot admin-recolhas-cal__dot--agendado" aria-hidden />
          Agendado
        </li>
        <li>
          <span className="admin-recolhas-cal__dot admin-recolhas-cal__dot--em-transito" aria-hidden />
          Em trânsito
        </li>
        <li>
          <span className="admin-recolhas-cal__dot admin-recolhas-cal__dot--historico" aria-hidden />
          Histórico
        </li>
      </ul>

      {loading ? (
        <p className="admin-recolhas-cal__status" role="status">
          A carregar calendário…
        </p>
      ) : null}

      {!loading && loadError ? (
        <p className="admin-recolhas-cal__status admin-recolhas-cal__status--error" role="alert">
          {loadError}
        </p>
      ) : null}

      <div className="admin-recolhas-cal__weekdays" aria-hidden>
        {WEEKDAYS.map((label) => (
          <span key={label} className="admin-recolhas-cal__weekday">
            {label}
          </span>
        ))}
      </div>

      <div className="admin-recolhas-cal__grid" role="grid" aria-label={formatMonthTitle(month)}>
        {cells.map((cell, index) => {
          if (!cell.inMonth || !cell.iso) {
            return <div key={`empty-${index}`} className="admin-recolhas-cal__cell admin-recolhas-cal__cell--empty" />
          }
          const dayEvents = eventsByDay.get(cell.iso) ?? []
          const kinds = [...new Set(dayEvents.map((item) => item.calendarioKind).filter(Boolean))]
          const isSelected = cell.iso === selectedIso
          const isToday = cell.iso === todayIso
          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              className={[
                'admin-recolhas-cal__cell',
                isSelected ? 'admin-recolhas-cal__cell--selected' : '',
                isToday ? 'admin-recolhas-cal__cell--today' : '',
                dayEvents.length > 0 ? 'admin-recolhas-cal__cell--has-events' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-label={`${cell.day}${kinds.length ? `, ${kinds.map((k) => KIND_LABEL[k]).join(', ')}` : ''}`}
              aria-pressed={isSelected}
              onClick={() => selectDay(cell.iso)}
            >
              <span className="admin-recolhas-cal__day-num">{cell.day}</span>
              {kinds.length > 0 ? (
                <span className="admin-recolhas-cal__dots" aria-hidden>
                  {kinds.slice(0, 3).map((kind) => (
                    <span
                      key={kind}
                      className={`admin-recolhas-cal__dot admin-recolhas-cal__dot--${kind}`}
                    />
                  ))}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="admin-recolhas-cal__day-panel" aria-live="polite">
        <p className="admin-recolhas-cal__day-title">
          {selectedIso
            ? new Date(`${selectedIso}T12:00:00`).toLocaleDateString('pt-PT', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })
            : '—'}
        </p>
        {!loading && selectedEvents.length === 0 ? (
          <p className="admin-recolhas-cal__status admin-recolhas-cal__status--muted">
            Sem recolhas neste dia.
          </p>
        ) : null}
        {selectedEvents.length > 0 ? (
          <ul className="admin-recolhas-cal__event-list">
            {selectedEvents.map((item) => (
              <li
                key={
                  item.movimentoKey ??
                  `${item.id}-${item.taskType}-${item.dataIso}-${item.calendarioKind}`
                }
                className={`admin-recolhas-cal__event admin-recolhas-cal__event--${item.calendarioKind}`}
              >
                <span
                  className={`admin-recolhas-cal__event-badge admin-recolhas-cal__event-badge--${item.calendarioKind}`}
                >
                  {KIND_LABEL[item.calendarioKind] ?? item.calendarioKind}
                </span>
                <span className="admin-recolhas-cal__event-text">{eventLabel(item)}</span>
                {item.periodoLabel || item.periodo ? (
                  <span className="admin-recolhas-cal__event-periodo">
                    {item.periodoLabel || item.periodo}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {kindsOnSelected.length > 0 ? (
          <p className="admin-recolhas-cal__day-kinds sr-only">
            {kindsOnSelected.map((k) => KIND_LABEL[k]).join(', ')}
          </p>
        ) : null}
      </div>
    </section>
  )
}
