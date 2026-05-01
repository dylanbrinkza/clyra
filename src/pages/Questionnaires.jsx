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

const options = [
  'Contract performance only',
  'Contract + legitimate interests',
  'Contract + consent where required',
  'Other / varies by jurisdiction',
]

export default function Questionnaires() {
  const [selected, setSelected] = useState(2)

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
    </>
  )
}
