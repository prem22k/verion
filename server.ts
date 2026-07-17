import { readFile } from 'node:fs/promises'
import { watch, type FSWatcher } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer as createViteServer } from 'vite'
import { completeProjectOnboarding, learnProject, type LearnedProject } from './agent/core/projectMemory'
import { getGptDiagnosisStatus } from './agent/core/runtimeConfig'
import type { Evidence, ProjectDiscovery, ProjectUnderstanding, ProjectVerificationResult, ReleaseRecommendation } from './agent/core/types'
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

type AgentEvent =
  | { type: 'connected'; connection: ConnectedProject }
  | { type: 'disconnected' }
  | { type: 'change_detected'; path: string }
  | { type: 'verification_started'; trigger: 'manual' | 'change' }
  | { type: 'verification_completed'; trigger: 'manual' | 'change'; result: ProjectVerificationResult }
  | { type: 'attention_required'; report: NonNullable<ProjectVerificationResult['report']> }
  | { type: 'watcher_error'; message: string }

export async function startVerionServer(options: StartVerionServerOptions = {}) {
  const port = options.port ?? 5173
  const vite = await createViteServer({ root: dashboardRoot, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'spa' })
  const eventClients = new Set<ServerResponse>()
  let connection: ConnectedProject | undefined
  let watcher: FSWatcher | undefined
  let changeTimer: NodeJS.Timeout | undefined
  let verificationRunning = false
  let queuedChangeVerification = false
  let lastResult: ProjectVerificationResult | undefined
  let lastRecommendation: ReleaseRecommendation | undefined

  const broadcast = (event: AgentEvent) => {
    const payload = `data: ${JSON.stringify(event)}\n\n`
    for (const client of eventClients) client.write(payload)
  }

  const closeWatcher = () => {
    watcher?.close()
    watcher = undefined
    if (changeTimer) clearTimeout(changeTimer)
    changeTimer = undefined
  }

  const verifyConnectedProject = async (trigger: 'manual' | 'change') => {
    if (!connection) throw new Error('Connect a project before starting verification.')
    if (verificationRunning) {
      if (trigger === 'change') queuedChangeVerification = true
      if (trigger === 'manual') throw new Error('A verification is already running.')
      return lastResult
    }

    verificationRunning = true
    broadcast({ type: 'verification_started', trigger })
    try {
      await refreshProjectUnderstanding()
      await detectTargetForConnectedProject()
      const previousRecommendation = lastRecommendation
      const result = await runProjectVerification({
        projectPath: connection.projectPath,
        targetUrl: connection.targetUrl,
        diagnose: true,
        trigger
      })
      lastResult = result
      lastRecommendation = result.report?.recommendation
      broadcast({ type: 'verification_completed', trigger, result })
      if (result.report?.recommendation === 'needs_attention' && previousRecommendation !== 'needs_attention') {
        broadcast({ type: 'attention_required', report: result.report })
      }
      return result
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
      void verifyConnectedProject('change').catch((error: unknown) => {
        broadcast({ type: 'watcher_error', message: error instanceof Error ? error.message : 'Background verification failed.' })
      })
    }, changeDebounceMs)
  }

  const startWatcher = () => {
    closeWatcher()
    if (!connection?.watchChanges) return
    try {
      watcher = watch(connection.projectPath, { recursive: true }, (_eventType, filename) => {
        const path = filename?.toString() ?? ''
        if (!path || shouldIgnorePath(path)) return
        broadcast({ type: 'change_detected', path })
        scheduleChangeVerification()
      })
      watcher.on('error', (error) => broadcast({ type: 'watcher_error', message: error.message }))
    } catch (error: unknown) {
      broadcast({ type: 'watcher_error', message: error instanceof Error ? error.message : 'Project watcher could not start.' })
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
    broadcast({ type: 'connected', connection })
    return connection
  }

  const detectTargetForConnectedProject = async () => {
    if (!connection || connection.targetUrl) return
    const targetUrl = await detectLocalTargetUrl(port)
    if (!targetUrl) return
    connection = { ...connection, targetUrl }
    broadcast({ type: 'connected', connection })
  }

  const refreshProjectUnderstanding = async () => {
    if (!connection) return
    const learned = await learnConnectedProject(connection.projectPath)
    connection = connectedProjectFromLearning(learned, connection)
    broadcast({ type: 'connected', connection })
  }

  const server = createServer(async (request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/api/connection') {
        return sendJson(response, 200, { connection })
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
        return sendJson(response, 200, { connection })
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
        broadcast({ type: 'connected', connection })
        return sendJson(response, 200, { connection })
      }

      if (request.method === 'POST' && request.url === '/api/verify') {
        const result = await verifyConnectedProject('manual')
        return sendJson(response, 200, result)
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
