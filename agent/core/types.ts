export type ProjectFramework = 'nextjs' | 'vite' | 'react' | 'unknown'

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown'

export type ProjectRoute = {
  path: string
  file: string
  convention: 'next-app-router' | 'next-pages-router' | 'route-candidate'
}

export type ProjectDiscovery = {
  projectRoot: string
  framework: ProjectFramework
  packageManager: PackageManager
  packageName?: string
  scripts: Record<string, string>
  entryPoints: string[]
  routes: ProjectRoute[]
  files: string[]
  ignoredFileCount: number
}

export type RepositoryGraphNode = {
  id: string
  kind: 'file' | 'entry-point' | 'route'
  path: string
}

export type RepositoryGraphEdge = {
  from: string
  to: string
  kind: 'imports' | 'owns-route' | 'is-entry-point'
}

export type RepositoryGraph = {
  nodes: RepositoryGraphNode[]
  edges: RepositoryGraphEdge[]
}

export type ProjectAnalysis = {
  discovery: ProjectDiscovery
  graph: RepositoryGraph
}

export type EvidenceKind =
  | 'repository_discovery'
  | 'repository_graph'
  | 'browser_exploration'
  | 'console_log'
  | 'network_log'
  | 'screenshot'
  | 'security_finding'
  | 'performance_finding'
  | 'accessibility_finding'

export type EvidenceLocation = {
  file?: string
  line?: number
  url?: string
  route?: string
}

export type Evidence = {
  id: string
  producer: string
  kind: EvidenceKind
  capturedAt: string
  summary: string
  location?: EvidenceLocation
  data: unknown
}

export type EvidenceProductionContext = {
  projectPath: string
  targetUrl?: string
  evidence: Evidence[]
}

export interface EvidenceProducer {
  readonly id: string
  produce(context: EvidenceProductionContext): Promise<Evidence[]>
}

export type ContextCapsule = {
  evidence: Evidence[]
  project?: Pick<ProjectDiscovery, 'framework' | 'packageManager' | 'entryPoints'>
  relevantFiles: Array<{ path: string; reason: string; excerpt: string }>
  reproductionContext: string[]
}
