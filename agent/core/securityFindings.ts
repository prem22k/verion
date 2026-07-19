import { createHash } from 'node:crypto'
import type { Evidence, ProjectVerificationResult, ReleaseReport, SecurityFinding, SecurityFindingSeverity, SecurityReviewState } from './types'

const findingLimit = 50
const displayFindingLimit = 20
const allowedSeverities = new Set<SecurityFindingSeverity>(['critical', 'high', 'medium', 'low'])

export type PublicSecurityFinding = {
  id: string
  severity: 'critical' | 'high'
  headline: string
  explanation: string
  evidence: string
  suggestedAction: string
  status: 'open' | 'accepted_risk' | 'fixing'
  affectedArea?: string
  file?: string
  startLine?: number
  endLine?: number
  nativeFixAvailable: boolean
}

/**
 * Turns the bounded security evidence contract into durable local memory.
 * The normalizer is intentionally defensive because evidence can be produced
 * by a locally upgraded reviewer before this dashboard is upgraded.
 */
export function normalizeSecurityFindings(evidence: Evidence[], completedAt: string): SecurityFinding[] {
  return evidence
    .flatMap((item, index) => item.kind === 'security_finding' ? [normalizeFinding(item, completedAt, index)] : [])
    .filter((item): item is SecurityFinding => Boolean(item))
    .sort(compareSecurityFindings)
    .slice(0, findingLimit)
}

export function mergeSecurityFindings(previous: SecurityFinding[], evidence: Evidence[], completedAt: string): SecurityFinding[] {
  const nextFindings = normalizeSecurityFindings(evidence, completedAt)
  const review = securityReviewStateFromEvidence(evidence, completedAt)
  if (!review) return normalizeStoredSecurityFindings(previous, completedAt)

  const earlier = new Map(normalizeStoredSecurityFindings(previous, completedAt).map((finding) => [finding.id, finding]))
  const current = nextFindings.map((finding) => {
    const saved = earlier.get(finding.id)
    return saved ? {
      ...finding,
      createdAt: saved.createdAt,
      status: saved.status === 'resolved' ? 'open' : saved.status
    } : finding
  })

  // A clean completed review is the only automatic resolution signal. A
  // partial/concern review must not imply that unrelated saved concerns have
  // been fixed.
  const unseen = review.status === 'completed'
    ? [...earlier.values()].flatMap((finding) => current.some((item) => item.id === finding.id) || finding.status === 'resolved'
      ? []
      : [{ ...finding, status: 'resolved' as const, updatedAt: completedAt }])
    : [...earlier.values()].filter((finding) => !current.some((item) => item.id === finding.id))

  return [...current, ...unseen].sort(compareSecurityFindings).slice(0, findingLimit)
}

export function securityReviewStateFromEvidence(evidence: Evidence[], completedAt: string): SecurityReviewState | undefined {
  const review = evidence.find((item) => item.kind === 'security_review' && item.producer === 'deep-security-review')
  if (!review) return undefined
  const status = valueRecord(review.data).status
  if (status !== 'completed' && status !== 'concern' && status !== 'partial' && status !== 'failed') return undefined
  return {
    status,
    completedAt: safeTimestamp(review.capturedAt, completedAt),
    findingCount: evidence.filter((item) => item.kind === 'security_finding' && item.producer === review.producer).length
  }
}

/** A critical current finding is always part of the canonical release call. */
export function enforceSecurityReleaseDecision(report: ReleaseReport, evidence: Evidence[]): ReleaseReport {
  const critical = normalizeSecurityFindings(evidence, new Date().toISOString()).filter((finding) => finding.severity === 'critical')
  if (critical.length === 0) return report
  const first = critical[0]
  const rootCause = `${first.headline}. ${first.explanation}`
  const reasons = uniqueCopy([rootCause, ...report.reasons]).slice(0, 3)
  return {
    ...report,
    recommendation: 'needs_attention',
    confidence: 'high',
    headline: 'Needs attention',
    rootCause,
    reasons,
    evidenceIds: [...new Set([...critical.flatMap((finding) => finding.evidenceIds), ...report.evidenceIds])],
    nextAction: first.suggestedAction
  }
}

export function integrateSecurityDecision(result: ProjectVerificationResult): ProjectVerificationResult {
  return result.report ? { ...result, report: enforceSecurityReleaseDecision(result.report, result.evidence) } : result
}

/**
 * This is the only security finding representation that may cross the local
 * HTTP boundary. It excludes review identifiers, evidence IDs, engine data,
 * external references, and anything that could be mistaken for a secret.
 */
