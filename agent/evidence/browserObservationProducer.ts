import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, type Browser, type Page } from 'playwright'
import type { Evidence, EvidenceProducer, EvidenceProductionContext, ProjectDiscovery, ProjectRoute } from '../core/types'

const maximumJourneys = 5
const maximumSignals = 6

type JourneyKind = 'home' | 'authentication' | 'dashboard' | 'billing' | 'settings'

export type BrowserJourney = {
  id: JourneyKind
  label: string
  path?: string
}

type PageReview = {
  title: string
  interactiveElementCount: number
  navigationLabels: string[]
  formCount: number
  formFieldCount: number
}

export class BrowserObservationProducer implements EvidenceProducer {
  readonly id = 'browser-observation'

  async produce(context: EvidenceProductionContext): Promise<Evidence[]> {
    if (!context.targetUrl) return []

    const evidence: Evidence[] = []
    const capturedAt = new Date().toISOString()
    const runDirectory = join(tmpdir(), 'verion-evidence', `${Date.now()}-${Math.random().toString(16).slice(2)}`)
    await mkdir(runDirectory, { recursive: true })

    const record = async (item: Evidence) => {
      evidence.push(item)
      await context.onEvidence?.(item)
    }
    const discovery = discoveryFromEvidence(context.evidence)
    const journeys = planBrowserJourneys(discovery)
    const signalKeys = new Set<string>()
    let signalCount = 0
    let activeJourney: BrowserJourney | undefined
    let browser: Browser | undefined
    let page: Page | undefined

    const recordSignal = async (key: string, item: Evidence) => {
      if (signalCount >= maximumSignals || signalKeys.has(key)) return
      signalKeys.add(key)
      signalCount += 1
      await record(item)
    }

    try {
      browser = await chromium.launch({ headless: true })
      page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
      const targetOrigin = new URL(context.targetUrl).origin

      page.on('console', (message) => {
        if (message.type() !== 'error') return
        const text = message.text().trim().slice(0, 500)
        if (!text) return
        void recordSignal(`console:${text}`, {
          id: `${this.id}:console:${signalCount + 1}`,
          producer: this.id,
          kind: 'console_log',
          capturedAt,
          summary: `Console error while reviewing ${activeJourney?.label ?? 'the application'}: ${text}`,
          location: { url: page?.url(), route: activeJourney?.path },
          data: { level: 'error', text, journey: activeJourney?.label }
        })
      })

      page.on('requestfailed', (request) => {
        if (!sameOrigin(request.url(), targetOrigin)) return
        const requestUrl = request.url()
        void recordSignal(`request-failed:${request.method()}:${requestUrl}`, {
          id: `${this.id}:network:${signalCount + 1}`,
          producer: this.id,
          kind: 'network_log',
          capturedAt,
          summary: `A request needed for ${activeJourney?.label ?? 'the application'} did not complete.`,
          location: { url: requestUrl, route: activeJourney?.path },
          data: { method: request.method(), failure: request.failure()?.errorText, journey: activeJourney?.label }
        })
      })

      page.on('response', (response) => {
        if (response.status() < 400 || !sameOrigin(response.url(), targetOrigin)) return
        const responseUrl = response.url()
        void recordSignal(`response:${response.status()}:${responseUrl}`, {
          id: `${this.id}:response:${signalCount + 1}`,
          producer: this.id,
          kind: 'network_log',
          capturedAt,
          summary: `${activeJourney?.label ?? 'The application'} returned HTTP ${response.status()} while Verion was reviewing it.`,
          location: { url: responseUrl, route: activeJourney?.path },
          data: { status: response.status(), statusText: response.statusText(), journey: activeJourney?.label }
        })
      })

      for (const journey of journeys) {
        activeJourney = journey
        const url = journeyUrl(context.targetUrl, journey.path)
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 })
        await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined)
        await page.waitForTimeout(100)
        const review = await inspectPage(page)
        const status = response?.status() ?? null

        await record({
          id: `${this.id}:journey:${journey.id}`,
          producer: this.id,
          kind: 'browser_exploration',
          capturedAt,
          summary: journeySummary(journey, status, review),
          location: { url: page.url(), route: journey.path },
          data: {
            journey: journey.id,
            journeyLabel: journey.label,
            plannedFrom: 'project-understanding',
            status,
            title: review.title,
            interactiveElementCount: review.interactiveElementCount,
            navigationLabels: review.navigationLabels,
            formCount: review.formCount,
            formFieldCount: review.formFieldCount
          }
        })

