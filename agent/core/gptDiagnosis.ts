import type { ContextCapsule, Evidence, ReleaseConfidence, ReleaseReport } from './types'
import { executeStructuredAI } from './runtimeConfig'

const diagnosisSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    recommendation: {
      type: 'string',
      enum: ['ready_to_ship', 'needs_attention', 'inconclusive']
    },
    confidence: {
      type: 'string',
      enum: ['high', 'moderate', 'limited']
    },
    headline: { type: 'string' },
    rootCause: { type: 'string' },
    reasons: {
      type: 'array',
      maxItems: 3,
      items: { type: 'string' }
    },
    evidenceIds: {
      type: 'array',
      items: { type: 'string' }
    },
    nextAction: { type: 'string' }
  },
  required: ['recommendation', 'confidence', 'headline', 'rootCause', 'reasons', 'evidenceIds', 'nextAction']
}

export async function diagnoseContextCapsule(capsule: ContextCapsule, projectRoot: string): Promise<ReleaseReport> {
  const result = await executeStructuredAI<unknown>(projectRoot, {
    task: 'release_reasoning',
    instructions: [
      'You are Verion, a careful release reviewer for AI-built software.',
      'Diagnose only from the supplied Context Capsule. Do not claim that a behavior, root cause, or fix is proven unless the capsule supports it.',
      'Return exactly one concise release recommendation, one likely root cause, and no more than three distinct short reasons grounded in the supplied material.',
      'Prefer an inconclusive recommendation with limited confidence whenever the supplied material cannot support a release call or root-cause claim.',
      'Use high confidence only when the supplied material directly supports the recommendation. For ready_to_ship, state the narrow observed basis for no current release blocker instead of inventing a problem.',
      'Cite one or more Evidence IDs from the capsule. Do not mention tools or request tool access.'
    ].join(' '),
    input: { contextCapsule: capsule },
    schemaName: 'verion_release_report',
    schema: diagnosisSchema
  })

  const report = parseReleaseReport(result.value)
  const knownEvidence = new Set(capsule.evidence.map((item) => item.id))
  if (!report.evidenceIds.every((id) => knownEvidence.has(id))) {
    throw new Error('AI release reasoning cited material outside the Context Capsule.')
  }
  return report
}

/**
 * A model can improve correlation and explanation, but it must not be the only
 * path to a useful release decision. This report is deliberately conservative:
 * it only reacts to direct local observations and never claims a root cause
 * beyond them.
 */
export function deterministicReleaseReport(evidence: Evidence[]): ReleaseReport {
  const evidenceIds = evidence.map((item) => item.id)
  const securityFindings = evidence.filter((item) => item.kind === 'security_finding')
  const productFailures = evidence.filter((item) => item.kind === 'console_log' || item.kind === 'network_log' || (item.kind === 'browser_exploration' && record(item.data).status === 'failed'))
  const failedSecurity = evidence.some((item) => item.kind === 'security_review' && record(item.data).status === 'failed')
  const reviewedJourneys = evidence.filter((item) => item.kind === 'browser_exploration' && record(item.data).status !== 'failed')
  const discovery = evidence.find((item) => item.kind === 'repository_discovery')
  const review = evidence.find((item) => item.kind === 'security_review')

  if (failedSecurity) {
    return {
      recommendation: 'inconclusive', confidence: 'limited', headline: 'Review incomplete',
      rootCause: 'Deep Security Review could not complete its local review.',
      reasons: ['A required local review did not complete, so Verion will not make a complete release call.'],
      evidenceIds: [review?.id ?? evidenceIds[0]].filter(Boolean),
      nextAction: 'Try Deep Security Review again after resolving the local review error.'
    }
  }
  if (securityFindings.length > 0) {
    const first = securityFindings[0]
    return {
      recommendation: 'needs_attention', confidence: 'high', headline: 'Needs attention',
      rootCause: first.summary,
      reasons: uniqueReasons(securityFindings.slice(0, 3).map((item) => item.summary)),
      evidenceIds: securityFindings.slice(0, 3).map((item) => item.id),
      nextAction: 'Resolve the security concern, review the diff, then verify this change again.'
    }
  }
  if (productFailures.length > 0) {
    const first = productFailures[0]
    return {
      recommendation: 'needs_attention', confidence: 'high', headline: 'Needs attention',
      rootCause: first.summary,
      reasons: uniqueReasons(productFailures.slice(0, 3).map((item) => item.summary)),
      evidenceIds: productFailures.slice(0, 3).map((item) => item.id),
      nextAction: 'Resolve the observed product failure, then verify this change again.'
    }
  }
  if (!discovery || !review) {
    return {
      recommendation: 'inconclusive', confidence: 'limited', headline: 'Review incomplete',
      rootCause: 'Verion did not collect enough local review material to make a release decision.',
      reasons: ['Project discovery and a local security review are both required for a deterministic decision.'],
      evidenceIds: evidenceIds.slice(0, 3),
      nextAction: 'Verify this change again after Verion can access the local project.'
    }
  }
  const browserReason = reviewedJourneys.length > 0
    ? `Reviewed ${reviewedJourneys.length === 1 ? 'the discovered product path' : `${reviewedJourneys.length} discovered product paths`} without a direct failure signal.`
    : 'No running local app was available, so this decision is based on repository and local security review only.'
  return {
    recommendation: 'ready_to_ship',
    confidence: reviewedJourneys.length > 0 ? 'moderate' : 'limited',
    headline: 'Ready to ship',
    rootCause: 'The completed local review did not identify a critical, high, or direct product failure.',
    reasons: uniqueReasons([discovery.summary, review.summary, browserReason]),
    evidenceIds: [discovery.id, review.id, ...reviewedJourneys.slice(0, 1).map((item) => item.id)],
    nextAction: reviewedJourneys.length > 0 ? 'Review the changed diff, then ship when the change is ready.' : 'For stronger confidence, run the local app and verify this change again before shipping.'
  }
}

function parseReleaseReport(output: unknown): ReleaseReport {
  const value = output
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('AI release reasoning returned an invalid structured result.')
  const report = value as Record<string, unknown>
  if (!isRecommendation(report.recommendation) || !isConfidence(report.confidence) || !isNonEmptyString(report.headline) || !isNonEmptyString(report.rootCause) || !isReasons(report.reasons) || !isNonEmptyString(report.nextAction) || !isEvidenceIds(report.evidenceIds)) {
    throw new Error('AI release reasoning returned an invalid structured report.')
  }
  return {
    recommendation: report.recommendation,
    confidence: report.confidence,
    headline: report.headline,
    rootCause: report.rootCause,
    reasons: report.reasons,
    evidenceIds: report.evidenceIds,
    nextAction: report.nextAction
  }
}

function isRecommendation(value: unknown): value is ReleaseReport['recommendation'] {
  return value === 'ready_to_ship' || value === 'needs_attention' || value === 'inconclusive'
}

function isConfidence(value: unknown): value is ReleaseConfidence {
  return value === 'high' || value === 'moderate' || value === 'limited'
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isEvidenceIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString) && new Set(value).size === value.length
}

function isReasons(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length > 3 || !value.every(isNonEmptyString)) return false
  const normalized = value.map((reason) => reason.trim().toLowerCase())
  return new Set(normalized).size === normalized.length
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function uniqueReasons(reasons: string[]): string[] {
  const seen = new Set<string>()
  return reasons.filter((reason) => {
    const key = reason.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 3)
}
