import type { Evidence, EvidenceProducer, SecurityReviewProgress } from '../core/types'

export type VerificationRequest = {
  projectPath: string
  targetUrl?: string
  onEvidence?: (evidence: Evidence) => void | Promise<void>
  onSecurityProgress?: (progress: SecurityReviewProgress) => void | Promise<void>
}

export class VerificationOrchestrator {
  constructor(private readonly producers: EvidenceProducer[]) {}

  async verify(request: VerificationRequest, beforeProducer?: (producer: EvidenceProducer) => void | Promise<void>): Promise<Evidence[]> {
    const evidence: Evidence[] = []
    for (const producer of this.producers) {
      await beforeProducer?.(producer)
      evidence.push(...await producer.produce({ ...request, evidence }))
    }
    return evidence
  }
}
