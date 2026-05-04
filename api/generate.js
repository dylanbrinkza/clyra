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
    ? `The vendor has provided: ${certifications.join(', ')}. For areas evidenced by these certifications, ask targeted follow-up questions about scope, currency, and exceptions rather than basics. Focus deeper questioning on areas NOT covered.`
    : 'No certifications provided upfront — question all domains thoroughly.'

  const prompt = `You are a senior information security assessor with expertise in ISO 27001:2022, NIST CSF 2.0, CIS Controls v8, and Cyber Essentials. You are generating a vendor risk questionnaire.

Vendor: ${assetName}
${vendorUrl ? `Vendor website: ${vendorUrl} — use this to understand the tool and tailor questions to its specific function and risk profile.` : ''}
Risk Tier: Tier ${tier}
Data sensitivity: ${profile.data_sensitivity}
Network access: ${profile.network_access}
Integration depth: ${profile.integration_depth}
Criticality: ${profile.criticality}

Certification context: ${certContext}

Generate exactly ${count} questions covering these domains: ${domains.join(', ')}.

Each question must be mapped to controls across ALL applicable frameworks. For each question provide:
- The specific domain
- A clear, vendor-specific question (not generic boilerplate)
- ISO 27001:2022 Annex A control reference (e.g. A.8.2)
- NIST CSF 2.0 reference (e.g. PR.AC-01, DE.CM-01)
- CIS Controls v8 reference (e.g. CIS 5.1, CIS 6.2)
- Cyber Essentials reference where applicable (e.g. CE: Access Control, CE: Patch Management) or empty string
- Adaptive follow-up trigger if the answer requires deeper probing

Weight questions toward the vendor's specific risk profile and integration depth. Questions must be specific to this vendor's function, not generic.

Respond ONLY with a JSON array, no other text:
[
  {
    "domain": "<domain name>",
    "question": "<specific question text>",
    "control_ref": "<ISO 27001:2022 ref>",
    "nist_ref": "<NIST CSF 2.0 ref>",
    "cis_ref": "<CIS Controls v8 ref>",
    "ce_ref": "<Cyber Essentials ref or empty string>",
    "order_num": <1, 2, 3...>,
    "follow_up_trigger": "<condition that triggers follow-up, or empty string>"
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
