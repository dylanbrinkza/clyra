import { useState } from 'react'

function getDomain(vendorUrl, companyName, assetName) {
  // Try vendor URL first
  if (vendorUrl) {
    try {
      const url = vendorUrl.startsWith('http') ? vendorUrl : `https://${vendorUrl}`
      return new URL(url).hostname.replace('www.', '')
    } catch {}
  }

  // Fall back to guessing from company or asset name
  const name = (companyName || assetName || '').toLowerCase()
    .replace(/\s+inc\.?$/, '').replace(/\s+corp\.?$/, '').replace(/\s+ltd\.?$/, '')
    .replace(/\s+llc\.?$/, '').replace(/[^a-z0-9]/g, '') 
  return name ? `${name}.com` : null
}

export default function AssetLogo({ vendorUrl, companyName, assetName, size = 32 }) {
  const [failed, setFailed] = useState(false)
  const domain = getDomain(vendorUrl, companyName, assetName)

  if (!domain || failed) {
    // Fallback — coloured initial avatar
    const initial = (assetName || companyName || '?')[0].toUpperCase()
    const colors = ['#B5490A', '#2C1F0E', '#185FA5', '#2E7D32', '#854F0B', '#6B5E4F']
    const color = colors[(assetName || '').charCodeAt(0) % colors.length]
    return (
      <div style={{
        width: size, height: size, borderRadius: 8, background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.4, fontWeight: 600, color: '#fff', flexShrink: 0,
      }}>
        {initial}
      </div>
    )
  }

  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={assetName}
      onError={() => setFailed(true)}
      style={{
        width: size, height: size, borderRadius: 8,
        objectFit: 'contain', background: '#fff',
        border: '0.5px solid rgba(44,31,14,0.1)',
        flexShrink: 0,
      }}
    />
  )
}
