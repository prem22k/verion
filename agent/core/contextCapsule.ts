import { readFile } from 'node:fs/promises'
import { resolveProjectFile } from './projectDiscovery'
import type { ContextCapsule, Evidence, ProjectDiscovery, RepositoryGraph } from './types'

const maxFiles = 8
const maxExcerptLines = 120

export async function createContextCapsule(
  evidence: Evidence[]
): Promise<ContextCapsule> {
  const discovery = evidence.find((item) => item.kind === 'repository_discovery')?.data as ProjectDiscovery | undefined
  const graph = evidence.find((item) => item.kind === 'repository_graph')?.data as RepositoryGraph | undefined
  if (!discovery || !graph) {
    throw new Error('A Context Capsule requires repository discovery and repository graph evidence.')
  }
  const seeds = selectSeedFiles(evidence, discovery)
  const relevantPaths = expandRelevantFiles(graph, seeds)

  const relevantFiles = await Promise.all(relevantPaths.map(async (path) => ({
    path,
    reason: seeds.has(path) ? 'Directly referenced by evidence.' : 'Connected to evidence through the repository graph.',
    excerpt: await readSafeExcerpt(discovery.projectRoot, path)
  })))

  return {
    evidence,
    project: {
      framework: discovery.framework,
      packageManager: discovery.packageManager,
      entryPoints: discovery.entryPoints
    },
    relevantFiles,
    reproductionContext: evidence.map((item) => item.summary)
  }
}

function selectSeedFiles(evidence: Evidence[], discovery: ProjectDiscovery): Set<string> {
  const seeds = new Set<string>()
  for (const item of evidence) {
    if (item.location?.file && discovery.files.includes(item.location.file)) seeds.add(item.location.file)
    if (item.location?.route) {
      for (const route of discovery.routes) {
        if (route.path === item.location?.route) seeds.add(route.file)
      }
    }
  }
  for (const entryPoint of discovery.entryPoints) {
    if (seeds.size >= 2) break
    seeds.add(entryPoint)
  }
  return seeds
}

function expandRelevantFiles(analysisGraph: RepositoryGraph, seeds: Set<string>): string[] {
  const neighbors = new Map<string, Set<string>>()
  for (const edge of analysisGraph.edges) {
    if (edge.kind !== 'imports') continue
    const from = edge.from.replace(/^file:/, '')
    const to = edge.to.replace(/^file:/, '')
    if (!neighbors.has(from)) neighbors.set(from, new Set())
    if (!neighbors.has(to)) neighbors.set(to, new Set())
    neighbors.get(from)!.add(to)
    neighbors.get(to)!.add(from)
  }

  const selected = new Set(seeds)
  const queue = [...seeds]
  while (queue.length > 0 && selected.size < maxFiles) {
    const current = queue.shift()!
    for (const neighbor of neighbors.get(current) ?? []) {
      if (selected.has(neighbor)) continue
      selected.add(neighbor)
      queue.push(neighbor)
      if (selected.size >= maxFiles) break
    }
  }
  return [...selected]
}

async function readSafeExcerpt(projectRoot: string, projectFile: string): Promise<string> {
  try {
    const source = await readFile(resolveProjectFile(projectRoot, projectFile), 'utf8')
    return redactSensitiveValues(source.split(/\r?\n/).slice(0, maxExcerptLines).join('\n'))
  } catch {
    return ''
  }
}

function redactSensitiveValues(source: string): string {
  return source
    .replace(/(api[_-]?key|secret|token|password)\s*[:=]\s*(['"])[^'"\n]+\2/gi, '$1: "[REDACTED]"')
    .replace(/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, '[REDACTED_AWS_KEY]')
}
