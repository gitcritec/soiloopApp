import { useCallback, useEffect, useState } from 'react'
import { faChevronDown, faClipboardCheck } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import SectionTitleWithIcon from '../../../../components/SectionTitleWithIcon/SectionTitleWithIcon.jsx'
import { IconContentor } from '../../../../components/icons/icons.jsx'
import { fetchStrapiContentoresArmazemSemAvaliacaoResiduo } from '../../../../lib/strapiContentores.js'
import { fetchStrapiEstadosResiduo } from '../../../../lib/strapiEstadosAuxiliares.js'
import { avaliarStrapiOperadorResiduo } from '../../../../lib/strapiMovimentos.js'
import './AvaliarResiduos.css'

/**
 * Contentores no armazém à espera de avaliação de resíduo pelo operador.
 */
export default function AvaliarResiduos() {
  const [items, setItems] = useState([])
  const [estadosResiduo, setEstadosResiduo] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedCid, setSelectedCid] = useState(null)
  const [estadoResiduoId, setEstadoResiduoId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const loadItems = useCallback(() => {
    setLoading(true)
    setError(false)
    return Promise.all([
      fetchStrapiContentoresArmazemSemAvaliacaoResiduo(),
      fetchStrapiEstadosResiduo(),
    ])
      .then(([rows, estados]) => {
        setItems(rows)
        setEstadosResiduo(estados)
      })
      .catch(() => {
        setItems([])
        setError(true)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  function openEvaluate(cid) {
    setSelectedCid(cid)
    setEstadoResiduoId('')
    setSubmitError('')
  }

  function closeEvaluate() {
    setSelectedCid(null)
    setEstadoResiduoId('')
    setSubmitError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!selectedCid || !estadoResiduoId || submitting) return

    setSubmitting(true)
    setSubmitError('')
    try {
      await avaliarStrapiOperadorResiduo({
        contentorId: selectedCid,
        estadoResiduoId,
      })
      closeEvaluate()
      await loadItems()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Não foi possível guardar a avaliação.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="operator-dashboard__section" aria-labelledby="operador-sec-avaliar">
      <SectionTitleWithIcon
        id="operador-sec-avaliar"
        title="Avaliar resíduos"
        icon={faClipboardCheck}
        iconSize="large"
        titleTone="swapped"
      />
      <p className="avaliar-residuos__intro">
        Contentores no armazém sem avaliação de resíduo. Pode avaliar no mesmo dia da recolha ou no dia
        seguinte.
      </p>

      <div className="operator-dashboard__cards">
        {loading ? (
          <p className="operator-dashboard__state" role="status">
            A carregar contentores…
          </p>
        ) : null}
        {!loading && error ? (
          <p className="operator-dashboard__state" role="alert">
            Não foi possível carregar os contentores.
          </p>
        ) : null}
        {!loading && !error && items.length === 0 ? (
          <p className="operator-dashboard__state">Não há contentores à espera de avaliação.</p>
        ) : null}

        {!loading && !error
          ? items.map((item) => {
              const isOpen = selectedCid === item.cid
              return (
                <article
                  key={item.id || item.cid}
                  className={`avaliar-residuos__card${isOpen ? ' avaliar-residuos__card--open' : ''}`}
                >
                  <div className="avaliar-residuos__card-main">
                    <div className="avaliar-residuos__icon" aria-hidden>
                      <IconContentor className="avaliar-residuos__icon-svg" />
                    </div>
                    <div className="avaliar-residuos__text">
                      <p className="avaliar-residuos__cid">{item.cid}</p>
                      <p className="avaliar-residuos__meta">
                        {item.estadoFisicoLabel || item.estadoLabel || '—'}
                        {item.litros != null ? ` · ${item.litros}L` : ''}
                      </p>
                      <p className="avaliar-residuos__loc">{item.localizacao || 'Armazém'}</p>
                    </div>
                    {!isOpen ? (
                      <button
                        type="button"
                        className="avaliar-residuos__action"
                        onClick={() => openEvaluate(item.cid)}
                      >
                        Avaliar
                      </button>
                    ) : null}
                  </div>

                  {isOpen ? (
                    <form className="avaliar-residuos__form" onSubmit={handleSubmit}>
                      <label className="avaliar-residuos__field">
                        <span className="avaliar-residuos__label">Estado do resíduo*</span>
                        <span className="avaliar-residuos__select-wrap">
                          <select
                            className={`avaliar-residuos__select${estadoResiduoId ? '' : ' avaliar-residuos__select--empty'}`}
                            value={estadoResiduoId}
                            onChange={(e) => setEstadoResiduoId(e.target.value)}
                            required
                            disabled={submitting}
                            aria-label="Estado do resíduo"
                          >
                            <option value="" disabled>
                              Selecionar
                            </option>
                            {estadosResiduo.map((estado) => (
                              <option key={estado.id} value={estado.id}>
                                {estado.nome}
                              </option>
                            ))}
                          </select>
                          <FontAwesomeIcon
                            icon={faChevronDown}
                            className="avaliar-residuos__select-icon"
                            aria-hidden
                          />
                        </span>
                      </label>

                      {submitError ? (
                        <p className="avaliar-residuos__error" role="alert">
                          {submitError}
                        </p>
                      ) : null}

                      <div className="avaliar-residuos__actions">
                        <button
                          type="submit"
                          className="avaliar-residuos__submit"
                          disabled={!estadoResiduoId || submitting}
                        >
                          {submitting ? 'A guardar…' : 'Confirmar'}
                        </button>
                        <button
                          type="button"
                          className="avaliar-residuos__cancel"
                          onClick={closeEvaluate}
                          disabled={submitting}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : null}
                </article>
              )
            })
          : null}
      </div>
    </section>
  )
}
