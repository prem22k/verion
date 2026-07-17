import { readFile } from 'node:fs/promises'
import { watch, type FSWatcher } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createViteServer } from 'vite'
import { completeProjectOnboarding, learnProject, type LearnedProject } from './agent/core/projectMemory'
import { getGptDiagnosisStatus } from './agent/core/runtimeConfig'
import type { Evidence, KnownUserJourney, ProjectDiscovery, ProjectMemory, ProjectTechnology, ProjectUnderstanding, ProjectUnderstandingItem, ProjectVerificationResult, RecentProjectChange, ReleaseConfidence, ReleaseRecommendation, StoredReleaseReport } from './agent/core/types'
import { runProjectVerification } from './agent/runProjectVerification'

const host = '127.0.0.1'
const changeDebounceMs = 3_000
const ignoredPathParts = new Set(['.git', '.next', '.nuxt', '.output', '.vercel', '.verion', 'artifacts', 'build', 'coverage', 'dist', 'node_modules', 'out', 'public'])
const watchedExtensions = new Set(['.cjs', '.cts', '.css', '.html', '.js', '.json', '.jsx', '.mjs', '.mts', '.ts', '.tsx'])
const localAppPorts = [3000, 3001, 4173, 4200, 4321, 5174, 8000, 8080]
const dashboardRoot = dirname(fileURLToPath(import.meta.url))

export type StartVerionServerOptions = {
  port?: number
  projectPath?: string
  targetUrl?: string
  watchChanges?: boolean
}

type ConnectedProject = {
  projectPath: string
  targetUrl?: string
  watchChanges: boolean
  connectedAt: string
  discovery: Pick<ProjectDiscovery, 'framework' | 'packageManager' | 'packageName' | 'entryPoints' | 'routes'>
  understanding: ProjectUnderstanding
  memory: {
    onboardingRequired: boolean
    learnedAt: string
    state: 'first_run' | 'remembered' | 'updated'
  }
}

type MissionReleaseStatus = 'ready_for_review' | 'ready_to_ship' | 'needs_attention' | 'inconclusive' | 'reviewing'

type MissionReport = {
  id: string
  outcome: Exclude<MissionReleaseStatus, 'ready_for_review' | 'reviewing'>
  confidence: ReleaseConfidence
  headline: string
  rootCause: string
  reasons: string[]
  nextAction: string
  completedAt: string
}

type ReviewStage = 'understanding' | 'reviewing_changes' | 'checking_product' | 'making_decision'

type ReviewSnapshot = {
  stage: ReviewStage
  hasRunningExperience: boolean
  paused?: boolean
  observations: ReviewObservation[]
}

type ReviewObservation = {
  tone: 'success' | 'warning'
  message: string
}

type MissionReview = {
  steps: Array<{
    title: string
    description: string
    state: 'completed' | 'current' | 'next' | 'paused'
  }>
  changes: string[]
  hasRunningExperience: boolean
  observations?: ReviewObservation[]
  paused?: boolean
  message?: string
}

type MissionControl = {
  project: {
    name: string
    understanding: Pick<ProjectUnderstanding,
      | 'summary'
      | 'technologies'
      | 'productAreas'
      | 'applicationType'
      | 'authentication'
      | 'payments'
      | 'database'
      | 'framework'
      | 'userJourneys'
      | 'criticalBusinessFlows'
      | 'importantPages'
      | 'importantApis'
    >
  }
  onboardingRequired: boolean
  hasChangeBaseline: boolean
  likelyImpact: Array<{ id: string; label: string }>
  recentChanges: Array<{ id: string; label: string; description: string }>
  knownUserJourneys: Array<{ id: string; label: string; source: 'project' | 'browser' }>
  currentStatus: { kind: MissionReleaseStatus; label: string; description: string }
  recentReports: MissionReport[]
  review?: MissionReview
}

type AgentEvent =
  | { type: 'connected'; mission: MissionControl }
  | { type: 'disconnected' }
  | { type: 'change_detected'; mission: MissionControl }
  | { type: 'verification_started'; trigger: 'manual' | 'change'; mission: MissionControl }
  | { type: 'review_progress'; trigger: 'manual' | 'change'; mission: MissionControl }
  | { type: 'verification_completed'; trigger: 'manual' | 'change'; mission: MissionControl; report?: MissionReport }
  | { type: 'verification_paused'; trigger: 'manual' | 'change'; mission: MissionControl }
  | { type: 'attention_required'; report: MissionReport }
  | { type: 'watcher_error' }

