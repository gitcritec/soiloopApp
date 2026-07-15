import {
  faCircleInfo,
  faComments,
  faHouseChimney,
  faPowerOff,
  faRecycle,
  faUser,
  faXmark,
} from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect } from 'react'
import { IconContentor } from '../../../components/icons/icons.jsx'
import '../../../components/OperatorDrawerMenu/OperatorDrawerMenu.css'

/** Menu lateral cliente (mesmo layout do operador). */
export default function ClienteDrawerMenu({
  isOpen,
  onClose,
  userName,
  userRole,
  avatarSrc,
  onLogout,
  onNavigate,
}) {
  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  function handlePrimaryClick(id) {
    onClose()
    onNavigate?.(id)
  }

  return (
    <div
      className={`operator-drawer${isOpen ? ' operator-drawer--open' : ''}`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        className="operator-drawer__backdrop"
        aria-label="Fechar menu"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        id="cliente-drawer-panel"
        className="operator-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cliente-drawer-user-name"
      >
        <div className="operator-drawer__head">
          <div className="operator-drawer__user">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="operator-drawer__avatar" width={40} height={40} />
            ) : (
              <span className="operator-drawer__avatar operator-drawer__avatar--placeholder" aria-hidden />
            )}
            <div className="operator-drawer__user-text">
              <p id="cliente-drawer-user-name" className="operator-drawer__name">
                {userName}
              </p>
              <p className="operator-drawer__role">{userRole}</p>
            </div>
          </div>
          <button type="button" className="operator-drawer__close" aria-label="Fechar menu" onClick={onClose}>
            <FontAwesomeIcon icon={faXmark} className="operator-drawer__close-icon" aria-hidden />
          </button>
        </div>

        <nav className="operator-drawer__nav" aria-label="Navegação principal">
          <button type="button" className="operator-drawer__item" onClick={() => handlePrimaryClick('pedidos')}>
            <span className="operator-drawer__item-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faRecycle} />
            </span>
            <span className="operator-drawer__item-label">Pedidos</span>
          </button>
          <button type="button" className="operator-drawer__item" onClick={() => handlePrimaryClick('contentores')}>
            <span className="operator-drawer__item-icon" aria-hidden="true">
              <IconContentor className="operator-drawer__item-icon-svg" />
            </span>
            <span className="operator-drawer__item-label">Contentores</span>
          </button>
          <button type="button" className="operator-drawer__item" onClick={() => handlePrimaryClick('gestao')}>
            <span className="operator-drawer__item-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faHouseChimney} />
            </span>
            <span className="operator-drawer__item-label">Dashboard</span>
          </button>
          <button type="button" className="operator-drawer__item" onClick={() => handlePrimaryClick('tickets')}>
            <span className="operator-drawer__item-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faComments} />
            </span>
            <span className="operator-drawer__item-label">Tickets</span>
          </button>
        </nav>

        <nav className="operator-drawer__nav operator-drawer__nav--secondary" aria-label="Conta e sessão">
          <button type="button" className="operator-drawer__item" onClick={() => { onClose(); onNavigate?.('perfil') }}>
            <span className="operator-drawer__item-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faUser} />
            </span>
            <span className="operator-drawer__item-label">Perfil</span>
          </button>
          <button type="button" className="operator-drawer__item" onClick={() => { onClose(); onNavigate?.('ajuda') }}>
            <span className="operator-drawer__item-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faCircleInfo} />
            </span>
            <span className="operator-drawer__item-label">Ajuda</span>
          </button>
          <button
            type="button"
            className="operator-drawer__item"
            onClick={() => {
              onClose()
              onLogout()
            }}
          >
            <span className="operator-drawer__item-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faPowerOff} />
            </span>
            <span className="operator-drawer__item-label">Sair</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
