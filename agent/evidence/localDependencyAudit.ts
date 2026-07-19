import { spawn } from 'node:child_process'
import { relative } from 'node:path'
import type { PackageManager } from '../core/types'

const auditTimeoutMs = 45_000
const maximumAuditOutputBytes = 768 * 1024
const maximumFindings = 10

export type DependencyAuditFinding = {
  packageName: string
  severity: 'critical' | 'high'
  detail: string
  file?: string
}

export type LocalDependencyAudit = {
  status: 'completed' | 'skipped' | 'unavailable'
  findings: DependencyAuditFinding[]
  reviewedDependencies?: number
  detail: string
}

/**
 * Runs only after a developer deliberately starts Deep Security Review. The
 * command is fixed, has no shell, cannot install or update anything, and is
 * limited to the current project's npm lockfile.
 */
export async function runLocalDependencyAudit(input: {
  projectPath: string
  packageManager: PackageManager
  files: string[]
}): Promise<LocalDependencyAudit> {
  const osv = await runOsvAudit(input.projectPath)
  if (osv.status === 'completed' && osv.json) {
    const parsed = parseOsvAudit(osv.json, input.projectPath)
    return {
      status: 'completed', findings: parsed.findings, reviewedDependencies: parsed.reviewedDependencies,
      detail: parsed.reviewedDependencies
        ? `Checked ${parsed.reviewedDependencies} locked dependencies across the local project for known vulnerabilities.`
        : 'Checked local dependency lockfiles for known vulnerabilities.'
    }
  }

  if (input.packageManager !== 'npm' || !input.files.includes('package-lock.json') || !input.files.includes('package.json')) {
    const hasDependencyManifest = input.files.some((file) => ['package.json', 'pyproject.toml', 'requirements.txt', 'go.mod', 'Cargo.toml', 'composer.json', 'Gemfile', 'pom.xml'].includes(file.split('/').at(-1) ?? file))
    return {
      status: hasDependencyManifest ? 'unavailable' : 'skipped',
      findings: [],
      detail: 'Dependency files were reviewed locally, but Verion could not access known-vulnerability matching for this project type yet.'
    }
  }

  const output = await runNpmAudit(input.projectPath)
  if (output.status === 'unavailable') {
    return {
      status: 'unavailable',
      findings: [],
      detail: 'Dependency files were reviewed locally. A known-vulnerability lookup could not run on this machine.'
    }
  }
  if (!output.json) {
    return {
      status: 'unavailable',
      findings: [],
      detail: 'Dependency files were reviewed locally. The dependency review did not return usable vulnerability data.'
    }
  }

  const parsed = parseNpmAudit(output.json)
  return {
    status: 'completed',
    findings: parsed.findings,
    reviewedDependencies: parsed.reviewedDependencies,
    detail: parsed.reviewedDependencies
      ? `Checked ${parsed.reviewedDependencies} production dependencies for known vulnerabilities.`
      : 'Checked the production dependency graph for known vulnerabilities.'
  }
}

/**
 * OSV Scanner is the primary dependency engine because it understands
 * lockfiles from multiple ecosystems. npm audit remains a safe, npm-only
 * fallback when the engine is not installed yet.
 */
async function runOsvAudit(projectPath: string): Promise<{ status: 'completed' | 'unavailable' | 'failed'; json?: unknown }> {
  return new Promise((resolveAudit) => {
    let settled = false
    let stdout = ''
    let timeout: NodeJS.Timeout | undefined
    const finish = (value: { status: 'completed' | 'unavailable' | 'failed'; json?: unknown }) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      resolveAudit(value)
    }
    let child
    try {
      child = spawn('osv-scanner', ['scan', 'source', '--format=json', '--verbosity=error', '--recursive', projectPath], {
        cwd: projectPath, shell: false, stdio: ['ignore', 'pipe', 'ignore']
      })
    } catch {
      finish({ status: 'unavailable' })
      return
    }
    timeout = setTimeout(() => { child.kill(); finish({ status: 'failed' }) }, auditTimeoutMs)
    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length >= maximumAuditOutputBytes) return
      stdout += chunk.toString('utf8').slice(0, maximumAuditOutputBytes - stdout.length)
    })
    child.once('error', (error: NodeJS.ErrnoException) => finish({ status: error.code === 'ENOENT' ? 'unavailable' : 'failed' }))
    child.once('close', () => {
      try { finish({ status: 'completed', json: JSON.parse(stdout) as unknown }) } catch { finish({ status: 'failed' }) }
    })
  })
}

export function parseNpmAudit(value: unknown): Pick<LocalDependencyAudit, 'findings' | 'reviewedDependencies'> {
  const report = record(value)
  const vulnerabilities = record(report.vulnerabilities)
  const metadata = record(report.metadata)
  const dependencyMetadata = record(metadata.dependencies)
  const reviewedDependencies = positiveNumber(dependencyMetadata.prod)
    ?? positiveNumber(dependencyMetadata.total)

  const findings = Object.entries(vulnerabilities)
    .flatMap(([fallbackName, value]) => {
      const vulnerability = record(value)
      const severity = vulnerability.severity
      if (severity !== 'critical' && severity !== 'high') return []
      const packageName = safePackageName(typeof vulnerability.name === 'string' ? vulnerability.name : fallbackName)
      if (!packageName) return []
      return [{
        packageName,
        severity,
        detail: dependencyDetail(vulnerability)
      } satisfies DependencyAuditFinding]
    })
    .sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || left.packageName.localeCompare(right.packageName))
    .slice(0, maximumFindings)

  return { findings, ...(reviewedDependencies ? { reviewedDependencies } : {}) }
}

