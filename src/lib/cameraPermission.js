const CAMERA_CONSTRAINTS = {
  video: { facingMode: { ideal: 'environment' } },
  audio: false,
}

export function isCameraApiSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia)
}

/** @returns {Promise<'granted' | 'denied' | 'prompt' | 'unknown'>} */
export async function queryCameraPermission() {
  if (!isCameraApiSupported()) return 'unknown'
  if (!navigator.permissions?.query) return 'unknown'
  try {
    const status = await navigator.permissions.query({ name: 'camera' })
    return status.state
  } catch {
    return 'unknown'
  }
}

/** Pede acesso à câmara — dispara o diálogo do browser se ainda não foi concedido. */
export async function requestCameraStream() {
  if (!isCameraApiSupported()) {
    const err = new Error('Câmara não suportada neste browser.')
    err.name = 'NotSupportedError'
    throw err
  }
  return navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
}

export function stopMediaStream(stream) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function getCameraErrorMessage(err) {
  if (!err) return 'Não foi possível aceder à câmara.'
  if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
    return 'Permissão da câmara negada. Ative-a nas definições do browser ou do dispositivo.'
  }
  if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
    return 'Nenhuma câmara encontrada neste dispositivo.'
  }
  if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
    return 'A câmara está a ser usada por outra aplicação.'
  }
  if (err.name === 'NotSupportedError') {
    return err.message || 'Câmara não suportada neste browser.'
  }
  return 'Não foi possível aceder à câmara.'
}
