import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readProjectMemory } from './projectMemory'
import { enforceSecurityReleaseDecision, mergeSecurityFindings, normalizeSecurityFindings, publicSecurityFindings, securityFixPrompt } from './securityFindings'
import type { Evidence, ProjectMemory, ReleaseReport } from './types'

const capturedAt = '2026-07-18T10:00:00.000Z'

const evidence: Evidence[] = [
  { id: 'deep-security-review:status', producer: 'deep-security-review', kind: 'security_review', capturedAt, summary: 'review complete', data: { status: 'concern' } },
  { id: 'deep-security-review:finding:high', producer: 'deep-security-review', kind: 'security_finding', capturedAt, summary: 'A high dependency concern needs attention.', data: { reviewId: 'review:1', severity: 'high', category: 'dependency', headline: 'Trivy dependency concern', explanation: 'A high dependency concern was recorded. api_key: sk-secret-value', suggestedAction: 'Update the affected dependency.', file: 'package.json', startLine: 19 } },
  { id: 'deep-security-review:finding:critical', producer: 'deep-security-review', kind: 'security_finding', capturedAt, summary: 'A critical credential concern needs attention.', data: { reviewId: 'review:1', severity: 'critical', category: 'credential', headline: 'Gitleaks credential concern', explanation: 'A sensitive credential may be reachable.', suggestedAction: 'Rotate the credential and remove it from source.', file: 'src/auth.ts', startLine: 42 } }
]

const normalized = normalizeSecurityFindings(evidence, capturedAt)
assert.equal(normalized.length, 2)
assert.equal(normalized[0].severity, 'critical')
assert.equal(normalized[1].severity, 'high')
assert.equal(normalized[1].explanation.toLowerCase().includes('critical'), false)

const publicFindings = publicSecurityFindings(normalized)
assert.equal(publicFindings.length, 2)
assert.equal('evidenceIds' in publicFindings[0], false)
assert.equal(JSON.stringify(publicFindings).toLowerCase().includes('gitleaks'), false)
assert.equal(JSON.stringify(publicFindings).includes('sk-secret-value'), false)

const report: ReleaseReport = {
  recommendation: 'ready_to_ship',
  confidence: 'moderate',
  headline: 'Ready to ship',
  rootCause: 'No release concern was recorded.',
  reasons: [],
  evidenceIds: [],
  nextAction: 'Ship when ready.'
}
assert.equal(enforceSecurityReleaseDecision(report, evidence).recommendation, 'needs_attention')
const prompt = securityFixPrompt(publicFindings[0], { summary: 'A local application with billing.', criticalFlows: ['Sign in', 'Checkout'] })
assert.equal(prompt.includes('Gitleaks'), false)
assert.equal(prompt.includes('sk-secret-value'), false)

const merged = mergeSecurityFindings(normalized, [{ ...evidence[0], data: { status: 'completed' }, capturedAt: '2026-07-18T11:00:00.000Z' }], '2026-07-18T11:00:00.000Z')
assert.equal(merged.every((finding) => finding.status === 'resolved'), true)

const root = await mkdtemp(join(tmpdir(), 'verion-phase5-memory-'))
try {
  await mkdir(join(root, '.verion'), { recursive: true })
  const legacy = legacyMemory(root)
  await writeFile(join(root, '.verion', 'project-memory.json'), JSON.stringify(legacy), 'utf8')
  const migrated = await readProjectMemory(root)
  assert.equal(migrated?.version, 5)
  assert.equal(migrated?.profile.name, 'Memory fixture')
  assert.equal(migrated?.releaseReports.length, 1)
  assert.equal(migrated?.securityFindings.length, 0)
  assert.equal(migrated?.knownUserJourneys.length, 1)
} finally {
  await rm(root, { recursive: true, force: true })
}

console.log(JSON.stringify({ normalized: normalized.length, ordered: normalized.map((finding) => finding.severity), publicPayloadSafe: true, criticalDecision: true, migration: 5 }))

function legacyMemory(root: string): Omit<ProjectMemory, 'version' | 'securityFindings' | 'securityReview'> & { version: 4 } {
  return {
    version: 4,
    profile: { name: 'Memory fixture', projectRoot: root, framework: 'vite', packageManager: 'npm', firstLearnedAt: capturedAt, lastLearnedAt: capturedAt },
    createdAt: capturedAt,
    updatedAt: capturedAt,
    signature: 'fixture',
    discovery: { projectRoot: root, framework: 'vite', packageManager: 'npm', scripts: {}, entryPoints: ['src/main.tsx'], routes: [], files: ['src/main.tsx'], ignoredFileCount: 0 },
    graph: { nodes: [], edges: [] },
    understanding: { summary: 'A fixture project.', technologies: [], productAreas: [], routeCount: 0, apiCount: 0, applicationType: 'web application', userJourneys: [], criticalBusinessFlows: [], importantPages: [], importantApis: [] },
    knownTechnologies: [],
    knownRoutes: [],
    knownUserJourneys: [{ id: 'journey:home', label: 'Home', source: 'project', firstObservedAt: capturedAt, lastObservedAt: capturedAt }],
    verificationHistory: [],
    releaseReports: [{ id: 'report:fixture', completedAt: capturedAt, recommendation: 'ready_to_ship', confidence: 'moderate', headline: 'Ready to ship', rootCause: 'Fixture decision.', reasons: ['Fixture evidence.'], evidenceIds: [], nextAction: 'Continue.' }],
    knownIssues: [],
    recentChanges: [],
    fileSnapshot: {}
  }
}
