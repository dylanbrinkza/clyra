import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { clearOrgContextCache } from '../lib/orgContext'

const industries = ['Financial Services', 'Healthcare', 'Legal', 'Technology', 'Retail & eCommerce', 'Manufacturing', 'Education', 'Government & Public Sector', 'Professional Services', 'Media & Entertainment', 'Energy & Utilities', 'Other']
const employeeCounts = ['1–10', '11–50', '51–200', '201–500', '501–1,000', '1,001–5,000', '5,000+']
const riskAppetites = ['Very low — we avoid risk wherever possible', 'Low — we accept minimal risk with strong controls', 'Medium — we balance risk and opportunity', 'High — we accept more risk to enable growth']
const techEnvironments = ['Cloud-first (majority SaaS/PaaS)', 'Hybrid (mix of cloud and on-premise)', 'On-premise majority', 'Multi-cloud', 'Legacy/mainframe heavy']
const regulatoryOptions = ['GDPR (UK)', 'GDPR (EU)', 'FCA regulations', 'PCI DSS', 'NHS DSP Toolkit', 'HIPAA', 'SOX', 'NIS2 Directive', 'DORA', 'ISO 27001 (certified)', 'Cyber Essentials (certified)', 'NIST CSF', 'CCPA', 'Other']
const dataTypeOptions = ['Personal data (names, emails, addresses)', 'Financial data (payment, banking)', 'Health / medical data', "Children's data (under 18)", 'Biometric data', 'Employee data (HR)', 'Intellectual property', 'Non-personal / operational data only']
const certOptions = ['ISO 27001', 'SOC 2 Type II', 'Cyber Essentials', 'Cyber Essentials Plus', 'PCI DSS', 'None currently held']
const assetTypes = ['SaaS', 'Cloud infra', 'Managed service', 'Physical asset', 'Internal tool']

const MultiSelect = ({ options, selected, onChange }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
    {options.map(opt => {
      const active = selected.includes(opt)
      return (
        <div key={opt} onClick={() => onChange(active ? selected.filter(o => o !== opt) : [...selected, opt])}
          style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', userSelect: 'none', border: `1px solid ${active ? 'var(--orange)' : 'rgba(44,31,14,0.2)'}`, background: active ? '#FFF7F2' : '#fff', color: active ? 'var(--orange)' : 'var(--muted)', fontWeight: active ? 500 : 400 }}>
          {active ? '✓ ' : ''}{opt}
        </div>
      )
    })}
  </div>
)

