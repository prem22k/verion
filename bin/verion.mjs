#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const agentCli = join(packageRoot, 'agent', 'cli.ts')
const require = createRequire(import.meta.url)
let tsxCli

try {
  tsxCli = require.resolve('tsx/cli')
} catch {
  console.error('Verion is incomplete. Reinstall the package with npm, then try again.')
  process.exit(1)
}

if (!existsSync(agentCli)) {
  console.error('Verion is incomplete. Reinstall the package with npm, then try again.')
  process.exit(1)
}

const child = spawn(process.execPath, [tsxCli, agentCli, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  stdio: 'inherit'
})

child.on('error', (error) => {
  console.error(`Verion could not start: ${error.message}`)
  process.exitCode = 1
})

child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
