import { useState } from 'react'

// Known domain mappings for common tools
const knownDomains = {
  'salesforce': 'salesforce.com',
  'salesforce crm': 'salesforce.com',
  'aws': 'aws.amazon.com',
  'aws production': 'aws.amazon.com',
  'amazon web services': 'aws.amazon.com',
  'slack': 'slack.com',
  'hubspot': 'hubspot.com',
  'zoom': 'zoom.us',
  'docusign': 'docusign.com',
  'microsoft teams': 'microsoft.com',
  'microsoft 365': 'microsoft.com',
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
  'onelogin': 'onelogin.com',
  'crowdstrike': 'crowdstrike.com',
  'sentinelone': 'sentinelone.com',
  'pagerduty': 'pagerduty.com',
  'datadog': 'datadoghq.com',
  'snowflake': 'snowflake.com',
  'workday': 'workday.com',
  'servicenow': 'servicenow.com',
  'zendesk': 'zendesk.com',
  'intercom': 'intercom.com',
  'stripe': 'stripe.com',
  'twilio': 'twilio.com',
  'sendgrid': 'sendgrid.com',
  'whatsapp for business': 'whatsapp.com',
  'meta': 'meta.com',
  'docusign': 'docusign.com',
  'clickup': 'clickup.com',
  'asana': 'asana.com',
  'monday': 'monday.com',
  'linear': 'linear.app',
  'vercel': 'vercel.com',
  'netlify': 'netlify.com',
}

function getDomain(vendorUrl, companyName, assetName) {
  // Check known domains first
  const nameLower = (assetName || '').toLowerCase().trim()
  const companyLower = (companyName || '').toLowerCase().trim()
  if (knownDomains[nameLower]) return knownDomains[nameLower]
  if (knownDomains[companyLower]) return knownDomains[companyLower]

  // Try vendor URL
  if (vendorUrl) {
    try {
      const url = vendorUrl.startsWith('http') ? vendorUrl : `https://${vendorUrl}`
      const hostname = new URL(url).hostname.replace('www.', '')
      if (hostname && hostname.includes('.')) return hostname
    } catch {}
  }

  // Guess from company name
  const name = companyLower
    .replace(/\s+inc\.?$/, '').replace(/\s+corp\.?$/, '').replace(/\s+ltd\.?$/, '')
    .replace(/\s+llc\.?$/, '').replace(/\s+limited\.?$/, '')
    .replace(/[^a-z0-9]/g, '').trim()
  return name ? `${name}.com` : null
}

export default function AssetLogo({ vendorUrl, companyName, assetName, size = 32 }) {
  const [failed, setFailed] = useState(false)
  const domain = getDomain(vendorUrl, companyName, assetName)

  if (!domain || failed) {
    const initial = (assetName || companyName || '?')[0].toUpperCase()
    const colors = ['#B5490A', '#2C1F0E', '#185FA5', '#2E7D32', '#854F0B', '#6B5E4F', '#993C1D', '#854F0B']
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

  return (
    <img
      src={`https://logo.clearbit.com/${domain}`}
      alt={assetName}
      onError={() => setFailed(true)}
      style={{
        width: size, height: size, borderRadius: 8,
        objectFit: 'contain', background: '#fff',
        border: '0.5px solid rgba(44,31,14,0.1)',
        flexShrink: 0, padding: 2,
      }}
    />
  )
}
