import { useNavigate } from 'react-router-dom'
import { assets } from '../data/mockData'

const ragClass = { red: 'red', amber: 'amber', green: 'green' }
const statusRag = (status) => {
  if (status.toLowerCase().includes('overdue') || status.toLowerCase().includes('expired')) return 'red'
  if (status.toLowerCase().includes('assessment') || status.toLowerCase().includes('awaiting')) return 'amber'
  return 'green'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const red = assets.filter(a => a.rag === 'red').length
  const amber = assets.filter(a => a.rag === 'amber').length
  const green = assets.filter(a => a.rag === 'green').length

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-num">{assets.length}</div><div className="stat-label">Total assets</div></div>
        <div className="stat-card"><div className={`stat-num red`}>{red}</div><div className="stat-label">Red — action needed</div></div>
        <div className="stat-card"><div className={`stat-num amber`}>{amber}</div><div className="stat-label">Amber — in review</div></div>
        <div className="stat-card"><div className={`stat-num green`}>{green}</div><div className="stat-label">Green — assured</div></div>
      </div>

      <div className="dash-grid">
        <div>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Asset register</span>
              <button className="btn btn-primary" onClick={() => navigate('/assets')}>+ Add asset</button>
            </div>
            {assets.map(asset => (
              <div key={asset.id} className="asset-row" onClick={() => navigate(`/assets/${asset.id}`)}>
                <div className={`dot ${asset.rag}`}></div>
                <div className="asset-name">{asset.name}</div>
                <span className={`tier-badge t${asset.tier}`}>Tier {asset.tier}</span>
                <div className={`asset-status ${statusRag(asset.status)}`}>{asset.status}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="panel-card">
            <div className="panel-label">Active questionnaire</div>
            <div className="panel-title">Hubspot — security</div>
            <div className="progress"><div className="progress-bar" style={{ width: '68%' }}></div></div>
            <div className="panel-sub">Vendor response: 4 days left</div>
          </div>
          <div className="panel-card">
            <div className="panel-label">AI complete</div>
            <div className="panel-title">Slack assessment</div>
            <div style={{ marginTop: 8 }}>
              <span className="finding-badge required">1 required</span>{' '}
              <span className="finding-badge recommended">2 recommended</span>
            </div>
          </div>
          <div className="panel-card dark">
            <div className="panel-label light">Review due</div>
            <div className="panel-title">Salesforce — annual</div>
            <div className="panel-sub light">Due in 12 days</div>
          </div>
        </div>
      </div>
    </>
  )
}
