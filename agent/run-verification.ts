import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { createServer, type ViteDevServer } from 'vite'
import type { VerificationRun } from '../src/verification'

const artifactDirectory = resolve('artifacts')

export async function runVerification(targetUrl: string): Promise<VerificationRun> {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Marketing launch' }).click()
    await page.getByRole('button', { name: 'Create workspace' }).click()
    await page.getByRole('heading', { name: 'Northstar is ready.' }).waitFor()
    await mkdir(artifactDirectory, { recursive: true })
    const screenshotPath = resolve(artifactDirectory, 'workspace-template-mismatch.png')
    await page.screenshot({ path: screenshotPath, fullPage: true })
    const createdCopy = await page.locator('.target-success').innerText()
    const templateWasPreserved = createdCopy.includes('Marketing launch')

    const result: VerificationRun = templateWasPreserved
      ? {
          id: 'run-002',
          targetLabel: 'Atlas workspace creation',
          recommendation: 'ready_to_ship',
          exploredAt: new Date().toISOString(),
          steps: [
            { id: 'open', action: 'Opened workspace creation', outcome: 'passed' },
            { id: 'template', action: 'Selected Marketing launch', outcome: 'passed' },
            { id: 'create', action: 'Created the workspace with the selected template', outcome: 'passed' }
          ]
        }
      : {
          id: 'run-001',
          targetLabel: 'Atlas workspace creation',
          recommendation: 'needs_attention',
          exploredAt: new Date().toISOString(),
          steps: [
            { id: 'open', action: 'Opened workspace creation', outcome: 'passed' },
            { id: 'template', action: 'Selected Marketing launch', outcome: 'passed' },
            { id: 'create', action: 'Confirmed the selected template after workspace creation', outcome: 'failed' }
          ],
          issue: {
            title: 'Workspace creation discards the selected template',
            userImpact: 'A user chooses a workspace template, but receives a blank workspace instead.',
            likelyRootCause: 'The confirmation action resets the selected template to the default before creation completes.',
            expectedBehavior: 'A workspace created after selecting Marketing launch should use the Marketing launch template.',
            observedBehavior: 'The created workspace reports that it was made from the Blank workspace template.',
            relevantFiles: ['src/DemoTargetApp.tsx — createWorkspace'],
            evidence: [
              { id: 'template-mismatch', kind: 'screenshot', label: 'Created workspace', detail: `The confirmation screen says: ${createdCopy.replace(/\s+/g, ' ')}`, artifactPath: '/artifacts/workspace-template-mismatch.png' }
            ]
          }
        }

    await writeFile(resolve(artifactDirectory, 'latest-run.json'), `${JSON.stringify(result, null, 2)}\n`)
    return result
  } finally {
    await browser.close()
  }
}

async function runCli() {
  let viteServer: ViteDevServer | undefined
  let targetUrl = process.env.TARGET_URL

  if (!targetUrl) {
    viteServer = await createServer({
      logLevel: 'error',
      server: { host: '127.0.0.1', port: 4173, strictPort: false }
    })
    await viteServer.listen()
    targetUrl = `${viteServer.resolvedUrls!.local[0]}demo-target`
  }

  try {
    const result = await runVerification(targetUrl)
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } finally {
    await viteServer?.close()
  }
}

if (process.argv[1]?.endsWith('run-verification.ts')) {
  runCli().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
