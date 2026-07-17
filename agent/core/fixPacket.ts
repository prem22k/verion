import { createHash } from 'node:crypto'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { platform } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import type { ContextCapsule, Evidence, StoredReleaseReport } from './types'

const packetDirectoryName = 'fix-packets'
const packetMode = 0o600

export type FixPacket = {
  path: string
  content: string
}

export type FixPacketLaunchRequest = {
  projectPath: string
  packetPath: string
}

export type FixPacketLaunchResult = { opened: true } | { opened: false }

export type FixPacketLauncher = (request: FixPacketLaunchRequest) => Promise<FixPacketLaunchResult>

export class FixPacketIncompleteError extends Error {
  constructor() {
    super('A completed review with supporting observations is required before preparing a repair.')
    this.name = 'FixPacketIncompleteError'
  }
}

export function createFixPacket(report: StoredReleaseReport, evidence: Evidence[], capsule: ContextCapsule): FixPacket {
  if (report.recommendation !== 'needs_attention') throw new FixPacketIncompleteError()

  const citedEvidence = report.evidenceIds
    .map((id) => evidence.find((item) => item.id === id))
    .filter((item): item is Evidence => Boolean(item))
    .slice(0, 5)
  if (citedEvidence.length === 0) throw new FixPacketIncompleteError()

  const likelyFiles = capsule.relevantFiles.slice(0, 5)
  const reproduction = capsule.reproductionContext
    .map((item) => redactPacketText(item))
    .filter(Boolean)
    .slice(0, 4)
  const issue = `${redactPacketText(report.headline)} This could affect the release path Verion reviewed.`
  const evidenceLines = citedEvidence.map((item) => `- ${redactPacketText(item.summary)}`).join('\n')
  const fileLines = likelyFiles.length > 0
    ? likelyFiles.map((file) => `- \`${safeRelativePath(file.path)}\` — ${redactPacketText(file.reason)}`).join('\n')
    : '- No relevant local file is supported by this review yet.'
  const verificationLines = reproduction.length > 0
    ? reproduction.map((item) => `- ${item}`).join('\n')
    : '- Reproduce the behavior described in the issue before proposing a repair.'

  const content = `# Fix Packet\n\n## Issue\n\n${issue}\n\n## Evidence\n\n${evidenceLines}\n\n## Likely files\n\n${fileLines}\n\n## Root cause\n\n${redactPacketText(report.rootCause)}\n\n## Repair request\n\nMake the smallest safe repair for this issue and preserve unrelated behavior. Start by reproducing or inspecting the problem, explain the proposed repair, and wait for the developer’s explicit approval before writing any files.\n\n## Verification plan\n\n${verificationLines}\n- Run the smallest relevant project check, then save the repair so Verion can verify this release again.\n`
  return { path: packetPathFor(report), content }
}

export async function writeFixPacket(projectPath: string, packet: FixPacket): Promise<FixPacket> {
  const directory = join(projectPath, '.verion', packetDirectoryName)
  const path = join(directory, packet.path)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await chmod(directory, 0o700)
  await writeFile(path, packet.content, { encoding: 'utf8', mode: packetMode })
  await chmod(path, packetMode)
  return { ...packet, path }
}

export async function launchInteractiveCodex(request: FixPacketLaunchRequest): Promise<FixPacketLaunchResult> {
  if (!await hasCodexCli()) return { opened: false }
  const command = codexCommand(request.projectPath, request.packetPath)
  if (platform() === 'darwin') return openMacTerminal(command)
  if (platform() === 'win32') return openWindowsTerminal(command)
  return openLinuxTerminal(command)
}

function hasCodexCli(): Promise<boolean> {
  return new Promise((resolveAvailable) => {
    let settled = false
    const finish = (available: boolean) => {
      if (settled) return
      settled = true
      resolveAvailable(available)
    }
    try {
      const child = spawn('codex', ['--version'], { stdio: 'ignore' })
      const timeout = setTimeout(() => {
        child.kill()
        finish(false)
      }, 2_000)
      child.once('error', () => {
        clearTimeout(timeout)
        finish(false)
      })
      child.once('exit', (code) => {
        clearTimeout(timeout)
        finish(code === 0)
      })
    } catch {
      finish(false)
    }
  })
}

function packetPathFor(report: StoredReleaseReport): string {
  return `repair-${createHash('sha256').update(report.id).digest('hex').slice(0, 16)}.md`
}

function codexCommand(projectPath: string, packetPath: string): string {
  const prompt = `Read the repair brief at ${packetPath}. Do not edit files yet. First inspect or reproduce the issue and explain the smallest safe repair plan. Wait for the developer's explicit approval before writing any files.`
  if (platform() === 'win32') return `cd /d ${windowsQuote(projectPath)} && codex ${windowsQuote(prompt)}`
  return `cd ${shellQuote(projectPath)} && codex ${shellQuote(prompt)}`
}

async function openMacTerminal(command: string): Promise<FixPacketLaunchResult> {
  const script = `tell application "Terminal" to do script ${appleScriptQuote(command)}`
  return launchVisible('osascript', ['-e', script])
}

async function openWindowsTerminal(command: string): Promise<FixPacketLaunchResult> {
  return launchVisible('cmd.exe', ['/d', '/s', '/c', 'start', '', 'cmd.exe', '/k', command])
}

async function openLinuxTerminal(command: string): Promise<FixPacketLaunchResult> {
  const terminal = process.env.TERMINAL || 'x-terminal-emulator'
  return launchVisible(terminal, ['-e', 'bash', '-lc', command])
}

function launchVisible(command: string, args: string[]): Promise<FixPacketLaunchResult> {
  return new Promise((resolveResult) => {
    let settled = false
    const finish = (result: FixPacketLaunchResult) => {
      if (settled) return
      settled = true
      resolveResult(result)
    }
    try {
      const child = spawn(command, args, { detached: true, stdio: 'ignore' })
      child.once('error', () => finish({ opened: false }))
      child.once('spawn', () => {
        const timer = setTimeout(() => finish({ opened: true }), 280)
        child.once('exit', (code) => {
          clearTimeout(timer)
          finish({ opened: code === 0 })
        })
        child.unref()
      })
    } catch {
      finish({ opened: false })
    }
  })
}

function redactPacketText(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, 'the running product')
    .replace(/\b(?:api[_-]?key|token|password|secret|authorization)\s*[:=]\s*[^\s,;]+/gi, 'sensitive value removed')
    .replace(/(?:^|\s)(?:\.?\.?\/)?(?:[\w.-]+\/)+[\w.-]+\.(?:[cm]?[jt]sx?|json|prisma)(?=$|[\s),.:])/gi, ' a project file')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function safeRelativePath(path: string): string {
  return path.replace(/[`\r\n]/g, '').replace(/^\/+/, '') || 'a relevant project file'
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

function windowsQuote(value: string): string {
  return `"${value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1')}"`
}

function appleScriptQuote(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
