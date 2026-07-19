import { spawn } from 'node:child_process'
import { readdir, realpath, stat } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'

/**
 * Security reviews use their own inventory instead of the discovery inventory.
 * Product discovery is intentionally small and fast; security must be explicit
 * about every file it did and did not place inside the review boundary.
 */
const excludedDirectories = new Set([
  '.git', '.next', '.nuxt', '.output', '.vercel', '.verion', '.yarn',
  'artifacts', 'build', 'coverage', 'dist', 'node_modules', 'out', 'public',
  'storybook-static', 'target', 'tmp', 'vendor', 'venv', '.venv'
])

const codeExtensions = new Set([
  '.bash', '.c', '.cc', '.cjs', '.cpp', '.cs', '.cts', '.go', '.h', '.hpp',
  '.html', '.java', '.js', '.jsx', '.kt', '.kts', '.mjs', '.mts', '.php',
  '.py', '.rb', '.rs', '.sh', '.svelte', '.swift', '.ts', '.tsx', '.vue', '.zsh'
])

const configurationExtensions = new Set([
  '.conf', '.ini', '.json', '.json5', '.properties', '.tf', '.tfvars', '.toml',
  '.xml', '.yaml', '.yml'
])

const dependencyFiles = new Set([
  'Cargo.lock', 'Cargo.toml', 'Gemfile.lock', 'Gemfile', 'Pipfile.lock', 'Pipfile',
  'composer.lock', 'composer.json', 'go.mod', 'go.sum', 'mix.lock', 'package-lock.json',
  'package.json', 'pnpm-lock.yaml', 'poetry.lock', 'pyproject.toml', 'requirements.txt',
  'uv.lock', 'yarn.lock', 'bun.lock', 'bun.lockb', 'pom.xml', 'gradle.lockfile'
])

export type SecurityScopeFile = {
  path: string
  kind: 'code' | 'configuration' | 'dependency' | 'workflow'
  isTest: boolean
}

export type SecurityScope = {
  projectRoot: string
  files: SecurityScopeFile[]
  excluded: Record<string, number>
  trackedEnvironmentFiles: string[]
}

/**
 * Enumerate every locally relevant text/configuration artifact. We deliberately
 * do not inherit .gitignore: generated application code and CI configuration
 * can be security relevant. The only exclusions are product policy exclusions
 * that are surfaced in the progress copy.
 */
export async function createSecurityScope(projectPath: string): Promise<SecurityScope> {
  const projectRoot = await realpath(resolve(projectPath))
  const metadata = await stat(projectRoot)
  if (!metadata.isDirectory()) throw new Error(`Project path is not a directory: ${projectPath}`)

  const files: SecurityScopeFile[] = []
  const environmentFiles: string[] = []
  const excluded: Record<string, number> = {}
  const addExcluded = (reason: string) => { excluded[reason] = (excluded[reason] ?? 0) + 1 }

  const visit = async (directory: string): Promise<void> => {
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      addExcluded('unreadable')
      return
    }
    for (const entry of entries) {
      const absolute = join(directory, entry.name)
      const projectFile = normalize(relative(projectRoot, absolute))
      if (entry.isSymbolicLink()) { addExcluded('symbolic links'); continue }
      if (entry.isDirectory()) {
        if (excludedDirectories.has(entry.name) || entry.name.startsWith('.cache')) {
          addExcluded(entry.name === 'public' ? 'public assets' : entry.name)
          continue
        }
        await visit(absolute)
        continue
      }
      if (!entry.isFile()) continue
      if (isRuntimeEnvironmentFile(entry.name)) { environmentFiles.push(projectFile); addExcluded('runtime environment files'); continue }
      const kind = securityFileKind(projectFile)
      if (!kind) { addExcluded('non-reviewable files'); continue }
      files.push({ path: projectFile, kind, isTest: isTestPath(projectFile) })
    }
  }

  await visit(projectRoot)
  return {
    projectRoot,
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
    excluded,
    trackedEnvironmentFiles: await trackedFiles(projectRoot, environmentFiles)
  }
}

export function securityFileKind(file: string): SecurityScopeFile['kind'] | undefined {
  const name = file.split('/').at(-1) ?? file
  if (dependencyFiles.has(name) || /(?:^|\/)(?:package|requirements|pyproject|composer|Cargo|Gemfile|Pipfile|go)\.(?:json|lock|toml|txt|mod|sum)$/i.test(file)) return 'dependency'
  if (file.startsWith('.github/workflows/') || /(?:^|\/)(?:Dockerfile|docker-compose(?:\.[\w-]+)?\.ya?ml)$/i.test(file)) return 'workflow'
  const extension = extensionFor(file)
  if (codeExtensions.has(extension)) return 'code'
  if (configurationExtensions.has(extension) || /(?:^|\/)(?:Dockerfile|Makefile|Procfile|\.npmrc|\.yarnrc(?:\.yml)?)$/i.test(file)) return 'configuration'
  return undefined
}

export function isTestPath(file: string): boolean {
  const parts = file.toLowerCase().split('/')
  const name = parts.at(-1) ?? ''
  return parts.some((part) => ['__mocks__', '__tests__', 'example', 'examples', 'fixture', 'fixtures', 'mock', 'mocks', 'spec', 'specs', 'test', 'tests'].includes(part))
    || /(?:^|[._-])(?:example|fixture|mock|spec|test)(?:[._-]|$)/.test(name)
}

export function isRuntimeEnvironmentFile(name: string): boolean {
  if (name === '.env') return true
  if (!name.startsWith('.env.')) return false
  return !['.env.example', '.env.sample', '.env.template', '.env.dist'].includes(name.toLowerCase())
}

export function scopeCounts(scope: SecurityScope): Record<SecurityScopeFile['kind'], number> {
  return scope.files.reduce<Record<SecurityScopeFile['kind'], number>>((counts, file) => {
    counts[file.kind] += 1
    return counts
  }, { code: 0, configuration: 0, dependency: 0, workflow: 0 })
}

/** Reads only Git's index metadata, never the value of an environment file. */
async function trackedFiles(projectRoot: string, candidates: string[]): Promise<string[]> {
  if (candidates.length === 0) return []
  return new Promise((resolveTracked) => {
    let stdout = ''
    let settled = false
    const finish = (paths: string[]) => {
      if (settled) return
      settled = true
      resolveTracked(paths.filter((path) => candidates.includes(path)).sort())
    }
    let child
    try {
      child = spawn('git', ['ls-files', '-z', '--', ...candidates], { cwd: projectRoot, shell: false, stdio: ['ignore', 'pipe', 'ignore'] })
    } catch { finish([]); return }
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8') })
    child.once('error', () => finish([]))
    child.once('close', (code) => finish(code === 0 ? stdout.split('\0').filter(Boolean) : []))
  })
}

function extensionFor(file: string): string {
  const name = file.split('/').at(-1) ?? file
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

function normalize(path: string): string {
  return path.split(sep).join('/')
}
