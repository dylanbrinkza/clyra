export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { assetName, vendorUrl, profile, certifications = [], orgContext } = req.body

  const orgSection = orgContext ? `
ORGANISATION CONTEXT (use to weight the tier assignment — do not reveal in output):
- Industry: ${orgContext.industry || 'not specified'}
- Regulatory frameworks: ${orgContext.regulatory_frameworks?.join(', ') || 'not specified'}
- Data held: ${orgContext.data_types?.join(', ') || 'not specified'}
- Risk appetite: ${orgContext.risk_appetite || 'not specified'}
- Own certifications: ${orgContext.existing_certifications?.join(', ') || 'none'}
- Compliance notes: ${orgContext.compliance_notes || 'none'}
` : ''

  const prompt = `You are a senior information security risk assessor. Assign a risk tier for this vendor based on the profile provided.

${orgSection}
VENDOR PROFILE:
- Asset: ${assetName}${vendorUrl ? ` (${vendorUrl})` : ''}
- Data sensitivity: ${profile.data_sensitivity}
- Network access: ${profile.network_access}
- Integration depth: ${profile.integration_depth}
- Physical access: ${profile.physical_access}
- Vendor maturity: ${profile.vendor_maturity}
- Contract value: ${profile.contract_value}
- Criticality: ${profile.criticality}
${certifications.length > 0 ? `- Vendor certifications provided: ${certifications.join(', ')}` : ''}

Tiers: 1=Critical, 2=High, 3=Medium, 4=Low

Respond ONLY with this JSON (keep justification under 100 words):
{
  "tier": <1-4>,
  "label": "<Critical|High|Medium|Low>",
  "justification": "<concise explanation under 100 words>",
  "framework_notes": {
    "iso27001": "<key areas>",
    "nist_csf": "<key functions>",
    "cis": "<IG level and key controls>",
    "cyber_essentials": "<key areas>"
  }
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await response.json()
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'API error' })
    const text = data.content[0].text.replace(/```json|```/g, '').trim()
    return res.status(200).json(JSON.parse(text))
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
