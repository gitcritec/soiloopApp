import { useEffect, useRef, useState } from 'react'
import { buildTicketChatMessages } from '../../lib/ticketChat.js'
import { attachmentPreviewLabel, guessAttachmentKind } from '../../lib/attachmentPreview.js'
import TicketAttachmentModal from '../TicketAttachmentModal/TicketAttachmentModal.jsx'
import './TicketChat.css'

/**
 * Fio de mensagens estilo telemóvel.
 * @param {'admin'|'cliente'} variant
 */
export default function TicketChat({
  ticket,
  variant = 'admin',
  clientLabel,
  adminLabel,
  selfLabel,
}) {
  const endRef = useRef(null)
  const [preview, setPreview] = useState(null)

  const messages = buildTicketChatMessages(ticket, {
    clientLabel,
    adminLabel,
    selfLabel: variant === 'cliente' ? (selfLabel ?? 'Você') : undefined,
  })

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, ticket?.id])

  function openPreview(msg) {
    if (!msg.attachmentUrl) return
    const kind = guessAttachmentKind(msg.attachmentMime, msg.attachmentName, msg.attachmentUrl)
    setPreview({
      url: msg.attachmentUrl,
      name: msg.attachmentName,
      kind,
    })
  }

  if (messages.length === 0) {
    return (
      <p className="ticket-chat__empty">Ainda não há mensagens neste ticket.</p>
    )
  }

  return (
    <>
      <ul className={`ticket-chat ticket-chat--${variant}`} aria-label="Mensagens do ticket">
        {messages.map((msg) => {
          const isMine = variant === 'admin' ? msg.author === 'admin' : msg.author === 'cliente'
          const attachmentKind = msg.attachmentUrl
            ? guessAttachmentKind(msg.attachmentMime, msg.attachmentName, msg.attachmentUrl)
            : null

          return (
            <li
              key={msg.id}
              className={`ticket-chat__row ticket-chat__row--${isMine ? 'mine' : 'theirs'}`}
            >
              <article
                className={`ticket-chat__bubble ticket-chat__bubble--${msg.author}`}
                aria-label={`${msg.authorLabel}, ${msg.at}`}
              >
                <p className="ticket-chat__text">{msg.text}</p>

                {msg.attachmentUrl ? (
                  <div className="ticket-chat__attachment-wrap">
                    {attachmentKind === 'image' ? (
                      <button
                        type="button"
                        className="ticket-chat__attachment-thumb-btn"
                        onClick={() => openPreview(msg)}
                        aria-label={attachmentPreviewLabel(attachmentKind, msg.attachmentName)}
                      >
                        <img
                          src={msg.attachmentUrl}
                          alt=""
                          className="ticket-chat__attachment-thumb"
                        />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ticket-chat__attachment"
                        onClick={() => openPreview(msg)}
                      >
                        {attachmentPreviewLabel(attachmentKind, msg.attachmentName)}
                      </button>
                    )}
                  </div>
                ) : null}

                <footer className="ticket-chat__meta">
                  <span className="ticket-chat__author">{msg.authorLabel}</span>
                  <span className="ticket-chat__time">{msg.at}</span>
                </footer>
              </article>
            </li>
          )
        })}
        <li ref={endRef} className="ticket-chat__anchor" aria-hidden />
      </ul>

      <TicketAttachmentModal
        isOpen={preview != null}
        onClose={() => setPreview(null)}
        url={preview?.url}
        name={preview?.name}
        kind={preview?.kind ?? 'file'}
      />
    </>
  )
}
