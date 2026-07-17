import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { buildRepositoryGraph } from './repositoryGraph'
import { discoverProject, resolveProjectFile } from './projectDiscovery'
import type { Evidence, KnownIssue, KnownUserJourney, ProjectDiscovery, ProjectFileSnapshot, ProjectMemory, ProjectRoute, ProjectTechnology, ProjectUnderstanding, ProjectVerificationResult, RecentProjectChange, ReleaseRecommendation, StoredReleaseReport, VerificationHistoryEntry } from './types'

const memoryDirectoryName = '.verion'
const memoryFileName = 'project-memory.json'
const historyLimit = 30
const changeLimit = 30
const issueLimit = 50
const changedFileLimit = 100

export type LearnedProject = {
  discovery: ProjectDiscovery
  memory: ProjectMemory
  memoryState: 'first_run' | 'remembered' | 'updated'
}

export async function learnProject(projectPath: string): Promise<LearnedProject> {
  const discovery = await discoverProject(projectPath)
  const { signature, fileSnapshot } = await createProjectSnapshot(discovery)
  const existing = await readProjectMemory(discovery.projectRoot)
  const canReuse = existing?.signature === signature && Object.keys(existing.fileSnapshot).length > 0
  if (canReuse && existing) {
    return {
      discovery,
      memory: { ...existing, discovery },
      memoryState: existing.onboardingCompletedAt ? 'remembered' : 'first_run'
    }
  }

  const graph = await buildRepositoryGraph(discovery)
  const now = new Date().toISOString()
  const understanding = await understandProject(discovery)
  const memory: ProjectMemory = {
    version: 2,
    profile: {
      name: discovery.packageName ?? basename(discovery.projectRoot),
      projectRoot: discovery.projectRoot,
      framework: discovery.framework,
      packageManager: discovery.packageManager,
      firstLearnedAt: existing?.profile.firstLearnedAt ?? now,
      lastLearnedAt: now,
      lastVerifiedAt: existing?.profile.lastVerifiedAt
    },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    onboardingCompletedAt: existing?.onboardingCompletedAt,
    signature,
    discovery,
    graph,
    understanding,
    knownTechnologies: understanding.technologies,
    knownRoutes: discovery.routes,
    knownUserJourneys: mergeJourneys(existing?.knownUserJourneys ?? [], projectJourneys(discovery.routes, now)),
    verificationHistory: existing?.verificationHistory ?? [],
    releaseReports: existing?.releaseReports ?? [],
    knownIssues: existing?.knownIssues ?? [],
    recentChanges: appendRecentChange(existing?.recentChanges ?? [], detectProjectChange(existing?.fileSnapshot, fileSnapshot, now)),
    fileSnapshot
  }
  await writeProjectMemory(memory)
  return { discovery, memory, memoryState: existing ? 'updated' : 'first_run' }
}

export async function recordProjectVerification(projectPath: string, result: ProjectVerificationResult, trigger: 'manual' | 'change' | 'cli'): Promise<ProjectMemory> {
  const learned = await learnProject(projectPath)
  const memory = learned.memory
  const completedAt = new Date().toISOString()
  const recommendation = result.report?.recommendation ?? 'inconclusive'
  const historyEntry: VerificationHistoryEntry = {
    id: `verification:${completedAt}:${shortHash(`${recommendation}:${result.evidence.map((item) => item.id).join(',')}`)}`,
    completedAt,
    trigger,
    recommendation,
    evidenceCounts: countEvidence(result.evidence),
    diagnosisUnavailable: result.diagnosisUnavailable
  }
  const report = result.report ? storedReport(result.report, completedAt) : undefined
  const next: ProjectMemory = {
    ...memory,
    profile: { ...memory.profile, lastVerifiedAt: completedAt },
    updatedAt: completedAt,
    knownUserJourneys: mergeJourneys(memory.knownUserJourneys, browserJourneys(result.evidence, completedAt)),
    verificationHistory: [historyEntry, ...memory.verificationHistory].slice(0, historyLimit),
    releaseReports: report ? [report, ...memory.releaseReports].slice(0, historyLimit) : memory.releaseReports,
    knownIssues: updateKnownIssues(memory.knownIssues, report, recommendation, completedAt)
  }
  await writeProjectMemory(next)
  return next
}

export async function completeProjectOnboarding(projectRoot: string): Promise<ProjectMemory | undefined> {
  const memory = await readProjectMemory(projectRoot)
  if (!memory) return undefined
  const next = { ...memory, onboardingCompletedAt: memory.onboardingCompletedAt ?? new Date().toISOString() }
  await writeProjectMemory(next)
  return next
}

