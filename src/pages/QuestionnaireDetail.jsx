import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const severityColor = { Required: 'var(--red)', Recommended: 'var(--amber)', Advisory: '#aaa' }
const verdictColor = {
  'Accept': 'var(--green)',
  'Accept with conditions': 'var(--amber)',
  'Escalate for further review': 'var(--amber)',
  'Do not proceed': 'var(--red)',
}

export default function QuestionnaireDetail() {
  const { id } = useParams()
  const [q, setQ] = useState(null)
  const [questions, setQuestions] = useState([])
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
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
    fetchAll()
  }, [id])

  const copyLink = () => {
    const url = `${window.location.origin}/vendor/${q.token}`
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div>
  if (!q) return <div style={{ padding: '2rem' }}>Questionnaire not found.</div>

  const domains = [...new Set(questions.map(q => q.domain))]
  const tierColors = { 1: 'var(--red)', 2: 'var(--amber)', 3: '#185FA5', 4: 'var(--green)' }
  const tierBg = { 1: '#FAECE7', 2: '#FAEEDA', 3: '#E6F1FB', 4: '#EAF3DE' }
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
          {q.status === 'completed' && q.verdict ? (
            <>
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, padding: '1rem', background: 'var(--cream)', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Verdict</div>
                    <div style={{ fontSize: 16, fontWeight: 500, color: verdictColor[q.verdict] || 'var(--text)' }}>{q.verdict}</div>
                  </div>
                  <div style={{ width: 1, height: 40, background: 'var(--border)' }} />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Submitted</div>
                    <div style={{ fontSize: 13 }}>{q.submitted_at ? new Date(q.submitted_at).toLocaleDateString() : '—'}</div>
                  </div>
                </div>
                {q.summary && <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{q.summary}</p>}
              </div>

              <div className="card">
                <div className="card-header"><span className="card-title">Responses</span></div>
                {domains.map(domain => (
                  <div key={domain} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' }}>
                      {domain}
                    </div>
                    {questions.filter(qq => qq.domain === domain).map(qq => {
                      const response = responses.find(r => r.question_id === qq.id)
                      return (
                        <div key={qq.id} style={{ marginBottom: 14 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            {response?.flagged && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)', marginTop: 5, flexShrink: 0 }} />}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 3 }}>{qq.question}</div>
                              <div style={{ fontSize: 13, padding: '8px 10px', background: response?.flagged ? '#FFF9ED' : 'var(--cream)', borderRadius: 6, lineHeight: 1.5 }}>
                                {response?.answer || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>No answer provided</span>}
                              </div>
                              {response?.flagged && <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 3 }}>⚠ Flagged for review</div>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="card">
              <div className="card-header"><span className="card-title">Questions</span><span style={{ fontSize: 12, color: 'var(--muted)' }}>{questions.length} questions</span></div>
              {domains.map(domain => (
                <div key={domain} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' }}>
                    {domain}
                  </div>
                  {questions.filter(qq => qq.domain === domain).map((qq, i) => (
                    <div key={qq.id} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 13 }}>
                      <div style={{ color: 'var(--muted)', flexShrink: 0, width: 20 }}>{qq.order_num}.</div>
                      <div style={{ flex: 1 }}>
                        {qq.question}
                        {qq.follow_up_trigger && <div style={{ fontSize: 11, color: 'var(--orange)', marginTop: 2 }}>↳ {qq.follow_up_trigger}</div>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>{qq.control_ref}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="panel-card">
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Tier assignment</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ padding: '6px 12px', borderRadius: 6, background: tierBg[q.tier], color: tierColors[q.tier], fontSize: 13, fontWeight: 500 }}>
                Tier {q.tier}
              </div>
            </div>
            {q.tier_justification && <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{q.tier_justification}</div>}
          </div>

          <div className="panel-card">
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Vendor link</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
              Share this link with the vendor to complete the questionnaire.
            </div>
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
