/** @returns {boolean} */
export function isIosDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

/** iPhone com HTTPS: folha do sistema com «Guardar em Ficheiros» (escolher pasta). */
export function canIosPickSaveLocation() {
  return isIosDevice() && window.isSecureContext && typeof navigator.share === 'function'
}

/**
 * Obtém blob de uma imagem (fetch CORS ou canvas com crossOrigin).
 * @param {string} url
 * @returns {Promise<Blob>}
 */
export async function fetchImageBlob(url) {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (res.ok) {
      const blob = await res.blob()
      if (blob.size > 0) return blob
    }
  } catch {
    /* tenta canvas */
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas indisponível'))
        return
      }
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Exportação falhou'))),
        'image/png',
        1,
      )
    }
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem'))
    img.src = url
  })
}

/**
 * @typedef {'picker'|'share'|'manual'|'download'|'cancelled'} SaveImageMethod
 * @typedef {{ method: SaveImageMethod }} SaveImageResult
 */

/**
 * Seletor nativo de ficheiro (Chrome/Edge desktop). Safari iOS não suporta.
 * @param {Blob} blob
 * @param {string} filename
 * @returns {Promise<boolean>}
 */
async function trySaveFilePicker(blob, filename) {
  if (typeof window.showSaveFilePicker !== 'function') return false
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [
        {
          description: 'Imagem PNG',
          accept: { 'image/png': ['.png'] },
        },
      ],
    })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return true
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    return false
  }
}

/**
 * Folha de partilha do iOS — opção «Guardar em Ficheiros» abre o seletor de pasta.
 * @param {File} file
 */
async function tryIosShareFile(file) {
  const payloads = [{ files: [file] }]
  for (const data of payloads) {
    try {
      await navigator.share(data)
      return true
    } catch (err) {
      if (err?.name === 'AbortError') throw err
    }
  }
  return false
}

/**
 * Guarda imagem com o melhor método disponível no dispositivo.
 * @param {Blob} blob
 * @param {string} filename
 * @returns {Promise<SaveImageResult>}
 */
export async function saveImageBlob(blob, filename) {
  const file = new File([blob], filename, { type: 'image/png' })

  try {
    if (await trySaveFilePicker(blob, filename)) {
      return { method: 'picker' }
    }
  } catch (err) {
    if (err?.name === 'AbortError') return { method: 'cancelled' }
  }

  if (isIosDevice()) {
    if (window.isSecureContext && typeof navigator.share === 'function') {
      try {
        if (await tryIosShareFile(file)) return { method: 'share' }
      } catch (err) {
        if (err?.name === 'AbortError') return { method: 'cancelled' }
      }
    }
    return { method: 'manual' }
  }

  const objectUrl = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
    return { method: 'download' }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

/** Texto do botão no modal QR. */
export function saveImageButtonLabel() {
  if (canIosPickSaveLocation()) return 'Guardar em Ficheiros'
  if (isIosDevice()) return 'Guardar imagem'
  return 'Descarregar QR code'
}

/** iPhone com ligação segura (app publicada): botão abre o menu do sistema. */
export const IOS_SHARE_SAVE_HINT =
  'Toca em «Guardar em Ficheiros» e escolhe a pasta onde queres guardar o QR code.'

/** iPhone em desenvolvimento local ou se o menu não abrir. */
export const IOS_MANUAL_SAVE_HINT =
  'Mantém premido na imagem do QR e escolhe «Guardar na Fototeca» ou «Guardar em Ficheiros».'

export const IOS_SAVE_ERROR_HINT =
  'Não foi possível abrir o menu de guardar. Mantém premido na imagem e tenta outra vez.'