async function understandProject(discovery: ProjectDiscovery): Promise<ProjectUnderstanding> {
  const dependencies = await readDependencies(discovery.projectRoot)
  const technologies = await detectTechnologies(discovery, dependencies)
  const productAreas = detectProductAreas(discovery, technologies)
  const routeCount = discovery.routes.length
  const apiCount = discovery.files.filter((file) => /^app\/api\/.+\/route\.(?:ts|tsx|js|jsx)$/.test(file) || /^pages\/api\/.+\.(?:ts|tsx|js|jsx)$/.test(file)).length
  return {
    technologies,
    productAreas,
    routeCount,
    apiCount,
    summary: buildSummary(discovery, productAreas, technologies)
  }
}

async function readDependencies(projectRoot: string): Promise<Set<string>> {
  try {
    const manifest = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    return new Set([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})])
  } catch {
    return new Set()
  }
}

async function detectTechnologies(discovery: ProjectDiscovery, dependencies: Set<string>): Promise<ProjectTechnology[]> {
  const technologies: ProjectTechnology[] = []
  const add = (id: string, label: string, kind: ProjectTechnology['kind'], condition: boolean) => {
    if (condition && !technologies.some((technology) => technology.id === id)) technologies.push({ id, label, kind })
  }
  add('nextjs', 'Next.js', 'framework', discovery.framework === 'nextjs' || dependencies.has('next'))
  add('vite', 'Vite', 'framework', discovery.framework === 'vite' || dependencies.has('vite'))
  add('react', 'React', 'framework', dependencies.has('react') || dependencies.has('react-dom'))
  add('typescript', 'TypeScript', 'library', discovery.files.some((file) => /\.(?:ts|tsx|mts|cts)$/.test(file)))
  add('react-server-components', 'React Server Components', 'library', discovery.framework === 'nextjs' && discovery.files.some((file) => file.startsWith('app/')))
  add('clerk', 'Clerk Authentication', 'service', [...dependencies].some((dependency) => dependency.startsWith('@clerk/')))
  add('stripe', 'Stripe', 'service', dependencies.has('stripe') || dependencies.has('@stripe/stripe-js'))
  add('postgresql', 'PostgreSQL', 'database', [...dependencies].some((dependency) => ['pg', 'postgres', '@neondatabase/serverless', '@vercel/postgres'].includes(dependency)) || await usesPostgresPrisma(discovery))
  add('prisma', 'Prisma', 'library', dependencies.has('@prisma/client') || dependencies.has('prisma'))
  return technologies
}

