import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { redactSourceText } from './assistantTools'
import type { ContextCapsule, ProjectMemory, ProjectVerificationResult, RepairBrief, SecurityFinding, StoredReleaseReport } from './types'

const maxFiles = 3
const maxEvidence = 4
const maxPlan = 4
const maxExcerptLines = 72
const maxText = 460

export type RepairBriefSource = { source: 'release_report' | 'security_finding'; id: string }

export class RepairBriefUnavailableError extends Error {
  constructor() {
    super('This repair needs a current, review-backed concern. Refresh the project view and try again.')
    this.name = 'RepairBriefUnavailableError'
  }
}

/**
 * Creates the one local repair contract used for copying, Codex, and native
 * proposals. It is intentionally rebuilt from current memory for every API
 * request, rather than accepting browser-provided issue text or file paths.
 */
export async function createRepairBrief(input: {
  projectRoot: string
  memory: ProjectMemory
  source: RepairBriefSource
  result?: Pick<ProjectVerificationResult, 'evidence' | 'capsule'>
}): Promise<RepairBrief> {
  const createdAt = new Date().toISOString()
  if (input.source.source === 'security_finding') {
    const finding = input.memory.securityFindings.find((item) => item.id === input.source.id && item.status !== 'resolved')
    if (!finding || (finding.severity !== 'critical' && finding.severity !== 'high')) throw new RepairBriefUnavailableError()
    return buildSecurityBrief(input.projectRoot, input.memory, finding, createdAt)
  }

  const report = input.memory.releaseReports[0]
  if (!report || report.id !== input.source.id || report.recommendation !== 'needs_attention') throw new RepairBriefUnavailableError()
  return buildReportBrief(input.projectRoot, input.memory, report, input.result?.capsule, createdAt)
}

export function repairPrompt(brief: RepairBrief): string {
  const fileLines = brief.affectedFiles.length
    ? brief.affectedFiles.map((file) => `- ${file.path}${lineLabel(file)} — ${file.reason}`).join('\n')
    : '- The review did not safely identify a source file. Inspect the reviewed application area first.'
  const contexts = brief.codeContext.length
    ? brief.codeContext.map((context) => `### ${context.path}:${context.startLine}-${context.endLine}\n\n\`\`\`\n${context.text}\n\`\`\``).join('\n\n')
    : '- No source excerpt is included. Inspect only the affected files above before proposing a change.'
  return [
    'Repair this one review-backed concern in a local application.',
    '',
    '## Issue',
    `${brief.title} (${brief.severity})`,
    brief.summary,
    '',
    '## Why it matters',
    brief.rootCause,
    ...brief.evidence.length ? ['', ...brief.evidence.map((item) => `- ${item}`)] : [],
    '',
    '## Affected files',
    fileLines,
    '',
    '## Relevant code context',
    contexts,
    '',
    '## Expected behavior',
    brief.expectedBehavior,
    '',
    '## Verify',
    ...brief.verificationPlan.map((item) => `- ${item}`),
    '',
    'Make the smallest safe repair. Show a diff, wait for the developer’s explicit approval before editing any file, and re-run only the stated checks after approval. Never expose or copy credentials.'
  ].join('\n')
}

/** The persisted Codex packet is just a rendered canonical repair brief. */
export function repairBriefPacket(brief: RepairBrief): string {
  return `# Verion Repair Brief\n\n${repairPrompt(brief)}\n`
}

function buildSecurityBrief(projectRoot: string, memory: ProjectMemory, finding: SecurityFinding, createdAt: string): Promise<RepairBrief> {
  const affected = finding.file ? [{ path: finding.file, ...(finding.startLine ? { startLine: finding.startLine } : {}), ...(finding.endLine ? { endLine: finding.endLine } : {}), reason: 'The latest saved security review connected this concern to this application area.' }] : []
  return finalizeBrief(projectRoot, memory, {
    id: briefId('security_finding', finding.id, finding.updatedAt),
    source: 'security_finding',
    issueId: finding.id,
    title: cleanCopy(finding.headline, 'Security concern needs attention.'),
    severity: finding.severity as 'critical' | 'high',
    summary: cleanCopy(finding.explanation, 'A saved security concern needs a review-backed repair.'),
    rootCause: cleanCopy(finding.explanation, 'The saved review found a concern in this application area.'),
    expectedBehavior: cleanCopy(finding.suggestedAction, 'The affected application area should be corrected without changing unrelated behavior.'),
    evidence: uniqueCopy([finding.explanation, finding.affectedArea ? `Affected area: ${finding.affectedArea}.` : '']).slice(0, maxEvidence),
    affectedFiles: affected,
    verificationPlan: securityPlan(memory, finding),
    createdAt
  })
}

function buildReportBrief(projectRoot: string, memory: ProjectMemory, report: StoredReleaseReport, capsule: ContextCapsule | undefined, createdAt: string): Promise<RepairBrief> {
  const affectedFiles = fromCapsule(capsule, memory, `${report.headline} ${report.rootCause}`)
  return finalizeBrief(projectRoot, memory, {
    id: briefId('release_report', report.id, report.completedAt),
    source: 'release_report',
    issueId: report.id,
    title: cleanCopy(report.headline, 'Release concern needs attention.'),
    severity: 'attention',
    summary: cleanCopy(report.rootCause, 'The current release review identified a concern.'),
    rootCause: cleanCopy(report.rootCause, 'The current release review identified a concern.'),
    expectedBehavior: cleanCopy(report.nextAction, 'The reviewed release path should work without this concern.'),
    evidence: uniqueCopy(report.reasons).slice(0, maxEvidence),
    affectedFiles,
    verificationPlan: reportPlan(report, memory),
    createdAt
  })
}

