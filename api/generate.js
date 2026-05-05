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

  // Org context informs DEPTH and FOCUS of questions only — never appears in question text
  // Questions must be written from a neutral assessor perspective, not revealing the buyer's posture
  const orgGuidance = orgContext ? `
INTERNAL ASSESSOR GUIDANCE (do NOT include this information in any question text — use it only to determine which areas to probe more deeply):
- Regulatory environment: ${orgContext.regulatory_frameworks?.join(', ') || 'not specified'}
- Data held by our organisation: ${orgContext.data_types?.join(', ') || 'not specified'}
- Our risk appetite: ${orgContext.risk_appetite || 'not specified'}
- Our certifications: ${orgContext.existing_certifications?.join(', ') || 'none'}
- Industry: ${orgContext.industry || 'not specified'}

USE THIS TO:
- Prioritise questions relevant to our regulatory obligations (e.g. if GDPR regulated, weight data protection questions)
- Probe deeper on areas where our risk appetite is low
- Ask for certifications we would consider minimum standard
- Focus on data types we actually hold

DO NOT:
- Mention our organisation, our certifications, our data holdings, or our regulatory status in any question
- Write questions that reveal what the assessor knows about their own organisation
- Assume the vendor knows anything about the buyer
` : ''

  const certContext = certifications.length > 0
    ? `The vendor has provided the following certifications upfront: ${certifications.join(', ')}. For areas covered by these certifications, ask targeted follow-up questions about scope, expiry, and exceptions rather than basics. Focus deeper questioning on areas NOT covered.`
    : 'No certifications provided — question all domains thoroughly.'

  const integrationContext = profile.integration_depth && !profile.integration_depth.toLowerCase().includes('standalone')
    ? `Integration type: ${profile.integration_depth}`
    : 'This is a standalone tool with no system integration.'

  const prompt = `You are a neutral information security assessor writing a vendor security questionnaire on behalf of a client organisation. The questions will be sent directly to the vendor — they must be written from a neutral, professional assessor perspective.

CRITICAL RULES:
1. Questions must NEVER reveal information about the client organisation (their certifications, data holdings, regulatory status, or internal processes)
2. Questions must be phrased as "Do you..." or "Can you provide..." or "What is your..." — from the vendor's perspective
3. Do NOT write questions like "Given our X..." or "As we hold Y..." or "Given our organisation's Z..."
4. Questions should be answerable by any vendor's security team without knowing anything about the client
5. Where the vendor profile indicates standalone/no integration, do NOT ask about integration or API security

VENDOR BEING ASSESSED:
- Vendor/product: ${assetName}${vendorUrl ? ` (${vendorUrl})` : ''}
- Risk Tier: Tier ${tier}
- Data sensitivity: ${profile.data_sensitivity}
- Network access: ${profile.network_access}
- ${integrationContext}
- Physical access: ${profile.physical_access}
- Criticality: ${profile.criticality}

${orgGuidance}

Certification context: ${certContext}

Generate exactly ${count} questions covering these domains: ${domains.join(', ')}.

Each question must:
- Be specific to this vendor's product and function
- Be phrased neutrally from an assessor perspective — never from the client's perspective
- Reference applicable framework controls
- Be answerable without the vendor knowing anything about the client
- For DRP/BCP questions: NEVER assume a specific country or region for data centres. Ask "Where are your primary and secondary data centres located?" rather than assuming UK. Use neutral phrasing like "your primary processing location" not "your UK data centre".
- For regulatory follow-up triggers: write them in plain English. For example instead of "If adverse regulatory findings exist" write "If the vendor has received any regulatory findings or enforcement actions, ask for details and remediation steps taken."
- For SYSC/FCA questions: ask whether the vendor undergoes independent security assessments and can share findings — do not reference specific FCA supervisory processes in a way that assumes the vendor understands FCA internal terminology.

Respond ONLY with a JSON array, no other text:
[
  {
    "domain": "<domain>",
    "question": "<neutral, vendor-facing question>",
    "control_ref": "<ISO 27001:2022 ref>",
    "nist_ref": "<NIST CSF 2.0 ref>",
    "cis_ref": "<CIS Controls v8 ref>",
    "ce_ref": "<Cyber Essentials ref or empty string>",
    "order_num": <number>,
    "follow_up_trigger": "<specific condition that triggers follow-up, written neutrally, or empty string>"
  }
]`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await response.json()
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'API error' })

    const text = data.content[0].text.replace(/```json|```/g, '').trim()

    // Handle truncated JSON gracefully
    let questions
    try {
      questions = JSON.parse(text)
    } catch {
      // Try to recover partial JSON
      const lastBracket = text.lastIndexOf('},')
      if (lastBracket > 0) {
        try {
          questions = JSON.parse(text.substring(0, lastBracket + 1) + ']')
        } catch {
          return res.status(500).json({ error: 'Question generation produced malformed output. Please try again.' })
        }
      } else {
        return res.status(500).json({ error: 'Question generation produced malformed output. Please try again.' })
      }
    }

    return res.status(200).json(Array.isArray(questions) ? questions : [])
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
