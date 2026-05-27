/** Slug CSS para badges (Figma «Contentores - Local» / «Contentores - Estado»). */
export function contentorBadgeVariant(label) {
  const s = String(label ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

  if (s.includes('transito')) return 'em-transito'
  if (s === 'cliente') return 'cliente'
  if (s.includes('armazem')) return 'armazem'
  if (s.includes('danificad')) return 'danificado'
  if (s.includes('infetad')) return 'infetado'
  if (s.includes('reutiliz')) return 'reutilizavel'
  if (s === 'novo') return 'reutilizavel'
  if (s === 'usado') return 'infetado'
  return 'default'
}

/** Pares de badges do mock Figma (node 16:793). */
const FIGMA_BADGE_BY_ESTADO = {
  novo: { topText: 'Armazém', topVariant: 'armazem', bottomText: 'Reutilizável', bottomVariant: 'reutilizavel' },
  usado: { topText: 'Cliente', topVariant: 'cliente', bottomText: 'Infetado', bottomVariant: 'infetado' },
  danificado: {
    topText: 'Em Trânsito',
    topVariant: 'em-transito',
    bottomText: 'Danificado',
    bottomVariant: 'danificado',
  },
}

/**
 * Etiqueta QR da linha de specs (ex. CNT-001 → QR001).
 * @param {string} [cid]
 */
export function formatContentorQrLabel(cid) {
  const s = String(cid ?? '').trim()
  const match = s.match(/(\d+)\s*$/i)
  if (match) return `QR${match[1].padStart(3, '0')}`
  return 'QR000'
}

/**
 * @param {string} [localizacao]
 * @param {string} [estadoLabel]
 * @param {string|null} [estadoSlug]
 */
export function contentorCardBadges(localizacao, estadoLabel, estadoSlug) {
  const slug = estadoSlug && FIGMA_BADGE_BY_ESTADO[estadoSlug] ? estadoSlug : null
  if (slug) {
    const pair = FIGMA_BADGE_BY_ESTADO[slug]
    const bottomText = estadoLabel?.trim() || pair.bottomText
    return {
      topText: pair.topText,
      topVariant: pair.topVariant,
      bottomText,
      bottomVariant: contentorBadgeVariant(bottomText),
    }
  }

  const estado = estadoLabel?.trim() || '—'
  const loc = localizacao?.trim()
  const locOk = loc && loc !== '—'

  return {
    topText: locOk ? (loc.length > 12 ? `${loc.slice(0, 10)}…` : loc) : 'Armazém',
    topVariant: locOk ? 'armazem' : 'armazem',
    bottomText: estado,
    bottomVariant: contentorBadgeVariant(estado),
  }
}
