import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFixPacketFromRepairBrief } from './fixPacket'
import { createRepairBrief, repairBriefPacket, repairPrompt } from './repairBrief'
import { appendAssistantAudit, readAssistantAudit } from './assistantAudit'
import { learnProject, readProjectMemory, recordProjectVerification } from './projectMemory'
import { applyGuardedRepairProposal, hasRepairApplyApproval, hasRepairSourceConsent, repairApplyConfirmation, repairProposalView, repairSourceConsentConfirmation, selectAllowlistedCheck, validateRepairProposal } from './repairWorkflow'
import type { NativeRepairProposal, SecurityFinding } from './types'

const timestamp = '2026-07-18T12:00:00.000Z'

async function main() {
  const root = await mkdtemp(join(tmpdir(), 'verion-phase6-repair-'))
  try {
    await fixture(root)
    await learnProject(root)
    await recordProjectVerification(root, review(), 'manual')
    const memory = await readProjectMemory(root)
    assert.ok(memory)

    const release = await createRepairBrief({ projectRoot: root, memory, source: { source: 'release_report', id: memory.releaseReports[0].id } })
    const finding: SecurityFinding = {
      id: 'security:fixture', reviewId: 'review:fixture', severity: 'high', headline: 'Credential wording needs attention', explanation: 'The review observed api_key: sk_should_not_escape in the billing area.', affectedArea: 'Billing', file: 'src/billing.ts', startLine: 1, evidenceIds: ['security:fixture'], suggestedAction: 'Remove the unsafe value and preserve billing behavior.', status: 'open', createdAt: timestamp, updatedAt: timestamp
    }
    const security = await createRepairBrief({ projectRoot: root, memory: { ...memory, securityFindings: [finding] }, source: { source: 'security_finding', id: finding.id } })
    const releasePrompt = repairPrompt(release)
    const securityPrompt = repairPrompt(security)
    assert.match(releasePrompt, /## Issue[\s\S]*## Why it matters[\s\S]*## Affected files[\s\S]*## Relevant code context[\s\S]*## Expected behavior[\s\S]*## Verify/)
    assert.equal(/sk_should_not_escape|api_key:/i.test(`${releasePrompt}\n${securityPrompt}`), false, 'canonical briefs redact credentials')
    assert.equal(/\.env|\.verion|node_modules/.test(`${releasePrompt}\n${securityPrompt}`), false, 'canonical briefs exclude forbidden paths')
    assert.equal(createFixPacketFromRepairBrief(release).content, repairBriefPacket(release), 'Codex packet renders the exact canonical brief')

    const raw = {
      summary: 'Replace the unsafe fallback with a safe value.',
      replacements: [{ path: 'src/billing.ts', original: 'const charge = () => "legacy"', replacement: 'const charge = () => "safe"', summary: 'Use a safe fallback.' }],
      verificationPlan: ['Run the smallest discovered project check.']
    }
    const proposal = validateRepairProposal(raw, release)
    assert.equal(repairProposalView(proposal).files[0].diff.includes('@@ guarded replacement @@'), true)
    assert.throws(() => validateRepairProposal({ ...raw, command: 'rm -rf /' }, release), /invalid repair proposal/i, 'unknown command fields are rejected')
    assert.throws(() => validateRepairProposal({ ...raw, replacements: [{ ...raw.replacements[0], path: '../outside.ts' }] }, release), /unsupported file change/i, 'scope is enforced')
    assert.throws(() => validateRepairProposal({ ...raw, replacements: [raw.replacements[0], { ...raw.replacements[0], summary: 'Duplicate.' }] }, release), /overlapping/i, 'overlapping operations are rejected')
    assert.throws(() => validateRepairProposal({ ...raw, replacements: [{ ...raw.replacements[0], replacement: 'const key = "sk_live_bad_secret"' }] }, release), /unsupported file change/i, 'credential-like content is rejected')
    assert.equal(hasRepairSourceConsent({ source: 'release_report', id: release.issueId, confirmation: repairSourceConsentConfirmation }), true)
    assert.equal(hasRepairSourceConsent({ source: 'release_report', id: release.issueId }), false)
    assert.equal(hasRepairApplyApproval({ proposalId: proposal.id, confirmation: repairApplyConfirmation }), true)
    assert.equal(hasRepairApplyApproval({ proposalId: proposal.id }), false)

    const before = await readFile(join(root, 'src', 'billing.ts'), 'utf8')
    await assert.rejects(() => applyGuardedRepairProposal({ projectRoot: root, proposal, confirmation: 'yes' }), /Confirm/)
    assert.equal(await readFile(join(root, 'src', 'billing.ts'), 'utf8'), before, 'approval is required before every write')
    await applyGuardedRepairProposal({ projectRoot: root, proposal, confirmation: repairApplyConfirmation })
    assert.match(await readFile(join(root, 'src', 'billing.ts'), 'utf8'), /"safe"/)
    await assert.rejects(() => applyGuardedRepairProposal({ projectRoot: root, proposal, confirmation: repairApplyConfirmation }), /snippet changed/i, 'stale source proposals are rejected')

    const externalRoot = await mkdtemp(join(tmpdir(), 'verion-repair-outside-'))
    try {
      const external = join(externalRoot, 'outside.ts')
      await writeFile(external, 'export const outside = "old"\n', 'utf8')
      await symlink(external, join(root, 'src', 'linked.ts'))
      const linkedProposal: NativeRepairProposal = { ...proposal, id: 'repair:linked', allowedFiles: ['src/linked.ts'], operations: [{ path: 'src/linked.ts', original: 'export const outside = "old"', replacement: 'export const outside = "new"', summary: 'Unsafe linked file.' }] }
      await assert.rejects(() => applyGuardedRepairProposal({ projectRoot: root, proposal: linkedProposal, confirmation: repairApplyConfirmation }), /regular project file|outside the connected project/i, 'symlinked targets outside the root are rejected')
      assert.match(await readFile(external, 'utf8'), /"old"/, 'a rejected symlink proposal cannot write outside the root')
    } finally { await rm(externalRoot, { recursive: true, force: true }) }

    await writeFile(join(root, 'src', 'billing.ts'), before, 'utf8')
    const rollbackProposal: NativeRepairProposal = {
      ...proposal,
      id: 'repair:rollback',
      allowedFiles: ['src/billing.ts', 'src/other.ts'],
      operations: [
        { path: 'src/billing.ts', original: 'const charge = () => "legacy"', replacement: 'const charge = () => "safe"', summary: 'First change.' },
        { path: 'src/other.ts', original: 'export const other = true', replacement: 'export const other = false', summary: 'Second change.' }
      ]
    }
    let writes = 0
    await assert.rejects(() => applyGuardedRepairProposal({ projectRoot: root, proposal: rollbackProposal, confirmation: repairApplyConfirmation, write: async (path, content) => { writes += 1; if (writes === 2) throw new Error('write failure'); await writeFile(path, content, 'utf8') } }), /restored/i)
    assert.equal(await readFile(join(root, 'src', 'billing.ts'), 'utf8'), before, 'a failed scoped write restores prior content')
    assert.equal(selectAllowlistedCheck({ dev: 'vite', lint: 'eslint .', build: 'vite build' }), 'lint')
    assert.equal(selectAllowlistedCheck({ release: 'ship' }), undefined)

    await appendAssistantAudit(root, { kind: 'repair_proposal_prepared', status: 'completed', summary: 'Prepared a scoped repair proposal.', relatedIds: [proposal.id] })
    await appendAssistantAudit(root, { kind: 'repair_apply_result', status: 'completed', summary: 'Applied a scoped repair and refreshed the release decision.', relatedIds: [proposal.id] })
    await recordProjectVerification(root, review(), 'manual')
    const refreshed = await readProjectMemory(root)
    const auditText = JSON.stringify(await readAssistantAudit(root))
    assert.ok((refreshed?.verificationHistory.length ?? 0) >= 2, 'post-repair verification refreshes local release history')
    assert.equal(/legacy|safe|sk_should_not_escape/.test(auditText), false, 'repair audit never stores source or diffs')
    assert.ok(repairPrompt(release).includes('Make the smallest safe repair'), 'no-provider Copy Fix Prompt stays complete')
    console.log(JSON.stringify({ canonicalBrief: true, redacted: true, schema: true, guardedApply: true, rollback: true, allowlistedCheck: true, refresh: true, noProviderPath: true }))
  } finally { await rm(root, { recursive: true, force: true }) }
}

async function fixture(root: string) {
  await mkdir(join(root, 'src'), { recursive: true })
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'repair-fixture', scripts: { lint: 'echo lint' }, dependencies: { react: '18.3.1' } }), 'utf8')
  await writeFile(join(root, 'src', 'billing.ts'), 'const charge = () => "legacy"\nexport { charge }\n', 'utf8')
  await writeFile(join(root, 'src', 'other.ts'), 'export const other = true\n', 'utf8')
}

function review() {
  return {
    evidence: [],
    capsule: { evidence: [], relevantFiles: [{ path: 'src/billing.ts', reason: 'Billing behavior is part of this release.', excerpt: 'const charge = () => "legacy"' }], reproductionContext: ['Review the billing path.'] },
    report: { recommendation: 'needs_attention' as const, confidence: 'moderate' as const, headline: 'Billing needs another look', rootCause: 'The review found a billing concern.', reasons: ['Billing is part of this release.'], evidenceIds: [], nextAction: 'Verify the billing path again.' }
  }
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1 })
