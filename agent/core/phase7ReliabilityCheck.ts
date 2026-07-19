import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getAIProvider, getProviderDefaultCapabilities, modelDescriptor } from '../ai/providers'
import type { ResolvedAIProvider } from '../ai/provider'
import { createMissionControl, localAppCandidatePorts } from '../../server'
import { appendAssistantAudit, assistantAuditPath } from './assistantAudit'
import { answerAssistantQuestion, assistantConversationPath, clearAssistantConversation } from './assistantConversation'
import { planAssistantQuestion } from './assistantTools'
import { browserRuntimeGuidance, BrowserRuntimeUnavailableError } from '../evidence/browserRuntime'
import { createRepairBrief, repairBriefPacket } from './repairBrief'
import { repairApplyConfirmation, repairProposalView, validateRepairProposal, applyGuardedRepairProposal } from './repairWorkflow'
import { learnProject, readProjectMemory, recordProjectVerification } from './projectMemory'
import { getAIProviderStatus } from './runtimeConfig'
import { normalizeSecurityFindings } from './securityFindings'
import type { AIProviderConfig, Evidence, ProjectMemory, StructuredAIRequest } from './types'
import { runDeepSecurityReview, runProjectVerification } from '../runProjectVerification'
import { parseNpmAudit, parseOsvAudit } from '../evidence/localDependencyAudit'
import { parseGitleaks, parseSemgrep, parseTrivy } from '../evidence/localSecurityEngines'
import { createSecurityScope } from '../evidence/securityScope'

const secret = 'sk_live_verion_phase7_secret_123456' //gitleaks:allow
const capturedAt = '2026-07-18T12:00:00.000Z'

async function main() {
  await testMemoryMigrations()
  await testProviderContracts()
  await testNoProviderAndAssistantPolicy()
  await testPrivacyAndReleaseIntegration()
  await testManualSecurityReview()
  testLocalSecurityScannerContracts()
  await testRepairLifecycle()
  testBrowserRuntimeGuidance()
  console.log(JSON.stringify({ migrations: [1, 2, 3, 4, 5], providers: ['openai_compatible', 'gemini', 'openrouter', 'ollama'], noProviderFallback: true, privacy: true, assistantPolicy: true, manualSecurity: true, localSecurityScanners: true, automaticTargetDetection: true, securityDecision: true, repairLifecycle: true, browserRuntimeGuidance: true }))
}

async function testMemoryMigrations() {
  for (const version of [1, 2, 3, 4] as const) {
    const root = await fixture(`memory-v${version}`)
    try {
      await mkdir(join(root, '.verion'), { recursive: true })
      await writeFile(join(root, '.verion', 'project-memory.json'), JSON.stringify(legacyMemory(root, version)), 'utf8')
      const memory = await readProjectMemory(root)
      assert.equal(memory?.version, 5, `v${version} should migrate`) 
      assert.equal(memory?.profile.name, 'Migration fixture')
      assert.equal(memory?.understanding.importantPages.length, 0)
      assert.equal(memory?.knownUserJourneys.length, 1)
      assert.equal(memory?.releaseReports[0]?.rootCause, 'A prior review needs attention.')
      const written = JSON.parse(await readFile(join(root, '.verion', 'project-memory.json'), 'utf8')) as { version?: number }
      assert.equal(written.version, 5, `v${version} migration should persist`)
    } finally { await rm(root, { recursive: true, force: true }) }
  }

  const root = await fixture('current-memory')
  try {
    const { memory } = await learnProject(root)
    const current = {
      ...memory,
      releaseReports: [{ id: 'report:unsafe', completedAt: capturedAt, recommendation: 'needs_attention', confidence: 'moderate', headline: 'Unsafe token', rootCause: `api_key: ${secret}`, reasons: [`Bearer ${secret}`], evidenceIds: [`evidence:${secret}`], nextAction: `Rotate ${secret}` }],
      knownIssues: [{ id: `issue:${secret}`, headline: 'Unsafe token', rootCause: `token=${secret}`, firstSeenAt: capturedAt, lastSeenAt: capturedAt, occurrences: 1, status: 'open', lastReportId: `report:${secret}` }],
      securityFindings: [rawFinding()]
    }
    await writeFile(join(root, '.verion', 'project-memory.json'), JSON.stringify(current), 'utf8')
    const normalized = await readProjectMemory(root)
    assert.equal(JSON.stringify(normalized).includes(secret), false, 'current memory is normalized before use')
    const persisted = await readFile(join(root, '.verion', 'project-memory.json'), 'utf8')
    assert.equal(persisted.includes(secret), false, 'current memory normalization is persisted')
  } finally { await rm(root, { recursive: true, force: true }) }
}

async function testProviderContracts() {
  const originalFetch = globalThis.fetch
  try {
    for (const kind of ['openai_compatible', 'gemini', 'openrouter', 'ollama'] as const) {
      const requests: Array<{ url: string; init?: RequestInit }> = []
      globalThis.fetch = async (input, init) => {
        requests.push({ url: String(input), init })
        return new Response(JSON.stringify(providerResponse(kind)), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      const result = await getAIProvider(kind).structured<{ decision: string }>(providerRuntime(kind), request())
      assert.deepEqual(result.value, { decision: 'grounded' }, `${kind} parses its structured response`)
      assert.equal(requests.length, 1)
      const sent = requests[0]
      assert.match(sent.url, /chat\/completions|generateContent/)
      const headers = new Headers(sent.init?.headers)
      if (kind === 'gemini') assert.equal(headers.get('x-goog-api-key'), secret)
      else if (kind === 'ollama') assert.equal(headers.get('authorization'), null, 'Ollama requests never send an API key')
      else assert.equal(headers.get('authorization'), `Bearer ${secret}`)
      assert.equal(JSON.stringify(sent.init?.body).includes(secret), false, 'credentials belong only in request headers')
    }

    const requests: Array<{ url: string; init?: RequestInit }> = []
    globalThis.fetch = async (input, init) => {
      requests.push({ url: String(input), init })
      return new Response(JSON.stringify({ output_text: JSON.stringify({ decision: 'grounded' }) }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
    const responsesRuntime = providerRuntime('openai_compatible')
    responsesRuntime.config = { ...responsesRuntime.config, apiStyle: 'responses' }
    assert.deepEqual((await getAIProvider('openai_compatible').structured<{ decision: string }>(responsesRuntime, request())).value, { decision: 'grounded' })
    assert.match(requests[0].url, /\/responses$/)

    globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: `Provider returned ${secret}` } }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    await assert.rejects(() => getAIProvider('openai_compatible').structured(providerRuntime('openai_compatible'), request()), (error: unknown) => error instanceof Error && !error.message.includes(secret))
  } finally { globalThis.fetch = originalFetch }
}

async function testNoProviderAndAssistantPolicy() {
  const root = await fixture('assistant-policy')
  const providerVariables = ['VERION_AI_PROVIDER', 'VERION_AI_MODEL', 'VERION_OPENAI_COMPATIBLE_API_KEY', 'VERION_OPENAI_COMPATIBLE_MODEL', 'VERION_GEMINI_API_KEY', 'VERION_GEMINI_MODEL', 'VERION_OPENROUTER_API_KEY', 'VERION_OPENROUTER_MODEL', 'VERION_OLLAMA_MODEL', 'VERION_OLLAMA_BASE_URL', 'OPENAI_API_KEY', 'VERION_OPENAI_MODEL'] as const
  const priorProviderVariables = new Map(providerVariables.map((name) => [name, process.env[name]]))
  for (const name of providerVariables) delete process.env[name]
  try {
    await writeFile(join(root, 'src', 'billing.ts'), `export const value = '${secret}'\n`, 'utf8')
    const { memory } = await learnProject(root)
    const status = await getAIProviderStatus(root)
    assert.equal(status.configured, false, 'no configured provider is a first-class local mode')
    assert.equal(status.available, false, 'no provider retains deterministic local review')
    process.env.OPENAI_API_KEY = secret
    const legacyWithoutModel = await getAIProviderStatus(root)
    assert.equal(legacyWithoutModel.configured, true, 'an existing OpenAI key is recognized without inventing a model choice')
    assert.equal(legacyWithoutModel.available, false, 'a key alone never triggers an unselected model')
    assert.equal(legacyWithoutModel.provider?.model, 'No model selected')
    assert.match(legacyWithoutModel.message ?? '', /model selection/)
    delete process.env.OPENAI_API_KEY
    const result = await answerAssistantQuestion(root, memory, 'Which billing files are causing this?')
    assert.equal(result.sourceConsentRequired, undefined, 'no provider never asks to transmit source')
    assert.ok(result.conversation.messages.length >= 2)
    await assert.rejects(() => answerAssistantQuestion(root, memory, `Please inspect ${secret}`), /Remove secret-like content/)
    const traversal = await planAssistantQuestion({ memory, question: 'Read ../../.env', providerAvailable: false })
    const command = await planAssistantQuestion({ memory, question: 'Run npm run build', providerAvailable: false })
    const consent = await planAssistantQuestion({ memory, question: 'Which billing files are causing this?', providerAvailable: true })
    assert.ok(traversal.refusal, 'paths outside discovered project scope are refused')
    assert.ok(command.refusal, 'assistant never runs shell commands')
    assert.ok(consent.sourceConsentRequired, 'provider source reads require one-question consent')
  } finally {
    for (const [name, value] of priorProviderVariables) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    await rm(root, { recursive: true, force: true })
  }
}

async function testPrivacyAndReleaseIntegration() {
  const root = await fixture('privacy')
  try {
    const { memory } = await learnProject(root)
    const evidence = securityEvidence()
    const saved = await recordProjectVerification(root, {
      evidence,
      capsule: { evidence: [], relevantFiles: [{ path: 'src/billing.ts', reason: `The value ${secret} was found.`, excerpt: `const token = '${secret}'` }], reproductionContext: [] },
      report: { recommendation: 'ready_to_ship', confidence: 'moderate', headline: 'Ready', rootCause: `token=${secret}`, reasons: [`api_key: ${secret}`], evidenceIds: [`evidence:${secret}`], nextAction: `Rotate ${secret}` }
    }, 'manual')
    const persisted = await readFile(join(root, '.verion', 'project-memory.json'), 'utf8')
    assert.equal(persisted.includes(secret), false, 'project memory never persists credentials from reviews')
    assert.equal(saved.releaseReports[0]?.recommendation, 'needs_attention', 'critical security changes the shared release decision')
    assert.deepEqual(normalizeSecurityFindings(evidence, capturedAt).map((item) => item.severity), ['critical', 'high'])
    const missionText = JSON.stringify(createMissionControl(saved))
    assert.equal(missionText.includes(secret), false, 'frontend mission payload is credential-free')
    assert.equal(createMissionControl(saved).currentStatus.kind, 'needs_attention')

    await appendAssistantAudit(root, { kind: 'assistant_read', status: 'completed', summary: `authorization: Bearer ${secret}` })
    await clearAssistantConversation(root)
    const audit = await readFile(assistantAuditPath(root), 'utf8')
    assert.equal(audit.includes(secret), false, 'logs store safe summaries only')
    const conversation = await readFile(assistantConversationPath(root), 'utf8')
    assert.equal(conversation.includes(secret), false, 'assistant persistence excludes source and credentials')
    const brief = await createRepairBrief({ projectRoot: root, memory: saved, source: { source: 'release_report', id: saved.releaseReports[0].id } })
    assert.equal(repairBriefPacket(brief).includes(secret), false, 'repair packets remain credential-free')
  } finally { await rm(root, { recursive: true, force: true }) }
}

async function testManualSecurityReview() {
  const root = await fixture('manual-security')
  try {
    await writeFile(join(root, 'src', 'unsafe.ts'), 'export const run = (input: string) => eval(input)\n', 'utf8')
    await writeFile(join(root, 'src', 'query.ts'), 'database.query(`SELECT * FROM users WHERE id = ${request.query.id}`)\nfetch(request.query.callbackUrl)\n', 'utf8') // verion-security: synthetic
    await mkdir(join(root, 'tests'), { recursive: true })
    await writeFile(join(root, 'tests', 'credential.fixture.ts'), "export const token = 'sk_live_1234567890abcdefghij' //gitleaks:allow\n", 'utf8')
    await writeFile(join(root, 'src', 'review-helper.ts'), "import assert from 'node:assert/strict'\nconst token = 'sk_live_1234567890abcdefghij' //gitleaks:allow\nassert.ok(token)\n", 'utf8')
    await mkdir(join(root, 'services', 'security'), { recursive: true })
    await writeFile(join(root, 'services', 'security', 'README.md'), "# Archived repository-service experiment\n\nThis is not part of Verion's package, startup path, dashboard, or Deep Security Review.\n", 'utf8')
    await writeFile(join(root, 'services', 'security', 'legacy.ts'), "export const token = 'sk_live_1234567890abcdefghij'\n", 'utf8') //gitleaks:allow
    const scope = await createSecurityScope(root)
    assert.equal(scope.files.some((file) => file.path === '.env'), false, 'runtime environment files are never placed in a security scan')
    assert.equal(scope.files.some((file) => file.path === 'tests/credential.fixture.ts'), true, 'test code remains inside the review scope')
    const ordinaryReview = await runProjectVerification({ projectPath: root, diagnose: true, recordMemory: false })
    assert.equal(ordinaryReview.evidence.some((item) => item.producer === 'deep-security-review'), false, 'ordinary Verify never starts Deep Security Review')

    const progress: Array<{ station: string; state: string }> = []
    const securityReview = await runDeepSecurityReview({
      projectPath: root,
      onProgress: (event) => { progress.push({ station: event.station, state: event.state }) }
    })
    assert.equal(securityReview.evidence.some((item) => item.producer === 'deep-security-review' && item.kind === 'security_review'), true, 'manual security action starts the local review')
    const reviewEvidence = securityReview.evidence.find((item) => item.producer === 'deep-security-review' && item.kind === 'security_review')
    const reviewStatus = typeof reviewEvidence?.data === 'object' && reviewEvidence.data !== null
      ? (reviewEvidence.data as { status?: string }).status
      : undefined
    assert.ok(reviewStatus === 'concern' || reviewStatus === 'partial', 'the review either records the real findings with local engines available or remains explicitly incomplete when a specialist is unavailable')
    assert.equal(securityReview.report?.recommendation, reviewStatus === 'partial' ? 'inconclusive' : 'needs_attention', 'the release decision reflects the actual review capability instead of fabricating a pass')
    const findingFiles = securityReview.evidence
      .filter((item) => item.kind === 'security_finding')
      .flatMap((item) => typeof item.data === 'object' && item.data !== null && typeof (item.data as { file?: unknown }).file === 'string' ? [(item.data as { file: string }).file] : [])
    assert.deepEqual([...new Set(findingFiles)].sort(), ['src/query.ts', 'src/unsafe.ts'], 'the local reviewer catches injection-prone code, keeps tests in scope, suppresses explicitly synthetic credentials, and excludes archived prototype code')
    assert.deepEqual(new Set(progress.map((event) => event.station)), new Set(['scope', 'code', 'credentials', 'dependencies', 'configuration', 'running_experience', 'decision']), 'manual review reports each factual station')
    assert.ok(progress.some((event) => event.station === 'running_experience' && event.state === 'skipped'), 'no local app is communicated as a skipped station')

    await runProjectVerification({ projectPath: root, diagnose: true })
    const saved = await readProjectMemory(root)
    assert.equal(createMissionControl(saved!).deepSecurity.status, reviewStatus === 'partial' ? 'partial' : 'concern', 'the saved Security state remains faithful after ordinary Verify')
  } finally { await rm(root, { recursive: true, force: true }) }
}

function testLocalSecurityScannerContracts() {
  const parsed = parseNpmAudit({
    metadata: { dependencies: { prod: 18, total: 24 } },
    vulnerabilities: {
      low: { name: 'low', severity: 'low' },
      critical: { name: '@scope/critical', severity: 'critical', via: [{ title: 'Critical dependency issue' }] },
      high: { name: 'high', severity: 'high', via: ['GHSA-example'] }
    }
  })
  assert.equal(parsed.reviewedDependencies, 18)
  assert.deepEqual(parsed.findings.map((finding) => `${finding.severity}:${finding.packageName}`), ['critical:@scope/critical', 'high:high'])
  assert.equal(parsed.findings[0]?.detail, 'Critical dependency issue')

  const osv = parseOsvAudit({
    results: [{ source: { path: '/workspace/package-lock.json' }, packages: [{ package: { name: 'unsafe-package', version: '1.0.0' }, vulnerabilities: [{ id: 'GHSA-test', summary: 'Unsafe package issue', severity: [{ score: '9.8' }] }] }] }]
  }, '/workspace')
  assert.equal(osv.reviewedDependencies, 1)
  assert.deepEqual(osv.findings.map((finding) => `${finding.severity}:${finding.packageName}:${finding.file}`), ['critical:unsafe-package:package-lock.json'])

  const mirror = '/tmp/verion-security-mirror'
  assert.equal(parseSemgrep(JSON.stringify({ results: [{ check_id: 'verion.javascript.dynamic-evaluation', path: `${mirror}/src/unsafe.ts`, start: { line: 4 }, extra: { message: 'Unsafe evaluation.' } }] }), mirror)[0]?.file, 'src/unsafe.ts')
  assert.equal(parseGitleaks(JSON.stringify([{ RuleID: 'stripe-access-token', File: `${mirror}/src/key.ts`, StartLine: 9, Description: 'Found a Stripe Access Token.' }]), mirror)[0]?.severity, 'critical')
  assert.equal(parseTrivy(JSON.stringify({ Results: [{ Target: `${mirror}/Dockerfile`, Misconfigurations: [{ ID: 'DS001', Title: 'Runs as root', Message: 'Container runs as root.', Severity: 'HIGH', CauseMetadata: { StartLine: 2 } }] }] }), mirror)[0]?.file, 'Dockerfile')

  const targets = localAppCandidatePorts(5173, {
    dev: 'vite --port 6199',
    preview: 'PORT=6200 next start',
    api: 'node server.mjs -p 6201'
  })
  assert.deepEqual(targets.slice(0, 3), [6199, 6200, 6201], 'project scripts receive priority during local app discovery')
  assert.equal(targets.includes(5173), false, 'Verion never probes its own dashboard port as a target app')
}

async function testRepairLifecycle() {
  const root = await fixture('repair')
  try {
    const { memory } = await learnProject(root)
    const saved = await recordProjectVerification(root, {
      evidence: [],
      capsule: { evidence: [], relevantFiles: [{ path: 'src/billing.ts', reason: 'Billing release concern.', excerpt: 'export const billing = () => "old"' }], reproductionContext: [] },
      report: { recommendation: 'needs_attention', confidence: 'moderate', headline: 'Billing needs attention', rootCause: 'The billing fallback needs a review.', reasons: ['Billing changed.'], evidenceIds: [], nextAction: 'Verify billing again.' }
    }, 'manual')
    const brief = await createRepairBrief({ projectRoot: root, memory: saved, source: { source: 'release_report', id: saved.releaseReports[0].id } })
    const proposal = validateRepairProposal({ summary: 'Use the safe billing fallback.', replacements: [{ path: 'src/billing.ts', original: '"old"', replacement: '"new"', summary: 'Replace the fallback.' }], verificationPlan: ['Run the local check.'] }, brief)
    assert.match(repairProposalView(proposal).files[0].diff, /guarded replacement/)
    await assert.rejects(() => applyGuardedRepairProposal({ projectRoot: root, proposal, confirmation: 'yes' }), /Confirm/)
    await applyGuardedRepairProposal({ projectRoot: root, proposal, confirmation: repairApplyConfirmation })
    assert.match(await readFile(join(root, 'src', 'billing.ts'), 'utf8'), /"new"/)
    await recordProjectVerification(root, { evidence: [], capsule: { evidence: [], relevantFiles: [], reproductionContext: [] }, report: { recommendation: 'ready_to_ship', confidence: 'moderate', headline: 'Billing reviewed', rootCause: 'The repaired fallback was reviewed.', reasons: [], evidenceIds: [], nextAction: 'Continue.' } }, 'manual')
    const refreshed = await readProjectMemory(root)
    assert.ok((refreshed?.verificationHistory.length ?? 0) >= 2, 'a saved repair receives a fresh release review')
  } finally { await rm(root, { recursive: true, force: true }) }
}

function testBrowserRuntimeGuidance() {
  const guidance = browserRuntimeGuidance(new BrowserRuntimeUnavailableError())
  assert.match(guidance ?? '', /npx playwright install chromium/)
}

async function fixture(name: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), `verion-phase7-${name}-`))
  await mkdir(join(root, 'src'), { recursive: true })
  await writeFile(join(root, 'package.json'), JSON.stringify({ name, scripts: { test: 'node -e "process.exit(0)"' }, dependencies: { react: '18.3.1' } }), 'utf8')
  await writeFile(join(root, 'src', 'main.tsx'), 'export const app = true\n', 'utf8')
  await writeFile(join(root, 'src', 'billing.ts'), 'export const billing = () => "old"\n', 'utf8')
  await writeFile(join(root, '.env'), `PRIVATE_TOKEN=${secret}\n`, 'utf8')
  return root
}

function legacyMemory(root: string, version: 1 | 2 | 3 | 4): unknown {
  return {
    version,
    profile: { name: 'Migration fixture', projectRoot: root, framework: 'vite', packageManager: 'npm', firstLearnedAt: capturedAt, lastLearnedAt: capturedAt },
    createdAt: capturedAt,
    updatedAt: capturedAt,
    signature: `legacy-${version}`,
    discovery: { projectRoot: root, framework: 'vite', packageManager: 'npm', scripts: {}, entryPoints: ['src/main.tsx'], routes: [{ path: '/', file: 'src/main.tsx', convention: 'route-candidate' }], files: ['src/main.tsx', 'src/billing.ts'], ignoredFileCount: 0 },
    graph: { nodes: [], edges: [] },
    understanding: { summary: 'A migration fixture.', technologies: [], productAreas: [], routeCount: 1, apiCount: 0 },
    knownTechnologies: [], knownRoutes: [], knownUserJourneys: [{ id: 'route:/', label: 'Home', route: '/', source: 'project', firstObservedAt: capturedAt, lastObservedAt: capturedAt }], verificationHistory: [],
    releaseReports: [{ id: 'report:legacy', completedAt: capturedAt, recommendation: 'needs_attention', headline: 'Prior review', diagnosis: 'A prior review needs attention.', evidenceIds: [], nextAction: 'Review again.' }],
    knownIssues: [], recentChanges: [], fileSnapshot: {},
    ...(version === 4 ? { securityFindings: [], securityReview: { status: 'completed', completedAt: capturedAt, findingCount: 0 } } : {})
  }
}

