import './PageHeader.css'
import { IconMenu } from '../icons/icons.jsx'

export default function PageHeader({
  userName,
  onMenuClick,
  variant = 'default',
  logoSrc,
  menuOpen = false,
}) {
  const isFloating = variant === 'floating'

  return (
    <header className={`page-header${isFloating ? ' page-header--floating' : ''}`}>
      <div className="page-header__brand" aria-hidden="true">
        {logoSrc ? (
          <img src={logoSrc} alt="Logo" className="page-header__logo-img" width={40} height={40} />
        ) : (
          <span className="page-header__logo" />
        )}
      </div>
      <p className="page-header__greeting">
        Olá <strong>{userName}</strong>
      </p>
      <button
        type="button"
        className="page-header__menu"
        aria-label="Abrir menu"
        aria-expanded={menuOpen}
        aria-controls="operator-drawer-panel"
        onClick={onMenuClick}
      >
        <IconMenu className="page-header__menu-icon" />
      </button>
    </header>
  )
}
