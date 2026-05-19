import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getOrgContext } from '../lib/orgContext'
import { getOrgId, getUserRole } from '../lib/auth'

const steps = ['Risk profile', 'Tier assignment', 'Review & send']

const dataSensitivityOptions = ['None', 'Non-personal', 'Personal data', 'Special category', 'Financial', 'Health data', 'Legal data', 'Biometric data', "Children's data"]

const profileFields = [
  { key: 'physical_access', label: 'Physical access', options: ['None', 'Site access', 'Data centre or server room access'] },
  { key: 'vendor_maturity', label: 'Vendor maturity', options: ['Enterprise with certifications', 'Established SME', 'Early-stage', 'Unknown'] },
  { key: 'contract_value', label: 'Contract value', options: ['Low (under £10k)', 'Medium (£10k–£100k)', 'High (over £100k)'] },
  { key: 'criticality', label: 'Criticality', options: ['Non-critical', 'Important', 'Business critical', 'Mission critical'] },
  { key: 'network_access', label: 'Network access', options: ['None', 'Internet-only', 'Internal network', 'Privileged', 'Administrative'] },
]

const integrationOptions = ['Standalone', 'API integration', 'SSO', 'Embedded agent', 'Infrastructure level', 'Webhook', 'Data export / import']
const certTypes = ['SOC 2 Type II', 'ISO 27001', 'ISO 27701', 'Cyber Essentials', 'Cyber Essentials Plus', 'PCI DSS', 'HIPAA', 'Other']

const Toggle = ({ options, selected, onChange }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
    {options.map(opt => {
      const active = selected.includes(opt)
      return (
        <div key={opt} onClick={() => onChange(active ? selected.filter(o => o !== opt) : [...selected, opt])}
          style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer', userSelect: 'none',
            border: `1px solid ${active ? 'var(--orange)' : 'rgba(44,31,14,0.2)'}`,
            background: active ? '#FFF7F2' : '#fff',
            color: active ? 'var(--orange)' : 'var(--muted)',
            fontWeight: active ? 500 : 400 }}>
          {active ? '✓ ' : ''}{opt}
        </div>
      )
    })}
  </div>
)

