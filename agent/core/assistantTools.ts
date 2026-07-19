import { randomUUID } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { resolveProjectFile } from './projectDiscovery'
import { publicSecurityFindings } from './securityFindings'
import type { AssistantCitation, AssistantToolCall, ProjectMemory, StoredReleaseReport } from './types'

const maxSearchMatches = 12
const maxSourceFiles = 3
const maxFileBytes = 32 * 1024
const maxLinesPerFile = 120
const maxCharactersPerFile = 2_400
const totalContextBudget = 12_000
const sourceExtensions = new Set(['.cjs', '.cts', '.css', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.mts', '.prisma', '.ts', '.tsx', '.yml', '.yaml'])

export type AssistantIntent = 'project' | 'ship' | 'changes' | 'affected' | 'vulnerability' | 'files' | 'prepare_repair' | 'memory' | 'general'

export type SourceConsentRequest = {
  fileCount: number
  excerptCount: number
}

export type LocalAssistantPlan = {
  intent: AssistantIntent
  citations: AssistantCitation[]
  toolCalls: AssistantToolCall[]
  deterministicAnswer: { content: string; basis: 'discovered_fact' | 'review_observation' | 'model_inference'; uncertainty?: string }
  providerContext: Record<string, unknown>
  sourceConsentRequired?: SourceConsentRequest
  refusal?: string
  auditSummary: string
}

/**
 * Builds the smallest possible local context for a single question. It does
 * not execute shell commands, walk arbitrary paths, or expose project source
 * unless the caller has already recorded one-question permission.
 */
export async function planAssistantQuestion(input: {
  memory: ProjectMemory
  question: string
  sourceConsent?: boolean
  providerAvailable: boolean
}): Promise<LocalAssistantPlan> {
  const { memory, question, sourceConsent, providerAvailable } = input
  const intent = classifyAssistantIntent(question)
  const base = basePlan(memory, intent, question)
  const pathRefusal = unsafeRequestedPath(question, memory.discovery.files)
  if (pathRefusal) {
    return refusalPlan(intent, pathRefusal)
  }
  if (looksLikeShellRequest(question)) {
    return refusalPlan(intent, 'Verion can explain the project, but it cannot run commands or inspect the machine for this question.')
  }

  const sourceNeeded = needsSource(intent, question)
  if (!sourceNeeded) return base

  const matches = searchDiscoveredFiles(memory, question)
  const searchCall = toolCall('search_project', 'Related project files', `${matches.length} discovered file${matches.length === 1 ? '' : 's'} matched this question.`, matches.map((file) => sourceCitation(file).id))
  const withSearch = appendTool(base, searchCall, { relatedFiles: matches })
  const relationship = explainRelationships(memory, matches)
  const withRelationships = relationship
    ? appendTool(withSearch, toolCall('explain_project_relationship', 'Related project files', relationship, matches.slice(0, 3).map((file) => sourceCitation(file).id)), { relationships: [relationship] })
    : withSearch

  if (!providerAvailable) {
    return {
      ...withRelationships,
      citations: uniqueCitations([...withRelationships.citations, ...matches.slice(0, 3).map((file) => sourceCitation(file))]),
      deterministicAnswer: filesAnswer(memory, matches, false),
      auditSummary: 'Looked at related project files locally.'
    }
  }
  if (sourceConsent === undefined) {
    return {
      ...withRelationships,
      sourceConsentRequired: { fileCount: Math.min(matches.length, maxSourceFiles), excerptCount: Math.min(matches.length, maxSourceFiles) },
      auditSummary: 'Planned related local code context; waiting for this question’s permission.'
    }
  }

  if (sourceConsent === false) {
    return {
      ...withRelationships,
      citations: uniqueCitations([...withRelationships.citations, ...matches.slice(0, 3).map((file) => sourceCitation(file))]),
      deterministicAnswer: filesAnswer(memory, matches, false),
      auditSummary: 'Looked at related project files locally without sending code context.'
    }
  }

  const source = await readRelevantFiles(memory, matches)
  const sourceCall = toolCall('read_relevant_file', 'Related code context', source.citations.length ? `Read redacted excerpts from ${source.citations.length} discovered file${source.citations.length === 1 ? '' : 's'}.` : 'No permitted source excerpt was available.', source.citations.map((citation) => citation.id))
  const plan = appendTool(withRelationships, sourceCall, { sourceExcerpts: source.excerpts, sourceAvailable: source.citations.length > 0 })
  return {
    ...plan,
    citations: uniqueCitations([...plan.citations, ...source.citations]),
    deterministicAnswer: source.citations.length ? filesAnswer(memory, source.citations.map((citation) => citation.file!).filter(Boolean), true) : { content: 'Discovered fact: Verion found related project files, but their local excerpts were unavailable after the safety limits. Ask a narrower question or use the file citations to inspect them yourself.', basis: 'discovered_fact', uncertainty: 'No source excerpt was sent for this answer.' },
    auditSummary: source.citations.length ? 'Looked at related project files and redacted local code context.' : 'Looked for related project files; no permitted code context was available.'
  }
}

export function classifyAssistantIntent(question: string): AssistantIntent {
  const value = question.toLowerCase()
  if (/prepare.*(?:codex|repair)|codex.*prepare|fix with (?:codex|verion)|repair (?:brief|proposal)/.test(value)) return 'prepare_repair'
  if (/why.*(?:shouldn.t|should not).*ship|should.*ship|ship.*(?:block|safe)|release blocker/.test(value)) return 'ship'
  if (/what.*changed|changed.*(?:last|review)|recent (?:work|update)|latest (?:work|update)/.test(value)) return 'changes'
  if (/what.*(?:affected|impact)|parts?.*(?:affected|impact)|impact.*app/.test(value)) return 'affected'
  if (/vulnerab|security (?:issue|finding|concern)|explain.*(?:security|risk)/.test(value)) return 'vulnerability'
  if (/which files?|what files?|related files?|causing this|source|code context|show .*file|(?:^|\s)[\w@.-]+\/[\w@./-]+\.(?:[cm]?[jt]sx?|json|prisma|css|html|md)(?:$|\s)/.test(value)) return 'files'
  if (/remember|memory|learned|know about/.test(value)) return 'memory'
  if (/what (?:does|is).*project|project.*(?:do|about|purpose)|what do(?:es)? this/.test(value)) return 'project'
  return 'general'
}

export function redactSourceText(value: string): string {
  return value
    .replace(/-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z]+)? PRIVATE KEY-----/gi, '[REDACTED PRIVATE KEY]')
    .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, '[REDACTED CLOUD KEY]')
    .replace(/(?:sk[-_]|AIza|or-)[A-Za-z0-9_-]{8,}/g, '[REDACTED TOKEN]')
    .replace(/\b(?:Bearer\s+)[A-Za-z0-9._~+\/-]{8,}\b/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/[^\s'"`]+/gi, '[REDACTED CONNECTION STRING]')
    .replace(/\b(?:session(?:id)?|cookie|password|passwd|secret|client_secret|access_token|refresh_token|api[_-]?key|authorization)\s*([:=])\s*(['"]?)(?:[^\s'"`,;)}]+)\2/gi, (_match, separator: string) => `sensitive_value ${separator} [REDACTED]`)
    .replace(/(^|\n)\s*[A-Z][A-Z0-9_]{2,}\s*=\s*[^\n]+/g, '$1[REDACTED ENVIRONMENT VALUE]')
}

function basePlan(memory: ProjectMemory, intent: AssistantIntent, question: string): LocalAssistantPlan {
  const citations: AssistantCitation[] = []
  const calls: AssistantToolCall[] = []
  const add = (tool: AssistantToolCall['tool'], summary: string, citation: AssistantCitation) => {
    citations.push(citation)
    calls.push(toolCall(tool, citation.label, summary, [citation.id]))
  }
  const projectCitation = citation('project_understanding', 'Project understanding')
  const memoryCitation = citation('project_memory', 'Local memory')
  const changes = currentChange(memory)
  const changeCitation = changes ? citation('change', 'Latest change', changeId(changes)) : undefined
  const latest = memory.releaseReports[0]
  const reportCitation = latest ? citation('release_report', 'Latest review', latest.id) : undefined
  const currentSecurityFinding = securityFindingForQuestion(memory, question)
  const securityCitation = currentSecurityFinding
    ? citation('security_finding', currentSecurityFinding.headline, currentSecurityFinding.id)
    : citation('security_finding', 'Security review')
  const journeyCitation = citation('project_memory', 'Important journeys', 'journeys')

  if (intent === 'project' || intent === 'general') add('get_project_understanding', 'Used the current project understanding.', projectCitation)
  if (intent === 'memory') add('get_local_memory', 'Used local memory facts and review dates.', memoryCitation)
  if (intent === 'changes' || intent === 'affected') {
    if (changeCitation) add('get_current_changes', 'Used the latest local change and likely impact.', changeCitation)
    else add('get_current_changes', 'Checked the local comparison state.', memoryCitation)
  }
  if (intent === 'ship' || intent === 'prepare_repair') {
    if (reportCitation) add('get_release_reports', 'Used the latest release decision.', reportCitation)
    else add('get_release_reports', 'Checked for a saved release decision.', memoryCitation)
  }
  if (intent === 'vulnerability') add('get_security_findings', 'Used the saved security review state.', securityCitation)
  if (intent === 'prepare_repair' && currentSecurityFinding) add('get_security_findings', 'Used the selected saved security finding.', securityCitation)
  if (intent === 'affected') add('get_known_journeys', 'Used important remembered journeys.', journeyCitation)

  const response = deterministicAnswer(memory, intent, question)
  return {
    intent,
    citations: uniqueCitations(citations.length ? citations : [projectCitation, memoryCitation]),
    toolCalls: calls,
    deterministicAnswer: response,
    providerContext: compactMetadata(memory, intent, question),
    auditSummary: calls.length ? calls.map((call) => call.outputSummary).filter(Boolean).join(' ') : 'Used the local project picture.'
  }
}

function deterministicAnswer(memory: ProjectMemory, intent: AssistantIntent, question = ''): LocalAssistantPlan['deterministicAnswer'] {
  const understanding = memory.understanding
  const latest = memory.releaseReports[0]
  const change = currentChange(memory)
  const areas = likelyImpact(memory)
  const projectSummary = understanding.model?.thesis ?? understanding.summary
  if (intent === 'project') return { content: `Discovered fact: ${projectSummary}`, basis: 'discovered_fact' }
  if (intent === 'ship') {
    if (latest?.recommendation === 'needs_attention') return { content: `Review observation: ${latest.headline} ${latest.rootCause} Next safe step: ${latest.nextAction}`, basis: 'review_observation' }
    if (latest) return { content: `Review observation: The latest decision is ${releaseLabel(latest)}. ${latest.nextAction}`, basis: 'review_observation', uncertainty: 'This reflects the last saved review; verify again after a new change.' }
    return { content: 'Review observation: Verion has no completed release review yet, so it cannot say this is ready to ship. Start a review to create the first decision.', basis: 'review_observation' }
  }
  if (intent === 'changes') {
    if (!change) return { content: 'Discovered fact: Verion has not recorded a current change since the last saved comparison. The first review will establish a comparison point.', basis: 'discovered_fact' }
    return { content: `Discovered fact: ${change.label}. ${change.description}${areas.length ? ` Likely impact: ${plainList(areas.map((item) => item.label))}.` : ''}`, basis: 'discovered_fact' }
  }
  if (intent === 'affected') {
    if (areas.length) return { content: `Discovered fact: The latest local change is most likely to affect ${plainList(areas.map((item) => item.label))}.${memory.knownUserJourneys.length ? ` Important journeys include ${plainList(memory.knownUserJourneys.slice(0, 3).map((journey) => journey.label))}.` : ''}`, basis: 'discovered_fact' }
    return { content: 'Discovered fact: Verion has not mapped the current change to a specific application area yet. A review will connect the change to the paths people rely on.', basis: 'discovered_fact' }
  }
  if (intent === 'vulnerability') {
    const finding = securityFindingForQuestion(memory, question)
    if (finding) {
      const location = finding.file ? ` The review connected it to ${finding.file}${finding.startLine ? ` near line ${finding.startLine}` : ''}.` : ''
      return { content: `Review observation: ${finding.headline}. ${finding.explanation} Next safe step: ${finding.suggestedAction}${location}`, basis: 'review_observation' }
    }
    if (latest?.recommendation === 'needs_attention') return { content: `Review observation: ${latest.headline}. ${latest.rootCause} ${latest.nextAction}`, basis: 'review_observation' }
    return { content: 'Review observation: No saved critical security concern is available to explain. That is not a claim that the project is secure; run Deep Security Review when this release needs that check.', basis: 'review_observation' }
  }
  if (intent === 'prepare_repair') {
    const finding = securityFindingForQuestion(memory, question)
    if (finding) return { content: `Review observation: A safe repair proposal for “${finding.headline}” should stay within ${finding.file ? finding.file : 'the affected application area'}, address ${finding.suggestedAction.toLowerCase()} and preserve the reviewed product paths. Verion will not edit files from this answer; review the proposed diff and verify the saved change before shipping.`, basis: 'review_observation' }
    if (!latest || latest.recommendation !== 'needs_attention') return { content: 'Review observation: There is no current review-backed repair to prepare. Complete a review that identifies a release concern first; Verion will not open Codex from this answer.', basis: 'review_observation' }
    return { content: `Review observation: A repair brief can focus on “${latest.headline}”. It should cover the saved observation, the smallest affected area, and ${latest.nextAction.toLowerCase()} This answer only prepares guidance; opening Codex remains a separate confirmed action.`, basis: 'review_observation' }
  }
  if (intent === 'memory') return { content: `Discovered fact: Verion first learned this project on ${displayDate(memory.profile.firstLearnedAt)} and last refreshed it on ${displayDate(memory.profile.lastLearnedAt)}. It remembers ${memory.knownUserJourneys.length} important journey${memory.knownUserJourneys.length === 1 ? '' : 's'} and ${memory.verificationHistory.length} review${memory.verificationHistory.length === 1 ? '' : 's'}.`, basis: 'discovered_fact' }
  return { content: `Discovered fact: ${projectSummary} Ask about what changed, what is affected, why not to ship, a saved security concern, related files, or a repair brief.`, basis: 'discovered_fact' }
}

function filesAnswer(memory: ProjectMemory, files: string[], includedSource: boolean): LocalAssistantPlan['deterministicAnswer'] {
  if (!files.length) return { content: 'Discovered fact: Verion could not connect this question to a discovered project file. Ask about a product area or a narrower piece of the application.', basis: 'discovered_fact' }
  const relationships = explainRelationships(memory, files)
  const sourceCopy = includedSource ? ' Verion used redacted excerpts only for this answer.' : ''
  return { content: `Discovered fact: The most related discovered files are ${plainList(files.slice(0, 3).map((file) => basename(file)))}.${relationships ? ` ${relationships}` : ''}${sourceCopy}`, basis: 'discovered_fact', uncertainty: includedSource ? undefined : 'No source excerpt was sent for this answer.' }
}

function compactMetadata(memory: ProjectMemory, intent: AssistantIntent, question: string): Record<string, unknown> {
  const latest = memory.releaseReports[0]
  const change = currentChange(memory)
  const input = {
    intent,
    question,
    project: {
      summary: memory.understanding.model?.thesis ?? memory.understanding.summary,
      technologies: memory.understanding.technologies.slice(0, 6).map((item) => item.label),
      areas: memory.understanding.productAreas.slice(0, 4),
      routeCount: memory.understanding.routeCount,
      apiCount: memory.understanding.apiCount
    },
    ...(change ? { currentChange: { label: change.label, description: change.description, likelyImpact: likelyImpact(memory).slice(0, 3).map((item) => item.label) } } : {}),
    ...(latest ? { latestReview: { id: latest.id, outcome: latest.recommendation, headline: latest.headline, rootCause: latest.rootCause, nextAction: latest.nextAction } } : {}),
    ...((intent === 'vulnerability' || intent === 'prepare_repair') ? { securityFindings: publicSecurityFindings(memory.securityFindings).slice(0, 3).map((finding) => ({ id: finding.id, severity: finding.severity, headline: finding.headline, explanation: finding.explanation, suggestedAction: finding.suggestedAction, ...(finding.file ? { file: finding.file } : {}), ...(finding.startLine ? { startLine: finding.startLine } : {}) })) } : {}),
    journeys: memory.knownUserJourneys.slice(0, 6).map((journey) => journey.label)
  }
  return truncateContext(input)
}

function securityFindingForQuestion(memory: ProjectMemory, question: string) {
  const findings = publicSecurityFindings(memory.securityFindings)
  const normalizedQuestion = question.toLowerCase()
  return findings.find((finding) => normalizedQuestion.includes(finding.headline.toLowerCase())) ?? findings[0]
}

function searchDiscoveredFiles(memory: ProjectMemory, question: string): string[] {
  const keywords = keywordSet(question)
  const candidates = memory.discovery.files
    .filter((file) => isAllowedDiscoveredPath(file))
    .map((file) => ({ file, score: relevance(file, keywords) + relationshipRelevance(memory, file, keywords) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.file.localeCompare(right.file))
    .slice(0, maxSearchMatches)
    .map((candidate) => candidate.file)
  if (candidates.length) return candidates
  return memory.discovery.routes.map((route) => route.file).filter(isAllowedDiscoveredPath).slice(0, maxSearchMatches)
}

async function readRelevantFiles(memory: ProjectMemory, candidates: string[]): Promise<{ excerpts: Array<{ file: string; startLine: number; endLine: number; text: string }>; citations: AssistantCitation[] }> {
  const excerpts: Array<{ file: string; startLine: number; endLine: number; text: string }> = []
  const citations: AssistantCitation[] = []
  for (const file of candidates.slice(0, maxSourceFiles)) {
    if (!isAllowedDiscoveredPath(file) || !memory.discovery.files.includes(file)) continue
    try {
      const absolute = resolveProjectFile(memory.discovery.projectRoot, file)
      const metadata = await stat(absolute)
      if (!metadata.isFile() || metadata.size > maxFileBytes) continue
      const source = await readFile(absolute, 'utf8')
      if (source.includes('\u0000')) continue
      const redacted = redactSourceText(source)
      const lines = redacted.split(/\r?\n/).slice(0, maxLinesPerFile)
      const clipped = lines.join('\n').slice(0, maxCharactersPerFile)
      if (!clipped.trim()) continue
      const endLine = Math.max(1, clipped.split(/\r?\n/).length)
      excerpts.push({ file, startLine: 1, endLine, text: clipped })
      citations.push(sourceCitation(file, 1, endLine))
    } catch {
      // Per-file failures are a bounded local limitation, never a broad fallback read.
    }
  }
  return { excerpts, citations }
}

function explainRelationships(memory: ProjectMemory, files: string[]): string | undefined {
  const selected = new Set(files.slice(0, 3).map((file) => `file:${file}`))
  const relation = memory.graph.edges.find((edge) => selected.has(edge.from) && selected.has(edge.to) && edge.kind === 'imports')
  if (!relation) return undefined
  const from = relation.from.replace(/^file:/, '')
  const to = relation.to.replace(/^file:/, '')
  return `${basename(from)} imports ${basename(to)}.`
}

function relationshipRelevance(memory: ProjectMemory, file: string, keywords: Set<string>): number {
  const node = `file:${file}`
  const related = memory.graph.edges.filter((edge) => edge.from === node || edge.to === node).slice(0, 8)
  return related.reduce((score, edge) => score + (keywords.has(basename(edge.from).toLowerCase()) || keywords.has(basename(edge.to).toLowerCase()) ? 2 : 0), 0)
}

function relevance(file: string, keywords: Set<string>): number {
  const parts = file.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  return parts.reduce((score, part) => score + (keywords.has(part) ? 4 : 0), 0) + (keywords.has(extname(file).slice(1)) ? 1 : 0)
}

function keywordSet(question: string): Set<string> {
  const ignored = new Set(['what', 'which', 'where', 'with', 'that', 'this', 'from', 'about', 'would', 'could', 'should', 'files', 'file', 'code', 'source', 'project', 'please', 'show', 'explain'])
  return new Set(question.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !ignored.has(word)).slice(0, 16))
}

function unsafeRequestedPath(question: string, discoveredFiles: string[]): string | undefined {
  if (/(?:^|\s)(?:\.\.\/|~\/|\/(?!\/)|[a-zA-Z]:[\\/])/.test(question)
    || /(?:^|[\s/])\.(?:env(?:[.-][\w-]+)?|verion|npmrc|aws|ssh)(?:$|[\s/,:.)])/i.test(question)) {
    return 'Verion can only use files it already discovered in this project. It will not open hidden, external, or unrecognized paths.'
  }
  const paths = question.match(/(?:^|\s)((?:\.\.\/|\.\/|\/)?[\w@./-]+\.(?:[cm]?[jt]sx?|json|prisma|css|html|md|ya?ml))(?:$|[\s,.:)])/gi) ?? []
  for (const match of paths) {
    const path = match.trim().replace(/^["'`(]+|["'`),.]+$/g, '')
    if (path.includes('..') || path.startsWith('/') || path.split('/').some((part) => part === '.verion' || part.startsWith('.env')) || !discoveredFiles.includes(path.replace(/^\.\//, ''))) {
      return 'Verion can only use files it already discovered in this project. It will not open hidden, external, or unrecognized paths.'
    }
  }
  return undefined
}

function isAllowedDiscoveredPath(file: string): boolean {
  return Boolean(file)
    && !file.includes('..')
    && !file.startsWith('/')
    && !file.split('/').some((part) => part === '.verion' || part === 'node_modules' || part.startsWith('.env'))
    && sourceExtensions.has(extname(file))
}

function looksLikeShellRequest(question: string): boolean {
  return /(?:run|execute|shell|terminal|command)\s+(?:this|the|a|npm|pnpm|yarn|git|curl|wget|bash|sh)|(?:^|\s)(?:rm\s+-rf|curl\s|wget\s|npm\s+run|git\s+)/i.test(question)
}

function needsSource(intent: AssistantIntent, question: string): boolean {
  return intent === 'files' || /(?:source|code|implementation|component|function|file)\b/i.test(question)
}

function currentChange(memory: ProjectMemory) {
  // Phase 3’s release desk treats only snapshots newer than a completed
  // verification as current. Old change history is useful context, never a
  // fresh release claim.
  if (!memory.profile.lastVerifiedAt || memory.verificationHistory.length === 0) return undefined
  const changes = memory.recentChanges.filter((change) => change.detectedAt > memory.profile.lastVerifiedAt!)
  const change = changes[0]
  if (!change || (!change.added.length && !change.modified.length && !change.removed.length)) return undefined
  const all = [...new Set(changes.flatMap((item) => [...item.added, ...item.modified, ...item.removed]))]
  return {
    label: `${all.length} local file${all.length === 1 ? '' : 's'} changed`,
    description: all.slice(0, 3).map((file) => basename(file)).join(', '),
    files: all,
    detectedAt: change.detectedAt
  }
}

function likelyImpact(memory: ProjectMemory): Array<{ id: string; label: string }> {
  const files = currentChange(memory)?.files.join(' ').toLowerCase() ?? ''
  return memory.understanding.productAreas
    .filter((area) => files.includes(area.toLowerCase().replace(/\s+/g, '')) || files.includes(area.toLowerCase().split(' ')[0]) || memory.knownUserJourneys.some((journey) => journey.label.toLowerCase().includes(area.toLowerCase().split(' ')[0])))
    .slice(0, 3)
    .map((label, index) => ({ id: `impact:${index}`, label }))
}

function changeId(change: { detectedAt: string }): string { return `change:${change.detectedAt}` }
function releaseLabel(report: StoredReleaseReport): string { return report.recommendation === 'ready_to_ship' ? 'ready to ship' : report.recommendation === 'needs_attention' ? 'needs attention' : 'inconclusive' }
function displayDate(value: string): string { const date = new Date(value); return Number.isNaN(date.valueOf()) ? 'recently' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date) }
function plainList(values: string[]): string { if (values.length === 0) return ''; if (values.length === 1) return values[0]; if (values.length === 2) return `${values[0]} and ${values[1]}`; return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}` }
function citation(kind: AssistantCitation['kind'], label: string, sourceId?: string): AssistantCitation { return { id: `${kind}:${sourceId ?? 'current'}`, kind, label, ...(sourceId ? { sourceId } : {}) } }
function sourceCitation(file: string, startLine?: number, endLine?: number): AssistantCitation { return { id: `source_file:${file}:${startLine ?? 0}:${endLine ?? 0}`, kind: 'source_file', label: startLine ? `${file} · ${startLine}–${endLine}` : file, file, ...(startLine ? { startLine, endLine } : {}) } }
function toolCall(tool: AssistantToolCall['tool'], inputSummary: string, outputSummary: string, citationIds: string[]): AssistantToolCall { const now = new Date().toISOString(); return { id: `tool:${tool}:${randomUUID()}`, tool, requestedAt: now, completedAt: now, status: 'completed', inputSummary, outputSummary, citationIds } }
function appendTool(plan: LocalAssistantPlan, call: AssistantToolCall, extension: Record<string, unknown>): LocalAssistantPlan { return { ...plan, toolCalls: [...plan.toolCalls, call], providerContext: truncateContext({ ...plan.providerContext, ...extension }) } }
function uniqueCitations(citations: AssistantCitation[]): AssistantCitation[] { return [...new Map(citations.map((item) => [item.id, item])).values()].slice(0, 12) }
function truncateContext(value: Record<string, unknown>): Record<string, unknown> { const encoded = JSON.stringify(value); if (encoded.length <= totalContextBudget) return value; return { project: value.project, currentChange: value.currentChange, latestReview: value.latestReview, note: 'Local context was shortened to stay within the review limit.' } }
function refusalPlan(intent: AssistantIntent, refusal: string): LocalAssistantPlan { return { intent, citations: [], toolCalls: [], deterministicAnswer: { content: `Local safety limit: ${refusal}`, basis: 'discovered_fact' }, providerContext: {}, refusal, auditSummary: 'Declined an unsafe local assistant request.' } }
