import './FloatingPrimaryButton.css'

export default function FloatingPrimaryButton({ label, onClick, icon }) {
  return (
    <div className="floating-primary-button-wrap">
      <button type="button" className="floating-primary-button" onClick={onClick}>
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
