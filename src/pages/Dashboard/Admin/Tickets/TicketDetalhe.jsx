import { faArrowLeft } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import TicketChat from '../../../../components/TicketChat/TicketChat.jsx'
import TicketComposer from '../../../../components/TicketComposer/TicketComposer.jsx'
import { TICKET_STATUS_LABEL } from '../../../../lib/ticketStatus.js'
import './Tickets.css'

/** Detalhe do ticket (admin) — chat + resposta inline. */
export default function TicketDetalhe({
  ticket,
  error,
  submitting = false,
  onBack,
  onSubmit,
  onClose,
}) {
  const canReply = ticket.status !== 'fechado'
  const canClose = ticket.status !== 'fechado'

  return (
    <div className="admin-ticket-view">
      <button type="button" className="admin-ticket-view__back" onClick={onBack}>
        <FontAwesomeIcon icon={faArrowLeft} className="admin-ticket-view__back-icon" aria-hidden />
        Voltar à lista
      </button>

      {error ? (
        <p className="admin-ticket-view__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="admin-ticket-view__card admin-ticket-view__card--chat">
        <header className="admin-ticket-view__chat-head">
          <div className="admin-ticket-view__head">
            <h1 className="admin-ticket-view__ref">#{ticket.ref}</h1>
            <span
              className={`admin-ticket-card__badge admin-ticket-card__badge--${ticket.status}`}
            >
              {TICKET_STATUS_LABEL[ticket.status]}
            </span>
          </div>
          <p className="admin-ticket-view__chat-subject">{ticket.title}</p>
          <p className="admin-ticket-view__chat-meta">
            {ticket.clientName} · {ticket.location} · {ticket.date} {ticket.time}
          </p>
        </header>

        <TicketChat ticket={ticket} variant="admin" clientLabel={ticket.clientName} />

        {canReply ? (
          <TicketComposer
            placeholder="Escreva a resposta"
            submitting={submitting}
            onSubmit={onSubmit}
          />
        ) : null}

        {canClose ? (
          <div className="admin-ticket-view__actions admin-ticket-view__actions--chat">
            <button type="button" className="admin-ticket-view__secondary" onClick={onClose}>
              Fechar ticket
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
