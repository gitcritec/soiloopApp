import './Dashboard.css'

export default function Dashboard({ onLogout }) {
  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1 className="dashboard-title">Dashboard</h1>
        {onLogout ? (
          <button type="button" className="dashboard-logout" onClick={onLogout}>
            Sair
          </button>
        ) : null}
      </header>
      <p className="dashboard-placeholder">Área principal da aplicação (em construção).</p>
    </div>
  )
}