export default function NewQuestionnaire() {
  const navigate = useNavigate()
  const location = useLocation()
  const prefill = location.state?.prefill || {}
  const fileInputRef = useRef()
  const contractFileRef = useRef()

  const [step, setStep] = useState(0)
  const [orgContext, setOrgContext] = useState(null)
  const [orgLoaded, setOrgLoaded] = useState(false)
  const [isAdmin, setIsAdmin] = useState(true)

  // Vendor details
  const [assetName, setAssetName] = useState(prefill.assetName || '')
  const [assetType, setAssetType] = useState(prefill.assetType || 'SaaS')
  const [companyName, setCompanyName] = useState(prefill.companyName || '')
  const [vendorUrl, setVendorUrl] = useState('')
  const [assetDescription, setAssetDescription] = useState('')
  const [vendorEmail, setVendorEmail] = useState(prefill.contactEmail || '')
  const [vendorName, setVendorName] = useState(prefill.contactName || '')
  const [contractRef, setContractRef] = useState('')
  const [contractUrl, setContractUrl] = useState('')
  const [contractFile, setContractFile] = useState(null)
  const [tosUrl, setTosUrl] = useState('')
  const [privacyUrl, setPrivacyUrl] = useState('')
  const [securityPolicyUrl, setSecurityPolicyUrl] = useState('')
  const [trustCentreUrl, setTrustCentreUrl] = useState('')
  const [dpaUrl, setDpaUrl] = useState('')
  const [subprocessorsUrl, setSubprocessorsUrl] = useState('')
  const [integrationNotes, setIntegrationNotes] = useState('')
  const [integrationDepths, setIntegrationDepths] = useState(['Standalone'])
  const [dataSensitivity, setDataSensitivity] = useState([])
  const [uploadedCerts, setUploadedCerts] = useState([])
  const [uploadingCert, setUploadingCert] = useState(false)
  const [selectedCertType, setSelectedCertType] = useState('SOC 2 Type II')
  const [emailError, setEmailError] = useState('')

  const [profile, setProfile] = useState({
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

  useEffect(() => {
    getOrgContext().then(ctx => { setOrgContext(ctx); setOrgLoaded(true) })
    getUserRole().then(r => setIsAdmin(r === 'admin' || r === 'org_admin'))
  }, [])

  const handleCertUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingCert(true)
    try {
      const path = `certs/${Date.now()}-${file.name}`
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

  const handleContractUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const path = `contracts/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('certifications').upload(path, file)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('certifications').getPublicUrl(path)
      setContractFile({ name: file.name, url: publicUrl })
    } catch (err) {
      setError('Contract upload failed: ' + err.message)
    }
    e.target.value = ''
  }

  const runProfile = async () => {
    setEmailError('')
    if (!vendorEmail.trim()) { setEmailError('Vendor email is required.'); return }
    if (dataSensitivity.length === 0) { setError('Please select at least one data sensitivity level.'); return }
    setLoading(true)
    setError('')
    setLoadingMsg('Analysing your risk profile...')
    try {
      const profilePayload = {
        ...profile,
        data_sensitivity: dataSensitivity.join(', '),
        integration_depth: integrationDepths.join(', '),
      }
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetName, vendorUrl, assetDescription, trustCentreUrl, securityPolicyUrl, profile: profilePayload, certifications: uploadedCerts.map(c => c.cert_type), orgContext }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTierResult(data)

      setLoadingMsg('Hold tight — generating tailored questions...')
      const res2 = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetName, vendorUrl, assetDescription, trustCentreUrl, securityPolicyUrl, tier: data.tier, profile: profilePayload, certifications: uploadedCerts.map(c => c.cert_type), orgContext }),
      })
      const qs = await res2.json()
      if (!res2.ok) throw new Error(qs.error)
      if (!Array.isArray(qs) || qs.length === 0) throw new Error('Question generation failed. Please try again.')
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
      const orgId = await getOrgId()

      const { data: qData, error: qError } = await supabase.from('questionnaires').insert([{
        asset_name: assetName, asset_type: assetType, company_name: companyName,
        vendor_url: vendorUrl, tier: tierResult.tier, tier_justification: tierResult.justification,
        framework_notes: tierResult.framework_notes || null,
        status: 'sent', approval_status: 'pending',
        vendor_email: vendorEmail, vendor_name: vendorName,
        contract_reference: contractRef,
        integration_notes: integrationNotes,
        created_by: user?.email || 'unknown',
        org_id: orgId,
        ...profile,
        data_sensitivity: dataSensitivity.join(', '),
        integration_depth: integrationDepths.join(', '),
      }]).select().single()
      if (qError) throw new Error(qError.message)

      if (uploadedCerts.length > 0) {
        await supabase.from('questionnaire_certifications').insert(uploadedCerts.map(c => ({ ...c, questionnaire_id: qData.id })))
      }

      const { error: qqError } = await supabase.from('questionnaire_questions').insert(
        questions.map(q => ({
          questionnaire_id: qData.id, org_id: orgId,
          domain: q.domain, question: q.question,
          control_ref: q.control_ref || '', nist_ref: q.nist_ref || '',
          cis_ref: q.cis_ref || '', ce_ref: q.ce_ref || '',
          order_num: q.order_num, follow_up_trigger: q.follow_up_trigger || '',
        }))
      )
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
      {!isAdmin && (
        <div style={{ background: '#FCEBEB', border: '0.5px solid var(--red)', borderRadius: 10, padding: '1rem 1.25rem', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--red)', marginBottom: 4 }}>Access restricted</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Only org admins can create questionnaires. Contact your org admin.</div>
        </div>
      )}
      <div style={{ marginBottom: '2rem' }}>
        <button className="btn" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>← Back</button>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 12 }}>New questionnaire</h2>

        {orgLoaded && (
          <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: orgContext ? '#EAF3DE' : '#FAEEDA', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span>{orgContext ? '✦' : '⚠'}</span>
            <span style={{ color: orgContext ? 'var(--green)' : 'var(--amber)' }}>
              {orgContext ? `Org context active — assessments personalised for ${orgContext.company_name || 'your organisation'}` : 'No organisation context set'}
            </span>
            {!orgContext && <button className="btn" style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px' }} onClick={() => navigate('/org-context')}>Set up →</button>}
          </div>
        )}

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
              <input value={assetName} onChange={e => setAssetName(e.target.value)} placeholder="e.g. Starling Bank" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Asset type *</label>
              <select value={assetType} onChange={e => setAssetType(e.target.value)} style={inputStyle}>
                <option>SaaS</option><option>Cloud infra</option><option>Managed service</option>
                <option>Physical asset</option><option>Internal tool</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Company name</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Starling Bank Ltd." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Vendor website</label>
              <input value={vendorUrl} onChange={e => setVendorUrl(e.target.value)} placeholder="https://starlingbank.com" style={inputStyle} />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Claude uses this to understand what the tool does</div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Description / usage context</label>
            <textarea value={assetDescription} onChange={e => setAssetDescription(e.target.value)}
              placeholder="e.g. We will be using the Business Banking platform only, not the personal account product. Used for company expense management and payroll."
              rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Describe how your organisation will specifically use this tool — helps Claude tailor questions accurately</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Contact name</label>
              <input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Jane Smith" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Contact email *</label>
              <input type="email" value={vendorEmail} onChange={e => { setVendorEmail(e.target.value); setEmailError('') }}
                placeholder="jane@vendor.com" style={{ ...inputStyle, borderColor: emailError ? 'var(--red)' : 'rgba(44,31,14,0.25)' }} />
              {emailError && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{emailError}</div>}
            </div>
            <div>
              <label style={labelStyle}>Contract reference</label>
              <input value={contractRef} onChange={e => setContractRef(e.target.value)} placeholder="MSA-2024-001" style={inputStyle} />
            </div>
          </div>

          {/* Contract */}
          <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--cream)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10 }}>Contract & legal documents</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Contract / MSA URL</label>
                <input value={contractUrl} onChange={e => setContractUrl(e.target.value)} placeholder="https://..." style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Upload contract</label>
                <button className="btn" onClick={() => contractFileRef.current?.click()} style={{ width: '100%', textAlign: 'left' }}>
                  {contractFile ? `✓ ${contractFile.name}` : 'Upload PDF / DOCX'}
                </button>
                <input ref={contractFileRef} type="file" accept=".pdf,.doc,.docx" style={{ display: 'none' }} onChange={handleContractUpload} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Terms of Use URL</label>
                <input value={tosUrl} onChange={e => setTosUrl(e.target.value)} placeholder="https://vendor.com/terms" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Privacy Policy URL</label>
                <input value={privacyUrl} onChange={e => setPrivacyUrl(e.target.value)} placeholder="https://vendor.com/privacy" style={inputStyle} />
              </div>
            </div>
          </div>

          {/* Security documentation URLs */}
          <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--cream)', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10 }}>Security documentation URLs</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelStyle}>Security policy URL</label>
                <input value={securityPolicyUrl} onChange={e => setSecurityPolicyUrl(e.target.value)} placeholder="https://vendor.com/security" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Trust centre URL</label>
                <input value={trustCentreUrl} onChange={e => setTrustCentreUrl(e.target.value)} placeholder="https://trust.vendor.com" style={inputStyle} />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Claude will use this to understand available documentation</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>DPA / Data Processing Agreement URL</label>
                <input value={dpaUrl} onChange={e => setDpaUrl(e.target.value)} placeholder="https://vendor.com/dpa" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Sub-processors list URL</label>
                <input value={subprocessorsUrl} onChange={e => setSubprocessorsUrl(e.target.value)} placeholder="https://vendor.com/subprocessors" style={inputStyle} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Integration notes</label>
            <input value={integrationNotes} onChange={e => setIntegrationNotes(e.target.value)}
              placeholder="What does this connect to? e.g. Syncs with Xero, SSO via Azure AD" style={inputStyle} />
          </div>

          {/* Integration depth */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Integration depth — select all that apply</label>
            <Toggle options={integrationOptions} selected={integrationDepths} onChange={setIntegrationDepths} />
          </div>

          {/* Data sensitivity - multi select */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Data sensitivity — select all that apply *</label>
            <Toggle options={dataSensitivityOptions} selected={dataSensitivity} onChange={setDataSensitivity} />
          </div>

          {/* Cert uploads */}
          <div style={{ marginBottom: 16, borderTop: '0.5px solid var(--border)', paddingTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Existing certifications</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
              Upload any certifications the vendor has already provided. Claude will review these and tailor questions accordingly.
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select value={selectedCertType} onChange={e => setSelectedCertType(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                {certTypes.map(t => <option key={t}>{t}</option>)}
              </select>
              <button className="btn" onClick={() => fileInputRef.current?.click()} disabled={uploadingCert} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                {uploadingCert ? 'Uploading...' : '+ Upload'}
              </button>
              <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.txt" style={{ display: 'none' }} onChange={handleCertUpload} />
            </div>
            {uploadedCerts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {uploadedCerts.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#EAF3DE', borderRadius: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 13 }}><strong>{c.cert_type}</strong> — {c.file_name}</div>
                    <button onClick={() => setUploadedCerts(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}>×</button>
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

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={runProfile} disabled={loading || !assetName || dataSensitivity.length === 0}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <span style={spinnerStyle} />{loadingMsg}
              </span>
            ) : 'Analyse risk profile →'}
          </button>
          {dataSensitivity.length === 0 && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Select at least one data sensitivity level to continue.</div>}
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
            {tierResult.framework_notes && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
                {[
                  { key: 'iso27001', label: 'ISO 27001', color: '#2C1F0E', bg: 'var(--cream2)' },
                  { key: 'nist_csf', label: 'NIST CSF 2.0', color: '#185FA5', bg: '#E6F1FB' },
                  { key: 'cis', label: 'CIS Controls', color: 'var(--green)', bg: '#EAF3DE' },
                  { key: 'cyber_essentials', label: 'Cyber Essentials', color: 'var(--amber)', bg: '#FAEEDA' },
                ].filter(fw => tierResult.framework_notes[fw.key]).map(fw => (
                  <div key={fw.key} style={{ padding: '8px 10px', background: fw.bg, borderRadius: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: fw.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{fw.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>{tierResult.framework_notes[fw.key]}</div>
                  </div>
                ))}
              </div>
            )}
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
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, fontSize: 13 }}>
                    <div style={{ color: 'var(--muted)', flexShrink: 0, width: 20, paddingTop: 1 }}>{q.order_num}.</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 4 }}>{q.question}</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {q.control_ref && <span style={{ fontSize: 10, padding: '1px 6px', background: 'var(--cream2)', borderRadius: 3, color: 'var(--muted)' }}>ISO {q.control_ref}</span>}
                        {q.nist_ref && <span style={{ fontSize: 10, padding: '1px 6px', background: '#E6F1FB', borderRadius: 3, color: '#185FA5' }}>NIST {q.nist_ref}</span>}
                        {q.cis_ref && <span style={{ fontSize: 10, padding: '1px 6px', background: '#EAF3DE', borderRadius: 3, color: 'var(--green)' }}>CIS {q.cis_ref}</span>}
                        {q.ce_ref && <span style={{ fontSize: 10, padding: '1px 6px', background: '#FAEEDA', borderRadius: 3, color: 'var(--amber)' }}>{q.ce_ref}</span>}
                      </div>
                      {q.follow_up_trigger && <div style={{ fontSize: 11, color: 'var(--orange)', marginTop: 3 }}>↳ {q.follow_up_trigger}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Review & send</span></div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
              The vendor will receive a secure link to complete this questionnaire. After submission, you can run AI evaluation from the questionnaire detail page.
            </div>
            <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
              {[
                ['Asset', assetName], ['Type', assetType], ['Vendor', vendorName || '—'], ['Email', vendorEmail],
                ['Data sensitivity', dataSensitivity.join(', ')],
                ['Integrations', integrationDepths.join(', ')],
                ['Certs uploaded', uploadedCerts.length > 0 ? uploadedCerts.map(c => c.cert_type).join(', ') : 'None'],
                ['Tier', `Tier ${tierResult.tier} — ${tierResult.label}`],
                ['Questions', questions.length], ['Link expires', '14 days'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--muted)' }}>{label}</span>
                  <span style={{ textAlign: 'right', maxWidth: 350 }}>{value}</span>
                </div>
              ))}
            </div>
            {error && <div style={errorStyle}>{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={() => setStep(0)} style={{ flex: 1 }}>← Edit profile</button>
              <button className="btn btn-primary" onClick={saveAndSend} disabled={loading} style={{ flex: 2 }}>
                {loading ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}><span style={spinnerStyle} />{loadingMsg}</span> : 'Save & send questionnaire →'}
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
