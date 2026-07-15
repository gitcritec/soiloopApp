import { useEffect, useState } from 'react'
import { faXmark } from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import TicketAttachmentModal from '../TicketAttachmentModal/TicketAttachmentModal.jsx'
import './MovimentoDetalheModal.css'

const ESTADO_LABEL = {
  concluido: 'Concluído',
  agendado: 'Agendado',
  pedido: 'Pedido',
  rejeitado: 'Rejeitado',
}

const TASK_LABEL = {
  entregar: 'Entrega',
  recolher: 'Recolha',
}

function MetaRow({ label, value }) {
  if (!value || value === '—') return null
  return (
    <div className="movimento-detalhe-modal__meta-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

/**
 * Detalhe de um movimento (histórico do contentor).
 */
export default function MovimentoDetalheModal({
  isOpen,
  onClose,
  item,
  loading = false,
  contentorCid = '',
}) {
  const [photoPreview, setPhotoPreview] = useState(null)

  useEffect(() => {
    if (!isOpen) setPhotoPreview(null)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return undefined
    function onKey(e) {
      if (e.key !== 'Escape') return
      if (photoPreview) setPhotoPreview(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose, photoPreview])

  if (!isOpen) return null

  const taskLabel = TASK_LABEL[item?.taskType] ?? item?.taskType ?? 'Movimento'
  const estadoLabel = ESTADO_LABEL[item?.estadoKey] ?? item?.estado ?? '—'
  const cid =
    item?.contentorId && item.contentorId !== 'Não definido' ? item.contentorId : contentorCid
  const scheduledAt = item?.historicoScheduledAt || item?.scheduledAt || '—'

  return (
    <>
    <div className="movimento-detalhe-modal" role="presentation">
      <button
        type="button"
        className="movimento-detalhe-modal__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        className="movimento-detalhe-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="movimento-detalhe-modal-title"
      >
        <button
          type="button"
          className="movimento-detalhe-modal__close"
          aria-label="Fechar"
          onClick={onClose}
        >
          <FontAwesomeIcon icon={faXmark} aria-hidden />
        </button>

        {loading ? (
          <p className="movimento-detalhe-modal__status" role="status">
            A carregar movimento…
          </p>
        ) : !item ? (
          <p className="movimento-detalhe-modal__status movimento-detalhe-modal__status--error" role="alert">
            Não foi possível carregar o movimento.
          </p>
        ) : (
          <div className="movimento-detalhe-modal__scroll">
            <header className="movimento-detalhe-modal__head">
              <h2 id="movimento-detalhe-modal-title" className="movimento-detalhe-modal__title">
                {taskLabel}
              </h2>
              <p className="movimento-detalhe-modal__subtitle">
                {cid ? `${cid} · ` : ''}
                {scheduledAt}
              </p>
            </header>

            <dl className="movimento-detalhe-modal__meta">
              <MetaRow label="Estado:" value={estadoLabel} />
              <MetaRow label="Cliente:" value={item.clientName} />
              <MetaRow label="Operador:" value={item.operadorName} />
              <MetaRow
                label="Localização:"
                value={item.locationDetail ?? item.location}
              />
              <MetaRow label="Período:" value={item.periodoLabel} />
              <MetaRow label="e-GAR:" value={item.egar} />
              <MetaRow label="Peso:" value={item.peso} />
              <MetaRow label="Estado do contentor:" value={item.estadoContentorLabel} />
            </dl>

            {item.observacoesCliente ? (
              <section className="movimento-detalhe-modal__section">
                <h3 className="movimento-detalhe-modal__section-title">Observações do cliente</h3>
                <p className="movimento-detalhe-modal__text">{item.observacoesCliente}</p>
              </section>
            ) : null}

            {item.observacaoOperador ? (
              <section className="movimento-detalhe-modal__section">
                <h3 className="movimento-detalhe-modal__section-title">Observação do operador</h3>
                <p className="movimento-detalhe-modal__text">{item.observacaoOperador}</p>
              </section>
            ) : null}

            {item.fotografias?.length > 0 ? (
              <section className="movimento-detalhe-modal__section">
                <h3 className="movimento-detalhe-modal__section-title">Fotografias</h3>
                <ul className="movimento-detalhe-modal__photos">
                  {item.fotografias.map((url, index) => (
                    <li key={url}>
                      <button
                        type="button"
                        className="movimento-detalhe-modal__photo-btn"
                        aria-label={`Ver fotografia ${index + 1}`}
                        onClick={() =>
                          setPhotoPreview({
                            url,
                            name: `Fotografia ${index + 1}`,
                          })
                        }
                      >
                        <img src={url} alt="" className="movimento-detalhe-modal__photo" loading="lazy" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>

    <TicketAttachmentModal
      isOpen={photoPreview != null}
      onClose={() => setPhotoPreview(null)}
      url={photoPreview?.url}
      name={photoPreview?.name}
      kind="image"
    />
    </>
  )
}
