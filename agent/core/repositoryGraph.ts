import { readFile } from 'node:fs/promises'
import { extname, join, normalize as normalizePath } from 'node:path'
import { isSourceFile, normalize, resolveProjectFile } from './projectDiscovery'
import type { ProjectDiscovery, RepositoryGraph, RepositoryGraphEdge, RepositoryGraphNode } from './types'

const importExpression = /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
const resolveExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']

export async function buildRepositoryGraph(discovery: ProjectDiscovery): Promise<RepositoryGraph> {
  const fileSet = new Set(discovery.files)
  const nodes: RepositoryGraphNode[] = discovery.files.map((path) => ({ id: `file:${path}`, kind: 'file', path }))
  const edges: RepositoryGraphEdge[] = []

  for (const entryPoint of discovery.entryPoints) {
    nodes.push({ id: `entry:${entryPoint}`, kind: 'entry-point', path: entryPoint })
    edges.push({ from: `entry:${entryPoint}`, to: `file:${entryPoint}`, kind: 'is-entry-point' })
  }

  for (const route of discovery.routes) {
    nodes.push({ id: `route:${route.path}:${route.file}`, kind: 'route', path: route.path })
    edges.push({ from: `route:${route.path}:${route.file}`, to: `file:${route.file}`, kind: 'owns-route' })
  }

  for (const file of discovery.files.filter(isSourceFile)) {
    const imports = await readRelativeImports(discovery.projectRoot, file)
    for (const specifier of imports) {
      const target = resolveImport(file, specifier, fileSet)
      if (target) edges.push({ from: `file:${file}`, to: `file:${target}`, kind: 'imports' })
    }
  }

  return { nodes, edges }
}

async function readRelativeImports(projectRoot: string, projectFile: string): Promise<string[]> {
  try {
    const content = await readFile(resolveProjectFile(projectRoot, projectFile), 'utf8')
    const imports = new Set<string>()
    for (const match of content.matchAll(importExpression)) {
      const specifier = match[1] ?? match[2] ?? match[3]
      if (specifier?.startsWith('.')) imports.add(specifier)
    }
    return [...imports]
  } catch {
    return []
  }
}

function resolveImport(fromFile: string, specifier: string, fileSet: Set<string>): string | undefined {
  const base = normalizePath(join(fromFile, '..', specifier)).split('\\').join('/')
  const explicitExtension = extname(base)
  const sourceBase = explicitExtension ? base.slice(0, -explicitExtension.length) : base
  const candidates = [
    base,
    ...resolveExtensions.map((extension) => `${base}${extension}`),
    ...resolveExtensions.map((extension) => `${sourceBase}${extension}`),
    ...resolveExtensions.map((extension) => `${base}/index${extension}`)
  ]
  return candidates.find((candidate) => fileSet.has(candidate))
}
