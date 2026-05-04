import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getOrgId } from '../lib/auth'
import AssetLogo from '../components/AssetLogo'

const auditIcon = { created: '✦', updated: '✎', deleted: '✕' }
const auditColor = { created: 'var(--green)', updated: 'var(--amber)', deleted: 'var(--red)' }
const auditBg = { created: '#EAF3DE', updated: '#FAEEDA', deleted: '#FAECE7' }

export default function AuditLog() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function fetchLogs() {
      const orgId = await getOrgId()
      const { data } = await supabase.from('asset_audit_log').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
      setLogs(data || [])
      setLoading(false)
    }
    fetchLogs()
  }, [])

  const filtered = logs.filter(l => {
    if (actionFilter !== 'all' && l.action !== actionFilter) return false
    if (search && !l.asset_name?.toLowerCase().includes(search.toLowerCase()) && !l.performed_by?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const counts = { created: logs.filter(l => l.action === 'created').length, updated: logs.filter(l => l.action === 'updated').length, deleted: logs.filter(l => l.action === 'deleted').length }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div>

  return (
    <>
      <div className="page-header"><h2>Audit log</h2></div>
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: '1.5rem' }}>
        <div className="stat-card"><div className="stat-num green">{counts.created}</div><div className="stat-label">Assets added</div></div>
        <div className="stat-card"><div className="stat-num amber">{counts.updated}</div><div className="stat-label">Assets updated</div></div>
        <div className="stat-card"><div className="stat-num red">{counts.deleted}</div><div className="stat-label">Assets deleted</div></div>
      </div>
      <div className="card">
        <div className="filter-row" style={{ marginBottom: 16 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by asset or user..."
            style={{ padding: '6px 10px', border: '0.5px solid rgba(44,31,14,0.2)', borderRadius: 6, fontSize: 13, background: '#fff', outline: 'none', fontFamily: 'inherit', minWidth: 200 }} />
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
            <option value="all">All actions</option><option value="created">Created</option><option value="updated">Updated</option><option value="deleted">Deleted</option>
          </select>
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)', fontSize: 13 }}>No audit events yet.</div>
        ) : filtered.map((entry, i) => (
          <div key={entry.id} style={{ display: 'flex', gap: 14, paddingBottom: 16, marginBottom: 16, borderBottom: i < filtered.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: auditBg[entry.action], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: auditColor[entry.action], flexShrink: 0, marginTop: 2 }}>
              {auditIcon[entry.action]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                <AssetLogo assetName={entry.asset_name} size={20} />
                <span style={{ fontSize: 13, fontWeight: 500, cursor: entry.asset_id ? 'pointer' : 'default' }} onClick={() => entry.asset_id && navigate(`/assets/${entry.asset_id}`)}>
                  {entry.asset_name}
                </span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 500, background: auditBg[entry.action], color: auditColor[entry.action], textTransform: 'capitalize' }}>{entry.action}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>by {entry.performed_by}</span>
                <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{new Date(entry.created_at).toLocaleString()}</span>
              </div>
              {entry.reason && <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 10px', background: 'var(--cream)', borderRadius: 6, lineHeight: 1.5 }}>{entry.reason}</div>}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
