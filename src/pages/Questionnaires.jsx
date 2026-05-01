import { useState } from 'react'

const sections = [
  { label: 'Access control', status: 'complete' },
  { label: 'Information security', status: 'complete' },
  { label: 'Data protection', status: 'active' },
  { label: 'Incident management', status: 'pending' },
  { label: 'Third-party mgmt', status: 'pending' },
  { label: 'Vulnerability mgmt', status: 'pending' },
  { label: 'Compliance', status: 'pending' },
]

const sampleResponses = [
  { question: 'Do you enforce MFA for all admin users?', answer: 'MFA is enforced for most users but not for API access accounts.' },
  { question: 'Do you have an information security policy?', answer: 'Yes, reviewed annually and aligned to ISO 27001.' },
  { question: 'Which legal bases do you rely on for processing personal data?', answer: 'Contract + consent where required.' },
  { question: 'Do you have a documented incident response plan?', answer: 'Yes, tested bi-annually with tabletop exercises.' },
  { question: 'Do you conduct regular vulnerability scanning?', answer: 'Yes, weekly automated scans plus annual penetration testing.' },
  { question: 'Do you disclose your sub-processors in your DPA?', answer: 'Sub-processors are listed on our website but not in the DPA itself.' },
]

const options = [
  'Contract performance only',
  'Contract + legitimate interests',
  'Contract + consent where required',
  'Other / varies by jurisdiction',
]

export default function Questionnaires() {
  const [selected, setSelected] = useState(2)
  const [assessing, setAssessing] = useState(false)
  const [assessment, setAssessment] = useState(null)
  const [error, setError] = useState('')

  const runAssessment = async () => {
    setAssessing(true)
    setError('')
    setAssessment(null)
    try {
      const res = await fetch('/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetName: 'Salesforce CRM',
          tier: 1,
          responses: sampleResponses,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Assessment failed')
      setAssessment(data)
    } catch (err) {
      setError(err.message)
    }
    setAssessing(false)
  }

  const severityColor = { Required: 'var(--red)', Recommended: 'var(--amber)', Advisory: '#aaa' }
  const verdictColor = {
    'Accept': 'var(--green)',
    'Accept with conditions': 'var(--amber)',
    'Escalate for further review': 'var(--amber)',
    'Do not proceed': 'var(--red)',
  }

  return (
    <>
      <div className="page-header">
        <h2>Questionnaires</h2>
        <button className="btn btn-primary">+ Send questionnaire</button>
      </div>

      <div className="card">
        <div className="q-layout">
          <div className="q-sidebar">
            {sections.map((s, i) => (
              <div key={i} className={`q-section-item${s.status === 'active' ? ' active-section' : ''}`}>
                <div className={`q-section-dot${s.status === 'complete' ? ' complete' : s.status === 'active' ? ' active-q' : ''}`}>
                  {s.status === 'complete' ? '✓' : ''}
                </div>
                {s.label}
              </div>
            ))}
          </div>
          <div className="q-main">
            <div className="q-meta">Question 13 of 42 · Data protection</div>
            <div className="q-text">Which legal bases do you rely on for processing personal data provided by your clients?</div>
            {options.map((opt, i) => (
              <div key={i} className={`q-option${selected === i ? ' selected' : ''}`} onClick={() => setSelected(i)}>
                <div className={`q-radio${selected === i ? ' selected' : ''}`}></div>
                {opt}
              </div>
            ))}
            {selected === 2 && (
              <div className="q-follow-up">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginTop: 1, flexShrink: 0 }}>
                  <circle cx="8" cy="8" r="6"/><path d="M8 5v3.5M8 11v.5"/>
                </svg>
                As a Tier 1 vendor with access to special category data, Clyra will ask a follow-up question about your consent management process.
              </div>
            )}
            <div className="q-nav">
              <button className="btn">← Previous</button>
              <button className="btn btn-primary">Next →</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">AI Assessment</span>
          <button className="btn btn-primary" onClick={runAssessment} disabled={assessing}>
            {assessing ? 'Assessing...' : 'Run AI assessment'}
          </button>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: 'var(--red)', padding: '10px 12px', background: '#FCEBEB', borderRadius: 6, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {assessing && (
          <div style={{ fontSize: 13, color: 'var(--muted)', padding: '1rem 0' }}>
            Claude is reviewing the questionnaire responses...
          </div>
        )}

        {assessment && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, padding: '1rem', background: 'var(--cream)', borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Risk score</div>
                <div style={{ fontSize: 28, fontWeight: 500 }}>{assessment.score}</div>
              </div>
              <div style={{ width: 1, height: 40, background: 'var(--border)' }}></div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Verdict</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: verdictColor[assessment.verdict] || 'var(--text)' }}>
                  {assessment.verdict}
                </div>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 16 }}>{assessment.summary}</p>

            {assessment.findings?.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10 }}>Findings</div>
                {assessment.findings.map((f, i) => (
                  <div key={i} className="finding-row">
                    <div className="finding-dot" style={{ background: severityColor[f.severity] || '#aaa' }}></div>
                    <div className="finding-text">
                      {f.text}
                      {f.control && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{f.control}</span>}
                    </div>
                    <span className={`finding-badge ${(f.severity || '').toLowerCase()}`}>{f.severity}</span>
                  </div>
                ))}
              </div>
            )}

            {assessment.strengths?.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10 }}>Strengths</div>
                {assessment.strengths.map((s, i) => (
                  <div key={i} className="finding-row">
                    <div className="finding-dot" style={{ background: 'var(--green)' }}></div>
                    <div className="finding-text">{s}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
