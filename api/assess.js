export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { assetName, tier, responses } = req.body

  if (!assetName || !tier || !responses) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const prompt = `You are a senior information security assessor reviewing a vendor security questionnaire.

Asset: ${assetName}
Risk Tier: Tier ${tier} (${tier === 1 ? 'Critical' : tier === 2 ? 'High' : tier === 3 ? 'Medium' : 'Low'})

Vendor responses:
${responses.map((r, i) => `Q${i + 1}: ${r.question}\nA: ${r.answer}`).join('\n\n')}

Produce a structured security assessment. Respond ONLY with a JSON object in this exact format, no other text:
{
  "score": <number 0-100, lower is better/safer>,
  "verdict": "<one of: Accept | Accept with conditions | Escalate for further review | Do not proceed>",
  "summary": "<2-3 sentence plain English summary of the vendor's security posture>",
  "findings": [
    {
      "severity": "<Required | Recommended | Advisory>",
      "text": "<specific finding>",
      "control": "<ISO 27001 control reference if applicable, or empty string>"
    }
  ],
  "strengths": ["<strength 1>", "<strength 2>"]
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(500).json({ error: data.error?.message || 'Anthropic API error' })
    }

    const text = data.content[0].text
    const clean = text.replace(/```json|```/g, '').trim()
    const assessment = JSON.parse(clean)

    return res.status(200).json(assessment)
  } catch (err) {
    console.error('Assessment error:', err)
    return res.status(500).json({ error: 'Failed to generate assessment' })
  }
}
