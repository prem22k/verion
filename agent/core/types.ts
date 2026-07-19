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

export type ProjectUnderstandingItem = {
  id: string
  label: string
}

export type ProjectModelUnderstanding = {
  thesis: string
  keyEntities: ProjectUnderstandingItem[]
  priorityJourneys: Array<ProjectUnderstandingItem & { reason: string }>
  reviewFocus: string
  updatedAt: string
}

export type ProjectUnderstanding = {
  summary: string
  technologies: ProjectTechnology[]
  productAreas: string[]
  routeCount: number
  apiCount: number
  applicationType?: string
  authentication?: string
  payments?: string
  database?: string
  framework?: string
  userJourneys: ProjectUnderstandingItem[]
  criticalBusinessFlows: ProjectUnderstandingItem[]
  importantPages: ProjectUnderstandingItem[]
  importantApis: ProjectUnderstandingItem[]
  model?: ProjectModelUnderstanding
  modelAttemptedAt?: string
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

export type ProjectFileSnapshot = Record<string, { size: number; modifiedAt: number; digest?: string }>

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
  rootCause: string
  firstSeenAt: string
  lastSeenAt: string
  occurrences: number
  status: 'open' | 'resolved'
  lastReportId: string
}

export type ProjectMemory = {
  version: 5
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
  securityFindings: SecurityFinding[]
  securityReview?: SecurityReviewState
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
  | 'security_review'
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
  onEvidence?: (evidence: Evidence) => void | Promise<void>
  onSecurityProgress?: (progress: SecurityReviewProgress) => void | Promise<void>
}

export interface EvidenceProducer {
  readonly id: string
  produce(context: EvidenceProductionContext): Promise<Evidence[]>
}

export type SecurityReviewStationId = 'scope' | 'code' | 'credentials' | 'dependencies' | 'configuration' | 'running_experience' | 'decision'

export type SecurityReviewProgress = {
  station: SecurityReviewStationId
  state: 'started' | 'completed' | 'skipped' | 'failed'
  detail: string
}

export type ContextCapsule = {
  evidence: Evidence[]
  project?: Pick<ProjectDiscovery, 'framework' | 'packageManager' | 'entryPoints'>
  relevantFiles: Array<{ path: string; reason: string; excerpt: string }>
  reproductionContext: string[]
}

export type ReleaseRecommendation = 'ready_to_ship' | 'needs_attention' | 'inconclusive'

export type ReleaseConfidence = 'high' | 'moderate' | 'limited'

export type ReleaseReport = {
  recommendation: ReleaseRecommendation
  confidence: ReleaseConfidence
  headline: string
  rootCause: string
  reasons: string[]
  evidenceIds: string[]
  nextAction: string
}

export type ProjectVerificationResult = {
  evidence: Evidence[]
  capsule: ContextCapsule
  report?: ReleaseReport
  diagnosisUnavailable?: string
}

/**
 * Phase 0 AI contracts deliberately contain provider references, never provider
 * secrets. Credentials are resolved by the local runtime in a later phase.
 */
export type AIProviderKind = 'verion_ai' | 'openai_compatible' | 'gemini' | 'openrouter' | 'ollama'

export type AICredentialSource = 'verion_proxy' | 'environment' | 'os_keychain' | 'none'

export type AIProviderConfig = {
  id: string
  provider: AIProviderKind
  label: string
  enabled: boolean
  endpoint?: string
  apiStyle?: 'responses' | 'chat_completions'
  selectedModelId?: string
  capabilities?: Partial<ModelCapabilities>
  credentialSource: AICredentialSource
  credentialReference?: string
  createdAt: string
  updatedAt: string
}

export type ModelCapabilities = {
  structuredOutput: boolean
  largeContext: boolean
  toolCalling: boolean
  reasoning: boolean
  vision: boolean
  codeGeneration: boolean
  codeEditing: boolean
}

export type ModelDescriptor = {
  id: string
  providerId: string
  label: string
  capabilities: ModelCapabilities
  contextWindow?: number
}

export type StructuredAIRequest = {
  task: 'project_understanding' | 'release_reasoning' | 'assistant_response' | 'repair_proposal'
  instructions: string
  input: unknown
  schemaName: string
  schema: Record<string, unknown>
}

export type StructuredAIResponse<T> = {
  value: T
  providerId: string
  modelId: string
  completedAt: string
}

export type ProjectLocalConfig = {
  version: 1
  createdAt: string
  updatedAt: string
  ai: {
    selectedProviderId?: string
    providers: AIProviderConfig[]
  }
  assistant: {
    conversationRetention: 'local' | 'none'
    suggestedQuestionsEnabled: boolean
  }
}

export type AssistantCitationKind = 'project_understanding' | 'project_memory' | 'change' | 'release_report' | 'security_finding' | 'source_file'

export type AssistantCitation = {
  id: string
  kind: AssistantCitationKind
  label: string
  sourceId?: string
  file?: string
  startLine?: number
  endLine?: number
}

