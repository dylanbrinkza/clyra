export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { assetName, tier, profile } = req.body

  const domainsByTier = {
    1: ['Information Security Policy', 'Access Control', 'Data Protection and Privacy', 'Incident Management', 'Business Continuity and Disaster Recovery', 'Third-Party and Supply Chain Management', 'Physical Security', 'Vulnerability and Patch Management', 'Change Management', 'Compliance and Certification'],
    2: ['Information Security Policy', 'Access Control', 'Data Protection and Privacy', 'Incident Management', 'Business Continuity and Disaster Recovery', 'Vulnerability and Patch Management', 'Compliance and Certification'],
    3: ['Information Security Policy', 'Access Control', 'Data Protection and Privacy', 'Incident Management', 'Compliance and Certification'],
    4: ['Information Security Policy', 'Access Control', 'Compliance and Certification'],
  }

  const questionCounts = { 1: 40, 2: 25, 3: 15, 4: 8 }
  const domains = domainsByTier[tier] || domainsByTier[3]
  const count = questionCounts[tier] || 15

  const prompt = `You are a senior information security assessor creating a vendor risk questionnaire.

Vendor: ${assetName}
Risk Tier: Tier ${tier}
Data sensitivity: ${profile.data_sensitivity}
Network access: ${profile.network_access}
Integration depth: ${profile.integration_depth}
Criticality: ${profile.criticality}

Generate exactly ${count} security questionnaire questions covering these domains: ${domains.join(', ')}.

Requirements:
- Questions must be specific and answerable (not vague)
- Map each question to an ISO 27001:2022 Annex A control reference
- Include adaptive follow-up triggers where relevant (e.g. if vendor claims ISO 27001, ask for cert details)
- Weight questions toward the vendor's specific risk profile
- For Tier 1, include questions about privileged access, data handling, and sub-processors
- Questions should be answerable by a vendor's security or compliance team

Respond ONLY with a JSON array, no other text:
[
  {
    "domain": "<domain name>",
    "question": "<the question text>",
    "control_ref": "<ISO 27001:2022 Annex A reference e.g. A.8.2>",
    "order_num": <1, 2, 3...>,
    "follow_up_trigger": "<condition that triggers a follow-up, or empty string>"
  }
]`

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
        max_tokens: 4000,
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