export default function Onboarding({ onComplete, setOnboardingComplete }) {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [assetMode, setAssetMode] = useState(null)

  const [org, setOrg] = useState({
    company_name: '', industry: '', employee_count: '', countries: [],
    regulatory_frameworks: [], data_types: [], data_subject_count: '',
    special_category_data: false, tech_environment: '',
    existing_certifications: [], risk_appetite: '', compliance_notes: '',
  })

  const [asset, setAsset] = useState({
    name: '', type: 'SaaS', company_name: '', vendor_url: '',
    contact_name: '', contact_email: '',
  })

  const setOrgField = (k, v) => setOrg(p => ({ ...p, [k]: v }))
  const setAssetField = (k, v) => setAsset(p => ({ ...p, [k]: v }))

  // Get user's org_id helper
  async function getUserOrgId() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: membership } = await supabase
      .from('org_memberships').select('org_id').eq('user_id', user.id).single()
    return { user, orgId: membership?.org_id || null }
  }

  const saveOrg = async () => {
    setSaving(true)
    setError('')
    try {
      const { user, orgId } = await getUserOrgId()
      const payload = { ...org, user_id: user.id, org_id: orgId, updated_at: new Date().toISOString() }

      // Check if record already exists
      const { data: existing } = await supabase
        .from('organisation_context').select('id').eq('user_id', user.id).single()

      let result
      if (existing) {
        result = await supabase.from('organisation_context').update(payload).eq('user_id', user.id)
      } else {
        result = await supabase.from('organisation_context').insert([payload])
      }

      if (result.error) throw result.error
      clearOrgContextCache()
      setStep(2)
    } catch (err) {
      console.error('saveOrg error:', err)
      setError('Failed to save: ' + err.message)
    }
    setSaving(false)
  }

  const saveBasicAsset = async () => {
    setSaving(true)
    setError('')
    try {
      const { user, orgId } = await getUserOrgId()
      const assetId = asset.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Date.now()

      const { error: assetErr } = await supabase.from('assets').insert([{
        id: assetId, name: asset.name, type: asset.type,
        company_name: asset.company_name, vendor_url: asset.vendor_url,
        contact_name: asset.contact_name, contact_email: asset.contact_email,
        tier: 2, rag: 'amber', score: 50, status: 'Not assessed',
        last_assessed: 'Pending', questionnaire_status: 'not sent',
        certification_status: 'not requested', added_by: user?.email || 'unknown',
        org_id: orgId,
      }])
      if (assetErr) throw assetErr

      await supabase.from('asset_audit_log').insert([{
        asset_id: assetId, asset_name: asset.name, action: 'created',
        performed_by: user?.email || 'unknown', reason: 'Added during onboarding',
        org_id: orgId,
      }])
      setStep(3)
    } catch (err) {
      setError('Failed to save asset: ' + err.message)
    }
    setSaving(false)
  }

  const markComplete = async () => {
    setSaving(true)
    try {
      const { user, orgId } = await getUserOrgId()
      await supabase.from('organisation_context')
        .update({ onboarding_complete: true, org_id: orgId })
        .eq('user_id', user.id)
      if (onComplete) onComplete()
      navigate('/dashboard')
    } catch (err) {
      if (onComplete) onComplete()
      navigate('/dashboard')
    }
    setSaving(false)
  }

  const steps = ['Welcome', 'Your organisation', 'First asset', 'All set']
  const orgComplete = org.company_name && org.industry && org.regulatory_frameworks.length > 0

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flex: 1 }}>
      {/* Left panel */}
      <div style={{ width: 280, background: 'var(--brown)', color: '#F5F0E8', padding: '3rem 2rem', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 500, marginBottom: '3rem' }}>Cly<em style={{ fontStyle: 'italic', color: '#D4A97A' }}>ra</em></div>
        <div style={{ flex: 1 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 28, opacity: i > step ? 0.4 : 1 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, background: i < step ? 'var(--green)' : i === step ? 'var(--orange)' : 'rgba(245,240,232,0.15)', color: '#F5F0E8' }}>
                {i < step ? '✓' : i + 1}
              </div>
              <div style={{ paddingTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: i === step ? 500 : 400 }}>{s}</div>
                {i === step && (
                  <div style={{ fontSize: 11, color: 'rgba(245,240,232,0.6)', marginTop: 2 }}>
                    {i === 0 && 'Get started in 5 minutes'}
                    {i === 1 && 'Personalises all AI assessments'}
                    {i === 2 && 'Register your first vendor'}
                    {i === 3 && "You're ready to go"}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(245,240,232,0.4)', lineHeight: 1.6 }}>
          This setup takes about 5 minutes. You can update everything later from Settings.
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '3rem' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>

          {/* STEP 0 — WELCOME */}
          {step === 0 && (
            <div>
              <div style={{ fontSize: 28, fontWeight: 500, marginBottom: 12 }}>Welcome to Clyra</div>
              <div style={{ fontSize: 15, color: 'var(--muted)', lineHeight: 1.7, marginBottom: '2rem' }}>
                Clyra helps you manage vendor security risk — assessing every tool and supplier your organisation relies on, and keeping you compliant across ISO 27001, NIST CSF, CIS Controls, and Cyber Essentials.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: '2rem' }}>
                {[
                  ['✦', 'AI-powered vendor questionnaires', 'Automatically generated and evaluated against your regulatory obligations'],
                  ['✦', 'Asset register', 'A single source of truth for every vendor and tool in your estate'],
                  ['✦', 'Risk scoring', 'RAG ratings, findings, and recommendations across four security frameworks'],
                  ['✦', 'Incident response', 'Guided workflow when something goes wrong'],
                ].map(([icon, title, desc]) => (
                  <div key={title} style={{ display: 'flex', gap: 14, padding: '14px 16px', background: '#fff', border: '0.5px solid var(--border)', borderRadius: 10 }}>
                    <div style={{ color: 'var(--orange)', fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" style={{ padding: '10px 28px', fontSize: 14 }} onClick={() => setStep(1)}>
                Get started →
              </button>
            </div>
          )}

          {/* STEP 1 — ORG CONTEXT */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 24, fontWeight: 500, marginBottom: 8 }}>Tell us about your organisation</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: '2rem', lineHeight: 1.6 }}>
                This information personalises every AI assessment to your specific regulatory environment. Claude will frame vendor risks in terms of your actual obligations — not generic best practice.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Company name *</label>
                  <input value={org.company_name} onChange={e => setOrgField('company_name', e.target.value)} placeholder="Acme Corp" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Industry *</label>
                  <select value={org.industry} onChange={e => setOrgField('industry', e.target.value)} style={inputStyle}>
                    <option value="">Select...</option>
                    {industries.map(i => <option key={i}>{i}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Employee count</label>
                  <select value={org.employee_count} onChange={e => setOrgField('employee_count', e.target.value)} style={inputStyle}>
                    <option value="">Select...</option>
                    {employeeCounts.map(e => <option key={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Primary countries of operation</label>
                  <input
                    value={org.countries.join(', ')}
                    onChange={e => setOrgField('countries', e.target.value ? e.target.value.split(',').map(s => s.trimStart()) : [])}
                    onBlur={e => setOrgField('countries', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                    placeholder="United Kingdom, Ireland, USA..." style={inputStyle} />
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Comma separated</div>
                </div>
                <div>
                  <label style={labelStyle}>Technical environment</label>
                  <select value={org.tech_environment} onChange={e => setOrgField('tech_environment', e.target.value)} style={inputStyle}>
                    <option value="">Select...</option>
                    {techEnvironments.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Regulatory frameworks you operate under *</label>
                <MultiSelect options={regulatoryOptions} selected={org.regulatory_frameworks} onChange={v => setOrgField('regulatory_frameworks', v)} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Types of data you hold</label>
                <MultiSelect options={dataTypeOptions} selected={org.data_types} onChange={v => setOrgField('data_types', v)} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>Risk appetite</label>
                  <select value={org.risk_appetite} onChange={e => setOrgField('risk_appetite', e.target.value)} style={inputStyle}>
                    <option value="">Select...</option>
                    {riskAppetites.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Certifications you hold</label>
                  <select value="" onChange={e => { if (e.target.value && !org.existing_certifications.includes(e.target.value)) setOrgField('existing_certifications', [...org.existing_certifications, e.target.value]) }} style={inputStyle}>
                    <option value="">Add certification...</option>
                    {certOptions.map(c => <option key={c}>{c}</option>)}
                  </select>
                  {org.existing_certifications.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {org.existing_certifications.map(c => (
                        <span key={c} style={{ fontSize: 11, padding: '2px 8px', background: '#EAF3DE', borderRadius: 12, color: 'var(--green)', cursor: 'pointer' }}
                          onClick={() => setOrgField('existing_certifications', org.existing_certifications.filter(x => x !== c))}>
                          {c} ×
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={labelStyle}>Additional compliance notes</label>
                <textarea value={org.compliance_notes} onChange={e => setOrgField('compliance_notes', e.target.value)}
                  placeholder="e.g. We are FCA authorised, working towards ISO 27001, PCI QSA audit due Q3..."
                  rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              {error && <div style={{ fontSize: 12, color: 'var(--red)', padding: '8px 12px', background: '#FCEBEB', borderRadius: 6, marginBottom: 12 }}>{error}</div>}

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button className="btn" onClick={() => setStep(0)}>← Back</button>
                <button className="btn btn-primary" onClick={saveOrg} disabled={saving || !orgComplete} style={{ flex: 1 }}>
                  {saving ? 'Saving...' : 'Save & continue →'}
                </button>
              </div>
              {!orgComplete && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Complete company name, industry, and at least one regulatory framework to continue.</div>}
            </div>
          )}

          {/* STEP 2 — FIRST ASSET */}
          {step === 2 && (
            <div>
              <div style={{ fontSize: 24, fontWeight: 500, marginBottom: 8 }}>Register your first asset</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: '2rem', lineHeight: 1.6 }}>
                Add the first vendor or tool you want to assess.
              </div>

              {assetMode === null && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: '2rem' }}>
                  <div onClick={async () => {
                    setSaving(true)
                    try {
                      const { user, orgId } = await getUserOrgId()
                      // Save org context AND mark onboarding complete so routing doesn't redirect back to /welcome
                      const payload = { ...org, user_id: user.id, org_id: orgId, onboarding_complete: true, updated_at: new Date().toISOString() }
                      const { data: existing } = await supabase.from('organisation_context').select('id').eq('user_id', user.id).single()
                      if (existing) {
                        await supabase.from('organisation_context').update(payload).eq('user_id', user.id)
                      } else {
                        await supabase.from('organisation_context').insert([payload])
                      }
                      clearOrgContextCache()
                      if (setOnboardingComplete) setOnboardingComplete(true)
                    } catch (err) { console.error(err) }
                    setSaving(false)
                    navigate('/questionnaires/new')
                  }}
                    style={{ padding: '1.5rem', background: '#fff', border: '1.5px solid var(--orange)', borderRadius: 12, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#FFF7F2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✦</div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>Start a full vendor assessment</div>
                      <span style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', background: '#FFF7F2', color: 'var(--orange)', borderRadius: 12, fontWeight: 500 }}>Recommended</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                      Claude will analyse the vendor's risk profile, generate a tailored questionnaire, and produce a full security assessment personalised to your organisation.
                    </div>
                  </div>

                  <div onClick={() => setAssetMode('basic')}
                    style={{ padding: '1.5rem', background: '#fff', border: '0.5px solid var(--border)', borderRadius: 12, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--cream2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>+</div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>Add basic details and assess later</div>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                      Just capture the vendor name and type for now. Start the full assessment from the asset register whenever you're ready.
                    </div>
                  </div>

                  <button onClick={() => setStep(3)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', textAlign: 'left', padding: '8px 0', fontFamily: 'inherit' }}>
                    Skip for now — I'll add assets from the dashboard →
                  </button>
                </div>
              )}

              {assetMode === 'basic' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={labelStyle}>Asset name *</label>
                      <input value={asset.name} onChange={e => setAssetField('name', e.target.value)} placeholder="e.g. Salesforce CRM" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Asset type *</label>
                      <select value={asset.type} onChange={e => setAssetField('type', e.target.value)} style={inputStyle}>
                        {assetTypes.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={labelStyle}>Company name</label>
                      <input value={asset.company_name} onChange={e => setAssetField('company_name', e.target.value)} placeholder="Salesforce Inc." style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Vendor website</label>
                      <input value={asset.vendor_url} onChange={e => setAssetField('vendor_url', e.target.value)} placeholder="https://salesforce.com" style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '2rem' }}>
                    <div>
                      <label style={labelStyle}>Contact name</label>
                      <input value={asset.contact_name} onChange={e => setAssetField('contact_name', e.target.value)} placeholder="Jane Smith" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Contact email</label>
                      <input type="email" value={asset.contact_email} onChange={e => setAssetField('contact_email', e.target.value)} placeholder="jane@vendor.com" style={inputStyle} />
                    </div>
                  </div>
                  {error && <div style={{ fontSize: 12, color: 'var(--red)', padding: '8px 12px', background: '#FCEBEB', borderRadius: 6, marginBottom: 16 }}>{error}</div>}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn" onClick={() => setAssetMode(null)}>← Back</button>
                    <button className="btn btn-primary" onClick={saveBasicAsset} disabled={saving || !asset.name} style={{ flex: 1 }}>
                      {saving ? 'Saving...' : 'Save asset & continue →'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3 — DONE */}
          {step === 3 && (
            <div style={{ textAlign: 'center', paddingTop: '2rem' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#EAF3DE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 28 }}>✓</div>
              <div style={{ fontSize: 26, fontWeight: 500, marginBottom: 12 }}>You're all set</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, marginBottom: '2rem', maxWidth: 480, margin: '0 auto 2rem' }}>
                Clyra is ready. Your organisation context is saved and will personalise every assessment going forward.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: '2rem', textAlign: 'left' }}>
                {[
                  ['Questionnaires', 'Send your first vendor assessment', '/questionnaires/new'],
                  ['Asset register', 'View and manage your vendors', '/assets'],
                  ['Organisation', 'Update your context anytime', '/org-context'],
                ].map(([title, desc, path]) => (
                  <div key={title} onClick={() => navigate(path)}
                    style={{ padding: '14px', background: '#fff', border: '0.5px solid var(--border)', borderRadius: 10, cursor: 'pointer' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>{title}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{desc}</div>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary" style={{ padding: '12px 36px', fontSize: 14 }} onClick={markComplete} disabled={saving}>
                {saving ? 'Setting up...' : 'Go to dashboard →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  async function getUserOrgId() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: membership } = await supabase
      .from('org_memberships').select('org_id').eq('user_id', user.id).single()
    return { user, orgId: membership?.org_id || null }
  }
}

const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 6 }
const inputStyle = { width: '100%', padding: '9px 12px', border: '0.5px solid rgba(44,31,14,0.25)', borderRadius: 8, fontSize: 13, background: '#fff', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }
