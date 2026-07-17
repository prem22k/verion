import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
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
  const command = rawArgs[0] && !rawArgs[0].startsWith('-') ? rawArgs[0] : 'start'
  const args = command === 'start' && rawArgs[0]?.startsWith('-') ? rawArgs : rawArgs.slice(1)
  if (command === 'start') {
    const targetUrl = optionValue(args, '--url')
    const portValue = optionValue(args, '--port')
    const port = portValue ? Number(portValue) : undefined
    if (portValue && (!Number.isInteger(port) || port! < 1 || port! > 65_535)) throw new Error('--port must be a valid TCP port.')
    const server = await startVerionServer({
      port,
      projectPath: process.cwd(),
      targetUrl,
      watchChanges: !args.includes('--no-watch')
    })
    process.stdout.write(`Verion is watching ${process.cwd()} at ${server.url}\n`)
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
  throw new Error('Usage: verion [--url <running-app-url>] [--port <port>] [--no-watch] | verion discover --project <path> [--url <running-app-url>] | verion capsule --project <path> --finding <evidence-json-path> | verion verify --project <path> [--url <running-app-url>]')
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
