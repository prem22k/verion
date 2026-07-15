import type { Evidence, EvidenceProducer } from '../core/types'

export type VerificationRequest = {
  projectPath: string
  targetUrl?: string
}

export class VerificationOrchestrator {
  constructor(private readonly producers: EvidenceProducer[]) {}

  async verify(request: VerificationRequest): Promise<Evidence[]> {
    const evidence: Evidence[] = []
    for (const producer of this.producers) {
      evidence.push(...await producer.produce({ ...request, evidence }))
    }
    return evidence
  }
}
