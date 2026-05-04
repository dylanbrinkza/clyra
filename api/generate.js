export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { assetName, vendorUrl, tier, profile, certifications = [], orgContext } = req.body

  const domainsByTier = {
    1: ['Information Security Policy', 'Access Control', 'Data Protection and Privacy', 'Incident Management', 'Business Continuity and Disaster Recovery', 'Third-Party and Supply Chain Management', 'Physical Security', 'Vulnerability and Patch Management', 'Change Management', 'Compliance and Certification'],
    2: ['Information Security Policy', 'Access Control', 'Data Protection and Privacy', 'Incident Management', 'Business Continuity and Disaster Recovery', 'Vulnerability and Patch Management', 'Compliance and Certification'],
    3: ['Information Security Policy', 'Access Control', 'Data Protection and Privacy', 'Incident Management', 'Compliance and Certification'],
    4: ['Information Security Policy', 'Access Control', 'Compliance and Certification'],
  }

  const questionCounts = { 1: 40, 2: 25, 3: 15, 4: 8 }
  const domains = domainsByTier[tier] || domainsByTier[3]
  const count = questionCounts[tier] || 15

  const orgSection = orgContext ? `
ORGANISATION CONTEXT:
- Company: ${orgContext.company_name || 'Not specified'} | Industry: ${orgContext.industry || 'Not specified'}
- Regulatory frameworks: ${orgContext.regulatory_frameworks?.join(', ') || 'Not specified'}
- Data held: ${orgContext.data_types?.join(', ') || 'Not specified'}
- Special category data: ${orgContext.special_category_data ? 'Yes' : 'No'}
- Own certifications: ${orgContext.existing_certifications?.join(', ') || 'None'}
- Risk appetite: ${orgContext.risk_appetite || 'Not specified'}
- Compliance notes: ${orgContext.compliance_notes || 'None'}

Use this context to make questions relevant to this organisation's specific obligations. For example:
- If they are FCA regulated, probe vendor's financial data handling and SYSC-relevant controls
- If they hold health data, probe DSPT/HIPAA relevant controls
- If they hold children's data, probe age verification and COPPA/GDPR-K relevant controls
- Frame questions around the organisation's actual regulatory exposure, not generic best practice
` : ''

  const certContext = certifications.length > 0
    ? `Vendor has provided: ${certifications.join(', ')}. Probe scope, exceptions and currency rather than basics for covered areas.`
    : 'No certifications provided — question all domains thoroughly.'

  const prompt = `You are a senior information security assessor with expertise in ISO 27001:2022, NIST CSF 2.0, CIS Controls v8, and Cyber Essentials.
${orgSection}
VENDOR BEING ASSESSED:
- Vendor: ${assetName}${vendorUrl ? ` (${vendorUrl})` : ''}
- Risk Tier: Tier ${tier}
- Data sensitivity: ${profile.data_sensitivity}
- Network access: ${profile.network_access}
- Integration depth: ${profile.integration_depth}
- Criticality: ${profile.criticality}

Certification context: ${certContext}

Generate exactly ${count} questions covering: ${domains.join(', ')}.

Each question must:
- Be specific to this vendor's function and this organisation's context — not generic boilerplate
- Reference all applicable frameworks with control references
- Be answerable by a vendor's security or compliance team

Respond ONLY with a JSON array, no other text:
[
  {
    "domain": "<domain>",
    "question": "<specific question>",
    "control_ref": "<ISO 27001:2022 ref e.g. A.8.2>",
    "nist_ref": "<NIST CSF 2.0 ref e.g. PR.AC-01>",
    "cis_ref": "<CIS Controls v8 ref e.g. CIS 5.1>",
    "ce_ref": "<Cyber Essentials ref or empty string>",
    "order_num": <number>,
    "follow_up_trigger": "<condition or empty string>"
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