async function finalizeBrief(projectRoot: string, memory: ProjectMemory, base: Omit<RepairBrief, 'codeContext'>): Promise<RepairBrief> {
  const allowed = base.affectedFiles
    .filter((file) => isDiscoveredPath(memory, file.path))
    .slice(0, maxFiles)
  const contexts = await Promise.all(allowed.map((file) => readContext(projectRoot, file)))
  return {
    ...base,
    affectedFiles: allowed,
    codeContext: contexts.flatMap((context) => context ? [context] : [])
  }
}

function fromCapsule(capsule: ContextCapsule | undefined, memory: ProjectMemory, terms: string): RepairBrief['affectedFiles'] {
  const selected = (capsule?.relevantFiles ?? [])
    .filter((file) => isDiscoveredPath(memory, file.path))
    .slice(0, maxFiles)
    .map((file) => ({ path: file.path, reason: cleanCopy(file.reason, 'This file is relevant to the reviewed concern.') }))
  if (selected.length) return selected
  const tokens = terms.toLowerCase().match(/[a-z]{4,}/g) ?? []
  return memory.discovery.files
    .filter((path) => isSafePath(path) && tokens.some((token) => path.toLowerCase().includes(token)))
    .slice(0, maxFiles)
    .map((path) => ({ path, reason: 'This discovered file appears related to the current release concern.' }))
}

async function readContext(projectRoot: string, file: RepairBrief['affectedFiles'][number]): Promise<RepairBrief['codeContext'][number] | undefined> {
  if (!isSafePath(file.path)) return undefined
  const absolute = resolve(projectRoot, file.path)
  if (!insideRoot(projectRoot, absolute)) return undefined
  try {
    const source = await readFile(absolute, 'utf8')
    if (source.length > 80_000 || looksBinary(source)) return undefined
    const lines = source.split(/\r?\n/)
    const start = Math.max(1, Math.min(file.startLine ?? 1, Math.max(1, lines.length)))
    const begin = Math.max(0, start - 1)
    const selected = lines.slice(begin, begin + maxExcerptLines).join('\n')
    const text = redactSourceText(selected).slice(0, 12_000).trim()
    if (!text || looksSensitive(text)) return undefined
    return { path: file.path, startLine: begin + 1, endLine: Math.min(lines.length, begin + maxExcerptLines), text }
  } catch {
    return undefined
  }
}

function isDiscoveredPath(memory: ProjectMemory, path: string): boolean {
  return isSafePath(path) && memory.discovery.files.includes(path)
}

function isSafePath(value: string): boolean {
  const normalized = value.replace(/\\/g, '/')
  return Boolean(normalized && normalized.length <= 240 && !normalized.startsWith('/') && !normalized.includes('..') && !normalized.split('/').some((part) => part === '.verion' || part === 'node_modules' || /^\.env/i.test(part) || part === '.git') && !/[\0\r\n]/.test(normalized))
}

function insideRoot(root: string, target: string): boolean {
  const normalizedRoot = resolve(root)
  return target === normalizedRoot || target.startsWith(`${normalizedRoot}/`)
}

function reportPlan(report: StoredReleaseReport, memory: ProjectMemory): string[] {
  return uniqueCopy([
    report.nextAction,
    ...memory.understanding.criticalBusinessFlows.slice(0, 2).map((flow) => `Review the ${flow.label.toLowerCase()} path.`),
    'Run the smallest discovered project check, then let Verion review the saved change again.'
  ]).slice(0, maxPlan)
}

function securityPlan(memory: ProjectMemory, finding: SecurityFinding): string[] {
  return uniqueCopy([
    finding.suggestedAction,
    ...memory.understanding.criticalBusinessFlows.slice(0, 2).map((flow) => `Review the ${flow.label.toLowerCase()} path.`),
    'Run the smallest discovered project check, then let Verion review the saved change again.'
  ]).slice(0, maxPlan)
}

function cleanCopy(value: string | undefined, fallback: string): string {
  const result = redactSourceText(value ?? '')
    .replace(/https?:\/\/\S+/gi, 'the affected application')
    .replace(/\b(?:scanner|engine|producer|payload|raw log|Semgrep|Playwright|Gitleaks|Trivy|Nuclei|Snyk|OSV|CodeQL|OWASP)\b/gi, 'review')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxText)
  return result || fallback
}

function uniqueCopy(values: string[]): string[] {
  const seen = new Set<string>()
  return values.flatMap((value) => {
    const copy = cleanCopy(value, '')
    if (!copy || seen.has(copy.toLowerCase())) return []
    seen.add(copy.toLowerCase())
    return [copy]
  })
}

function looksBinary(value: string): boolean { return value.includes('\0') }
function looksSensitive(value: string): boolean { return /\[REDACTED|sensitive value removed|-----BEGIN/i.test(value) }
function briefId(source: string, id: string, updatedAt: string): string { return `repair-brief:${createHash('sha256').update(`${source}:${id}:${updatedAt}`).digest('hex').slice(0, 16)}` }
function lineLabel(file: { startLine?: number; endLine?: number }): string { return file.startLine ? `:${file.startLine}${file.endLine && file.endLine !== file.startLine ? `-${file.endLine}` : ''}` : '' }
