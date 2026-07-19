import { createHash, randomUUID } from 'node:crypto'
import { readFile, mkdir, rename, writeFile, lstat, realpath } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { spawn } from 'node:child_process'
import type { NativeRepairProposal, RepairBrief, RepairReplaceOperation } from './types'

const approvalPhrase = 'Apply this repair'
const sourceConsentPhrase = 'Prepare this repair'
const maxFiles = 3
const maxOperations = 6
const maxText = 6_000
const maxPlan = 4
const ledgerName = 'repair-ledger.json'
const ledgerLimit = 40
const allowlistedChecks = ['test', 'typecheck', 'lint', 'build'] as const

export { approvalPhrase as repairApplyConfirmation, sourceConsentPhrase as repairSourceConsentConfirmation }

export class RepairProposalError extends Error {
  constructor(message: string) { super(message); this.name = 'RepairProposalError' }
}

export type RepairProposalInput = {
  summary: string
  replacements: Array<{ path: string; original: string; replacement: string; summary: string }>
  verificationPlan: string[]
}

export type RepairProposalView = {
  id: string
  sourceId: string
  title: string
  summary: string
  status: NativeRepairProposal['status']
  files: Array<{ path: string; summary: string; diff: string }>
  verificationPlan: string[]
  outcome?: { label: string; description: string }
}

export type RepairLedgerEntry = {
  id: string
  briefId: string
  sourceId: string
  title: string
  status: NativeRepairProposal['status']
  createdAt: string
  updatedAt: string
  operations: RepairReplaceOperation[]
  allowedFiles: string[]
  verificationPlan: string[]
  approval?: 'declined' | 'approved'
  outcome?: { label: string; description: string }
  rollback?: 'not_needed' | 'completed' | 'failed'
  selectedCheck?: string
}

type RepairLedger = { version: 1; projectRoot: string; createdAt: string; updatedAt: string; entries: RepairLedgerEntry[] }

export const repairProposalSchema: Record<string, unknown> = {
  type: 'object', additionalProperties: false, required: ['summary', 'replacements', 'verificationPlan'], properties: {
    summary: { type: 'string', minLength: 1, maxLength: 400 },
    replacements: {
      type: 'array', minItems: 1, maxItems: maxOperations,
      items: { type: 'object', additionalProperties: false, required: ['path', 'original', 'replacement', 'summary'], properties: { path: { type: 'string', minLength: 1, maxLength: 240 }, original: { type: 'string', minLength: 1, maxLength: maxText }, replacement: { type: 'string', minLength: 1, maxLength: maxText }, summary: { type: 'string', minLength: 1, maxLength: 280 } } }
    },
    verificationPlan: { type: 'array', minItems: 1, maxItems: maxPlan, items: { type: 'string', minLength: 1, maxLength: 320 } }
  }
}

export function hasRepairSourceConsent(body: Record<string, unknown>): boolean {
  return Object.keys(body).length === 3 && typeof body.source === 'string' && typeof body.id === 'string' && body.confirmation === sourceConsentPhrase
}

export function hasRepairApplyApproval(body: Record<string, unknown>): boolean {
  return Object.keys(body).length === 2 && typeof body.proposalId === 'string' && body.confirmation === approvalPhrase
}

