#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const tsxCli = join(packageRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const agentCli = join(packageRoot, 'agent', 'cli.ts')
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
