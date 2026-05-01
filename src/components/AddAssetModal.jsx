import { useState } from 'react'
import { supabase } from '../lib/supabase'

const initialForm = {
  name: '',
  type: 'SaaS',
  tier: 1,
  status: 'Not assessed',
  last_assessed: 'Pending',
  review_due: '',
  integrations: '',
}

const tierReviewDue = { 1: '12 months', 2: '12 months', 3: '2 years', 4: '3 years' }

export default function AddAssetModal({ onClose, onAdded }) {
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (field, value) => setForm(prev => ({
    ...prev,
    [field]: value,
    ...(field === 'tier' ? { review_due: tierReviewDue[value] } : {}),
  }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const id = form.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    const integrations = form.integrations
      ? form.integrations.split(',').map(s => s.trim()).filter(Boolean)
      : []

    const { data, error } = await supabase.from('assets').insert([{
      id,
      name: form.name,
      type: form.type,
      tier: parseInt(form.tier),
      rag: 'amber',
      score: 50,
      status: form.status,
      last_assessed: form.last_assessed,
      review_due: form.review_due || tierReviewDue[form.tier],
      integrations,
    }]).select()

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    onAdded(data[0])
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
    }}>
      <div onClick={onClose} style={{
        position: 'absolute', inset: 0, background: 'rgba(26,18,8,0.35)',
      }} />

      <div style={{
        position: 'relative', width: 480, height: '100vh',
        background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
        display: 'flex', flexDirection: 'column', zIndex: 1,
      }}>
        <div style={{
          padding: '1.5rem', borderBottom: '0.5px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>Add asset</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Register a new vendor or technology asset</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 20, color: 'var(--muted)', lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Asset name *</label>
            <input
              required
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Salesforce CRM"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Asset type *</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} style={inputStyle}>
                <option>SaaS</option>
                <option>Cloud infra</option>
                <option>Managed service</option>
                <option>Physical asset</option>
                <option>Internal tool</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Risk tier *</label>
              <select value={form.tier} onChange={e => set('tier', parseInt(e.target.value))} style={inputStyle}>
                <option value={1}>Tier 1 — Critical</option>
                <option value={2}>Tier 2 — High</option>
                <option value={3}>Tier 3 — Medium</option>
                <option value={4}>Tier 4 — Low</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Initial status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} style={inputStyle}>
              <option>Not assessed</option>
              <option>Questionnaire overdue</option>
              <option>In assessment</option>
              <option>Awaiting response</option>
              <option>Assured</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Integrations</label>
            <input
              value={form.integrations}
              onChange={e => set('integrations', e.target.value)}
              placeholder="Slack, Hubspot, SSO via Okta (comma separated)"
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Separate multiple integrations with commas</div>
          </div>

          <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Tier {form.tier} — review schedule</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {form.tier === 1 || form.tier === 2
                ? 'Annual full review required'
                : form.tier === 3
                ? 'Review every two years'
                : 'Review every three years or on contract renewal'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              First review due: <strong>{tierReviewDue[form.tier]}</strong>
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: 'var(--red)', padding: '8px 12px', background: '#FCEBEB', borderRadius: 6, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} className="btn" style={{ flex: 1 }}>Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ flex: 2 }}>
              {saving ? 'Saving...' : 'Add asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const labelStyle = {
  fontSize: 12, fontWeight: 500, color: 'var(--muted)',
  display: 'block', marginBottom: 6,
}

const inputStyle = {
  width: '100%', padding: '9px 12px',
  border: '0.5px solid rgba(44,31,14,0.25)',
  borderRadius: 8, fontSize: 13,
  background: '#fff', color: 'var(--text)',
  outline: 'none', fontFamily: 'inherit',
}
