/**
 * Constrói lista única de mensagens (estilo chat) a partir de um ticket.
 * A mensagem inicial do ticket + respostas no mesmo fio.
 */

/**
 * @param {object} ticket
 * @param {{ clientLabel?: string, adminLabel?: string, selfLabel?: string }} [labels]
 */
export function buildTicketChatMessages(ticket, labels = {}) {
  if (!ticket) return []

  const clientLabel = labels.clientLabel ?? ticket.clientName ?? 'Cliente'
  const adminLabel = labels.adminLabel ?? 'Equipa Soiloop'
  const selfLabel = labels.selfLabel ?? 'Você'

  /** @type {Array<{ id: string, author: 'cliente'|'admin', authorLabel: string, text: string, at: string, ts: number }>} */
  const messages = []

  const initialText = String(ticket.message ?? '').trim()
  if (initialText) {
    const opened = ticket.dataAbertura ? new Date(ticket.dataAbertura).getTime() : 0
    messages.push({
      id: 'initial',
      author: 'cliente',
      authorLabel: labels.selfLabel ? selfLabel : clientLabel,
      text: initialText,
      at: [ticket.date, ticket.time].filter(Boolean).join(' ').trim() || '—',
      ts: Number.isFinite(opened) && opened > 0 ? opened : 0,
    })
  }

  for (const reply of ticket.replies ?? []) {
    const text = String(reply.text ?? '').trim()
    const hasAttachment = Boolean(reply.attachmentUrl)
    if (!text && !hasAttachment) continue
    const author = reply.author === 'admin' ? 'admin' : 'cliente'
    messages.push({
      id: reply.id ?? `r-${messages.length}`,
      author,
      authorLabel:
        author === 'admin'
          ? adminLabel
          : labels.selfLabel
            ? selfLabel
            : clientLabel,
      text: text || (reply.attachmentName ? `Anexo: ${reply.attachmentName}` : 'Anexo'),
      at: reply.at ?? '—',
      ts: messages.length + 1,
      attachmentUrl: reply.attachmentUrl ?? null,
      attachmentName: reply.attachmentName ?? null,
      attachmentMime: reply.attachmentMime ?? null,
    })
  }

  return messages
}