export function publicSecurityFindings(findings: SecurityFinding[], options: { nativeFixAvailable?: boolean } = {}): PublicSecurityFinding[] {
  return normalizeStoredSecurityFindings(findings, new Date().toISOString())
    .filter((finding): finding is SecurityFinding & { severity: 'critical' | 'high' } => finding.status !== 'resolved' && (finding.severity === 'critical' || finding.severity === 'high'))
    .sort(compareSecurityFindings)
    .slice(0, displayFindingLimit)
    .map((finding) => ({
      id: finding.id,
      severity: finding.severity,
      headline: customerSecurityCopy(finding.headline, 'Security concern needs attention.'),
      explanation: customerSecurityCopy(finding.explanation, 'This concern needs review before the next release.'),
      evidence: evidenceCopy(finding),
      suggestedAction: customerSecurityCopy(finding.suggestedAction, 'Review the affected area and make the smallest safe correction.'),
      status: finding.status === 'accepted_risk' || finding.status === 'fixing' ? finding.status : 'open',
      ...(finding.affectedArea ? { affectedArea: customerSecurityCopy(finding.affectedArea, 'Affected application area') } : {}),
      ...(safeRelativePath(finding.file) ? { file: safeRelativePath(finding.file) } : {}),
      ...(safeLine(finding.startLine) ? { startLine: safeLine(finding.startLine) } : {}),
      ...(safeLine(finding.endLine) ? { endLine: safeLine(finding.endLine) } : {}),
      nativeFixAvailable: Boolean(options.nativeFixAvailable)
    }))
}

export function securityFixPrompt(finding: PublicSecurityFinding, project: { summary: string; criticalFlows?: string[] }): string {
  const location = finding.file
    ? `\nAffected location: ${finding.file}${finding.startLine ? `:${finding.startLine}${finding.endLine && finding.endLine !== finding.startLine ? `-${finding.endLine}` : ''}` : ''}`
    : ''
  const flows = project.criticalFlows?.filter(Boolean).slice(0, 3) ?? []
  return [
    'You are repairing one review-backed concern in a local application.',
    `Finding: ${finding.headline}`,
    `Why it matters: ${finding.explanation}`,
    `Review evidence: ${finding.evidence}`,
    `Suggested action: ${finding.suggestedAction}${location}`,
    `Project context: ${customerSecurityCopy(project.summary, 'A local application under review.')}`,
    ...(flows.length ? [`Important paths to preserve: ${flows.join(', ')}.`] : []),
    'Inspect the affected area, propose the smallest safe repair, and wait for explicit developer approval before editing files. Do not expose, print, or copy credentials. After the developer reviews the diff, run the smallest relevant check and let Verion review the saved change again.'
  ].join('\n')
}

export function normalizeStoredSecurityFindings(value: unknown, fallbackTimestamp: string): SecurityFinding[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item, index) => {
    const record = valueRecord(item)
    if (!record) return []
    const severity = normalizeSeverity(record.severity)
    if (!severity) return []
    const headline = customerSecurityCopy(text(record.headline), '')
    const explanation = customerSecurityCopy(text(record.explanation), '')
    const suggestedAction = customerSecurityCopy(text(record.suggestedAction), '')
    if (!headline || !explanation || !suggestedAction) return []
    const file = safeRelativePath(text(record.file))
    const startLine = safeLine(record.startLine)
    const endLine = safeLine(record.endLine)
    const createdAt = safeTimestamp(text(record.createdAt), fallbackTimestamp)
    const updatedAt = safeTimestamp(text(record.updatedAt), createdAt)
    return [{
      id: safeIdentifier(text(record.id)) ?? `security:${shortHash(`${severity}:${headline}:${file ?? ''}:${startLine ?? ''}:${index}`)}`,
      reviewId: safeIdentifier(text(record.reviewId)) ?? `security-review:${createdAt}`,
      severity,
      headline,
      explanation,
      ...(text(record.affectedArea) ? { affectedArea: customerSecurityCopy(text(record.affectedArea), 'Affected application area') } : {}),
      ...(file ? { file } : {}),
      ...(startLine ? { startLine } : {}),
      ...(endLine ? { endLine: Math.max(startLine ?? 1, endLine) } : {}),
      evidenceIds: stringValues(record.evidenceIds),
      suggestedAction,
      status: normalizeStatus(record.status),
      createdAt,
      updatedAt
    }]
  }).sort(compareSecurityFindings).slice(0, findingLimit)
}

function normalizeFinding(evidence: Evidence, completedAt: string, index: number): SecurityFinding | undefined {
  const data = valueRecord(evidence.data)
  const severity = normalizeSeverity(data.severity)
  if (!severity) return undefined
  const category = text(data.category)
  const headline = customerSecurityCopy(text(data.headline) ?? headlineForCategory(category), '')
  const explanation = customerSecurityCopy(text(data.explanation) ?? evidence.summary, '')
  const suggestedAction = customerSecurityCopy(text(data.suggestedAction) ?? actionForCategory(category), '')
  if (!headline || !explanation || !suggestedAction) return undefined
  const file = safeRelativePath(text(data.file) ?? evidence.location?.file)
  const startLine = safeLine(data.startLine) ?? safeLine(evidence.location?.line)
  const endLine = safeLine(data.endLine)
  const createdAt = safeTimestamp(evidence.capturedAt, completedAt)
  const idSeed = `${severity}:${headline}:${file ?? ''}:${startLine ?? ''}:${category ?? ''}`
  return {
    id: `security:${shortHash(idSeed)}`,
    reviewId: safeIdentifier(text(data.reviewId)) ?? `security-review:${createdAt}`,
    severity,
    headline,
    explanation,
    ...(category ? { affectedArea: affectedAreaForCategory(category) } : {}),
    ...(file ? { file } : {}),
    ...(startLine ? { startLine } : {}),
    ...(endLine ? { endLine: Math.max(startLine ?? 1, endLine) } : {}),
    evidenceIds: safeIdentifier(evidence.id) ? [evidence.id] : [],
    suggestedAction,
    status: 'open',
    createdAt,
    updatedAt: createdAt
  }
}

