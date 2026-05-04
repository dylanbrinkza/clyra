import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getOrgId } from '../lib/auth'

export default function Certifications() {
  const [certs, setCerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchCerts() {
      const orgId = await getOrgId()
      const { data } = await supabase.from('certifications').select('*').eq('org_id', orgId)
      setCerts(data || [])
      setLoading(false)
    }
    fetchCerts()
  }, [])

  if (loading) return <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div>

  return (
    <>
      <div className="page-header"><h2>Certifications</h2></div>
      <div className="card">
        {certs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: 13 }}>No certifications yet.</div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Asset</th><th>Certification</th><th>Status</th><th>Expiry</th><th>Scope</th><th>Sufficiency</th></tr></thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.asset}</strong></td>
                  <td>{c.cert}</td>
                  <td className={`cert-status ${c.status}`}>{c.status_label}</td>
                  <td style={{ fontSize: 12, color: c.status === 'expired' ? 'var(--red)' : 'var(--muted)' }}>{c.expiry}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{c.scope}</td>
                  <td><span className="score-pill"><span className={`score-dot ${c.sufficiency}`}></span>{c.sufficiency_label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
