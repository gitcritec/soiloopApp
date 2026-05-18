import { faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect } from 'react'
import { buildGoogleMapsEmbedUrl, buildGoogleMapsOpenUrl } from '../../lib/locationQuery.js'
import './LocationMapModal.css'

/**
 * Mapa Google embutido (morada ou coordenadas). Inclui link para abrir na app nativa.
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {string} props.query — texto ou "lat,lng"
 * @param {string} [props.title]
 * @param {string} [props.subtitle]
 */
export default function LocationMapModal({ isOpen, onClose, query, title, subtitle }) {
  const hasQuery = Boolean((query ?? '').trim())

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  const embedSrc = hasQuery ? buildGoogleMapsEmbedUrl(query.trim()) : ''
  const openHref = hasQuery ? buildGoogleMapsOpenUrl(query.trim()) : '#'

  return (
    <div
      className={`location-map-modal${isOpen ? ' location-map-modal--open' : ''}`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        className="location-map-modal__backdrop"
        aria-label="Fechar mapa"
        tabIndex={isOpen ? 0 : -1}
        onClick={onClose}
      />
      <div
        className="location-map-modal__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'location-map-modal-title' : undefined}
        aria-label={title ? undefined : 'Localização no mapa'}
      >
        <header className="location-map-modal__header">
          <div className="location-map-modal__titles">
            {title ? (
              <h2 id="location-map-modal-title" className="location-map-modal__title">
                {title}
              </h2>
            ) : null}
            {subtitle ? <p className="location-map-modal__subtitle">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="location-map-modal__close"
            aria-label="Fechar"
            onClick={onClose}
          >
            <FontAwesomeIcon icon={faXmark} className="location-map-modal__close-icon" aria-hidden />
          </button>
        </header>

        <div className="location-map-modal__map-wrap">
          {isOpen && hasQuery ? (
            <iframe
              className="location-map-modal__map"
              title="Mapa da localização"
              src={embedSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : null}
        </div>

        <footer className="location-map-modal__footer">
          <a
            className="location-map-modal__open-link"
            href={openHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={!hasQuery ? (e) => e.preventDefault() : undefined}
          >
            Abrir no Google Maps
          </a>
        </footer>
      </div>
    </div>
  )
}
