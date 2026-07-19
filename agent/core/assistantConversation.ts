import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { appendAssistantAudit } from './assistantAudit'
import { planAssistantQuestion, type SourceConsentRequest } from './assistantTools'
import { executeStructuredAI, getAIProviderStatus } from './runtimeConfig'
import type { AssistantCitation, AssistantConversation, AssistantMessage, AssistantToolCall, ProjectMemory } from './types'

const assistantConversationFileName = 'assistant-conversation.json'
const verionDirectoryName = '.verion'
const messageLimit = 80
const toolCallLimit = 160
const questionLimit = 1_200
const answerLimit = 1_800
const uncertaintyLimit = 320

export type AssistantConversationView = Pick<AssistantConversation, 'version' | 'id' | 'createdAt' | 'updatedAt' | 'messages'>

export type LocalAssistantContext = {
  project: { name: string; summary: string; productAreas: string[]; technologies: string[]; routeCount: number; apiCount: number }
  localMemory: { firstLearnedAt: string; lastLearnedAt: string; lastVerifiedAt?: string; knownJourneyCount: number; reviewCount: number }
  recentChanges: Array<{ id: string; label: string; description: string }>
  likelyImpact: Array<{ id: string; label: string }>
  currentStatus: { label: string; description: string }
  latestReview?: { id: string; outcome: 'ready_to_ship' | 'needs_attention' | 'inconclusive'; headline: string; rootCause: string; nextAction: string }
  deepSecurity: { status: 'not_configured' | 'reviewing' | 'completed' | 'concern' | 'partial' | 'unavailable'; label: string; description: string }
}

export type AssistantQuestionResult = {
  conversation: AssistantConversation
  sourceConsentRequired?: SourceConsentRequest
}

type ProviderAssistantAnswer = {
  basis: 'discovered_fact' | 'review_observation' | 'model_inference'
  answer: string
  citationIds: string[]
  uncertainty?: string
}

export async function readAssistantConversation(projectRoot: string): Promise<AssistantConversation> {
  try {
    const parsed = JSON.parse(await readFile(assistantConversationPath(projectRoot), 'utf8')) as unknown
    const conversation = normalizeConversation(parsed)
    if (conversation && conversation.projectRoot === projectRoot) return conversation
  } catch {
    // A missing or invalid conversation starts cleanly. It never affects project memory.
  }
  return emptyConversation(projectRoot)
}

/**
 * The Phase 4 teammate entry point. Verion selects bounded, read-only local
 * context first; a model may only explain that already-selected context.
 */
export async function answerAssistantQuestion(projectRoot: string, memory: ProjectMemory, question: string, sourceConsent?: boolean): Promise<AssistantQuestionResult> {
  const normalizedQuestion = normalizeQuestion(question)
  const providerStatus = await getAIProviderStatus(projectRoot)
  const plan = await planAssistantQuestion({ memory, question: normalizedQuestion, sourceConsent, providerAvailable: providerStatus.available })
  const existing = await readAssistantConversation(projectRoot)

  if (plan.sourceConsentRequired) {
    await appendAssistantAudit(projectRoot, { kind: 'assistant_read', status: 'completed', summary: 'Looked at related project files locally; code context needs approval for this question.' })
    return { conversation: existing, sourceConsentRequired: plan.sourceConsentRequired }
  }

  const auditIds: string[] = []
  if (sourceConsent === true) {
    const entry = await appendAssistantAudit(projectRoot, { kind: 'source_consent', status: 'completed', summary: 'Approved redacted local code context for one teammate question.' })
    auditIds.push(entry.id)
  } else if (sourceConsent === false) {
    const entry = await appendAssistantAudit(projectRoot, { kind: 'source_consent', status: 'declined', summary: 'Answered one teammate question without sending local code context.' })
    auditIds.push(entry.id)
  }

  if (plan.refusal) {
    const entry = await appendAssistantAudit(projectRoot, { kind: 'assistant_refusal', status: 'rejected', summary: 'Declined an unsafe local assistant request.' })
    auditIds.push(entry.id)
  } else {
    const entry = await appendAssistantAudit(projectRoot, { kind: 'assistant_read', status: 'completed', summary: plan.auditSummary })
    auditIds.push(entry.id)
  }

  let answer = plan.deterministicAnswer
  let citations = plan.citations
  if (!plan.refusal && providerStatus.available) {
    try {
      const modelAnswer = await executeStructuredAI<ProviderAssistantAnswer>(projectRoot, assistantStructuredRequest(plan.providerContext, plan.citations))
      const validated = normalizeProviderAnswer(modelAnswer.value, plan.citations)
      if (!validated) throw new Error('The selected model returned an unsafe or incomplete explanation.')
      answer = { content: validated.answer, basis: validated.basis, ...(validated.uncertainty ? { uncertainty: validated.uncertainty } : {}) }
      citations = validated.citations
    } catch {
      const entry = await appendAssistantAudit(projectRoot, { kind: 'assistant_provider_fallback', status: 'failed', summary: 'Used the local project answer because the selected model could not complete this explanation.' })
      auditIds.push(entry.id)
    }
  }

  const conversation = appendCompletedQuestion(existing, normalizedQuestion, answer, citations, plan.toolCalls, auditIds)
  await writeAssistantConversation(projectRoot, conversation)
  return { conversation }
}

