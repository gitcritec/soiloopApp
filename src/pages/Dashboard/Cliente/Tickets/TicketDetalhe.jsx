import { faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import TicketChat from '../../../../components/TicketChat/TicketChat.jsx'
import TicketComposer from '../../../../components/TicketComposer/TicketComposer.jsx'
import { TICKET_STATUS_LABEL } from '../../../../lib/ticketStatus.js'
import './Tickets.css'

/** Detalhe do ticket (cliente) — chat + mensagem inline. */
export default function TicketDetalhe({
  ticket,
  error,
  submitting = false,
  onBack,
  onSubmit,
}) {
  const canMessage = ticket.status !== 'fechado'

  return (
    <div className="cliente-ticket-view">
      {error ? (
        <p className="cliente-ticket-view__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="cliente-ticket-view__card cliente-ticket-view__card--chat">
        <header className="cliente-ticket-view__chat-head">
          <div className="cliente-ticket-view__head">
            <h1 className="cliente-ticket-view__ref">#{ticket.ref}</h1>
            <div className="cliente-ticket-view__head-actions">
              <span
                className={`cliente-ticket-card__badge cliente-ticket-card__badge--${ticket.status}`}
              >
                {TICKET_STATUS_LABEL[ticket.status]}
              </span>
              <button
                type="button"
                className="cliente-ticket-view__close"
                aria-label="Fechar"
                onClick={onBack}
              >
                <FontAwesomeIcon icon={faXmark} aria-hidden />
              </button>
            </div>
          </div>
          <p className="cliente-ticket-view__chat-subject">{ticket.title}</p>
          <p className="cliente-ticket-view__chat-meta">
            {ticket.location} · {ticket.date} {ticket.time}
          </p>
        </header>

        <TicketChat ticket={ticket} variant="cliente" />

        {canMessage ? (
          <TicketComposer
            placeholder="Escreva a sua mensagem"
            submitting={submitting}
            onSubmit={onSubmit}
          />
        ) : null}
      </div>
    </div>
  )
}
