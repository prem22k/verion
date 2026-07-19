import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { watch, type FSWatcher } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { basename, dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createViteServer, type ViteDevServer } from 'vite'
import { completeProjectOnboarding, forgetProjectMemory, learnProject, readProjectMemory, type LearnedProject, type ProjectLearningProgress } from './agent/core/projectMemory'
import { FixPacketIncompleteError, launchInteractiveCodex, createFixPacketFromRepairBrief, writeFixPacket, type FixPacketLauncher } from './agent/core/fixPacket'
import { executeRepairProposal, getAIProviderStatus, nativeRepairAvailability } from './agent/core/runtimeConfig'
import { saveProviderSetup, validateSavedProviderSetup, type ProviderSetupInput } from './agent/core/providerSetup'
import { appendAssistantAudit } from './agent/core/assistantAudit'
import { answerAssistantQuestion, assistantConversationView, clearAssistantConversation, readAssistantConversation } from './agent/core/assistantConversation'
import { hasConfirmedRepairLaunch } from './agent/core/repairConfirmation'
import { publicSecurityFindings, type PublicSecurityFinding } from './agent/core/securityFindings'
import { createRepairBrief, repairPrompt, type RepairBriefSource } from './agent/core/repairBrief'
import { applyGuardedRepairProposal, hasRepairApplyApproval, hasRepairSourceConsent, recordRepairLedger, repairApplyConfirmation, repairProposalSchema, repairProposalView, repairSourceConsentConfirmation, runAllowlistedCheck, selectAllowlistedCheck, validateRepairProposal, type RepairProposalView } from './agent/core/repairWorkflow'
import type { Evidence, KnownUserJourney, NativeRepairProposal, ProjectDiscovery, ProjectMemory, ProjectTechnology, ProjectUnderstanding, ProjectUnderstandingItem, ProjectVerificationResult, RecentProjectChange, ReleaseConfidence, ReleaseRecommendation, SecurityReviewProgress, StoredReleaseReport } from './agent/core/types'
import { runDeepSecurityReview, runProjectVerification } from './agent/runProjectVerification'

const host = '127.0.0.1'
const changeDebounceMs = 3_000
const ignoredPathParts = new Set(['.git', '.next', '.nuxt', '.output', '.vercel', '.verion', 'artifacts', 'build', 'coverage', 'dist', 'node_modules', 'out', 'public'])
const watchedExtensions = new Set(['.cjs', '.cts', '.css', '.html', '.js', '.json', '.jsx', '.mjs', '.mts', '.ts', '.tsx'])
const conventionalLocalAppPorts = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 4000, 4001, 4173, 4200, 4321, 5000, 5001, 5173, 5174, 6006, 7000, 8000, 8080, 8787, 8888, 9000]
const dashboardRoot = dirname(fileURLToPath(import.meta.url))

export type StartVerionServerOptions = {
  port?: number
  projectPath?: string
  targetUrl?: string
  watchChanges?: boolean
  fixPacketLauncher?: FixPacketLauncher
}