export function parseOsvAudit(value: unknown, projectPath = ''): Pick<LocalDependencyAudit, 'findings' | 'reviewedDependencies'> {
  const report = record(value)
  const results = Array.isArray(report.results) ? report.results : []
  let reviewedDependencies = 0
  const findings = results.flatMap((item) => {
    const result = record(item)
    const source = record(result.source)
    const sourcePath = typeof source.path === 'string' ? localSourcePath(source.path, projectPath) : undefined
    const packages = Array.isArray(result.packages) ? result.packages : []
    reviewedDependencies += packages.length
    return packages.flatMap((packageRecord) => {
      const item = record(packageRecord)
      const packageInfo = record(item.package)
      const packageName = safePackageName(typeof packageInfo.name === 'string' ? packageInfo.name : '')
      if (!packageName) return []
      const vulnerabilities = Array.isArray(item.vulnerabilities) ? item.vulnerabilities : []
      return vulnerabilities.flatMap((vulnerabilityRecord) => {
        const vulnerability = record(vulnerabilityRecord)
        const severity = osvSeverity(vulnerability)
        if (!severity) return []
        const id = typeof vulnerability.id === 'string' ? vulnerability.id : 'known advisory'
        const summary = typeof vulnerability.summary === 'string' && vulnerability.summary.trim()
          ? vulnerability.summary.trim().slice(0, 220)
          : `Known advisory ${id} affects this dependency.`
        return [{ packageName, severity, detail: summary, ...(sourcePath ? { file: sourcePath } : {}) }]
      })
    })
  }).sort((left, right) => severityRank(right.severity) - severityRank(left.severity) || left.packageName.localeCompare(right.packageName))

  return { findings: uniqueDependencyFindings(findings).slice(0, maximumFindings), ...(reviewedDependencies ? { reviewedDependencies } : {}) }
}

async function runNpmAudit(projectPath: string): Promise<{ status: 'completed' | 'unavailable'; json?: unknown }> {
  const executable = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  return new Promise((resolveAudit) => {
    let settled = false
    let stdout = ''
    let timeout: NodeJS.Timeout | undefined
    const finish = (value: { status: 'completed' | 'unavailable'; json?: unknown }) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      resolveAudit(value)
    }
    let child
    try {
      child = spawn(executable, ['audit', '--json', '--omit=dev', '--ignore-scripts'], {
        cwd: projectPath,
        shell: false,
        stdio: ['ignore', 'pipe', 'ignore']
      })
    } catch {
      finish({ status: 'unavailable' })
      return
    }
    timeout = setTimeout(() => {
      child.kill()
      finish({ status: 'unavailable' })
    }, auditTimeoutMs)
    child.stdout.on('data', (chunk: Buffer) => {
      if (stdout.length >= maximumAuditOutputBytes) return
      stdout += chunk.toString('utf8').slice(0, maximumAuditOutputBytes - stdout.length)
    })
    child.once('error', () => finish({ status: 'unavailable' }))
    child.once('close', () => {
      try {
        const json = JSON.parse(stdout) as unknown
        finish({ status: 'completed', json })
      } catch {
        finish({ status: 'unavailable' })
      }
    })
  })
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined
}

function safePackageName(value: string): string | undefined {
  const name = value.trim()
  return /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(name) && name.length <= 120 ? name : undefined
}

function dependencyDetail(vulnerability: Record<string, unknown>): string {
  const via = Array.isArray(vulnerability.via) ? vulnerability.via : []
  const advisory = via.find((item) => typeof item === 'object' && item !== null && !Array.isArray(item))
  const title = advisory ? (advisory as Record<string, unknown>).title : undefined
  return typeof title === 'string' && title.trim().length > 0 && title.length <= 240
    ? title.trim()
    : 'A known vulnerability affects this dependency in the current production dependency graph.'
}

function osvSeverity(vulnerability: Record<string, unknown>): DependencyAuditFinding['severity'] | undefined {
  const databaseSpecific = record(vulnerability.database_specific)
  const namedSeverity = typeof databaseSpecific.severity === 'string' ? databaseSpecific.severity.toLowerCase() : undefined
  if (namedSeverity === 'critical') return 'critical'
  if (namedSeverity === 'high') return 'high'
  const scores = (Array.isArray(vulnerability.severity) ? vulnerability.severity : [])
    .flatMap((item) => {
      const score = record(item).score
      return typeof score === 'string' ? [score] : []
    })
  const score = Math.max(-1, ...scores.map((value) => Number(value.match(/(?:^|[^\d])(10(?:\.0)?|\d(?:\.\d+)?)/)?.[1] ?? -1)))
  return score >= 9 ? 'critical' : score >= 7 ? 'high' : undefined
}

function localSourcePath(value: string, projectPath: string): string | undefined {
  if (!value) return undefined
  const normalized = projectPath ? relative(projectPath, value) : value
  return normalized && !normalized.startsWith('..') ? normalized.split('\\').join('/') : undefined
}

function uniqueDependencyFindings(findings: DependencyAuditFinding[]): DependencyAuditFinding[] {
  return findings.filter((finding, index) => findings.findIndex((item) => item.packageName === finding.packageName && item.detail === finding.detail) === index)
}

function severityRank(severity: DependencyAuditFinding['severity']): number {
  return severity === 'critical' ? 2 : 1
}
