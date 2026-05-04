import './BottomNav.css'

export default function BottomNav({ items, activeId, onSelect, ariaLabel = 'Navegação principal' }) {
  return (
    <nav className="bottom-nav" aria-label={ariaLabel}>
      <ul className="bottom-nav__list">
        {items.map(({ id, label, Icon }) => {
          const isActive = id === activeId
          return (
            <li key={id} className="bottom-nav__item">
              <button
                type="button"
                className={`bottom-nav__btn${isActive ? ' bottom-nav__btn--active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelect?.(id)}
              >
                <Icon className="bottom-nav__icon" />
                <span>{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
