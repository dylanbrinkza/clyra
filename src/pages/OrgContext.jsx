import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { clearOrgContextCache } from '../lib/orgContext'
import { getOrgId, getUserRole } from '../lib/auth'

const industries = ['Financial Services', 'Healthcare', 'Legal', 'Technology', 'Retail & eCommerce', 'Hospitality & Tourism', 'Manufacturing', 'Education', 'Government & Public Sector', 'Professional Services', 'Media & Entertainment', 'Energy & Utilities', 'Other']
const employeeCounts = ['1–10', '11–50', '51–200', '201–500', '501–1,000', '1,001–5,000', '5,000+']
const dataSubjectCounts = ['Under 1,000', '1,000–10,000', '10,000–100,000', '100,000–1,000,000', 'Over 1,000,000']
const riskAppetites = ['Very low — we minimise risk wherever possible', 'Low — we accept limited risk with strong controls in place', 'Medium — we take a balanced approach to risk', 'High — we are comfortable taking on significant risk']
const techEnvironments = ['Cloud-first (majority SaaS/PaaS)', 'Hybrid (mix of cloud and on-premise)', 'On-premise majority', 'Multi-cloud', 'Legacy/mainframe heavy']

const regulatoryOptions = ['GDPR (UK)', 'GDPR (EU)', 'FCA regulations', 'PCI DSS', 'NHS DSP Toolkit', 'HIPAA', 'SOX', 'NIS2 Directive', 'DORA', 'ISO 27001 (certified)', 'Cyber Essentials (certified)', 'NIST CSF', 'CCPA', 'Other']
const dataTypeOptions = ['Personal data (names, emails, addresses)', 'Financial data (payment, banking)', 'Health / medical data', 'Children\'s data (under 18)', 'Biometric data', 'Criminal record data', 'Employee data (HR)', 'Intellectual property', 'Government / classified data', 'Non-personal / operational data only']
const certOptions = ['ISO 27001', 'ISO 27701', 'SOC 2 Type II', 'Cyber Essentials', 'Cyber Essentials Plus', 'PCI DSS', 'HIPAA', 'None currently held']

const MultiSelect = ({ options, selected, onChange, placeholder }) => {
  const toggle = (opt) => onChange(selected.includes(opt) ? selected.filter(o => o !== opt) : [...selected, opt])
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {options.map(opt => (
        <div key={opt} onClick={() => toggle(opt)} style={{
          padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', userSelect: 'none',
          border: `1px solid ${selected.includes(opt) ? 'var(--orange)' : 'rgba(44,31,14,0.2)'}`,
          background: selected.includes(opt) ? '#FFF7F2' : '#fff',
          color: selected.includes(opt) ? 'var(--orange)' : 'var(--muted)',
          fontWeight: selected.includes(opt) ? 500 : 400,
        }}>
          {selected.includes(opt) ? '✓ ' : ''}{opt}
        </div>
      ))}
    </div>
  )
}