function providerRuntime(kind: Extract<AIProviderConfig['provider'], 'openai_compatible' | 'gemini' | 'openrouter' | 'ollama'>): ResolvedAIProvider {
  const isOllama = kind === 'ollama'
  const config: AIProviderConfig = { id: `provider:${kind}`, provider: kind, label: kind, enabled: true, endpoint: isOllama ? 'http://127.0.0.1:11434/v1' : `https://${kind}.example/v1`, credentialSource: isOllama ? 'none' : 'environment', ...(isOllama ? {} : { credentialReference: 'VERION_TEST_KEY' }), createdAt: capturedAt, updatedAt: capturedAt }
  return { config, endpoint: config.endpoint, apiKey: isOllama ? undefined : secret, model: modelDescriptor(config, 'contract-model', getProviderDefaultCapabilities(kind)) }
}

function request(): StructuredAIRequest { return { task: 'assistant_response', instructions: 'Return JSON.', input: { project: 'fixture' }, schemaName: 'contract', schema: { type: 'object' } } }

function providerResponse(kind: 'openai_compatible' | 'gemini' | 'openrouter' | 'ollama') {
  const text = JSON.stringify({ decision: 'grounded' })
  return kind === 'gemini' ? { candidates: [{ content: { parts: [{ text }] } }] } : { choices: [{ message: { content: text } }] }
}

function rawFinding() { return { id: `security:${secret}`, reviewId: `review:${secret}`, severity: 'critical' as const, headline: 'Credential found', explanation: `api_key: ${secret}`, suggestedAction: `Rotate ${secret}`, evidenceIds: [`evidence:${secret}`], status: 'open' as const, createdAt: capturedAt, updatedAt: capturedAt } }

function securityEvidence(): Evidence[] {
  return [
    { id: 'security:status', producer: 'deep-security-review', kind: 'security_review', capturedAt, summary: 'complete', data: { status: 'concern' } },
    { id: 'security:high', producer: 'deep-security-review', kind: 'security_finding', capturedAt, summary: 'High concern', data: { severity: 'high', headline: 'High concern', explanation: 'A high concern needs attention.', suggestedAction: 'Review the dependency.' } },
    { id: 'security:critical', producer: 'deep-security-review', kind: 'security_finding', capturedAt, summary: 'Critical concern', data: { severity: 'critical', headline: 'Critical concern', explanation: `token=${secret}`, suggestedAction: 'Rotate the credential.', file: 'src/billing.ts', startLine: 1 } }
  ]
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1 })
