import { useCallback, useEffect, useState } from 'react'
import { faArrowLeft, faPen } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import ContentorCard from '../../../../components/ContentorCard/ContentorCard.jsx'
import ContentorQrModal from '../../../../components/ContentorQrModal/ContentorQrModal.jsx'
import { fetchStrapiContentorByCid } from '../../../../lib/strapiContentores.js'
import { fetchStrapiClienteDetail } from '../../../../lib/strapiClientes.js'
import { fetchStrapiClienteContentoresInstaladosPorCliente } from '../../../../lib/strapiMovimentos.js'
import './ClienteDetalhe.css'

function formatNif(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return '—'
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ').trim()
}

function parseLitrosFromLabel(label) {
  const match = String(label ?? '').match(/(\d+)/)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) ? n : null
}

/**
 * Detalhe do cliente (Figma 21:1281).
 * @param {object} props
 * @param {string} props.clienteId
 * @param {() => void} props.onBack
 * @param {(cliente: object) => void} props.onEdit
 * @param {(contentorId: string) => void} [props.onViewContentor]
 */
export default function ClienteDetalhe({ clienteId, onBack, onEdit, onViewContentor }) {
  const [cliente, setCliente] = useState(null)
  const [contentores, setContentores] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [qrPreview, setQrPreview] = useState(null)

  const loadDetail = useCallback(() => {
    if (!clienteId) return Promise.resolve()
    setLoading(true)
    setLoadError(null)
    return fetchStrapiClienteDetail(clienteId)
      .then(async (detail) => {
        if (!detail) {
          setLoadError('Cliente não encontrado.')
          setCliente(null)
          setContentores([])
          return
        }
        const rows = await fetchStrapiClienteContentoresInstaladosPorCliente(detail)
        setCliente(detail)
        setContentores(rows)
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar o cliente.')
        setCliente(null)
        setContentores([])
      })
      .finally(() => {
        setLoading(false)
      })
  }, [clienteId])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  async function openQr(cid) {
    const code = String(cid ?? '').trim()
    if (!code) return
    try {
      const item = await fetchStrapiContentorByCid(code)
      setQrPreview({ cid: code, qrcodeImageUrl: item?.qrcodeUrl ?? '' })
    } catch {
      setQrPreview({ cid: code, qrcodeImageUrl: '' })
    }
  }

  if (loading) {
    return (
      <div className="cliente-detalhe">
        <p className="cliente-detalhe__status" role="status">
          A carregar cliente…
        </p>
      </div>
    )
  }

  if (loadError || !cliente) {
    return (
      <div className="cliente-detalhe">
        <button type="button" className="cliente-detalhe__back" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft} className="cliente-detalhe__back-icon" aria-hidden />
          Voltar à lista
        </button>
        <p className="cliente-detalhe__status cliente-detalhe__status--error" role="alert">
          {loadError ?? 'Cliente não encontrado.'}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="cliente-detalhe">
        <button type="button" className="cliente-detalhe__back" onClick={onBack}>
          <FontAwesomeIcon icon={faArrowLeft} className="cliente-detalhe__back-icon" aria-hidden />
          Voltar à lista
        </button>

        <div className="cliente-detalhe__card">
          <div className="cliente-detalhe__scroll">
            <header className="cliente-detalhe__head">
              <h1 className="cliente-detalhe__nome">{cliente.nome}</h1>
              <button
                type="button"
                className="cliente-detalhe__edit"
                aria-label="Editar cliente"
                onClick={() => onEdit?.(cliente)}
              >
                <FontAwesomeIcon icon={faPen} aria-hidden />
              </button>
            </header>

            <dl className="cliente-detalhe__meta">
              <div className="cliente-detalhe__meta-row">
                <dt>ID:</dt>
                <dd>{cliente.cliCode ?? '—'}</dd>
              </div>
              <div className="cliente-detalhe__meta-row">
                <dt>NIF:</dt>
                <dd>{formatNif(cliente.nif)}</dd>
              </div>
            </dl>

            <section className="cliente-detalhe__section" aria-labelledby="cliente-detalhe-loc-title">
              <h2 id="cliente-detalhe-loc-title" className="cliente-detalhe__section-title">
                Localizações
              </h2>
              {cliente.localizacoes?.length > 0 ? (
                <ul className="cliente-detalhe__loc-list">
                  {cliente.localizacoes.map((loc) => (
                    <li key={loc.strapiId ?? loc.morada ?? loc.nome}>
                      {loc.nome ?? loc.morada ?? '—'}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="cliente-detalhe__empty">Sem localizações registadas.</p>
              )}
            </section>

            <section className="cliente-detalhe__section" aria-labelledby="cliente-detalhe-cnt-title">
              <h2 id="cliente-detalhe-cnt-title" className="cliente-detalhe__section-title">
                Contentores
              </h2>
              {contentores.length > 0 ? (
                <ul className="cliente-detalhe__contentores">
                  {contentores.map((item) => {
                    const loc = item.locationDetail ?? item.location ?? '—'
                    return (
                      <li key={item.movimentoKey ?? item.id}>
                        <ContentorCard
                          cid={item.id}
                          litros={parseLitrosFromLabel(item.litrosLabel)}
                          localizacao={loc}
                          cliente={cliente.nome}
                          situacao="cliente"
                          situacaoLabel="Cliente"
                          estado="usado"
                          estadoLabel={item.estadoLabel ?? 'Reutilizável'}
                          onViewClick={() => {
                            const contentorId = item.contentorStrapiId ?? item.id
                            if (contentorId) onViewContentor?.(contentorId)
                          }}
                          onScanClick={() => openQr(item.id)}
                        />
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="cliente-detalhe__empty">Este cliente não tem contentores instalados.</p>
              )}
            </section>
          </div>
        </div>
      </div>

      <ContentorQrModal
        isOpen={Boolean(qrPreview)}
        cid={qrPreview?.cid ?? ''}
        qrcodeImageUrl={qrPreview?.qrcodeImageUrl ?? ''}
        onClose={() => setQrPreview(null)}
      />
    </>
  )
}