async function usesPostgresPrisma(discovery: ProjectDiscovery): Promise<boolean> {
  const schema = discovery.files.find((file) => file.endsWith('schema.prisma'))
  if (!schema) return false
  try {
    return /provider\s*=\s*["']postgresql["']/.test(await readFile(resolveProjectFile(discovery.projectRoot, schema), 'utf8'))
  } catch {
    return false
  }
}

function detectProductAreas(discovery: ProjectDiscovery, technologies: ProjectTechnology[]): string[] {
  const haystack = [...discovery.files, ...discovery.routes.map((route) => route.path)].join(' ').toLowerCase()
  const areas: string[] = []
  const add = (label: string, condition: boolean) => {
    if (condition && !areas.includes(label)) areas.push(label)
  }
  add('Dashboard', /dashboard|workspace|admin/.test(haystack))
  add('Billing', /billing|subscription|checkout|payment|invoice/.test(haystack) || technologies.some((technology) => technology.id === 'stripe'))
  add('Authentication', /auth|sign-in|signin|sign-up|signup|login|account/.test(haystack) || technologies.some((technology) => technology.id === 'clerk'))
  add('API', discovery.files.some((file) => /^app\/api\//.test(file) || /^pages\/api\//.test(file)))
  return areas.slice(0, 4)
}

function buildSummary(discovery: ProjectDiscovery, areas: string[], technologies: ProjectTechnology[]): string {
  const hasDashboard = areas.includes('Dashboard')
  const hasBilling = areas.includes('Billing')
  const hasAuthentication = areas.includes('Authentication')
  if (hasDashboard && hasBilling && hasAuthentication) return 'I think this is a SaaS dashboard with authentication and billing.'
  if (hasDashboard && hasAuthentication) return 'I think this is a dashboard product with authenticated workspace flows.'
  if (hasAuthentication) return 'I think this is an application with an important signed-in experience.'
  const framework = technologies.find((technology) => technology.kind === 'framework')?.label ?? discovery.framework
  const routeLabel = discovery.routes.length === 1 ? 'route' : 'routes'
  return `I think this is a ${framework} application with ${discovery.routes.length} ${routeLabel} to understand.`
}

function projectJourneys(routes: ProjectRoute[], observedAt: string): KnownUserJourney[] {
  return routes.map((route) => ({
    id: `route:${route.path}`,
    label: journeyLabel(route.path),
    route: route.path,
    source: 'project',
    firstObservedAt: observedAt,
    lastObservedAt: observedAt
  }))
}

function browserJourneys(evidence: Evidence[], observedAt: string): KnownUserJourney[] {
  return evidence.flatMap((item) => {
    if (item.kind !== 'browser_exploration' || !item.location?.url || isFailedBrowserObservation(item.data)) return []
    const route = pathnameFor(item.location.url)
    if (!route) return []
    const details = item.data && typeof item.data === 'object' ? item.data as Record<string, unknown> : {}
    const title = typeof details.title === 'string' && details.title.trim() ? details.title.trim().slice(0, 120) : journeyLabel(route)
    const interactiveElementCount = Array.isArray(details.interactiveElements) ? details.interactiveElements.length : undefined
    return [{
      id: `browser:${route}`,
      label: title,
      route,
      source: 'browser' as const,
      firstObservedAt: observedAt,
      lastObservedAt: observedAt,
      interactiveElementCount
    }]
  })
}

function isFailedBrowserObservation(data: unknown): boolean {
  return Boolean(data && typeof data === 'object' && 'status' in data && data.status === 'failed')
}

function pathnameFor(url: string): string | undefined {
  try {
    return new URL(url).pathname || '/'
  } catch {
    return undefined
  }
}

function journeyLabel(route: string): string {
  if (route === '/') return 'Home'
  return route.split('/').filter(Boolean).map((part) => part.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())).join(' · ')
}

function mergeJourneys(existing: KnownUserJourney[], incoming: KnownUserJourney[]): KnownUserJourney[] {
  const journeys = new Map(existing.map((journey) => [journey.id, journey]))
  for (const journey of incoming) {
    const previous = journeys.get(journey.id)
    journeys.set(journey.id, previous ? {
      ...previous,
      ...journey,
      firstObservedAt: previous.firstObservedAt,
      interactiveElementCount: journey.interactiveElementCount ?? previous.interactiveElementCount
    } : journey)
  }
  return [...journeys.values()].sort((left, right) => left.label.localeCompare(right.label))
}

function countEvidence(evidence: Evidence[]): Partial<Record<Evidence['kind'], number>> {
  return evidence.reduce<Partial<Record<Evidence['kind'], number>>>((counts, item) => {
    counts[item.kind] = (counts[item.kind] ?? 0) + 1
    return counts
  }, {})
}

function storedReport(report: NonNullable<ProjectVerificationResult['report']>, completedAt: string): StoredReleaseReport {
  return {
    ...report,
    id: `report:${completedAt}:${shortHash(`${report.recommendation}:${report.headline}:${report.diagnosis}`)}`,
    completedAt
  }
}

function updateKnownIssues(issues: KnownIssue[], report: StoredReleaseReport | undefined, recommendation: ReleaseRecommendation, completedAt: string): KnownIssue[] {
  if (report?.recommendation === 'needs_attention') {
    const id = `issue:${shortHash(`${report.headline}:${report.diagnosis}`)}`
    const existing = issues.find((issue) => issue.id === id)
    const nextIssue: KnownIssue = existing ? {
      ...existing,
      headline: report.headline,
      diagnosis: report.diagnosis,
      lastSeenAt: completedAt,
      occurrences: existing.occurrences + 1,
      status: 'open',
      lastReportId: report.id
    } : {
      id,
      headline: report.headline,
      diagnosis: report.diagnosis,
      firstSeenAt: completedAt,
      lastSeenAt: completedAt,
      occurrences: 1,
      status: 'open',
      lastReportId: report.id
    }
    return [nextIssue, ...issues.filter((issue) => issue.id !== id)].slice(0, issueLimit)
  }
  if (recommendation === 'ready_to_ship') {
    return issues.map((issue) => issue.status === 'open' ? { ...issue, status: 'resolved', lastSeenAt: completedAt } : issue)
  }
  return issues
}

async function createProjectSnapshot(discovery: ProjectDiscovery): Promise<{ signature: string; fileSnapshot: ProjectFileSnapshot }> {
  const hash = createHash('sha256')
  const fileSnapshot: ProjectFileSnapshot = {}
  for (const file of discovery.files) {
    try {
      const metadata = await stat(resolveProjectFile(discovery.projectRoot, file))
      fileSnapshot[file] = { size: metadata.size, modifiedAt: metadata.mtimeMs }
      hash.update(`${file}:${metadata.size}:${metadata.mtimeMs};`)
    } catch {
      hash.update(`${file}:missing;`)
    }
  }
  return { signature: hash.digest('hex'), fileSnapshot }
}

function detectProjectChange(previous: ProjectFileSnapshot | undefined, next: ProjectFileSnapshot, detectedAt: string): RecentProjectChange | undefined {
  if (!previous || Object.keys(previous).length === 0) return undefined
  const added = Object.keys(next).filter((file) => !previous[file])
  const removed = Object.keys(previous).filter((file) => !next[file])
  const modified = Object.keys(next).filter((file) => previous[file] && (previous[file].size !== next[file].size || previous[file].modifiedAt !== next[file].modifiedAt))
  if (added.length === 0 && removed.length === 0 && modified.length === 0) return undefined
  return {
    detectedAt,
    added: added.slice(0, changedFileLimit),
    modified: modified.slice(0, changedFileLimit),
    removed: removed.slice(0, changedFileLimit)
  }
}

function appendRecentChange(changes: RecentProjectChange[], change: RecentProjectChange | undefined): RecentProjectChange[] {
  return change ? [change, ...changes].slice(0, changeLimit) : changes
}

function shortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12)
}

