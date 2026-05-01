export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { assetName, tier, profile, questions, responses } = req.body

  const qaPairs = questions.map((q, i) => ({
    domain: q.domain,
    question: q.question,
    control_ref: q.control_ref,
    answer: responses[i]?.answer || 'No answer provided',
  }))

  const prompt = `You are a senior information security assessor evaluating a completed vendor risk questionnaire.

Vendor: ${assetName}
Risk Tier: Tier ${tier}
Data sensitivity: ${profile.data_sensitivity}
Network access: ${profile.network_access}
Criticality: ${profile.criticality}

Questionnaire responses:
${qaPairs.map((qa) => `[${qa.domain} — ${qa.control_ref}]
Q: ${qa.question}
A: ${qa.answer}`).join('\n\n')}

Evaluate these responses. Consider adequacy for this risk tier, evasive or vague answers, and overall security posture.

Respond ONLY with a JSON object, no other text:
{
  "score": <0-100, higher = more risk>,
  "verdict": "<Accept | Accept with conditions | Escalate for further review | Do not proceed>",
  "summary": "<3-4 sentence plain English summary>",
  "findings": [
    {
      "severity": "<Required | Recommended | Advisory>",
      "domain": "<domain>",
      "text": "<specific finding>",
      "control_ref": "<ISO 27001 reference>",
      "flagged": <true if evasive/vague>
    }
  ],
  "strengths": ["<strength>"],
  "flagged_responses": [<0-indexed question numbers with evasive answers>]
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
        max_tokens: 2000,
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
