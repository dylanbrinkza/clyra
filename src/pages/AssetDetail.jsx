import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getOrgId, getUserRole } from '../lib/auth'
import AssetLogo from '../components/AssetLogo'

const severityColor = { red: 'var(--red)', amber: 'var(--amber)', gray: '#aaa', green: 'var(--green)' }
const tierColors = { 1: 'var(--red)', 2: 'var(--amber)', 3: '#185FA5', 4: 'var(--green)' }
const tierBg = { 1: '#FAECE7', 2: '#FAEEDA', 3: '#E6F1FB', 4: '#EAF3DE' }
const tierLabel = { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low' }
const tierReview = { 1: 'Annual', 2: 'Annual', 3: 'Every 2 years', 4: 'Every 3 years' }
const qStatusColor = { 'not sent': 'var(--muted)', 'sent': 'var(--amber)', 'submitted': '#185FA5', 'evaluated': 'var(--green)' }
const auditIcon = { created: '✦', updated: '✎', deleted: '✕' }
const auditColor = { created: 'var(--green)', updated: 'var(--amber)', deleted: 'var(--red)' }

export default function AssetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [asset, setAsset] = useState(null)
  const [contacts, setContacts] = useState([])
  const [findings, setFindings] = useState([])
  const [assurance, setAssurance] = useState([])
  const [questionnaires, setQuestionnaires] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    fetchAll()
    getUserRole().then(r => setIsAdmin(r === 'admin' || r === 'org_admin'))
  }, [id])

  async function fetchAll() {
    const [assetRes, contactsRes, findingsRes, assuranceRes, qRes, auditRes] = await Promise.all([
      supabase.from('assets').select('*').eq('id', id).single(),
      supabase.from('contacts').select('*').eq('asset_id', id),
      supabase.from('findings').select('*').eq('asset_id', id),
      supabase.from('assurance').select('*').eq('asset_id', id),
      supabase.from('questionnaires').select('*').eq('asset_id', id).order('created_at', { ascending: false }),
      supabase.from('asset_audit_log').select('*').eq('asset_id', id).order('created_at', { ascending: false }),

    ])
    if (!assetRes.error) setAsset(assetRes.data)
    if (!contactsRes.error) setContacts(contactsRes.data)
    if (!findingsRes.error) setFindings(findingsRes.data)
    if (!assuranceRes.error) setAssurance(assuranceRes.data)
    if (!qRes.error) setQuestionnaires(qRes.data)
    if (!auditRes.error) setAuditLog(auditRes.data)
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!deleteReason.trim()) return
    setDeleting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Soft delete
      await supabase.from('assets').update({
        deleted_at: new Date().toISOString(),
        deleted_by: user?.email || 'unknown',
        delete_reason: deleteReason,
      }).eq('id', id)

      // Audit log
      const orgId = await getOrgId()
      await supabase.from('asset_audit_log').insert([{
        asset_id: id,
        asset_name: asset.name,
        action: 'deleted',
        performed_by: user?.email || 'unknown',
        reason: deleteReason,
        changes: { name: asset.name, tier: asset.tier, type: asset.type },
        org_id: orgId,
      }])

      navigate('/assets')
    } catch (err) {
      console.error(err)
    }
    setDeleting(false)
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div>
  if (!asset) return <div><div className="breadcrumb"><Link to="/assets">Asset register</Link> › Not found</div><p>Asset not found.</p></div>

  const ragLabel = asset.rag ? asset.rag.charAt(0).toUpperCase() + asset.rag.slice(1) : 'Unknown'
  const requiredCount = findings.filter(f => f.label === 'Required').length
  const isDeleted = !!asset.deleted_at

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'questionnaires', label: `Questionnaires${questionnaires.length ? ` (${questionnaires.length})` : ''}` },
    
  ]

  return (
    <>
      <div className="breadcrumb"><Link to="/assets">Asset register</Link> › {asset.name}</div>

      {isDeleted && (
        <div style={{ background: '#FCEBEB', border: '1px solid #F0C0C0', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: 'var(--red)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>✕</span>
          <span>This asset was deleted on {new Date(asset.deleted_at).toLocaleDateString()} by {asset.deleted_by}. Reason: {asset.delete_reason}</span>
        </div>
      )}

      <div className="detail-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
          <AssetLogo vendorUrl={asset.vendor_url} companyName={asset.company_name} assetName={asset.name} size={44} />
          <div>
            <div className="detail-tag">
              {asset.type} · {asset.company_name || 'Vendor'} · Added {asset.created_at ? new Date(asset.created_at).toLocaleDateString() : '—'}
              {asset.added_by && ` · by ${asset.added_by}`}
            </div>
            <div className="detail-title">{asset.name}</div>
          </div>
        </div>
        <div className="detail-score">
          <div className="detail-score-num">{asset.score || '—'}</div>
          <div className="detail-score-label">Risk score · {ragLabel}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '0.5px solid var(--border)', paddingBottom: 0 }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
              padding: '10px 18px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === tab.key ? 'var(--text)' : 'var(--muted)',
              fontWeight: activeTab === tab.key ? 500 : 400,
              borderBottom: activeTab === tab.key ? '2px solid var(--brown)' : '2px solid transparent',
              marginBottom: -1, fontFamily: 'inherit',
            }}>{tab.label}</button>
          ))}
        </div>
        {!isDeleted && isAdmin && (
          <button onClick={() => setShowDeleteModal(true)} style={{
            fontSize: 12, color: 'var(--red)', background: 'none',
            border: '0.5px solid var(--red)', borderRadius: 6,
            padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8,
          }}>
            Delete asset
          </button>
        )}
      </div>

      {activeTab === 'overview' && (
        <div className="dash-grid">
          <div>
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
          </div>

          <div>
            <div className="panel-card">
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Risk tier</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 8, background: tierBg[asset.tier], marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: tierColors[asset.tier] }}>Tier {asset.tier} — {tierLabel[asset.tier]}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Review schedule: <strong>{tierReview[asset.tier]}</strong></div>
              {asset.review_due_date && (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Review due: <strong>{new Date(asset.review_due_date).toLocaleDateString()}</strong></div>
              )}
            </div>

            <div className="panel-card">
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Vendor details</div>
              {[
                ['Company', asset.company_name || '—'],
                ['Contact', asset.contact_name || '—'],
                ['Email', asset.contact_email || '—'],
                ['Website', asset.vendor_url || '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)' }}>{label}</span>
                  <span style={{ textAlign: 'right', maxWidth: 200, wordBreak: 'break-word' }}>
                    {label === 'Website' && value !== '—'
                      ? <a href={value} target="_blank" rel="noreferrer" style={{ color: 'var(--orange)' }}>{value.replace('https://', '')}</a>
                      : value}
                  </span>
                </div>
              ))}
            </div>

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

            {asset.integration_notes && (
              <div className="panel-card">
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Integration notes</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{asset.integration_notes}</div>
              </div>
            )}

            {asset.contract_reference && (
              <div className="panel-card">
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Contract reference</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{asset.contract_reference}</div>
              </div>
            )}

            {!isDeleted && (
              <div className="trigger-card">
                <div className="trigger-title">Incident response</div>
                <div className="trigger-desc">Trigger an incident for this asset. Clyra will guide you through response, notification, and resolution.</div>
                <button className="btn" style={{ width: '100%', textAlign: 'center' }} onClick={() => navigate('/incidents')}>
                  Trigger incident response
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'questionnaires' && (
        <div className="card">
          {questionnaires.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: 13 }}>No questionnaires linked to this asset.</div>
          ) : questionnaires.map(q => (
            <div key={q.id} className="asset-row" onClick={() => navigate(`/questionnaires/${q.id}`)}>
              <div className={`dot ${q.status === 'completed' ? 'green' : 'amber'}`}></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{q.asset_name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Tier {q.tier} · {q.status} · {new Date(q.created_at).toLocaleDateString()}</div>
              </div>
              {q.verdict && <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 500, background: 'var(--cream2)', color: 'var(--muted)' }}>{q.verdict}</span>}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="card">
          {auditLog.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', fontSize: 13 }}>No audit events yet.</div>
          ) : auditLog.map((entry, i) => (
            <div key={entry.id} style={{ display: 'flex', gap: 14, paddingBottom: 16, marginBottom: 16, borderBottom: i < auditLog.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: auditColor[entry.action] + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: auditColor[entry.action], flexShrink: 0, marginTop: 2 }}>
                {auditIcon[entry.action]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, textTransform: 'capitalize', color: auditColor[entry.action] }}>{entry.action}</span>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>by {entry.performed_by}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>{new Date(entry.created_at).toLocaleString()}</span>
                </div>
                {entry.reason && (
                  <div style={{ fontSize: 13, color: 'var(--muted)', padding: '8px 10px', background: 'var(--cream)', borderRadius: 6, lineHeight: 1.5 }}>{entry.reason}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showDeleteModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowDeleteModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(26,18,8,0.4)' }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 12, padding: '1.5rem', width: 460, zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <AssetLogo vendorUrl={asset.vendor_url} companyName={asset.company_name} assetName={asset.name} size={36} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>Delete {asset.name}?</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Asset will be removed from the active register.</div>
              </div>
            </div>
            <div style={{ background: '#FCEBEB', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: 'var(--red)', lineHeight: 1.5 }}>
              The asset will be soft-deleted and visible in the "Deleted assets" section of the register. The audit trail is preserved permanently.
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Reason for deletion *</label>
              <textarea value={deleteReason} onChange={e => setDeleteReason(e.target.value)}
                placeholder="e.g. Vendor contract ended, tool decommissioned, duplicate entry..."
                rows={3} style={{ width: '100%', padding: '10px 12px', border: '0.5px solid rgba(44,31,14,0.25)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'none', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={() => setShowDeleteModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting || !deleteReason.trim()}
                style={{ flex: 2, padding: '8px', background: !deleteReason.trim() ? '#ccc' : 'var(--red)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: deleteReason.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                {deleting ? 'Deleting...' : 'Confirm deletion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
