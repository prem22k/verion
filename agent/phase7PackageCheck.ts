import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { access, mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))

async function main() {
  const root = await mkdtemp(join(tmpdir(), 'verion-phase7-package-'))
  const packDirectory = join(root, 'package')
  const installDirectory = join(root, 'installed')
  const projectDirectory = join(root, 'unrelated-project')
  const port = await freePort()
  let verion: ChildProcess | undefined
  try {
    await mkdir(packDirectory, { recursive: true })
    await fixture(projectDirectory)
    await run('npm', ['pack', '--pack-destination', packDirectory], packageRoot)
    const archive = await packageArchive(packDirectory)
    await mkdir(installDirectory, { recursive: true })
    await writeFile(join(installDirectory, 'package.json'), JSON.stringify({ private: true, name: 'verion-package-check' }), 'utf8')
    await run('npm', ['install', '--no-audit', '--no-fund', archive], installDirectory)
    const executable = join(installDirectory, 'node_modules', '.bin', 'verion')
    await access(executable)

    verion = spawn(executable, ['--port', String(port), '--no-watch'], {
      cwd: projectDirectory,
      env: { ...process.env, VERION_NO_OPEN: '1', VERION_AI_PROVIDER: 'verion_ai' },
      stdio: 'pipe',
      detached: true
    })
    const connection = await waitForConnection(`http://127.0.0.1:${port}/api/connection`)
    assert.equal(connection.mission?.project.name, 'unrelated-package-fixture')
    await access(join(projectDirectory, '.verion', 'project-memory.json'))
    await stopProcess(verion)
    verion = undefined
    await waitForPortToClose(`http://127.0.0.1:${port}/api/connection`)
    console.log(JSON.stringify({ packed: true, installed: true, unrelatedDirectory: true, dashboard: true, localMemory: true, cleanStop: true }))
  } finally {
    if (verion) await stopProcess(verion)
    await rm(root, { recursive: true, force: true })
  }
}

async function fixture(root: string) {
  await mkdir(join(root, 'src'), { recursive: true })
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'unrelated-package-fixture', scripts: { test: 'node -e "process.exit(0)"' }, dependencies: { react: '18.3.1' } }), 'utf8')
  await writeFile(join(root, 'src', 'main.tsx'), 'export const fixture = true\n', 'utf8')
}

async function packageArchive(directory: string): Promise<string> {
  const files = await readdir(directory)
  const archive = files.find((file) => /^verion-.*\.tgz$/.test(file))
  if (!archive) throw new Error('npm pack did not create the Verion package archive.')
  return join(directory, archive)
}

async function run(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: 'pipe', shell: false })
    let output = ''
    child.stdout?.on('data', (chunk) => { output += String(chunk) })
    child.stderr?.on('data', (chunk) => { output += String(chunk) })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} failed: ${output.slice(-1_000)}`)))
  })
}

async function waitForConnection(url: string): Promise<{ mission?: { project: { name: string } } }> {
  const deadline = Date.now() + 30_000
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) })
      if (response.ok) {
        const data = await response.json() as { mission?: { project: { name: string } } }
        if (data.mission) return data
      }
    } catch (error) { lastError = error }
    await delay(250)
  }
  throw new Error(`The packaged Verion dashboard did not become ready: ${lastError instanceof Error ? lastError.message : 'unknown local error'}`)
}

async function waitForPortToClose(url: string): Promise<void> {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(500) })
    } catch { return }
    await delay(150)
  }
  throw new Error('The packaged Verion dashboard did not stop cleanly.')
}

async function stopProcess(child: ChildProcess): Promise<void> {
  if (!child.pid) return
  try { process.kill(-child.pid, 'SIGTERM') } catch { child.kill('SIGTERM') }
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 5_000)
    child.once('exit', () => { clearTimeout(timer); resolve() })
  })
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') return reject(new Error('Could not reserve a local package test port.'))
      server.close((error) => error ? reject(error) : resolve(address.port))
    })
  })
}

function delay(milliseconds: number) { return new Promise((resolve) => setTimeout(resolve, milliseconds)) }

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1 })
