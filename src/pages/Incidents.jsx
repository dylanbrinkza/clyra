import { useNavigate } from 'react-router-dom'
import { incidents } from '../data/mockData'

export default function Incidents() {
  const navigate = useNavigate()
  const ragColor = { active: 'red', resolved: 'green' }

  return (
    <>
      <div className="page-header"><h2>Incidents</h2></div>
      <div className="card">
        {incidents.map(inc => (
          <div key={inc.id} className="asset-row" onClick={() => navigate(`/incidents/${inc.id}`)}>
            <div className={`dot ${ragColor[inc.status] || 'gray'}`}></div>
            <div style={{ flex: 1 }}>
              <div className="asset-name">{inc.title}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{inc.asset} · {inc.triggered}</div>
            </div>
            <span className={`status-pill ${inc.status}`}>
              {inc.status.charAt(0).toUpperCase() + inc.status.slice(1)}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}
