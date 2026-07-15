import { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faLocationDot as faLocationDotSharp } from '@fortawesome/sharp-light-svg-icons'
import LocationPickerModal from '../../../../components/LocationPickerModal/LocationPickerModal.jsx'
import {
  fetchStrapiArmazemLocation,
  updateStrapiArmazemLocation,
} from '../../../../lib/strapiGlobal.js'
import './Definicoes.css'

/** Definições da empresa (admin) — localização do armazém. */
export default function Definicoes() {
  const [morada, setMorada] = useState('')
  const [lat, setLat] = useState(null)
  const [lng, setLng] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const loadSettings = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    return fetchStrapiArmazemLocation()
      .then((armazem) => {
        if (!armazem) {
          setMorada('')
          setLat(null)
          setLng(null)
          return
        }
        setMorada(armazem.morada ?? '')
        setLat(armazem.lat)
        setLng(armazem.lng)
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar as definições.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    setNotice('')
    const moradaTrim = morada.trim()
    if (!moradaTrim) {
      setFormError('Indica a morada do armazém.')
      return
    }
    if (lat == null || lng == null) {
      setFormError('Define as coordenadas no mapa.')
      return
    }

    setSubmitting(true)
    try {
      await updateStrapiArmazemLocation({ morada: moradaTrim, lat, lng })
      setNotice('Localização do armazém guardada.')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível guardar.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="definicoes">
        <p className="definicoes__status" role="status">
          A carregar definições…
        </p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="definicoes">
        <p className="definicoes__status definicoes__status--error" role="alert">
          {loadError}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="definicoes">
        <header className="definicoes__head">
          <h1 className="definicoes__title">Definições</h1>
          <p className="definicoes__help">
            Morada e coordenadas do armazém da empresa. Usada no mapa quando um contentor está no
            armazém.
          </p>
        </header>

        <form className="definicoes__card" onSubmit={handleSubmit} noValidate>
          <div className="definicoes__scroll">
            <section className="definicoes__section" aria-labelledby="definicoes-armazem-title">
              <h2 id="definicoes-armazem-title" className="definicoes__section-title">
                Armazém
              </h2>

              <label className="definicoes__field">
                <span className="definicoes__label">Morada*</span>
                <span className="definicoes__loc-row">
                  <input
                    type="text"
                    className="definicoes__input"
                    value={morada}
                    placeholder="Morada do armazém"
                    onChange={(e) => setMorada(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="definicoes__pin-btn"
                    aria-label="Definir coordenadas no mapa"
                    onClick={() => setPickerOpen(true)}
                  >
                    <FontAwesomeIcon icon={faLocationDotSharp} className="definicoes__pin-icon" aria-hidden />
                  </button>
                </span>
              </label>

              {lat != null && lng != null ? (
                <p className="definicoes__coords-set">
                  Coordenadas: {lat.toFixed(5)}, {lng.toFixed(5)}
                </p>
              ) : (
                <p className="definicoes__coords-missing">Coordenadas por definir</p>
              )}
            </section>
          </div>

          <div className="definicoes__actions">
            {formError ? (
              <p className="definicoes__form-error" role="alert">
                {formError}
              </p>
            ) : null}
            {notice ? (
              <p className="definicoes__notice" role="status">
                {notice}
              </p>
            ) : null}
            <button type="submit" className="definicoes__submit" disabled={submitting}>
              {submitting ? 'A guardar…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>

      <LocationPickerModal
        isOpen={pickerOpen}
        value={{ lat, lng }}
        onClose={() => setPickerOpen(false)}
        onConfirm={(coords) => {
          setLat(coords.lat)
          setLng(coords.lng)
          setPickerOpen(false)
        }}
      />
    </>
  )
}
