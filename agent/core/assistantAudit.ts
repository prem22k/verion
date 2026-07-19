import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AssistantAuditEntry, AssistantAuditEventKind, AssistantAuditLog } from './types'

const directoryName = '.verion'
const fileName = 'assistant-audit.json'
const entryLimit = 240

export type AssistantAuditInput = {
  kind: AssistantAuditEventKind
  status: AssistantAuditEntry['status']
  summary: string
  relatedIds?: string[]
}

/**
 * A local, product-safe operator trace. This is intentionally not a
 * diagnostic dump or a chat transcript. Callers provide only fixed,
 * user-safe summaries and record IDs.
 */
export async function appendAssistantAudit(projectRoot: string, input: AssistantAuditInput): Promise<AssistantAuditEntry> {
  const log = await readAssistantAudit(projectRoot)
  const now = new Date().toISOString()
  const entry: AssistantAuditEntry = {
    id: `audit:${randomUUID()}`,
    kind: input.kind,
    status: input.status,
    summary: safeSummary(input.summary),
    createdAt: now,
    ...(input.relatedIds?.length ? { relatedIds: input.relatedIds.filter(isSafeIdentifier).slice(0, 12) } : {})
  }
  await writeAssistantAudit(projectRoot, {
    ...log,
    updatedAt: now,
    entries: [...log.entries, entry].slice(-entryLimit)
  })
  return entry
}

export async function readAssistantAudit(projectRoot: string): Promise<AssistantAuditLog> {
  try {
    const parsed = JSON.parse(await readFile(assistantAuditPath(projectRoot), 'utf8')) as unknown
    const normalized = normalizeAudit(parsed)
    if (normalized && normalized.projectRoot === projectRoot) return normalized
  } catch {
    // A missing or invalid audit history never blocks local project work.
  }
  return emptyAudit(projectRoot)
}

export function assistantAuditPath(projectRoot: string): string {
  return join(projectRoot, directoryName, fileName)
}

async function writeAssistantAudit(projectRoot: string, log: AssistantAuditLog): Promise<void> {
  const directory = join(projectRoot, directoryName)
  await mkdir(directory, { recursive: true })
  const target = assistantAuditPath(projectRoot)
  const temporary = `${target}.tmp`
  await writeFile(temporary, `${JSON.stringify(log, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, target)
}

function emptyAudit(projectRoot: string): AssistantAuditLog {
  const now = new Date().toISOString()
  return { version: 1, projectRoot, createdAt: now, updatedAt: now, entries: [] }
}

function normalizeAudit(value: unknown): AssistantAuditLog | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<AssistantAuditLog>
  if (candidate.version !== 1 || typeof candidate.projectRoot !== 'string' || typeof candidate.createdAt !== 'string' || typeof candidate.updatedAt !== 'string' || !Array.isArray(candidate.entries) || candidate.entries.length > entryLimit) return undefined
  if (!candidate.entries.every(isSafeEntry)) return undefined
  return candidate as AssistantAuditLog
}

function isSafeEntry(value: unknown): value is AssistantAuditEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return typeof entry.id === 'string'
    && typeof entry.createdAt === 'string'
    && ['assistant_read', 'source_consent', 'assistant_refusal', 'assistant_provider_fallback', 'verification_requested', 'verification_result', 'repair_launch_approval', 'repair_launch_result', 'repair_proposal_prepared', 'repair_proposal_declined', 'repair_apply_approved', 'repair_apply_result', 'repair_verification_result', 'repair_rollback_result'].includes(String(entry.kind))
    && ['completed', 'declined', 'rejected', 'failed'].includes(String(entry.status))
    && typeof entry.summary === 'string'
    && entry.summary.length <= 240
    && !looksSensitive(entry.summary)
    && (entry.relatedIds === undefined || (Array.isArray(entry.relatedIds) && entry.relatedIds.length <= 12 && entry.relatedIds.every(isSafeIdentifier)))
}

function safeSummary(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim().slice(0, 240)
  if (!normalized || looksSensitive(normalized)) return 'A local Verion action was recorded.'
  return normalized
}

function isSafeIdentifier(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9:_-]{1,180}$/.test(value) && !looksSensitive(value)
}

function looksSensitive(value: string): boolean {
  return /(?:sk[-_]|AIza|or-)[A-Za-z0-9_-]{8,}|(?:api[ _-]?key|authorization|bearer|token|password|secret|cookie|session)\s*[:=]/i.test(value)
    || /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/i.test(value)
    || /(?:mongodb|postgres(?:ql)?|mysql):\/\//i.test(value)
}
