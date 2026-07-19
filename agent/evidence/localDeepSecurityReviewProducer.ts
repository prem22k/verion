import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolveProjectFile } from '../core/projectDiscovery'
import type { Evidence, EvidenceProducer, EvidenceProductionContext, SecurityReviewProgress } from '../core/types'
import { runLocalDependencyAudit } from './localDependencyAudit'
import { createSecurityScope, scopeCounts, type SecurityScope } from './securityScope'
import { runGitleaksReview, runSemgrepReview, runTrivyConfigurationReview, withSecurityScopeMirror, type EngineFinding, type EngineReview } from './localSecurityEngines'

const producerId = 'deep-security-review'
const maximumFindings = 50
const maximumCandidateFindings = 250

type LocalFinding = {
  key: string
  severity: 'critical' | 'high'
  category: 'credential' | 'dependency' | 'application' | 'configuration'
  headline: string
  explanation: string
  suggestedAction: string
  file: string
  line: number
  source: 'secret_scan' | 'package_scan' | 'sast_scan' | 'iac_scan' | 'dast_scan'
}

/**
 * Deep Security Review is a local security orchestrator. Its engines operate
 * only after a developer starts the review, never modify the project, and feed
 * one evidence-backed release decision rather than separate scanner products.
 */
export class LocalDeepSecurityReviewProducer implements EvidenceProducer {
  readonly id = producerId

