import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faHandHoldingHeart,
  faLeaf,
  faRecycle,
  faRoad,
} from '@fortawesome/free-solid-svg-icons'
import './OperadorStatsSummary.css'

export default function OperadorStatsSummary({
  recolhasHoje,
  recolhasAgendadas,
  contentoresRecolhidos,
  kmPercorridos,
}) {
  return (
    <section className="operador-stats-summary" aria-labelledby="operador-stats-heading">
      <div className="operador-stats-summary__heading">
        <span className="operador-stats-summary__heading-icon" aria-hidden="true">
          <FontAwesomeIcon icon={faHandHoldingHeart} />
        </span>
        <h2 id="operador-stats-heading" className="operador-stats-summary__heading-text">
          <span className="operador-stats-summary__heading-line1">O planeta agradece</span>
          <span className="operador-stats-summary__heading-line2">o seu contributo</span>
        </h2>
      </div>
      <div className="operador-stats-summary__panel">
        <div className="operador-stats-summary__grid">
          <div className="operador-stats-summary__tile operador-stats-summary__tile--orange">
            <FontAwesomeIcon icon={faRecycle} className="operador-stats-summary__tile-fa" aria-hidden />
            <p className="operador-stats-summary__tile-value">{recolhasHoje}</p>
            <div className="operador-stats-summary__tile-label">
              <span className="operador-stats-summary__tile-label-strong">Recolhas</span>
              <span>hoje</span>
            </div>
          </div>
          <div className="operador-stats-summary__tile operador-stats-summary__tile--grey">
            <FontAwesomeIcon icon={faRecycle} className="operador-stats-summary__tile-fa" aria-hidden />
            <p className="operador-stats-summary__tile-value">{recolhasAgendadas}</p>
            <div className="operador-stats-summary__tile-label">
              <span className="operador-stats-summary__tile-label-strong">Recolhas</span>
              <span>agendadas</span>
            </div>
          </div>
          <div className="operador-stats-summary__tile operador-stats-summary__tile--green">
            <FontAwesomeIcon icon={faLeaf} className="operador-stats-summary__tile-fa" aria-hidden />
            <p className="operador-stats-summary__tile-value">{contentoresRecolhidos}</p>
            <div className="operador-stats-summary__tile-label operador-stats-summary__tile-label--green-stack">
              <span className="operador-stats-summary__tile-line-reg">Contentores</span>
              <span className="operador-stats-summary__tile-line-bold">recolhidos</span>
            </div>
          </div>
          <div className="operador-stats-summary__tile operador-stats-summary__tile--yellow">
            <FontAwesomeIcon icon={faRoad} className="operador-stats-summary__tile-fa" aria-hidden />
            <p className="operador-stats-summary__tile-value">
              {kmPercorridos} <span className="operador-stats-summary__tile-value-suffix">Km</span>
            </p>
            <div className="operador-stats-summary__tile-label">
              <span className="operador-stats-summary__tile-label-strong">Percorridos</span>
              <span>hoje</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
