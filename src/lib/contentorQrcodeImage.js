import QRCode from 'qrcode'

const QR_SIZE = 280
const LABEL_HEIGHT = 48
const PADDING = 20

/**
 * Gera PNG com QR (conteúdo = CID) e etiqueta por baixo (ex. CNT-001).
 * @param {string} cid
 * @returns {Promise<Blob>}
 */
export async function createContentorQrcodePngBlob(cid) {
  const label = String(cid ?? '').trim()
  if (!label) throw new Error('CID em falta para gerar o QR code.')

  const width = QR_SIZE + PADDING * 2
  const height = QR_SIZE + LABEL_HEIGHT + PADDING * 2

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível criar o canvas do QR code.')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  const qrCanvas = document.createElement('canvas')
  await QRCode.toCanvas(qrCanvas, label, {
    width: QR_SIZE,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#060e0b', light: '#ffffff' },
  })

  ctx.drawImage(qrCanvas, PADDING, PADDING)

  ctx.fillStyle = '#060e0b'
  ctx.font = '700 24px Rubik, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, width / 2, PADDING + QR_SIZE + LABEL_HEIGHT / 2)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Não foi possível exportar a imagem QR.'))
      },
      'image/png',
      1,
    )
  })
}
