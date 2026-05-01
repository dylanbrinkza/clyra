import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const dotColor = { red: 'var(--red)', amber: 'var(--amber)', green: 'var(--green)' }

export default function IncidentDetail() {
  const { id } = useParams()
  const [incident, setIncident] = useState(null)
  const [actions, setActions] = useState([])
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchAll() {
      const [incRes, actRes] = await Promise.all([
        supabase.from('incidents').select('*').eq('id', id).single(),
        supabase.from('incident_actions').select('*').eq('incident_id', id).order('id'),
      ])
      if (!incRes.error) {
        setIncident(incRes.data)
        if (incRes.data.asset_id) {
          const { data: contactData } = await supabase.from('contacts').select('*').eq('asset_id', incRes.data.asset_id)
          if (contactData) setContacts(contactData)
        }
      }
      if (!actRes.error) setActions(actRes.data)
      setLoading(false)
    }
    fetchAll()
  }, [id])

  const toggleAction = async (actionId, currentDone) => {
    const { data } = await supabase
      .from('incident_actions')
      .update({ done: !currentDone })
      .eq('id', actionId)
      .select()
    if (data) {
      setActions(prev => prev.map(a => a.id === actionId ? { ...a, done: !currentDone } : a))
    }
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div>
  if (!incident) return (
    <div>
      <div className="breadcrumb"><Link to="/incidents">Incidents</Link> › Not found</div>
      <p>Incident not found.</p>
    </div>
  )

  const affectedIntegrations = [
    { name: 'Hubspot — CRM sync disabled', status: 'red' },
    { name: 'Slack — notification integration — monitor', status: 'amber' },
    { name: 'Docusign — no data shared — low risk', status: 'green' },
  ]

  const steps = [
    { num: 1, title: 'Triage complete', status: 'complete', desc: 'Suspected unauthorised access to customer records. Scope: unknown. Data type: personal data including email and financial data.' },
    { num: 2, title: 'Containment — in progress', status: 'active', desc: 'Complete the steps below. Clyra has identified three connected assets that may be affected.', showActions: true },
    { num: 3, title: 'Assess impact', status: 'pending', desc: '' },
    { num: 4, title: 'Notifications', status: 'pending', desc: '' },
  ]

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

      {incident.status === 'resolved' ? (
        <div className="card" style={{ color: 'var(--muted)', fontSize: 13 }}>This incident has been resolved. No active steps.</div>
      ) : (
        <div className="dash-grid">
          <div>
            {steps.map(step => (
              <div key={step.num} className="step-row">
                <div className={`step-num ${step.status === 'complete' ? 'complete' : step.status === 'active' ? 'active-step' : 'pending'}`}>
                  {step.num}
                </div>
                <div className="step-content">
                  <div className={`step-title${step.status === 'pending' ? ' pending' : ''}`}>{step.title}</div>
                  {step.desc && <div className="step-desc">{step.desc}</div>}
                  {step.showActions && actions.length > 0 && (
                    <div className="checklist">
                      <div className="checklist-title">Immediate actions</div>
                      {actions.map(action => (
                        <div key={action.id} className="check-item" onClick={() => toggleAction(action.id, action.done)}>
                          <div className={`checkbox${action.done ? ' checked' : ''}`}>
                            {action.done ? '✓' : ''}
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

            <div className="affected-box">
              <div className="affected-title">Affected integrations</div>
              {affectedIntegrations.map((int, i) => (
                <div key={i} className="int-row">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor[int.status], flexShrink: 0 }}></div>
                  {int.name}
                </div>
              ))}
            </div>

            {contacts.length > 0 && (
              <div className="affected-box">
                <div className="affected-title">Escalation contacts</div>
                {contacts.map((c) => (
                  <div key={c.id} className="contact-row">
                    <div className="contact-avatar">{c.initials}</div>
                    <div>
                      <div className="contact-name">{c.name}</div>
                      <div className="contact-role">{c.role}</div>
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
