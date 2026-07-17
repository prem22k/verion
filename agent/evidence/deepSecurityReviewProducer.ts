import type { Evidence, EvidenceProducer, EvidenceProductionContext, ReleaseReport } from '../core/types'
import { loadLocalEnvironment } from '../core/runtimeConfig'

const producerId = 'deep-security-review'
const requestTimeoutMs = 10_000
const reviewTimeoutMs = 180_000
const initialPollDelayMs = 750
const maximumPollDelayMs = 4_000
const trustedCriticalSources = new Set(['secret_scan'])
const defaultServiceUrl = 'http://127.0.0.1:5001'

export type DeepSecurityReviewConfig = {
  serviceUrl: string
  repositoryId: string
  repository: string
  requestedBy: string
}

type ServiceFinding = {
  id?: unknown
  severity?: unknown
  source?: unknown
  title?: unknown
  detail?: unknown
}

type ServiceJob = {
  status?: unknown
  results?: unknown
}

export function getDeepSecurityReviewConfig(): DeepSecurityReviewConfig | undefined {
  loadLocalEnvironment()
  const serviceUrl = process.env.VERION_DEEP_SECURITY_URL?.trim() || defaultServiceUrl
  const repositoryId = process.env.VERION_DEEP_SECURITY_REPOSITORY_ID?.trim()
  const repository = process.env.VERION_DEEP_SECURITY_REPOSITORY?.trim()
  const requestedBy = process.env.VERION_DEEP_SECURITY_REQUESTED_BY?.trim()
  if (!repositoryId || !repository || !requestedBy) return undefined
  return validateDeepSecurityReviewConfig({ serviceUrl, repositoryId, repository, requestedBy })
}

export function validateDeepSecurityReviewConfig(config: DeepSecurityReviewConfig): DeepSecurityReviewConfig {
  const service = new URL(config.serviceUrl)
  if (!isLoopbackHost(service.hostname) || !['http:', 'https:'].includes(service.protocol) || service.username || service.password) {
    throw new Error('Deep security review must use a loopback-only local service URL.')
  }
  if (!/^\d{1,20}$/.test(config.repositoryId)) throw new Error('Deep security review requires an approved GitHub repository ID.')
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository)) throw new Error('Deep security review requires an approved owner/repository identity.')
  if (!/^[A-Za-z0-9_.:@-]{1,80}$/.test(config.requestedBy)) throw new Error('Deep security review requires a local requester identity.')
  return {
    ...config,
    serviceUrl: service.toString().replace(/\/$/, '')
  }
}

export class DeepSecurityReviewProducer implements EvidenceProducer {
  readonly id = producerId

  constructor(
    private readonly config: DeepSecurityReviewConfig,
    private readonly options: {
      fetch?: typeof fetch
      requestTimeoutMs?: number
      reviewTimeoutMs?: number
      initialPollDelayMs?: number
      maximumPollDelayMs?: number
      wait?: (milliseconds: number) => Promise<void>
    } = {}
  ) {}

  static fromLocalEnvironment(): DeepSecurityReviewProducer | undefined {
    const config = getDeepSecurityReviewConfig()
    return config ? new DeepSecurityReviewProducer(config) : undefined
  }

  async produce(context: EvidenceProductionContext): Promise<Evidence[]> {
    const capturedAt = new Date().toISOString()
    try {
      const jobId = await this.createReview()
      const completedJob = await this.waitForReview(jobId)
      const findings = filterEligibleSecurityFindings(completedJob.results)
      const evidence: Evidence[] = [this.statusEvidence(capturedAt, findings.length > 0 ? 'concern' : 'completed')]
      for (const [index, finding] of findings.entries()) evidence.push(this.findingEvidence(capturedAt, index, finding))
      for (const item of evidence) await context.onEvidence?.(item)
      return evidence
    } catch {
      const failure = this.statusEvidence(capturedAt, 'failed')
      await context.onEvidence?.(failure)
      return [failure]
    }
  }

  private async createReview(): Promise<string> {
    const response = await this.request('/api/v1/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestedBy: this.config.requestedBy,
        repoId: this.config.repositoryId,
        repoFullName: this.config.repository,
        scanTypes: ['secrets', 'supply_chain', 'injection'],
        analysisDepth: 1
      })
    })
    const body = await jsonRecord(response)
    if (!response.ok || typeof body.jobId !== 'string' || body.jobId.length === 0) throw new Error('Deep review could not start.')
    return body.jobId
  }

  private async waitForReview(jobId: string): Promise<ServiceJob> {
    const deadline = Date.now() + (this.options.reviewTimeoutMs ?? reviewTimeoutMs)
    let delay = this.options.initialPollDelayMs ?? initialPollDelayMs
    while (Date.now() < deadline) {
      await (this.options.wait ?? wait)(delay)
      const response = await this.request(`/api/v1/jobs/${encodeURIComponent(jobId)}`)
      const job = await jsonRecord(response) as ServiceJob
      if (!response.ok || !isJobStatus(job.status)) throw new Error('Deep review returned an invalid response.')
      if (job.status === 'completed') return job
      if (job.status === 'failed') throw new Error('Deep review could not complete.')
      delay = Math.min(delay * 2, this.options.maximumPollDelayMs ?? maximumPollDelayMs)
    }
    throw new Error('Deep review timed out.')
  }

  private request(path: string, init?: RequestInit): Promise<Response> {
    const fetcher = this.options.fetch ?? fetch
    return fetcher(`${this.config.serviceUrl}${path}`, { ...init, signal: AbortSignal.timeout(this.options.requestTimeoutMs ?? requestTimeoutMs) })
  }

  private statusEvidence(capturedAt: string, status: 'completed' | 'concern' | 'failed'): Evidence {
    const summary = status === 'completed'
      ? 'Deep security review complete. No critical concerns appeared in this review.'
      : status === 'concern'
        ? 'Deep security review found a critical concern.'
        : 'Deep security review could not finish.'
    return {
      id: `${producerId}:status`,
      producer: producerId,
      kind: 'security_review',
      capturedAt,
      summary,
      data: { status }
    }
  }

  private findingEvidence(capturedAt: string, index: number, finding: EligibleSecurityFinding): Evidence {
    return {
      id: `${producerId}:finding:${index + 1}`,
      producer: producerId,
      kind: 'security_finding',
      capturedAt,
      summary: finding.summary,
      data: { category: finding.category, confidence: 'high', severity: 'critical' }
    }
  }
}

