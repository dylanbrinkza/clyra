import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getOrgId } from '../lib/auth'

export default function Incidents() {
  const navigate = useNavigate()
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchIncidents() {
      const orgId = await getOrgId()
      const { data } = await supabase.from('incidents').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
      setIncidents(data || [])
      setLoading(false)
    }
    fetchIncidents()
  }, [])

  const ragColor = { active: 'red', resolved: 'green' }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div>

  return (
    <>
      <div className="page-header"><h2>Incidents</h2></div>
      <div className="card">
        {incidents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: 13 }}>No incidents recorded.</div>
        ) : incidents.map(inc => (
          <div key={inc.id} className="asset-row" onClick={() => navigate(`/incidents/${inc.id}`)}>
            <div className={`dot ${ragColor[inc.status] || 'gray'}`}></div>
            <div style={{ flex: 1 }}>
              <div className="asset-name">{inc.title}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{inc.asset} · {inc.triggered}</div>
            </div>
            <span className={`status-pill ${inc.status}`}>{inc.status.charAt(0).toUpperCase() + inc.status.slice(1)}</span>
          </div>
        ))}
      </div>
    </>
  )
}
