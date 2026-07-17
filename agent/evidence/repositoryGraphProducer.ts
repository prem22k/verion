import { buildRepositoryGraph } from '../core/repositoryGraph'
import type { Evidence, EvidenceProducer, EvidenceProductionContext, ProjectDiscovery } from '../core/types'

export class RepositoryGraphProducer implements EvidenceProducer {
  readonly id = 'repository-graph'

  async produce(context: EvidenceProductionContext): Promise<Evidence[]> {
    const discoveryEvidence = context.evidence.find((evidence) => evidence.kind === 'repository_discovery')
    if (!discoveryEvidence) return []
    const discovery = discoveryEvidence.data as ProjectDiscovery
    const graph = await buildRepositoryGraph(discovery)
    const evidence = {
      id: 'repository-graph',
      producer: this.id,
      kind: 'repository_graph',
      capturedAt: new Date().toISOString(),
      summary: `Mapped ${graph.nodes.length} repository nodes and ${graph.edges.length} relationships.`,
      data: graph
    } satisfies Evidence
    await context.onEvidence?.(evidence)
    return [evidence]
  }
}
