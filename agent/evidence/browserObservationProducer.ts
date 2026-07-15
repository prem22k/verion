import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, type Browser } from 'playwright'
import type { Evidence, EvidenceProducer, EvidenceProductionContext } from '../core/types'

export class BrowserObservationProducer implements EvidenceProducer {
  readonly id = 'browser-observation'

  async produce(context: EvidenceProductionContext): Promise<Evidence[]> {
    if (!context.targetUrl) return []

    const evidence: Evidence[] = []
    const capturedAt = new Date().toISOString()
    const runDirectory = join(tmpdir(), 'verion-evidence', `${Date.now()}-${Math.random().toString(16).slice(2)}`)
    await mkdir(runDirectory, { recursive: true })

    let browser: Browser | undefined
    try {
      browser = await chromium.launch({ headless: true })
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

      page.on('console', (message) => {
        if (message.type() === 'debug' || message.type() === 'info') return
        evidence.push({
          id: `${this.id}:console:${evidence.length}`,
          producer: this.id,
          kind: 'console_log',
          capturedAt,
          summary: `Browser console ${message.type()}: ${message.text()}`,
          location: { url: page.url() },
          data: { level: message.type(), text: message.text() }
        })
      })

      page.on('requestfailed', (request) => {
        evidence.push({
          id: `${this.id}:network:${evidence.length}`,
          producer: this.id,
          kind: 'network_log',
          capturedAt,
          summary: `Network request failed: ${request.method()} ${request.url()}`,
          location: { url: request.url() },
          data: { method: request.method(), failure: request.failure()?.errorText }
        })
      })

      page.on('response', (response) => {
        if (response.status() < 400) return
        evidence.push({
          id: `${this.id}:response:${evidence.length}`,
          producer: this.id,
          kind: 'network_log',
          capturedAt,
          summary: `Network response ${response.status()}: ${response.url()}`,
          location: { url: response.url() },
          data: { status: response.status(), statusText: response.statusText() }
        })
      })

      const response = await page.goto(context.targetUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 })
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined)
      const screenshotPath = join(runDirectory, 'initial-page.png')
      await page.screenshot({ path: screenshotPath, fullPage: true })
      const interactiveElements = await page.locator('a, button, input, select, textarea, [role="button"]').evaluateAll((elements) =>
        elements.slice(0, 50).map((element) => ({
          tag: element.tagName.toLowerCase(),
          label: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 120)
        }))
      )

      const title = await page.title()
      evidence.unshift({
        id: `${this.id}:page`,
        producer: this.id,
        kind: 'browser_exploration',
        capturedAt,
        summary: `Opened ${title || page.url()} and observed ${interactiveElements.length} interactive elements.`,
        location: { url: page.url() },
        data: {
          status: response?.status() ?? null,
          title,
          interactiveElements
        }
      })
      evidence.push({
        id: `${this.id}:screenshot`,
        producer: this.id,
        kind: 'screenshot',
        capturedAt,
        summary: 'Captured the initial rendered page for review.',
        location: { url: page.url() },
        data: { path: screenshotPath }
      })
    } catch (error: unknown) {
      evidence.push({
        id: `${this.id}:failure`,
        producer: this.id,
        kind: 'browser_exploration',
        capturedAt,
        summary: `Browser observation could not complete: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: { url: context.targetUrl },
        data: { status: 'failed' }
      })
    } finally {
      await browser?.close()
    }

    return evidence
  }
}
