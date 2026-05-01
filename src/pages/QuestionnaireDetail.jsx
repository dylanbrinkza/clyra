import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
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

export default function QuestionnaireDetail() {
  const { id } = useParams()
  const [q, setQ] = useState(null)
  const [questions, setQuestions] = useState([])
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAll()
  }, [id])

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
          profile: {
            data_sensitivity: q.data_sensitivity,
            network_access: q.network_access,
            integration_depth: q.integration_depth,
            criticality: q.criticality,
          },
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

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/vendor/${q.token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div>
  if (!q) return <div style={{ padding: '2rem' }}>Questionnaire not found.</div>

  const domains = [...new Set(questions.map(qq => qq.domain))]
  const vendorLink = `${window.location.origin}/vendor/${q.token}`

  return (
    <>
      <div className="breadcrumb">
        <Link to="/questionnaires">Questionnaires</Link> › {q.asset_name}
      </div>

      <div className="detail-header">
        <div className="detail-tag">{q.vendor_name || 'Vendor'} · Tier {q.tier} · {q.status}</div>
        <div className="detail-title">{q.asset_name}</div>
        {q.score && (
          <div className="detail-score">
            <div className="detail-score-num">{q.score}</div>
            <div className="detail-score-label">Risk score</div>
          </div>
        )}
      </div>

      <div className="dash-grid">
        <div>
          {/* VERDICT */}
          {q.verdict && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, padding: '1rem', background: verdictBg[q.verdict] || 'var(--cream)', borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Verdict</div>
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
                  The vendor has submitted their responses. Run the AI evaluation to generate findings, a risk score, and a verdict.
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
              <span className="card-title">{q.status === 'completed' ? 'Responses' : 'Questions'}</span>
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
                      <div style={{ display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4, display: 'flex', gap: 8 }}>
                            <span>{qq.order_num}.</span>
                            <span>{qq.question}</span>
                            <span style={{ color: 'var(--muted)', opacity: 0.6, flexShrink: 0 }}>{qq.control_ref}</span>
                          </div>
                          {response?.answer && (
                            <div style={{ fontSize: 13, padding: '8px 10px', background: response.flagged ? '#FFF9ED' : 'var(--cream)', borderRadius: 6, lineHeight: 1.5, marginLeft: 16 }}>
                              {response.answer}
                              {response.flagged && <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>⚠ Flagged for review</div>}
                            </div>
                          )}
                        </div>
                      </div>
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
              <span style={{ fontSize: 13, fontWeight: 500, color: tierColors[q.tier] }}>Tier {q.tier}</span>
            </div>
            {q.tier_justification && <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{q.tier_justification}</div>}
          </div>

          <div className="panel-card">
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Vendor link</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>Share this with the vendor to complete the questionnaire.</div>
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
              ['Vendor', q.vendor_name || '—'],
              ['Email', q.vendor_email || '—'],
              ['Status', q.status],
              ['Questions', questions.length],
              ['Created', new Date(q.created_at).toLocaleDateString()],
              ['Expires', new Date(q.expires_at).toLocaleDateString()],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                <span>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
