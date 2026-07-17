import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { buildRepositoryGraph } from './repositoryGraph'
import { discoverProject, resolveProjectFile } from './projectDiscovery'
import type { Evidence, KnownIssue, KnownUserJourney, ProjectDiscovery, ProjectFileSnapshot, ProjectMemory, ProjectRoute, ProjectTechnology, ProjectUnderstanding, ProjectUnderstandingItem, ProjectVerificationResult, RecentProjectChange, ReleaseConfidence, ReleaseRecommendation, StoredReleaseReport, VerificationHistoryEntry } from './types'

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
  const canReuse = existing?.signature === signature && Object.keys(existing.fileSnapshot).length > 0 && hasExpandedUnderstanding(existing.understanding)
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
    version: 4,
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
  const importantPages = inferImportantPages(discovery.routes)
  const importantApis = inferImportantApis(discovery.files)
  const apiCount = discovery.files.reduce((count, file) => count + Number(Boolean(apiRouteFromFile(file))), 0)
  const authentication = inferAuthentication(discovery, dependencies)
  const payments = inferPayments(discovery, dependencies)
  const database = await inferDatabase(discovery, dependencies)
  const framework = technologies.find((technology) => technology.kind === 'framework')?.label
  const applicationType = inferApplicationType(productAreas, authentication, payments)
  const userJourneys = inferUserJourneys(importantPages, authentication, payments)
  const criticalBusinessFlows = inferCriticalBusinessFlows(discovery, authentication, payments, importantPages)
  return {
    technologies,
    productAreas,
    routeCount,
    apiCount,
    applicationType,
    authentication,
    payments,
    database,
    framework,
    userJourneys,
    criticalBusinessFlows,
    importantPages,
    importantApis,
    summary: buildSummary(discovery, applicationType)
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
  add('postgresql', 'PostgreSQL', 'database', [...dependencies].some((dependency) => ['pg', 'postgres', '@neondatabase/serverless', '@vercel/postgres'].includes(dependency)) || await prismaProviderIs(discovery, 'postgresql'))
  add('prisma', 'Prisma', 'library', dependencies.has('@prisma/client') || dependencies.has('prisma'))
  return technologies
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

function inferAuthentication(discovery: ProjectDiscovery, dependencies: Set<string>): string | undefined {
  if ([...dependencies].some((dependency) => dependency.startsWith('@clerk/'))) return 'Clerk Authentication'
  if (dependencies.has('next-auth') || dependencies.has('@auth/core')) return 'Auth.js'
  if (dependencies.has('@supabase/supabase-js')) return 'Supabase Authentication'
  if (dependencies.has('firebase') || dependencies.has('firebase-admin')) return 'Firebase Authentication'
  if (hasNamedProjectSignal(discovery, /(?:^|[\/_-])(auth|sign-in|signin|sign-up|signup|login)(?:[\/_-]|$)/)) return 'Sign-in flows'
  return undefined
}

function inferPayments(discovery: ProjectDiscovery, dependencies: Set<string>): string | undefined {
  if (dependencies.has('stripe') || dependencies.has('@stripe/stripe-js')) return 'Stripe'
  if (dependencies.has('@paddle/paddle-js')) return 'Paddle'
  if (dependencies.has('@lemonsqueezy/lemonsqueezy.js')) return 'Lemon Squeezy'
  if (hasNamedProjectSignal(discovery, /(?:^|[\/_-])(billing|checkout|subscription|payment|invoice)(?:[\/_-]|$)/)) return 'Billing flows'
  return undefined
}

async function inferDatabase(discovery: ProjectDiscovery, dependencies: Set<string>): Promise<string | undefined> {
  if ([...dependencies].some((dependency) => ['pg', 'postgres', '@neondatabase/serverless', '@vercel/postgres'].includes(dependency)) || await prismaProviderIs(discovery, 'postgresql')) return 'PostgreSQL'
  if (dependencies.has('mongodb') || dependencies.has('mongoose') || await prismaProviderIs(discovery, 'mongodb')) return 'MongoDB'
  if (dependencies.has('better-sqlite3') || dependencies.has('sqlite3') || await prismaProviderIs(discovery, 'sqlite')) return 'SQLite'
  if (dependencies.has('@supabase/supabase-js')) return 'Supabase'
  return undefined
}

function inferApplicationType(productAreas: string[], authentication: string | undefined, payments: string | undefined): string {
  const hasDashboard = productAreas.includes('Dashboard')
  if (hasDashboard && authentication && payments) return 'SaaS dashboard'
  if (hasDashboard && authentication) return 'authenticated dashboard product'
  if (hasDashboard) return 'dashboard product'
  if (payments && authentication) return 'subscription web application'
  if (authentication) return 'authenticated web application'
  return 'web application'
}

function buildSummary(discovery: ProjectDiscovery, applicationType: string): string {
  if (applicationType === 'SaaS dashboard') return 'I think this is a SaaS dashboard with authentication and billing.'
  if (applicationType === 'authenticated dashboard product') return 'I think this is a dashboard product with an important signed-in experience.'
  if (applicationType === 'dashboard product') return 'I think this is a dashboard product with important workspace flows.'
  if (applicationType === 'subscription web application') return 'I think this is a subscription web application with sign-in and billing.'
  if (applicationType === 'authenticated web application') return 'I think this is an application with an important signed-in experience.'
  const routeLabel = discovery.routes.length === 1 ? 'route' : 'routes'
  return `I think this is a web application with ${discovery.routes.length} ${routeLabel} to understand.`
}

function inferImportantPages(routes: ProjectRoute[]): ProjectUnderstandingItem[] {
  const entries = routes
    .filter((route) => !route.path.startsWith('/api/') && !route.path.includes(':'))
    .map((route) => ({ id: `page:${route.path}`, label: pageLabel(route.path), priority: pagePriority(route.path) }))
  return uniqueUnderstandingItems(entries.sort((left, right) => left.priority - right.priority || left.label.localeCompare(right.label))).slice(0, 12)
}

function inferImportantApis(files: string[]): ProjectUnderstandingItem[] {
  const entries = files.flatMap((file) => {
    const route = apiRouteFromFile(file)
    return route ? [{ id: `api:${route}`, label: apiLabel(route), priority: apiPriority(route) }] : []
  })
  return uniqueUnderstandingItems(entries.sort((left, right) => left.priority - right.priority || left.label.localeCompare(right.label))).slice(0, 12)
}

function inferUserJourneys(pages: ProjectUnderstandingItem[], authentication: string | undefined, payments: string | undefined): ProjectUnderstandingItem[] {
  const journeys: Array<ProjectUnderstandingItem & { priority: number }> = pages.map((page) => ({ ...page, id: `journey:${page.id}`, priority: pagePriorityFromLabel(page.label) }))
  if (authentication && !journeys.some((journey) => /sign in|log in|account/i.test(journey.label))) journeys.push({ id: 'journey:sign-in', label: 'Sign in', priority: 1 })
  if (payments && !journeys.some((journey) => /billing|checkout|subscription/i.test(journey.label))) journeys.push({ id: 'journey:billing', label: 'Billing', priority: 3 })
  return uniqueUnderstandingItems(journeys.sort((left, right) => left.priority - right.priority || left.label.localeCompare(right.label))).slice(0, 8)
}

function inferCriticalBusinessFlows(discovery: ProjectDiscovery, authentication: string | undefined, payments: string | undefined, pages: ProjectUnderstandingItem[]): ProjectUnderstandingItem[] {
  const names = [
    ...discovery.files,
    ...discovery.routes.map((route) => route.path)
  ].join(' ').toLowerCase()
  const flows: ProjectUnderstandingItem[] = []
  const add = (id: string, label: string, condition: boolean) => {
    if (condition && !flows.some((flow) => flow.id === id)) flows.push({ id, label })
  }
  add('sign-in', 'Sign in', Boolean(authentication) && pages.some((page) => /sign in|log in/i.test(page.label)))
  add('checkout', 'Complete checkout', Boolean(payments) && /checkout/.test(names))
  add('billing', 'Manage billing', Boolean(payments) && !flows.some((flow) => flow.id === 'checkout'))
  add('dashboard', 'Use the dashboard', pages.some((page) => /dashboard/i.test(page.label)))
  add('workspace', 'Manage workspace', /(?:^|[\/_-])workspace(?:[\/_-]|$)/.test(names))
  return flows.slice(0, 8)
}

function hasNamedProjectSignal(discovery: ProjectDiscovery, expression: RegExp): boolean {
  return [...discovery.files, ...discovery.routes.map((route) => route.path)].some((value) => expression.test(value.toLowerCase()))
}

async function prismaProviderIs(discovery: ProjectDiscovery, provider: string): Promise<boolean> {
  const schema = discovery.files.find((file) => file.endsWith('schema.prisma'))
  if (!schema) return false
  try {
    const expression = new RegExp(`provider\\s*=\\s*["']${provider}["']`)
    return expression.test(await readFile(resolveProjectFile(discovery.projectRoot, schema), 'utf8'))
  } catch {
    return false
  }
}

function apiRouteFromFile(file: string): string | undefined {
  const appMatch = file.match(/^app\/api\/(.+)\/route\.(?:ts|tsx|js|jsx)$/)
  if (appMatch) return appMatch[1]
  const pagesMatch = file.match(/^pages\/api\/(.+)\.(?:ts|tsx|js|jsx)$/)
  return pagesMatch?.[1]
}

function pageLabel(route: string): string {
  if (route === '/') return 'Home'
  const label = route.split('/').filter(Boolean).map(humanizeSegment).join(' ')
  return label || 'Home'
}

function apiLabel(route: string): string {
  return route.split('/').filter(Boolean).map(humanizeSegment).join(' ') || 'Application'
}

function humanizeSegment(segment: string): string {
  const normalized = segment.replace(/[\[\]]/g, '').replace(/[-_]/g, ' ').toLowerCase()
  if (normalized === 'sign in' || normalized === 'signin' || normalized === 'login') return 'Sign in'
  if (normalized === 'sign up' || normalized === 'signup') return 'Sign up'
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function pagePriority(route: string): number {
  if (route === '/') return 0
  if (/sign-in|signin|sign-up|signup|login/.test(route)) return 1
  if (/dashboard|workspace|admin/.test(route)) return 2
  if (/billing|checkout|subscription|payment/.test(route)) return 3
  return 4
}

function pagePriorityFromLabel(label: string): number {
  return pagePriority(`/${label.toLowerCase().replace(/\s+/g, '-')}`)
}

function apiPriority(route: string): number {
  if (/auth|session|user|account/.test(route)) return 0
  if (/checkout|billing|subscription|payment|invoice/.test(route)) return 1
  if (/workspace|dashboard|project/.test(route)) return 2
  return 3
}

function uniqueUnderstandingItems<T extends ProjectUnderstandingItem>(items: T[]): ProjectUnderstandingItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.label.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).map(({ id, label }) => ({ id, label }))
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
    const interactiveElementCount = typeof details.interactiveElementCount === 'number'
      ? details.interactiveElementCount
      : Array.isArray(details.interactiveElements) ? details.interactiveElements.length : undefined
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
  const stableSegments = route.split('/').filter((part) => part && !part.startsWith(':') && !part.startsWith('['))
  return stableSegments.length > 0 ? pageLabel(`/${stableSegments.join('/')}`) : 'Detail'
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
    id: `report:${completedAt}:${shortHash(`${report.recommendation}:${report.headline}:${report.rootCause}`)}`,
    completedAt
  }
}

