import { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPen, faPlus, faTrash, faXmark } from '@fortawesome/pro-light-svg-icons'
import { faLocationDot as faLocationDotSharp } from '@fortawesome/sharp-light-svg-icons'
import LocationPickerModal from '../../../../components/LocationPickerModal/LocationPickerModal.jsx'
import {
  createStrapiCodigoLer,
  deleteStrapiCodigoLer,
  fetchStrapiCodigosLer,
  updateStrapiCodigoLer,
} from '../../../../lib/strapiCodigoLer.js'
import {
  fetchStrapiArmazemLocation,
  updateStrapiArmazemLocation,
} from '../../../../lib/strapiGlobal.js'
import DefinicoesEstadoAuxSection from './DefinicoesEstadoAuxSection.jsx'
import './Definicoes.css'

/** Definições da empresa (admin) — armazém + códigos LER. */
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

  const [codigosLer, setCodigosLer] = useState([])
  const [lerCodigo, setLerCodigo] = useState('')
  const [lerDescricao, setLerDescricao] = useState('')
  const [lerEditingId, setLerEditingId] = useState(null)
  const [lerLoading, setLerLoading] = useState(true)
  const [lerError, setLerError] = useState('')
  const [lerNotice, setLerNotice] = useState('')
  const [lerBusyId, setLerBusyId] = useState(null)
  const [lerSaving, setLerSaving] = useState(false)

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

  const loadCodigosLer = useCallback(() => {
    setLerLoading(true)
    setLerError('')
    return fetchStrapiCodigosLer()
      .then((rows) => {
        setCodigosLer(rows)
      })
      .catch((err) => {
        setLerError(err instanceof Error ? err.message : 'Não foi possível carregar os códigos LER.')
        setCodigosLer([])
      })
      .finally(() => {
        setLerLoading(false)
      })
  }, [])

  useEffect(() => {
    loadSettings()
    loadCodigosLer()
  }, [loadSettings, loadCodigosLer])

  function resetLerForm() {
    setLerCodigo('')
    setLerDescricao('')
    setLerEditingId(null)
  }

  async function handleSaveArmazem(event) {
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

  function startEditCodigoLer(item) {
    if (!item?.id) return
    setLerError('')
    setLerNotice('')
    setLerEditingId(item.id)
    setLerCodigo(item.codigo ?? '')
    setLerDescricao(item.descricao ?? '')
  }

  async function handleSaveCodigoLer(event) {
    event.preventDefault()
    setLerError('')
    setLerNotice('')
    const codigo = lerCodigo.trim()
    if (!codigo) {
      setLerError('Indica o código LER.')
      return
    }

    setLerSaving(true)
    try {
      if (lerEditingId) {
        const updated = await updateStrapiCodigoLer(lerEditingId, {
          codigo,
          descricao: lerDescricao.trim(),
        })
        setCodigosLer((prev) =>
          [...prev.filter((item) => item.id !== updated.id && item.id !== lerEditingId), updated].sort(
            (a, b) => a.codigo.localeCompare(b.codigo, 'pt'),
          ),
        )
        setLerNotice('Código LER atualizado.')
      } else {
        const created = await createStrapiCodigoLer({
          codigo,
          descricao: lerDescricao.trim(),
        })
        setCodigosLer((prev) =>
          [...prev.filter((item) => item.id !== created.id), created].sort((a, b) =>
            a.codigo.localeCompare(b.codigo, 'pt'),
          ),
        )
        setLerNotice('Código LER adicionado.')
      }
      resetLerForm()
    } catch (err) {
      setLerError(
        err instanceof Error
          ? err.message
          : lerEditingId
            ? 'Não foi possível atualizar o código LER.'
            : 'Não foi possível adicionar o código LER.',
      )
    } finally {
      setLerSaving(false)
    }
  }

  async function handleDeleteCodigoLer(item) {
    if (!item?.id) return
    setLerError('')
    setLerNotice('')
    setLerBusyId(item.id)
    try {
      await deleteStrapiCodigoLer(item.id)
      setCodigosLer((prev) => prev.filter((row) => row.id !== item.id))
      if (lerEditingId === item.id) resetLerForm()
      setLerNotice('Código LER removido.')
    } catch (err) {
      setLerError(err instanceof Error ? err.message : 'Não foi possível remover o código LER.')
    } finally {
      setLerBusyId(null)
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
            Morada do armazém, códigos LER e estados auxiliares (físico, pedido, resíduo).
          </p>
        </header>

        <div className="definicoes__scroll">
          <form className="definicoes__card" onSubmit={handleSaveArmazem} noValidate>
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
                {submitting ? 'A guardar…' : 'Guardar armazém'}
              </button>
            </section>
          </form>

          <section className="definicoes__card" aria-labelledby="definicoes-ler-title">
            <h2 id="definicoes-ler-title" className="definicoes__section-title">
              Códigos LER
            </h2>
            <p className="definicoes__section-help">
              Tabela auxiliar para o multiselect na recolha do operador.
            </p>

            {lerLoading ? (
              <p className="definicoes__ler-status" role="status">
                A carregar códigos LER…
              </p>
            ) : null}

            {!lerLoading && codigosLer.length === 0 ? (
              <p className="definicoes__ler-status">Ainda não existem códigos LER.</p>
            ) : null}

            {!lerLoading && codigosLer.length > 0 ? (
              <ul className="definicoes__ler-list">
                {codigosLer.map((item) => (
                  <li
                    key={item.id}
                    className={`definicoes__ler-item${lerEditingId === item.id ? ' definicoes__ler-item--editing' : ''}`}
                  >
                    <div className="definicoes__ler-item-main">
                      <p className="definicoes__ler-codigo">{item.codigo}</p>
                      {item.descricao ? (
                        <p className="definicoes__ler-desc">{item.descricao}</p>
                      ) : null}
                    </div>
                    <div className="definicoes__ler-item-actions">
                      <button
                        type="button"
                        className="definicoes__ler-edit"
                        aria-label={`Editar código ${item.codigo}`}
                        disabled={lerBusyId === item.id || lerSaving}
                        onClick={() => startEditCodigoLer(item)}
                      >
                        <FontAwesomeIcon icon={faPen} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="definicoes__ler-delete"
                        aria-label={`Remover código ${item.codigo}`}
                        disabled={lerBusyId === item.id || lerSaving}
                        onClick={() => handleDeleteCodigoLer(item)}
                      >
                        <FontAwesomeIcon icon={faTrash} aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            <form className="definicoes__ler-form" onSubmit={handleSaveCodigoLer} noValidate>
              <p className="definicoes__ler-form-title">
                {lerEditingId ? 'Editar código LER' : 'Adicionar código LER'}
              </p>
              <label className="definicoes__field">
                <span className="definicoes__label">Código*</span>
                <input
                  type="text"
                  className="definicoes__input"
                  value={lerCodigo}
                  placeholder="Ex.: 20 03 01"
                  onChange={(e) => setLerCodigo(e.target.value)}
                  disabled={lerSaving}
                />
              </label>
              <label className="definicoes__field">
                <span className="definicoes__label">Descrição</span>
                <input
                  type="text"
                  className="definicoes__input"
                  value={lerDescricao}
                  placeholder="Opcional"
                  onChange={(e) => setLerDescricao(e.target.value)}
                  disabled={lerSaving}
                />
              </label>

              <div className="definicoes__ler-form-actions">
                {lerEditingId ? (
                  <button
                    type="button"
                    className="definicoes__ler-cancel-btn"
                    onClick={resetLerForm}
                    disabled={lerSaving}
                  >
                    <FontAwesomeIcon icon={faXmark} aria-hidden />
                    Cancelar
                  </button>
                ) : null}
                <button
                  type="submit"
                  className="definicoes__ler-add-btn"
                  disabled={lerSaving || !lerCodigo.trim()}
                >
                  <FontAwesomeIcon icon={lerEditingId ? faPen : faPlus} aria-hidden />
                  {lerSaving
                    ? lerEditingId
                      ? 'A guardar…'
                      : 'A adicionar…'
                    : lerEditingId
                      ? 'Guardar'
                      : 'Adicionar'}
                </button>
              </div>
            </form>

            {lerError ? (
              <p className="definicoes__form-error" role="alert">
                {lerError}
              </p>
            ) : null}
            {lerNotice ? (
              <p className="definicoes__notice" role="status">
                {lerNotice}
              </p>
            ) : null}
          </section>

          <DefinicoesEstadoAuxSection kind="fisico" />
          <DefinicoesEstadoAuxSection kind="pedido" />
          <DefinicoesEstadoAuxSection kind="residuo" />
        </div>
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
