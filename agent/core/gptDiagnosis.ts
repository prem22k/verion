import type { ContextCapsule, ReleaseReport } from './types'
import { getGptDiagnosisConfig } from './runtimeConfig'

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
  const { apiKey, model } = getGptDiagnosisConfig()

  let response: Response
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 1_000,
        input: [
          {
            role: 'system',
            content: [
              'You are Verion, a careful release reviewer for AI-built software.',
              'Diagnose only from the supplied Context Capsule. Do not claim that a behavior, root cause, or fix is proven unless the capsule supports it.',
              'Return one concise release recommendation. Prefer inconclusive when the evidence is insufficient.',
              'Cite one or more Evidence IDs from the capsule. Do not mention tools or request tool access.'
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
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new Error('GPT diagnosis timed out after 45 seconds. Evidence collection completed; retry the diagnosis.')
    }
    throw new Error('GPT diagnosis could not reach OpenAI. Check your network connection and retry.')
  }

  if (!response.ok) {
    throw new Error(await describeOpenAiFailure(response))
  }

  const result = await response.json() as { output_text?: unknown }
  if (!result.output_text) throw new Error('GPT diagnosis returned no structured output.')

  const report = parseReleaseReport(result.output_text)
  const knownEvidence = new Set(capsule.evidence.map((item) => item.id))
  if (!report.evidenceIds.every((id) => knownEvidence.has(id))) {
    throw new Error('GPT diagnosis cited evidence outside the Context Capsule.')
  }
  return report
}

async function describeOpenAiFailure(response: Response): Promise<string> {
  if (response.status === 401 || response.status === 403) {
    return 'OpenAI rejected the configured API key or model access. Check OPENAI_API_KEY and VERION_OPENAI_MODEL, then restart the local agent.'
  }
  if (response.status === 429) return 'OpenAI rate-limited the diagnosis. Evidence collection completed; retry shortly.'
  if (response.status >= 500) return 'OpenAI is temporarily unavailable. Evidence collection completed; retry the diagnosis.'
  const detail = await readSafeOpenAiError(response)
  return detail
    ? `OpenAI rejected the diagnosis request (${response.status}): ${detail}`
    : `OpenAI rejected the diagnosis request (${response.status}). Check VERION_OPENAI_MODEL and retry.`
}

async function readSafeOpenAiError(response: Response): Promise<string | undefined> {
  try {
    const value = await response.json() as unknown
    if (!value || typeof value !== 'object' || !('error' in value)) return undefined
    const error = value.error
    if (!error || typeof error !== 'object' || !('message' in error) || typeof error.message !== 'string') return undefined
    return error.message
      .replace(/sk-[A-Za-z0-9_-]+/g, '[REDACTED]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300)
  } catch {
    return undefined
  }
}

function parseReleaseReport(output: unknown): ReleaseReport {
  if (typeof output !== 'string') throw new Error('GPT diagnosis returned an invalid structured output.')
  let value: unknown
  try {
    value = JSON.parse(output)
  } catch {
    throw new Error('GPT diagnosis returned malformed structured output.')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('GPT diagnosis returned an invalid structured output.')
  const report = value as Record<string, unknown>
  if (!isRecommendation(report.recommendation) || !isNonEmptyString(report.headline) || !isNonEmptyString(report.diagnosis) || !isNonEmptyString(report.nextAction) || !isEvidenceIds(report.evidenceIds)) {
    throw new Error('GPT diagnosis returned an invalid structured report.')
  }
  return {
    recommendation: report.recommendation,
    headline: report.headline,
    diagnosis: report.diagnosis,
    evidenceIds: report.evidenceIds,
    nextAction: report.nextAction
  }
}

function isRecommendation(value: unknown): value is ReleaseReport['recommendation'] {
  return value === 'ready_to_ship' || value === 'needs_attention' || value === 'inconclusive'
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isEvidenceIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString) && new Set(value).size === value.length
}
