import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const statusColor = { draft: 'var(--muted)', sent: 'var(--amber)', completed: 'var(--green)' }
const verdictBadge = {
  'Accept': { bg: '#EAF3DE', color: 'var(--green)' },
  'Accept with conditions': { bg: '#FAEEDA', color: 'var(--amber)' },
  'Escalate for further review': { bg: '#FAEEDA', color: 'var(--amber)' },
  'Do not proceed': { bg: '#FAECE7', color: 'var(--red)' },
}

export default function Questionnaires() {
  const navigate = useNavigate()
  const [questionnaires, setQuestionnaires] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data, error } = await supabase
        .from('questionnaires')
        .select('*')
        .order('created_at', { ascending: false })
      if (!error) setQuestionnaires(data)
      setLoading(false)
    }
    fetch()
  }, [])

  const tierBadge = { 1: 't1', 2: 't2', 3: 't3', 4: 't4' }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div>

  return (
    <>
      <div className="page-header">
        <h2>Questionnaires</h2>
        <button className="btn btn-primary" onClick={() => navigate('/questionnaires/new')}>+ New questionnaire</button>
      </div>

      {questionnaires.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>No questionnaires yet</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Create your first vendor risk questionnaire to get started.</div>
          <button className="btn btn-primary" onClick={() => navigate('/questionnaires/new')}>+ New questionnaire</button>
        </div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr><th>Vendor</th><th>Tier</th><th>Status</th><th>Verdict</th><th>Questions</th><th>Created</th></tr>
            </thead>
            <tbody>
              {questionnaires.map(q => (
                <tr key={q.id} className="clickable" onClick={() => navigate(`/questionnaires/${q.id}`)}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{q.asset_name}</div>
                    {q.vendor_name && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{q.vendor_name}</div>}
                  </td>
                  <td><span className={`tier-badge ${tierBadge[q.tier]}`}>Tier {q.tier}</span></td>
                  <td style={{ fontSize: 12, color: statusColor[q.status], textTransform: 'capitalize' }}>{q.status}</td>
                  <td>
                    {q.verdict ? (
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 500, background: verdictBadge[q.verdict]?.bg, color: verdictBadge[q.verdict]?.color }}>
                        {q.verdict}
                      </span>
                    ) : <span style={{ color: 'var(--muted)', fontSize: 12 }}>Pending</span>}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{q.score || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(q.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
