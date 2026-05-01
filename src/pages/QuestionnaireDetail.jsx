import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const verdictColor = {
  'Accept': 'var(--green)',
  'Accept with conditions': 'var(--amber)',
  'Escalate for further review': 'var(--amber)',
  'Do not proceed': 'var(--red)',
}
const verdictBg = {
  'Accept': '#EAF3DE',
  'Accept with conditions': '#FAEEDA',
  'Escalate for further review': '#FAEEDA',
  'Do not proceed': '#FAECE7',
}
const tierColors = { 1: 'var(--red)', 2: 'var(--amber)', 3: '#185FA5', 4: 'var(--green)' }
const tierBg = { 1: '#FAECE7', 2: '#FAEEDA', 3: '#E6F1FB', 4: '#EAF3DE' }
const tierLabel = { 1: 'Critical', 2: 'High', 3: 'Medium', 4: 'Low' }
const tierReview = { 1: '1 year', 2: '1 year', 3: '2 years', 4: '3 years' }

export default function QuestionnaireDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [q, setQ] = useState(null)
  const [questions, setQuestions] = useState([])
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [approving, setApproving] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchAll() }, [id])

  async function fetchAll() {
    const [qRes, qqRes] = await Promise.all([
      supabase.from('questionnaires').select('*').eq('id', id).single(),
      supabase.from('questionnaire_questions').select('*').eq('questionnaire_id', id).order('order_num'),
    ])
    if (!qRes.error) setQ(qRes.data)
    if (!qqRes.error) {
      setQuestions(qqRes.data)
      const { data: rData } = await supabase.from('questionnaire_responses').select('*').eq('questionnaire_id', id)
      setResponses(rData || [])
    }
    setLoading(false)
  }

  const runEvaluation = async () => {
    setEvaluating(true)
    setError('')
    try {
      const allResponses = questions.map(qq => ({
        answer: responses.find(r => r.question_id === qq.id)?.answer || ''
      }))
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetName: q.asset_name,
          tier: q.tier,
          profile: { data_sensitivity: q.data_sensitivity, network_access: q.network_access, integration_depth: q.integration_depth, criticality: q.criticality },
          questions,
          responses: allResponses,
        }),
      })
      const evaluation = await res.json()
      if (!res.ok) throw new Error(evaluation.error)

      await supabase.from('questionnaires').update({
        verdict: evaluation.verdict,
        score: evaluation.score,
        summary: evaluation.summary,
        approval_status: 'pending',
      }).eq('id', id)

      if (evaluation.flagged_responses?.length > 0) {
        for (const idx of evaluation.flagged_responses) {
          const qq = questions[idx]
          if (qq) {
            const resp = responses.find(r => r.question_id === qq.id)
            if (resp) await supabase.from('questionnaire_responses').update({ flagged: true }).eq('id', resp.id)
          }
        }
      }
      await fetchAll()
    } catch (err) {
      setError(err.message)
    }
    setEvaluating(false)
  }

  const handleApprove = async () => {
    setApproving(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const assetId = q.asset_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Date.now()

      const { error: assetError } = await supabase.from('assets').insert([{
        id: assetId,
        name: q.asset_name,
        type: q.asset_type || 'SaaS',
        tier: q.tier,
        rag: q.score >= 70 ? 'red' : q.score >= 40 ? 'amber' : 'green',
        score: q.score,
        status: q.verdict || 'Evaluated',
        last_assessed: new Date().toLocaleDateString(),
        company_name: q.company_name || '',
        contact_name: q.vendor_name || '',
        contact_email: q.vendor_email || '',
        contract_reference: q.contract_reference || '',
        integration_notes: q.integration_notes || '',
        questionnaire_status: 'evaluated',
        certification_status: 'not requested',
        added_by: user?.email || 'unknown',
      }])
      if (assetError) throw new Error(assetError.message)

      await supabase.from('questionnaires').update({
        asset_id: assetId,
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: user?.email || 'unknown',
      }).eq('id', id)

      navigate(`/assets/${assetId}`)
    } catch (err) {
      setError(err.message)
    }
    setApproving(false)
  }

  const handleReject = async () => {
    try {
      await supabase.from('questionnaires').update({
        approval_status: 'rejected',
        rejection_reason: rejectionReason,
      }).eq('id', id)
      setShowRejectModal(false)
      await fetchAll()
    } catch (err) {
      setError(err.message)
    }
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/vendor/${q.token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div>
  if (!q) return <div style={{ padding: '2rem' }}>Questionnaire not found.</div>

  const domains = [...new Set(questions.map(qq => qq.domain))]
  const vendorLink = `${window.location.origin}/vendor/${q.token}`
  const isPendingApproval = q.status === 'completed' && q.verdict && q.approval_status === 'pending'
  const isApproved = q.approval_status === 'approved'
  const isRejected = q.approval_status === 'rejected'

  return (
    <>
      <div className="breadcrumb">
        <Link to="/questionnaires">Questionnaires</Link> › {q.asset_name}
      </div>

      <div className="detail-header">
        <div className="detail-tag">
          {q.vendor_name || 'Vendor'} · Tier {q.tier} · {q.status}
          {q.approval_status && q.approval_status !== 'pending' && (
            <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: isApproved ? '#EAF3DE' : '#FAECE7', color: isApproved ? 'var(--green)' : 'var(--red)' }}>
              {isApproved ? 'Approved' : 'Rejected'}
            </span>
          )}
        </div>
        <div className="detail-title">{q.asset_name}</div>
        {q.score && (
          <div className="detail-score">
            <div className="detail-score-num">{q.score}</div>
            <div className="detail-score-label">Risk score</div>
          </div>
        )}
      </div>

      {/* PENDING APPROVAL BANNER */}
      {isPendingApproval && (
        <div style={{ background: '#FFF9ED', border: '1px solid #F0D080', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#854F0B', marginBottom: 6 }}>
                Pending your approval
              </div>
              <div style={{ fontSize: 13, color: '#6B5030', lineHeight: 1.5 }}>
                The AI evaluation is complete. Review the verdict, findings, and responses below — then approve to add this vendor to your asset register, or reject to decline.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <button className="btn" onClick={() => setShowRejectModal(true)}
                style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>
                Reject
              </button>
              <button className="btn btn-primary" onClick={handleApprove} disabled={approving}>
                {approving ? 'Adding to register...' : 'Approve & add to register'}
              </button>
            </div>
          </div>
          {error && <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 10 }}>{error}</div>}
        </div>
      )}

      {/* REJECTED BANNER */}
      {isRejected && (
        <div style={{ background: '#FCEBEB', border: '1px solid #F0C0C0', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--red)', marginBottom: 4 }}>Rejected</div>
          {q.rejection_reason && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{q.rejection_reason}</div>}
        </div>
      )}

      {/* APPROVED BANNER */}
      {isApproved && (
        <div style={{ background: '#EAF3DE', border: '1px solid #B8DDA0', borderRadius: 12, padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--green)', marginBottom: 4 }}>Added to asset register</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Approved by {q.approved_by} on {q.approved_at ? new Date(q.approved_at).toLocaleDateString() : '—'}</div>
          </div>
          {q.asset_id && (
            <button className="btn" onClick={() => navigate(`/assets/${q.asset_id}`)}>View asset →</button>
          )}
        </div>
      )}

      <div className="dash-grid">
        <div>
          {/* VERDICT */}
          {q.verdict && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, padding: '1rem', background: verdictBg[q.verdict] || 'var(--cream)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>AI verdict</div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: verdictColor[q.verdict] }}>{q.verdict}</div>
                </div>
                {q.submitted_at && <>
                  <div style={{ width: 1, height: 40, background: 'rgba(44,31,14,0.1)' }} />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Submitted</div>
                    <div style={{ fontSize: 13 }}>{new Date(q.submitted_at).toLocaleDateString()}</div>
                  </div>
                </>}
              </div>
              {q.summary && <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{q.summary}</p>}
            </div>
          )}

          {/* AWAITING EVALUATION */}
          {q.status === 'completed' && !q.verdict && (
            <div className="card">
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Responses received</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                  The vendor has submitted. Run the AI evaluation to generate findings, a risk score, and a verdict.
                </div>
              </div>
              {error && <div style={{ fontSize: 12, color: 'var(--red)', padding: '8px 12px', background: '#FCEBEB', borderRadius: 6, marginBottom: 12 }}>{error}</div>}
              <button className="btn btn-primary" onClick={runEvaluation} disabled={evaluating}>
                {evaluating ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 12, height: 12, border: '2px solid rgba(245,240,232,0.3)', borderTopColor: '#F5F0E8', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                    Evaluating responses...
                  </span>
                ) : 'Run AI evaluation'}
              </button>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* RESPONSES */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{responses.length > 0 ? 'Responses' : 'Questions'}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{questions.length} questions</span>
            </div>
            {domains.map(domain => (
              <div key={domain} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' }}>
                  {domain}
                </div>
                {questions.filter(qq => qq.domain === domain).map(qq => {
                  const response = responses.find(r => r.question_id === qq.id)
                  return (
                    <div key={qq.id} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: response?.answer ? 4 : 0, display: 'flex', gap: 8 }}>
                        <span style={{ flexShrink: 0 }}>{qq.order_num}.</span>
                        <span style={{ flex: 1 }}>{qq.question}</span>
                        <span style={{ color: 'var(--muted)', opacity: 0.6, flexShrink: 0 }}>{qq.control_ref}</span>
                      </div>
                      {response?.answer && (
                        <div style={{ fontSize: 13, padding: '8px 10px', background: response.flagged ? '#FFF9ED' : 'var(--cream)', borderRadius: 6, lineHeight: 1.5, marginLeft: 16 }}>
                          {response.answer}
                          {response.flagged && <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>⚠ Flagged for review</div>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="panel-card">
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Tier assignment</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 6, background: tierBg[q.tier], marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: tierColors[q.tier] }}>Tier {q.tier} — {tierLabel[q.tier]}</span>
            </div>
            {q.tier_justification && <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 8 }}>{q.tier_justification}</div>}
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Review cycle: <strong>{tierReview[q.tier]}</strong></div>
          </div>

          <div className="panel-card">
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Vendor link</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>Share with the vendor to complete the questionnaire.</div>
            <div style={{ fontSize: 11, padding: '8px 10px', background: 'var(--cream)', borderRadius: 6, wordBreak: 'break-all', marginBottom: 10, color: 'var(--muted)' }}>
              {vendorLink}
            </div>
            <button className="btn" style={{ width: '100%', textAlign: 'center' }} onClick={copyLink}>
              {copied ? '✓ Copied!' : 'Copy link'}
            </button>
          </div>

          <div className="panel-card">
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Details</div>
            {[
              ['Asset', q.asset_name],
              ['Type', q.asset_type || '—'],
              ['Company', q.company_name || '—'],
              ['Vendor', q.vendor_name || '—'],
              ['Email', q.vendor_email || '—'],
              ['Questions', questions.length],
              ['Created', new Date(q.created_at).toLocaleDateString()],
              ['Expires', new Date(q.expires_at).toLocaleDateString()],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                <span style={{ textAlign: 'right', maxWidth: 180, wordBreak: 'break-word' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* REJECT MODAL */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={() => setShowRejectModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(26,18,8,0.35)' }} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 12, padding: '1.5rem', width: 440, zIndex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>Reject questionnaire</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
              This vendor will not be added to the asset register. Optionally add a reason.
            </div>
            <textarea
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Reason for rejection (optional)..."
              rows={3}
              style={{ width: '100%', padding: '10px 12px', border: '0.5px solid rgba(44,31,14,0.25)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', marginBottom: 16, resize: 'none', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={() => setShowRejectModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleReject} style={{ flex: 2, padding: '8px', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Confirm rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