export async function startVerionServer(options: StartVerionServerOptions = {}) {
  const port = options.port ?? 5173
  const vite = await createViteServer({ root: dashboardRoot, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'spa' })
  const eventClients = new Set<ServerResponse>()
  let connection: ConnectedProject | undefined
  let watcher: FSWatcher | undefined
  let changeTimer: NodeJS.Timeout | undefined
  let changeRefreshTimer: NodeJS.Timeout | undefined
  let verificationRunning = false
  let queuedChangeVerification = false
  let lastResult: ProjectVerificationResult | undefined
  let lastRecommendation: ReleaseRecommendation | undefined
  let reviewSnapshot: ReviewSnapshot | undefined

  const broadcast = (event: AgentEvent) => {
    const payload = `data: ${JSON.stringify(event)}\n\n`
    for (const client of eventClients) client.write(payload)
  }

  const closeWatcher = () => {
    watcher?.close()
    watcher = undefined
    if (changeTimer) clearTimeout(changeTimer)
    changeTimer = undefined
    if (changeRefreshTimer) clearTimeout(changeRefreshTimer)
    changeRefreshTimer = undefined
  }

  const verifyConnectedProject = async (trigger: 'manual' | 'change') => {
    if (!connection) throw new Error('Connect a project before starting verification.')
    if (verificationRunning) {
      if (trigger === 'change') queuedChangeVerification = true
      if (trigger === 'manual') throw new Error('A verification is already running.')
      return lastResult
    }

    verificationRunning = true
    reviewSnapshot = {
      stage: 'understanding',
      hasRunningExperience: Boolean(connection.targetUrl),
      observations: []
    }
    broadcast({ type: 'verification_started', trigger, mission: await missionControl() })
    try {
      await detectTargetForConnectedProject()
      const previousRecommendation = lastRecommendation
      const result = await runProjectVerification({
        projectPath: connection.projectPath,
        targetUrl: connection.targetUrl,
        diagnose: true,
        trigger,
        onReviewProgress: async (stage) => {
          reviewSnapshot = {
            stage,
            hasRunningExperience: Boolean(connection?.targetUrl),
            observations: reviewSnapshot?.observations ?? []
          }
          broadcast({ type: 'review_progress', trigger, mission: await missionControl() })
        },
        onEvidence: async (evidence) => {
          const observation = reviewObservation(evidence)
          if (!observation || !reviewSnapshot?.hasRunningExperience) return
          if (reviewSnapshot.observations.some((existing) => existing.message === observation.message)) return
          reviewSnapshot = {
            ...reviewSnapshot,
            observations: [...reviewSnapshot.observations, observation].slice(-6)
          }
          broadcast({ type: 'review_progress', trigger, mission: await missionControl() })
        }
      })
      lastResult = result
      lastRecommendation = result.report?.recommendation
      await new Promise<void>((resolve) => setTimeout(resolve, 500))
      reviewSnapshot = undefined
      const mission = await missionControl()
      const report = result.report ? mission.recentReports[0] : undefined
      broadcast({ type: 'verification_completed', trigger, mission, report })
      if (report?.outcome === 'needs_attention' && previousRecommendation !== 'needs_attention') {
        broadcast({ type: 'attention_required', report })
      }
      return result
    } catch (error: unknown) {
      reviewSnapshot = {
        stage: reviewSnapshot?.stage ?? 'understanding',
        hasRunningExperience: Boolean(connection?.targetUrl),
        paused: true,
        observations: reviewSnapshot?.observations ?? []
      }
      broadcast({ type: 'verification_paused', trigger, mission: await missionControl() })
      throw error
    } finally {
      verificationRunning = false
      if (queuedChangeVerification) {
        queuedChangeVerification = false
        scheduleChangeVerification()
      }
    }
  }

  const scheduleChangeVerification = () => {
    if (!connection?.watchChanges) return
    if (changeTimer) clearTimeout(changeTimer)
    changeTimer = setTimeout(() => {
      void verifyConnectedProject('change').catch(() => {
        broadcast({ type: 'watcher_error' })
      })
    }, changeDebounceMs)
  }

  const refreshChangedProject = () => {
    if (!connection?.watchChanges) return
    if (changeRefreshTimer) clearTimeout(changeRefreshTimer)
    const projectPath = connection.projectPath
    changeRefreshTimer = setTimeout(() => {
      void learnProject(projectPath)
        .then(async () => {
          if (!connection || connection.projectPath !== projectPath) return
          broadcast({ type: 'change_detected', mission: await missionControl() })
        })
        .catch(() => broadcast({ type: 'watcher_error' }))
    }, 180)
  }

  const startWatcher = () => {
    closeWatcher()
    if (!connection?.watchChanges) return
    try {
      watcher = watch(connection.projectPath, { recursive: true }, (_eventType, filename) => {
        const path = filename?.toString() ?? ''
        if (!path || shouldIgnorePath(path)) return
        refreshChangedProject()
        scheduleChangeVerification()
      })
      watcher.on('error', () => broadcast({ type: 'watcher_error' }))
    } catch {
      broadcast({ type: 'watcher_error' })
    }
  }

  const connectProject = async (projectPath: string, targetUrl?: string, watchChanges = true) => {
    const learned = await learnConnectedProject(projectPath)
    const resolvedTargetUrl = targetUrl ?? await detectLocalTargetUrl(port)
    connection = connectedProjectFromLearning(learned, {
      targetUrl: resolvedTargetUrl,
      watchChanges,
      connectedAt: new Date().toISOString()
    })
    lastResult = undefined
    lastRecommendation = undefined
    startWatcher()
    broadcast({ type: 'connected', mission: await missionControl() })
    return connection
  }

  const detectTargetForConnectedProject = async () => {
    if (!connection || connection.targetUrl) return
    const targetUrl = await detectLocalTargetUrl(port)
    if (!targetUrl) return
    connection = { ...connection, targetUrl }
    broadcast({ type: 'connected', mission: await missionControl() })
  }

  const missionControl = async (): Promise<MissionControl> => {
    if (!connection) throw new Error('Start Verion from a project before viewing its briefing.')
    const { memory } = await learnProject(connection.projectPath)
    return createMissionControl(memory, reviewSnapshot)
  }

  const server = createServer(async (request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/api/connection') {
        return sendJson(response, 200, { mission: connection ? await missionControl() : undefined })
      }

      if (request.method === 'GET' && request.url === '/api/status') {
        return sendJson(response, 200, { agent: 'ready', gptDiagnosis: getGptDiagnosisStatus() })
      }

      if (request.method === 'GET' && request.url === '/api/events') {
        response.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive'
        })
        response.write('retry: 2000\n\n')
        eventClients.add(response)
        request.on('close', () => eventClients.delete(response))
        return
      }

      if (request.method === 'POST' && request.url === '/api/projects/connect') {
        const body = await readJsonBody(request)
        const projectPath = readRequiredString(body, 'projectPath')
        const targetUrl = readOptionalTargetUrl(body)
        const watchChanges = body.watchChanges !== false
        await connectProject(projectPath, targetUrl, watchChanges)
        return sendJson(response, 200, { mission: await missionControl() })
      }

      if (request.method === 'POST' && request.url === '/api/projects/disconnect') {
        closeWatcher()
        connection = undefined
        lastResult = undefined
        lastRecommendation = undefined
        broadcast({ type: 'disconnected' })
        return sendJson(response, 200, { connection: null })
      }

      if (request.method === 'POST' && request.url === '/api/projects/onboarding-complete') {
        if (!connection) throw new Error('Start Verion from a project before completing onboarding.')
        const memory = await completeProjectOnboarding(connection.projectPath)
        if (!memory) throw new Error('Project memory is unavailable. Restart Verion to learn this project again.')
        connection = {
          ...connection,
          memory: { ...connection.memory, onboardingRequired: false, learnedAt: memory.updatedAt }
        }
        broadcast({ type: 'connected', mission: await missionControl() })
        return sendJson(response, 200, { mission: await missionControl() })
      }

      if (request.method === 'POST' && request.url === '/api/verify') {
        const result = await verifyConnectedProject('manual')
        if (!result) throw new Error('Verification did not return a release decision.')
      const mission = await missionControl()
        return sendJson(response, 200, {
          mission,
          report: result.report ? mission.recentReports[0] : undefined
        })
      }

      const evidenceId = request.method === 'GET' ? screenshotEvidenceId(request.url) : undefined
      if (evidenceId) {
        const screenshot = screenshotPathFor(evidenceId, lastResult?.evidence ?? [])
        if (!screenshot) return sendJson(response, 404, { error: 'Screenshot evidence is unavailable.' })
        const image = await readFile(screenshot)
        response.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' })
        response.end(image)
        return
      }

      vite.middlewares(request, response, () => {
        response.statusCode = 404
        response.end('Not found')
      })
    } catch (error: unknown) {
      sendJson(response, 400, { error: error instanceof Error ? error.message : 'Request could not complete.' })
    }
  })

  await new Promise<void>((resolveServer) => server.listen(port, host, resolveServer))
  if (options.projectPath) await connectProject(options.projectPath, options.targetUrl, options.watchChanges !== false)
  return {
    url: `http://${host}:${port}`,
    close: async () => {
      closeWatcher()
      for (const client of eventClients) client.end()
      await new Promise<void>((resolveServer, reject) => server.close((error) => error ? reject(error) : resolveServer()))
      await vite.close()
    }
  }
}