        if (status !== null && status >= 400) await captureRelevantScreenshot(record, runDirectory, capturedAt, page, journey)
      }
    } catch (error: unknown) {
      const failure: Evidence = {
        id: `${this.id}:failure`,
        producer: this.id,
        kind: 'browser_exploration',
        capturedAt,
        summary: `Verion could not review ${activeJourney?.label ?? 'the running application'}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        location: { url: page?.url() || context.targetUrl, route: activeJourney?.path },
        data: { status: 'failed', journey: activeJourney?.id, journeyLabel: activeJourney?.label }
      }
      await record(failure)
      if (page && activeJourney) await captureRelevantScreenshot(record, runDirectory, capturedAt, page, activeJourney)
    } finally {
      await browser?.close()
    }

    return evidence
  }
}

export function planBrowserJourneys(discovery: ProjectDiscovery | undefined): BrowserJourney[] {
  const routes = discovery?.routes.filter(isStaticPageRoute) ?? []
  const journeys: BrowserJourney[] = []
  const add = (journey: BrowserJourney) => {
    if (journeys.length >= maximumJourneys || journeys.some((candidate) => candidate.path === journey.path)) return
    journeys.push(journey)
  }

  add({ id: 'home', label: 'the starting experience', path: routes.find((route) => route.path === '/')?.path })
  addKnownRoute(journeys, routes, 'authentication', 'sign-in', /(?:^|\/)(?:sign-in|signin|sign-up|signup|login|auth)(?:\/|$)/)
  addKnownRoute(journeys, routes, 'dashboard', 'dashboard', /(?:^|\/)(?:dashboard|workspace|admin)(?:\/|$)/)
  addKnownRoute(journeys, routes, 'billing', 'billing', /(?:^|\/)(?:billing|checkout|subscription|payment|invoice)(?:\/|$)/)
  addKnownRoute(journeys, routes, 'settings', 'settings', /(?:^|\/)(?:settings|preferences|profile)(?:\/|$)/)
  return journeys.slice(0, maximumJourneys)
}

function addKnownRoute(journeys: BrowserJourney[], routes: ProjectRoute[], id: Exclude<JourneyKind, 'home'>, label: string, expression: RegExp) {
  if (journeys.length >= maximumJourneys || journeys.some((journey) => journey.id === id)) return
  const route = routes.find((candidate) => expression.test(candidate.path.toLowerCase()))
  if (route && !journeys.some((candidate) => candidate.path === route.path)) journeys.push({ id, label, path: route.path })
}

function discoveryFromEvidence(evidence: Evidence[]): ProjectDiscovery | undefined {
  const discovery = evidence.find((item) => item.kind === 'repository_discovery')?.data
  return discovery && typeof discovery === 'object' && 'routes' in discovery ? discovery as ProjectDiscovery : undefined
}

function isStaticPageRoute(route: ProjectRoute): boolean {
  return !route.path.startsWith('/api/') && !/[\[\]:*]/.test(route.path)
}

function journeyUrl(targetUrl: string, route: string | undefined): string {
  if (!route || route === '/') return targetUrl
  const base = new URL(targetUrl)
  return new URL(route, base.origin).toString()
}

function sameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin
  } catch {
    return false
  }
}

async function inspectPage(page: Page): Promise<PageReview> {
  return page.locator('body').evaluate((body) => {
    const text = (element: Element) => (element.getAttribute('aria-label') || element.textContent || '').replace(/\s+/g, ' ').trim()
    const navigationLabels = Array.from(body.querySelectorAll('nav a, [role="navigation"] a'))
      .map(text)
      .filter(Boolean)
      .slice(0, 6)
    const forms = Array.from(body.querySelectorAll('form'))
    const formFieldCount = forms.reduce((count, form) => count + form.querySelectorAll('input, select, textarea').length, 0)
    return {
      title: document.title.trim().slice(0, 160),
      interactiveElementCount: body.querySelectorAll('a, button, input, select, textarea, [role="button"]').length,
      navigationLabels,
      formCount: forms.length,
      formFieldCount
    }
  })
}

function journeySummary(journey: BrowserJourney, status: number | null, review: PageReview): string {
  if (status !== null && status >= 400) return `The planned ${journey.label} journey returned HTTP ${status}.`
  const formDetail = review.formCount > 0
    ? ` It includes ${review.formCount === 1 ? 'a form' : `${review.formCount} forms`} with ${review.formFieldCount} fields; Verion inspected it without entering or submitting data.`
    : ''
  const navigationDetail = review.navigationLabels.length > 0
    ? ` Navigation exposes ${review.navigationLabels.slice(0, 3).join(', ')}.`
    : ''
  return `Reviewed ${journey.label}.${formDetail}${navigationDetail}`
}

async function captureRelevantScreenshot(
  record: (item: Evidence) => Promise<void>,
  runDirectory: string,
  capturedAt: string,
  page: Page,
  journey: BrowserJourney
) {
  const path = join(runDirectory, `${journey.id}.png`)
  try {
    await page.screenshot({ path, fullPage: true })
  } catch {
    return
  }
  await record({
    id: `browser-observation:screenshot:${journey.id}`,
    producer: 'browser-observation',
    kind: 'screenshot',
    capturedAt,
    summary: `Captured ${journey.label} because it needs review.`,
    location: { url: page.url(), route: journey.path },
    data: { path }
  })
}
