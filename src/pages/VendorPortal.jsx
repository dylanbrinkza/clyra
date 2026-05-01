import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function VendorPortal() {
  const { token } = useParams()
  const [questionnaire, setQuestionnaire] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [currentDomain, setCurrentDomain] = useState(null)

  useEffect(() => {
    async function fetchQuestionnaire() {
      const { data: qData, error: qError } = await supabase
        .from('questionnaires')
        .select('*')
        .eq('token', token)
        .single()

      if (qError || !qData) { setError('Questionnaire not found or link has expired.'); setLoading(false); return }
      if (qData.status === 'completed') { setSubmitted(true); setLoading(false); return }

      const { data: qqData } = await supabase
        .from('questionnaire_questions')
        .select('*')
        .eq('questionnaire_id', qData.id)
        .order('order_num')

      setQuestionnaire(qData)
      setQuestions(qqData || [])

      const existingAnswers = {}
      const { data: responses } = await supabase
        .from('questionnaire_responses')
        .select('*')
        .eq('questionnaire_id', qData.id)
      responses?.forEach(r => { existingAnswers[r.question_id] = r.answer })
      setAnswers(existingAnswers)

      const domains = [...new Set((qqData || []).map(q => q.domain))]
      setCurrentDomain(domains[0])
      setLoading(false)
    }
    fetchQuestionnaire()
  }, [token])

  const domains = [...new Set(questions.map(q => q.domain))]
  const currentQuestions = questions.filter(q => q.domain === currentDomain)
  const currentDomainIndex = domains.indexOf(currentDomain)
  const answeredInDomain = currentQuestions.filter(q => answers[q.id]?.trim()).length
  const totalAnswered = questions.filter(q => answers[q.id]?.trim()).length

  const saveProgress = async () => {
    for (const [questionId, answer] of Object.entries(answers)) {
      if (!answer?.trim()) continue
      const { data: existing } = await supabase
        .from('questionnaire_responses')
        .select('id')
        .eq('questionnaire_id', questionnaire.id)
        .eq('question_id', questionId)
        .single()

      if (existing) {
        await supabase.from('questionnaire_responses').update({ answer }).eq('id', existing.id)
      } else {
        await supabase.from('questionnaire_responses').insert([{ questionnaire_id: questionnaire.id, question_id: questionId, answer }])
      }
    }
  }

  const handleNext = async () => {
    await saveProgress()
    const nextIndex = currentDomainIndex + 1
    if (nextIndex < domains.length) setCurrentDomain(domains[nextIndex])
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    await saveProgress()

    const allQuestions = questions
    const allResponses = allQuestions.map(q => ({ answer: answers[q.id] || '' }))

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetName: questionnaire.asset_name,
          tier: questionnaire.tier,
          profile: {
            data_sensitivity: questionnaire.data_sensitivity,
            network_access: questionnaire.network_access,
            integration_depth: questionnaire.integration_depth,
            criticality: questionnaire.criticality,
          },
          questions: allQuestions,
          responses: allResponses,
        }),
      })
      const evaluation = await res.json()

      await supabase.from('questionnaires').update({
        status: 'completed',
        verdict: evaluation.verdict,
        score: evaluation.score,
        summary: evaluation.summary,
        submitted_at: new Date().toISOString(),
      }).eq('id', questionnaire.id)

      if (evaluation.flagged_responses?.length > 0) {
        for (const idx of evaluation.flagged_responses) {
          const q = allQuestions[idx]
          if (q) {
            const { data: resp } = await supabase.from('questionnaire_responses').select('id').eq('questionnaire_id', questionnaire.id).eq('question_id', q.id).single()
            if (resp) await supabase.from('questionnaire_responses').update({ flagged: true }).eq('id', resp.id)
          }
        }
      }

      setSubmitted(true)
    } catch (err) {
      setError('Submission failed. Please try again.')
    }
    setSubmitting(false)
  }

  if (loading) return (
    <div style={portalWrap}>
      <div style={portalCard}><div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading questionnaire...</div></div>
    </div>
  )

  if (error) return (
    <div style={portalWrap}>
      <div style={portalCard}>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Link not found</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{error}</div>
      </div>
    </div>
  )

  if (submitted) return (
    <div style={portalWrap}>
      <div style={{ ...portalCard, textAlign: 'center', padding: '3rem 2rem' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 20 }}>✓</div>
        <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 8 }}>Questionnaire submitted</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          Thank you for completing the security questionnaire for {questionnaire?.asset_name}. Your responses have been received and will be reviewed.
        </div>
      </div>
    </div>
  )

  const isLastDomain = currentDomainIndex === domains.length - 1
  const progress = Math.round((totalAnswered / questions.length) * 100)

  return (
    <div style={portalWrap}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Security questionnaire</div>
          <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>{questionnaire.asset_name}</div>
          <div style={{ height: 4, background: 'rgba(44,31,14,0.1)', borderRadius: 2, marginTop: 12 }}>
            <div style={{ height: 4, background: 'var(--orange)', borderRadius: 2, width: `${progress}%`, transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{totalAnswered} of {questions.length} answered</div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {domains.map((d, i) => {
            const dQuestions = questions.filter(q => q.domain === d)
            const dAnswered = dQuestions.filter(q => answers[q.id]?.trim()).length
            const complete = dAnswered === dQuestions.length
            return (
              <div key={d} onClick={() => setCurrentDomain(d)} style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 12, cursor: 'pointer',
                background: d === currentDomain ? 'var(--brown)' : complete ? '#EAF3DE' : 'var(--cream2)',
                color: d === currentDomain ? '#F5F0E8' : complete ? 'var(--green)' : 'var(--muted)',
                fontWeight: d === currentDomain ? 500 : 400,
              }}>
                {complete && d !== currentDomain ? '✓ ' : ''}{d}
              </div>
            )
          })}
        </div>

        <div style={{ background: '#fff', border: '0.5px solid var(--border)', borderRadius: 12, padding: '1.5rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
            {currentDomain}
          </div>
          {currentQuestions.map((q, i) => (
            <div key={q.id} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0, paddingTop: 1 }}>{q.order_num}.</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, marginBottom: 4, lineHeight: 1.5 }}>{q.question}</div>
                  {q.control_ref && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{q.control_ref}</div>}
                </div>
              </div>
              <textarea
                value={answers[q.id] || ''}
                onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Enter your response..."
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', border: '0.5px solid rgba(44,31,14,0.2)',
                  borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
                  background: answers[q.id]?.trim() ? '#FAFFF7' : '#fff',
                  outline: 'none', color: 'var(--text)',
                }}
              />
              {q.follow_up_trigger && answers[q.id]?.toLowerCase().includes('yes') && (
                <div style={{ fontSize: 11, color: 'var(--orange)', marginTop: 4, padding: '6px 10px', background: '#FFF7F2', borderRadius: 6 }}>
                  ↳ {q.follow_up_trigger}
                </div>
              )}
            </div>
          ))}
        </div>

        {error && <div style={{ fontSize: 12, color: 'var(--red)', padding: '8px 12px', background: '#FCEBEB', borderRadius: 6, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          {currentDomainIndex > 0 && (
            <button className="btn" onClick={() => setCurrentDomain(domains[currentDomainIndex - 1])} style={{ flex: 1 }}>← Previous</button>
          )}
          {!isLastDomain ? (
            <button className="btn btn-primary" onClick={handleNext} style={{ flex: 2 }}>
              Save & continue →
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting} style={{ flex: 2 }}>
              {submitting ? 'Submitting & evaluating...' : 'Submit questionnaire'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const portalWrap = { minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }
const portalCard = { background: '#fff', border: '0.5px solid var(--border)', borderRadius: 12, padding: '2rem', maxWidth: 480, width: '100%', margin: '4rem 1rem' }
