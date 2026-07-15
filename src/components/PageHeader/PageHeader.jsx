import './PageHeader.css'
import { IconMenu } from '../icons/icons.jsx'

export default function PageHeader({
  userName,
  onMenuClick,
  onLogoClick,
  variant = 'default',
  logoSrc,
  menuOpen = false,
  menuAriaControls = 'operator-drawer-panel',
}) {
  const isFloating = variant === 'floating'
  const brandContent = logoSrc ? (
    <img src={logoSrc} alt="Logo" className="page-header__logo-img" width={40} height={40} />
  ) : (
    <span className="page-header__logo" />
  )

  return (
    <header className={`page-header${isFloating ? ' page-header--floating' : ''}`}>
      {onLogoClick ? (
        <button
          type="button"
          className="page-header__brand page-header__brand--btn"
          aria-label="Ir para a dashboard"
          onClick={onLogoClick}
        >
          {brandContent}
        </button>
      ) : (
        <div className="page-header__brand" aria-hidden="true">
          {brandContent}
        </div>
      )}
      <p className="page-header__greeting">
        Olá <strong>{userName}</strong>
      </p>
      <button
        type="button"
        className="page-header__menu"
        aria-label="Abrir menu"
        aria-expanded={menuOpen}
        aria-controls={menuAriaControls}
        onClick={onMenuClick}
      >
        <IconMenu className="page-header__menu-icon" />
      </button>
    </header>
  )
}
