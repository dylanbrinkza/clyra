import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const steps = ['Risk profile', 'Tier assignment', 'Review & send']

const profileFields = [
  { key: 'data_sensitivity', label: 'Data sensitivity', options: ['None', 'Non-personal', 'Personal data', 'Special category', 'Financial', 'Health data'] },
  { key: 'physical_access', label: 'Physical access', options: ['None', 'Site access', 'Data centre or server room access'] },
  { key: 'vendor_maturity', label: 'Vendor maturity', options: ['Enterprise with certifications', 'Established SME', 'Early-stage', 'Unknown'] },
  { key: 'contract_value', label: 'Contract value', options: ['Low (under £10k)', 'Medium (£10k–£100k)', 'High (over £100k)'] },
  { key: 'criticality', label: 'Criticality', options: ['Non-critical', 'Important', 'Business critical', 'Mission critical'] },
  { key: 'network_access', label: 'Network access', options: ['None', 'Internet-only', 'Internal network', 'Privileged', 'Administrative'] },
]

const integrationOptions = [
  'Standalone',
  'API integration',
  'SSO',
  'Embedded agent',
  'Infrastructure level',
  'Webhook',
  'Data export / import',
]

const certTypes = ['SOC 2 Type II', 'ISO 27001', 'ISO 27701', 'Cyber Essentials', 'Cyber Essentials Plus', 'PCI DSS', 'HIPAA', 'Other']

