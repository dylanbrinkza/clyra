import { useState } from 'react'

const knownDomains = {
  'salesforce crm': 'salesforce.com',
  'salesforce': 'salesforce.com',
  'aws production': 'amazon.com',
  'aws': 'amazon.com',
  'amazon web services': 'amazon.com',
  'slack': 'slack.com',
  'hubspot': 'hubspot.com',
  'zoom': 'zoom.us',
  'docusign': 'docusign.com',
  'microsoft teams': 'microsoft.com',
  'microsoft 365': 'microsoft.com',
  'microsoft': 'microsoft.com',
  'google workspace': 'google.com',
  'gmail': 'google.com',
  'github': 'github.com',
  'gitlab': 'gitlab.com',
  'jira': 'atlassian.com',
  'confluence': 'atlassian.com',
  'atlassian': 'atlassian.com',
  'notion': 'notion.so',
  'figma': 'figma.com',
  'miro': 'miro.com',
  'dropbox': 'dropbox.com',
  'box': 'box.com',
  'okta': 'okta.com',
  'crowdstrike': 'crowdstrike.com',
  'crowdstrike edr': 'crowdstrike.com',
  'sentinelone': 'sentinelone.com',
  'sentinelone edr': 'sentinelone.com',
  'pagerduty': 'pagerduty.com',
  'datadog': 'datadoghq.com',
  'snowflake': 'snowflake.com',
  'workday': 'workday.com',
  'servicenow': 'servicenow.com',
  'zendesk': 'zendesk.com',
  'intercom': 'intercom.com',
  'stripe': 'stripe.com',
  'twilio': 'twilio.com',
  'whatsapp for business': 'whatsapp.com',
  'whatsapp': 'whatsapp.com',
  'meta': 'meta.com',
  'clickup': 'clickup.com',
  'asana': 'asana.com',
  'monday': 'monday.com',
  'linear': 'linear.app',
  'vercel': 'vercel.com',
  'netlify': 'netlify.com',
  'azure': 'microsoft.com',
  'google cloud': 'google.com',
  'gcp': 'google.com',
}

function getDomain(vendorUrl, companyName, assetName) {
  const nameLower = (assetName || '').toLowerCase().trim()
  const companyLower = (companyName || '').toLowerCase().trim()

  if (knownDomains[nameLower]) return knownDomains[nameLower]
  if (knownDomains[companyLower]) return knownDomains[companyLower]

  // Partial match — check if asset name starts with a known key
  for (const [key, domain] of Object.entries(knownDomains)) {
    if (nameLower.startsWith(key) || key.startsWith(nameLower)) return domain
  }

  if (vendorUrl) {
    try {
      const url = vendorUrl.startsWith('http') ? vendorUrl : `https://${vendorUrl}`
      const hostname = new URL(url).hostname.replace('www.', '')
      if (hostname && hostname.includes('.')) return hostname
    } catch {}
  }

  const name = companyLower
    .replace(/\s+inc\.?$/, '').replace(/\s+corp\.?$/, '').replace(/\s+ltd\.?$/, '')
    .replace(/\s+llc\.?$/, '').replace(/\s+limited\.?$/, '')
    .replace(/[^a-z0-9]/g, '').trim()
  return name ? `${name}.com` : null
}

function Fallback({ assetName, companyName, size }) {
  const initial = (assetName || companyName || '?')[0].toUpperCase()
  const colors = ['#B5490A', '#2C1F0E', '#185FA5', '#2E7D32', '#854F0B', '#6B5E4F', '#993C1D', '#5C4D3C']
  const color = colors[(assetName || '').charCodeAt(0) % colors.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: 8, background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.42, fontWeight: 600, color: '#fff', flexShrink: 0,
    }}>
      {initial}
    </div>
  )
}

export default function AssetLogo({ vendorUrl, companyName, assetName, size = 32 }) {
  const [clearbitFailed, setClearbitFailed] = useState(false)
  const [logodevFailed, setLogodevFailed] = useState(false)
  const domain = getDomain(vendorUrl, companyName, assetName)

  if (!domain) return <Fallback assetName={assetName} companyName={companyName} size={size} />

  const imgStyle = {
    width: size, height: size, borderRadius: 8,
    objectFit: 'contain', background: '#fff',
    border: '0.5px solid rgba(44,31,14,0.1)',
    flexShrink: 0, padding: 2,
  }

  // Try Clearbit first
  if (!clearbitFailed) {
    return (
      <img
        src={`https://logo.clearbit.com/${domain}`}
        alt={assetName}
        onError={() => setClearbitFailed(true)}
        style={imgStyle}
      />
    )
  }

  // Fallback to Logo.dev
  if (!logodevFailed) {
    return (
      <img
        src={`https://img.logo.dev/${domain}?token=pk_X-1ZO13GSgeOoUrIuJ6BeQ`}
        alt={assetName}
        onError={() => setLogodevFailed(true)}
        style={imgStyle}
      />
    )
  }

  // Final fallback — coloured initial
  return <Fallback assetName={assetName} companyName={companyName} size={size} />
}
