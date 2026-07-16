import { readFile, readdir, realpath, stat } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import type { PackageManager, ProjectDiscovery, ProjectFramework, ProjectRoute } from './types'

const ignoredDirectories = new Set([
  '.git', '.next', '.nuxt', '.output', '.vercel', '.verion', 'artifacts', 'build', 'coverage', 'dist', 'node_modules', 'out', 'public', 'storybook-static'
])

const sourceExtensions = new Set(['.cjs', '.cts', '.js', '.jsx', '.mjs', '.mts', '.ts', '.tsx'])
const maxFiles = 5_000

type PackageManifest = {
  name?: string
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

export async function discoverProject(projectPath: string): Promise<ProjectDiscovery> {
  const projectRoot = await realpath(resolve(projectPath))
  const metadata = await stat(projectRoot)
  if (!metadata.isDirectory()) throw new Error(`Project path is not a directory: ${projectPath}`)

  const fileInventory = await listProjectFiles(projectRoot)
  const manifest = await readManifest(projectRoot)
  const framework = detectFramework(manifest, fileInventory.paths)
  const routes = discoverRoutes(fileInventory.paths)

  return {
    projectRoot,
    framework,
    packageManager: detectPackageManager(fileInventory.paths),
    packageName: manifest?.name,
    scripts: manifest?.scripts ?? {},
    entryPoints: discoverEntryPoints(fileInventory.paths, framework),
    routes,
    files: fileInventory.paths,
    ignoredFileCount: fileInventory.ignoredFileCount
  }
}

async function listProjectFiles(projectRoot: string): Promise<{ paths: string[]; ignoredFileCount: number }> {
  const paths: string[] = []
  let ignoredFileCount = 0
  const visit = async (directory: string) => {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries) {
      if (paths.length >= maxFiles) {
        ignoredFileCount += 1
        continue
      }
      const absolutePath = join(directory, entry.name)
      if (entry.isDirectory()) {
        if (ignoredDirectories.has(entry.name) || entry.name.startsWith('.cache')) {
          ignoredFileCount += 1
          continue
        }
        await visit(absolutePath)
        continue
      }
      if (!entry.isFile()) continue
      if (entry.name.startsWith('.env') || entry.name.endsWith('.tsbuildinfo')) {
        ignoredFileCount += 1
        continue
      }
      paths.push(normalize(relative(projectRoot, absolutePath)))
    }
  }

  await visit(projectRoot)
  return { paths: paths.sort(), ignoredFileCount }
}

async function readManifest(projectRoot: string): Promise<PackageManifest | undefined> {
  try {
    return JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8')) as PackageManifest
  } catch {
    return undefined
  }
}

function detectFramework(manifest: PackageManifest | undefined, files: string[]): ProjectFramework {
  const dependencies = { ...manifest?.dependencies, ...manifest?.devDependencies }
  if (dependencies.next || files.some((path) => path.startsWith('app/') || path.startsWith('pages/'))) return 'nextjs'
  if (dependencies.vite || files.includes('vite.config.ts') || files.includes('vite.config.js')) return 'vite'
  if (dependencies.react || dependencies['react-dom']) return 'react'
  return 'unknown'
}

function detectPackageManager(files: string[]): PackageManager {
  if (files.includes('pnpm-lock.yaml')) return 'pnpm'
  if (files.includes('yarn.lock')) return 'yarn'
  if (files.includes('bun.lockb') || files.includes('bun.lock')) return 'bun'
  if (files.includes('package-lock.json')) return 'npm'
  return 'unknown'
}

function discoverEntryPoints(files: string[], framework: ProjectFramework): string[] {
  const candidates = framework === 'nextjs'
    ? ['app/layout.tsx', 'app/page.tsx', 'pages/_app.tsx', 'pages/index.tsx']
    : ['src/main.tsx', 'src/main.jsx', 'src/index.tsx', 'src/index.jsx', 'index.html']
  return candidates.filter((candidate) => files.includes(candidate))
}

function discoverRoutes(files: string[]): ProjectRoute[] {
  const routes: ProjectRoute[] = []
  for (const file of files) {
    if (file.startsWith('app/') && /\/(?:page)\.(?:tsx|ts|jsx|js)$/.test(file)) {
      const routeDirectory = file.replace(/^app\//, '').replace(/(?:^|\/)page\.(?:tsx|ts|jsx|js)$/, '')
      const segments = routeDirectory.split('/').filter(Boolean)
      routes.push({ path: toRoutePath(segments), file, convention: 'next-app-router' })
    } else if (file.startsWith('pages/') && /\.(?:tsx|ts|jsx|js)$/.test(file) && !file.includes('/_')) {
      const route = file.replace(/^pages\//, '').replace(/\.(?:tsx|ts|jsx|js)$/, '').replace(/\/index$/, '')
      routes.push({ path: route ? `/${route}` : '/', file, convention: 'next-pages-router' })
    } else if (/^src\/(?:routes?|pages)\/.+\.(?:tsx|ts|jsx|js)$/.test(file)) {
      routes.push({ path: `/${file.split('/').pop()!.replace(/\.(?:tsx|ts|jsx|js)$/, '')}`, file, convention: 'route-candidate' })
    } else if (/^src\/App\.(?:tsx|ts|jsx|js)$/.test(file)) {
      routes.push({ path: '/', file, convention: 'route-candidate' })
    }
  }
  return routes.sort((left, right) => left.path.localeCompare(right.path))
}

function toRoutePath(segments: string[]): string {
  if (segments.length === 0) return '/'
  return `/${segments.map((segment) => segment.replace(/^\[(.+)\]$/, ':$1').replace(/^\(.*\)$/, '')).filter(Boolean).join('/')}`
}

export function isSourceFile(path: string): boolean {
  return sourceExtensions.has(extname(path))
}

export function resolveProjectFile(projectRoot: string, projectFile: string): string {
  return join(projectRoot, ...projectFile.split('/'))
}

export function normalize(path: string): string {
  return path.split(sep).join('/')
}

export function projectRelativeImport(fromFile: string, specifier: string): string | undefined {
  if (!specifier.startsWith('.')) return undefined
  return normalize(relative('.', join(dirname(fromFile), specifier)))
}