async function detectLocalTargetUrl(agentPort: number): Promise<string | undefined> {
  const candidates = localAppPorts
    .filter((port) => port !== agentPort)
    .map((port) => `http://127.0.0.1:${port}/`)
  const reachable = await Promise.all(candidates.map(async (url) => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(800), redirect: 'follow' })
      return response.ok && response.headers.get('content-type')?.includes('text/html') ? url : undefined
    } catch {
      return undefined
    }
  }))
  return reachable.find((url): url is string => Boolean(url))
}

function shouldIgnorePath(path: string): boolean {
  if (path.split(/[\\/]/).some((part) => ignoredPathParts.has(part) || part.startsWith('.env'))) return true
  return !watchedExtensions.has(extname(path))
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 16_000) throw new Error('Request body is too large.')
  }
  if (!body) return {}
  const parsed = JSON.parse(body) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Request body must be a JSON object.')
  return parsed as Record<string, unknown>
}

function readRequiredString(body: Record<string, unknown>, field: string): string {
  const value = body[field]
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${field} is required.`)
  return value.trim()
}

function readOptionalTargetUrl(body: Record<string, unknown>): string | undefined {
  const value = body.targetUrl
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new Error('targetUrl must be a string.')
  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('targetUrl must use http or https.')
  return url.toString()
}

async function learnConnectedProject(projectPath: string): Promise<LearnedProject> {
  try {
    return await learnProject(resolveHomePath(projectPath))
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
    if (code === 'ENOENT') {
      throw new Error(`Project directory does not exist: ${projectPath}. Enter its full path, for example /home/your-name/projects/app, or use ~/projects/app.`)
    }
    throw error
  }
}

function connectedProjectFromLearning(learned: LearnedProject, connection: Pick<ConnectedProject, 'targetUrl' | 'watchChanges' | 'connectedAt'>): ConnectedProject {
  const { discovery, memory, memoryState } = learned
  return {
    projectPath: discovery.projectRoot,
    targetUrl: connection.targetUrl,
    watchChanges: connection.watchChanges,
    connectedAt: connection.connectedAt,
    discovery: {
      framework: discovery.framework,
      packageManager: discovery.packageManager,
      packageName: discovery.packageName,
      entryPoints: discovery.entryPoints,
      routes: discovery.routes
    },
    understanding: memory.understanding,
    memory: {
      onboardingRequired: !memory.onboardingCompletedAt,
      learnedAt: memory.updatedAt,
      state: memoryState
    }
  }
}

function createMissionControl(memory: ProjectMemory, reviewSnapshot?: ReviewSnapshot): MissionControl {
  const reports = memory.releaseReports.slice(0, 3).map((report) => missionReport(report))
  const latestReport = reports[0]
  const recentChanges = missionChangeGroups(memory.recentChanges)
  const likelyImpact = missionLikelyImpact(memory)
  return {
    project: {
      name: memory.profile.name,
      understanding: missionUnderstanding(memory.understanding)
    },
    onboardingRequired: !memory.onboardingCompletedAt,
    hasChangeBaseline: Boolean(memory.profile.lastVerifiedAt || memory.recentChanges.length > 0),
    likelyImpact,
    recentChanges,
    knownUserJourneys: missionJourneys(memory.knownUserJourneys),
    currentStatus: missionStatus(Boolean(reviewSnapshot && !reviewSnapshot.paused), latestReport),
    recentReports: reports,
    review: reviewSnapshot ? missionReview(reviewSnapshot, recentChanges) : undefined
  }
}

function missionReview(snapshot: ReviewSnapshot, changes: MissionControl['recentChanges']): MissionReview {
  const order: ReviewStage[] = ['understanding', 'reviewing_changes', 'checking_product', 'making_decision']
  const currentIndex = order.indexOf(snapshot.stage)
  const changedAreas = changes.slice(0, 3).map((change) => change.label)
  const stateFor = (stage: ReviewStage): MissionReview['steps'][number]['state'] => {
    const index = order.indexOf(stage)
    if (snapshot.paused && index === currentIndex) return 'paused'
    if (index < currentIndex) return 'completed'
    if (index === currentIndex) return 'current'
    return 'next'
  }
  const productCopy = snapshot.hasRunningExperience
    ? 'Looking through the running experience and the paths people rely on.'
    : 'Reviewing the project paths Verion can inspect right now.'

  return {
    steps: [
      { title: 'Understanding this project', description: 'Verion refreshed its picture of the product and the parts that matter.', state: stateFor('understanding') },
      { title: 'Reviewing what changed', description: changedAreas.length > 0 ? `Reviewing ${joinPlainLanguage(changedAreas)}.` : 'Verion compared the current project with what it already knows.', state: stateFor('reviewing_changes') },
      { title: 'Checking the product', description: productCopy, state: stateFor('checking_product') },
      { title: 'Making a release decision', description: snapshot.stage === 'making_decision' ? 'Bringing the review together into one release recommendation.' : 'Verion will bring the observations together into one clear recommendation.', state: stateFor('making_decision') }
    ],
    changes: changedAreas,
    hasRunningExperience: snapshot.hasRunningExperience,
    observations: snapshot.hasRunningExperience ? snapshot.observations.slice(-6) : undefined,
    paused: snapshot.paused,
    message: snapshot.paused ? 'Verion could not finish this review. Check that the project is ready, then try again.' : undefined
  }
}

function reviewObservation(evidence: Evidence): ReviewObservation | undefined {
  const data = record(evidence.data)
  if (evidence.kind === 'browser_exploration') {
    if (data.status === 'failed') return { tone: 'warning', message: 'The running app could not be opened.' }
    const status = numberValue(data.status)
    if (status && status >= 400) return httpObservation(status, evidence.location?.url)
    return { tone: 'success', message: loadedObservation(data.title, evidence.location?.url) }
  }

  if (evidence.kind === 'console_log' && data.level === 'error') {
    return { tone: 'warning', message: 'Console error detected.' }
  }

  if (evidence.kind === 'network_log') {
    const status = numberValue(data.status)
    if (status && status >= 400) return httpObservation(status, evidence.location?.url)
    if (typeof data.failure === 'string' && data.failure.length > 0) {
      return { tone: 'warning', message: 'An app request did not complete.' }
    }
  }

  return undefined
}

function httpObservation(status: number, source?: string): ReviewObservation {
  const action = namedProductAction(source)
  return {
    tone: 'warning',
    message: action ? `${action} returned HTTP ${status}.` : `An app request returned HTTP ${status}.`
  }
}

function loadedObservation(title: unknown, source?: string): string {
  const action = namedProductAction(typeof title === 'string' ? title : undefined) ?? namedProductAction(source)
  return action ? `${action} loaded.` : 'The running app loaded.'
}

function namedProductAction(source?: string): string | undefined {
  const value = source?.toLowerCase() ?? ''
  if (/checkout|payment/.test(value)) return 'Checkout'
  if (/billing|subscription/.test(value)) return 'Billing'
  if (/profile|account/.test(value)) return 'Profile'
  if (/dashboard/.test(value)) return 'Dashboard'
  if (/sign[ -]?in|login|log-in/.test(value)) return 'Sign-in'
  return undefined
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function joinPlainLanguage(values: string[]): string {
  if (values.length === 1) return values[0]
  if (values.length === 2) return `${values[0]} and ${values[1]}`
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`
}

