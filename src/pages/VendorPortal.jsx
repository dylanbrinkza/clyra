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
  const [saveStatus, setSaveStatus] = useState('')
  const [fileUploads, setFileUploads] = useState({}) // questionId -> [{name, url}]
  const [uploading, setUploading] = useState({})

  useEffect(() => { fetchQuestionnaire() }, [token])

  async function fetchQuestionnaire() {
    const { data: q, error: qErr } = await supabase
      .from('questionnaires')
      .select('*')
      .eq('token', token)
      .single()

    if (qErr || !q) { setError('Link not found. This questionnaire may have expired or been revoked.'); setLoading(false); return }
    if (q.status === 'completed') { setSubmitted(true); setLoading(false); return }

    setQuestionnaire(q)

    const { data: qs } = await supabase
      .from('questionnaire_questions')
      .select('*')
      .eq('questionnaire_id', q.id)
      .order('order_num')

    setQuestions(qs || [])

    // Load any previously saved answers
    const { data: savedResponses } = await supabase
      .from('questionnaire_responses')
      .select('*')
      .eq('questionnaire_id', q.id)

    if (savedResponses?.length > 0) {
      const savedAnswers = {}
      savedResponses.forEach(r => { savedAnswers[r.question_id] = r.answer })
      setAnswers(savedAnswers)
    }

    setLoading(false)
  }

  const saveProgress = async () => {
    if (!questionnaire) return
    setSaveStatus('Saving...')
    try {
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
          await supabase.from('questionnaire_responses').insert([{
            questionnaire_id: questionnaire.id,
            question_id: questionId,
            answer,
          }])
        }
      }
      setSaveStatus('Saved')
      setTimeout(() => setSaveStatus(''), 2000)
    } catch {
      setSaveStatus('Save failed')
    }
  }

  const handleFileUpload = async (questionId, file) => {
    if (!file) return
    setUploading(prev => ({ ...prev, [questionId]: true }))
    try {
      const path = `vendor-evidence/${questionnaire.id}/${questionId}/${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('certifications').upload(path, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('certifications').getPublicUrl(path)
      setFileUploads(prev => ({
        ...prev,
        [questionId]: [...(prev[questionId] || []), { name: file.name, url: publicUrl }]
      }))
      // Save file reference to response
      await supabase.from('questionnaire_responses').upsert([{
        questionnaire_id: questionnaire.id,
        question_id: questionId,
        answer: answers[questionId] || '',
        evidence_url: publicUrl,
        evidence_name: file.name,
      }], { onConflict: 'questionnaire_id,question_id' })
    } catch (err) {
      console.error('Upload failed:', err)
    }
    setUploading(prev => ({ ...prev, [questionId]: false }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')

    // Save all answers first — this is the most important step
    await saveProgress()

    // Mark as submitted — evaluation happens server-side after this
    const { error: submitError } = await supabase
      .from('questionnaires')
      .update({ status: 'completed', submitted_at: new Date().toISOString() })
      .eq('id', questionnaire.id)

    if (submitError) {
      setError('Failed to submit. Your answers are saved — please try again.')
      setSubmitting(false)
      return
    }

    // Trigger AI evaluation in the background (fire and forget — don't block the vendor)
    try {
      const allResponses = questions.map(q => ({ answer: answers[q.id] || '' }))
      fetch('/api/evaluate', {
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
          questions,
          responses: allResponses,
        }),
      }).then(async res => {
        if (!res.ok) return
        const evaluation = await res.json()
        if (!evaluation.verdict) return
        await supabase.from('questionnaires').update({
          verdict: evaluation.verdict,
          score: evaluation.score,
          summary: evaluation.summary,
          strengths: evaluation.strengths || null,
          recommendations: evaluation.recommendations || null,
          framework_assessment: evaluation.framework_assessment || null,
          approval_status: 'pending',
        }).eq('id', questionnaire.id)

        // Flag any evasive responses
        if (evaluation.flagged_responses?.length > 0) {
          for (const idx of evaluation.flagged_responses) {
            const q = questions[idx]
            if (q) {
              const { data: resp } = await supabase.from('questionnaire_responses').select('id').eq('questionnaire_id', questionnaire.id).eq('question_id', q.id).single()
              if (resp) await supabase.from('questionnaire_responses').update({ flagged: true }).eq('id', resp.id)
            }
          }
        }
      }).catch(() => {}) // Silent fail — assessor can still manually evaluate
    } catch {}

    setSubmitted(true)
    setSubmitting(false)
  }

  const answeredCount = questions.filter(q => answers[q.id]?.trim()).length
  const domains = [...new Set(questions.map(q => q.domain))]

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F7F3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B5E4F', fontSize: 13 }}>Loading...</div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#F7F3EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8, color: '#2C1F0E' }}>Link unavailable</div>
        <div style={{ fontSize: 13, color: '#6B5E4F', lineHeight: 1.6 }}>{error}</div>
      </div>
    </div>
  )

  if (submitted) return (
    <div style={{ minHeight: '100vh', background: '#F7F3EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '2rem' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 24px' }}>✓</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: '#2C1F0E', marginBottom: 12 }}>Questionnaire submitted</div>
        <div style={{ fontSize: 14, color: '#6B5E4F', lineHeight: 1.7 }}>
          Thank you for completing the security questionnaire for <strong>{questionnaire?.asset_name}</strong>. Your responses have been received and are being reviewed.
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F7F3EE', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#2C1F0E', color: '#F5F0E8', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 500 }}>Cly<em style={{ fontStyle: 'italic', color: '#D4A97A' }}>ra</em></div>
          <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.5)', marginTop: 2 }}>Vendor Security Questionnaire</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{questionnaire.asset_name}</div>
          <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.6)' }}>Tier {questionnaire.tier} · {answeredCount}/{questions.length} answered</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'rgba(44,31,14,0.1)' }}>
        <div style={{ height: 3, background: '#B5490A', transition: 'width 0.3s', width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }} />
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1rem' }}>
        {/* Intro */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem', border: '0.5px solid rgba(44,31,14,0.1)' }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: '#2C1F0E', marginBottom: 8 }}>Security questionnaire</div>
          <div style={{ fontSize: 13, color: '#6B5E4F', lineHeight: 1.6 }}>
            Please complete all questions as thoroughly as possible. Your responses are used to assess security controls and compliance posture. All information is treated confidentially.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, padding: '3px 10px', background: '#EAF3DE', borderRadius: 12, color: '#2E7D32' }}>{questions.length} questions</span>
            <span style={{ fontSize: 11, padding: '3px 10px', background: '#E6F1FB', borderRadius: 12, color: '#185FA5' }}>{domains.length} domains</span>
            <span style={{ fontSize: 11, padding: '3px 10px', background: '#FAEEDA', borderRadius: 12, color: '#854F0B' }}>Tier {questionnaire.tier} assessment</span>
          </div>
        </div>

        {/* Questions by domain */}
        {domains.map(domain => (
          <div key={domain} style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6B5E4F', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, paddingBottom: 8, borderBottom: '0.5px solid rgba(44,31,14,0.1)' }}>
              {domain}
            </div>
            {questions.filter(q => q.domain === domain).map((q, qi) => (
              <div key={q.id} style={{ background: '#fff', borderRadius: 10, padding: '1.25rem', marginBottom: 10, border: `0.5px solid ${answers[q.id]?.trim() ? 'rgba(46,125,50,0.2)' : 'rgba(44,31,14,0.1)'}` }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: answers[q.id]?.trim() ? '#EAF3DE' : 'rgba(44,31,14,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: answers[q.id]?.trim() ? '#2E7D32' : '#6B5E4F', flexShrink: 0, fontWeight: 500 }}>
                    {answers[q.id]?.trim() ? '✓' : q.order_num}
                  </div>
                  <div style={{ fontSize: 13, color: '#2C1F0E', lineHeight: 1.6, flex: 1 }}>{q.question}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginLeft: 32, marginBottom: 8 }}>
                  {q.control_ref && <span style={{ fontSize: 10, padding: '1px 6px', background: '#F5F0E8', borderRadius: 3, color: '#6B5E4F' }}>ISO {q.control_ref}</span>}
                  {q.nist_ref && <span style={{ fontSize: 10, padding: '1px 6px', background: '#E6F1FB', borderRadius: 3, color: '#185FA5' }}>NIST {q.nist_ref}</span>}
                  {q.cis_ref && <span style={{ fontSize: 10, padding: '1px 6px', background: '#EAF3DE', borderRadius: 3, color: '#2E7D32' }}>CIS {q.cis_ref}</span>}
                  {q.ce_ref && <span style={{ fontSize: 10, padding: '1px 6px', background: '#FAEEDA', borderRadius: 3, color: '#854F0B' }}>{q.ce_ref}</span>}
                </div>
                <textarea
                  value={answers[q.id] || ''}
                  onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                  onBlur={saveProgress}
                  placeholder="Enter your response..."
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', border: '0.5px solid rgba(44,31,14,0.2)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', background: '#FAFAF8', lineHeight: 1.5, marginLeft: 0 }}
                />
                {q.follow_up_trigger && answers[q.id]?.trim() && (
                  <div style={{ fontSize: 11, color: '#B5490A', marginTop: 6, paddingLeft: 2 }}>↳ {q.follow_up_trigger}</div>
                )}
                {/* Evidence upload */}
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 11, color: '#6B5E4F', cursor: 'pointer', padding: '4px 10px', border: '0.5px solid rgba(44,31,14,0.2)', borderRadius: 6, background: '#fff', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {uploading[q.id] ? 'Uploading...' : '+ Attach evidence'}
                    <input type="file" style={{ display: 'none' }} disabled={uploading[q.id]}
                      onChange={e => { if (e.target.files[0]) handleFileUpload(q.id, e.target.files[0]); e.target.value = '' }} />
                  </label>
                  {fileUploads[q.id]?.map((f, fi) => (
                    <span key={fi} style={{ fontSize: 11, color: '#2E7D32', padding: '4px 8px', background: '#EAF3DE', borderRadius: 6 }}>
                      ✓ {f.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* Submit */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', border: '0.5px solid rgba(44,31,14,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#2C1F0E', marginBottom: 4 }}>Submit questionnaire</div>
              <div style={{ fontSize: 12, color: '#6B5E4F' }}>{answeredCount} of {questions.length} questions answered</div>
            </div>
            {saveStatus && <div style={{ fontSize: 12, color: saveStatus === 'Saved' ? '#2E7D32' : '#6B5E4F' }}>{saveStatus}</div>}
          </div>
          {answeredCount < questions.length && (
            <div style={{ fontSize: 12, color: '#854F0B', padding: '8px 12px', background: '#FAEEDA', borderRadius: 6, marginBottom: 12 }}>
              {questions.length - answeredCount} question{questions.length - answeredCount !== 1 ? 's' : ''} unanswered. You can still submit but unanswered questions may affect the assessment.
            </div>
          )}
          {error && <div style={{ fontSize: 12, color: '#C0392B', padding: '8px 12px', background: '#FCEBEB', borderRadius: 6, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={saveProgress} style={{ flex: 1, padding: '10px', background: 'none', border: '0.5px solid rgba(44,31,14,0.2)', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: '#6B5E4F' }}>
              Save progress
            </button>
            <button onClick={handleSubmit} disabled={submitting} style={{ flex: 2, padding: '10px', background: '#2C1F0E', color: '#F5F0E8', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, fontFamily: 'inherit' }}>
              {submitting ? 'Submitting...' : 'Submit questionnaire'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
