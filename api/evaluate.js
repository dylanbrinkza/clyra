export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { assetName, tier, profile, questions, responses, orgContext } = req.body

  const qaPairs = questions.map((q, i) => ({
    domain: q.domain,
    question: q.question,
    control_ref: q.control_ref,
    nist_ref: q.nist_ref || '',
    cis_ref: q.cis_ref || '',
    ce_ref: q.ce_ref || '',
    answer: responses[i]?.answer || 'No answer provided',
  }))

  const orgSection = orgContext ? `
ORGANISATION CONTEXT (frame all findings against this):
- Company: ${orgContext.company_name || 'Not specified'} | Industry: ${orgContext.industry || 'Not specified'}
- Regulatory frameworks: ${orgContext.regulatory_frameworks?.join(', ') || 'Not specified'}
- Data held: ${orgContext.data_types?.join(', ') || 'Not specified'} | Special category: ${orgContext.special_category_data ? 'Yes' : 'No'}
- Data subjects: ${orgContext.data_subject_count || 'Not specified'}
- Own certifications: ${orgContext.existing_certifications?.join(', ') || 'None'}
- Risk appetite: ${orgContext.risk_appetite || 'Not specified'}
- Compliance notes: ${orgContext.compliance_notes || 'None'}

Frame every finding in terms of the actual regulatory and business risk to THIS organisation:
- If GDPR regulated: frame data protection gaps as Article 28/32 compliance risks with ICO enforcement exposure
- If FCA regulated: frame relevant gaps as SYSC/DORA obligations
- If NHS/health sector: frame as DSP Toolkit and CQC obligations
- If they hold special category data: elevate severity of any data protection gap
- Calibrate severity against their stated risk appetite — a low risk appetite means Recommended items become more urgent
` : 'No organisation context — assess against general best practice.'

  const prompt = `You are a senior information security assessor with expertise in ISO 27001:2022, NIST CSF 2.0, CIS Controls v8, and Cyber Essentials.
${orgSection}
VENDOR ASSESSED: ${assetName} | Tier ${tier} (${tier === 1 ? 'Critical' : tier === 2 ? 'High' : tier === 3 ? 'Medium' : 'Low'})
Profile: Data sensitivity: ${profile.data_sensitivity} | Network: ${profile.network_access} | Criticality: ${profile.criticality}

RESPONSES:
${qaPairs.map(qa => `[${qa.domain} | ISO:${qa.control_ref}${qa.nist_ref ? ` NIST:${qa.nist_ref}` : ''}${qa.cis_ref ? ` CIS:${qa.cis_ref}` : ''}${qa.ce_ref ? ` CE:${qa.ce_ref}` : ''}]
Q: ${qa.question}
A: ${qa.answer}`).join('\n\n')}

Evaluate rigorously across all four frameworks AND against the organisation's specific regulatory context. The verdict must reflect the combined view — a gap that is merely a best practice issue in isolation may be a compliance breach for this specific organisation.

Respond ONLY with a JSON object, no other text:
{
  "score": <0-100, higher = more risk>,
  "verdict": "<Accept | Accept with conditions | Escalate for further review | Do not proceed>",
  "summary": "<3-4 sentences summarising posture across all frameworks AND what this means specifically for this organisation's regulatory position>",
  "framework_assessment": {
    "iso27001": "<assessment of ISO 27001 posture>",
    "nist_csf": "<assessment of NIST CSF posture>",
    "cis": "<assessment of CIS Controls posture>",
    "cyber_essentials": "<assessment of Cyber Essentials posture>"
  },
  "strengths": [
    {
      "title": "<strength title>",
      "detail": "<explanation including which framework this satisfies>",
      "frameworks": ["<ISO 27001 | NIST CSF | CIS Controls | Cyber Essentials>"]
    }
  ],
  "recommendations": [
    {
      "severity": "<Required | Recommended | Advisory>",
      "title": "<recommendation title>",
      "detail": "<specific actionable recommendation framed in terms of this organisation's regulatory obligations where applicable>",
      "iso_ref": "<ISO 27001:2022 ref>",
      "nist_ref": "<NIST CSF 2.0 ref>",
      "cis_ref": "<CIS Controls v8 ref>",
      "ce_ref": "<Cyber Essentials ref or empty>",
      "regulatory_impact": "<specific regulatory impact for this organisation e.g. 'GDPR Article 32 breach risk' or empty if not applicable>",
      "flagged": <true if answer was evasive/vague/implausible>
    }
  ],
  "flagged_responses": [<0-indexed question numbers>]
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
