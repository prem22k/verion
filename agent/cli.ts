import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { platform } from 'node:os'
import { createContextCapsule } from './core/contextCapsule'
import type { Evidence } from './core/types'
import { runProjectVerification } from './runProjectVerification'
import { startVerionServer } from '../server'

function optionValue(args: string[], option: string): string | undefined {
  const index = args.indexOf(option)
  return index >= 0 ? args[index + 1] : undefined
}

async function main() {
  const rawArgs = process.argv.slice(2)
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    printUsage()
    return
  }
  const command = rawArgs[0] && !rawArgs[0].startsWith('-') ? rawArgs[0] : 'start'
  const args = command === 'start' && rawArgs[0]?.startsWith('-') ? rawArgs : rawArgs.slice(1)
  if (command === 'start') {
    const targetUrl = optionValue(args, '--url')
    const portValue = optionValue(args, '--port')
    const requestedPort = portValue ? Number(portValue) : undefined
    if (portValue && (!Number.isInteger(requestedPort) || requestedPort! < 1 || requestedPort! > 65_535)) throw new Error('--port must be a valid TCP port.')
    const projectPath = resolve(optionValue(args, '--project') ?? process.cwd())
    const port = requestedPort ?? await findAvailablePort()
    const server = await startVerionServer({
      port,
      projectPath,
      targetUrl,
      watchChanges: !args.includes('--no-watch')
    })
    process.stdout.write(`Verion is learning ${projectPath}\n`)
    process.stdout.write(`Verion is ready at ${server.url}\n`)
    openDashboard(server.url)
    return
  }

  const project = optionValue(args, '--project')
  if (!project) throw new Error('Missing required --project path.')

  const targetUrl = optionValue(args, '--url')
  const result = await runProjectVerification({
    projectPath: resolve(project),
    targetUrl,
    diagnose: command === 'verify',
    recordMemory: command === 'verify'
  })
  const { evidence } = result
  if (command === 'discover') {
    process.stdout.write(`${JSON.stringify({ evidence }, null, 2)}\n`)
    return
  }
  if (command === 'capsule') {
    const findingPath = optionValue(args, '--finding')
    if (!findingPath) throw new Error('Missing required --finding JSON file.')
    const additionalEvidence = JSON.parse(await readFile(resolve(findingPath), 'utf8')) as Evidence[]
    const capsule = await createContextCapsule([...evidence, ...additionalEvidence])
    process.stdout.write(`${JSON.stringify(capsule, null, 2)}\n`)
    return
  }
  if (command === 'verify') {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (result.diagnosisUnavailable) process.exitCode = 1
    return
  }
  printUsage()
  process.exitCode = 1
}

async function findAvailablePort() {
  for (let port = 5173; port < 5193; port += 1) {
    if (await canListen(port)) return port
  }
  throw new Error('Verion could not find a free local port between 5173 and 5192. Use --port <port> to choose one.')
}

async function canListen(port: number) {
  return new Promise<boolean>((resolvePort) => {
    const probe = createServer()
    probe.once('error', () => resolvePort(false))
    probe.once('listening', () => probe.close(() => resolvePort(true)))
    probe.listen(port, '127.0.0.1')
  })
}

function printUsage() {
  process.stdout.write(`Verion learns the project in your current directory and opens its local dashboard.\n\nUsage:\n  verion [--url <running-app-url>] [--port <port>] [--no-watch]\n  verion --project <path> [--url <running-app-url>] [--port <port>]\n  verion discover --project <path> [--url <running-app-url>]\n  verion capsule --project <path> --finding <evidence-json-path>\n  verion verify --project <path> [--url <running-app-url>]\n`)
}

function openDashboard(url: string) {
  if (process.env.VERION_NO_OPEN === '1') return
  const command = platform() === 'darwin' ? 'open' : platform() === 'win32' ? 'cmd.exe' : 'xdg-open'
  const args = platform() === 'win32' ? ['/c', 'start', '', url] : [url]
  try {
    const browser = spawn(command, args, { detached: true, stdio: 'ignore' })
    browser.unref()
  } catch {
    // The dashboard URL is still printed when no desktop opener is available.
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
