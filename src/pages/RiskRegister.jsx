import { useNavigate } from 'react-router-dom'
import { riskData } from '../data/mockData'

export default function RiskRegister() {
  const navigate = useNavigate()
  const red = riskData.filter(r => r.rag === 'red').length
  const amber = riskData.filter(r => r.rag === 'amber').length
  const green = riskData.filter(r => r.rag === 'green').length

  return (
    <>
      <div className="page-header"><h2>Risk register</h2></div>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-num red">{red}</div><div className="stat-label">Red — action needed</div></div>
        <div className="stat-card"><div className="stat-num amber">{amber}</div><div className="stat-label">Amber — in review</div></div>
        <div className="stat-card"><div className="stat-num green">{green}</div><div className="stat-label">Green — assured</div></div>
        <div className="stat-card"><div className="stat-num muted">3</div><div className="stat-label">Not yet assessed</div></div>
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr><th>Asset</th><th>Tier</th><th>Security</th><th>Compliance</th><th>Operational</th><th>Score</th><th>RAG</th></tr>
          </thead>
          <tbody>
            {riskData.map(r => (
              <tr key={r.id} className="clickable" onClick={() => navigate(`/assets/${r.id}`)}>
                <td><strong>{r.name}</strong></td>
                <td><span className={`tier-badge t${r.tier}`}>Tier {r.tier}</span></td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.security}</td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.compliance}</td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>{r.operational}</td>
                <td><strong>{r.score}</strong></td>
                <td>
                  <span className="score-pill">
                    <span className={`score-dot ${r.rag}`}></span>
                    {r.rag.charAt(0).toUpperCase() + r.rag.slice(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
