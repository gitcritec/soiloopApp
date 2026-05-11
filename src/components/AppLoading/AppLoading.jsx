import './AppLoading.css'

/**
 * Ecrã de carregamento full-screen.
 * Assets: `/public/loading/loading_icon.png` (gira), `loading_text.png` (texto).
 */
export default function AppLoading() {
  return (
    <div
      className="app-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="A carregar"
    >
      <div className="app-loading__mark">
        <div className="app-loading__icon-wrap" aria-hidden="true">
          <img
            className="app-loading__icon"
            src="/loading/loading_icon.png"
            alt=""
          />
        </div>
        <img
          className="app-loading__text"
          src="/loading/loading_text.png"
          alt="soiloop"
        />
      </div>
    </div>
  )
}
