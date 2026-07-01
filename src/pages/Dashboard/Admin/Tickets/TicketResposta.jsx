import { useRef, useState } from 'react'
import { faArrowLeft, faPaperclip } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import './Tickets.css'

/**
 * Formulário de resposta ao ticket.
 * Sem alteração manual de estado — ao enviar, o ticket passa a «Respondido».
 */
export default function TicketResposta({ ticket, onSubmit, submitting = false, error, onBack }) {
  const [text, setText] = useState('')
  const [attachmentName, setAttachmentName] = useState('')
  const [attachmentFile, setAttachmentFile] = useState(null)
  const fileInputRef = useRef(null)

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    setAttachmentFile(file ?? null)
    setAttachmentName(file ? file.name : '')
  }

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit?.({ text: trimmed, file: attachmentFile })
  }

  return (
    <div className="admin-ticket-view">
      <button type="button" className="admin-ticket-view__back" onClick={onBack}>
        <FontAwesomeIcon icon={faArrowLeft} className="admin-ticket-view__back-icon" aria-hidden />
        Voltar ao ticket
      </button>

      {error ? (
        <p className="admin-ticket-view__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="admin-ticket-view__card">
        <div className="admin-ticket-view__scroll">
          <div className="admin-ticket-view__head">
            <h1 className="admin-ticket-view__ref">#{ticket.ref}</h1>
          </div>

          <dl className="admin-ticket-view__meta">
            <div className="admin-ticket-view__meta-row">
              <dt>Cliente:</dt>
              <dd>{ticket.clientName}</dd>
            </div>
            <div className="admin-ticket-view__meta-row">
              <dt>Localização:</dt>
              <dd>{ticket.location}</dd>
            </div>
            <div className="admin-ticket-view__meta-row">
              <dt>Assunto:</dt>
              <dd>{ticket.title}</dd>
            </div>
          </dl>

          <form className="admin-ticket-view__form" onSubmit={handleSubmit}>
            <label className="visually-hidden" htmlFor="ticket-resposta-texto">
              Resposta
            </label>
            <textarea
              id="ticket-resposta-texto"
              className="admin-ticket-view__textarea"
              placeholder="Resposta"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={submitting}
            />

            <input
              ref={fileInputRef}
              type="file"
              className="admin-ticket-view__file-input"
              onChange={handleFileChange}
              tabIndex={-1}
              aria-hidden="true"
            />
            <button
              type="button"
              className="admin-ticket-view__attach"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
            >
              <FontAwesomeIcon icon={faPaperclip} className="admin-ticket-view__attach-icon" aria-hidden />
              Anexar Ficheiro
            </button>
            {attachmentName ? (
              <p className="admin-ticket-view__file-name">{attachmentName}</p>
            ) : null}
          </form>
        </div>

        <div className="admin-ticket-view__actions">
          <button
            type="button"
            className="admin-ticket-view__submit"
            disabled={submitting || !text.trim()}
            onClick={handleSubmit}
          >
            {submitting ? 'A enviar…' : 'Confirmar Registo'}
          </button>
          <button
            type="button"
            className="admin-ticket-view__discard"
            disabled={submitting}
            onClick={onBack}
          >
            Descartar Alterações
          </button>
        </div>
      </div>
    </div>
  )
}