async function readProjectMemory(projectRoot: string): Promise<ProjectMemory | undefined> {
  try {
    const value = JSON.parse(await readFile(memoryFilePath(projectRoot), 'utf8')) as unknown
    if (isProjectMemory(value)) return value
    return migrateLegacyMemory(value, projectRoot)
  } catch {
    return undefined
  }
}

function isProjectMemory(value: unknown): value is ProjectMemory {
  return Boolean(value && typeof value === 'object' && 'version' in value && value.version === 2 && 'profile' in value && 'fileSnapshot' in value)
}

function migrateLegacyMemory(value: unknown, projectRoot: string): ProjectMemory | undefined {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) return undefined
  const legacy = value as {
    createdAt?: unknown
    updatedAt?: unknown
    onboardingCompletedAt?: unknown
    signature?: unknown
    discovery?: ProjectDiscovery
    graph?: ProjectMemory['graph']
    understanding?: ProjectUnderstanding
  }
  if (!legacy.discovery || !legacy.graph || !legacy.understanding || typeof legacy.signature !== 'string') return undefined
  const createdAt = typeof legacy.createdAt === 'string' ? legacy.createdAt : new Date().toISOString()
  const updatedAt = typeof legacy.updatedAt === 'string' ? legacy.updatedAt : createdAt
  return {
    version: 2,
    profile: {
      name: legacy.discovery.packageName ?? basename(projectRoot),
      projectRoot,
      framework: legacy.discovery.framework,
      packageManager: legacy.discovery.packageManager,
      firstLearnedAt: createdAt,
      lastLearnedAt: updatedAt
    },
    createdAt,
    updatedAt,
    onboardingCompletedAt: typeof legacy.onboardingCompletedAt === 'string' ? legacy.onboardingCompletedAt : undefined,
    signature: legacy.signature,
    discovery: legacy.discovery,
    graph: legacy.graph,
    understanding: legacy.understanding,
    knownTechnologies: legacy.understanding.technologies,
    knownRoutes: legacy.discovery.routes,
    knownUserJourneys: projectJourneys(legacy.discovery.routes, updatedAt),
    verificationHistory: [],
    releaseReports: [],
    knownIssues: [],
    recentChanges: [],
    fileSnapshot: {}
  }
}

async function writeProjectMemory(memory: ProjectMemory): Promise<void> {
  const directory = join(memory.profile.projectRoot, memoryDirectoryName)
  const destination = memoryFilePath(memory.profile.projectRoot)
  await mkdir(directory, { recursive: true })
  const temporary = join(directory, `${memoryFileName}.${process.pid}.tmp`)
  await writeFile(temporary, `${JSON.stringify(memory, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, destination)
}

function memoryFilePath(projectRoot: string): string {
  return join(projectRoot, memoryDirectoryName, memoryFileName)
}
