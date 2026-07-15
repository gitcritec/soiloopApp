/** Opções de período aceites pelo Strapi (enum movimento.periodo). */
export const MOVIMENTO_PERIODO_OPTIONS = [
  { value: 'manha', label: 'manhã' },
  { value: 'tarde', label: 'tarde' },
  { value: 'indiferente', label: 'indiferente' },
]

function normalizePeriodoText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Valor canónico para gravar no Strapi. */
export function normalizePeriodoForStrapi(value) {
  const s = normalizePeriodoText(value)
  if (s === 'manha') return 'manha'
  if (s === 'tarde') return 'tarde'
  if (s === 'indiferente') return 'indiferente'
  const raw = String(value ?? '').trim()
  return raw || ''
}

/** Etiqueta legível na interface. */
export function formatPeriodoLabel(value) {
  const s = normalizePeriodoText(value)
  if (s === 'manha') return 'manhã'
  if (s === 'tarde') return 'tarde'
  if (s === 'indiferente') return 'indiferente'
  return String(value ?? '').trim()
}
