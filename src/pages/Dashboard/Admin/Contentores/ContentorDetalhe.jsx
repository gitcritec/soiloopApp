import { useCallback, useEffect, useState } from 'react'
import { faArrowLeft, faLocationDot, faPen } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import CollectionCard from '../../../../components/CollectionCard/CollectionCard.jsx'
import ContentorQrModal from '../../../../components/ContentorQrModal/ContentorQrModal.jsx'
import LocationMapModal from '../../../../components/LocationMapModal/LocationMapModal.jsx'
import MovimentoDetalheModal from '../../../../components/MovimentoDetalheModal/MovimentoDetalheModal.jsx'
import { contentorCardBadges, formatContentorQrLabel } from '../../../../components/ContentorCard/contentorBadge.js'
import { IconContentor } from '../../../../components/icons/icons.jsx'
import { formatLocationQuery } from '../../../../lib/locationQuery.js'
import {
  resolveLocationLabelForContentor,
  resolveMapLocationForContentor,
} from '../../../../lib/resolveMapLocation.js'
import { fetchStrapiContentorById } from '../../../../lib/strapiContentores.js'
import {
  fetchStrapiContentorMovimentosHistorico,
  fetchStrapiMovimentoDetalhe,
  sortMovimentosHistoricoDesc,
} from '../../../../lib/strapiMovimentos.js'
import './ContentorDetalhe.css'

const ESTADO_LABEL = {
  concluido: 'Concluído',
  agendado: 'Agendado',
  pedido: 'Pedido',
  rejeitado: 'Rejeitado',
}

function movimentoCardStatus(item) {
  if (item.estadoKey === 'concluido') return 'finalizado'
  return item.status ?? 'agendada'
}

function movimentoCardScheduledAt(item) {
  if (item.estadoKey === 'concluido') {
    return item.historicoScheduledAt || item.scheduledAt
  }
  return item.scheduledAt || item.historicoScheduledAt
}

/**
 * Detalhe do contentor (Figma 20:473).
 * @param {object} props
 * @param {string} props.contentorId
 * @param {() => void} props.onBack
 * @param {(contentor: object) => void} [props.onEdit]
 */
