import { createContextCapsule } from './core/contextCapsule'
import { diagnoseContextCapsule } from './core/gptDiagnosis'
import { learnProject, recordProjectVerification } from './core/projectMemory'
import type { Evidence, ProjectVerificationResult } from './core/types'
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
      diagnosisUnavailable: error instanceof Error ? error.message : 'GPT diagnosis could not complete.'
      }
    }
  }
  if (request.recordMemory !== false) await recordProjectVerification(request.projectPath, result, request.trigger ?? 'cli')
  return result
}
