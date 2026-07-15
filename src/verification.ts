export type ReleaseRecommendation = 'needs_attention' | 'ready_to_ship'

export type Evidence = {
  id: string
  kind: 'screenshot' | 'console_error' | 'network_failure'
  label: string
  detail: string
  artifactPath?: string
}

export type ExplorationStep = {
  id: string
  action: string
  outcome: 'passed' | 'failed'
}

export type IssueGroup = {
  title: string
  userImpact: string
  likelyRootCause: string
  expectedBehavior: string
  observedBehavior: string
  relevantFiles?: string[]
  evidence: Evidence[]
}

export type VerificationRun = {
  id: string
  targetLabel: string
  recommendation: ReleaseRecommendation
  exploredAt: string
  steps: ExplorationStep[]
  issue?: IssueGroup
}
