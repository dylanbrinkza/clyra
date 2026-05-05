import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getOrgId, getUserRole } from '../lib/auth'

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
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    getUserRole().then(r => setIsAdmin(r === 'admin' || r === 'org_admin'))
    async function fetch() {
      const orgId = await getOrgId()
      const { data, error } = await supabase
        .from('questionnaires')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
      if (!error) setQuestionnaires(data || [])
      setLoading(false)
    }
    fetch()
  }, [])

  if (loading) return <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div>

  const pendingApproval = questionnaires.filter(q => q.status === 'completed' && q.verdict && q.approval_status === 'pending')
  const others = questionnaires.filter(q => !(q.status === 'completed' && q.verdict && q.approval_status === 'pending'))

  const QRow = ({ q }) => (
    <tr className="clickable" onClick={() => navigate(`/questionnaires/${q.id}`)}>
      <td><div style={{ fontWeight: 500 }}>{q.asset_name}</div>{q.vendor_name && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{q.vendor_name}</div>}</td>
      <td><span className={`tier-badge t${q.tier}`}>Tier {q.tier}</span></td>
      <td style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'capitalize' }}>{q.status}</td>
      <td>{q.verdict ? <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 500, background: verdictBadge[q.verdict]?.bg, color: verdictBadge[q.verdict]?.color }}>{q.verdict}</span> : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}</td>
      <td>
        {q.approval_status === 'approved' && <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 500 }}>Approved</span>}
        {q.approval_status === 'rejected' && <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 500 }}>Rejected</span>}
        {q.approval_status === 'pending' && q.verdict && <span style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 500 }}>Awaiting review</span>}
        {(!q.approval_status || (q.approval_status === 'pending' && !q.verdict)) && <span style={{ fontSize: 11, color: 'var(--muted)' }}>—</span>}
      </td>
      <td style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(q.created_at).toLocaleDateString()}</td>
    </tr>
  )

  return (
    <>
      <div className="page-header">
        <h2>Questionnaires</h2>
        {isAdmin && <button className="btn btn-primary" onClick={() => navigate('/questionnaires/new')}>+ New questionnaire</button>}
      </div>
      {pendingApproval.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>● Pending your approval — {pendingApproval.length}</div>
          <div className="card" style={{ border: '1px solid #F0D080' }}>
            <table className="data-table"><thead><tr><th>Vendor</th><th>Tier</th><th>Status</th><th>Verdict</th><th>Approval</th><th>Created</th></tr></thead>
            <tbody>{pendingApproval.map(q => <QRow key={q.id} q={q} />)}</tbody></table>
          </div>
        </div>
      )}
      {others.length > 0 ? (
        <div className="card">
          <table className="data-table"><thead><tr><th>Vendor</th><th>Tier</th><th>Status</th><th>Verdict</th><th>Approval</th><th>Created</th></tr></thead>
          <tbody>{others.map(q => <QRow key={q.id} q={q} />)}</tbody></table>
        </div>
      ) : questionnaires.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
          <div style={{ fontSize: 14, marginBottom: 8 }}>No questionnaires yet</div>
          {isAdmin && <button className="btn btn-primary" onClick={() => navigate('/questionnaires/new')}>+ New questionnaire</button>}
        </div>
      )}
    </>
  )
}
