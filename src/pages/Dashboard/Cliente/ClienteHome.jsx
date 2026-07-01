import { faComments } from '@fortawesome/pro-light-svg-icons'
import SectionTitleWithIcon from '../../../components/SectionTitleWithIcon/SectionTitleWithIcon.jsx'
import './ClienteHome.css'

/** Dashboard cliente (resumo). */
export default function ClienteHome() {
  return (
    <div className="cliente-home">
      <section className="cliente-home__section" aria-labelledby="sec-cliente-tickets">
        <SectionTitleWithIcon
          id="sec-cliente-tickets"
          title="Os seus tickets"
          icon={faComments}
          iconSize="large"
        />
        <p className="cliente-home__hint">
          Consulte o separador <strong>Tickets</strong> para ver pedidos de suporte ou abrir um novo.
        </p>
      </section>
    </div>
  )
}
