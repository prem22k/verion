import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchBrowserForReview } from './evidence/browserRuntime'
import { startVerionServer } from '../server'

async function main() {
  const root = await mkdtemp(join(tmpdir(), 'verion-phase7-browser-'))
  const port = await freePort()
  const priorProvider = process.env.VERION_AI_PROVIDER
  process.env.VERION_AI_PROVIDER = 'verion_ai'
  let dashboard: Awaited<ReturnType<typeof startVerionServer>> | undefined
  let browser: Awaited<ReturnType<typeof launchBrowserForReview>> | undefined
  try {
    await fixture(root)
    dashboard = await startVerionServer({ projectPath: root, port, watchChanges: false })
    browser = await launchBrowserForReview()
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(dashboard.url, { waitUntil: 'domcontentloaded' })

    await assertVisible(page, 'Project Understanding')
    await page.locator('#ask-verion').fill('What does this project do?')
    await page.getByRole('button', { name: 'Ask Verion', exact: true }).click()
    await assertVisible(page, 'Discovered fact:')
    const answer = await page.locator('.assistant-message--verion').last().innerText()
    assert.match(answer, /project|application/i)

    await page.locator('a[href="#/security"]').click()
    await assertVisible(page, 'Security')
    assert.match(await page.locator('.assistant-message--verion').last().innerText(), /Discovered fact:/)
    await assertVisible(page, 'Ready when you are')
    assert.equal(await page.locator('.security-launch').count(), 1, 'first Security visit is a focused scan launcher')
    assert.equal(await page.locator('.security-transit').count(), 0, 'review stations are not fabricated before the developer starts a scan')
    await assertVisible(page, 'Credentials and secrets')
    await assertVisible(page, 'Deployment configuration')
    await page.getByRole('button', { name: 'Start Deep Security Review', exact: true }).click()
    await page.locator('.security-transit__station--completed').first().waitFor({ state: 'visible', timeout: 15_000 })
    await page.waitForFunction(() => Boolean(document.querySelector('.security-transit--partial, .security-transit--completed, .security-transit--concern')), undefined, { timeout: 15_000 })
    assert.ok(await page.locator('.security-transit__station--completed').count() >= 3, 'manual Security review advances through the locally available review stations')
    assert.ok(await page.locator('.security-transit__station--skipped').count() >= 1, 'a missing local app is communicated as a skipped station rather than a passed review')

    await page.reload({ waitUntil: 'domcontentloaded' })
    await assertVisible(page, 'Security')
    await page.locator('.assistant-message--verion').last().waitFor({ state: 'visible', timeout: 15_000 })
    await page.locator('.assistant-message--developer').last().waitFor({ state: 'visible', timeout: 15_000 })
    assert.equal(await page.locator('.assistant-message--verion').count(), 1, 'assistant conversation persists across a dashboard reload')
    assert.equal(await page.locator('.assistant-message--developer').count(), 1, 'developer question persists across a dashboard reload')
    process.stdout.write(`${JSON.stringify({ home: true, security: true, securityLaunch: true, manualSecurity: true, assistantPersistence: true, dashboardReload: true })}\n`)
  } finally {
    await browser?.close()
    await dashboard?.close()
    if (priorProvider === undefined) delete process.env.VERION_AI_PROVIDER
    else process.env.VERION_AI_PROVIDER = priorProvider
    await rm(root, { recursive: true, force: true })
  }
}

async function fixture(root: string) {
  await mkdir(join(root, 'src'), { recursive: true })
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'browser-fixture', scripts: { test: 'node -e "process.exit(0)"' }, dependencies: { react: '18.3.1' } }), 'utf8')
  await writeFile(join(root, 'src', 'main.tsx'), 'export const app = true\n', 'utf8')
  await writeFile(join(root, 'src', 'dashboard.tsx'), 'export const dashboard = true\n', 'utf8')
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') return reject(new Error('Could not reserve a local test port.'))
      server.close((error) => error ? reject(error) : resolve(address.port))
    })
  })
}

async function assertVisible(page: import('playwright').Page, text: string) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: 15_000 })
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1 })