  async produce(context: EvidenceProductionContext): Promise<Evidence[]> {
    const capturedAt = new Date().toISOString()
    const findings: LocalFinding[] = []
    let reviewedFiles = 0
    let recordedCandidates = 0
    const unavailableEngines: string[] = []
    const failedEngines: string[] = []
    await reportProgress(context, { station: 'scope', state: 'started', detail: 'Sealing the local project scope.' })
    let scope: SecurityScope
    try {
      scope = await createSecurityScope(context.projectPath)
    } catch {
      await reportProgress(context, { station: 'scope', state: 'failed', detail: 'Verion could not read the local project scope.' })
      await reportProgress(context, { station: 'decision', state: 'failed', detail: 'The security review could not establish a local scope.' })
      const failed = this.statusEvidence(capturedAt, 'failed', 0)
      await context.onEvidence?.(failed)
      return [failed]
    }

    const archivedRepositoryServicePrefix = await archivedRepositoryServicePrefixFor(scope.projectRoot, scope.files.map((file) => file.path))
    const reviewable = scope.files.filter((file) => !isArchivedRepositoryServicePath(file.path, archivedRepositoryServicePrefix))
    const counts = scopeCounts({ ...scope, files: reviewable })
    await reportProgress(context, {
      station: 'scope', state: 'completed',
      detail: scopeDetail(reviewable.length, counts, scope.excluded, scope.trackedEnvironmentFiles.length)
    })

    const addFindings = (next: LocalFinding[] | EngineFinding[]) => {
      recordedCandidates += next.length
      if (findings.length < maximumCandidateFindings) findings.push(...next.slice(0, maximumCandidateFindings - findings.length))
    }
    for (const file of scope.trackedEnvironmentFiles) {
      addFindings([{
        key: 'tracked-environment-file', severity: 'critical', category: 'configuration', source: 'iac_scan',
        headline: 'Environment file is tracked by Git',
        explanation: 'Git tracks an environment file. Its values were not read, but tracked runtime configuration can expose credentials through repository history.',
        suggestedAction: 'Remove the environment file from Git history, rotate any credentials it contained, and add it to the project ignore rules.',
        file, line: 1
      }])
    }
    const reviewFiles = async (files: SecurityScope['files']) => {
      for (const file of files) {
        try {
          const contents = await readFile(resolveProjectFile(scope.projectRoot, file.path), 'utf8')
          reviewedFiles += 1
          addFindings(findingsForFile(file.path, contents, { includeApplicationPatterns: file.kind === 'code' }))
        } catch {
          // An unreadable file is reflected by the scope result rather than
          // converted into a fabricated finding from a partial read.
        }
      }
    }

    await reportProgress(context, { station: 'code', state: 'started', detail: 'Reviewing every eligible local code path for unsafe execution and injection patterns.' })
    await reviewFiles(reviewable.filter((file) => file.kind === 'code'))

    let semgrep: EngineReview | undefined
    let gitleaks: EngineReview | undefined
    let trivy: EngineReview | undefined
    await withSecurityScopeMirror({ ...scope, files: reviewable }, async (mirrorPath) => {
      semgrep = await runSemgrepReview(mirrorPath)
      addEngineFindings(semgrep, addFindings, unavailableEngines, failedEngines)
      await reportProgress(context, { station: 'code', state: semgrep.status === 'failed' ? 'failed' : 'completed', detail: combineReviewDetail(`Reviewed ${counts.code} local code files.`, semgrep) })

      await reportProgress(context, { station: 'credentials', state: 'started', detail: 'Reviewing credentials without saving or displaying secret values.' })
      gitleaks = await runGitleaksReview(mirrorPath)
      addEngineFindings(gitleaks, addFindings, unavailableEngines, failedEngines)
      await reportProgress(context, { station: 'credentials', state: gitleaks.status === 'failed' ? 'failed' : 'completed', detail: combineReviewDetail('Reviewed every eligible file for exposed credentials.', gitleaks) })

      await reportProgress(context, { station: 'configuration', state: 'started', detail: 'Reviewing deployment, infrastructure, and workflow configuration.' })
      await reviewFiles(reviewable.filter((file) => file.kind === 'configuration' || file.kind === 'workflow'))
      trivy = await runTrivyConfigurationReview(mirrorPath)
      addEngineFindings(trivy, addFindings, unavailableEngines, failedEngines)
      await reportProgress(context, { station: 'configuration', state: trivy.status === 'failed' ? 'failed' : 'completed', detail: combineReviewDetail(`Reviewed ${counts.configuration + counts.workflow} configuration and workflow files.`, trivy) })
    })

    await reportProgress(context, { station: 'dependencies', state: 'started', detail: 'Reviewing dependency manifests and project configuration.' })
    const dependencyAudit = await runLocalDependencyAudit({
      projectPath: scope.projectRoot,
      packageManager: packageManagerForScope(scope),
      files: reviewable.map((file) => file.path)
    })
    for (const finding of dependencyAudit.findings) {
      addFindings([{
        key: `dependency:${finding.packageName}`,
        severity: finding.severity,
        category: 'dependency',
        source: 'package_scan',
        headline: `Known vulnerability in ${finding.packageName}`,
        explanation: finding.detail,
        suggestedAction: `Update ${finding.packageName} to a version that no longer includes the known vulnerability, then run Deep Security Review again.`,
        file: finding.file ?? 'package.json',
        line: 1
      }])
    }
    if (dependencyAudit.status === 'unavailable') unavailableEngines.push('dependency vulnerability matching')
    await reportProgress(context, {
      station: 'dependencies',
      state: dependencyAudit.status === 'unavailable' ? 'skipped' : 'completed',
      detail: `${dependencyAudit.detail} Reviewed ${counts.dependency} dependency manifest or lockfile${counts.dependency === 1 ? '' : 's'}.`
    })

    await reportRunningExperience(context, findings)
    await reportProgress(context, { station: 'decision', state: 'started', detail: 'Preparing the shared release decision.' })

    const selectedFindings = prioritizeFindings(findings).slice(0, maximumFindings)
    const incompleteEngines = [...unavailableEngines, ...failedEngines]
    const status = incompleteEngines.length > 0 ? 'partial' : selectedFindings.length > 0 ? 'concern' : 'completed'
    const review = this.statusEvidence(capturedAt, status, reviewedFiles, { totalEligibleFiles: reviewable.length, recordedCandidates, unavailableEngines: incompleteEngines })
    const evidence: Evidence[] = [review]
    for (const finding of selectedFindings) {
      evidence.push({
        id: `${producerId}:finding:${shortHash(`${finding.key}:${finding.file}:${finding.line}`)}`,
        producer: this.id,
        kind: 'security_finding',
        capturedAt,
        summary: finding.explanation,
        location: { file: finding.file, line: finding.line },
        data: {
          reviewId: `security-review:${capturedAt}`,
          source: finding.source,
          category: finding.category,
          severity: finding.severity,
          headline: finding.headline,
          explanation: finding.explanation,
          suggestedAction: finding.suggestedAction,
          file: finding.file,
          startLine: finding.line,
          endLine: finding.line
        }
      })
    }
    for (const item of evidence) await context.onEvidence?.(item)
    return evidence
  }

