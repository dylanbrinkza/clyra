export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { assetName, profile } = req.body

  const prompt = `You are a senior information security risk assessor. Based on the following vendor profile, assign a risk tier and provide a plain-English justification.

Vendor/Asset: ${assetName}

Profile inputs:
- Data sensitivity: ${profile.data_sensitivity}
- Network access: ${profile.network_access}
- Integration depth: ${profile.integration_depth}
- Physical access: ${profile.physical_access}
- Vendor maturity: ${profile.vendor_maturity}
- Contract value: ${profile.contract_value}
- Criticality: ${profile.criticality}

Risk tiers:
- Tier 1 (Critical): Privileged access, sensitive data, mission critical dependency
- Tier 2 (High): Internal network access or personal data processing
- Tier 3 (Medium): API integration or non-sensitive data
- Tier 4 (Low): Standalone, no data access, non-critical

Respond ONLY with a JSON object, no other text:
{
  "tier": <1, 2, 3, or 4>,
  "label": "<Critical | High | Medium | Low>",
  "justification": "<2-3 sentence plain English explanation of why this tier was assigned and what the key risk drivers are>"
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await response.json()
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'API error' })
    const text = data.content[0].text.replace(/```json|```/g, '').trim()
    return res.status(200).json(JSON.parse(text))
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
