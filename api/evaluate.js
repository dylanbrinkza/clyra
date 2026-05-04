export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { assetName, tier, profile, questions, responses } = req.body

  const qaPairs = questions.map((q, i) => ({
    domain: q.domain,
    question: q.question,
    control_ref: q.control_ref,
    nist_ref: q.nist_ref || '',
    cis_ref: q.cis_ref || '',
    ce_ref: q.ce_ref || '',
    answer: responses[i]?.answer || 'No answer provided',
  }))

  const prompt = `You are a senior information security assessor with deep expertise across ISO 27001:2022, NIST CSF 2.0, CIS Controls v8, and Cyber Essentials. You are evaluating a completed vendor risk questionnaire.

Vendor: ${assetName}
Risk Tier: Tier ${tier} (${tier === 1 ? 'Critical' : tier === 2 ? 'High' : tier === 3 ? 'Medium' : 'Low'})
Data sensitivity: ${profile.data_sensitivity}
Network access: ${profile.network_access}
Integration depth: ${profile.integration_depth || 'Not specified'}
Criticality: ${profile.criticality}

Questionnaire responses:
${qaPairs.map((qa) => `[${qa.domain}]
Controls: ISO ${qa.control_ref}${qa.nist_ref ? ` | NIST ${qa.nist_ref}` : ''}${qa.cis_ref ? ` | CIS ${qa.cis_ref}` : ''}${qa.ce_ref ? ` | ${qa.ce_ref}` : ''}
Q: ${qa.question}
A: ${qa.answer}`).join('\n\n')}

Evaluate these responses rigorously against ALL four frameworks:

1. ISO 27001:2022 — Are controls adequate for the Annex A requirements relevant to this vendor's tier and data handling?
2. NIST CSF 2.0 — Are the Govern, Identify, Protect, Detect, Respond, Recover functions adequately addressed?
3. CIS Controls v8 — Do responses demonstrate the Implementation Group controls appropriate to this tier?
4. Cyber Essentials — Are the five key areas (boundary firewalls, secure configuration, access control, malware protection, patch management) adequately evidenced?

For each finding, identify which framework(s) the gap relates to. Flag any answers that are evasive, vague, contradictory, or implausible given the vendor's stated profile.

The verdict must reflect the combined view across all frameworks — a vendor may pass ISO 27001 requirements but fail NIST CSF Respond function, which should affect the verdict.

Respond ONLY with a JSON object, no other text:
{
  "score": <0-100, higher = more risk>,
  "verdict": "<Accept | Accept with conditions | Escalate for further review | Do not proceed>",
  "summary": "<3-4 sentence plain English summary of the vendor's security posture across all four frameworks>",
  "framework_assessment": {
    "iso27001": "<1-2 sentence assessment of ISO 27001 posture>",
    "nist_csf": "<1-2 sentence assessment of NIST CSF posture>",
    "cis": "<1-2 sentence assessment of CIS Controls posture>",
    "cyber_essentials": "<1-2 sentence assessment of Cyber Essentials posture>"
  },
  "strengths": [
    {
      "title": "<short strength title>",
      "detail": "<1-2 sentence explanation>",
      "frameworks": ["<ISO 27001 | NIST CSF | CIS Controls | Cyber Essentials>"]
    }
  ],
  "recommendations": [
    {
      "severity": "<Required | Recommended | Advisory>",
      "title": "<short recommendation title>",
      "detail": "<specific actionable recommendation>",
      "iso_ref": "<ISO 27001:2022 Annex A reference>",
      "nist_ref": "<NIST CSF 2.0 reference>",
      "cis_ref": "<CIS Controls v8 reference>",
      "ce_ref": "<Cyber Essentials reference or empty string>",
      "flagged": <true if answer was evasive or vague>
    }
  ],
  "flagged_responses": [<0-indexed question numbers with evasive/vague/implausible answers>]
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
    })
    const data = await response.json()
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'API error' })
    const evaluation = JSON.parse(data.content[0].text.replace(/```json|```/g, '').trim())

    evaluation.findings = evaluation.recommendations?.map(r => ({
      severity: r.severity?.toLowerCase() === 'required' ? 'red' : r.severity?.toLowerCase() === 'recommended' ? 'amber' : 'gray',
      text: r.detail,
      label: r.severity,
      flagged: r.flagged,
    })) || []

    return res.status(200).json(evaluation)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
