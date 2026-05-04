export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { assetName, vendorUrl, profile, certifications = [] } = req.body

  const prompt = `You are a senior information security risk assessor with deep expertise across ISO 27001:2022, NIST CSF 2.0, CIS Controls v8, and Cyber Essentials.

Vendor/Asset: ${assetName}
${vendorUrl ? `Vendor website: ${vendorUrl}` : ''}

Profile inputs:
- Data sensitivity: ${profile.data_sensitivity}
- Network access: ${profile.network_access}
- Integration depth: ${profile.integration_depth}
- Physical access: ${profile.physical_access}
- Vendor maturity: ${profile.vendor_maturity}
- Contract value: ${profile.contract_value}
- Criticality: ${profile.criticality}
${certifications.length > 0 ? `- Existing certifications provided: ${certifications.join(', ')}` : '- No certifications provided upfront'}

Risk tier definitions:
- Tier 1 (Critical): Privileged access, special category or financial data, mission critical dependency. Full assessment across all frameworks required.
- Tier 2 (High): Internal network access or personal data processing. Comprehensive assessment covering core framework domains.
- Tier 3 (Medium): API integration or non-sensitive data. Standard assessment covering key framework areas.
- Tier 4 (Low): Standalone, no data access, non-critical. Foundational assessment only.

Evaluate the tier considering requirements across ALL four frameworks:
- ISO 27001:2022: Data protection, access control, incident management obligations
- NIST CSF 2.0: Govern, Identify, Protect, Detect, Respond, Recover functions
- CIS Controls v8: Implementation Group requirements relative to data sensitivity and access
- Cyber Essentials: Boundary firewalls, secure configuration, access control, malware protection, patch management

Certifications provided (if any) indicate partial assurance but do not reduce the tier — they inform the depth of questioning.

Respond ONLY with a JSON object, no other text:
{
  "tier": <1, 2, 3, or 4>,
  "label": "<Critical | High | Medium | Low>",
  "justification": "<3-4 sentence plain English explanation covering the key risk drivers across the relevant frameworks and why this tier was assigned>",
  "framework_notes": {
    "iso27001": "<key ISO 27001 risk areas for this vendor>",
    "nist_csf": "<key NIST CSF functions of concern>",
    "cis": "<CIS Implementation Group applicable and key controls>",
    "cyber_essentials": "<Cyber Essentials areas of focus>"
  }
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await response.json()
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'API error' })
    return res.status(200).json(JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim()))
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
