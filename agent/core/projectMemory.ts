import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildRepositoryGraph } from './repositoryGraph'
import { discoverProject, resolveProjectFile } from './projectDiscovery'
import type { ProjectDiscovery, ProjectMemory, ProjectTechnology, ProjectUnderstanding } from './types'

const memoryDirectoryName = '.verion'
const memoryFileName = 'project-memory.json'

export type LearnedProject = {
  discovery: ProjectDiscovery
  memory: ProjectMemory
  memoryState: 'first_run' | 'remembered' | 'updated'
}

export async function learnProject(projectPath: string): Promise<LearnedProject> {
  const discovery = await discoverProject(projectPath)
  const signature = await createProjectSignature(discovery)
  const existing = await readProjectMemory(discovery.projectRoot)
  if (existing?.version === 1 && existing.signature === signature) {
    return {
      discovery,
      memory: { ...existing, discovery },
      memoryState: existing.onboardingCompletedAt ? 'remembered' : 'first_run'
    }
  }

  const graph = await buildRepositoryGraph(discovery)
  const now = new Date().toISOString()
  const memory: ProjectMemory = {
    version: 1,
    projectRoot: discovery.projectRoot,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    onboardingCompletedAt: existing?.onboardingCompletedAt,
    signature,
    discovery,
    graph,
    understanding: await understandProject(discovery)
  }
  await writeProjectMemory(memory)
  return { discovery, memory, memoryState: existing ? 'updated' : 'first_run' }
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

async function createProjectSignature(discovery: ProjectDiscovery): Promise<string> {
  const hash = createHash('sha256')
  for (const file of discovery.files) {
    try {
      const metadata = await stat(resolveProjectFile(discovery.projectRoot, file))
      hash.update(`${file}:${metadata.size}:${metadata.mtimeMs};`)
    } catch {
      hash.update(`${file}:missing;`)
    }
  }
  return hash.digest('hex')
}

async function readProjectMemory(projectRoot: string): Promise<ProjectMemory | undefined> {
  try {
    const value = JSON.parse(await readFile(memoryFilePath(projectRoot), 'utf8')) as unknown
    if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) return undefined
    return value as ProjectMemory
  } catch {
    return undefined
  }
}

async function writeProjectMemory(memory: ProjectMemory): Promise<void> {
  const directory = join(memory.projectRoot, memoryDirectoryName)
  const destination = memoryFilePath(memory.projectRoot)
  await mkdir(directory, { recursive: true })
  const temporary = join(directory, `${memoryFileName}.${process.pid}.tmp`)
  await writeFile(temporary, `${JSON.stringify(memory, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, destination)
}

function memoryFilePath(projectRoot: string): string {
  return join(projectRoot, memoryDirectoryName, memoryFileName)
}
