import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const severityColor = { red: 'var(--red)', amber: 'var(--amber)', gray: '#aaa', green: 'var(--green)' }
const tierColors = { 1: 'var(--red)', 2: 'var(--amber)', 3: '#185FA5', 4: 'var(--green)' }
const tierBg = { 1: '#FAECE7', 2: '#FAEEDA', 3: '#E6F1FB', 4: '#EAF3DE' }
const tierLabel = { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low' }
const tierReview = { 1: 'Annual', 2: 'Annual', 3: 'Every 2 years', 4: 'Every 3 years' }

const qStatusColor = {
  'not sent': 'var(--muted)',
  'sent': 'var(--amber)',
  'submitted': '#185FA5',
  'evaluated': 'var(--green)',
}

export default function AssetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [asset, setAsset] = useState(null)
  const [contacts, setContacts] = useState([])
  const [findings, setFindings] = useState([])
  const [assurance, setAssurance] = useState([])
  const [questionnaires, setQuestionnaires] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      const [assetRes, contactsRes, findingsRes, assuranceRes, qRes] = await Promise.all([
        supabase.from('assets').select('*').eq('id', id).single(),
        supabase.from('contacts').select('*').eq('asset_id', id),
        supabase.from('findings').select('*').eq('asset_id', id),
        supabase.from('assurance').select('*').eq('asset_id', id),
        supabase.from('questionnaires').select('*').eq('asset_id', id).order('created_at', { ascending: false }),
      ])
      if (!assetRes.error) setAsset(assetRes.data)
      if (!contactsRes.error) setContacts(contactsRes.data)
      if (!findingsRes.error) setFindings(findingsRes.data)
      if (!assuranceRes.error) setAssurance(assuranceRes.data)
      if (!qRes.error) setQuestionnaires(qRes.data)
      setLoading(false)
    }
    fetchAll()
  }, [id])

  if (loading) return <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div>
  if (!asset) return <div><div className="breadcrumb"><Link to="/assets">Asset register</Link> › Not found</div><p>Asset not found.</p></div>

  const ragLabel = asset.rag ? asset.rag.charAt(0).toUpperCase() + asset.rag.slice(1) : 'Unknown'
  const requiredCount = findings.filter(f => f.label === 'Required').length
  const latestQ = questionnaires[0]

  return (
    <>
      <div className="breadcrumb"><Link to="/assets">Asset register</Link> › {asset.name}</div>

      <div className="detail-header">
        <div className="detail-tag">
          {asset.type} · {asset.company_name || 'Vendor'} · Added {asset.created_at ? new Date(asset.created_at).toLocaleDateString() : '—'}
          {asset.added_by && ` · by ${asset.added_by}`}
        </div>
        <div className="detail-title">{asset.name}</div>
        <div className="detail-score">
          <div className="detail-score-num">{asset.score || '—'}</div>
          <div className="detail-score-label">Risk score · {ragLabel}</div>
        </div>
      </div>

      <div className="dash-grid">
        <div>
          {/* ASSURANCE STATUS */}
          <div className="card">
            <div className="card-header"><span className="card-title">Assurance status</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: '12px 14px', background: 'var(--cream)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Questionnaire</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: qStatusColor[asset.questionnaire_status] || 'var(--muted)', textTransform: 'capitalize' }}>
                  {asset.questionnaire_status || 'not sent'}
                </div>
              </div>
              <div style={{ padding: '12px 14px', background: 'var(--cream)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Certification</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)', textTransform: 'capitalize' }}>
                  {asset.certification_status || 'not requested'}
                </div>
              </div>
            </div>
          </div>

          {/* FINDINGS */}
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

          {/* ASSURANCE CERTS */}
          {assurance.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">Certifications & assurance</span></div>
              {assurance.map((a) => (
                <div key={a.id} className="finding-row">
                  <div className="finding-dot" style={{ background: severityColor[a.status] || '#aaa' }}></div>
                  <div className="finding-text">{a.text}</div>
                </div>
              ))}
            </div>
          )}

          {/* QUESTIONNAIRES */}
          {questionnaires.length > 0 && (
            <div className="card">
              <div className="card-header"><span className="card-title">Questionnaires</span></div>
              {questionnaires.map(q => (
                <div key={q.id} className="asset-row" onClick={() => navigate(`/questionnaires/${q.id}`)}>
                  <div className={`dot ${q.status === 'completed' ? 'green' : 'amber'}`}></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{q.asset_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Tier {q.tier} · {q.status} · {new Date(q.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {q.verdict && (
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 500, background: 'var(--cream2)', color: 'var(--muted)' }}>
                      {q.verdict}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          {/* TIER */}
          <div className="panel-card">
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Risk tier</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 8, background: tierBg[asset.tier], marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: tierColors[asset.tier] }}>Tier {asset.tier} — {tierLabel[asset.tier]}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
              Review schedule: <strong>{tierReview[asset.tier]}</strong>
            </div>
            {asset.review_due_date && (
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Review due: <strong>{new Date(asset.review_due_date).toLocaleDateString()}</strong>
              </div>
            )}
          </div>

          {/* VENDOR DETAILS */}
          <div className="panel-card">
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Vendor details</div>
            {[
              ['Company', asset.company_name || '—'],
              ['Contact', asset.contact_name || '—'],
              ['Email', asset.contact_email || '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                <span style={{ textAlign: 'right', maxWidth: 200, wordBreak: 'break-word' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* CONTACTS */}
          {contacts.length > 0 && (
            <div className="panel-card">
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Associated contacts</div>
              {contacts.map((c) => (
                <div key={c.id} className="contact-row">
                  <div className="contact-avatar">{c.initials}</div>
                  <div><div className="contact-name">{c.name}</div><div className="contact-role">{c.role}</div></div>
                </div>
              ))}
            </div>
          )}

          {/* INTEGRATION NOTES */}
          {asset.integration_notes && (
            <div className="panel-card">
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Integration notes</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{asset.integration_notes}</div>
            </div>
          )}

          {/* CONTRACT */}
          {asset.contract_reference && (
            <div className="panel-card">
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Contract reference</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{asset.contract_reference}</div>
            </div>
          )}

          {/* INCIDENT */}
          <div className="trigger-card">
            <div className="trigger-title">Incident response</div>
            <div className="trigger-desc">Trigger an incident for this asset. Clyra will guide you through response, notification, and resolution.</div>
            <button className="btn" style={{ width: '100%', textAlign: 'center' }} onClick={() => navigate('/incidents')}>
              Trigger incident response
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
