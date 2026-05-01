import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const severityColor = { red: 'var(--red)', amber: 'var(--amber)', gray: '#aaa', green: 'var(--green)' }

export default function AssetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [asset, setAsset] = useState(null)
  const [contacts, setContacts] = useState([])
  const [findings, setFindings] = useState([])
  const [assurance, setAssurance] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      const [assetRes, contactsRes, findingsRes, assuranceRes] = await Promise.all([
        supabase.from('assets').select('*').eq('id', id).single(),
        supabase.from('contacts').select('*').eq('asset_id', id),
        supabase.from('findings').select('*').eq('asset_id', id),
        supabase.from('assurance').select('*').eq('asset_id', id),
      ])
      if (!assetRes.error) setAsset(assetRes.data)
      if (!contactsRes.error) setContacts(contactsRes.data)
      if (!findingsRes.error) setFindings(findingsRes.data)
      if (!assuranceRes.error) setAssurance(assuranceRes.data)
      setLoading(false)
    }
    fetchAll()
  }, [id])

  if (loading) return <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div>
  if (!asset) return (
    <div>
      <div className="breadcrumb"><Link to="/assets">Asset register</Link> › Not found</div>
      <p>Asset not found.</p>
    </div>
  )

  const ragLabel = asset.rag.charAt(0).toUpperCase() + asset.rag.slice(1)
  const requiredCount = findings.filter(f => f.label === 'Required').length

  return (
    <>
      <div className="breadcrumb">
        <Link to="/assets">Asset register</Link> › {asset.name}
      </div>

      <div className="detail-header">
        <div className="detail-tag">{asset.type} · Tier {asset.tier} · Last assessed {asset.last_assessed}</div>
        <div className="detail-title">{asset.name}</div>
        <div className="detail-score">
          <div className="detail-score-num">{asset.score}</div>
          <div className="detail-score-label">Risk score · {ragLabel}</div>
        </div>
      </div>

      <div className="dash-grid">
        <div>
          {findings.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Findings</span>
                {requiredCount > 0 && <span className="finding-badge required">{requiredCount} open</span>}
              </div>
              {findings.map((f) => (
                <div key={f.id} className="finding-row">
                  <div className="finding-dot" style={{ background: severityColor[f.severity] || '#aaa' }}></div>
                  <div className="finding-text">{f.text}</div>
                  <span className={`finding-badge ${(f.label || '').toLowerCase()}`}>{f.label}</span>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <div className="card-header"><span className="card-title">Assurance</span></div>
            {assurance.map((a) => (
              <div key={a.id} className="finding-row">
                <div className="finding-dot" style={{ background: severityColor[a.status] || '#aaa' }}></div>
                <div className="finding-text">{a.text}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          {contacts.length > 0 && (
            <div className="panel-card">
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Contacts</div>
              {contacts.map((c) => (
                <div key={c.id} className="contact-row">
                  <div className="contact-avatar">{c.initials}</div>
                  <div>
                    <div className="contact-name">{c.name}</div>
                    <div className="contact-role">{c.role}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {asset.integrations && asset.integrations.length > 0 && (
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