export default function OrgContext() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [contextId, setContextId] = useState(null)
  const [form, setForm] = useState({
    company_name: '',
    industry: '',
    employee_count: '',
    countries: [],
    regulatory_frameworks: [],
    data_types: [],
    data_subject_count: '',
    special_category_data: false,
    tech_environment: '',
    existing_certifications: [],
    risk_appetite: '',
    compliance_notes: '',
  })

  useEffect(() => {
    fetchContext()
    getUserRole().then(r => setIsAdmin(r === 'admin' || r === 'org_admin'))
  }, [])

  async function fetchContext() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('organisation_context').select('*').eq('user_id', user.id).single()
    if (data) {
      setContextId(data.id)
      setForm({
        company_name: data.company_name || '',
        industry: data.industry || '',
        employee_count: data.employee_count || '',
        countries: data.countries || [],
        regulatory_frameworks: data.regulatory_frameworks || [],
        data_types: data.data_types || [],
        data_subject_count: data.data_subject_count || '',
        special_category_data: data.special_category_data || false,
        tech_environment: data.tech_environment || '',
        existing_certifications: data.existing_certifications || [],
        risk_appetite: data.risk_appetite || '',
        compliance_notes: data.compliance_notes || '',
      })
    }
    setLoading(false)
  }

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    const { data: { user } } = await supabase.auth.getUser()
    const orgId = await getOrgId()
    const payload = { ...form, user_id: user.id, org_id: orgId, updated_at: new Date().toISOString() }

    if (contextId) {
      await supabase.from('organisation_context').update(payload).eq('id', contextId)
    } else {
      const { data } = await supabase.from('organisation_context').insert([payload]).select().single()
      if (data) setContextId(data.id)
    }
    setSaving(false)
    clearOrgContextCache()
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const completeness = () => {
    const fields = ['company_name', 'industry', 'employee_count', 'tech_environment', 'risk_appetite']
    const arrays = ['regulatory_frameworks', 'data_types']
    const filled = fields.filter(f => form[f]).length + arrays.filter(f => form[f].length > 0).length
    return Math.round((filled / (fields.length + arrays.length)) * 100)
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading...</div>

  const pct = completeness()

  return (
    <>
      <div className="page-header">
        <div>
          <h2 style={{ marginBottom: 4 }}>Organisation context</h2>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>This information is used by Claude to personalise all risk assessments, questionnaires, and recommendations to your organisation's specific situation.</div>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !isAdmin}>
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save context'}
        </button>
      </div>

      {!isAdmin && (
        <div style={{ background: '#FAEEDA', border: '0.5px solid var(--amber)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#854F0B' }}>
          ⚠ You have view-only access to organisation context. Contact your org admin to make changes.
        </div>
      )}
      {/* Completeness bar */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Context completeness</span>
          <span style={{ fontSize: 13, color: pct === 100 ? 'var(--green)' : pct >= 60 ? 'var(--amber)' : 'var(--red)', fontWeight: 500 }}>{pct}%</span>
        </div>
        <div style={{ height: 6, background: 'var(--cream2)', borderRadius: 3 }}>
          <div style={{ height: 6, borderRadius: 3, width: `${pct}%`, transition: 'width 0.4s', background: pct === 100 ? 'var(--green)' : pct >= 60 ? 'var(--amber)' : 'var(--orange)' }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
          {pct < 60 ? 'Add more context to improve the quality of AI assessments.' : pct < 100 ? 'Good — fill in remaining fields for best results.' : 'Context is complete — Claude has full organisational context for assessments.'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', pointerEvents: isAdmin ? 'auto' : 'none', opacity: isAdmin ? 1 : 0.7 }}>

        {/* LEFT COLUMN */}
        <div>
          <div className="card">
            <div className="card-header"><span className="card-title">Organisation basics</span></div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Company name</label>
              <input value={form.company_name} onChange={e => set('company_name', e.target.value)} placeholder="Acme Corp" style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Industry</label>
                <select value={form.industry} onChange={e => set('industry', e.target.value)} style={inputStyle}>
                  <option value="">Select...</option>
                  {industries.map(i => <option key={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Employee count</label>
                <select value={form.employee_count} onChange={e => set('employee_count', e.target.value)} style={inputStyle}>
                  <option value="">Select...</option>
                  {employeeCounts.map(e => <option key={e}>{e}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Primary countries of operation</label>
              <input
                value={form.countries.join(', ')}
                onChange={e => set('countries', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="United Kingdom, Ireland, United States..."
                style={inputStyle}
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Comma separated</div>
            </div>

            <div style={{ marginBottom: 4 }}>
              <label style={labelStyle}>Technical environment</label>
              <select value={form.tech_environment} onChange={e => set('tech_environment', e.target.value)} style={inputStyle}>
                <option value="">Select...</option>
                {techEnvironments.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Risk & compliance</span></div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Risk appetite</label>
              <select value={form.risk_appetite} onChange={e => set('risk_appetite', e.target.value)} style={inputStyle}>
                <option value="">Select...</option>
                {riskAppetites.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Regulatory frameworks you operate under</label>
              <MultiSelect options={regulatoryOptions} selected={form.regulatory_frameworks} onChange={v => set('regulatory_frameworks', v)} />
            </div>

            <div style={{ marginBottom: 4 }}>
              <label style={labelStyle}>Additional compliance notes</label>
              <textarea
                value={form.compliance_notes}
                onChange={e => set('compliance_notes', e.target.value)}
                placeholder="e.g. We are FCA authorised and subject to SYSC rules. We are currently working towards ISO 27001 certification. We have an upcoming PCI QSA audit in Q3..."
                rows={4}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          <div className="card">
            <div className="card-header"><span className="card-title">Data landscape</span></div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Types of data you hold and process</label>
              <MultiSelect options={dataTypeOptions} selected={form.data_types} onChange={v => set('data_types', v)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Approximate number of data subjects</label>
                <select value={form.data_subject_count} onChange={e => set('data_subject_count', e.target.value)} style={inputStyle}>
                  <option value="">Select...</option>
                  {dataSubjectCounts.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Special category data?</label>
                <select value={form.special_category_data ? 'yes' : 'no'} onChange={e => set('special_category_data', e.target.value === 'yes')} style={inputStyle}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Health, biometric, racial/ethnic origin, political opinions etc.</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Your certifications</span></div>
            <div style={{ marginBottom: 4 }}>
              <label style={labelStyle}>Certifications your organisation currently holds</label>
              <MultiSelect options={certOptions} selected={form.existing_certifications} onChange={v => set('existing_certifications', v)} />
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
                Claude uses this to understand your baseline security posture and calibrate vendor requirements appropriately. If you hold ISO 27001, for example, Claude will hold vendors to a commensurate standard.
              </div>
            </div>
          </div>

          <div className="card" style={{ background: 'var(--brown)', color: '#F5F0E8' }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>How this context is used</div>
            <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.7)', lineHeight: 1.6 }}>
              Every AI assessment, questionnaire, and recommendation is personalised using this context. Claude will frame findings in terms of your specific regulatory obligations, risk appetite, and data landscape — not generic best practice.
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                'Tier assignments weighted against your regulatory environment',
                'Questionnaire questions specific to your data types and frameworks',
                'Findings framed as regulatory risks, not just security gaps',
                'Recommendations prioritised against your risk appetite',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'rgba(245,240,232,0.8)' }}>
                  <span style={{ color: '#D4A97A', flexShrink: 0 }}>✦</span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 6 }
const inputStyle = { width: '100%', padding: '9px 12px', border: '0.5px solid rgba(44,31,14,0.25)', borderRadius: 8, fontSize: 13, background: '#fff', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }
