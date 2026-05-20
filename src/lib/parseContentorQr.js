/** @param {string} code */
function isValidContentorCode(code) {
  const c = String(code).trim()
  return c.length > 0 && c.length <= 64 && /^[A-Za-z0-9_-]+$/.test(c)
}

/**
 * Interpreta o texto lido do QR: código simples do contentor (ex. CNT-001).
 * @param {string} raw
 * @returns {{ contentorId: string } | null}
 */
export function parseContentorQr(raw) {
  const text = raw?.trim()
  if (!text) return null

  try {
    const url = new URL(text)
    const code =
      url.searchParams.get('code') ??
      url.searchParams.get('contentorId') ??
      url.searchParams.get('id')
    if (code && isValidContentorCode(code)) {
      return { contentorId: code.trim() }
    }
  } catch {
    /* não é URL */
  }

  if (isValidContentorCode(text)) {
    return { contentorId: text }
  }

  return null
}