type EligibleSecurityFinding = { category: 'credential' | 'dependency' | 'application' | 'configuration'; summary: string }

export function filterEligibleSecurityFindings(results: unknown): EligibleSecurityFinding[] {
  if (!Array.isArray(results)) return []
  const categories = new Set<EligibleSecurityFinding['category']>()
  const findings: EligibleSecurityFinding[] = []
  for (const item of results) {
    if (!isEligibleCriticalFinding(item)) continue
    const category = securityCategory(item)
    if (categories.has(category)) continue
    categories.add(category)
    findings.push({ category, summary: securitySummary(category) })
    if (findings.length === 3) break
  }
  return findings
}

function isEligibleCriticalFinding(value: unknown): value is ServiceFinding {
  if (!value || typeof value !== 'object') return false
  const finding = value as ServiceFinding
  if (typeof finding.severity !== 'string' || finding.severity.toLowerCase() !== 'critical') return false
  const source = typeof finding.source === 'string' ? finding.source : ''
  const id = typeof finding.id === 'string' ? finding.id : ''
  return trustedCriticalSources.has(source) || isAuthoritativeFindingId(id)
}

function isAuthoritativeFindingId(value: string): boolean {
  return /^(?:CVE-\d{4}-\d{4,}|GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}|OSV-\d{4}-\d{3,})$/i.test(value)
}

function securityCategory(finding: ServiceFinding): EligibleSecurityFinding['category'] {
  const source = typeof finding.source === 'string' ? finding.source : ''
  const title = typeof finding.title === 'string' ? finding.title.toLowerCase() : ''
  if (source === 'secret_scan' || /credential|token|secret|key/.test(title)) return 'credential'
  if (source === 'package_scan' || /dependenc|package/.test(title)) return 'dependency'
  if (source === 'iac_scan' || source === 'cspm_scan' || /config|infrastructure|permission/.test(title)) return 'configuration'
  return 'application'
}

function securitySummary(category: EligibleSecurityFinding['category']): string {
  if (category === 'credential') return 'A critical credential concern may be reachable in the reviewed repository.'
  if (category === 'dependency') return 'A critical dependency concern needs to be resolved before this release.'
  if (category === 'configuration') return 'A critical configuration concern needs to be resolved before this release.'
  return 'A critical application concern needs to be resolved before this release.'
}

export function securityReviewFailureReport(evidence: Evidence[]): ReleaseReport | undefined {
  const failure = evidence.find((item) => item.producer === producerId && item.kind === 'security_review' && record(item.data).status === 'failed')
  if (!failure) return undefined
  return {
    recommendation: 'inconclusive',
    confidence: 'limited',
    headline: 'Inconclusive',
    rootCause: 'A deep security review could not finish.',
    reasons: ['Verion could not complete the critical-concern review for this approved repository.'],
    evidenceIds: [failure.id],
    nextAction: 'Make the local security review available, then verify again.'
  }
}

export function enforceCriticalSecurityDecision(report: ReleaseReport, evidence: Evidence[]): ReleaseReport {
  const findings = evidence.filter((item) => item.producer === producerId && item.kind === 'security_finding')
  if (findings.length === 0) return report
  const reasons = [findings[0].summary, ...report.reasons].filter((reason, index, values) => values.findIndex((value) => value.toLowerCase() === reason.toLowerCase()) === index).slice(0, 3)
  return {
    ...report,
    recommendation: 'needs_attention',
    confidence: 'high',
    headline: 'Needs attention',
    rootCause: findings[0].summary,
    reasons,
    evidenceIds: [...new Set([...findings.map((finding) => finding.id), ...report.evidenceIds])]
  }
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1'
}

function isJobStatus(value: unknown): value is string {
  return typeof value === 'string' && ['queued', 'cpgraph_building', 'cpgraph_analyzing', 'harness_synthesizing', 'sandbox_verifying', 'rendering_report', 'completed', 'failed'].includes(value)
}

async function jsonRecord(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json().catch(() => undefined)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Deep review returned an invalid response.')
  return value as Record<string, unknown>
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
