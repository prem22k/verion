import type { ContextCapsule, ReleaseReport } from './types'

const diagnosisSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    recommendation: {
      type: 'string',
      enum: ['ready_to_ship', 'needs_attention', 'inconclusive']
    },
    headline: { type: 'string' },
    diagnosis: { type: 'string' },
    evidenceIds: {
      type: 'array',
      items: { type: 'string' }
    },
    nextAction: { type: 'string' }
  },
  required: ['recommendation', 'headline', 'diagnosis', 'evidenceIds', 'nextAction']
}

export async function diagnoseContextCapsule(capsule: ContextCapsule): Promise<ReleaseReport> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('GPT diagnosis requires OPENAI_API_KEY. Evidence and Context Capsule collection completed without a diagnosis.')
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.VERION_OPENAI_MODEL ?? 'gpt-5.6',
      input: [
        {
          role: 'system',
          content: [
            'You are Verion, a careful release reviewer for AI-built software.',
            'Diagnose only from the supplied Context Capsule. Do not claim that a behavior, root cause, or fix is proven unless the capsule supports it.',
            'Return one concise release recommendation. Prefer inconclusive when the evidence is insufficient.',
            'Use only Evidence IDs that appear in the capsule. Do not mention tools or request tool access.'
          ].join(' ')
        },
        {
          role: 'user',
          content: JSON.stringify({ contextCapsule: capsule })
        }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'verion_release_report',
          strict: true,
          schema: diagnosisSchema
        }
      }
    })
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`GPT diagnosis failed (${response.status}): ${detail}`)
  }

  const result = await response.json() as { output_text?: string }
  if (!result.output_text) throw new Error('GPT diagnosis returned no structured output.')

  const report = JSON.parse(result.output_text) as ReleaseReport
  const knownEvidence = new Set(capsule.evidence.map((item) => item.id))
  if (!report.evidenceIds.every((id) => knownEvidence.has(id))) {
    throw new Error('GPT diagnosis cited evidence outside the Context Capsule.')
  }
  return report
}
