/** Etiquetas de estado para badges de tickets (UI). */

export const TICKET_STATUS_LABEL = {
  'aberto-hoje': 'Aberto',
  'aberto-amanha': 'Aberto',
  respondido: 'Respondido',
  fechado: 'Fechado',
}

export const TICKET_PRIORIDADE_OPTIONS = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
  { value: 'na', label: 'N/A' },
]

export const TICKET_REF_PREFIX = 'SL'
export const TICKET_REF_PAD = 4
const TICKET_REF_PATTERN = /^SL(\d+)$/i

/** Evita mostrar documentId interno do Strapi como referência ao utilizador. */
export function isInternalTicketId(value) {
  const s = String(value ?? '').trim()
  if (!s) return true
  if (TICKET_REF_PATTERN.test(s)) return false
  if (/^[a-z0-9]{18,}$/i.test(s)) return true
  return false
}

/** Normaliza referências SL → SL0003. */
export function normalizeTicketRef(value) {
  const raw = String(value ?? '').trim().replace(/^#/, '')
  if (!raw) return null

  const match = raw.match(TICKET_REF_PATTERN)
  if (match) {
    return `${TICKET_REF_PREFIX}${String(parseInt(match[1], 10)).padStart(TICKET_REF_PAD, '0')}`
  }

  return null
}

/** Referência legível para UI (#SL0003). */
export function formatTicketDisplayRef(value) {
  const normalized = normalizeTicketRef(value)
  if (normalized) return normalized

  const raw = String(value ?? '').trim().replace(/^#/, '')
  if (!raw || isInternalTicketId(raw)) return null
  return raw
}

/** Escolhe a melhor referência entre `ref` e id de fallback. */
export function pickTicketDisplayRef(ref, fallbackId) {
  return formatTicketDisplayRef(ref) ?? formatTicketDisplayRef(fallbackId)
}

/**
 * Próxima referência sequencial (SL0001, SL0002, …).
 * @param {string[]} existingRefs
 */
export function generateNextTicketRef(existingRefs = []) {
  let max = 0
  for (const raw of existingRefs) {
    const normalized = normalizeTicketRef(raw)
    if (!normalized) continue
    const match = normalized.match(TICKET_REF_PATTERN)
    if (match) max = Math.max(max, parseInt(match[1], 10))
  }
  return `${TICKET_REF_PREFIX}${String(max + 1).padStart(TICKET_REF_PAD, '0')}`
}

/**
 * Atribui refs SL sequenciais a tickets que ainda não têm (só UI).
 * @param {Array<{ id: string, ref: string, dataAbertura?: string|null }>} tickets
 */
export function assignDisplayRefsToTickets(tickets) {
  if (!tickets.length) return tickets

  let maxNum = 0
  for (const ticket of tickets) {
    const normalized = normalizeTicketRef(ticket.ref)
    if (!normalized) continue
    const match = normalized.match(TICKET_REF_PATTERN)
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10))
  }

  const missing = tickets
    .filter((ticket) => !normalizeTicketRef(ticket.ref))
    .sort((a, b) => {
      const ta = a.dataAbertura ? new Date(a.dataAbertura).getTime() : 0
      const tb = b.dataAbertura ? new Date(b.dataAbertura).getTime() : 0
      return ta - tb
    })

  const assigned = new Map()
  let counter = maxNum
  for (const ticket of missing) {
    counter += 1
    assigned.set(
      ticket.id,
      `${TICKET_REF_PREFIX}${String(counter).padStart(TICKET_REF_PAD, '0')}`,
    )
  }

  return tickets.map((ticket) => {
    const ref = assigned.get(ticket.id)
    if (!ref) {
      const normalized = normalizeTicketRef(ticket.ref)
      return normalized ? { ...ticket, ref: normalized } : ticket
    }
    return { ...ticket, ref }
  })
}