type ConnectedProject = {
  projectPath: string
  targetUrl?: string
  watchChanges: boolean
  connectedAt: string
  discovery: Pick<ProjectDiscovery, 'framework' | 'packageManager' | 'packageName' | 'scripts' | 'entryPoints' | 'routes'>
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

type CurrentChange = {
  state: 'baseline_not_established' | 'no_change' | 'change_detected' | 'reviewing_change'
  label: string
  description: string
  detectedAt?: string
  groups: Array<{ id: string; label: string; description: string }>
  likelyImpact: Array<{ id: string; label: string; reason?: string }>
}

type ReviewStage = 'understanding' | 'reviewing_changes' | 'checking_product' | 'making_decision'

type ReviewSnapshot = {
  stage: ReviewStage
  hasRunningExperience: boolean
  paused?: boolean
  observations: ReviewObservation[]
  currentChange: CurrentChange
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

type MissionSecurityReview = {
  status: 'available' | 'reviewing' | 'completed' | 'concern' | 'partial' | 'unavailable' | 'failed'
  label: string
  description: string
  estimatedDuration: string
  canStart: boolean
  canRetry: boolean
  completedAt?: string
  progress?: SecurityReviewProgressView
}

type SecurityReviewStation = {
  id: SecurityReviewProgress['station']
  label: string
  state: 'pending' | 'current' | 'completed' | 'skipped' | 'failed'
  detail: string
}

type SecurityReviewProgressView = {
  state: 'ready' | 'reviewing' | 'completed' | 'concern' | 'partial' | 'failed'
  currentMessage?: string
  label: string
  completedSteps: number
  totalSteps: number
  stations: SecurityReviewStation[]
}

type SecurityReviewSnapshot = {
  status: 'reviewing' | 'completed' | 'concern' | 'partial' | 'failed'
  message: string
  stations: SecurityReviewStation[]
}

type MissionControl = {
  project: {
    id: string
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
      | 'routeCount'
      | 'apiCount'
      | 'model'
    >
  }
  onboardingRequired: boolean
  currentChange: CurrentChange
  hasChangeBaseline: boolean
  likelyImpact: Array<{ id: string; label: string }>
  recentChanges: Array<{ id: string; label: string; description: string }>
  knownUserJourneys: Array<{ id: string; label: string; source: 'project' | 'browser' }>
  localMemory: {
    firstLearnedAt: string
    lastLearnedAt: string
    lastVerifiedAt?: string
    knownJourneyCount: number
    reviewCount: number
    knownIssueCount: number
  }
  deepSecurity: {
    status: MissionSecurityReview['status']
    label: string
    description: string
    estimatedDuration: string
    canStart: boolean
    canRetry: boolean
    completedAt?: string
    progress?: SecurityReviewProgressView
  }
  securityFindings: PublicSecurityFinding[]
  nativeRepairAvailable: boolean
  currentStatus: { kind: MissionReleaseStatus; label: string; description: string }
  recentReports: MissionReport[]
  review?: MissionReview
}

type AgentEvent =
  | { type: 'learning_started'; learning: LearningProgress }
  | { type: 'learning_progress'; learning: LearningProgress }
  | { type: 'learning_failed'; learning: LearningProgress }
  | { type: 'connected'; mission: MissionControl }
  | { type: 'disconnected' }
  | { type: 'change_detected'; mission: MissionControl }
  | { type: 'verification_started'; trigger: 'manual' | 'change'; mission: MissionControl }
  | { type: 'review_progress'; trigger: 'manual' | 'change'; mission: MissionControl }
  | { type: 'verification_completed'; trigger: 'manual' | 'change'; mission: MissionControl; report?: MissionReport }
  | { type: 'verification_paused'; trigger: 'manual' | 'change'; mission: MissionControl }
  | { type: 'security_review_started'; mission: MissionControl }
  | { type: 'security_review_progress'; mission: MissionControl }
  | { type: 'security_review_completed'; mission: MissionControl; report?: MissionReport }
  | { type: 'security_review_failed'; mission: MissionControl }
  | { type: 'attention_required'; report: MissionReport }
  | { type: 'watcher_error' }

type LearningProgress = {
  state: 'learning' | 'failed'
  projectName: string
  message: string
  facts: Array<{ id: string; label: string }>
}

export async function startVerionServer(options: StartVerionServerOptions = {}) {
  const port = options.port ?? 5173
  let vite: ViteDevServer
  const eventClients = new Set<ServerResponse>()
  let connection: ConnectedProject | undefined
  let learning: LearningProgress | undefined
  let watcher: FSWatcher | undefined
  let changeTimer: NodeJS.Timeout | undefined
  let changeRefreshTimer: NodeJS.Timeout | undefined
  let verificationRunning = false
  let securityReviewRunning = false
  let queuedChangeVerification = false
  let lastResult: ProjectVerificationResult | undefined
  let lastRecommendation: ReleaseRecommendation | undefined
  let lastVerificationReportId: string | undefined
  let reviewSnapshot: ReviewSnapshot | undefined
  let securityReviewSnapshot: SecurityReviewSnapshot | undefined
  const activeRepairProposals = new Map<string, NativeRepairProposal>()

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

    const { memory: verificationMemory } = await learnProject(connection.projectPath)
    void recordAssistantAudit(connection.projectPath, 'verification_requested', 'completed', trigger === 'manual' ? 'Started a developer-requested release review.' : 'Started a change-triggered release review.')
    verificationRunning = true
    reviewSnapshot = {
      stage: 'understanding',
      hasRunningExperience: Boolean(connection.targetUrl),
      observations: [],
      currentChange: currentChangeForMemory(verificationMemory)
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
            observations: reviewSnapshot?.observations ?? [],
            currentChange: reviewSnapshot?.currentChange ?? currentChangeForMemory(verificationMemory)
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
      lastVerificationReportId = report?.id
      void recordAssistantAudit(connection.projectPath, 'verification_result', 'completed', report ? `Recorded the latest release decision: ${report.outcome === 'ready_to_ship' ? 'ready to ship' : report.outcome === 'needs_attention' ? 'needs attention' : 'inconclusive'}.` : 'Finished a release review without a saved decision.', report ? [report.id] : undefined)
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
        observations: reviewSnapshot?.observations ?? [],
        currentChange: reviewSnapshot?.currentChange ?? currentChangeForMemory(verificationMemory)
      }
      void recordAssistantAudit(connection.projectPath, 'verification_result', 'failed', 'A release review did not finish.')
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

  const reviewConnectedProjectSecurity = async () => {
    if (!connection) throw new Error('Connect a project before starting Deep Security Review.')
    if (securityReviewRunning) throw new Error('Deep Security Review is already in progress.')
    if (verificationRunning) throw new Error('Wait for the current verification to finish before starting Deep Security Review.')

    securityReviewRunning = true
    securityReviewSnapshot = initialSecurityReviewSnapshot()
    broadcast({ type: 'security_review_started', mission: await missionControl() })
    try {
      await detectTargetForConnectedProject()
      const previousRecommendation = lastRecommendation
      const result = await runDeepSecurityReview({
        projectPath: connection.projectPath,
        targetUrl: connection.targetUrl,
        trigger: 'manual',
        onProgress: async (progress) => {
          securityReviewSnapshot = applySecurityReviewProgress(securityReviewSnapshot ?? initialSecurityReviewSnapshot(), progress)
          broadcast({ type: 'security_review_progress', mission: await missionControl() })
        }
      })
      lastResult = result
      lastRecommendation = result.report?.recommendation
      const status = securityReviewResultStatus(result.evidence)
      securityReviewSnapshot = completeSecurityReviewSnapshot(securityReviewSnapshot ?? initialSecurityReviewSnapshot(), status)
      const mission = await missionControl()
      const report = result.report ? mission.recentReports[0] : undefined
      lastVerificationReportId = report?.id
      void recordAssistantAudit(connection.projectPath, 'verification_result', 'completed', report ? `Recorded the Deep Security Review decision: ${report.outcome === 'ready_to_ship' ? 'ready to ship' : report.outcome === 'needs_attention' ? 'needs attention' : 'inconclusive'}.` : 'Finished Deep Security Review without a saved decision.', report ? [report.id] : undefined)
      broadcast({ type: 'security_review_completed', mission, report })
      if (report?.outcome === 'needs_attention' && previousRecommendation !== 'needs_attention') broadcast({ type: 'attention_required', report })
      return result
    } catch (error: unknown) {
      securityReviewSnapshot = failSecurityReviewSnapshot(securityReviewSnapshot ?? initialSecurityReviewSnapshot())
      if (connection) void recordAssistantAudit(connection.projectPath, 'verification_result', 'failed', 'Deep Security Review did not finish.')
      broadcast({ type: 'security_review_failed', mission: await missionControl() })
      throw error
    } finally {
      securityReviewRunning = false
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
          scheduleChangeVerification()
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
      })
      watcher.on('error', () => broadcast({ type: 'watcher_error' }))
    } catch {
      broadcast({ type: 'watcher_error' })
    }
  }

  const connectProject = async (projectPath: string, targetUrl?: string, watchChanges = true) => {
    const resolvedProjectPath = resolveHomePath(projectPath)
    learning = { state: 'learning', projectName: basename(resolvedProjectPath), message: 'Learning how this project fits together.', facts: [] }
    broadcast({ type: 'learning_started', learning })
    let learned: LearnedProject
    try {
      learned = await learnConnectedProject(resolvedProjectPath, async (progress) => {
        if (!learning || learning.projectName !== basename(resolvedProjectPath)) return
        learning = learningProgressFor(progress, learning)
        broadcast({ type: 'learning_progress', learning })
      })
    } catch (error: unknown) {
      learning = { state: 'failed', projectName: basename(resolvedProjectPath), message: error instanceof Error ? error.message : 'Verion could not learn this project.', facts: learning?.facts ?? [] }
      broadcast({ type: 'learning_failed', learning })
      throw error
    }
    const resolvedTargetUrl = targetUrl ?? await detectLocalTargetUrl(port, learned.discovery.scripts)
    connection = connectedProjectFromLearning(learned, {
      targetUrl: resolvedTargetUrl,
      watchChanges,
      connectedAt: new Date().toISOString()
    })
    lastResult = undefined
    lastRecommendation = undefined
    lastVerificationReportId = undefined
    learning = undefined
    startWatcher()
    broadcast({ type: 'connected', mission: await missionControl() })
    return connection
  }

  const detectTargetForConnectedProject = async () => {
    if (!connection || connection.targetUrl) return
    const targetUrl = await detectLocalTargetUrl(port, connection.discovery.scripts)
    if (!targetUrl) return
    connection = { ...connection, targetUrl }
    broadcast({ type: 'connected', mission: await missionControl() })
  }

  const missionControl = async (): Promise<MissionControl> => {
    if (!connection) throw new Error('Start Verion from a project before viewing its briefing.')
    const { memory } = await learnProject(connection.projectPath)
    const nativeRepair = await nativeRepairAvailability(connection.projectPath)
    return createMissionControl(memory, reviewSnapshot, { nativeFixAvailable: nativeRepair.available, securityReviewSnapshot })
  }

  const server = createServer(async (request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/api/connection') {
        return sendJson(response, 200, { mission: connection ? await missionControl() : undefined, ...(learning ? { learning } : {}) })
      }

      if (request.method === 'GET' && request.url === '/api/status') {
        return sendJson(response, 200, { agent: 'ready', ai: await getAIProviderStatus(connection?.projectPath) })
      }

      if (request.method === 'GET' && request.url === '/api/ai/status') {
        if (!connection) throw new Error('Start Verion from a project before configuring AI.')
        return sendJson(response, 200, { ai: await getAIProviderStatus(connection.projectPath) })
      }

      if (request.method === 'POST' && request.url === '/api/ai/setup') {
        if (!connection) throw new Error('Start Verion from a project before configuring AI.')
        const setup = await saveProviderSetup(connection.projectPath, readProviderSetup(await readJsonBody(request)))
        return sendJson(response, 200, { setup, ai: await getAIProviderStatus(connection.projectPath) })
      }

      if (request.method === 'POST' && request.url === '/api/ai/validate') {
        if (!connection) throw new Error('Start Verion from a project before validating AI setup.')
        return sendJson(response, 200, { validation: await validateSavedProviderSetup(connection.projectPath), ai: await getAIProviderStatus(connection.projectPath) })
      }

      if (request.method === 'GET' && request.url === '/api/assistant/conversation') {
        if (!connection) throw new Error('Start Verion from a project before opening the teammate.')
        const conversation = await readAssistantConversation(connection.projectPath)
        return sendJson(response, 200, {
          conversation: assistantConversationView(conversation),
          ai: await getAIProviderStatus(connection.projectPath)
        })
      }

      if (request.method === 'POST' && request.url === '/api/assistant/messages') {
        if (!connection) throw new Error('Start Verion from a project before asking the teammate.')
        const body = await readJsonBody(request)
        const assistantRequest = readAssistantQuestion(body)
        const { memory } = await learnProject(connection.projectPath)
        const result = await answerAssistantQuestion(connection.projectPath, memory, assistantRequest.question, assistantRequest.sourceConsent)
        return sendJson(response, 200, {
          conversation: assistantConversationView(result.conversation),
          ai: await getAIProviderStatus(connection.projectPath),
          ...(result.sourceConsentRequired ? { sourceConsentRequired: result.sourceConsentRequired } : {})
        })
      }

      if (request.method === 'POST' && request.url === '/api/assistant/conversation/clear') {
        if (!connection) throw new Error('Start Verion from a project before clearing the teammate.')
        const conversation = await clearAssistantConversation(connection.projectPath)
        return sendJson(response, 200, { conversation: assistantConversationView(conversation) })
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
        lastVerificationReportId = undefined
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

      if (request.method === 'POST' && request.url === '/api/projects/forget-memory') {
        if (!connection) throw new Error('Start Verion from a project before managing its local memory.')
        if (verificationRunning) throw new Error('Wait for the current review to finish before forgetting this project memory.')
        const body = await readJsonBody(request)
        readForgetConfirmation(body)
        const retainedConnection = {
          targetUrl: connection.targetUrl,
          watchChanges: connection.watchChanges,
          connectedAt: connection.connectedAt
        }
        const learned = await forgetProjectMemory(connection.projectPath)
        connection = connectedProjectFromLearning(learned, retainedConnection)
        lastResult = undefined
        lastRecommendation = undefined
        lastVerificationReportId = undefined
        reviewSnapshot = undefined
        const mission = await missionControl()
        const conversation = await readAssistantConversation(connection.projectPath)
        broadcast({ type: 'connected', mission })
        return sendJson(response, 200, {
          mission,
          conversation: assistantConversationView(conversation),
          ai: await getAIProviderStatus(connection.projectPath)
        })
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

      if (request.method === 'POST' && request.url === '/api/security/review') {
        const result = await reviewConnectedProjectSecurity()
        if (!result) throw new Error('Deep Security Review did not return a release decision.')
        const mission = await missionControl()
        return sendJson(response, 200, {
          mission,
          report: result.report ? mission.recentReports[0] : undefined
        })
      }

      const securityFinding = request.method === 'POST' ? securityFindingId(request.url) : undefined
      if (request.method === 'POST' && request.url === '/api/repair-brief') {
        if (!connection) throw new Error('Start Verion from a project before preparing a fix prompt.')
        const source = readRepairSource(await readJsonBody(request))
        const memory = await readProjectMemory(connection.projectPath)
        if (!memory) throw new Error('This local project memory is unavailable. Refresh the project view and try again.')
        const brief = await createRepairBrief({ projectRoot: connection.projectPath, memory, source, ...(lastResult ? { result: lastResult } : {}) })
        return sendJson(response, 200, { prompt: repairPrompt(brief) })
      }

      // Legacy finding endpoint remains a narrow alias, but now uses the same
      // canonical RepairBrief as every other repair surface.
      if (securityFinding) {
        if (!connection) throw new Error('Start Verion from a project before preparing a finding prompt.')
        const memory = await readProjectMemory(connection.projectPath)
        if (!memory) return sendJson(response, 404, { error: 'This saved security finding is unavailable. Refresh the project view and try again.' })
        const brief = await createRepairBrief({ projectRoot: connection.projectPath, memory, source: { source: 'security_finding', id: securityFinding }, ...(lastResult ? { result: lastResult } : {}) })
        return sendJson(response, 200, { prompt: repairPrompt(brief) })
      }

      if (request.method === 'POST' && request.url === '/api/reports/fix') {
        if (!connection) throw new Error('Start Verion from a project before preparing a repair.')
        const body = await readJsonBody(request)
        const reportId = readRequiredString(body, 'reportId')
        if (!hasConfirmedRepairLaunch(body)) {
          void recordAssistantAudit(connection.projectPath, 'repair_launch_approval', 'rejected', 'Declined a repair launch without the required developer confirmation.', [reportId])
          throw new Error('Confirm “Launch Codex with this review brief” before opening Codex.')
        }
        void recordAssistantAudit(connection.projectPath, 'repair_launch_approval', 'completed', 'Approved creating a review brief and opening Codex.', [reportId])
        const memory = await readProjectMemory(connection.projectPath)
        const report = memory?.releaseReports[0]
        if (!report || report.id !== reportId || report.recommendation !== 'needs_attention') {
          return sendJson(response, 200, { status: 'needs_review' })
        }
        try {
          const brief = await createRepairBrief({ projectRoot: connection.projectPath, memory, source: { source: 'release_report', id: reportId }, ...(lastResult ? { result: lastResult } : {}) })
          const packet = await writeFixPacket(connection.projectPath, createFixPacketFromRepairBrief(brief))
          const launcher = options.fixPacketLauncher ?? launchInteractiveCodex
          const launched = await launcher({ projectPath: connection.projectPath, packetPath: packet.path })
          void recordAssistantAudit(connection.projectPath, 'repair_launch_result', launched.opened ? 'completed' : 'failed', launched.opened ? 'Created a review brief and opened Codex.' : 'Created a review brief, but Codex could not open.', [reportId])
          return sendJson(response, 200, { status: launched.opened ? 'opened' : 'unavailable' })
        } catch (error: unknown) {
          if (error instanceof FixPacketIncompleteError) {
            void recordAssistantAudit(connection.projectPath, 'repair_launch_result', 'rejected', 'Did not create a repair brief because a current supported review was not available.', [reportId])
            return sendJson(response, 200, { status: 'needs_review' })
          }
          void recordAssistantAudit(connection.projectPath, 'repair_launch_result', 'failed', 'Verion could not complete the confirmed repair launch.', [reportId])
          throw error
        }
      }

      if (request.method === 'POST' && request.url === '/api/repairs/proposals') {
        if (!connection) throw new Error('Start Verion from a project before preparing a repair.')
        if (verificationRunning) throw new Error('Wait for the current review to finish before preparing a repair.')
        const body = await readJsonBody(request)
        if (!hasRepairSourceConsent(body)) {
          void recordAssistantAudit(connection.projectPath, 'repair_proposal_declined', 'rejected', 'Declined preparing a repair without source-scope confirmation.')
          throw new Error(`Confirm “${repairSourceConsentConfirmation}” before Verion reads redacted source for this proposal.`)
        }
        const source = readRepairSource(body)
        const memory = await readProjectMemory(connection.projectPath)
        if (!memory) throw new Error('This local project memory is unavailable. Refresh the project view and try again.')
        const brief = await createRepairBrief({ projectRoot: connection.projectPath, memory, source, ...(lastResult ? { result: lastResult } : {}) })
        if (!brief.codeContext.length) throw new Error('Verion could not safely collect source context for this repair. Copy the fix prompt and inspect the affected files instead.')
        try {
          const providerResponse = await executeRepairProposal<unknown>(connection.projectPath, {
            task: 'repair_proposal',
            instructions: 'Return only a JSON repair proposal matching the supplied schema. Make at most six guarded replacements across the approved files. Do not include commands, markdown, tool calls, extra files, credentials, or explanations outside the schema.',
            input: { brief },
            schemaName: 'verion_repair_proposal',
            schema: repairProposalSchema
          })
          const proposal = validateRepairProposal(providerResponse.value, brief)
          activeRepairProposals.set(proposal.id, proposal)
          await recordRepairLedger(connection.projectPath, proposal)
          void recordAssistantAudit(connection.projectPath, 'repair_proposal_prepared', 'completed', 'Prepared a scoped repair proposal without changing project files.', [proposal.id, brief.issueId])
          return sendJson(response, 200, { proposal: repairProposalView(proposal), scope: { fileCount: brief.codeContext.length, excerptCount: brief.codeContext.length } })
        } catch (error) {
          void recordAssistantAudit(connection.projectPath, 'repair_proposal_prepared', 'failed', 'Verion could not prepare a scoped repair proposal.', [brief.issueId])
          throw error
        }
      }

      if (request.method === 'POST' && request.url === '/api/repairs/apply') {
        if (!connection) throw new Error('Start Verion from a project before applying a repair.')
        if (verificationRunning) throw new Error('Wait for the current review to finish before applying a repair.')
        const body = await readJsonBody(request)
        if (!hasRepairApplyApproval(body)) throw new Error(`Confirm “${repairApplyConfirmation}” before Verion changes files.`)
        const proposal = activeRepairProposals.get(readRequiredString(body, 'proposalId'))
        if (!proposal || proposal.status !== 'draft') throw new Error('This repair proposal is no longer available. Prepare it again before applying it.')
        void recordAssistantAudit(connection.projectPath, 'repair_apply_approved', 'completed', 'Approved applying the visible scoped repair.', [proposal.id])
        try {
          const applied = await applyGuardedRepairProposal({ projectRoot: connection.projectPath, proposal, confirmation: repairApplyConfirmation })
          const packageJson = await readPackageScripts(connection.projectPath)
          const selectedCheck = selectAllowlistedCheck(packageJson)
          const packageManager = connection.discovery.packageManager === 'npm' || connection.discovery.packageManager === 'pnpm' || connection.discovery.packageManager === 'yarn' || connection.discovery.packageManager === 'bun' ? connection.discovery.packageManager : 'npm'
          const check = await runAllowlistedCheck(connection.projectPath, packageManager, selectedCheck)
          const applying = { ...applied.proposal, status: 'applying' as const, updatedAt: new Date().toISOString() }
          activeRepairProposals.set(applying.id, applying)
          await recordRepairLedger(connection.projectPath, applying, { approval: 'approved', rollback: applied.rollback, ...(check.script ? { selectedCheck: check.script } : {}) })
          void recordAssistantAudit(connection.projectPath, 'repair_apply_result', check.status === 'failed' ? 'failed' : 'completed', check.status === 'failed' ? 'Applied the scoped repair, but the selected local check did not pass.' : 'Applied the scoped repair and completed the selected local check.', [proposal.id])
          let verification: ProjectVerificationResult | undefined
          try {
            verification = await verifyConnectedProject('manual')
            const completed = { ...applying, status: 'verified' as const, updatedAt: new Date().toISOString() }
            activeRepairProposals.set(completed.id, completed)
            await recordRepairLedger(connection.projectPath, completed, { approval: 'approved', rollback: applied.rollback, ...(check.script ? { selectedCheck: check.script } : {}), outcome: { label: 'Release review refreshed', description: 'Verion recorded a new release decision after this repair.' } })
            void recordAssistantAudit(connection.projectPath, 'repair_verification_result', 'completed', 'Refreshed the release decision after a scoped repair.', [proposal.id])
            return sendJson(response, 200, { proposal: repairProposalView(completed, { label: 'Release review refreshed', description: 'Verion recorded the current release decision after this repair.' }), mission: await missionControl(), check: check.status })
          } catch {
            const failed = { ...applying, status: 'failed' as const, updatedAt: new Date().toISOString() }
            activeRepairProposals.set(failed.id, failed)
            await recordRepairLedger(connection.projectPath, failed, { approval: 'approved', rollback: applied.rollback, ...(check.script ? { selectedCheck: check.script } : {}), outcome: { label: 'Repair applied; review incomplete', description: 'The local diff remains in place. Inspect it, then verify again.' } })
            void recordAssistantAudit(connection.projectPath, 'repair_verification_result', 'failed', 'The repair was applied, but the release review did not finish.', [proposal.id])
            return sendJson(response, 200, { proposal: repairProposalView(failed, { label: 'Review incomplete', description: 'The local diff remains in place. Inspect it, then verify again.' }), mission: await missionControl(), check: check.status })
          }
        } catch (error) {
          void recordAssistantAudit(connection.projectPath, 'repair_apply_result', 'failed', 'Verion could not apply the scoped repair safely.', [proposal.id])
          const message = error instanceof Error ? error.message : ''
          const restored = /restored the partial repair/i.test(message)
          const failed = { ...proposal, status: 'failed' as const, updatedAt: new Date().toISOString() }
          activeRepairProposals.set(failed.id, failed)
          void recordRepairLedger(connection.projectPath, failed, { approval: 'approved', rollback: restored ? 'completed' : 'failed', outcome: { label: restored ? 'Repair restored' : 'Repair did not complete', description: restored ? 'Verion restored the partial local write. Prepare a new repair after inspecting the diff.' : 'Inspect the affected files before preparing another repair.' } })
          void recordAssistantAudit(connection.projectPath, 'repair_rollback_result', restored ? 'completed' : 'failed', restored ? 'Restored a partial scoped repair after a write failed.' : 'A repair write failed and needs local inspection.', [proposal.id])
          throw error
        }
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

  // Vite still injects its browser client in middleware mode. Attach that
  // client's WebSocket endpoint to Verion's own loopback server so the
  // dashboard never tries (and fails) to connect to Vite's default :24678.
  vite = await createViteServer({
    root: dashboardRoot,
    server: {
      middlewareMode: true,
      hmr: false,
      ws: { server }
    },
    appType: 'spa'
  })

  await new Promise<void>((resolveServer) => server.listen(port, host, resolveServer))
  if (options.projectPath) {
    void connectProject(options.projectPath, options.targetUrl, options.watchChanges !== false).catch(() => undefined)
  }
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

async function detectLocalTargetUrl(agentPort: number, scripts: Record<string, string> = {}): Promise<string | undefined> {
  const candidates = localAppCandidatePorts(agentPort, scripts).map((candidatePort) => `http://127.0.0.1:${candidatePort}/`)
  // Probe a handful of loopback-only candidates at a time. Script-declared
  // ports are always first, which keeps first-run detection quick without
  // asking the developer for a URL or a port.
  for (let index = 0; index < candidates.length; index += 8) {
    const reachable = await Promise.all(candidates.slice(index, index + 8).map(localHtmlAppAt))
    const match = reachable.find((url): url is string => Boolean(url))
    if (match) return match
  }
  return undefined
}

export function localAppCandidatePorts(agentPort: number, scripts: Record<string, string> = {}): number[] {
  const declared = Object.values(scripts).flatMap(portsDeclaredInScript)
  const hasRunnableAppScript = Object.entries(scripts).some(([name, command]) => /^(?:dev|start|serve|preview)$/i.test(name) && command.trim().length > 0)
  return [...new Set([...declared, ...(hasRunnableAppScript ? conventionalLocalAppPorts : [])])]
    .filter((candidate) => candidate !== agentPort && candidate > 0 && candidate <= 65_535)
}

function portsDeclaredInScript(script: string): number[] {
  const ports: number[] = []
  const patterns = [
    /--port(?:=|\s+)(\d{1,5})\b/g,
    /(?:^|\s)-p\s+(\d{1,5})\b/g,
    /\bPORT\s*=\s*(\d{1,5})\b/g
  ]
  for (const pattern of patterns) {
    for (const match of script.matchAll(pattern)) {
      const port = Number(match[1])
      if (Number.isInteger(port) && port > 0 && port <= 65_535) ports.push(port)
    }
  }
  return ports
}

async function localHtmlAppAt(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(800), redirect: 'follow' })
    return response.ok && response.headers.get('content-type')?.includes('text/html') ? url : undefined
  } catch {
    return undefined
  }
}

function shouldIgnorePath(path: string): boolean {
  if (path.split(/[\\/]/).some((part) => ignoredPathParts.has(part) || part.startsWith('.env'))) return true
  return !watchedExtensions.has(extname(path))
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

function recordAssistantAudit(projectRoot: string, kind: Parameters<typeof appendAssistantAudit>[1]['kind'], status: Parameters<typeof appendAssistantAudit>[1]['status'], summary: string, relatedIds?: string[]) {
  return appendAssistantAudit(projectRoot, { kind, status, summary, ...(relatedIds?.length ? { relatedIds } : {}) }).catch(() => undefined)
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

function readRepairSource(body: Record<string, unknown>): RepairBriefSource {
  const source = body.source
  const id = body.id
  if ((source !== 'release_report' && source !== 'security_finding') || typeof id !== 'string' || !id.trim() || id.length > 180) {
    throw new Error('Choose one current review-backed concern before preparing a repair.')
  }
  return { source, id: id.trim() }
}

function readProviderSetup(body: Record<string, unknown>): ProviderSetupInput {
  const allowed = new Set(['provider', 'model', 'endpoint', 'apiStyle', 'credentialMethod', 'credentialReference', 'apiKey'])
  if (Object.keys(body).some((field) => !allowed.has(field))) throw new Error('AI setup includes an unsupported field.')
  const provider = body.provider
  const model = body.model
  const credentialMethod = body.credentialMethod
  if ((provider !== 'openai_compatible' && provider !== 'gemini' && provider !== 'openrouter' && provider !== 'ollama') || typeof model !== 'string' || (credentialMethod !== 'environment' && credentialMethod !== 'project_env' && credentialMethod !== 'none')) {
    throw new Error('Choose a provider, model, and credential method.')
  }
  if (body.endpoint !== undefined && typeof body.endpoint !== 'string') throw new Error('Provider endpoint must be a string.')
  if (body.apiStyle !== undefined && body.apiStyle !== 'responses' && body.apiStyle !== 'chat_completions') throw new Error('Choose a supported OpenAI-compatible API style.')
  if (body.credentialReference !== undefined && typeof body.credentialReference !== 'string') throw new Error('Credential reference must be a string.')
  if (body.apiKey !== undefined && typeof body.apiKey !== 'string') throw new Error('API key must be a string.')
  return {
    provider,
    model,
    credentialMethod,
    ...(typeof body.endpoint === 'string' && body.endpoint.trim() ? { endpoint: body.endpoint } : {}),
    ...(body.apiStyle === 'responses' || body.apiStyle === 'chat_completions' ? { apiStyle: body.apiStyle } : {}),
    ...(typeof body.credentialReference === 'string' && body.credentialReference.trim() ? { credentialReference: body.credentialReference } : {}),
    ...(typeof body.apiKey === 'string' && body.apiKey.trim() ? { apiKey: body.apiKey } : {})
  }
}

async function readPackageScripts(projectRoot: string): Promise<Record<string, string> | undefined> {
  try {
    const parsed = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
    const scripts = (parsed as Record<string, unknown>).scripts
    if (!scripts || typeof scripts !== 'object' || Array.isArray(scripts)) return undefined
    return Object.fromEntries(Object.entries(scripts).flatMap(([name, command]) => typeof command === 'string' ? [[name, command]] : []))
  } catch { return undefined }
}

function readAssistantQuestion(body: Record<string, unknown>): { question: string; sourceConsent?: boolean } {
  const fields = Object.keys(body)
  if (!fields.includes('question') || fields.some((field) => field !== 'question' && field !== 'sourceConsent')) throw new Error('The teammate accepts one question at a time.')
  if (body.sourceConsent !== undefined && typeof body.sourceConsent !== 'boolean') throw new Error('Code-context permission must be a single yes or no choice.')
  return { question: readRequiredString(body, 'question'), ...(typeof body.sourceConsent === 'boolean' ? { sourceConsent: body.sourceConsent } : {}) }
}

function readForgetConfirmation(body: Record<string, unknown>) {
  const fields = Object.keys(body)
  if (fields.length !== 1 || fields[0] !== 'confirmation' || body.confirmation !== 'Forget this project memory') {
    throw new Error('Confirm “Forget this project memory” before clearing this local project memory.')
  }
}

function readOptionalTargetUrl(body: Record<string, unknown>): string | undefined {
  const value = body.targetUrl
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw new Error('targetUrl must be a string.')
  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('targetUrl must use http or https.')
  return url.toString()
}

async function learnConnectedProject(projectPath: string, onProgress?: (progress: ProjectLearningProgress) => void | Promise<void>): Promise<LearnedProject> {
  try {
    return await learnProject(resolveHomePath(projectPath), { onProgress })
  } catch (error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
    if (code === 'ENOENT') {
      throw new Error(`Project directory does not exist: ${projectPath}. Enter its full path, for example /home/your-name/projects/app, or use ~/projects/app.`)
    }
    throw error
  }
}

function learningProgressFor(progress: ProjectLearningProgress, current: LearningProgress): LearningProgress {
  const facts = progress.stage === 'discovery'
    ? discoveryLearningFacts(progress.discovery)
    : [...current.facts, ...understandingLearningFacts(progress.understanding)]
  return {
    state: 'learning',
    projectName: current.projectName,
    message: progress.stage === 'discovery' ? 'Mapping the project structure.' : 'Connecting the product areas that matter.',
    facts: uniqueLearningFacts(facts).slice(0, 5)
  }
}

function discoveryLearningFacts(discovery: ProjectDiscovery): LearningProgress['facts'] {
  const framework = discovery.framework === 'nextjs' ? 'Next.js detected' : discovery.framework === 'vite' ? 'Vite detected' : discovery.framework === 'react' ? 'React detected' : undefined
  return [
    ...(framework ? [{ id: `framework:${discovery.framework}`, label: framework }] : []),
    ...(discovery.routes.length ? [{ id: 'routes', label: `${discovery.routes.length} ${discovery.routes.length === 1 ? 'route' : 'routes'} mapped` }] : [])
  ]
}

function understandingLearningFacts(understanding: ProjectUnderstanding): LearningProgress['facts'] {
  const detected = understanding.technologies.slice(0, 4).map((technology) => ({ id: `technology:${technology.id}`, label: `${technology.label} detected` }))
  return [
    ...detected,
    ...(understanding.authentication ? [{ id: 'authentication', label: 'Authentication detected' }] : []),
    ...(understanding.payments ? [{ id: 'billing', label: 'Billing detected' }] : []),
    ...(understanding.database ? [{ id: 'database', label: `${understanding.database} detected` }] : []),
    ...(understanding.productAreas.some((area) => /dashboard|workspace/i.test(area)) ? [{ id: 'dashboard', label: 'Dashboard detected' }] : [])
  ]
}

function uniqueLearningFacts(facts: LearningProgress['facts']): LearningProgress['facts'] {
  const seen = new Set<string>()
  return facts.filter((fact) => !seen.has(fact.id) && (seen.add(fact.id), true))
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
      scripts: discovery.scripts,
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

export function createMissionControl(memory: ProjectMemory, reviewSnapshot?: ReviewSnapshot, options: { nativeFixAvailable?: boolean; securityReviewSnapshot?: SecurityReviewSnapshot } = {}): MissionControl {
  const securityFindings = publicSecurityFindings(memory.securityFindings, { nativeFixAvailable: options.nativeFixAvailable })
  const effectiveLatestReport = reportForSecurityRelease(memory, securityFindings)
  const storedReports = effectiveLatestReport
    ? [effectiveLatestReport, ...memory.releaseReports.filter((report) => report.id !== effectiveLatestReport.id)].slice(0, 3)
    : memory.releaseReports.slice(0, 3)
  const reports = storedReports.map((report) => missionReport(report))
  const latestReport = reports[0]
  const rememberedCurrentChange = currentChangeForMemory(memory)
  const currentChange = reviewSnapshot && !reviewSnapshot.paused
    ? reviewingCurrentChange(reviewSnapshot)
    : reviewSnapshot?.paused
      ? reviewSnapshot.currentChange
      : rememberedCurrentChange
  const recentChanges = currentChange.groups
  const likelyImpact = currentChange.likelyImpact.map(({ id, label }) => ({ id, label }))
  return {
    project: {
      id: projectIdentity(memory.profile.projectRoot),
      name: memory.profile.name,
      understanding: missionUnderstanding(memory.understanding)
    },
    onboardingRequired: !memory.onboardingCompletedAt,
    currentChange,
    hasChangeBaseline: rememberedCurrentChange.state !== 'baseline_not_established',
    likelyImpact,
    recentChanges,
    knownUserJourneys: missionJourneys(memory.knownUserJourneys),
    localMemory: {
      firstLearnedAt: memory.profile.firstLearnedAt,
      lastLearnedAt: memory.profile.lastLearnedAt,
      lastVerifiedAt: memory.profile.lastVerifiedAt,
      knownJourneyCount: memory.knownUserJourneys.length,
      reviewCount: memory.verificationHistory.length,
      knownIssueCount: memory.knownIssues.filter((issue) => issue.status === 'open').length
    },
    deepSecurity: missionDeepSecurity(memory, options.securityReviewSnapshot, securityFindings),
    securityFindings,
    nativeRepairAvailable: Boolean(options.nativeFixAvailable),
    currentStatus: missionStatus(Boolean(reviewSnapshot && !reviewSnapshot.paused), latestReport, Boolean(reviewSnapshot?.paused)),
    recentReports: reports,
    review: reviewSnapshot ? missionReview(reviewSnapshot, recentChanges) : undefined
  }
}

function projectIdentity(projectRoot: string): string {
  return createHash('sha256').update(projectRoot).digest('hex').slice(0, 16)
}

function missionReview(snapshot: ReviewSnapshot, changes: MissionControl['recentChanges']): MissionReview {
  const order: ReviewStage[] = [
    'understanding',
    'reviewing_changes',
    'checking_product',
    'making_decision'
  ]
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

function securityReviewResultStatus(evidence: Evidence[]): 'completed' | 'concern' | 'partial' | 'failed' {
  const review = evidence.find((item) => item.kind === 'security_review' && item.producer === 'deep-security-review')
  const status = record(review?.data).status
  return status === 'completed' || status === 'concern' || status === 'partial' || status === 'failed' ? status : 'failed'
}

function reviewObservation(evidence: Evidence): ReviewObservation | undefined {
  const data = record(evidence.data)
  if (evidence.kind === 'browser_exploration') {
    if (data.status === 'failed') return { tone: 'warning', message: typeof data.guidance === 'string' ? data.guidance : 'The running app could not be opened.' }
    const status = numberValue(data.status)
    if (status && status >= 400) return httpObservation(status, evidence.location?.url)
    if (typeof data.journeyLabel === 'string' && data.journeyLabel.trim()) {
      return { tone: 'success', message: `Reviewed ${data.journeyLabel.trim()}.` }
    }
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
    technologies: understanding.technologies.map(({ id, label, kind }) => ({ id, label, kind })),
    productAreas: understanding.productAreas,
    applicationType: understanding.applicationType,
    authentication: understanding.authentication,
    payments: understanding.payments,
    database: understanding.database,
    framework: understanding.framework,
    routeCount: understanding.routeCount,
    apiCount: understanding.apiCount,
    model: understanding.model ? {
      thesis: understanding.model.thesis,
      keyEntities: items('entity', understanding.model.keyEntities),
      priorityJourneys: understanding.model.priorityJourneys.slice(0, 4).map(({ label, reason }, index) => ({ id: `model-journey-${index + 1}`, label, reason })),
      reviewFocus: understanding.model.reviewFocus,
      updatedAt: understanding.model.updatedAt
    } : undefined,
    userJourneys: items('journey', understanding.userJourneys),
    criticalBusinessFlows: items('flow', understanding.criticalBusinessFlows),
    importantPages: items('page', understanding.importantPages),
    importantApis: items('api', understanding.importantApis)
  }
}

function missionDeepSecurity(memory: ProjectMemory, snapshot?: SecurityReviewSnapshot, findings: PublicSecurityFinding[] = []): MissionControl['deepSecurity'] {
  if (snapshot?.status === 'reviewing') {
    return {
      status: 'reviewing', label: 'Reviewing', description: 'Verion is reviewing the release-critical security areas you started.',
      estimatedDuration: 'In progress', canStart: false, canRetry: false, progress: securityProgress(snapshot)
    }
  }
  if (snapshot?.status === 'failed') {
    return {
      status: 'failed', label: 'Review incomplete', description: 'Deep Security Review could not finish, so Verion cannot make a complete release call yet.',
      estimatedDuration: 'Retry when ready', canStart: false, canRetry: true, progress: securityProgress(snapshot)
    }
  }
  if (snapshot?.status === 'concern') {
    return {
      status: 'concern', label: 'Needs attention', description: 'A security concern is included in the same release decision.',
      estimatedDuration: 'Completed', canStart: true, canRetry: false, completedAt: memory.securityReview?.completedAt, progress: securityProgress(snapshot)
    }
  }
  if (snapshot?.status === 'partial') {
    return {
      status: 'partial', label: 'Review incomplete', description: 'Verion completed the available local checks, but at least one specialist check was unavailable. Do not treat this as a complete security decision.',
      estimatedDuration: 'Retry when ready', canStart: true, canRetry: true, completedAt: memory.securityReview?.completedAt, progress: securityProgress(snapshot)
    }
  }
  if (snapshot?.status === 'completed') {
    return {
      status: 'completed', label: 'Reviewed', description: 'No critical or high concern changed the release decision.',
      estimatedDuration: 'Completed', canStart: true, canRetry: false, completedAt: memory.securityReview?.completedAt, progress: securityProgress(snapshot)
    }
  }
  if (memory.securityReview?.status === 'failed') {
    return { status: 'failed', label: 'Review incomplete', description: 'The latest Deep Security Review did not finish. Retry it before relying on a complete release call.', estimatedDuration: 'Retry when ready', canStart: false, canRetry: true, completedAt: memory.securityReview.completedAt }
  }
  if (memory.securityReview?.status === 'partial') {
    return { status: 'partial', label: 'Review incomplete', description: 'The latest Deep Security Review was missing at least one specialist local check. Retry it before relying on a complete release call.', estimatedDuration: 'Retry when ready', canStart: true, canRetry: true, completedAt: memory.securityReview.completedAt }
  }
  if (memory.securityReview?.status === 'concern' || findings.length > 0) {
    return { status: 'concern', label: 'Needs attention', description: 'A saved security concern contributes to the current release decision.', estimatedDuration: 'Completed', canStart: true, canRetry: false, completedAt: memory.securityReview?.completedAt }
  }
  if (memory.securityReview?.status === 'completed') {
    return { status: 'completed', label: 'Reviewed', description: 'Deep Security Review was included in the latest release decision.', estimatedDuration: 'Completed', canStart: true, canRetry: false, completedAt: memory.securityReview.completedAt }
  }
  return { status: 'available', label: 'Ready', description: 'Start a bounded local review when this release needs a security decision.', estimatedDuration: 'Usually a few minutes', canStart: true, canRetry: false }
}

function initialSecurityReviewSnapshot(): SecurityReviewSnapshot {
  const stations = securityReviewStations()
  stations[0] = { ...stations[0], state: 'current', detail: 'Sealing the local project scope.' }
  return { status: 'reviewing', message: 'Sealing the local project scope.', stations }
}

function applySecurityReviewProgress(snapshot: SecurityReviewSnapshot, progress: SecurityReviewProgress): SecurityReviewSnapshot {
  const state: SecurityReviewStation['state'] = progress.state === 'started' ? 'current' : progress.state
  const stations = snapshot.stations.map((station) => station.id === progress.station ? { ...station, state, detail: progress.detail } : station)
  return {
    status: progress.state === 'failed' ? 'failed' : 'reviewing',
    message: progress.detail,
    stations
  }
}

function completeSecurityReviewSnapshot(snapshot: SecurityReviewSnapshot, status: 'completed' | 'concern' | 'partial' | 'failed'): SecurityReviewSnapshot {
  if (status === 'failed') return failSecurityReviewSnapshot(snapshot)
  const message = status === 'concern'
    ? 'A security concern now contributes to this release decision.'
    : status === 'partial'
      ? 'The available checks finished, but the security review is incomplete.'
    : 'No critical or high concern changed this release decision.'
  const stations = snapshot.stations.map((station) => station.id === 'decision' && station.state === 'current'
    ? { ...station, state: status === 'partial' ? 'skipped' as const : 'completed' as const, detail: message }
    : station)
  return { status, message, stations }
}

function failSecurityReviewSnapshot(snapshot: SecurityReviewSnapshot): SecurityReviewSnapshot {
  const stations = snapshot.stations.map((station) => station.state === 'current'
    ? { ...station, state: 'failed' as const, detail: 'This part of the local review could not finish.' }
    : station)
  return { status: 'failed', message: 'Deep Security Review could not finish.', stations }
}

function securityReviewStations(): SecurityReviewStation[] {
  return [
    { id: 'scope', label: 'Project scope', state: 'pending', detail: 'Waiting to establish the local review scope.' },
    { id: 'code', label: 'Code paths', state: 'pending', detail: 'Waiting to review local code paths.' },
    { id: 'credentials', label: 'Credentials', state: 'pending', detail: 'Waiting to review eligible files for exposed credentials.' },
    { id: 'dependencies', label: 'Dependencies', state: 'pending', detail: 'Waiting to review dependency manifests and lockfiles.' },
    { id: 'configuration', label: 'Configuration', state: 'pending', detail: 'Waiting to review deployment and workflow configuration.' },
    { id: 'running_experience', label: 'Running experience', state: 'pending', detail: 'Waiting to check the reachable local app.' },
    { id: 'decision', label: 'Release decision', state: 'pending', detail: 'Waiting to bring the review into one decision.' }
  ]
}

function securityProgress(snapshot: SecurityReviewSnapshot): SecurityReviewProgressView {
  return {
    state: snapshot.status,
    currentMessage: snapshot.message,
    label: snapshot.message,
    completedSteps: snapshot.stations.filter((station) => station.state === 'completed' || station.state === 'skipped').length,
    totalSteps: snapshot.stations.length,
    stations: snapshot.stations
  }
}

function reportForSecurityRelease(memory: ProjectMemory, findings: PublicSecurityFinding[]): StoredReleaseReport | undefined {
  const latest = memory.releaseReports[0]
  const concern = findings.find((finding) => finding.severity === 'critical' || finding.severity === 'high')
  if (!concern || latest?.recommendation === 'needs_attention') return latest
  const completedAt = concern.id ? memory.securityReview?.completedAt ?? memory.updatedAt : memory.updatedAt
  return {
    id: latest?.id ?? `security-decision:${concern.id}`,
    completedAt,
    recommendation: 'needs_attention',
    confidence: 'high',
    headline: 'Needs attention',
    rootCause: `${concern.headline}. ${concern.explanation}`,
    reasons: [concern.evidence, concern.suggestedAction],
    evidenceIds: [],
    nextAction: concern.suggestedAction
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

function missionStatus(reviewing: boolean, report?: MissionReport, reviewPaused = false): MissionControl['currentStatus'] {
  if (reviewing) return { kind: 'reviewing', label: 'Reviewing now', description: 'Verion is looking through the latest version.' }
  if (reviewPaused) return { kind: 'inconclusive', label: 'Review incomplete', description: 'Verion could not finish the current review. Verify again when the project is ready.' }
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

function currentChangeForMemory(memory: ProjectMemory): CurrentChange {
  const baselineEstablished = Boolean(memory.profile.lastVerifiedAt && memory.verificationHistory.length > 0)
  if (!baselineEstablished) {
    return {
      state: 'baseline_not_established',
      label: 'Baseline needed',
      description: 'Your first review will create the comparison point for this project.',
      groups: [],
      likelyImpact: []
    }
  }

  const changes = changesAfterVerifiedBaseline(memory)
  if (changes.length === 0) {
    return {
      state: 'no_change',
      label: 'No change since last review',
      description: 'Verion has not found a newer local project snapshot to review.',
      groups: [],
      likelyImpact: []
    }
  }

  const paths = uniqueChangedPaths(changes)
  return {
    state: 'change_detected',
    label: 'Change detected',
    description: 'A newer local project snapshot is ready for review.',
    detectedAt: changes[0]?.detectedAt,
    groups: missionChangeGroups(changes),
    likelyImpact: inferLikelyImpact(paths, memory)
  }
}

function reviewingCurrentChange(snapshot: ReviewSnapshot): CurrentChange {
  const beforeReview = snapshot.currentChange
  const stageCopy: Partial<Record<ReviewStage, string>> = {
    understanding: 'Verion is refreshing its picture of the project before the release decision.',
    reviewing_changes: 'Verion is reviewing the latest project change and the product areas it may affect.',
    checking_product: 'Verion is checking the product paths that matter for this release.',
    making_decision: 'Verion is bringing the review together into one release decision.'
  }
  return {
    ...beforeReview,
    state: 'reviewing_change',
    label: 'Reviewing latest change',
    description: stageCopy[snapshot.stage] ?? 'Verion is reviewing the latest change.'
  }
}

function changesAfterVerifiedBaseline(memory: ProjectMemory): RecentProjectChange[] {
  const lastVerifiedAt = memory.profile.lastVerifiedAt
  if (!lastVerifiedAt) return []
  return memory.recentChanges.filter((change) => change.detectedAt > lastVerifiedAt)
}

function uniqueChangedPaths(changes: RecentProjectChange[]): string[] {
  return [...new Set(changes.flatMap((change) => [...change.added, ...change.modified, ...change.removed]))]
}

function missionChangeGroups(changes: RecentProjectChange[]): CurrentChange['groups'] {
  const groups: CurrentChange['groups'] = []
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

function inferLikelyImpact(paths: string[], memory: ProjectMemory): CurrentChange['likelyImpact'] {
  if (paths.length === 0) return []
  const joinedPaths = paths.join(' ').toLowerCase()
  const priorReviewText = memory.releaseReports.slice(0, 5)
    .flatMap((report) => [report.headline, report.rootCause, ...report.reasons])
    .join(' ')
    .toLowerCase()
  const impact: CurrentChange['likelyImpact'] = []
  const add = (label: string, reason: string, supported: boolean) => {
    if (!supported || impact.some((candidate) => candidate.label.toLowerCase() === label.toLowerCase())) return
    impact.push({ id: `impact-${impact.length + 1}`, label, reason })
  }
  const reasonWithReviewContext = (label: string, reason: string) => pathMatchesLabel(priorReviewText, label)
    ? `${reason} A prior review also mentioned this area.`
    : reason

  add('Billing', reasonWithReviewContext('Billing', 'Changed work mentions billing or checkout.'), /(?:^|[\\/_-])(?:billing|checkout|subscription|payment|invoice|stripe)(?:[\\/_\-.]|$)/.test(joinedPaths))
  add('Authentication', reasonWithReviewContext('Authentication', 'Changed work mentions sign-in or account access.'), /(?:^|[\\/_-])(?:auth|sign-in|signin|sign-up|signup|login|session|clerk|account)(?:[\\/_\-.]|$)/.test(joinedPaths))
  add('Dashboard', reasonWithReviewContext('Dashboard', 'Changed work mentions the dashboard or workspace.'), /(?:^|[\\/_-])(?:dashboard|workspace|admin)(?:[\\/_\-.]|$)/.test(joinedPaths))
  add('Settings', reasonWithReviewContext('Settings', 'Changed work mentions settings or profile preferences.'), /(?:^|[\\/_-])(?:settings|preferences|profile)(?:[\\/_\-.]|$)/.test(joinedPaths))

  for (const label of memory.understanding.productAreas) {
    if (isSpecificProductLabel(label) && pathMatchesLabel(joinedPaths, label)) add(label, reasonWithReviewContext(label, `The changed area aligns with the learned ${label.toLowerCase()} product area.`), true)
  }
  for (const journey of memory.knownUserJourneys) {
    if (isSpecificProductLabel(journey.label) && pathMatchesLabel(joinedPaths, journey.label)) add(journey.label, reasonWithReviewContext(journey.label, `The changed area relates to the remembered ${journey.label.toLowerCase()} journey.`), true)
  }
  for (const route of memory.knownRoutes) {
    const label = routeLabel(route.path)
    if (isSpecificProductLabel(label) && pathMatchesRoute(joinedPaths, route.path)) add(label, reasonWithReviewContext(label, `The changed area is associated with a learned ${label.toLowerCase()} route.`), true)
  }

  return impact.slice(0, 3)
}

function pathMatchesLabel(paths: string, label: string): boolean {
  const terms = label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((part) => part.length > 2)
  return terms.some((term) => new RegExp(`(?:^|[\\/_-])${escapeRegExp(term)}(?:[\\/_\\-.]|$)`).test(paths))
}

function pathMatchesRoute(paths: string, route: string): boolean {
  const terms = route.toLowerCase().split('/').filter((part) => part.length > 2 && !part.startsWith(':') && !part.startsWith('['))
  return terms.some((term) => new RegExp(`(?:^|[\\/_-])${escapeRegExp(term)}(?:[\\/_\\-.]|$)`).test(paths))
}

function routeLabel(route: string): string {
  const parts = route.split('/').filter((part) => part && !part.startsWith(':') && !part.startsWith('['))
  if (parts.length === 0) return 'Home'
  return parts.map((part) => part.replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())).join(' ')
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

function securityFindingId(requestUrl: string | undefined): string | undefined {
  const match = requestUrl?.match(/^\/api\/security\/findings\/([^/]+)\/fix-prompt$/)
  const id = match?.[1] ? decodeURIComponent(match[1]) : undefined
  return id && /^security:[a-f0-9]{8,64}$/.test(id) ? id : undefined
}

function screenshotPathFor(id: string, evidence: Evidence[]): string | undefined {
  const item = evidence.find((candidate) => candidate.id === id && candidate.kind === 'screenshot')
  if (!item || !item.data || typeof item.data !== 'object' || !('path' in item.data)) return undefined
  return typeof item.data.path === 'string' ? item.data.path : undefined
}

if (process.argv[1]?.endsWith('server.ts')) {
  startVerionServer({ projectPath: process.cwd() }).then(({ url }) => console.log(`Verion is ready at ${url}`))
}
