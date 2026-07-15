import './FloatingPrimaryButton.css'

export default function FloatingPrimaryButton({ label, onClick, icon, variant = 'default', disabled = false }) {
  const isOperador = variant === 'operador'

  return (
    <div
      className={`floating-primary-button-wrap${isOperador ? ' floating-primary-button-wrap--operador' : ''}`}
    >
      <button
        type="button"
        className={`floating-primary-button${isOperador ? ' floating-primary-button--operador' : ''}`}
        onClick={onClick}
        disabled={disabled}
      >
        {icon ? (
          <span className="floating-primary-button__icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span>{label}</span>
      </button>
    </div>
  )
}
