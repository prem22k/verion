import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { startVerionServer } from '../server'

const server = await startVerionServer({ port: 4180 })
const browser = await chromium.launch({ headless: true })

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  await page.goto(server.url, { waitUntil: 'networkidle' })
  const startedAt = performance.now()
  await page.getByRole('button', { name: 'Verify application' }).click()
  await page.getByRole('heading', { name: 'Workspace creation discards the selected template' }).waitFor()
  const diagnosisMs = Math.round(performance.now() - startedAt)
  await mkdir(resolve('artifacts'), { recursive: true })
  await page.screenshot({ path: resolve('artifacts/dashboard-needs-attention.png'), fullPage: true })
  process.stdout.write(`Diagnosis rendered in ${diagnosisMs}ms\nCaptured artifacts/dashboard-needs-attention.png\n`)
} finally {
  await browser.close()
  await server.close()
}
