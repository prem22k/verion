import { createContextCapsule } from './core/contextCapsule'
import { diagnoseContextCapsule } from './core/gptDiagnosis'
import type { ProjectVerificationResult } from './core/types'
import { BrowserObservationProducer } from './evidence/browserObservationProducer'
import { RepositoryDiscoveryProducer } from './evidence/repositoryDiscoveryProducer'
import { RepositoryGraphProducer } from './evidence/repositoryGraphProducer'
import { VerificationOrchestrator } from './orchestration/verificationOrchestrator'

export type ProjectVerificationRequest = {
  projectPath: string
  targetUrl?: string
  diagnose?: boolean
}

export async function runProjectVerification(request: ProjectVerificationRequest): Promise<ProjectVerificationResult> {
  const evidence = await new VerificationOrchestrator([
    new RepositoryDiscoveryProducer(),
    new RepositoryGraphProducer(),
    new BrowserObservationProducer()
  ]).verify(request)
  const capsule = await createContextCapsule(evidence)
  if (!request.diagnose) return { evidence, capsule }

  try {
    return { evidence, capsule, report: await diagnoseContextCapsule(capsule) }
  } catch (error: unknown) {
    return {
      evidence,
      capsule,
      diagnosisUnavailable: error instanceof Error ? error.message : 'GPT diagnosis could not complete.'
    }
  }
}
