import './PageHeader.css'
import { IconMenu } from '../icons/icons.jsx'

export default function PageHeader({ userName, onMenuClick }) {
  return (
    <header className="page-header">
      <div className="page-header__brand" aria-hidden="true">
        <span className="page-header__logo" />
      </div>
      <p className="page-header__greeting">
        Olá <strong>{userName}</strong>
      </p>
      <button
        type="button"
        className="page-header__menu"
        aria-label="Abrir menu"
        onClick={onMenuClick}
      >
        <IconMenu className="page-header__menu-icon" />
      </button>
    </header>
  )
}
