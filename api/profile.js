export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { assetName, vendorUrl, profile, certifications = [], orgContext } = req.body

  const orgSection = orgContext ? `
ORGANISATION CONTEXT (use this to personalise the assessment):
- Company: ${orgContext.company_name || 'Not specified'}
- Industry: ${orgContext.industry || 'Not specified'}
- Size: ${orgContext.employee_count || 'Not specified'} employees
- Countries: ${orgContext.countries?.join(', ') || 'Not specified'}
- Regulatory frameworks: ${orgContext.regulatory_frameworks?.join(', ') || 'Not specified'}
- Data held: ${orgContext.data_types?.join(', ') || 'Not specified'}
- Data subjects: ${orgContext.data_subject_count || 'Not specified'}
- Special category data: ${orgContext.special_category_data ? 'Yes' : 'No'}
- Tech environment: ${orgContext.tech_environment || 'Not specified'}
- Own certifications: ${orgContext.existing_certifications?.join(', ') || 'None'}
- Risk appetite: ${orgContext.risk_appetite || 'Not specified'}
- Compliance notes: ${orgContext.compliance_notes || 'None'}
` : 'No organisation context provided — assess using general best practice standards.'

  const prompt = `You are a senior information security risk assessor with deep expertise across ISO 27001:2022, NIST CSF 2.0, CIS Controls v8, and Cyber Essentials.

${orgSection}

VENDOR BEING ASSESSED:
- Asset/Vendor: ${assetName}
${vendorUrl ? `- Website: ${vendorUrl}` : ''}
- Data sensitivity: ${profile.data_sensitivity}
- Network access: ${profile.network_access}
- Integration depth: ${profile.integration_depth}
- Physical access: ${profile.physical_access}
- Vendor maturity: ${profile.vendor_maturity}
- Contract value: ${profile.contract_value}
- Criticality: ${profile.criticality}
${certifications.length > 0 ? `- Certifications provided by vendor: ${certifications.join(', ')}` : ''}

Assign a risk tier based on the vendor profile AND the organisation's specific context. A vendor that handles personal data is higher risk for an FCA-regulated firm than for a low-risk internal tool provider. A vendor with only Cyber Essentials is insufficient for an ISO 27001-certified organisation's critical supply chain.

Risk tiers:
- Tier 1 (Critical): Privileged access, sensitive data, mission critical. Full multi-framework assessment required.
- Tier 2 (High): Internal network access or personal data processing. Comprehensive assessment.
- Tier 3 (Medium): API integration or non-sensitive data. Standard assessment.
- Tier 4 (Low): Standalone, no data access, non-critical. Foundational assessment.

Respond ONLY with a JSON object, no other text:
{
  "tier": <1, 2, 3, or 4>,
  "label": "<Critical | High | Medium | Low>",
  "justification": "<3-4 sentences explaining the tier assignment in context of this specific organisation's regulatory environment, data landscape, and risk appetite>",
  "framework_notes": {
    "iso27001": "<key ISO 27001 risk areas for this vendor given the org context>",
    "nist_csf": "<key NIST CSF functions of concern>",
    "cis": "<applicable CIS Implementation Group and key controls>",
    "cyber_essentials": "<Cyber Essentials areas of focus>"
  }
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await response.json()
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'API error' })
    return res.status(200).json(JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim()))
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