function compareSecurityFindings(left: SecurityFinding, right: SecurityFinding): number {
  const severity = severityRank(left.severity) - severityRank(right.severity)
  if (severity) return severity
  const open = Number(left.status === 'resolved') - Number(right.status === 'resolved')
  if (open) return open
  return right.updatedAt.localeCompare(left.updatedAt) || left.headline.localeCompare(right.headline)
}

function severityRank(value: SecurityFindingSeverity): number {
  return value === 'critical' ? 0 : value === 'high' ? 1 : value === 'medium' ? 2 : 3
}

function normalizeSeverity(value: unknown): SecurityFindingSeverity | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.toLowerCase().trim()
  return allowedSeverities.has(normalized as SecurityFindingSeverity) ? normalized as SecurityFindingSeverity : undefined
}

function normalizeStatus(value: unknown): SecurityFinding['status'] {
  return value === 'accepted_risk' || value === 'fixing' || value === 'resolved' ? value : 'open'
}

function headlineForCategory(category: string | undefined): string {
  if (category === 'credential') return 'A credential concern needs attention'
  if (category === 'dependency') return 'A dependency concern needs attention'
  if (category === 'configuration') return 'A configuration concern needs attention'
  return 'An application concern needs attention'
}

function actionForCategory(category: string | undefined): string {
  if (category === 'credential') return 'Remove the credential from the affected area, rotate it, and confirm it is no longer reachable.'
  if (category === 'dependency') return 'Update or replace the affected dependency, then verify the application path that depends on it.'
  if (category === 'configuration') return 'Apply the least-privilege configuration change and verify the affected deployment path.'
  return 'Inspect the affected application path and make the smallest safe correction before verifying again.'
}

function affectedAreaForCategory(category: string): string {
  if (category === 'credential') return 'Credential handling'
  if (category === 'dependency') return 'Dependency management'
  if (category === 'configuration') return 'Application configuration'
  return 'Application behavior'
}

function evidenceCopy(finding: SecurityFinding): string {
  const location = finding.file ? ` The review connected it to ${finding.file}${finding.startLine ? ` near line ${finding.startLine}` : ''}.` : ''
  return customerSecurityCopy(`${finding.explanation}${location}`, 'The latest local review recorded this concern.')
}

function customerSecurityCopy(value: string | undefined, fallback: string): string {
  const normalized = (value ?? '')
    .replace(/-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z]+)? PRIVATE KEY-----/gi, 'sensitive credential removed')
    .replace(/(?:sk[-_]|AIza|or-)[A-Za-z0-9_-]{8,}/g, 'sensitive credential removed')
    .replace(/\b(?:Bearer\s+)[A-Za-z0-9._~+\/-]{8,}\b/gi, 'sensitive credential removed')
    .replace(/\b(?:api[_-]?key|token|password|secret|authorization)\s*[:=]\s*[^\s,;]+/gi, 'sensitive value removed')
    .replace(/https?:\/\/\S+/gi, 'the affected application')
    .replace(/\b(?:scanner|engine|producer|raw log|logs?|job|payload|Semgrep|Playwright|Gitleaks|Trivy|Nuclei|Snyk|OSV|GitHub Advanced Security|CodeQL|OWASP)\b/gi, 'review')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 480)
  return normalized || fallback
}

function safeRelativePath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.replace(/[\\]/g, '/').replace(/:\d+(?::\d+)?$/, '').replace(/^\.\//, '').trim()
  if (!normalized || normalized.length > 240 || normalized.startsWith('/') || normalized.includes('..') || /[\r\n\0]/.test(normalized) || /^https?:/i.test(normalized)) return undefined
  return normalized
}

function safeLine(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 1_000_000 ? value : undefined
}

function safeTimestamp(value: unknown, fallback: string): string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallback
}

function valueRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function stringValues(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => Boolean(safeIdentifier(item))))] : []
}

function safeIdentifier(value: string | undefined): string | undefined {
  return value && value.length <= 240 && !/(?:sk[-_]|AIza|or-)[A-Za-z0-9_-]{8,}|(?:api[ _-]?key|authorization|bearer|token|password|secret)\s*[:=]|-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|(?:mongodb|postgres(?:ql)?|mysql):\/\//i.test(value)
    ? value
    : undefined
}

function uniqueCopy(values: string[]): string[] {
  const seen = new Set<string>()
  return values.flatMap((value) => {
    const copy = customerSecurityCopy(value, '')
    if (!copy || seen.has(copy.toLowerCase())) return []
    seen.add(copy.toLowerCase())
    return [copy]
  })
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}
