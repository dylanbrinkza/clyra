import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Certifications() {
  const [certs, setCerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCerts() {
      const { data, error } = await supabase.from('certifications').select('*')
      if (!error) setCerts(data)
      setLoading(false)
    }
    fetchCerts()
  }, [])

  if (loading) return <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div>

  return (
    <>
      <div className="page-header"><h2>Certifications</h2></div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr><th>Asset</th><th>Certification</th><th>Status</th><th>Expiry</th><th>Scope coverage</th><th>Sufficiency</th></tr>
          </thead>
          <tbody>
            {certs.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.asset}</strong></td>
                <td>{c.cert}</td>
                <td className={`cert-status ${c.status}`}>{c.status_label}</td>
                <td style={{ fontSize: 12, color: c.status === 'expired' ? 'var(--red)' : 'var(--muted)' }}>{c.expiry}</td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>{c.scope}</td>
                <td>
                  <span className="score-pill">
                    <span className={`score-dot ${c.sufficiency}`}></span>
                    {c.sufficiency_label}
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