function missionUnderstanding(understanding: ProjectUnderstanding): MissionControl['project']['understanding'] {
  const items = (category: string, values: ProjectUnderstandingItem[]) => values.slice(0, 12).map(({ label }, index) => ({ id: `${category}-${index + 1}`, label }))
  return {
    summary: understanding.summary,
    technologies: understanding.technologies.map(({ label, kind }, index) => ({ id: `technology-${index + 1}`, label, kind })),
    productAreas: understanding.productAreas,
    applicationType: understanding.applicationType,
    authentication: understanding.authentication,
    payments: understanding.payments,
    database: understanding.database,
    framework: understanding.framework,
    userJourneys: items('journey', understanding.userJourneys),
    criticalBusinessFlows: items('flow', understanding.criticalBusinessFlows),
    importantPages: items('page', understanding.importantPages),
    importantApis: items('api', understanding.importantApis)
  }
}

function missionReport(report: StoredReleaseReport): MissionReport {
  const rootCause = customerReportCopy(report.rootCause, 'The review could not identify a clear release cause.')
  const reasons = uniqueCustomerReasons(report.reasons)
  return {
    id: report.id,
    outcome: recommendationToMissionStatus(report.recommendation),
    confidence: report.confidence,
    headline: customerReportCopy(report.headline, 'Release decision'),
    rootCause,
    reasons,
    nextAction: customerReportCopy(report.nextAction, 'Verify again when the project is ready.'),
    completedAt: report.completedAt
  }
}

