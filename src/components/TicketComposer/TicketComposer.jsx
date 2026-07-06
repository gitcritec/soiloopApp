import { useRef, useState } from 'react'
import { faPaperclip, faPaperPlane } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import './TicketComposer.css'

/**
 * Campo de composição no fundo do chat (admin / cliente) ou embutido em formulários.
 * @param {object} props
 * @param {string} [props.placeholder]
 * @param {boolean} [props.submitting]
 * @param {(payload: { text: string, file: File|null }) => void} [props.onSubmit]
 * @param {string} [props.value] — modo controlado (formulário)
 * @param {(value: string) => void} [props.onChange]
 * @param {(file: File|null) => void} [props.onAttachmentChange]
 * @param {string} [props.attachmentName]
 * @param {boolean} [props.showSend]
 * @param {boolean} [props.embedded] — dentro de outro form (renderiza div)
 * @param {string} [props.className]
 * @param {string} [props.inputId]
 */
export default function TicketComposer({
  placeholder = 'Escreva a sua mensagem',
  submitting = false,
  onSubmit,
  value,
  onChange,
  onAttachmentChange,
  attachmentName: attachmentNameProp,
  showSend = true,
  embedded = false,
  className = '',
  inputId = 'ticket-composer-text',
}) {
  const isControlled = value !== undefined
  const [internalText, setInternalText] = useState('')
  const [internalAttachmentName, setInternalAttachmentName] = useState('')
  const fileInputRef = useRef(null)

  const text = isControlled ? value : internalText
  const attachmentName = attachmentNameProp ?? internalAttachmentName

  function setText(next) {
    if (isControlled) onChange?.(next)
    else setInternalText(next)
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0] ?? null
    if (onAttachmentChange) {
      onAttachmentChange(file)
    } else {
      setInternalAttachmentName(file ? file.name : '')
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || submitting) return
    onSubmit?.({ text: trimmed, file: fileInputRef.current?.files?.[0] ?? null })
    if (!isControlled) {
      setInternalText('')
      setInternalAttachmentName('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const rootClassName = [
    'ticket-composer',
    embedded ? 'ticket-composer--embedded' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const Root = embedded ? 'div' : 'form'

  return (
    <Root className={rootClassName} onSubmit={embedded ? undefined : handleSubmit}>
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

        <label className="visually-hidden" htmlFor={inputId}>
          Mensagem
        </label>
        <textarea
          id={inputId}
          className="ticket-composer__input"
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={submitting}
          rows={1}
          required={embedded}
        />

        {showSend ? (
          <button
            type="submit"
            className="ticket-composer__send"
            disabled={submitting || !text.trim()}
            aria-label="Enviar mensagem"
          >
            <FontAwesomeIcon icon={faPaperPlane} aria-hidden />
          </button>
        ) : null}
      </div>

      {attachmentName ? <p className="ticket-composer__file-name">{attachmentName}</p> : null}
    </Root>
  )
}
