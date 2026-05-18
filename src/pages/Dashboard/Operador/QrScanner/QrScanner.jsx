import { faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { BrowserQRCodeReader } from '@zxing/browser'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getCameraErrorMessage,
  isCameraApiSupported,
  queryCameraPermission,
  requestCameraStream,
  stopMediaStream,
} from '../../../../lib/cameraPermission.js'
import './QrScanner.css'

const MODE_LABEL = {
  recolher: 'Recolha',
  entregar: 'Entrega',
}

/**
 * Leitor QR com câmara (fundo = vídeo ao vivo). Mira + texto conforme Figma operador.
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {'recolher' | 'entregar'} props.mode
 * @param {() => void} props.onClose
 * @param {(payload: { mode: string, value: string }) => void} props.onDetected
 */
export default function QrScanner({ isOpen, mode, onClose, onDetected }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const controlsRef = useRef(null)
  const detectedRef = useRef(false)
  /** @type {'idle' | 'prompt' | 'requesting' | 'scanning' | 'denied' | 'unsupported'} */
  const [cameraPhase, setCameraPhase] = useState('idle')
  const [error, setError] = useState(null)

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop()
    controlsRef.current = null
    stopMediaStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  const startScanning = useCallback(
    async (stream) => {
      if (!videoRef.current) return
      const reader = new BrowserQRCodeReader()
      const controls = await reader.decodeFromStream(stream, videoRef.current, (result) => {
        if (detectedRef.current || !result) return
        detectedRef.current = true
        onDetected({ mode, value: result.getText() })
      })
      controlsRef.current = controls
      setCameraPhase('scanning')
    },
    [mode, onDetected],
  )

  const activateCamera = useCallback(async () => {
    if (!isCameraApiSupported()) {
      setCameraPhase('unsupported')
      setError('A câmara não está disponível neste browser. Use HTTPS ou instale a app no telemóvel.')
      return
    }

    setError(null)
    setCameraPhase('requesting')

    try {
      const stream = await requestCameraStream()
      streamRef.current = stream

      const video = videoRef.current
      if (!video) {
        stopMediaStream(stream)
        return
      }

      video.srcObject = stream
      await video.play()
      await startScanning(stream)
    } catch (err) {
      stopCamera()
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraPhase('denied')
        setError(getCameraErrorMessage(err))
      } else {
        setCameraPhase('prompt')
        setError(getCameraErrorMessage(err))
      }
    }
  }, [startScanning, stopCamera])

  useEffect(() => {
    if (!isOpen) {
      stopCamera()
      setCameraPhase('idle')
      setError(null)
      detectedRef.current = false
      return
    }

    detectedRef.current = false
    let cancelled = false

    async function initPermission() {
      if (!isCameraApiSupported()) {
        if (!cancelled) {
          setCameraPhase('unsupported')
          setError('A câmara não está disponível neste browser.')
        }
        return
      }

      const state = await queryCameraPermission()

      if (cancelled) return

      if (state === 'granted') {
        activateCamera()
        return
      }

      if (state === 'denied') {
        setCameraPhase('denied')
        setError('Permissão da câmara negada. Ative-a nas definições do browser.')
        return
      }

      setCameraPhase('prompt')
    }

    initPermission()

    return () => {
      cancelled = true
    }
  }, [isOpen, activateCamera, stopCamera])

  useEffect(() => {
    if (!isOpen || cameraPhase !== 'denied') return undefined

    let permissionStatus = null

    async function watchDenied() {
      try {
        permissionStatus = await navigator.permissions.query({ name: 'camera' })
        const onChange = () => {
          if (permissionStatus.state === 'granted') {
            activateCamera()
          }
        }
        permissionStatus.addEventListener('change', onChange)
        return () => permissionStatus.removeEventListener('change', onChange)
      } catch {
        return undefined
      }
    }

    let removeListener
    watchDenied().then((remove) => {
      removeListener = remove
    })

    return () => {
      removeListener?.()
    }
  }, [isOpen, cameraPhase, activateCamera])

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prev
    }
  }, [isOpen, onClose])

  useEffect(() => () => stopCamera(), [stopCamera])

  const modeLabel = MODE_LABEL[mode] ?? mode
  const isScanning = cameraPhase === 'scanning'
  const showPermissionUi =
    cameraPhase === 'prompt' ||
    cameraPhase === 'requesting' ||
    cameraPhase === 'denied' ||
    cameraPhase === 'unsupported'

  return (
    <div
      className={`qr-scanner${isOpen ? ' qr-scanner--open' : ''}`}
      aria-hidden={!isOpen}
    >
      <div
        className="qr-scanner__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={showPermissionUi ? 'qr-scanner-permission-title' : 'qr-scanner-hint'}
        aria-hidden={!isOpen}
      >
        <video
          ref={videoRef}
          className={`qr-scanner__video${isScanning ? '' : ' qr-scanner__video--hidden'}`}
          autoPlay
          muted
          playsInline
        />

        <p className={`qr-scanner__mode qr-scanner__mode--${mode}`} aria-live="polite">
          {modeLabel}
        </p>

        <button
          type="button"
          className="qr-scanner__close"
          aria-label="Fechar leitor QR"
          tabIndex={isOpen ? 0 : -1}
          onClick={onClose}
        >
          <FontAwesomeIcon icon={faXmark} aria-hidden />
        </button>

        {isScanning ? (
          <div className="qr-scanner__ui">
            <div className="qr-scanner__frame" aria-hidden="true">
              <span className="qr-scanner__corner qr-scanner__corner--tl" />
              <span className="qr-scanner__corner qr-scanner__corner--tr" />
              <span className="qr-scanner__corner qr-scanner__corner--bl" />
              <span className="qr-scanner__corner qr-scanner__corner--br" />
            </div>
            <p id="qr-scanner-hint" className="qr-scanner__hint">
              Scan o código QR
            </p>
          </div>
        ) : null}

        {showPermissionUi ? (
          <div className="qr-scanner__permission">
            <h2 id="qr-scanner-permission-title" className="qr-scanner__permission-title">
              Acesso à câmara
            </h2>
            <p className="qr-scanner__permission-text">
              {cameraPhase === 'requesting'
                ? 'A aguardar a sua autorização…'
                : 'Para ler o código QR, precisamos de usar a câmara do dispositivo.'}
            </p>
            {error ? <p className="qr-scanner__permission-error">{error}</p> : null}
            {cameraPhase !== 'unsupported' ? (
              <button
                type="button"
                className="qr-scanner__permission-btn"
                disabled={cameraPhase === 'requesting'}
                onClick={activateCamera}
              >
                {cameraPhase === 'requesting'
                  ? 'A pedir permissão…'
                  : cameraPhase === 'denied'
                    ? 'Tentar novamente'
                    : 'Permitir câmara'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
