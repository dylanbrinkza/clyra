import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const steps = ['Risk profile', 'Tier assignment', 'Review & send']

const profileFields = [
  { key: 'data_sensitivity', label: 'Data sensitivity', options: ['None', 'Non-personal', 'Personal data', 'Special category', 'Financial', 'Health data'] },
  { key: 'network_access', label: 'Network access', options: ['None', 'Internet-only', 'Internal network', 'Privileged', 'Administrative'] },
  { key: 'integration_depth', label: 'Integration depth', options: ['Standalone', 'API integration', 'SSO', 'Embedded agent', 'Infrastructure level'] },
  { key: 'physical_access', label: 'Physical access', options: ['None', 'Site access', 'Data centre or server room access'] },
  { key: 'vendor_maturity', label: 'Vendor maturity', options: ['Enterprise with certifications', 'Established SME', 'Early-stage', 'Unknown'] },
  { key: 'contract_value', label: 'Contract value', options: ['Low (under £10k)', 'Medium (£10k–£100k)', 'High (over £100k)'] },
  { key: 'criticality', label: 'Criticality', options: ['Non-critical', 'Important', 'Business critical', 'Mission critical'] },
]

export default function NewQuestionnaire() {
  const navigate = useNavigate()
  const location = useLocation()
  const prefill = location.state?.prefill || {}

  const [step, setStep] = useState(0)
  const [assetName, setAssetName] = useState(prefill.assetName || '')
  const [assetType, setAssetType] = useState(prefill.assetType || 'SaaS')
  const [companyName, setCompanyName] = useState(prefill.companyName || '')
  const [vendorEmail, setVendorEmail] = useState(prefill.contactEmail || '')
  const [vendorName, setVendorName] = useState(prefill.contactName || '')
  const [contractRef, setContractRef] = useState('')
  const [integrationNotes, setIntegrationNotes] = useState('')
  const [profile, setProfile] = useState({
    data_sensitivity: 'Personal data',
    network_access: 'Internet-only',
    integration_depth: 'API integration',
    physical_access: 'None',
    vendor_maturity: 'Enterprise with certifications',
    contract_value: 'Medium (£10k–£100k)',
    criticality: 'Important',
  })
  const [tierResult, setTierResult] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState('')

  const runProfile = async () => {
    setLoading(true)
    setError('')
    setLoadingMsg('Analysing your risk profile...')
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetName, profile }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTierResult(data)
      setLoadingMsg('Hold tight — generating tailored questions...')
      const res2 = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetName, tier: data.tier, profile }),
      })
      const qs = await res2.json()
      if (!res2.ok) throw new Error(qs.error)
      setQuestions(qs)
      setStep(1)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
    setLoadingMsg('')
  }

  const saveAndSend = async () => {
    setLoading(true)
    setError('')
    setLoadingMsg('Saving questionnaire...')
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Save questionnaire only — no asset created yet
      const { data: qData, error: qError } = await supabase
        .from('questionnaires')
        .insert([{
          asset_name: assetName,
          asset_type: assetType,
          company_name: companyName,
          tier: tierResult.tier,
          tier_justification: tierResult.justification,
          status: 'sent',
          approval_status: 'pending',
          vendor_email: vendorEmail,
          vendor_name: vendorName,
          contract_reference: contractRef,
          integration_notes: integrationNotes,
          created_by: user?.email || 'unknown',
          ...profile,
        }])
        .select()
        .single()
      if (qError) throw new Error(qError.message)

      const questionsToInsert = questions.map(q => ({
        questionnaire_id: qData.id,
        domain: q.domain,
        question: q.question,
        control_ref: q.control_ref,
        order_num: q.order_num,
        follow_up_trigger: q.follow_up_trigger || '',
      }))
      const { error: qqError } = await supabase.from('questionnaire_questions').insert(questionsToInsert)
      if (qqError) throw new Error(qqError.message)

      navigate(`/questionnaires/${qData.id}`)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
    setLoadingMsg('')
  }

  const tierColors = { 1: 'var(--red)', 2: 'var(--amber)', 3: '#185FA5', 4: 'var(--green)' }
  const tierBg = { 1: '#FAECE7', 2: '#FAEEDA', 3: '#E6F1FB', 4: '#EAF3DE' }
  const domains = [...new Set(questions.map(q => q.domain))]

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <button className="btn" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>← Back</button>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>New questionnaire</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, background: i < step ? 'var(--brown)' : i === step ? 'var(--orange)' : 'var(--cream2)', color: i <= step ? '#fff' : 'var(--muted)' }}>
                {i < step ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 13, color: i === step ? 'var(--text)' : 'var(--muted)', fontWeight: i === step ? 500 : 400 }}>{s}</span>
              {i < steps.length - 1 && <div style={{ width: 24, height: 1, background: 'var(--border)' }} />}
            </div>
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">Vendor risk profile</span></div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Asset name *</label>
              <input value={assetName} onChange={e => setAssetName(e.target.value)} placeholder="e.g. Salesforce CRM" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Asset type *</label>
              <select value={assetType} onChange={e => setAssetType(e.target.value)} style={inputStyle}>
                <option>SaaS</option><option>Cloud infra</option><option>Managed service</option>
                <option>Physical asset</option><option>Internal tool</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Company name</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Vendor Inc." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Contact name</label>
              <input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Jane Smith" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Contact email</label>
              <input type="email" value={vendorEmail} onChange={e => setVendorEmail(e.target.value)} placeholder="jane@vendor.com" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Contract reference</label>
              <input value={contractRef} onChange={e => setContractRef(e.target.value)} placeholder="e.g. MSA-2024-001" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Integration notes</label>
              <input value={integrationNotes} onChange={e => setIntegrationNotes(e.target.value)} placeholder="What does this connect to?" style={inputStyle} />
            </div>
          </div>

          <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Risk profile inputs</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {profileFields.map(field => (
                <div key={field.key}>
                  <label style={labelStyle}>{field.label}</label>
                  <select value={profile[field.key]} onChange={e => setProfile(prev => ({ ...prev, [field.key]: e.target.value }))} style={inputStyle}>
                    {field.options.map(opt => <option key={opt}>{opt}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {error && <div style={errorStyle}>{error}</div>}

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={runProfile} disabled={loading || !assetName}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <span style={spinnerStyle} />
                {loadingMsg}
              </span>
            ) : 'Analyse risk profile →'}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {step === 1 && tierResult && (
        <>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ padding: '10px 16px', borderRadius: 8, textAlign: 'center', flexShrink: 0, background: tierBg[tierResult.tier] }}>
                <div style={{ fontSize: 22, fontWeight: 500, color: tierColors[tierResult.tier] }}>Tier {tierResult.tier}</div>
                <div style={{ fontSize: 11, color: tierColors[tierResult.tier], fontWeight: 500 }}>{tierResult.label}</div>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>AI tier assignment</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{tierResult.justification}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">Generated questionnaire</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{questions.length} questions · {domains.length} domains</span>
            </div>
            {domains.map(domain => (
              <div key={domain} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, paddingBottom: 6, borderBottom: '0.5px solid var(--border)' }}>
                  {domain}
                </div>
                {questions.filter(q => q.domain === domain).map((q, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 13 }}>
                    <div style={{ color: 'var(--muted)', flexShrink: 0, width: 20, paddingTop: 1 }}>{q.order_num}.</div>
                    <div style={{ flex: 1 }}>
                      {q.question}
                      {q.follow_up_trigger && <div style={{ fontSize: 11, color: 'var(--orange)', marginTop: 3 }}>↳ {q.follow_up_trigger}</div>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0, paddingTop: 2 }}>{q.control_ref}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Review & send</span></div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
              Once sent, the vendor completes the questionnaire via a secure link. After AI evaluation, the questionnaire will sit in a <strong>pending approval</strong> state — you review the verdict and manually approve it to add the asset to your register.
            </div>
            <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
              {[
                ['Asset', assetName],
                ['Type', assetType],
                ['Company', companyName || '—'],
                ['Vendor contact', vendorName || '—'],
                ['Email', vendorEmail || '—'],
                ['Tier', `Tier ${tierResult.tier} — ${tierResult.label}`],
                ['Questions', questions.length],
                ['Link expires', '14 days'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--muted)' }}>{label}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>

            {error && <div style={errorStyle}>{error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={() => setStep(0)} style={{ flex: 1 }}>← Edit profile</button>
              <button className="btn btn-primary" onClick={saveAndSend} disabled={loading} style={{ flex: 2 }}>
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <span style={spinnerStyle} />
                    {loadingMsg}
                  </span>
                ) : 'Save & send questionnaire →'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 6 }
const inputStyle = { width: '100%', padding: '9px 12px', border: '0.5px solid rgba(44,31,14,0.25)', borderRadius: 8, fontSize: 13, background: '#fff', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }
const errorStyle = { fontSize: 12, color: 'var(--red)', padding: '8px 12px', background: '#FCEBEB', borderRadius: 6, marginBottom: 16 }
const spinnerStyle = { width: 14, height: 14, border: '2px solid rgba(245,240,232,0.3)', borderTopColor: '#F5F0E8', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block', flexShrink: 0 }
