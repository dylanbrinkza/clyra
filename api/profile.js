export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { assetName, vendorUrl, profile, certifications = [] } = req.body

  const prompt = `You are a senior information security risk assessor. Based on the following vendor profile, assign a risk tier and provide a plain-English justification.

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
${certifications.length > 0 ? `- Existing certifications provided: ${certifications.join(', ')}` : ''}

Risk tiers:
- Tier 1 (Critical): Privileged access, sensitive data, mission critical dependency
- Tier 2 (High): Internal network access or personal data processing
- Tier 3 (Medium): API integration or non-sensitive data
- Tier 4 (Low): Standalone, no data access, non-critical

Note: If certifications have been provided, factor these into the tier justification — they provide partial assurance but do not reduce the tier assignment itself.

Respond ONLY with a JSON object, no other text:
{
  "tier": <1, 2, 3, or 4>,
  "label": "<Critical | High | Medium | Low>",
  "justification": "<2-3 sentence plain English explanation of why this tier was assigned and what the key risk drivers are>"
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await response.json()
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'API error' })
    return res.status(200).json(JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim()))
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
