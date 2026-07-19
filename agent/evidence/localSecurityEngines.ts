import { spawn } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SecurityScope } from './securityScope'

const commandTimeoutMs = 150_000
const maximumOutputBytes = 8 * 1024 * 1024
const engineTempPrefix = 'verion-security-review-'

export type EngineFinding = {
  key: string
  severity: 'critical' | 'high'
  category: 'credential' | 'dependency' | 'application' | 'configuration'
  headline: string
  explanation: string
  suggestedAction: string
  file: string
  line: number
  source: 'secret_scan' | 'package_scan' | 'sast_scan' | 'iac_scan'
}

export type EngineReview = {
  status: 'completed' | 'unavailable' | 'failed'
  detail: string
  findings: EngineFinding[]
}

/**
 * A temporary, permission-restricted mirror gives third-party scanners exactly
 * the same project boundary Verion presents to the developer. In particular it
 * prevents a scanner from reading .env, public assets, node_modules, or build
 * output simply because it recursively walks the project root.
 */
export async function withSecurityScopeMirror<T>(scope: SecurityScope, action: (mirrorPath: string) => Promise<T>): Promise<T> {
  const mirrorPath = await mkdtemp(join(tmpdir(), engineTempPrefix))
  try {
    for (const file of scope.files) {
      const source = join(scope.projectRoot, ...file.path.split('/'))
      const target = join(mirrorPath, ...file.path.split('/'))
      await mkdir(dirname(target), { recursive: true })
      await copyFile(source, target)
    }
    return await action(mirrorPath)
  } finally {
    await rm(mirrorPath, { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function runSemgrepReview(mirrorPath: string): Promise<EngineReview> {
  const rulesPath = fileURLToPath(new URL('./security-rules.yml', import.meta.url))
  const settingsDirectory = await mkdtemp(join(tmpdir(), 'verion-semgrep-settings-'))
  try {
    const result = await runCommand('semgrep', [
      'scan', '--config', rulesPath, '--json', '--quiet', '--no-git-ignore',
      '--metrics=off', mirrorPath
    ], { SEMGREP_SETTINGS_FILE: join(settingsDirectory, 'settings.yml'), SEMGREP_SEND_METRICS: 'off' })
  if (result.status === 'unavailable') return unavailable('Code safety review is not ready on this machine yet.')
    if (result.status === 'failed') return { status: 'failed', findings: [], detail: 'The code safety engine did not return a usable review.' }
    const findings = parseSemgrep(result.output, mirrorPath)
    return {
      status: 'completed', findings,
      detail: findings.length ? `Reviewed code safety patterns and found ${findings.length} high-confidence concern${findings.length === 1 ? '' : 's'}.` : 'Reviewed code safety patterns across the local project.'
    }
  } finally {
    await rm(settingsDirectory, { recursive: true, force: true }).catch(() => undefined)
  }
}

export async function runGitleaksReview(mirrorPath: string): Promise<EngineReview> {
  const result = await runCommand('gitleaks', [
    'dir', '--no-banner', '--redact=100', '--report-format', 'json', '--report-path', '-',
    '--exit-code', '0', '--max-target-megabytes', '10', mirrorPath
  ])
  if (result.status === 'unavailable') return unavailable('Credential review is not ready on this machine yet.')
  if (result.status === 'failed') return { status: 'failed', findings: [], detail: 'The credential review did not return usable results.' }
  const findings = parseGitleaks(result.output, mirrorPath)
  return {
    status: 'completed', findings,
    detail: findings.length ? `Reviewed credentials and found ${findings.length} credential concern${findings.length === 1 ? '' : 's'}.` : 'Reviewed credentials without storing or displaying secret values.'
  }
}

export async function runTrivyConfigurationReview(mirrorPath: string): Promise<EngineReview> {
  const result = await runCommand('trivy', [
    'fs', '--scanners', 'misconfig', '--severity', 'HIGH,CRITICAL', '--format', 'json',
    '--quiet', '--exit-code', '0', '--skip-version-check', '--no-progress', mirrorPath
  ])
  if (result.status === 'unavailable') return unavailable('Deployment configuration review is not ready on this machine yet.')
  if (result.status === 'failed') return { status: 'failed', findings: [], detail: 'The deployment configuration review did not return usable results.' }
  const findings = parseTrivy(result.output, mirrorPath)
  return {
    status: 'completed', findings,
    detail: findings.length ? `Reviewed deployment configuration and found ${findings.length} concern${findings.length === 1 ? '' : 's'}.` : 'Reviewed deployment and infrastructure configuration.'
  }
}

export function parseSemgrep(value: string, mirrorPath: string): EngineFinding[] {
  const report = recordJson(value)
  const results = array(report.results)
  return results.flatMap((entry) => {
    const result = record(entry)
    const extra = record(result.extra)
    const location = record(result.start)
    const path = relativeFromMirror(text(result.path), mirrorPath)
    const checkId = text(result.check_id) ?? 'unsafe-code-path'
    const message = boundedText(text(extra.message), 'This code pattern needs a security review.')
    const line = positiveNumber(location.line) ?? 1
    if (!path) return []
    return [{
      key: `semgrep:${checkId}`,
      severity: 'high', category: 'application', source: 'sast_scan',
      headline: semgrepHeadline(checkId), explanation: message,
      suggestedAction: semgrepAction(checkId), file: path, line
    }]
  })
}

export function parseGitleaks(value: string, mirrorPath: string): EngineFinding[] {
  const report = json(value)
  const findings = Array.isArray(report) ? report : array(record(report).findings)
  return findings.flatMap((entry) => {
    const finding = record(entry)
    const path = relativeFromMirror(text(finding.File) ?? text(finding.file), mirrorPath)
    const rule = text(finding.RuleID) ?? text(finding.ruleID) ?? 'credential'
    const line = positiveNumber(finding.StartLine) ?? positiveNumber(finding.startLine) ?? 1
    if (!path || looksSyntheticSecret(path, rule, text(finding.Description))) return []
    return [{
      key: `gitleaks:${rule}`, severity: 'critical', category: 'credential', source: 'secret_scan',
      headline: 'Possible credential in project code',
      explanation: boundedText(text(finding.Description), 'A credential-shaped value appears in a file selected for this review.'),
      suggestedAction: 'Remove the value from source, rotate it with the affected provider, and load it only from protected runtime configuration.',
      file: path, line
    }]
  })
}

export function parseTrivy(value: string, mirrorPath: string): EngineFinding[] {
  const report = recordJson(value)
  return array(report.Results).flatMap((entry) => {
    const result = record(entry)
    const path = relativeFromMirror(text(result.Target), mirrorPath)
    if (!path) return []
    return array(result.Misconfigurations).flatMap((misconfiguration) => {
      const finding = record(misconfiguration)
      const severity = normalizedSeverity(text(finding.Severity))
      if (!severity) return []
      const cause = record(finding.CauseMetadata)
      return [{
        key: `trivy:${text(finding.ID) ?? 'configuration'}`,
        severity, category: 'configuration', source: 'iac_scan',
        headline: boundedText(text(finding.Title), 'Deployment configuration needs review.'),
        explanation: boundedText(text(finding.Message), 'A deployment or infrastructure setting needs review before release.'),
        suggestedAction: 'Apply the least-privilege configuration change, then verify the affected deployment path.',
        file: path, line: positiveNumber(cause.StartLine) ?? 1
      }]
    })
  })
}

async function runCommand(command: string, args: string[], environment: Record<string, string> = {}): Promise<{ status: 'completed' | 'unavailable' | 'failed'; output: string }> {
  return new Promise((resolveCommand) => {
    let output = ''
    let settled = false
    let timeout: NodeJS.Timeout | undefined
    const finish = (status: 'completed' | 'unavailable' | 'failed') => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      resolveCommand({ status, output })
    }
    let child
    try {
      child = spawn(command, args, {
        shell: false, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ...environment }
      })
    } catch {
      finish('unavailable')
      return
    }
    timeout = setTimeout(() => { child.kill(); finish('failed') }, commandTimeoutMs)
    const collect = (chunk: Buffer) => {
      if (output.length >= maximumOutputBytes) return
      output += chunk.toString('utf8').slice(0, maximumOutputBytes - output.length)
    }
    child.stdout.on('data', collect)
    // Tools sometimes send progress to stderr. It is deliberately not persisted,
    // but JSON-capable tools place their result on stdout.
    child.once('error', (error: NodeJS.ErrnoException) => finish(error.code === 'ENOENT' ? 'unavailable' : 'failed'))
    child.once('close', (code) => finish(code === 0 ? 'completed' : output.trim() ? 'completed' : 'failed'))
  })
}

function unavailable(detail: string): EngineReview {
  return { status: 'unavailable', findings: [], detail }
}

function relativeFromMirror(value: string | undefined, mirrorPath: string): string | undefined {
  if (!value) return undefined
  const relativePath = relative(mirrorPath, value)
  if (!relativePath || relativePath.startsWith('..') || basename(relativePath) === '.') return undefined
  return relativePath.split('\\').join('/')
}

function recordJson(value: string): Record<string, unknown> { return record(json(value)) }
function json(value: string): unknown { try { return JSON.parse(value) as unknown } catch { return undefined } }
function record(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : [] }
function text(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined }
function positiveNumber(value: unknown): number | undefined { return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined }
function boundedText(value: string | undefined, fallback: string): string { const normalized = value?.replace(/\s+/g, ' ').trim(); return normalized ? normalized.slice(0, 360) : fallback }
function normalizedSeverity(value: string | undefined): 'critical' | 'high' | undefined { return value?.toUpperCase() === 'CRITICAL' ? 'critical' : value?.toUpperCase() === 'HIGH' ? 'high' : undefined }

function semgrepHeadline(checkId: string): string {
  if (/sql|query|injection/i.test(checkId)) return 'Possible injection path needs review'
  if (/command|exec|shell/i.test(checkId)) return 'Untrusted command execution needs review'
  if (/xss|html/i.test(checkId)) return 'Untrusted HTML rendering needs review'
  if (/ssrf|request/i.test(checkId)) return 'Outbound request handling needs review'
  return 'Unsafe code path needs review'
}

function semgrepAction(checkId: string): string {
  if (/sql|query|injection/i.test(checkId)) return 'Use parameterized queries or a fixed allowlist. Do not interpolate request-controlled values into a query.'
  if (/command|exec|shell/i.test(checkId)) return 'Replace shell execution with a fixed operation or strict allowlist. Never pass request-controlled input to a shell.'
  if (/xss|html/i.test(checkId)) return 'Avoid raw HTML where possible. Otherwise sanitize untrusted content with a reviewed allowlist before rendering.'
  if (/ssrf|request/i.test(checkId)) return 'Validate destination URLs against an explicit allowlist and block private or link-local network ranges.'
  return 'Inspect this code path and make the smallest safe correction before verifying again.'
}

function looksSyntheticSecret(path: string, rule: string, description: string | undefined): boolean {
  const signal = `${path} ${rule} ${description ?? ''}`.toLowerCase()
  return /(?:fixture|example|mock|sample|test|spec)/.test(signal) && /(?:example|dummy|fake|placeholder|verion|123456)/.test(signal)
}
