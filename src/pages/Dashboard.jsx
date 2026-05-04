import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getOrgId } from '../lib/auth'
import AddAssetModal from '../components/AddAssetModal'
import AssetLogo from '../components/AssetLogo'

export default function Dashboard() {
  const navigate = useNavigate()
  const [assets, setAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => { fetchAssets() }, [])

  async function fetchAssets() {
    const orgId = await getOrgId()
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('tier')
    if (!error) setAssets(data || [])
    setLoading(false)
  }

  const red = assets.filter(a => a.rag === 'red').length
  const amber = assets.filter(a => a.rag === 'amber').length
  const green = assets.filter(a => a.rag === 'green').length

  const statusRag = (status) => {
    if (!status) return ''
    const s = status.toLowerCase()
    if (s.includes('overdue') || s.includes('expired')) return 'red'
    if (s.includes('assessment') || s.includes('awaiting')) return 'amber'
    return 'green'
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div>

  return (
    <>
      {showAdd && <AddAssetModal onClose={() => setShowAdd(false)} />}
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-num">{assets.length}</div><div className="stat-label">Total assets</div></div>
        <div className="stat-card"><div className="stat-num red">{red}</div><div className="stat-label">Red — action needed</div></div>
        <div className="stat-card"><div className="stat-num amber">{amber}</div><div className="stat-label">Amber — in review</div></div>
        <div className="stat-card"><div className="stat-num green">{green}</div><div className="stat-label">Green — assured</div></div>
      </div>
      <div className="dash-grid">
        <div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Asset register</span>
              <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add asset</button>
            </div>
            {assets.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                No assets yet. Add your first vendor to get started.
              </div>
            ) : assets.map(asset => (
              <div key={asset.id} className="asset-row" onClick={() => navigate(`/assets/${asset.id}`)}>
                <AssetLogo vendorUrl={asset.vendor_url} companyName={asset.company_name} assetName={asset.name} size={28} />
                <div className="asset-name">{asset.name}</div>
                <span className={`tier-badge t${asset.tier}`}>Tier {asset.tier}</span>
                <div className={`asset-status ${statusRag(asset.status)}`}>{asset.status}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="panel-card">
            <div className="panel-label">Quick actions</div>
            <div className="panel-title" style={{ cursor: 'pointer' }} onClick={() => navigate('/questionnaires/new')}>+ New vendor assessment</div>
            <div className="panel-sub" style={{ marginTop: 4 }}>Start assessing a vendor with AI</div>
          </div>
          <div className="panel-card">
            <div className="panel-label">Getting started</div>
            <div className="panel-title">Add vendors to your register</div>
            <div className="panel-sub" style={{ marginTop: 4 }}>Use the questionnaire flow to assess vendors and build your asset register.</div>
          </div>
        </div>
      </div>
    </>
  )
}
