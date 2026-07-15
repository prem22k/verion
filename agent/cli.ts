import { resolve } from 'node:path'
import { readFile } from 'node:fs/promises'
import { createContextCapsule } from './core/contextCapsule'
import { diagnoseContextCapsule } from './core/gptDiagnosis'
import type { Evidence } from './core/types'
import { RepositoryDiscoveryProducer } from './evidence/repositoryDiscoveryProducer'
import { RepositoryGraphProducer } from './evidence/repositoryGraphProducer'
import { BrowserObservationProducer } from './evidence/browserObservationProducer'
import { VerificationOrchestrator } from './orchestration/verificationOrchestrator'

function optionValue(args: string[], option: string): string | undefined {
  const index = args.indexOf(option)
  return index >= 0 ? args[index + 1] : undefined
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  const project = optionValue(args, '--project')
  if (!project) throw new Error('Missing required --project path.')

  const targetUrl = optionValue(args, '--url')
  const producers = [
    new RepositoryDiscoveryProducer(),
    new RepositoryGraphProducer(),
    new BrowserObservationProducer()
  ]
  const evidence = await new VerificationOrchestrator(producers).verify({ projectPath: resolve(project), targetUrl })
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
    const capsule = await createContextCapsule(evidence)
    try {
      const report = await diagnoseContextCapsule(capsule)
      process.stdout.write(`${JSON.stringify({ evidence, capsule, report }, null, 2)}\n`)
    } catch (error: unknown) {
      process.stdout.write(`${JSON.stringify({
        evidence,
        capsule,
        diagnosisUnavailable: error instanceof Error ? error.message : 'GPT diagnosis could not complete.'
      }, null, 2)}\n`)
      process.exitCode = 1
    }
    return
  }
  throw new Error('Usage: verion discover --project <path> [--url <running-app-url>] | verion capsule --project <path> --finding <evidence-json-path> | verion verify --project <path> [--url <running-app-url>]')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
