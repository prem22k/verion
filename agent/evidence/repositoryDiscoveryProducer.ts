import { discoverProject } from '../core/projectDiscovery'
import type { Evidence, EvidenceProducer, EvidenceProductionContext } from '../core/types'

export class RepositoryDiscoveryProducer implements EvidenceProducer {
  readonly id = 'repository-discovery'

  async produce(context: EvidenceProductionContext): Promise<Evidence[]> {
    const discovery = await discoverProject(context.projectPath)
    const evidence = {
      id: 'repository-discovery',
      producer: this.id,
      kind: 'repository_discovery',
      capturedAt: new Date().toISOString(),
      summary: `Discovered a ${discovery.framework} project with ${discovery.files.length} project files.`,
      data: discovery
    } satisfies Evidence
    await context.onEvidence?.(evidence)
    return [evidence]
  }
}
