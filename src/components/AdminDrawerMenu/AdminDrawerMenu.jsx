import {
  faChartColumn,
  faCircleInfo,
  faComments,
  faGear,
  faPowerOff,
  faRecycle,
  faUsers,
  faXmark,
} from '@fortawesome/pro-light-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useEffect } from 'react'
import { IconContentor } from '../icons/icons.jsx'
import './AdminDrawerMenu.css'

/**
 * Menu lateral admin (Figma Admin - Menu, nó 10:447).
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {string} props.userName
 * @param {string} props.userRole
 * @param {string|null} [props.avatarSrc]
 * @param {() => void} props.onLogout
 * @param {(actionId: string) => void} [props.onNavigate]
 */
export default function AdminDrawerMenu({
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
      className={`admin-drawer${isOpen ? ' admin-drawer--open' : ''}`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        className="admin-drawer__backdrop"
        aria-label="Fechar menu"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        id="admin-drawer-panel"
        className="admin-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-drawer-user-name"
      >
        <div className="admin-drawer__head">
          <div className="admin-drawer__user">
            {avatarSrc ? (
              <img
                className="admin-drawer__avatar"
                src={avatarSrc}
                alt=""
                width={40}
                height={40}
              />
            ) : (
              <span className="admin-drawer__avatar admin-drawer__avatar--placeholder" />
            )}
            <div className="admin-drawer__user-text">
              <p className="admin-drawer__name" id="admin-drawer-user-name">
                {userName}
              </p>
              <p className="admin-drawer__role">{userRole}</p>
            </div>
          </div>
          <button
            type="button"
            className="admin-drawer__close"
            aria-label="Fechar menu"
            onClick={onClose}
          >
            <FontAwesomeIcon icon={faXmark} className="admin-drawer__close-icon" />
          </button>
        </div>

        <nav className="admin-drawer__nav admin-drawer__nav--primary" aria-label="Navegação principal">
          <button
            type="button"
            className="admin-drawer__item"
            onClick={() => handlePrimaryClick('clientes')}
          >
            <span className="admin-drawer__item-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faUsers} />
            </span>
            <span className="admin-drawer__item-label">Clientes</span>
          </button>
          <button
            type="button"
            className="admin-drawer__item"
            onClick={() => handlePrimaryClick('recolhas')}
          >
            <span className="admin-drawer__item-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faRecycle} />
            </span>
            <span className="admin-drawer__item-label">Recolhas</span>
          </button>
          <button
            type="button"
            className="admin-drawer__item"
            onClick={() => handlePrimaryClick('contentores')}
          >
            <span className="admin-drawer__item-icon" aria-hidden="true">
              <IconContentor className="admin-drawer__icon-contentor" />
            </span>
            <span className="admin-drawer__item-label">Contentores</span>
          </button>
          <button
            type="button"
            className="admin-drawer__item"
            onClick={() => handlePrimaryClick('tickets')}
          >
            <span className="admin-drawer__item-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faComments} />
            </span>
            <span className="admin-drawer__item-label">Tickets</span>
          </button>
          <button
            type="button"
            className="admin-drawer__item"
            onClick={() => handlePrimaryClick('gestao')}
          >
            <span className="admin-drawer__item-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faChartColumn} />
            </span>
            <span className="admin-drawer__item-label">Gestão</span>
          </button>
        </nav>

        <nav className="admin-drawer__nav admin-drawer__nav--secondary" aria-label="Conta e sessão">
          <button
            type="button"
            className="admin-drawer__item"
            onClick={() => {
              onClose()
              onNavigate?.('definicoes')
            }}
          >
            <span className="admin-drawer__item-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faGear} />
            </span>
            <span className="admin-drawer__item-label">Definições</span>
          </button>
          <button
            type="button"
            className="admin-drawer__item"
            onClick={() => {
              onClose()
              onNavigate?.('ajuda')
            }}
          >
            <span className="admin-drawer__item-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faCircleInfo} />
            </span>
            <span className="admin-drawer__item-label">Ajuda</span>
          </button>
          <button
            type="button"
            className="admin-drawer__item"
            onClick={() => {
              onClose()
              onLogout()
            }}
          >
            <span className="admin-drawer__item-icon" aria-hidden="true">
              <FontAwesomeIcon icon={faPowerOff} />
            </span>
            <span className="admin-drawer__item-label">Sair</span>
          </button>
        </nav>
      </div>
    </div>
  )
}
