import { createContextCapsule } from './core/contextCapsule'
import { diagnoseContextCapsule } from './core/gptDiagnosis'
import { learnProject, recordProjectVerification } from './core/projectMemory'
import type { ProjectVerificationResult } from './core/types'
import { BrowserObservationProducer } from './evidence/browserObservationProducer'
import { RepositoryDiscoveryProducer } from './evidence/repositoryDiscoveryProducer'
import { RepositoryGraphProducer } from './evidence/repositoryGraphProducer'
import { VerificationOrchestrator } from './orchestration/verificationOrchestrator'

export type ProjectVerificationRequest = {
  projectPath: string
  targetUrl?: string
  diagnose?: boolean
  trigger?: 'manual' | 'change' | 'cli'
  recordMemory?: boolean
}

export async function runProjectVerification(request: ProjectVerificationRequest): Promise<ProjectVerificationResult> {
  await learnProject(request.projectPath)
  const evidence = await new VerificationOrchestrator([
    new RepositoryDiscoveryProducer(),
    new RepositoryGraphProducer(),
    new BrowserObservationProducer()
  ]).verify(request)
  const capsule = await createContextCapsule(evidence)
  let result: ProjectVerificationResult
  if (!request.diagnose) {
    result = { evidence, capsule }
  } else {
    try {
      result = { evidence, capsule, report: await diagnoseContextCapsule(capsule) }
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
