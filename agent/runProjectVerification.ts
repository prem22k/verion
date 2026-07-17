import { createContextCapsule } from './core/contextCapsule'
import { diagnoseContextCapsule } from './core/gptDiagnosis'
import { learnProject, recordProjectVerification } from './core/projectMemory'
import type { Evidence, ProjectVerificationResult, ReleaseReport } from './core/types'
import { BrowserObservationProducer } from './evidence/browserObservationProducer'
import { DeepSecurityReviewProducer, enforceCriticalSecurityDecision, securityReviewFailureReport } from './evidence/deepSecurityReviewProducer'
import { RepositoryDiscoveryProducer } from './evidence/repositoryDiscoveryProducer'
import { RepositoryGraphProducer } from './evidence/repositoryGraphProducer'
import { VerificationOrchestrator } from './orchestration/verificationOrchestrator'

export type ProjectVerificationRequest = {
  projectPath: string
  targetUrl?: string
  diagnose?: boolean
  trigger?: 'manual' | 'change' | 'cli'
  recordMemory?: boolean
  onReviewProgress?: (stage: 'reviewing_changes' | 'checking_product' | 'deep_security_review' | 'making_decision') => void | Promise<void>
  onEvidence?: (evidence: Evidence) => void | Promise<void>
}

export async function runProjectVerification(request: ProjectVerificationRequest): Promise<ProjectVerificationResult> {
  await learnProject(request.projectPath)
  const browserObservation = new BrowserObservationProducer()
  const deepSecurityReview = DeepSecurityReviewProducer.fromLocalEnvironment()
  await request.onReviewProgress?.('reviewing_changes')
  const producers = [
    new RepositoryDiscoveryProducer(),
    new RepositoryGraphProducer(),
    browserObservation,
    ...(deepSecurityReview ? [deepSecurityReview] : [])
  ]
  const evidence = await new VerificationOrchestrator(producers).verify(request, async (producer) => {
    if (producer === browserObservation) await request.onReviewProgress?.('checking_product')
    if (producer === deepSecurityReview) await request.onReviewProgress?.('deep_security_review')
  })
  const capsule = await createContextCapsule(evidence)
  let result: ProjectVerificationResult
  await request.onReviewProgress?.('making_decision')
  if (!request.diagnose) {
    result = { evidence, capsule }
  } else {
    try {
      const failureReport = securityReviewFailureReport(evidence)
      if (failureReport) {
        result = { evidence, capsule, report: failureReport }
      } else {
        result = { evidence, capsule, report: enforceCriticalSecurityDecision(await diagnoseContextCapsule(capsule), evidence) }
      }
    } catch (error: unknown) {
      result = {
        evidence,
        capsule,
        report: diagnosisUnavailableReport(evidence, error),
        diagnosisUnavailable: error instanceof Error ? error.message : 'GPT diagnosis could not complete.'
      }
    }
  }
  if (request.recordMemory !== false) await recordProjectVerification(request.projectPath, result, request.trigger ?? 'cli')
  return result
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