export default function NewQuestionnaire() {
  const navigate = useNavigate()
  const location = useLocation()
  const prefill = location.state?.prefill || {}
  const fileInputRef = useRef()

  const [step, setStep] = useState(0)
  const [assetName, setAssetName] = useState(prefill.assetName || '')
  const [assetType, setAssetType] = useState(prefill.assetType || 'SaaS')
  const [companyName, setCompanyName] = useState(prefill.companyName || '')
  const [vendorUrl, setVendorUrl] = useState('')
  const [vendorEmail, setVendorEmail] = useState(prefill.contactEmail || '')
  const [vendorName, setVendorName] = useState(prefill.contactName || '')
  const [contractRef, setContractRef] = useState('')
  const [integrationNotes, setIntegrationNotes] = useState('')
  const [integrationDepths, setIntegrationDepths] = useState(['API integration'])
  const [uploadedCerts, setUploadedCerts] = useState([])
  const [uploadingCert, setUploadingCert] = useState(false)
  const [selectedCertType, setSelectedCertType] = useState('SOC 2 Type II')
  const [emailError, setEmailError] = useState('')
  const [profile, setProfile] = useState({
    data_sensitivity: 'Personal data',
    network_access: 'Internet-only',
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

  const toggleIntegration = (opt) => {
    setIntegrationDepths(prev =>
      prev.includes(opt) ? prev.filter(i => i !== opt) : [...prev, opt]
    )
  }

  const handleCertUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingCert(true)
    try {
      const path = `temp/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('certifications').upload(path, file)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('certifications').getPublicUrl(path)
      setUploadedCerts(prev => [...prev, { file_name: file.name, file_url: publicUrl, cert_type: selectedCertType }])
    } catch (err) {
      setError('Upload failed: ' + err.message)
    }
    setUploadingCert(false)
    e.target.value = ''
  }

  const runProfile = async () => {
    setEmailError('')
    if (!vendorEmail.trim()) {
      setEmailError('Vendor email is required before sending a questionnaire.')
      return
    }
    setLoading(true)
    setError('')
    setLoadingMsg('Analysing your risk profile...')
    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetName,
          vendorUrl,
          profile: { ...profile, integration_depth: integrationDepths.join(', ') },
          certifications: uploadedCerts.map(c => c.cert_type),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTierResult(data)
      setLoadingMsg('Hold tight — generating tailored questions...')
      const res2 = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetName,
          vendorUrl,
          tier: data.tier,
          profile: { ...profile, integration_depth: integrationDepths.join(', ') },
          certifications: uploadedCerts.map(c => c.cert_type),
        }),
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
      const { data: qData, error: qError } = await supabase
        .from('questionnaires')
        .insert([{
          asset_name: assetName,
          asset_type: assetType,
          company_name: companyName,
          vendor_url: vendorUrl,
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
          integration_depth: integrationDepths.join(', '),
        }])
        .select()
        .single()
      if (qError) throw new Error(qError.message)

      if (uploadedCerts.length > 0) {
        await supabase.from('questionnaire_certifications').insert(
          uploadedCerts.map(c => ({ ...c, questionnaire_id: qData.id }))
        )
      }

      await supabase.from('questionnaire_questions').insert(
        questions.map(q => ({
          questionnaire_id: qData.id,
          domain: q.domain, question: q.question,
          control_ref: q.control_ref, order_num: q.order_num,
          follow_up_trigger: q.follow_up_trigger || '',
        }))
      )

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

          {/* Asset basics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Asset name *</label>
              <input value={assetName} onChange={e => setAssetName(e.target.value)} placeholder="e.g. Microsoft Teams" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Asset type *</label>
              <select value={assetType} onChange={e => setAssetType(e.target.value)} style={inputStyle}>
                <option>SaaS</option><option>Cloud infra</option><option>Managed service</option>
                <option>Physical asset</option><option>Internal tool</option>
              </select>
            </div>
          </div>

          {/* Vendor details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Company name</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Microsoft Corp." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Vendor website</label>
              <input value={vendorUrl} onChange={e => setVendorUrl(e.target.value)} placeholder="https://microsoft.com/teams" style={inputStyle} />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Claude will use this to understand what the tool does</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Contact name</label>
              <input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Jane Smith" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Contact email *</label>
              <input type="email" value={vendorEmail} onChange={e => { setVendorEmail(e.target.value); setEmailError('') }}
                placeholder="jane@vendor.com"
                style={{ ...inputStyle, borderColor: emailError ? 'var(--red)' : 'rgba(44,31,14,0.25)' }} />
              {emailError && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{emailError}</div>}
            </div>
            <div>
              <label style={labelStyle}>Contract reference</label>
              <input value={contractRef} onChange={e => setContractRef(e.target.value)} placeholder="MSA-2024-001" style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Integration notes</label>
            <input value={integrationNotes} onChange={e => setIntegrationNotes(e.target.value)}
              placeholder="What does this asset connect to? e.g. Syncs with Salesforce CRM, SSO via Azure AD" style={inputStyle} />
          </div>

          {/* Integration depth - multi select */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Integration depth — select all that apply</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {integrationOptions.map(opt => (
                <div key={opt} onClick={() => toggleIntegration(opt)} style={{
                  padding: '6px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                  border: `1px solid ${integrationDepths.includes(opt) ? 'var(--orange)' : 'rgba(44,31,14,0.2)'}`,
                  background: integrationDepths.includes(opt) ? '#FFF7F2' : '#fff',
                  color: integrationDepths.includes(opt) ? 'var(--orange)' : 'var(--muted)',
                  fontWeight: integrationDepths.includes(opt) ? 500 : 400,
                  userSelect: 'none',
                }}>
                  {integrationDepths.includes(opt) ? '✓ ' : ''}{opt}
                </div>
              ))}
            </div>
          </div>

          {/* Cert uploads */}
          <div style={{ marginBottom: 16, borderTop: '0.5px solid var(--border)', paddingTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Existing certifications</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
              Upload any certifications the vendor has already provided. Claude will review these and tailor the questionnaire accordingly — skipping areas already evidenced and probing gaps more specifically.
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select value={selectedCertType} onChange={e => setSelectedCertType(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                {certTypes.map(t => <option key={t}>{t}</option>)}
              </select>
              <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={uploadingCert}
                style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                {uploadingCert ? 'Uploading...' : '+ Upload'}
              </button>
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleCertUpload} />
            </div>
            {uploadedCerts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {uploadedCerts.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#EAF3DE', borderRadius: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 13 }}><strong>{c.cert_type}</strong> — {c.file_name}</div>
                    <button onClick={() => setUploadedCerts(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Risk profile */}
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
                <span style={spinnerStyle} />{loadingMsg}
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
              Once sent, the vendor completes the questionnaire via a secure link. After AI evaluation, it will sit in <strong>pending approval</strong> — review the verdict and manually approve to add to your asset register.
            </div>
            <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
              {[
                ['Asset', assetName],
                ['Type', assetType],
                ['Company', companyName || '—'],
                ['Vendor contact', vendorName || '—'],
                ['Email', vendorEmail],
                ['Integrations', integrationDepths.join(', ')],
                ['Certifications uploaded', uploadedCerts.length > 0 ? uploadedCerts.map(c => c.cert_type).join(', ') : 'None'],
                ['Tier', `Tier ${tierResult.tier} — ${tierResult.label}`],
                ['Questions', questions.length],
                ['Link expires', '14 days'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--muted)' }}>{label}</span>
                  <span style={{ textAlign: 'right', maxWidth: 300 }}>{value}</span>
                </div>
              ))}
            </div>
            {error && <div style={errorStyle}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={() => setStep(0)} style={{ flex: 1 }}>← Edit profile</button>
              <button className="btn btn-primary" onClick={saveAndSend} disabled={loading} style={{ flex: 2 }}>
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <span style={spinnerStyle} />{loadingMsg}
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