/**
 * Compatibility bridge for existing local callers. New server requests use
 * answerAssistantQuestion so they can enforce source consent and the tool
 * boundary. The legacy context remains deterministic and never calls a model.
 */
export async function recordAssistantQuestion(projectRoot: string, context: LocalAssistantContext, question: string): Promise<AssistantConversation> {
  const normalizedQuestion = normalizeQuestion(question)
  const existing = await readAssistantConversation(projectRoot)
  const response = legacyLocalResponse(context, normalizedQuestion)
  const conversation = appendCompletedQuestion(existing, normalizedQuestion, { ...response, basis: response.basis }, response.citations, [], [])
  await writeAssistantConversation(projectRoot, conversation)
  return conversation
}

export async function clearAssistantConversation(projectRoot: string): Promise<AssistantConversation> {
  const conversation = emptyConversation(projectRoot)
  await writeAssistantConversation(projectRoot, conversation)
  return conversation
}

export function assistantConversationView(conversation: AssistantConversation): AssistantConversationView {
  return { version: conversation.version, id: conversation.id, createdAt: conversation.createdAt, updatedAt: conversation.updatedAt, messages: conversation.messages }
}

export function assistantConversationPath(projectRoot: string): string { return join(projectRoot, verionDirectoryName, assistantConversationFileName) }

function appendCompletedQuestion(existing: AssistantConversation, question: string, answer: { content: string; basis: 'discovered_fact' | 'review_observation' | 'model_inference'; uncertainty?: string }, citations: AssistantCitation[], toolCalls: AssistantToolCall[], auditIds: string[]): AssistantConversation {
  const now = new Date().toISOString()
  const developerMessage: AssistantMessage = { id: `developer:${randomUUID()}`, role: 'developer', content: question, createdAt: now, status: 'complete', citations: [], toolCallIds: [] }
  const verionMessage: AssistantMessage = {
    id: `verion:${randomUUID()}`,
    role: 'verion',
    content: answer.content,
    createdAt: new Date().toISOString(),
    status: 'complete',
    citations: citations.slice(0, 12),
    toolCallIds: toolCalls.map((call) => call.id),
    basis: answer.basis,
    ...(answer.uncertainty ? { uncertainty: answer.uncertainty } : {}),
    ...(auditIds.length ? { auditIds } : {})
  }
  return {
    ...existing,
    version: 2,
    updatedAt: verionMessage.createdAt,
    messages: [...existing.messages, developerMessage, verionMessage].slice(-messageLimit),
    toolCalls: [...existing.toolCalls, ...toolCalls].slice(-toolCallLimit)
  }
}

function assistantStructuredRequest(context: Record<string, unknown>, citations: AssistantCitation[]) {
  return {
    task: 'assistant_response' as const,
    instructions: 'You are Verion, a careful local release teammate. Explain only the supplied bounded local context. Do not ask for files, tools, commands, credentials, or more access. Do not quote source excerpts or produce code. Return concise plain language and cite only supplied citation ids. Set model_inference only when interpreting context; use discovered_fact or review_observation for direct facts.',
    input: {
      ...context,
      availableCitations: citations.slice(0, 12).map(({ id, label }) => ({ id, label }))
    },
    schemaName: 'verion_assistant_answer',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['basis', 'answer', 'citationIds'],
      properties: {
        basis: { type: 'string', enum: ['discovered_fact', 'review_observation', 'model_inference'] },
        answer: { type: 'string', maxLength: answerLimit },
        citationIds: { type: 'array', maxItems: 12, items: { type: 'string' } },
        uncertainty: { type: 'string', maxLength: uncertaintyLimit }
      }
    }
  }
}