  private statusEvidence(capturedAt: string, status: 'completed' | 'concern' | 'partial' | 'failed', reviewedFiles: number, coverage: { totalEligibleFiles?: number; recordedCandidates?: number; unavailableEngines?: string[] } = {}): Evidence {
    return {
      id: `${producerId}:status`,
      producer: this.id,
      kind: 'security_review',
      capturedAt,
      summary: status === 'completed'
        ? 'Deep Security Review completed its local review. No critical or high concern appeared in the reviewed project material.'
        : status === 'concern'
          ? 'Deep Security Review found a concern that needs attention.'
          : status === 'partial'
            ? 'Deep Security Review completed its available local checks, but one or more specialist checks were unavailable.'
          : 'Deep Security Review could not establish a local review scope.',
      data: { status, reviewedFiles, reviewScope: 'local_project', ...coverage }
    }
  }
}

function findingsForFile(file: string, contents: string, options: { includeApplicationPatterns?: boolean } = {}): LocalFinding[] {
  const findings: LocalFinding[] = []
  const add = (key: string, pattern: RegExp, finding: Omit<LocalFinding, 'key' | 'file' | 'line'>) => {
    const match = pattern.exec(contents)
    if (!match) return
    if (finding.category === 'credential' && isSyntheticSecretMatch(file, match[0])) return
    addAt(key, match.index, finding)
  }
  const addAt = (key: string, offset: number, finding: Omit<LocalFinding, 'key' | 'file' | 'line'>) => {
    if (findings.some((item) => item.key === key)) return
    findings.push({ key, file, line: lineForOffset(contents, offset), ...finding })
  }
  add('aws-access-key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/, {
    severity: 'critical', category: 'credential', source: 'secret_scan',
    headline: 'Possible cloud credential in application code',
    explanation: 'A credential-shaped value appears in a project source file and could be exposed through the repository or build output.',
    suggestedAction: 'Remove the value from source, rotate the affected credential, and load it only from a protected runtime secret.'
  })
  add('stripe-live-key', /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/, {
    severity: 'critical', category: 'credential', source: 'secret_scan',
    headline: 'Possible live payment credential in application code',
    explanation: 'A live payment credential-shaped value appears in a project source file.',
    suggestedAction: 'Remove the value from source, rotate it with the payment provider, and move it to protected runtime configuration.'
  })
  add('github-token', /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/i, {
    severity: 'critical', category: 'credential', source: 'secret_scan',
    headline: 'Possible source-control credential in application code',
    explanation: 'A source-control credential-shaped value appears in a project source file.',
    suggestedAction: 'Remove the value from source, revoke or rotate the credential, and use protected runtime configuration.'
  })
  add('jwt-token', /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\b/, {
    severity: 'critical', category: 'credential', source: 'secret_scan',
    headline: 'Possible bearer credential in application code',
    explanation: 'A bearer credential-shaped value appears in a project source file and could grant access if it is still valid.',
    suggestedAction: 'Remove the value from source, revoke or rotate the credential, and load it only from protected runtime configuration.'
  })
  add('basic-auth', /authorization\s*:\s*basic\s+[a-zA-Z0-9+/=]{20,}/i, {
    severity: 'critical', category: 'credential', source: 'secret_scan',
    headline: 'Possible basic authentication credential in application code',
    explanation: 'A base64-shaped basic authentication value appears in a project source file.',
    suggestedAction: 'Remove the value from source and rotate the affected account or service credential.'
  })
  add('generic-secret-assignment', /(?:api[_-]?key|apikey|secret|token|password)\s*[:=]\s*['"][^'"\n]{16,}['"]/i, {
    severity: 'high', category: 'credential', source: 'secret_scan',
    headline: 'Possible credential assigned in application code',
    explanation: 'A secret-like value is assigned directly in a project source file. Confirm that it is not a live credential.',
    suggestedAction: 'Move the value out of source and rotate it if it belongs to a real account or environment.'
  })
  add('disabled-tls', /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/, {
    severity: 'high', category: 'configuration', source: 'iac_scan',
    headline: 'TLS certificate verification is disabled',
    explanation: 'The project disables TLS certificate verification, which can allow an attacker to intercept protected traffic.',
    suggestedAction: 'Remove the override and fix the local or deployment certificate chain instead.'
  })
  if (options.includeApplicationPatterns === false) {
    if (/(?:^|\/)Dockerfile$/i.test(file) && /\bUSER\s+root\b/i.test(contents) && !/\bUSER\s+(?!root\b)[A-Za-z0-9_-]+/i.test(contents)) {
      add('container-runs-as-root', /\bUSER\s+root\b/i, {
        severity: 'high', category: 'configuration', source: 'iac_scan',
        headline: 'Container runs as root',
        explanation: 'This Dockerfile explicitly runs the container as root and does not switch back to a less-privileged user.',
        suggestedAction: 'Create or select a non-root runtime user and switch to it before the container entrypoint runs.'
      })
    }
    if (/\.tf$/i.test(file)) {
      add('public-storage', /(?:public\s*[:=]\s*true|acl\s*[:=]\s*['"]public['"])/i, {
        severity: 'critical', category: 'configuration', source: 'iac_scan',
        headline: 'Public storage exposure needs review',
        explanation: 'Infrastructure configuration appears to enable public object access, which can expose stored application data.',
        suggestedAction: 'Restrict storage access to the minimum required principals and confirm that public access is intentional.'
      })
    }
    return findings
  }
  const evalOffset = executableCallOffset(contents, /\beval\s*\(/)
  if (evalOffset !== undefined) addAt('dynamic-eval', evalOffset, {
    severity: 'high', category: 'application', source: 'sast_scan',
    headline: 'Dynamic code execution needs review',
    explanation: 'This code invokes dynamic JavaScript evaluation, which can execute untrusted input if data reaches the expression.',
    suggestedAction: 'Replace dynamic evaluation with a fixed parser or allowlisted operation. If it is unavoidable, strictly isolate and validate every input.'
  })
  const functionOffset = executableCallOffset(contents, /\bnew\s+Function\s*\(/)
  if (functionOffset !== undefined) addAt('dynamic-function', functionOffset, {
    severity: 'high', category: 'application', source: 'sast_scan',
    headline: 'Dynamic function construction needs review',
    explanation: 'This code constructs executable JavaScript at runtime, which can create an injection path when input is not fully controlled.',
    suggestedAction: 'Replace runtime function construction with fixed code paths or an allowlisted interpreter.'
  })
  add('unsafe-html', /dangerouslySetInnerHTML\s*=/, {
    severity: 'high', category: 'application', source: 'sast_scan',
    headline: 'Unescaped HTML rendering needs review',
    explanation: 'The application renders an HTML string directly. Unsanitized content can create a cross-site scripting path.',
    suggestedAction: 'Avoid raw HTML where possible. Otherwise sanitize with a reviewed allowlist at the boundary where content enters the application.'
  })
  const domSink = executableCallOffset(contents, /\bdocument\.write\s*\(/) ?? executableCallOffset(contents, /\b(?:innerHTML|outerHTML)\s*=/)
  if (domSink !== undefined) addAt('dom-xss-sink', domSink, {
    severity: 'high', category: 'application', source: 'sast_scan',
    headline: 'Direct HTML injection sink needs review',
    explanation: 'The application writes an HTML string directly to the document. Unsanitized data can create a cross-site scripting path.',
    suggestedAction: 'Use safe DOM APIs or sanitize untrusted content with a reviewed allowlist before it reaches this sink.'
  })
  const dynamicQuery = sourcePatternOffset(contents, /\b(?:query|execute|raw)\s*\(\s*(?:`[^`]*\$\{|['"][^'"]*['"]\s*\+)/)
  if (dynamicQuery !== undefined) addAt('dynamic-query', dynamicQuery, {
    severity: 'high', category: 'application', source: 'sast_scan',
    headline: 'Possible query injection path needs review',
    explanation: 'A database query is assembled from interpolated text. Request-controlled values can create an injection path when they reach this query.',
    suggestedAction: 'Use parameterized queries or a query builder with bound values. Do not interpolate request-controlled values into a query.'
  })
  const untrustedCommand = sourcePatternOffset(contents, /\b(?:exec|execSync|spawn|spawnSync|system)\s*\(\s*(?:req(?:uest)?|ctx)\.(?:body|query|params)/)
  if (untrustedCommand !== undefined) addAt('untrusted-command', untrustedCommand, {
    severity: 'critical', category: 'application', source: 'sast_scan',
    headline: 'Request-controlled command execution needs review',
    explanation: 'A command execution API appears to receive request-controlled input. This can allow remote command execution.',
    suggestedAction: 'Remove shell execution from this request path. Use a fixed operation or strict allowlist and pass arguments without a shell.'
  })
  const untrustedRequest = sourcePatternOffset(contents, /\b(?:fetch|request|axios\.(?:get|post|request))\s*\(\s*(?:req(?:uest)?|ctx)\.(?:body|query|params)/)
  if (untrustedRequest !== undefined) addAt('untrusted-outbound-request', untrustedRequest, {
    severity: 'high', category: 'application', source: 'sast_scan',
    headline: 'Request-controlled outbound URL needs review',
    explanation: 'An outbound request appears to use request-controlled input directly. This can create a server-side request forgery path.',
    suggestedAction: 'Parse and validate the destination against an explicit hostname allowlist. Block private, loopback, link-local, and metadata network ranges.'
  })
  return findings
}

function prioritizeFindings(findings: LocalFinding[]): LocalFinding[] {
  const categoryPriority: Record<LocalFinding['category'], number> = {
    dependency: 0,
    credential: 1,
    application: 2,
    configuration: 3
  }
  return findings
    .filter((finding, index) => findings.findIndex((candidate) => findingIdentity(candidate) === findingIdentity(finding) && candidate.file === finding.file) === index)
    .sort((left, right) => {
      const severity = severityPriority(right.severity) - severityPriority(left.severity)
      if (severity !== 0) return severity
      const category = categoryPriority[left.category] - categoryPriority[right.category]
      if (category !== 0) return category
      return `${left.file}:${left.line}:${left.key}`.localeCompare(`${right.file}:${right.line}:${right.key}`)
    })
}

function findingIdentity(finding: LocalFinding): string {
  const key = finding.key.toLowerCase()
  if (key.includes('eval') || key.includes('dynamic-evaluation')) return 'dynamic-evaluation'
  if (key.includes('query') || key.includes('sql')) return 'query-injection'
  if (key.includes('outbound') || key.includes('ssrf')) return 'outbound-url'
  if (key.includes('stripe')) return 'stripe-credential'
  if (key.includes('github')) return 'source-control-credential'
  if (key.includes('html') || key.includes('xss')) return 'raw-html'
  if (key.includes('command') || key.includes('exec')) return 'command-execution'
  return key
}

function isSyntheticSecretMatch(file: string, value: string): boolean {
  const signal = `${file} ${value}`.toLowerCase()
  const syntheticValue = /(?:123456|abcdef|example|dummy|fake|placeholder|verion)/.test(signal)
  const testContext = /(?:^|\/)(?:__tests__|tests?|specs?|fixtures?|mocks?|examples?)(?:\/|$)|(?:^|[._-])(?:test|spec|fixture|mock|example)(?:[._-]|$)/.test(file.toLowerCase())
  return syntheticValue && (testContext || /(?:123456|example|dummy|fake|placeholder|verion)/.test(value.toLowerCase()))
}

function severityPriority(severity: LocalFinding['severity']): number {
  return severity === 'critical' ? 2 : 1
}

async function archivedRepositoryServicePrefixFor(projectRoot: string, files: string[]): Promise<string | undefined> {
  const marker = 'services/security/README.md'
  try {
    const contents = await readFile(resolveProjectFile(projectRoot, marker), 'utf8')
    return /^# Archived repository-service experiment\s*$/m.test(contents)
      && /not part of Verion's package, startup path, dashboard, or Deep Security Review/i.test(contents)
      ? 'services/security/'
      : undefined
  } catch {
    return undefined
  }
}

function isArchivedRepositoryServicePath(file: string, archivedPrefix: string | undefined): boolean {
  return Boolean(archivedPrefix && file.startsWith(archivedPrefix))
}

function addEngineFindings(review: EngineReview | undefined, addFindings: (findings: LocalFinding[] | EngineFinding[]) => void, unavailable: string[], failed: string[]): void {
  if (!review) return
  addFindings(review.findings)
  if (review.status === 'unavailable') unavailable.push(reviewArea(review))
  if (review.status === 'failed') failed.push(reviewArea(review))
}

function reviewArea(review: EngineReview): string {
  const detail = review.detail.toLowerCase()
  if (detail.includes('credential')) return 'credential detection'
  if (detail.includes('configuration')) return 'configuration analysis'
  if (detail.includes('code safety')) return 'code safety analysis'
  return 'a local security check'
}

function combineReviewDetail(fallback: string, review: EngineReview): string {
  return review.status === 'completed' ? `${fallback} ${review.detail}` : `${fallback} ${review.detail} This part of the review is incomplete.`
}

function packageManagerForScope(scope: SecurityScope): 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown' {
  const files = new Set(scope.files.map((file) => file.path))
  if (files.has('pnpm-lock.yaml')) return 'pnpm'
  if (files.has('yarn.lock')) return 'yarn'
  if (files.has('bun.lockb') || files.has('bun.lock')) return 'bun'
  if (files.has('package-lock.json')) return 'npm'
  return 'unknown'
}

function scopeDetail(eligible: number, counts: Record<'code' | 'configuration' | 'dependency' | 'workflow', number>, excluded: Record<string, number>, trackedEnvironmentFiles: number): string {
  const excludedSummary = Object.entries(excluded)
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 4)
    .map(([reason, count]) => `${count} ${reason}`)
    .join(', ')
  const reviewedKinds = `${counts.code} code, ${counts.configuration + counts.workflow} configuration/workflow, and ${counts.dependency} dependency files`
  return `Local scope contains ${eligible} eligible files: ${reviewedKinds}.${excludedSummary ? ` Excluded by policy: ${excludedSummary}.` : ''}${trackedEnvironmentFiles ? ` Git metadata shows ${trackedEnvironmentFiles} tracked runtime environment file${trackedEnvironmentFiles === 1 ? '' : 's'}; their values were not read.` : ''}`
}

async function reportRunningExperience(context: EvidenceProductionContext, findings: LocalFinding[]): Promise<void> {
  const target = localTarget(context.targetUrl)
  if (!target) {
    await reportProgress(context, { station: 'running_experience', state: 'skipped', detail: 'No reachable local app was included in this review.' })
    return
  }
  await reportProgress(context, { station: 'running_experience', state: 'started', detail: 'Reviewing the reachable local response boundary.' })
  try {
    const response = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(5_000) })
    const origin = response.headers.get('access-control-allow-origin')
    const credentials = response.headers.get('access-control-allow-credentials')
    if (origin === '*' && credentials?.toLowerCase() === 'true') {
      findings.push({
        key: 'wildcard-credentialed-cors', severity: 'high', category: 'configuration', source: 'dast_scan',
        headline: 'Credentialed cross-origin access needs review',
        explanation: 'The reachable local response allows every origin while also allowing credentials, which can expose authenticated responses across origins.',
        suggestedAction: 'Replace the wildcard origin with an explicit allowlist and verify credentialed requests only reach trusted origins.',
        file: 'Running application', line: 1
      })
    }
    await reportProgress(context, { station: 'running_experience', state: 'completed', detail: 'Reviewed the reachable local response boundary.' })
  } catch {
    await reportProgress(context, { station: 'running_experience', state: 'skipped', detail: 'The local app could not be reached, so this review stayed within the project files.' })
  }
}

function localTarget(value: string | undefined): string | undefined {
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

async function reportProgress(context: EvidenceProductionContext, progress: SecurityReviewProgress): Promise<void> {
  await context.onSecurityProgress?.(progress)
}

function lineForOffset(contents: string, offset: number): number {
  return contents.slice(0, offset).split('\n').length
}

function executableCallOffset(contents: string, expression: RegExp): number | undefined {
  let offset = 0
  for (const line of contents.split('\n')) {
    if (line.includes('verion-security: synthetic')) { offset += line.length + 1; continue }
    const code = stripQuotedText(line)
    const match = expression.exec(code)
    if (match) return offset + match.index
    offset += line.length + 1
  }
  return undefined
}

function sourcePatternOffset(contents: string, expression: RegExp): number | undefined {
  let offset = 0
  for (const line of contents.split('\n')) {
    if (line.includes('verion-security: synthetic')) { offset += line.length + 1; continue }
    const code = line.replace(/\/\/.*$/, '')
    const match = expression.exec(code)
    if (match) return offset + match.index
    offset += line.length + 1
  }
  return undefined
}

function stripQuotedText(line: string): string {
  let quote: '"' | "'" | '`' | undefined
  let escaped = false
  let result = ''
  for (const character of line) {
    if (quote) {
      if (escaped) { escaped = false; result += ' '; continue }
      if (character === '\\') { escaped = true; result += ' '; continue }
      if (character === quote) quote = undefined
      result += ' '
      continue
    }
    if (character === '"' || character === "'" || character === '`') { quote = character; result += ' '; continue }
    result += character
  }
  return result
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}
