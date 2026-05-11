import {
  faArrowsRotate,
  faBell,
  faCircleInfo,
  faGear,
  faPowerOff,
  faRecycle,
  faClock,
  faXmark,
} from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect } from 'react'
import './OperatorDrawerMenu.css'

/**
 * Menu lateral operador (layout Figma node 228:6634).
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {string} props.userName
 * @param {string} props.userRole — texto do campo `role` do user (Strapi)
 * @param {string|null} [props.avatarSrc]
 * @param {() => void} props.onLogout
 * @param {(actionId: string) => void} [props.onNavigate]
 */
export default function OperatorDrawerMenu({
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
        id="operator-drawer-panel"
        className="operator-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="operator-drawer-user-name"
      >
        <div className="operator-drawer__head">
          <div className="operator-drawer__user">
            {avatarSrc ? (
              <img
                className="operator-drawer__avatar"
                src={avatarSrc}
                alt=""
                width={40}
                height={40}
              />
            ) : (
              <span className="operator-drawer__avatar operator-drawer__avatar--placeholder" />
            )}
            <div className="operator-drawer__user-text">
              <p className="operator-drawer__name" id="operator-drawer-user-name">
                {userName}
              </p>
              <p className="operator-drawer__role">{userRole}</p>
            </div>
          </div>
          <button
            type="button"
            className="operator-drawer__close"
            aria-label="Fechar menu"
            onClick={onClose}
          >
            <FontAwesomeIcon icon={faXmark} className="operator-drawer__close-icon" />
          </button>
        </div>

        <nav className="operator-drawer__nav operator-drawer__nav--primary" aria-label="Navegação principal">
          <button
            type="button"
            className="operator-drawer__item"
            onClick={() => handlePrimaryClick('notificacoes')}
          >
            <span className="operator-drawer__item-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faBell} />
            </span>
            <span className="operator-drawer__item-label">Notificações</span>
          </button>
          <button
            type="button"
            className="operator-drawer__item"
            onClick={() => handlePrimaryClick('recolhas')}
          >
            <span className="operator-drawer__item-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faRecycle} />
            </span>
            <span className="operator-drawer__item-label">Recolhas</span>
          </button>
          <button
            type="button"
            className="operator-drawer__item"
            onClick={() => handlePrimaryClick('movimentos')}
          >
            <span className="operator-drawer__item-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faArrowsRotate} />
            </span>
            <span className="operator-drawer__item-label">Movimentos</span>
          </button>
          <button
            type="button"
            className="operator-drawer__item"
            onClick={() => handlePrimaryClick('historico')}
          >
            <span className="operator-drawer__item-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faClock} />
            </span>
            <span className="operator-drawer__item-label">Histórico</span>
          </button>
        </nav>

        <nav className="operator-drawer__nav operator-drawer__nav--secondary" aria-label="Conta e sessão">
          <button
            type="button"
            className="operator-drawer__item"
            onClick={() => {
              onClose()
              onNavigate?.('definicoes')
            }}
          >
            <span className="operator-drawer__item-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faGear} />
            </span>
            <span className="operator-drawer__item-label">Definições</span>
          </button>
          <button
            type="button"
            className="operator-drawer__item"
            onClick={() => {
              onClose()
              onNavigate?.('ajuda')
            }}
          >
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
