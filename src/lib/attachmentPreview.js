/** @typedef {'image'|'pdf'|'file'} AttachmentPreviewKind */

/**
 * @param {string|null|undefined} mime
 * @param {string|null|undefined} name
 * @param {string|null|undefined} [url]
 * @returns {AttachmentPreviewKind}
 */
export function guessAttachmentKind(mime, name, url) {
  const m = String(mime ?? '').toLowerCase()
  if (m.startsWith('image/')) return 'image'
  if (m === 'application/pdf') return 'pdf'

  const fromName = String(name ?? url ?? '').toLowerCase()
  if (/\.(jpe?g|png|gif|webp|bmp|svg|heic|heif)$/.test(fromName)) return 'image'
  if (/\.pdf$/.test(fromName)) return 'pdf'
  return 'file'
}

/**
 * @param {AttachmentPreviewKind} kind
 */
export function attachmentPreviewLabel(kind, name) {
  if (kind === 'image') return 'Ver imagem'
  if (kind === 'pdf') return 'Ver PDF'
  return name?.trim() || 'Ver ficheiro'
}