function normalizeProviderAnswer(value: unknown, availableCitations: AssistantCitation[]): { basis: ProviderAssistantAnswer['basis']; answer: string; citations: AssistantCitation[]; uncertainty?: string } | undefined {
  if (!value || typeof value !== 'object') return undefined
  const answer = value as Partial<ProviderAssistantAnswer>
  if (answer.basis !== 'discovered_fact' && answer.basis !== 'review_observation' && answer.basis !== 'model_inference') return undefined
  if (typeof answer.answer !== 'string') return undefined
  const content = answer.answer.replace(/\s+/g, ' ').trim()
  if (!content || content.length > answerLimit || looksLikeCredential(content) || /```|(?:^|\s)(?:const|let|function|import)\s+/.test(content)) return undefined
  if (!Array.isArray(answer.citationIds) || answer.citationIds.length > 12 || !answer.citationIds.every((id) => typeof id === 'string')) return undefined
  const citations = answer.citationIds.map((id) => availableCitations.find((citation) => citation.id === id)).filter((citation): citation is AssistantCitation => Boolean(citation))
  if (citations.length !== new Set(answer.citationIds).size) return undefined
  const uncertainty = typeof answer.uncertainty === 'string' ? answer.uncertainty.replace(/\s+/g, ' ').trim().slice(0, uncertaintyLimit) : undefined
  if (uncertainty && (looksLikeCredential(uncertainty) || /```/.test(uncertainty))) return undefined
  return { basis: answer.basis, answer: content, citations, ...(uncertainty ? { uncertainty } : {}) }
}

function emptyConversation(projectRoot: string): AssistantConversation {
  const now = new Date().toISOString()
  return { version: 2, id: `conversation:${randomUUID()}`, projectRoot, createdAt: now, updatedAt: now, messages: [], toolCalls: [] }
}

async function writeAssistantConversation(projectRoot: string, conversation: AssistantConversation): Promise<void> {
  const directory = join(projectRoot, verionDirectoryName)
  await mkdir(directory, { recursive: true })
  const target = assistantConversationPath(projectRoot)
  const temporary = `${target}.tmp`
  await writeFile(temporary, `${JSON.stringify(conversation, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, target)
}

function normalizeQuestion(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) throw new Error('Ask Verion a question before sending.')
  if (normalized.length > questionLimit) throw new Error(`Keep questions under ${questionLimit} characters.`)
  if (looksLikeCredential(normalized)) throw new Error('Remove secret-like content before asking Verion. Credentials are never stored in this conversation.')
  return normalized
}

function legacyLocalResponse(context: LocalAssistantContext, question: string): { content: string; citations: AssistantCitation[]; basis: 'discovered_fact' | 'review_observation' } {
  const intent = question.toLowerCase()
  const projectCitation = citation('project_understanding', 'Project understanding')
  const memoryCitation = citation('project_memory', 'Local memory')
  const changeCitation = context.recentChanges[0] ? citation('change', 'Recent changes', context.recentChanges[0].id) : undefined
  const reviewCitation = context.latestReview ? citation('release_report', 'Latest review', context.latestReview.id) : undefined
  if (/what.*chang|change|latest (work|update)|recent (work|update)/.test(intent)) return { content: context.recentChanges[0] ? `Discovered fact: ${context.recentChanges[0].label} — ${context.recentChanges[0].description}` : 'Discovered fact: Verion has no current change group recorded yet.', citations: changeCitation ? [changeCitation, projectCitation] : [memoryCitation], basis: 'discovered_fact' }
  if (/security|vulnerab|block.*ship|ship.*block|codex|fix/.test(intent)) return { content: `Review observation: ${context.deepSecurity.description}`, citations: [citation('security_finding', 'Security review'), ...(reviewCitation ? [reviewCitation] : [])], basis: 'review_observation' }
  if (/memory|remember|learned|know about/.test(intent)) return { content: `Discovered fact: Verion first learned this project on ${formatDate(context.localMemory.firstLearnedAt)} and last refreshed it on ${formatDate(context.localMemory.lastLearnedAt)}.`, citations: [memoryCitation], basis: 'discovered_fact' }
  return { content: `Discovered fact: ${context.project.summary}`, citations: [projectCitation], basis: 'discovered_fact' }
}

function normalizeConversation(value: unknown): AssistantConversation | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<Omit<AssistantConversation, 'version'>> & { version?: unknown }
  if ((candidate.version !== 1 && candidate.version !== 2) || typeof candidate.id !== 'string' || typeof candidate.projectRoot !== 'string' || typeof candidate.createdAt !== 'string' || typeof candidate.updatedAt !== 'string' || !Array.isArray(candidate.messages) || !Array.isArray(candidate.toolCalls)) return undefined
  const messages = candidate.messages.filter(isSafeMessage)
  const toolCalls = candidate.toolCalls.filter(isSafeToolCall)
  if (messages.length !== candidate.messages.length || toolCalls.length !== candidate.toolCalls.length || messages.length > messageLimit || toolCalls.length > toolCallLimit) return undefined
  return { version: 2, id: candidate.id, projectRoot: candidate.projectRoot, createdAt: candidate.createdAt, updatedAt: candidate.updatedAt, messages, toolCalls }
}

function isSafeMessage(value: unknown): value is AssistantMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Record<string, unknown>
  if (typeof message.id !== 'string' || (message.role !== 'developer' && message.role !== 'verion') || typeof message.content !== 'string' || typeof message.createdAt !== 'string' || message.status !== 'complete' || !Array.isArray(message.toolCallIds) || !Array.isArray(message.citations)) return false
  if (message.content.length > answerLimit || looksLikeCredential(message.content) || /```/.test(message.content) || message.toolCallIds.length > 12 || !message.toolCallIds.every((id) => typeof id === 'string') || !message.citations.every(isSafeCitation)) return false
  return (message.basis === undefined || ['discovered_fact', 'review_observation', 'model_inference'].includes(String(message.basis)))
    && (message.uncertainty === undefined || (typeof message.uncertainty === 'string' && message.uncertainty.length <= uncertaintyLimit && !looksLikeCredential(message.uncertainty)))
    && (message.auditIds === undefined || (Array.isArray(message.auditIds) && message.auditIds.length <= 12 && message.auditIds.every((id) => typeof id === 'string' && /^audit:[a-zA-Z0-9-]+$/.test(id))))
}

