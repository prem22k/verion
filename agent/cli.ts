import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { createContextCapsule } from './core/contextCapsule'
import type { Evidence } from './core/types'
import { runProjectVerification } from './runProjectVerification'

function optionValue(args: string[], option: string): string | undefined {
  const index = args.indexOf(option)
  return index >= 0 ? args[index + 1] : undefined
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  const project = optionValue(args, '--project')
  if (!project) throw new Error('Missing required --project path.')

  const targetUrl = optionValue(args, '--url')
  const result = await runProjectVerification({ projectPath: resolve(project), targetUrl, diagnose: command === 'verify' })
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
  throw new Error('Usage: verion discover --project <path> [--url <running-app-url>] | verion capsule --project <path> --finding <evidence-json-path> | verion verify --project <path> [--url <running-app-url>]')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
