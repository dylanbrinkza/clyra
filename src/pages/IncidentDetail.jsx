import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { incidents } from '../data/mockData'

const dotColor = { red: 'var(--red)', amber: 'var(--amber)', green: 'var(--green)' }

export default function IncidentDetail() {
  const { id } = useParams()
  const incident = incidents.find(i => i.id === id)

  const [checkedItems, setCheckedItems] = useState(() => {
    const initial = {}
    incident?.steps?.forEach(step => {
      step.actions?.forEach(a => { initial[a.id] = a.done })
    })
    return initial
  })

  if (!incident) return (
    <div>
      <div className="breadcrumb"><Link to="/incidents">Incidents</Link> › Not found</div>
      <p>Incident not found.</p>
    </div>
  )

  const toggle = (id) => setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <>
      <div className="breadcrumb">
        <Link to="/incidents">Incidents</Link> › {incident.title}
      </div>

      <div className="incident-header">
        {incident.status === 'active' && <span className="incident-badge">Active incident</span>}
        <div className="incident-meta">Incident response · {incident.asset}</div>
        <div className="incident-title">{incident.title}</div>
        <div className="incident-sub">Triggered {incident.triggered} · {incident.asset} · Tier 1 asset</div>
      </div>

      {incident.steps.length === 0 ? (
        <div className="card" style={{ color: 'var(--muted)', fontSize: 13 }}>This incident has been resolved. No active steps.</div>
      ) : (
        <div className="dash-grid">
          <div>
            {incident.steps.map((step) => (
              <div key={step.num} className="step-row">
                <div className={`step-num ${step.status === 'complete' ? 'complete' : step.status === 'active' ? 'active-step' : 'pending'}`}>
                  {step.num}
                </div>
                <div className="step-content">
                  <div className={`step-title${step.status === 'pending' ? ' pending' : ''}`}>{step.title}</div>
                  {step.desc && <div className="step-desc">{step.desc}</div>}
                  {step.actions && (
                    <div className="checklist">
                      <div className="checklist-title">Immediate actions</div>
                      {step.actions.map(action => (
                        <div key={action.id} className="check-item" onClick={() => toggle(action.id)}>
                          <div className={`checkbox${checkedItems[action.id] ? ' checked' : ''}`}>
                            {checkedItems[action.id] ? '✓' : ''}
                          </div>
                          {action.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div>
            <div className="reg-box">
              <div className="reg-box-title">Regulatory notification window</div>
              <div className="reg-box-text">
                Under UK GDPR Article 33, you have 72 hours from becoming aware of this breach to notify the ICO if it is likely to result in a risk to individuals. Clock started at {incident.triggered}.
              </div>
            </div>

            {incident.affectedIntegrations.length > 0 && (
              <div className="affected-box">
                <div className="affected-title">Affected integrations</div>
                {incident.affectedIntegrations.map((int, i) => (
                  <div key={i} className="int-row">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor[int.status], flexShrink: 0 }}></div>
                    {int.name}
                  </div>
                ))}
              </div>
            )}

            {incident.contacts.length > 0 && (
              <div className="affected-box">
                <div className="affected-title">Escalation contacts</div>
                {incident.contacts.map((c, i) => (
                  <div key={i} className="contact-row">
                    <div className="contact-avatar">{c.initials}</div>
                    <div>
                      <div className="contact-name">{c.name}</div>
                      <div className={`contact-role${c.urgent ? ' urgent' : ''}`}>
                        {c.role} · {c.note}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
