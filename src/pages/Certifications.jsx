import { certifications } from '../data/mockData'

export default function Certifications() {
  return (
    <>
      <div className="page-header"><h2>Certifications</h2></div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr><th>Asset</th><th>Certification</th><th>Status</th><th>Expiry</th><th>Scope coverage</th><th>Sufficiency</th></tr>
          </thead>
          <tbody>
            {certifications.map((c, i) => (
              <tr key={i}>
                <td><strong>{c.asset}</strong></td>
                <td>{c.cert}</td>
                <td className={`cert-status ${c.status}`}>{c.statusLabel}</td>
                <td style={{ fontSize: 12, color: c.status === 'expired' ? 'var(--red)' : 'var(--muted)' }}>{c.expiry}</td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>{c.scope}</td>
                <td>
                  <span className="score-pill">
                    <span className={`score-dot ${c.sufficiency}`}></span>
                    {c.sufficiencyLabel}
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
