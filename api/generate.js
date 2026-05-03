export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { assetName, vendorUrl, tier, profile, certifications = [] } = req.body

  const domainsByTier = {
    1: ['Information Security Policy', 'Access Control', 'Data Protection and Privacy', 'Incident Management', 'Business Continuity and Disaster Recovery', 'Third-Party and Supply Chain Management', 'Physical Security', 'Vulnerability and Patch Management', 'Change Management', 'Compliance and Certification'],
    2: ['Information Security Policy', 'Access Control', 'Data Protection and Privacy', 'Incident Management', 'Business Continuity and Disaster Recovery', 'Vulnerability and Patch Management', 'Compliance and Certification'],
    3: ['Information Security Policy', 'Access Control', 'Data Protection and Privacy', 'Incident Management', 'Compliance and Certification'],
    4: ['Information Security Policy', 'Access Control', 'Compliance and Certification'],
  }

  const questionCounts = { 1: 40, 2: 25, 3: 15, 4: 8 }
  const domains = domainsByTier[tier] || domainsByTier[3]
  const count = questionCounts[tier] || 15

  const certContext = certifications.length > 0
    ? `The vendor has already provided the following certifications: ${certifications.join(', ')}. For areas well-covered by these certifications, ask targeted follow-up questions to verify scope, currency, and any exceptions — rather than asking basic questions already answered by the cert. Focus deeper questioning on areas NOT covered by these certifications.`
    : 'No certifications have been provided upfront.'

  const prompt = `You are a senior information security assessor creating a vendor risk questionnaire.

Vendor: ${assetName}
${vendorUrl ? `Vendor website: ${vendorUrl} — use this to understand what the tool does and tailor questions specifically to its function and risk profile.` : ''}
Risk Tier: Tier ${tier}
Data sensitivity: ${profile.data_sensitivity}
Network access: ${profile.network_access}
Integration depth: ${profile.integration_depth}
Criticality: ${profile.criticality}

Certification context: ${certContext}

Generate exactly ${count} security questionnaire questions covering these domains: ${domains.join(', ')}.

Requirements:
- Questions must be specific to this vendor and its actual function — not generic boilerplate
- Map each question to an ISO 27001:2022 Annex A control reference
- Include adaptive follow-up triggers where relevant
- Where certifications have been provided, probe scope/exceptions rather than asking basics
- Weight questions toward the vendor's specific risk profile and integration depth

Respond ONLY with a JSON array, no other text:
[
  {
    "domain": "<domain name>",
    "question": "<the question text>",
    "control_ref": "<ISO 27001:2022 Annex A reference>",
    "order_num": <1, 2, 3...>,
    "follow_up_trigger": "<condition that triggers a follow-up, or empty string>"
  }
]`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await response.json()
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'API error' })
    return res.status(200).json(JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim()))
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