function isSafeToolCall(value: unknown): value is AssistantToolCall {
  if (!value || typeof value !== 'object') return false
  const call = value as Record<string, unknown>
  return typeof call.id === 'string'
    && ['get_project_understanding', 'get_local_memory', 'get_current_changes', 'get_release_reports', 'get_security_findings', 'get_known_journeys', 'search_project', 'read_relevant_file', 'explain_project_relationship'].includes(String(call.tool))
    && typeof call.requestedAt === 'string'
    && (call.completedAt === undefined || typeof call.completedAt === 'string')
    && ['pending', 'completed', 'rejected', 'failed'].includes(String(call.status))
    && typeof call.inputSummary === 'string' && call.inputSummary.length <= 240 && !looksLikeCredential(call.inputSummary)
    && (call.outputSummary === undefined || (typeof call.outputSummary === 'string' && call.outputSummary.length <= 240 && !looksLikeCredential(call.outputSummary)))
    && Array.isArray(call.citationIds) && call.citationIds.length <= 12 && call.citationIds.every((id) => typeof id === 'string')
}

function isSafeCitation(value: unknown): value is AssistantCitation {
  if (!value || typeof value !== 'object') return false
  const citationValue = value as Record<string, unknown>
  if (!['project_understanding', 'project_memory', 'change', 'release_report', 'security_finding', 'source_file'].includes(String(citationValue.kind)) || typeof citationValue.id !== 'string' || typeof citationValue.label !== 'string' || citationValue.label.length > 180) return false
  if (citationValue.kind === 'source_file') return typeof citationValue.file === 'string' && citationValue.file.length <= 240 && !citationValue.file.includes('..') && !citationValue.file.startsWith('/') && (citationValue.startLine === undefined || typeof citationValue.startLine === 'number') && (citationValue.endLine === undefined || typeof citationValue.endLine === 'number')
  return citationValue.sourceId === undefined || typeof citationValue.sourceId === 'string'
}

function citation(kind: AssistantCitation['kind'], label: string, sourceId?: string): AssistantCitation { return { id: `${kind}:${sourceId ?? 'current'}`, kind, label, ...(sourceId ? { sourceId } : {}) } }
function formatDate(value: string): string { const date = new Date(value); return Number.isNaN(date.valueOf()) ? 'recently' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date) }
function looksLikeCredential(value: string): boolean { return /(?:^|\s)(?:sk[-_]|AIza|or-)[A-Za-z0-9_-]{8,}/.test(value) || /(?:api[ _-]?key|authorization|bearer|token|password|secret)\s*[:=]\s*\S+/i.test(value) || /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/i.test(value) }
