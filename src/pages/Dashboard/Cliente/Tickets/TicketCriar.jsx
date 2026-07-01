import { useEffect, useRef, useState } from 'react'
import { faArrowLeft, faPaperclip } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { fetchStrapiClienteDetail } from '../../../../lib/strapiClientes.js'
import { createStrapiTicket, getStrapiCurrentUserId } from '../../../../lib/strapiTickets.js'
import { TICKET_PRIORIDADE_OPTIONS } from '../../../../lib/ticketStatus.js'
import './Tickets.css'

/** Novo ticket (cliente). */
export default function TicketCriar({ onCancel, onSuccess }) {
  const [assunto, setAssunto] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [prioridade, setPrioridade] = useState('na')
  const [localizacaoId, setLocalizacaoId] = useState('')
  const [localizacoes, setLocalizacoes] = useState([])
  const [attachmentFile, setAttachmentFile] = useState(null)
  const [attachmentName, setAttachmentName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const fileInputRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    getStrapiCurrentUserId().then(async (id) => {
      if (cancelled || !id) return
      const detail = await fetchStrapiClienteDetail(String(id))
      if (cancelled || !detail?.localizacoes?.length) return
      setLocalizacoes(detail.localizacoes)
      const first = detail.localizacoes[0]
      if (first?.strapiId) setLocalizacaoId(String(first.strapiId))
    })
    return () => {
      cancelled = true
    }
  }, [])

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    setAttachmentFile(file ?? null)
    setAttachmentName(file ? file.name : '')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    setSubmitting(true)
    try {
      const created = await createStrapiTicket({
        assunto,
        mensagem,
        prioridade,
        localizacaoId: localizacaoId || null,
      })
      if (attachmentFile) {
        // Anexo na mensagem inicial: futuro — Strapi guarda mensagem no ticket, não em resposta
      }
      onSuccess?.(created)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível criar o ticket.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="cliente-ticket-form">
      <button type="button" className="cliente-ticket-view__back" onClick={onCancel}>
        <FontAwesomeIcon icon={faArrowLeft} className="cliente-ticket-view__back-icon" aria-hidden />
        Voltar à lista
      </button>

      <div className="cliente-ticket-form__card">
        <form className="cliente-ticket-form__scroll" onSubmit={handleSubmit}>
          <h1 className="cliente-ticket-form__title">Novo Ticket</h1>

          {formError ? (
            <p className="cliente-ticket-view__error" role="alert">
              {formError}
            </p>
          ) : null}

          <label className="cliente-ticket-form__field">
            <span className="cliente-ticket-form__label">Assunto*</span>
            <input
              type="text"
              className="cliente-ticket-form__input"
              value={assunto}
              onChange={(e) => setAssunto(e.target.value)}
              placeholder="Ex.: Contentor danificado"
              disabled={submitting}
              required
            />
          </label>

          {localizacoes.length > 0 ? (
            <label className="cliente-ticket-form__field">
              <span className="cliente-ticket-form__label">Localização*</span>
              <select
                className="cliente-ticket-form__select"
                value={localizacaoId}
                onChange={(e) => setLocalizacaoId(e.target.value)}
                disabled={submitting}
                required
              >
                {localizacoes.map((loc) => (
                  <option key={loc.strapiId ?? loc.nome} value={loc.strapiId ?? ''}>
                    {loc.nome || loc.morada}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="cliente-ticket-form__field">
            <span className="cliente-ticket-form__label">Prioridade</span>
            <select
              className="cliente-ticket-form__select"
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value)}
              disabled={submitting}
            >
              {TICKET_PRIORIDADE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="cliente-ticket-form__field">
            <span className="cliente-ticket-form__label">Mensagem*</span>
            <textarea
              className="cliente-ticket-form__textarea"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Descreva o problema ou pedido"
              disabled={submitting}
              required
            />
          </label>

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

        <div className="cliente-ticket-form__actions">
          <button
            type="button"
            className="cliente-ticket-form__submit"
            disabled={submitting || !assunto.trim() || !mensagem.trim()}
            onClick={handleSubmit}
          >
            {submitting ? 'A enviar…' : 'Confirmar Registo'}
          </button>
          <button
            type="button"
            className="cliente-ticket-form__discard"
            disabled={submitting}
            onClick={onCancel}
          >
            Descartar Alterações
          </button>
        </div>
      </div>
    </div>
  )
}
