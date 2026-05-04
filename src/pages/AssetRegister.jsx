import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AddAssetModal from '../components/AddAssetModal'
import AssetLogo from '../components/AssetLogo'

const qStatusColor = {
  'not sent': 'var(--muted)',
  'sent': 'var(--amber)',
  'submitted': '#185FA5',
  'evaluated': 'var(--green)',
}

export default function AssetRegister() {
  const navigate = useNavigate()
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [tierFilter, setTierFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => { fetchAssets() }, [])

  async function fetchAssets() {
    const { data, error } = await supabase.from('assets').select('*').order('tier')
    if (!error) setAssets(data)
    setLoading(false)
  }

  const filtered = assets.filter(a => {
    if (tierFilter !== 'all' && a.tier !== parseInt(tierFilter)) return false
    if (typeFilter !== 'all' && a.type !== typeFilter) return false
    if (statusFilter !== 'all') {
      const s = (a.questionnaire_status || '').toLowerCase()
      if (statusFilter === 'not sent' && s !== 'not sent' && s !== '') return false
      if (statusFilter === 'sent' && s !== 'sent') return false
      if (statusFilter === 'submitted' && s !== 'submitted') return false
      if (statusFilter === 'evaluated' && s !== 'evaluated') return false
    }
    if (search && !a.name?.toLowerCase().includes(search.toLowerCase()) &&
        !a.company_name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) return <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div>

  return (
    <>
      {showAdd && <AddAssetModal onClose={() => setShowAdd(false)} />}

      <div className="page-header">
        <h2>Asset register</h2>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add asset</button>
      </div>

      <div className="card">
        <div className="filter-row" style={{ marginBottom: 12 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search assets..."
            style={{ padding: '6px 10px', border: '0.5px solid rgba(44,31,14,0.2)', borderRadius: 6, fontSize: 13, background: '#fff', outline: 'none', fontFamily: 'inherit', minWidth: 160 }}
          />
          <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
            <option value="all">All tiers</option>
            <option value="1">Tier 1 — Critical</option>
            <option value="2">Tier 2 — High</option>
            <option value="3">Tier 3 — Medium</option>
            <option value="4">Tier 4 — Low</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="not sent">Not sent</option>
            <option value="sent">Sent</option>
            <option value="submitted">Submitted</option>
            <option value="evaluated">Evaluated</option>
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            <option value="SaaS">SaaS</option>
            <option value="Cloud infra">Cloud infra</option>
            <option value="Managed service">Managed service</option>
            <option value="Physical asset">Physical asset</option>
            <option value="Internal tool">Internal tool</option>
          </select>
        </div>
        <table className="data-table">
          <thead>
            <tr><th>Asset</th><th>Type</th><th>Tier</th><th>Questionnaire</th><th>RAG</th><th>Review due</th></tr>
          </thead>
          <tbody>
            {filtered.map(asset => (
              <tr key={asset.id} className="clickable" onClick={() => navigate(`/assets/${asset.id}`)}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AssetLogo
                      vendorUrl={asset.vendor_url}
                      companyName={asset.company_name}
                      assetName={asset.name}
                      size={30}
                    />
                    <div>
                      <div style={{ fontWeight: 500 }}>{asset.name}</div>
                      {asset.company_name && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{asset.company_name}</div>}
                    </div>
                  </div>
                </td>
                <td style={{ color: 'var(--muted)' }}>{asset.type}</td>
                <td><span className={`tier-badge t${asset.tier}`}>Tier {asset.tier}</span></td>
                <td style={{ fontSize: 12, color: qStatusColor[asset.questionnaire_status] || 'var(--muted)', textTransform: 'capitalize' }}>
                  {asset.questionnaire_status || 'not sent'}
                </td>
                <td>
                  <span className="score-pill">
                    <span className={`score-dot ${asset.rag}`}></span>
                    {asset.rag ? asset.rag.charAt(0).toUpperCase() + asset.rag.slice(1) : '—'}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {asset.review_due_date ? new Date(asset.review_due_date).toLocaleDateString() : asset.review_due || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: 13 }}>
            No assets match your filters.
          </div>
        )}
      </div>
    </>
  )
}