export default function ContentorDetalhe({ contentorId, onBack, onEdit }) {
  const [contentor, setContentor] = useState(null)
  const [historico, setHistorico] = useState([])
  const [loading, setLoading] = useState(true)
  const [historicoLoading, setHistoricoLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [historicoError, setHistoricoError] = useState(null)
  const [qrPreview, setQrPreview] = useState(false)
  const [locationMap, setLocationMap] = useState(null)
  const [locationLabel, setLocationLabel] = useState('—')
  const [mapFields, setMapFields] = useState(null)
  const [movimentoDetalhe, setMovimentoDetalhe] = useState(null)
  const [movimentoDetalheOpen, setMovimentoDetalheOpen] = useState(false)
  const [movimentoDetalheLoading, setMovimentoDetalheLoading] = useState(false)

  const loadDetail = useCallback(() => {
    if (!contentorId) return Promise.resolve()
    setLoading(true)
    setLoadError(null)
    return fetchStrapiContentorById(contentorId)
      .then(async (detail) => {
        if (!detail) {
          setLoadError('Contentor não encontrado.')
          setContentor(null)
          setHistorico([])
          setHistoricoError(null)
          return
        }
        setContentor(detail)
        setHistorico([])
        setHistoricoError(null)
        setHistoricoLoading(true)
        try {
          const rows = await fetchStrapiContentorMovimentosHistorico(detail.id, detail.cid)
          setHistorico(sortMovimentosHistoricoDesc(rows))
        } catch (err) {
          setHistorico([])
          setHistoricoError(
            err instanceof Error ? err.message : 'Não foi possível carregar o histórico.',
          )
        } finally {
          setHistoricoLoading(false)
        }
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar o contentor.')
        setContentor(null)
        setHistorico([])
        setHistoricoError(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [contentorId])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  useEffect(() => {
    if (!contentor) {
      setLocationLabel('—')
      setMapFields(null)
      return
    }
    let cancelled = false
    Promise.all([
      resolveLocationLabelForContentor(contentor),
      resolveMapLocationForContentor(contentor),
    ]).then(([label, fields]) => {
      if (!cancelled) {
        setLocationLabel(label)
        setMapFields(fields)
      }
    })
    return () => {
      cancelled = true
    }
  }, [contentor])

  async function openMovimentoDetalhe(movimentoKey, previewItem = null) {
    const key = String(movimentoKey ?? '').trim()
    if (!key) return
    setMovimentoDetalheOpen(true)
    setMovimentoDetalhe(previewItem)
    setMovimentoDetalheLoading(true)
    try {
      const detail = await fetchStrapiMovimentoDetalhe(key)
      if (detail) setMovimentoDetalhe(detail)
    } finally {
      setMovimentoDetalheLoading(false)
    }
  }

  function closeMovimentoDetalhe() {
    setMovimentoDetalheOpen(false)
    setMovimentoDetalhe(null)
    setMovimentoDetalheLoading(false)
  }

  async function openLocationMap() {
    if (!contentor) return
    const fields = mapFields ?? (await resolveMapLocationForContentor(contentor))
    const query = formatLocationQuery(fields)
    if (!query) return
    setLocationMap({
      query,
      title: contentor.cid,
      subtitle: fields.locationDetail ?? fields.location ?? query,
    })
  }

  if (loading) {
    return (
      <div className="contentor-detalhe">
        <p className="contentor-detalhe__status" role="status">
          A carregar contentor…
        </p>
      </div>
    )
  }

  if (loadError || !contentor) {
    return (
      <div className="contentor-detalhe">
        <button type="button" className="contentor-detalhe__back" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft} className="contentor-detalhe__back-icon" aria-hidden />
          Voltar à lista
        </button>
        <p className="contentor-detalhe__status contentor-detalhe__status--error" role="alert">
          {loadError ?? 'Contentor não encontrado.'}
        </p>
      </div>
    )
  }

  const badges = contentorCardBadges(
    contentor.situacaoLabel,
    contentor.estadoLabel,
    contentor.situacao,
    contentor.estado,
  )
  const clienteLabel = contentor.clienteAtualNome?.trim() || '—'
  const hasMap = Boolean(mapFields && formatLocationQuery(mapFields))

  return (
    <>
      <div className="contentor-detalhe">
        <button type="button" className="contentor-detalhe__back" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft} className="contentor-detalhe__back-icon" aria-hidden />
          Voltar à lista
        </button>

        <div className="contentor-detalhe__card">
          <div className="contentor-detalhe__scroll">
            <header className="contentor-detalhe__head">
              <div className="contentor-detalhe__head-main">
                <IconContentor className="contentor-detalhe__icon" aria-hidden />
                <div className="contentor-detalhe__head-text">
                  <h1 className="contentor-detalhe__cid">{contentor.cid}</h1>
                  <p className="contentor-detalhe__specs">
                    <span>{formatContentorQrLabel(contentor.cid)}</span>
                    <span>{contentor.litrosLabel}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="contentor-detalhe__edit"
                aria-label="Editar contentor"
                onClick={() => onEdit?.(contentor)}
              >
                <FontAwesomeIcon icon={faPen} aria-hidden />
              </button>
            </header>

            <div className="contentor-detalhe__badges" aria-label="Estado do contentor">
              <span className={`contentor-detalhe__badge contentor-detalhe__badge--${badges.topVariant}`}>
                {badges.topText}
              </span>
              <span className={`contentor-detalhe__badge contentor-detalhe__badge--${badges.bottomVariant}`}>
                {badges.bottomText}
              </span>
            </div>

            <dl className="contentor-detalhe__meta">
              <div className="contentor-detalhe__meta-row">
                <dt>Situação:</dt>
                <dd>{contentor.situacaoLabel || '—'}</dd>
              </div>
              <div className="contentor-detalhe__meta-row">
                <dt>Data registo:</dt>
                <dd>{contentor.data || '—'}</dd>
              </div>
              <div className="contentor-detalhe__meta-row">
                <dt>Cliente atual:</dt>
                <dd>{clienteLabel}</dd>
              </div>
            </dl>

            <section className="contentor-detalhe__section" aria-labelledby="contentor-detalhe-loc-title">
              <h2 id="contentor-detalhe-loc-title" className="contentor-detalhe__section-title">
                Localização
              </h2>
              <p className="contentor-detalhe__loc-text">{locationLabel}</p>
              {hasMap ? (
                <button
                  type="button"
                  className="contentor-detalhe__map-btn"
                  onClick={openLocationMap}
                >
                  <FontAwesomeIcon icon={faLocationDot} aria-hidden />
                  Ver no mapa
                </button>
              ) : (
                <p className="contentor-detalhe__empty">
                  Sem coordenadas para o armazém. Define a morada em Definições (menu lateral).
                </p>
              )}
            </section>

            <section className="contentor-detalhe__section" aria-labelledby="contentor-detalhe-qr-title">
              <h2 id="contentor-detalhe-qr-title" className="contentor-detalhe__section-title">
                QR Code
              </h2>
              <button
                type="button"
                className="contentor-detalhe__qr-btn"
                onClick={() => setQrPreview(true)}
              >
                Ver QR code
              </button>
            </section>

            <section className="contentor-detalhe__section" aria-labelledby="contentor-detalhe-hist-title">
              <h2 id="contentor-detalhe-hist-title" className="contentor-detalhe__section-title">
                Histórico
              </h2>
              {historicoLoading ? (
                <p className="contentor-detalhe__empty" role="status">
                  A carregar histórico…
                </p>
              ) : historicoError ? (
                <p className="contentor-detalhe__empty contentor-detalhe__status--error" role="alert">
                  {historicoError}
                </p>
              ) : historico.length > 0 ? (
                <ul className="contentor-detalhe__historico">
                  {historico.map((item) => {
                    const collectionId =
                      item.contentorId && item.contentorId !== 'Não definido'
                        ? item.contentorId
                        : contentor.cid
                    return (
                      <li key={item.movimentoKey ?? `${item.taskType}-${item.dataIso}-${item.clienteId}`}>
                        <button
                          type="button"
                          className="contentor-detalhe__hist-pick"
                          aria-label={`Ver detalhe do movimento ${collectionId}`}
                          onClick={() => openMovimentoDetalhe(item.movimentoKey, item)}
                        >
                          <CollectionCard
                            collectionId={collectionId}
                            location={item.locationDetail ?? item.location ?? '—'}
                            locationPrefix={item.locationPrefix}
                            locationDetail={item.locationDetail}
                            status={movimentoCardStatus(item)}
                            scheduledAt={movimentoCardScheduledAt(item)}
                            binNumber={item.binNumber}
                            taskType={item.taskType === 'entregar' ? 'entregar' : 'recolher'}
                            clientName={item.clientName}
                            showEdit={false}
                            showDelete={false}
                            showFullDateTime={item.estadoKey === 'concluido'}
                            badgeLabel={ESTADO_LABEL[item.estadoKey] ?? item.estado ?? 'Movimento'}
                          />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="contentor-detalhe__empty">Ainda não há movimentos registados para este contentor.</p>
              )}
            </section>
          </div>
        </div>
      </div>

      <ContentorQrModal
        isOpen={qrPreview}
        cid={contentor.cid}
        qrcodeImageUrl={contentor.qrcodeUrl ?? ''}
        onClose={() => setQrPreview(false)}
      />

      <LocationMapModal
        isOpen={Boolean(locationMap)}
        query={locationMap?.query ?? ''}
        title={locationMap?.title}
        subtitle={locationMap?.subtitle}
        onClose={() => setLocationMap(null)}
      />

      <MovimentoDetalheModal
        isOpen={movimentoDetalheOpen}
        item={movimentoDetalhe}
        loading={movimentoDetalheLoading}
        contentorCid={contentor.cid}
        onClose={closeMovimentoDetalhe}
      />
    </>
  )
}
