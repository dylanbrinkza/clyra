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
}

function getDomain(vendorUrl, companyName, assetName) {
  const nameLower = (assetName || '').toLowerCase().trim()
  const companyLower = (companyName || '').toLowerCase().trim()

  if (knownDomains[nameLower]) return knownDomains[nameLower]
  if (knownDomains[companyLower]) return knownDomains[companyLower]

  for (const [key, domain] of Object.entries(knownDomains)) {
    if (nameLower.includes(key) || key.includes(nameLower.split(' ')[0])) return domain
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
  const [failed, setFailed] = useState(false)
  const domain = getDomain(vendorUrl, companyName, assetName)

  if (!domain || failed) {
    return <Fallback assetName={assetName} companyName={companyName} size={size} />
  }

  // Use Google's favicon service — reliable, no auth needed, works for all domains
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

  return (
    <div style={{
      width: size, height: size, borderRadius: 8, background: '#fff',
      border: '0.5px solid rgba(44,31,14,0.1)', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <img
        src={faviconUrl}
        alt={assetName}
        onError={() => setFailed(true)}
        style={{ width: size * 0.65, height: size * 0.65, objectFit: 'contain' }}
      />
    </div>
  )
}