function updateKnownIssues(issues: KnownIssue[], report: StoredReleaseReport | undefined, recommendation: ReleaseRecommendation, completedAt: string): KnownIssue[] {
  if (report?.recommendation === 'needs_attention') {
    const id = `issue:${shortHash(`${report.headline}:${report.rootCause}`)}`
    const existing = issues.find((issue) => issue.id === id)
    const nextIssue: KnownIssue = existing ? {
      ...existing,
      headline: report.headline,
      rootCause: report.rootCause,
      lastSeenAt: completedAt,
      occurrences: existing.occurrences + 1,
      status: 'open',
      lastReportId: report.id
    } : {
      id,
      headline: report.headline,
      rootCause: report.rootCause,
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

function hasExpandedUnderstanding(understanding: ProjectUnderstanding): boolean {
  return typeof understanding.applicationType === 'string'
    && Array.isArray(understanding.userJourneys)
    && Array.isArray(understanding.criticalBusinessFlows)
    && Array.isArray(understanding.importantPages)
    && Array.isArray(understanding.importantApis)
}

export async function readProjectMemory(projectRoot: string): Promise<ProjectMemory | undefined> {
  try {
    const value = JSON.parse(await readFile(memoryFilePath(projectRoot), 'utf8')) as unknown
    if (isProjectMemory(value)) return normalizeCurrentMemory(value)
    const migrated = migrateLegacyMemory(value, projectRoot)
    if (migrated) await writeProjectMemory(migrated)
    return migrated
  } catch {
    return undefined
  }
}

function isProjectMemory(value: unknown): value is ProjectMemory {
  return Boolean(value && typeof value === 'object' && 'version' in value && value.version === 4 && 'profile' in value && 'fileSnapshot' in value)
}

function migrateLegacyMemory(value: unknown, projectRoot: string): ProjectMemory | undefined {
  if (!value || typeof value !== 'object' || !('version' in value) || (value.version !== 1 && value.version !== 2 && value.version !== 3)) return undefined
  const legacy = value as {
    version: 1 | 2 | 3
    profile?: ProjectMemory['profile']
    createdAt?: unknown
    updatedAt?: unknown
    onboardingCompletedAt?: unknown
    signature?: unknown
    discovery?: ProjectDiscovery
    graph?: ProjectMemory['graph']
    understanding?: ProjectUnderstanding
    knownTechnologies?: ProjectTechnology[]
    knownRoutes?: ProjectRoute[]
    knownUserJourneys?: KnownUserJourney[]
    verificationHistory?: VerificationHistoryEntry[]
    releaseReports?: StoredReleaseReport[]
    knownIssues?: KnownIssue[]
    recentChanges?: RecentProjectChange[]
    fileSnapshot?: ProjectFileSnapshot
  }
  if (!legacy.discovery || !legacy.graph || !legacy.understanding || typeof legacy.signature !== 'string') return undefined
  const createdAt = typeof legacy.createdAt === 'string' ? legacy.createdAt : new Date().toISOString()
  const updatedAt = typeof legacy.updatedAt === 'string' ? legacy.updatedAt : createdAt
  return {
    version: 4,
    profile: {
      name: legacy.profile?.name ?? legacy.discovery.packageName ?? basename(projectRoot),
      projectRoot: legacy.profile?.projectRoot ?? projectRoot,
      framework: legacy.profile?.framework ?? legacy.discovery.framework,
      packageManager: legacy.profile?.packageManager ?? legacy.discovery.packageManager,
      firstLearnedAt: legacy.profile?.firstLearnedAt ?? createdAt,
      lastLearnedAt: legacy.profile?.lastLearnedAt ?? updatedAt,
      lastVerifiedAt: legacy.profile?.lastVerifiedAt
    },
    createdAt,
    updatedAt,
    onboardingCompletedAt: typeof legacy.onboardingCompletedAt === 'string' ? legacy.onboardingCompletedAt : undefined,
    signature: legacy.signature,
    discovery: legacy.discovery,
    graph: legacy.graph,
    understanding: {
      ...legacy.understanding,
      userJourneys: legacy.understanding.userJourneys ?? [],
      criticalBusinessFlows: legacy.understanding.criticalBusinessFlows ?? [],
      importantPages: legacy.understanding.importantPages ?? [],
      importantApis: legacy.understanding.importantApis ?? []
    },
    knownTechnologies: legacy.knownTechnologies ?? legacy.understanding.technologies,
    knownRoutes: legacy.knownRoutes ?? legacy.discovery.routes,
    knownUserJourneys: legacy.knownUserJourneys ?? projectJourneys(legacy.discovery.routes, updatedAt),
    verificationHistory: legacy.verificationHistory ?? [],
    releaseReports: normalizeStoredReports(legacy.releaseReports, updatedAt),
    knownIssues: normalizeKnownIssues(legacy.knownIssues, updatedAt),
    recentChanges: legacy.recentChanges ?? [],
    fileSnapshot: legacy.fileSnapshot ?? {}
  }
}

function normalizeCurrentMemory(memory: ProjectMemory): ProjectMemory {
  return {
    ...memory,
    releaseReports: normalizeStoredReports(memory.releaseReports, memory.updatedAt),
    knownIssues: normalizeKnownIssues(memory.knownIssues, memory.updatedAt)
  }
}

function normalizeStoredReports(value: unknown, fallbackCompletedAt: string): StoredReleaseReport[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((report, index) => {
    const normalized = normalizeStoredReleaseReport(report, fallbackCompletedAt, index)
    return normalized ? [normalized] : []
  }).slice(0, historyLimit)
}

export function normalizeStoredReleaseReport(value: unknown, fallbackCompletedAt: string, index = 0): StoredReleaseReport | undefined {
  const report = objectValue(value)
  if (!report) return undefined
  const recommendation = isReleaseRecommendation(report.recommendation) ? report.recommendation : 'inconclusive'
  const headline = textValue(report.headline) ?? 'Saved release decision'
  const nextAction = textValue(report.nextAction) ?? 'Verify again when the project is ready.'
  const legacyDiagnosis = textValue(report.diagnosis)
  const rootCause = textValue(report.rootCause) ?? legacyDiagnosis ?? legacyRootCause(headline, recommendation)
  const reasons = normalizedReasons(report.reasons)
    ?? (legacyDiagnosis && legacyDiagnosis !== rootCause ? [legacyDiagnosis] : [legacyReason(recommendation)])
  const evidenceIds = stringValues(report.evidenceIds)
  const completedAt = textValue(report.completedAt) ?? fallbackCompletedAt
  const id = textValue(report.id) ?? `report:${completedAt}:${shortHash(`${recommendation}:${headline}:${rootCause}:${index}`)}`
  return {
    id,
    completedAt,
    recommendation,
    confidence: isReleaseConfidence(report.confidence) ? report.confidence : legacyConfidence(recommendation),
    headline,
    rootCause,
    reasons,
    evidenceIds,
    nextAction
  }
}

function normalizeKnownIssues(value: unknown, fallbackTimestamp: string): KnownIssue[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((issue, index) => {
    const item = objectValue(issue)
    if (!item) return []
    const headline = textValue(item.headline) ?? 'Saved issue'
    const rootCause = textValue(item.rootCause) ?? textValue(item.diagnosis) ?? headline
    const firstSeenAt = textValue(item.firstSeenAt) ?? fallbackTimestamp
    const lastSeenAt = textValue(item.lastSeenAt) ?? firstSeenAt
    const id = textValue(item.id) ?? `issue:${shortHash(`${headline}:${rootCause}:${index}`)}`
    const lastReportId = textValue(item.lastReportId) ?? ''
    return [{
      id,
      headline,
      rootCause,
      firstSeenAt,
      lastSeenAt,
      occurrences: typeof item.occurrences === 'number' && Number.isFinite(item.occurrences) ? item.occurrences : 1,
      status: item.status === 'resolved' ? 'resolved' as const : 'open' as const,
      lastReportId
    }]
  }).slice(0, issueLimit)
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function stringValues(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.flatMap((item) => textValue(item) ?? []))]
}

function normalizedReasons(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const seen = new Set<string>()
  return value.flatMap((item) => textValue(item) ?? []).filter((item) => {
    const key = item.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 3)
}

function isReleaseRecommendation(value: unknown): value is ReleaseRecommendation {
  return value === 'ready_to_ship' || value === 'needs_attention' || value === 'inconclusive'
}

function isReleaseConfidence(value: unknown): value is ReleaseConfidence {
  return value === 'high' || value === 'moderate' || value === 'limited'
}

function legacyConfidence(recommendation: ReleaseRecommendation): ReleaseConfidence {
  return recommendation === 'inconclusive' ? 'limited' : 'moderate'
}

function legacyRootCause(headline: string, recommendation: ReleaseRecommendation): string {
  if (recommendation === 'ready_to_ship') return `The saved review did not identify a release blocker: ${headline}.`
  if (recommendation === 'needs_attention') return `The saved review identified an issue that needs attention: ${headline}.`
  return `The saved review could not establish a release decision: ${headline}.`
}

function legacyReason(recommendation: ReleaseRecommendation): string {
  if (recommendation === 'ready_to_ship') return 'The prior review recorded no current release blocker.'
  if (recommendation === 'needs_attention') return 'The prior review recorded this issue for follow-up.'
  return 'The prior review did not have enough support for a release call.'
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
