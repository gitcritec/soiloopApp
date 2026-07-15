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

/**
 * @param {string} [situacaoLabel]
 * @param {string|null} [situacaoSlug]
 */
export function formatSituacaoDisplayLabel(situacaoLabel, situacaoSlug) {
  const slug = String(situacaoSlug ?? situacaoLabel ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  if (slug === 'cliente') return 'Cliente'
  if (slug.includes('transito')) return 'Em Trânsito'
  if (slug.includes('armazem')) return 'Armazém'

  const raw = String(situacaoLabel ?? '').trim()
  if (raw && raw !== '—') return raw
  return 'Armazém'
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
 * Badges do cartão: situação (topo) + estado físico do contentor (base).
 * @param {string} [situacaoLabel]
 * @param {string} [estadoLabel]
 * @param {string|null} [situacaoSlug]
 * @param {string|null} [estadoSlug]
 */
export function contentorCardBadges(situacaoLabel, estadoLabel, situacaoSlug, estadoSlug) {
  const topText = formatSituacaoDisplayLabel(situacaoLabel, situacaoSlug)
  const bottomText = String(estadoLabel ?? '').trim() || '—'

  return {
    topText,
    topVariant: contentorBadgeVariant(situacaoSlug ?? topText),
    bottomText,
    bottomVariant: contentorBadgeVariant(estadoSlug ?? bottomText),
  }
}