/** Local strict validation; provider JSON is never trusted as a patch. */
export function validateRepairProposal(value: unknown, brief: RepairBrief): NativeRepairProposal {
  if (!recordWithOnly(value, ['summary', 'replacements', 'verificationPlan'])) throw new RepairProposalError('The selected model returned an invalid repair proposal.')
  const source = value as Record<string, unknown>
  const summary = safeText(source.summary, 400)
  const plan = stringArray(source.verificationPlan, maxPlan, 320)
  if (!summary || !plan.length || !Array.isArray(source.replacements) || source.replacements.length < 1 || source.replacements.length > maxOperations) throw new RepairProposalError('The selected model did not provide a complete repair proposal.')
  const allowed = new Set(brief.affectedFiles.map((file) => file.path))
  const excerpts = new Map(brief.codeContext.map((context) => [context.path, context.text]))
  const operations = source.replacements.map((entry) => validateOperation(entry, allowed, excerpts))
  if (new Set(operations.map((item) => item.path)).size > maxFiles) throw new RepairProposalError('The proposal changes too many files.')
  assertNoOverlap(operations)
  return {
    id: `repair:${randomUUID()}`,
    briefId: brief.id,
    sourceId: brief.issueId,
    title: brief.title,
    summary,
    allowedFiles: [...allowed],
    operations,
    verificationPlan: plan,
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

function validateOperation(value: unknown, allowed: Set<string>, excerpts: Map<string, string>): RepairReplaceOperation {
  if (!recordWithOnly(value, ['path', 'original', 'replacement', 'summary'])) throw new RepairProposalError('The selected model returned an invalid file change.')
  const item = value as Record<string, unknown>
  const path = safePath(item.path)
  const original = safeCode(item.original)
  const replacement = safeCode(item.replacement)
  const summary = safeText(item.summary, 280)
  if (!path || !allowed.has(path) || !original || !replacement || !summary) throw new RepairProposalError('The proposal included an unsupported file change.')
  const excerpt = excerpts.get(path)
  if (!excerpt || !excerpt.includes(original)) throw new RepairProposalError('The proposal is not grounded in the approved source scope.')
  return { path, original, replacement, summary }
}

function assertNoOverlap(operations: RepairReplaceOperation[]) {
  const grouped = new Map<string, RepairReplaceOperation[]>()
  for (const operation of operations) grouped.set(operation.path, [...(grouped.get(operation.path) ?? []), operation])
  for (const items of grouped.values()) {
    const seen = new Set<string>()
    for (const item of items) {
      if (seen.has(item.original)) throw new RepairProposalError('The proposal has overlapping replacements.')
      seen.add(item.original)
    }
  }
}

export function repairProposalView(proposal: NativeRepairProposal, outcome?: RepairProposalView['outcome']): RepairProposalView {
  const files = [...new Map(proposal.operations.map((operation) => [operation.path, operation])).values()].map((operation) => ({
    path: operation.path,
    summary: operation.summary,
    diff: proposal.operations.filter((candidate) => candidate.path === operation.path).map(diffFor).join('\n\n')
  }))
  return { id: proposal.id, sourceId: proposal.sourceId, title: proposal.title, summary: proposal.summary, status: proposal.status, files, verificationPlan: proposal.verificationPlan, ...(outcome ? { outcome } : {}) }
}

function diffFor(operation: RepairReplaceOperation): string {
  return `@@ guarded replacement @@\n-${operation.original.split('\n').join('\n-')}\n+${operation.replacement.split('\n').join('\n+')}`
}

export async function applyRepairProposal(input: {
  projectRoot: string
  proposal: NativeRepairProposal
  confirmation: string
  write?: (path: string, content: string) => Promise<void>
}): Promise<{ proposal: NativeRepairProposal; rollback: 'not_needed' | 'completed' | 'failed' }> {
  return applyGuardedRepairProposal(input)
}

async function readSafeFile(projectRoot: string, path: string): Promise<string> {
  const absolute = await checkedAbsolutePath(projectRoot, path)
  const content = await readFile(absolute, 'utf8')
  if (content.length > 160_000 || content.includes('\0')) throw new RepairProposalError('One proposed file is not safe to change through Verion.')
  return content
}

function absolutePath(projectRoot: string, path: string): string {
  const safe = safePath(path)
  if (!safe) throw new RepairProposalError('The proposal includes an unsafe file path.')
  const root = resolve(projectRoot)
  const absolute = resolve(root, safe)
  if (!absolute.startsWith(`${root}/`)) throw new RepairProposalError('The proposal includes an unsafe file path.')
  return absolute
}

/** Reject a project-internal symlink that targets somewhere outside its root. */
async function checkedAbsolutePath(projectRoot: string, path: string): Promise<string> {
  const absolute = absolutePath(projectRoot, path)
  try {
    const metadata = await lstat(absolute)
    if (metadata.isSymbolicLink() || !metadata.isFile()) throw new RepairProposalError('One proposed file is not a regular project file.')
    const [root, target] = await Promise.all([realpath(projectRoot), realpath(absolute)])
    if (!target.startsWith(`${root}/`)) throw new RepairProposalError('The proposal includes a file outside the connected project.')
    return target
  } catch (error) {
    if (error instanceof RepairProposalError) throw error
    throw new RepairProposalError('One proposed file is no longer available. Prepare a new repair before applying it.')
  }
}

/** Applies guards in memory before any write. Kept separate for testability. */
export async function guardedWrites(projectRoot: string, operations: RepairReplaceOperation[], allowedFiles?: string[]): Promise<Map<string, string>> {
  assertNoOverlap(operations)
  const grouped = new Map<string, RepairReplaceOperation[]>()
  for (const operation of operations) grouped.set(operation.path, [...(grouped.get(operation.path) ?? []), operation])
  if (grouped.size < 1 || grouped.size > maxFiles) throw new RepairProposalError('The proposal is outside the approved repair scope.')
  if (allowedFiles && operations.some((operation) => !allowedFiles.includes(operation.path))) throw new RepairProposalError('The proposal includes a file outside the approved repair scope.')
  const next = new Map<string, string>()
  for (const [path, changes] of grouped) {
    let content = await readSafeFile(projectRoot, path)
    for (const change of changes) {
      const first = content.indexOf(change.original)
      if (first < 0 || content.indexOf(change.original, first + change.original.length) >= 0) throw new RepairProposalError('A proposed source snippet changed. Prepare a new repair before applying it.')
      content = `${content.slice(0, first)}${change.replacement}${content.slice(first + change.original.length)}`
    }
    next.set(path, content)
  }
  return next
}

// Replace the guarded preparation hook with the fully checked async branch.
export async function applyGuardedRepairProposal(input: {
  projectRoot: string
  proposal: NativeRepairProposal
  confirmation: string
  write?: (path: string, content: string) => Promise<void>
}): Promise<{ proposal: NativeRepairProposal; rollback: 'not_needed' | 'completed' | 'failed' }> {
  if (input.confirmation !== approvalPhrase) throw new RepairProposalError(`Confirm “${approvalPhrase}” before Verion changes files.`)
  const prepared = await guardedWrites(input.projectRoot, input.proposal.operations, input.proposal.allowedFiles)
  const backups = new Map<string, string>()
  for (const [path] of prepared) backups.set(path, await readSafeFile(input.projectRoot, path))
  const writes = input.write ?? ((path: string, content: string) => writeFile(path, content, 'utf8'))
  const written: string[] = []
  try {
    for (const [relative, contents] of prepared) { await writes(await checkedAbsolutePath(input.projectRoot, relative), contents); written.push(relative) }
    return { proposal: { ...input.proposal, status: 'applying', updatedAt: new Date().toISOString() }, rollback: 'not_needed' }
  } catch {
    let restored = true
    for (const relative of written.reverse()) { try { await writes(await checkedAbsolutePath(input.projectRoot, relative), backups.get(relative) ?? '') } catch { restored = false } }
    throw new RepairProposalError(restored ? 'Verion restored the partial repair after a file could not be written. Inspect the proposed diff and prepare again.' : 'Verion could not complete a repair and could not restore every changed file. Inspect the affected files before continuing.')
  }
}

export function selectAllowlistedCheck(scripts: Record<string, string> | undefined): string | undefined {
  if (!scripts) return undefined
  return allowlistedChecks.find((name) => typeof scripts[name] === 'string' && scripts[name].trim().length > 0)
}

export async function runAllowlistedCheck(projectRoot: string, packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun', script: string | undefined): Promise<{ script?: string; status: 'not_available' | 'passed' | 'failed' }> {
  if (!script || !(allowlistedChecks as readonly string[]).includes(script)) return { status: 'not_available' }
  const args = packageManager === 'npm' ? ['run', script] : ['run', script]
  const success = await new Promise<boolean>((finish) => {
    let settled = false
    const done = (value: boolean) => { if (!settled) { settled = true; finish(value) } }
    try {
      const child = spawn(packageManager, args, { cwd: projectRoot, stdio: 'ignore', shell: false })
      const timer = setTimeout(() => { child.kill('SIGTERM'); done(false) }, 90_000)
      child.once('error', () => { clearTimeout(timer); done(false) })
      child.once('exit', (code) => { clearTimeout(timer); done(code === 0) })
    } catch { done(false) }
  })
  return { script, status: success ? 'passed' : 'failed' }
}

export async function readRepairLedger(projectRoot: string): Promise<RepairLedger> {
  try {
    const parsed = JSON.parse(await readFile(ledgerPath(projectRoot), 'utf8')) as unknown
    if (isLedger(parsed, projectRoot)) return parsed
  } catch { /* absent or invalid ledger starts empty */ }
  const now = new Date().toISOString()
  return { version: 1, projectRoot, createdAt: now, updatedAt: now, entries: [] }
}

export async function recordRepairLedger(projectRoot: string, proposal: NativeRepairProposal, input: Partial<Pick<RepairLedgerEntry, 'approval' | 'outcome' | 'rollback' | 'selectedCheck'>> = {}): Promise<void> {
  const ledger = await readRepairLedger(projectRoot)
  const now = new Date().toISOString()
  const entry: RepairLedgerEntry = {
    id: proposal.id, briefId: proposal.briefId, sourceId: proposal.sourceId, title: safeText(proposal.title, 280) ?? 'Repair proposal', status: proposal.status,
    createdAt: proposal.createdAt, updatedAt: proposal.updatedAt, operations: proposal.operations.map((operation) => ({ ...operation })), allowedFiles: proposal.allowedFiles, verificationPlan: proposal.verificationPlan,
    ...input
  }
  const next = { ...ledger, updatedAt: now, entries: [entry, ...ledger.entries.filter((candidate) => candidate.id !== entry.id)].slice(0, ledgerLimit) }
  const directory = join(projectRoot, '.verion')
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const target = ledgerPath(projectRoot)
  const temporary = `${target}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, target)
}

function ledgerPath(projectRoot: string): string { return join(projectRoot, '.verion', ledgerName) }
function isLedger(value: unknown, projectRoot: string): value is RepairLedger { return Boolean(value && typeof value === 'object' && (value as RepairLedger).version === 1 && (value as RepairLedger).projectRoot === projectRoot && Array.isArray((value as RepairLedger).entries)) }
function recordWithOnly(value: unknown, keys: string[]): boolean { return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).every((key) => keys.includes(key)) && keys.every((key) => key in (value as object))) }
function safeText(value: unknown, limit: number): string | undefined { return typeof value === 'string' && value.trim() && value.length <= limit && !looksSensitive(value) ? value.trim() : undefined }
function safeCode(value: unknown): string | undefined { return typeof value === 'string' && value.length > 0 && value.length <= maxText && !looksSensitive(value) && !value.includes('\0') ? value : undefined }
function safePath(value: unknown): string | undefined { return typeof value === 'string' && value.length <= 240 && !value.startsWith('/') && !value.includes('..') && !value.split(/[\\/]/).some((part) => part === '.verion' || part === 'node_modules' || /^\.env/i.test(part) || part === '.git') && /^[A-Za-z0-9_./@-]+$/.test(value) ? value.replace(/\\/g, '/') : undefined }
function stringArray(value: unknown, limit: number, itemLimit: number): string[] { return Array.isArray(value) && value.length > 0 && value.length <= limit ? value.map((item) => safeText(item, itemLimit)).filter((item): item is string => Boolean(item)) : [] }
function looksSensitive(value: string): boolean { return /(?:sk|AIza|or)-[A-Za-z0-9_-]{8,}|sk_(?:live|test|proj)_[A-Za-z0-9_-]{4,}|(?:api[ _-]?key|authorization|bearer|token|password|secret)\s*[:=]|-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----|(?:mongodb|postgres(?:ql)?|mysql):\/\//i.test(value) }
export function repairProposalFingerprint(proposal: NativeRepairProposal): string { return createHash('sha256').update(`${proposal.id}:${proposal.briefId}:${proposal.updatedAt}`).digest('hex').slice(0, 16) }