export type AssistantToolName =
  | 'get_project_understanding'
  | 'get_local_memory'
  | 'get_current_changes'
  | 'get_release_reports'
  | 'get_security_findings'
  | 'get_known_journeys'
  | 'search_project'
  | 'read_relevant_file'
  | 'explain_project_relationship'

export type AssistantToolCall = {
  id: string
  tool: AssistantToolName
  requestedAt: string
  completedAt?: string
  status: 'pending' | 'completed' | 'rejected' | 'failed'
  inputSummary: string
  outputSummary?: string
  citationIds: string[]
}

export type AssistantToolResult = {
  callId: string
  status: Extract<AssistantToolCall['status'], 'completed' | 'rejected' | 'failed'>
  summary: string
  citations: AssistantCitation[]
}

export type AssistantMessage = {
  id: string
  role: 'developer' | 'verion'
  content: string
  createdAt: string
  status: 'complete' | 'interrupted' | 'failed'
  citations: AssistantCitation[]
  toolCallIds: string[]
  basis?: 'discovered_fact' | 'review_observation' | 'model_inference'
  uncertainty?: string
  auditIds?: string[]
}

export type AssistantConversation = {
  version: 2
  id: string
  projectRoot: string
  createdAt: string
  updatedAt: string
  messages: AssistantMessage[]
  toolCalls: AssistantToolCall[]
}

/**
 * A deliberately separate, local operator trace for assistant and repair
 * actions. It is never a transcript: questions, source, credentials,
 * provider payloads, commands, and patches are all excluded by contract.
 */
export type AssistantAuditEventKind =
  | 'assistant_read'
  | 'source_consent'
  | 'assistant_refusal'
  | 'assistant_provider_fallback'
  | 'verification_requested'
  | 'verification_result'
  | 'repair_launch_approval'
  | 'repair_launch_result'
  | 'repair_proposal_prepared'
  | 'repair_proposal_declined'
  | 'repair_apply_approved'
  | 'repair_apply_result'
  | 'repair_verification_result'
  | 'repair_rollback_result'

export type AssistantAuditEntry = {
  id: string
  kind: AssistantAuditEventKind
  createdAt: string
  status: 'completed' | 'declined' | 'rejected' | 'failed'
  summary: string
  relatedIds?: string[]
}

export type AssistantAuditLog = {
  version: 1
  projectRoot: string
  createdAt: string
  updatedAt: string
  entries: AssistantAuditEntry[]
}

export type SecurityFindingSeverity = 'critical' | 'high' | 'medium' | 'low'

export type SecurityFindingStatus = 'open' | 'accepted_risk' | 'fixing' | 'resolved'

export type SecurityFinding = {
  id: string
  reviewId: string
  severity: SecurityFindingSeverity
  headline: string
  explanation: string
  affectedArea?: string
  file?: string
  startLine?: number
  endLine?: number
  evidenceIds: string[]
  suggestedAction: string
  status: SecurityFindingStatus
  createdAt: string
  updatedAt: string
}

/**
 * A small, local-only summary of the last Deep Security Review. Detailed
 * engine output is deliberately never persisted here or sent to the UI.
 */
export type SecurityReviewState = {
  status: 'completed' | 'concern' | 'partial' | 'failed'
  completedAt: string
  findingCount: number
}

export type RepairScope = {
  issueIds: string[]
  allowedFiles: string[]
  projectRoot: string
}

export type RepairFileChange = {
  path: string
  summary: string
  diff?: string
}

export type RepairProposal = {
  id: string
  scope: RepairScope
  summary: string
  fileChanges: RepairFileChange[]
  verificationPlan: string[]
  approval: 'not_requested' | 'pending' | 'approved' | 'declined'
  status: 'draft' | 'applied' | 'verified' | 'failed' | 'cancelled'
  createdAt: string
  updatedAt: string
}

/** A server-owned, redacted repair request shared by every repair surface. */
export type RepairBrief = {
  id: string
  source: 'release_report' | 'security_finding'
  issueId: string
  title: string
  severity: 'critical' | 'high' | 'attention'
  summary: string
  rootCause: string
  expectedBehavior: string
  evidence: string[]
  affectedFiles: Array<{ path: string; startLine?: number; endLine?: number; reason: string }>
  codeContext: Array<{ path: string; startLine: number; endLine: number; text: string }>
  verificationPlan: string[]
  createdAt: string
}

export type RepairReplaceOperation = {
  path: string
  original: string
  replacement: string
  summary: string
}

export type NativeRepairProposal = {
  id: string
  briefId: string
  sourceId: string
  title: string
  summary: string
  allowedFiles: string[]
  operations: RepairReplaceOperation[]
  verificationPlan: string[]
  status: 'draft' | 'applying' | 'verified' | 'failed' | 'cancelled'
  createdAt: string
  updatedAt: string
}
