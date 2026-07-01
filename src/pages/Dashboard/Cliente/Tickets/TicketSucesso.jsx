import { faCircleCheck } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { formatTicketDisplayRef } from '../../../../lib/ticketStatus.js'
import './Tickets.css'

/** Confirmação após criar ticket. */
export default function TicketSucesso({ ticketRef, ticketTitle, onViewDetail, onBackToList }) {
  const displayRef = formatTicketDisplayRef(ticketRef)
  const subject = ticketTitle?.trim()

  return (
    <div className="cliente-ticket-sucesso">
      <div className="cliente-ticket-sucesso__card">
        <div className="cliente-ticket-sucesso__body">
          <div className="cliente-ticket-sucesso__icon" aria-hidden>
            <FontAwesomeIcon icon={faCircleCheck} className="cliente-ticket-sucesso__icon-svg" />
          </div>

          <h1 className="cliente-ticket-sucesso__title">Ticket criado</h1>

          <p className="cliente-ticket-sucesso__text">
            {displayRef ? (
              <>
                O seu pedido{' '}
                <strong className="cliente-ticket-sucesso__ref">#{displayRef}</strong> foi registado.
              </>
            ) : (
              <>O seu pedido foi registado com sucesso.</>
            )}{' '}
            A equipa Soiloop irá responder em breve.
          </p>

          {subject ? <p className="cliente-ticket-sucesso__subject">{subject}</p> : null}
        </div>

        <div className="cliente-ticket-sucesso__actions">
          <button type="button" className="cliente-ticket-sucesso__btn" onClick={onViewDetail}>
            Ver ticket
          </button>
          <button type="button" className="cliente-ticket-sucesso__back" onClick={onBackToList}>
            Voltar à lista
          </button>
        </div>
      </div>
    </div>
  )
}
