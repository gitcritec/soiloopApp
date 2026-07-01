import { useRef, useState } from 'react'
import { faPaperclip, faPaperPlane } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import './TicketComposer.css'

/** Campo de composição no fundo do chat (admin / cliente). */
export default function TicketComposer({
  placeholder = 'Escreva a sua mensagem',
  submitting = false,
  onSubmit,
}) {
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
    if (!trimmed || submitting) return
    onSubmit?.({ text: trimmed, file: attachmentFile })
    setText('')
    setAttachmentFile(null)
    setAttachmentName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <form className="ticket-composer" onSubmit={handleSubmit}>
      <input
        ref={fileInputRef}
        type="file"
        className="ticket-composer__file-input"
        onChange={handleFileChange}
        tabIndex={-1}
        aria-hidden="true"
      />

      <div className="ticket-composer__row">
        <button
          type="button"
          className="ticket-composer__attach"
          onClick={() => fileInputRef.current?.click()}
          disabled={submitting}
          aria-label="Anexar ficheiro"
        >
          <FontAwesomeIcon icon={faPaperclip} aria-hidden />
        </button>

        <label className="visually-hidden" htmlFor="ticket-composer-text">
          Mensagem
        </label>
        <textarea
          id="ticket-composer-text"
          className="ticket-composer__input"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={submitting}
          rows={1}
        />

        <button
          type="submit"
          className="ticket-composer__send"
          disabled={submitting || !text.trim()}
          aria-label="Enviar mensagem"
        >
          <FontAwesomeIcon icon={faPaperPlane} aria-hidden />
        </button>
      </div>

      {attachmentName ? <p className="ticket-composer__file-name">{attachmentName}</p> : null}
    </form>
  )
}
