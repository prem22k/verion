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

export type ProjectTechnology = {
  id: string
  label: string
  kind: 'framework' | 'library' | 'service' | 'database'
}

export type ProjectUnderstanding = {
  summary: string
  technologies: ProjectTechnology[]
  productAreas: string[]
  routeCount: number
  apiCount: number
}

export type ProjectProfile = {
  name: string
  projectRoot: string
  framework: ProjectFramework
  packageManager: PackageManager
  firstLearnedAt: string
  lastLearnedAt: string
  lastVerifiedAt?: string
}

export type KnownUserJourney = {
  id: string
  label: string
  route?: string
  source: 'project' | 'browser'
  firstObservedAt: string
  lastObservedAt: string
  interactiveElementCount?: number
}

export type ProjectFileSnapshot = Record<string, { size: number; modifiedAt: number }>

export type RecentProjectChange = {
  detectedAt: string
  added: string[]
  modified: string[]
  removed: string[]
}

export type VerificationHistoryEntry = {
  id: string
  completedAt: string
  trigger: 'manual' | 'change' | 'cli'
  recommendation: ReleaseRecommendation
  evidenceCounts: Partial<Record<EvidenceKind, number>>
  diagnosisUnavailable?: string
}

export type StoredReleaseReport = ReleaseReport & {
  id: string
  completedAt: string
}

export type KnownIssue = {
  id: string
  headline: string
  diagnosis: string
  firstSeenAt: string
  lastSeenAt: string
  occurrences: number
  status: 'open' | 'resolved'
  lastReportId: string
}

export type ProjectMemory = {
  version: 2
  profile: ProjectProfile
  createdAt: string
  updatedAt: string
  onboardingCompletedAt?: string
  signature: string
  discovery: ProjectDiscovery
  graph: RepositoryGraph
  understanding: ProjectUnderstanding
  knownTechnologies: ProjectTechnology[]
  knownRoutes: ProjectRoute[]
  knownUserJourneys: KnownUserJourney[]
  verificationHistory: VerificationHistoryEntry[]
  releaseReports: StoredReleaseReport[]
  knownIssues: KnownIssue[]
  recentChanges: RecentProjectChange[]
  fileSnapshot: ProjectFileSnapshot
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

export type ReleaseRecommendation = 'ready_to_ship' | 'needs_attention' | 'inconclusive'

export type ReleaseReport = {
  recommendation: ReleaseRecommendation
  headline: string
  diagnosis: string
  evidenceIds: string[]
  nextAction: string
}

export type ProjectVerificationResult = {
  evidence: Evidence[]
  capsule: ContextCapsule
  report?: ReleaseReport
  diagnosisUnavailable?: string
}
