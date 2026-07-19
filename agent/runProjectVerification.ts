import { createContextCapsule } from './core/contextCapsule'
import { deterministicReleaseReport, diagnoseContextCapsule } from './core/gptDiagnosis'
import { learnProject, recordProjectVerification } from './core/projectMemory'
import { enforceSecurityReleaseDecision } from './core/securityFindings'
import type { Evidence, ProjectVerificationResult, ReleaseReport, SecurityReviewProgress } from './core/types'
import { BrowserObservationProducer } from './evidence/browserObservationProducer'
import { LocalDeepSecurityReviewProducer } from './evidence/localDeepSecurityReviewProducer'
import { RepositoryDiscoveryProducer } from './evidence/repositoryDiscoveryProducer'
import { RepositoryGraphProducer } from './evidence/repositoryGraphProducer'
import { VerificationOrchestrator } from './orchestration/verificationOrchestrator'

export type ProjectVerificationRequest = {
  projectPath: string
  targetUrl?: string
  diagnose?: boolean
  trigger?: 'manual' | 'change' | 'cli'
  recordMemory?: boolean
  onReviewProgress?: (stage: 'reviewing_changes' | 'checking_product' | 'making_decision') => void | Promise<void>
  onEvidence?: (evidence: Evidence) => void | Promise<void>
}

export async function runProjectVerification(request: ProjectVerificationRequest): Promise<ProjectVerificationResult> {
  await learnProject(request.projectPath)
  const browserObservation = new BrowserObservationProducer()
  await request.onReviewProgress?.('reviewing_changes')
  const producers = [
    new RepositoryDiscoveryProducer(),
    new RepositoryGraphProducer(),
    browserObservation
  ]
  const evidence = await new VerificationOrchestrator(producers).verify(request, async (producer) => {
    if (producer === browserObservation) await request.onReviewProgress?.('checking_product')
  })
  const capsule = await createContextCapsule(evidence)
  let result: ProjectVerificationResult
  await request.onReviewProgress?.('making_decision')
  if (!request.diagnose) {
    result = { evidence, capsule }
  } else {
    let report: ReleaseReport
    let diagnosisUnavailable: string | undefined
    try {
      report = await diagnoseContextCapsule(capsule, request.projectPath)
    } catch (error: unknown) {
      report = deterministicReleaseReport(evidence)
      diagnosisUnavailable = error instanceof Error ? error.message : 'AI release reasoning could not complete.'
    }
    // Critical evidence is deterministic and must never be hidden behind an
    // unavailable model or a failed release-reasoning request.
    result = { evidence, capsule, report: enforceSecurityReleaseDecision(report, evidence), ...(diagnosisUnavailable ? { diagnosisUnavailable } : {}) }
  }
  if (request.recordMemory !== false) await recordProjectVerification(request.projectPath, result, request.trigger ?? 'cli')
  return result
}

export type ProjectSecurityReviewRequest = {
  projectPath: string
  targetUrl?: string
  trigger?: 'manual' | 'change' | 'cli'
  recordMemory?: boolean
  onProgress?: (progress: SecurityReviewProgress) => void | Promise<void>
  onEvidence?: (evidence: Evidence) => void | Promise<void>
}

/**
 * Deep Security Review is deliberately separate from ordinary verification.
 * It only runs after a developer starts it from Security, while its saved
 * findings still influence the same release decision and repair workflows.
 */
export async function runDeepSecurityReview(request: ProjectSecurityReviewRequest): Promise<ProjectVerificationResult> {
  await learnProject(request.projectPath)
  const review = new LocalDeepSecurityReviewProducer()
  const evidence = await new VerificationOrchestrator([review, new RepositoryDiscoveryProducer(), new RepositoryGraphProducer()]).verify({
    projectPath: request.projectPath,
    targetUrl: request.targetUrl,
    onEvidence: request.onEvidence,
    onSecurityProgress: request.onProgress
  })
  const capsule = await createContextCapsule(evidence)
  const securityStatus = evidence.find((item) => item.kind === 'security_review' && item.producer === 'deep-security-review')?.data
  const securityReviewIsPartial = typeof securityStatus === 'object' && securityStatus !== null && (securityStatus as { status?: unknown }).status === 'partial'
  const report = securityReviewIsPartial
    ? incompleteSecurityReport(evidence)
    : enforceSecurityReleaseDecision(deterministicReleaseReport(evidence), evidence)
  const result: ProjectVerificationResult = { evidence, capsule, report }
  if (request.recordMemory !== false) await recordProjectVerification(request.projectPath, result, request.trigger ?? 'manual')
  if (typeof securityStatus === 'object' && securityStatus !== null && (securityStatus as { status?: unknown }).status !== 'failed') {
    await request.onProgress?.({
      station: 'decision',
      state: securityReviewIsPartial ? 'skipped' : 'completed',
      detail: securityReviewIsPartial
        ? 'The available checks finished, but the release decision stays incomplete until every specialist check is available.'
        : report.recommendation === 'needs_attention'
        ? 'A security concern now contributes to this release decision.'
        : 'No critical or high concern changed this release decision.'
    })
  }
  return result
}

function incompleteSecurityReport(evidence: Evidence[]): ReleaseReport {
  return {
    recommendation: 'inconclusive',
    confidence: 'limited',
    headline: 'Security review incomplete',
    rootCause: 'Verion could not run every specialist local security check required for a complete Deep Security Review.',
    reasons: ['Available local checks were completed, but unavailable checks are not treated as a pass.', 'Install or prepare the missing local review capability, then run Deep Security Review again.'],
    evidenceIds: evidence.filter((item) => item.kind === 'security_review' || item.kind === 'security_finding').map((item) => item.id).slice(0, 12),
    nextAction: 'Retry Deep Security Review once the local review engines are available.'
  }
}

function diagnosisUnavailableReport(evidence: Evidence[], error: unknown): ReleaseReport {
  const reason = diagnosisFailureReason(error)
  return {
    recommendation: 'inconclusive',
    confidence: 'limited',
    headline: 'Inconclusive',
    rootCause: 'Verion could not complete its release reasoning.',
    reasons: [reason],
    evidenceIds: evidence.slice(0, 3).map((item) => item.id),
    nextAction: diagnosisFailureNextAction(error)
  }
}

function diagnosisFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('rate-limit')) return 'The release model is temporarily busy. Verion finished the review but cannot make a reliable call yet.'
  if (message.includes('api key') || message.includes('model access') || message.includes('rejected')) {
    return 'The configured release model did not accept this review, so Verion will not guess at a release decision.'
  }
  if (message.includes('timed out') || message.includes('could not reach')) {
    return 'Verion could not reach the configured release model before this review timed out.'
  }
  return 'The project review finished, but Verion could not turn the observations into a reliable release call.'
}

function diagnosisFailureNextAction(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('rate-limit')) return 'Try Verify again in a moment.'
  if (message.includes('api key') || message.includes('model access') || message.includes('rejected')) {
    return 'Check the local release-model settings, restart Verion, then verify again.'
  }
  return 'Check that Verion is ready to make a release decision, then verify again.'
}
