import { useRef, useState } from 'react'
import { faArrowLeft, faPaperclip } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import './Tickets.css'

/** Nova mensagem num ticket existente (cliente). */
export default function TicketMensagem({ ticket, submitting, error, onBack, onSubmit }) {
  const [text, setText] = useState('')
  const [attachmentFile, setAttachmentFile] = useState(null)
  const [attachmentName, setAttachmentName] = useState('')
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
    <div className="cliente-ticket-form">
      <button type="button" className="cliente-ticket-view__back" onClick={onBack}>
        <FontAwesomeIcon icon={faArrowLeft} className="cliente-ticket-view__back-icon" aria-hidden />
        Voltar ao ticket
      </button>

      {error ? (
        <p className="cliente-ticket-view__error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="cliente-ticket-form__card">
        <div className="cliente-ticket-form__scroll">
          <h1 className="cliente-ticket-form__title">#{ticket.ref}</h1>

          <dl className="cliente-ticket-view__meta">
            <div className="cliente-ticket-view__meta-row">
              <dt>Assunto:</dt>
              <dd>{ticket.title}</dd>
            </div>
          </dl>

          <form className="cliente-ticket-form__field" onSubmit={handleSubmit}>
            <label className="cliente-ticket-form__label" htmlFor="cliente-ticket-msg">
              Mensagem
            </label>
            <textarea
              id="cliente-ticket-msg"
              className="cliente-ticket-form__textarea"
              placeholder="Escreva a sua mensagem"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={submitting}
            />

            <input
              ref={fileInputRef}
              type="file"
              className="cliente-ticket-form__file-input"
              onChange={handleFileChange}
              tabIndex={-1}
              aria-hidden="true"
            />
            <button
              type="button"
              className="cliente-ticket-form__attach"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
            >
              <FontAwesomeIcon icon={faPaperclip} className="cliente-ticket-form__attach-icon" aria-hidden />
              Anexar Ficheiro
            </button>
            {attachmentName ? <p className="cliente-ticket-form__file-name">{attachmentName}</p> : null}
          </form>
        </div>

        <div className="cliente-ticket-form__actions">
          <button
            type="button"
            className="cliente-ticket-form__submit"
            disabled={submitting || !text.trim()}
            onClick={handleSubmit}
          >
            {submitting ? 'A enviar…' : 'Confirmar Registo'}
          </button>
          <button
            type="button"
            className="cliente-ticket-form__discard"
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