function uniqueCustomerReasons(reasons: string[]): string[] {
  const seen = new Set<string>()
  return reasons.flatMap((reason) => {
    const copy = customerReportCopy(reason, '')
    const key = copy.toLowerCase()
    if (!copy || seen.has(key)) return []
    seen.add(key)
    return [copy]
  }).slice(0, 3)
}

function customerReportCopy(value: string, fallback: string): string {
  const curated = value
    .replace(/https?:\/\/\S+/gi, 'the running product')
    .replace(/(?:^|\s)(?:\.?\.?\/)?(?:[\w.-]+\/)+[\w.-]+\.(?:[cm]?[jt]sx?|json|prisma)(?=$|[\s),.:])/gi, ' a source file')
    .replace(/\b(?:evidence\s*(?:id|#)?\s*[:#-]?\s*\w+|[a-z][\w-]*:\d{4}-\d{2}-\d{2}[\w:-]*)\b/gi, 'review detail')
    .replace(/\b(?:Playwright|ServX|Semgrep|GPT|scanner|producer|Context Capsule|Repository Graph|AST|parser|stack trace|raw log|logs?)\b/gi, 'review')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return curated || fallback
}

function recommendationToMissionStatus(recommendation: ReleaseRecommendation): MissionReport['outcome'] {
  if (recommendation === 'ready_to_ship') return 'ready_to_ship'
  if (recommendation === 'needs_attention') return 'needs_attention'
  return 'inconclusive'
}

function missionStatus(reviewing: boolean, report?: MissionReport): MissionControl['currentStatus'] {
  if (reviewing) return { kind: 'reviewing', label: 'Reviewing now', description: 'Verion is looking through the latest version.' }
  if (!report) return { kind: 'ready_for_review', label: 'Ready for review', description: 'Verion is ready to review this project when you are.' }
  if (report.outcome === 'ready_to_ship') return { kind: 'ready_to_ship', label: 'Ready to ship', description: 'The last review found no reason to hold this release.' }
  if (report.outcome === 'needs_attention') return { kind: 'needs_attention', label: 'Needs attention', description: 'The last review found something to resolve before you ship.' }
  return { kind: 'inconclusive', label: 'Inconclusive', description: 'The last review could not make a clear release decision.' }
}

function missionJourneys(journeys: KnownUserJourney[]): MissionControl['knownUserJourneys'] {
  return [...journeys]
    .sort((left, right) => Number(right.source === 'browser') - Number(left.source === 'browser') || right.lastObservedAt.localeCompare(left.lastObservedAt))
    .slice(0, 8)
    .map(({ label, source }, index) => ({ id: `journey-${index + 1}`, label, source }))
}

function missionChangeGroups(changes: RecentProjectChange[]): MissionControl['recentChanges'] {
  const groups: Array<{ id: string; label: string; description: string }> = []
  for (const change of changes) {
    const files = [...change.added, ...change.modified, ...change.removed]
    for (const group of changeGroupsFor(files)) {
      if (groups.some((candidate) => candidate.id === group.id)) continue
      groups.push(group)
      if (groups.length === 3) return groups
    }
  }
  return groups
}

function missionLikelyImpact(memory: ProjectMemory): MissionControl['likelyImpact'] {
  const latestChange = memory.recentChanges[0]
  const lastVerifiedAt = memory.profile.lastVerifiedAt
  if (!latestChange || (lastVerifiedAt && latestChange.detectedAt <= lastVerifiedAt)) return []
  const changedPaths = [...latestChange.added, ...latestChange.modified, ...latestChange.removed]
  const labels = inferLikelyImpact(changedPaths, memory.understanding, memory.knownUserJourneys)
  return labels.map((label, index) => ({ id: `impact-${index + 1}`, label }))
}

function inferLikelyImpact(paths: string[], understanding: ProjectUnderstanding, journeys: KnownUserJourney[]): string[] {
  if (paths.length === 0) return []
  const joinedPaths = paths.join(' ').toLowerCase()
  const labels: string[] = []
  const add = (label: string, supported: boolean) => {
    if (supported && !labels.some((candidate) => candidate.toLowerCase() === label.toLowerCase())) labels.push(label)
  }

  add('Billing', /(?:^|[\\/_-])(?:billing|checkout|subscription|payment|invoice|stripe)(?:[\\/_-]|$)/.test(joinedPaths))
  add('Authentication', /(?:^|[\\/_-])(?:auth|sign-in|signin|sign-up|signup|login|session|clerk|account)(?:[\\/_-]|$)/.test(joinedPaths))
  add('Dashboard', /(?:^|[\\/_-])(?:dashboard|workspace|admin)(?:[\\/_-]|$)/.test(joinedPaths))
  add('Settings', /(?:^|[\\/_-])(?:settings|preferences|profile)(?:[\\/_-]|$)/.test(joinedPaths))

  const learnedLabels = [
    ...understanding.productAreas,
    ...understanding.userJourneys.map((item) => item.label),
    ...journeys.map((journey) => journey.label)
  ]
  for (const label of learnedLabels) {
    if (!isSpecificProductLabel(label) || labels.some((candidate) => candidate.toLowerCase() === label.toLowerCase())) continue
    const signal = label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((part) => part.length > 2)
    if (signal.length > 0 && signal.some((part) => new RegExp(`(?:^|[\\/_-])${escapeRegExp(part)}(?:[\\/_-]|$)`).test(joinedPaths))) add(label, true)
  }

  return labels.slice(0, 3)
}

function isSpecificProductLabel(label: string): boolean {
  return !/^(api|home|detail|application)$/i.test(label.trim())
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function changeGroupsFor(files: string[]): Array<{ id: string; label: string; description: string }> {
  const groups: Array<{ id: string; label: string; description: string }> = []
  const add = (id: string, label: string, description: string, condition: boolean) => {
    if (condition && !groups.some((group) => group.id === id)) groups.push({ id, label, description })
  }
  add('new-areas', 'New product areas', 'New product areas are ready to be reviewed.', files.some((file) => /(?:^|\/)(?:app|pages|routes)\/.+\/(?:page|route)\.|(?:^|\/)(?:app|pages|routes)\/.+\.(?:tsx?|jsx?)$/.test(file)))
  add('interface', 'Interface changes', 'Interface changes are waiting to be checked.', files.some((file) => /\.(?:css|scss|sass|less)$/.test(file) || /(?:component|view|layout|page)\.(?:tsx?|jsx?)$/i.test(file)))
  add('setup', 'Project setup changes', 'Project setup changed since the last review.', files.some((file) => /(?:^|\/)(?:package(?:-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|vite\.config|next\.config|tsconfig|eslint|prettier)/.test(file)))
  add('application', 'Application code changes', 'Application code changed since the last review.', files.length > 0)
  return groups
}

function resolveHomePath(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/')) return resolve(homedir(), path.slice(2))
  return resolve(path)
}

function screenshotEvidenceId(requestUrl: string | undefined): string | undefined {
  const prefix = '/api/evidence/'
  if (!requestUrl?.startsWith(prefix)) return undefined
  return decodeURIComponent(requestUrl.slice(prefix.length))
}

function screenshotPathFor(id: string, evidence: Evidence[]): string | undefined {
  const item = evidence.find((candidate) => candidate.id === id && candidate.kind === 'screenshot')
  if (!item || !item.data || typeof item.data !== 'object' || !('path' in item.data)) return undefined
  return typeof item.data.path === 'string' ? item.data.path : undefined
}

if (process.argv[1]?.endsWith('server.ts')) {
  startVerionServer({ projectPath: process.cwd() }).then(({ url }) => console.log(`Verion is ready at ${url}`))
}
