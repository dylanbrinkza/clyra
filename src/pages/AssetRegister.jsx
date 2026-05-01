import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AssetRegister() {
  const navigate = useNavigate()
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [tierFilter, setTierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  useEffect(() => {
    async function fetchAssets() {
      const { data, error } = await supabase.from('assets').select('*').order('tier')
      if (!error) setAssets(data)
      setLoading(false)
    }
    fetchAssets()
  }, [])

  const filtered = assets.filter(a => {
    if (tierFilter !== 'all' && a.tier !== parseInt(tierFilter)) return false
    if (typeFilter !== 'all' && a.type !== typeFilter) return false
    if (statusFilter !== 'all') {
      const s = (a.status || '').toLowerCase()
      if (statusFilter === 'overdue' && !s.includes('overdue') && !s.includes('expired')) return false
      if (statusFilter === 'assessment' && !s.includes('assessment')) return false
      if (statusFilter === 'awaiting' && !s.includes('awaiting')) return false
      if (statusFilter === 'assured' && !s.includes('assured')) return false
    }
    return true
  })

  if (loading) return <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div>

  return (
    <>
      <div className="page-header">
        <h2>Asset register</h2>
        <button className="btn btn-primary">+ Add asset</button>
      </div>
      <div className="card">
        <div className="filter-row">
          <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
            <option value="all">All tiers</option>
            <option value="1">Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
            <option value="4">Tier 4</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="overdue">Overdue / Expired</option>
            <option value="assessment">In assessment</option>
            <option value="awaiting">Awaiting response</option>
            <option value="assured">Assured</option>
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            <option value="SaaS">SaaS</option>
            <option value="Cloud infra">Cloud infra</option>
            <option value="Managed service">Managed service</option>
          </select>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Asset</th><th>Type</th><th>Tier</th><th>Status</th><th>RAG</th><th>Review due</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(asset => (
              <tr key={asset.id} className="clickable" onClick={() => navigate(`/assets/${asset.id}`)}>
                <td><strong>{asset.name}</strong></td>
                <td style={{ color: 'var(--muted)' }}>{asset.type}</td>
                <td><span className={`tier-badge t${asset.tier}`}>Tier {asset.tier}</span></td>
                <td className={`cert-status ${asset.rag === 'red' ? 'expired' : asset.rag === 'amber' ? 'caveat' : 'valid'}`}>{asset.status}</td>
                <td>
                  <span className="score-pill">
                    <span className={`score-dot ${asset.rag}`}></span>
                    {asset.rag.charAt(0).toUpperCase() + asset.rag.slice(1)}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>{asset.review_due}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
