import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AddAssetModal({ onClose }) {
  const navigate = useNavigate()
  const [assetName, setAssetName] = useState('')
  const [assetType, setAssetType] = useState('SaaS')
  const [companyName, setCompanyName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')

  const handleProceed = () => {
    onClose()
    navigate('/questionnaires/new', {
      state: {
        prefill: {
          assetName,
          assetType,
          companyName,
          contactName,
          contactEmail,
        }
      }
    })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(26,18,8,0.35)' }} />
      <div style={{ position: 'relative', width: 480, height: '100vh', background: '#fff', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', zIndex: 1 }}>
        <div style={{ padding: '1.5rem', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>Add asset</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>Start with basic details — risk tier will be assigned by AI</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--muted)', lineHeight: 1, padding: 4 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Asset name *</label>
            <input value={assetName} onChange={e => setAssetName(e.target.value)}
              placeholder="e.g. Salesforce CRM" style={inputStyle} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Asset type *</label>
            <select value={assetType} onChange={e => setAssetType(e.target.value)} style={inputStyle}>
              <option>SaaS</option>
              <option>Cloud infra</option>
              <option>Managed service</option>
              <option>Physical asset</option>
              <option>Internal tool</option>
            </select>
          </div>

          <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Vendor details</div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>Company name</label>
              <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                placeholder="e.g. Salesforce Inc." style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Contact name</label>
                <input value={contactName} onChange={e => setContactName(e.target.value)}
                  placeholder="Jane Smith" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Contact email</label>
                <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                  placeholder="jane@vendor.com" style={inputStyle} />
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--cream)', borderRadius: 8, padding: '12px 14px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Risk tier is assigned by AI</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              After adding basic details, you'll complete a risk profile questionnaire. Claude will analyse the profile and assign a risk tier (Tier 1–4) with a plain-English justification.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} className="btn" style={{ flex: 1 }}>Cancel</button>
            <button onClick={handleProceed} disabled={!assetName} className="btn btn-primary" style={{ flex: 2 }}>
              Continue to risk profile →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const labelStyle = { fontSize: 12, fontWeight: 500, color: 'var(--muted)', display: 'block', marginBottom: 6 }
const inputStyle = { width: '100%', padding: '9px 12px', border: '0.5px solid rgba(44,31,14,0.25)', borderRadius: 8, fontSize: 13, background: '#fff', color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }
