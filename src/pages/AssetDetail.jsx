import { useParams, useNavigate, Link } from 'react-router-dom'
import { assets } from '../data/mockData'

const severityColor = { red: 'var(--red)', amber: 'var(--amber)', gray: '#aaa', green: 'var(--green)' }

export default function AssetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const asset = assets.find(a => a.id === id)

  if (!asset) return (
    <div>
      <div className="breadcrumb"><Link to="/assets">Asset register</Link> › Not found</div>
      <p>Asset not found.</p>
    </div>
  )

  const ragLabel = asset.rag.charAt(0).toUpperCase() + asset.rag.slice(1)

  return (
    <>
      <div className="breadcrumb">
        <Link to="/assets">Asset register</Link> › {asset.name}
      </div>

      <div className="detail-header">
        <div className="detail-tag">{asset.type} · Tier {asset.tier} · Last assessed {asset.lastAssessed}</div>
        <div className="detail-title">{asset.name}</div>
        <div className="detail-score">
          <div className="detail-score-num">{asset.score}</div>
          <div className="detail-score-label">Risk score · {ragLabel}</div>
        </div>
      </div>

      <div className="dash-grid">
        <div>
          {asset.findings.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Findings</span>
                <span className="finding-badge required">{asset.findings.filter(f => f.label === 'Required').length} open</span>
              </div>
              {asset.findings.map((f, i) => (
                <div key={i} className="finding-row">
                  <div className="finding-dot" style={{ background: severityColor[f.severity] }}></div>
                  <div className="finding-text">{f.text}</div>
                  <span className={`finding-badge ${f.label.toLowerCase()}`}>{f.label}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <div className="card-header"><span className="card-title">Assurance</span></div>
            {asset.assurance.map((a, i) => (
              <div key={i} className="finding-row">
                <div className="finding-dot" style={{ background: severityColor[a.status] }}></div>
                <div className="finding-text">{a.text}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          {asset.contacts.length > 0 && (
            <div className="panel-card">
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Contacts</div>
              {asset.contacts.map((c, i) => (
                <div key={i} className="contact-row">
                  <div className="contact-avatar">{c.initials}</div>
                  <div>
                    <div className="contact-name">{c.name}</div>
                    <div className="contact-role">{c.role}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {asset.integrations.length > 0 && (
            <div className="panel-card">
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Integrations</div>
              {asset.integrations.map((int, i) => (
                <div key={i} className="int-row">
                  <div className="dot gray"></div>
                  {int}
                </div>
              ))}
            </div>
          )}

          <div className="trigger-card">
            <div className="trigger-title">Incident response</div>
            <div className="trigger-desc">
              Trigger an incident for this asset. Clyra will guide you through response, notification, and resolution.
            </div>
            <button className="btn" style={{ width: '100%', textAlign: 'center' }}
              onClick={() => navigate('/incidents')}>
              Trigger incident response
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
