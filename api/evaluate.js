export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { assetName, tier, profile, questions, responses, orgContext } = req.body

  const qaPairs = questions.map((q, i) => ({
    domain: q.domain,
    question: q.question,
    control_ref: q.control_ref || '',
    nist_ref: q.nist_ref || '',
    cis_ref: q.cis_ref || '',
    ce_ref: q.ce_ref || '',
    answer: responses[i]?.answer || 'No answer provided',
  }))

  const orgSection = orgContext ? `
ORGANISATION CONTEXT — frame all findings against this:
- Company: ${orgContext.company_name || 'Not specified'} | Industry: ${orgContext.industry || 'Not specified'}
- Regulatory frameworks: ${orgContext.regulatory_frameworks?.join(', ') || 'Not specified'}
- Data held: ${orgContext.data_types?.join(', ') || 'Not specified'} | Special category: ${orgContext.special_category_data ? 'YES' : 'No'}
- Data subjects: ${orgContext.data_subject_count || 'Not specified'}
- Own certifications: ${orgContext.existing_certifications?.join(', ') || 'None'}
- Risk appetite: ${orgContext.risk_appetite || 'Not specified'}
- Compliance notes: ${orgContext.compliance_notes || 'None'}

Frame every finding as a specific regulatory/business risk to THIS organisation. Calibrate severity against their risk appetite.
` : 'No organisation context — assess against general best practice.'

  const prompt = `You are a senior information security assessor. Evaluate this completed vendor questionnaire.
${orgSection}
VENDOR: ${assetName} | Tier ${tier} | Data: ${profile.data_sensitivity} | Network: ${profile.network_access}

RESPONSES:
${qaPairs.map(qa => `[${qa.domain} | ISO:${qa.control_ref}${qa.nist_ref ? ` NIST:${qa.nist_ref}` : ''}${qa.cis_ref ? ` CIS:${qa.cis_ref}` : ''}]
Q: ${qa.question}
A: ${qa.answer}`).join('\n\n')}

Evaluate across ISO 27001:2022, NIST CSF 2.0, CIS Controls v8, and Cyber Essentials. Flag evasive or vague answers.

Respond ONLY with JSON (no markdown):
{
  "score": <0-100, higher = more risk>,
  "verdict": "<Accept | Accept with conditions | Escalate for further review | Do not proceed>",
  "summary": "<3-4 sentences covering posture and regulatory position>",
  "framework_assessment": {
    "iso27001": "<1-2 sentences>",
    "nist_csf": "<1-2 sentences>",
    "cis": "<1-2 sentences>",
    "cyber_essentials": "<1-2 sentences>"
  },
  "strengths": [
    { "title": "<title>", "detail": "<explanation>", "frameworks": ["<framework>"] }
  ],
  "recommendations": [
    {
      "severity": "<Required | Recommended | Advisory>",
      "title": "<title>",
      "detail": "<specific actionable recommendation>",
      "iso_ref": "<ref>", "nist_ref": "<ref>", "cis_ref": "<ref>", "ce_ref": "<ref or empty>",
      "regulatory_impact": "<specific regulatory impact or empty>",
      "flagged": <true if answer was evasive/vague>
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

    const text = data.content[0].text.replace(/```json|```/g, '').trim()
    let evaluation
    try {
      evaluation = JSON.parse(text)
    } catch {
      const lastBrace = text.lastIndexOf('}')
      try { evaluation = JSON.parse(text.substring(0, lastBrace + 1)) }
      catch { return res.status(500).json({ error: 'Evaluation produced malformed output. Please try again.' }) }
    }

    evaluation.findings = evaluation.recommendations?.map(r => ({
      severity: r.severity?.toLowerCase() === 'required' ? 'red' : r.severity?.toLowerCase() === 'recommended' ? 'amber' : 'gray',
      text: r.detail, label: r.severity, flagged: r.flagged,
    })) || []

    return res.status(200).json(evaluation)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
