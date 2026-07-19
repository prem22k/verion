import { existsSync } from 'node:fs'
import { chromium, type Browser } from 'playwright'

const installCommand = 'npx playwright install chromium'

export type BrowserRuntimeStatus = {
  available: boolean
  executablePath?: string
  message?: string
  installCommand: string
}

/**
 * Playwright is a package dependency, but its browser runtime is intentionally
 * installed separately. Check that distinction before a review starts so a
 * missing local browser becomes an actionable product message instead of a
 * Playwright stack trace.
 */
export function browserRuntimeStatus(): BrowserRuntimeStatus {
  const executablePath = chromium.executablePath()
  if (executablePath && existsSync(executablePath)) {
    return { available: true, executablePath, installCommand }
  }
  return {
    available: false,
    ...(executablePath ? { executablePath } : {}),
    message: `Browser review needs its local Chromium runtime. Run ${installCommand}, then verify again.`,
    installCommand
  }
}

export class BrowserRuntimeUnavailableError extends Error {
  constructor(readonly guidance = browserRuntimeStatus().message ?? `Browser review needs its local Chromium runtime. Run ${installCommand}, then verify again.`) {
    super(guidance)
    this.name = 'BrowserRuntimeUnavailableError'
  }
}

export async function launchBrowserForReview(): Promise<Browser> {
  const status = browserRuntimeStatus()
  if (!status.available) throw new BrowserRuntimeUnavailableError(status.message)
  try {
    return await chromium.launch({ headless: true })
  } catch (error: unknown) {
    if (isMissingBrowserError(error)) throw new BrowserRuntimeUnavailableError()
    throw error
  }
}

/** Returns a short user-safe next step only for a missing browser runtime. */
export function browserRuntimeGuidance(error: unknown): string | undefined {
  if (error instanceof BrowserRuntimeUnavailableError || isMissingBrowserError(error)) {
    return browserRuntimeStatus().message ?? `Browser review needs its local Chromium runtime. Run ${installCommand}, then verify again.`
  }
  return undefined
}

function isMissingBrowserError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /executable (?:doesn'?t exist|does not exist)|playwright install|browser.*not found|failed to launch.*chromium/i.test(message)
}
