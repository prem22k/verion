import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readAssistantAudit } from './assistantAudit'
import { answerAssistantQuestion, assistantConversationPath, readAssistantConversation } from './assistantConversation'
import { planAssistantQuestion, redactSourceText } from './assistantTools'
import { learnProject, recordProjectVerification } from './projectMemory'
import { hasConfirmedRepairLaunch, repairLaunchConfirmation } from './repairConfirmation'

async function main() {
  const root = await mkdtemp(join(tmpdir(), 'verion-assistant-phase4-'))
  const priorProvider = process.env.VERION_AI_PROVIDER
  process.env.VERION_AI_PROVIDER = 'verion_ai'
  try {
    await writeFixture(root)
    await learnProject(root)
    await recordProjectVerification(root, completedReview(), 'manual')
    await writeFile(join(root, 'src', 'billing.ts'), `export const charge = () => process.env.STRIPE_SECRET_KEY\nexport const credential = "sk_test_very_secret_value"\n`, 'utf8')
    const { memory } = await learnProject(root)

    const questions = [
      'Why shouldn’t I ship this?',
      'What changed since my last review?',
      'What parts of the app are affected?',
      'Explain this vulnerability.',
      'Which files are causing this?',
      'Prepare this for Codex.'
    ]
    for (const question of questions) {
      const result = await answerAssistantQuestion(root, memory, question)
      assert.equal(result.sourceConsentRequired, undefined, `no-provider answer should not ask for source consent: ${question}`)
      assert.ok(result.conversation.messages.at(-1)?.citations.length, `answer needs citations: ${question}`)
    }

    const consent = await planAssistantQuestion({ memory, question: 'Which billing files are causing this?', providerAvailable: true })
    assert.ok(consent.sourceConsentRequired, 'a provider needs one-question source permission')
    const allowed = await planAssistantQuestion({ memory, question: 'Which billing files are causing this?', providerAvailable: true, sourceConsent: true })
    const transmitted = JSON.stringify(allowed.providerContext)
    assert.match(transmitted, /\[REDACTED TOKEN\]|sensitive_value\s*=\s*\[REDACTED\]/, 'source is redacted before provider context')
    const declined = await planAssistantQuestion({ memory, question: 'Which billing files are causing this?', providerAvailable: true, sourceConsent: false })
    assert.equal(JSON.stringify(declined.providerContext).includes('sourceExcerpts'), false, 'declined consent never includes excerpts')
    assert.ok((await planAssistantQuestion({ memory, question: 'Read ../../.env', providerAvailable: false })).refusal, 'traversal and hidden paths are refused')
    assert.ok((await planAssistantQuestion({ memory, question: 'Read ../.env now', providerAvailable: false })).refusal, 'bare traversal and environment paths are refused')
    assert.ok((await planAssistantQuestion({ memory, question: 'Run npm run build for me', providerAvailable: false })).refusal, 'shell requests are refused')
    assert.equal(hasConfirmedRepairLaunch({ reportId: 'review:1' }), false, 'repair launch rejects direct callers without confirmation')
    assert.equal(hasConfirmedRepairLaunch({ reportId: 'review:1', confirmation: repairLaunchConfirmation }), true, 'repair launch accepts only the exact confirmation')

    const redacted = redactSourceText('API_KEY=private-value\nBearer abcdefghijklmnopqrstuvwxyz\npostgres://user:password@host/db')
    assert.equal(/private-value|abcdefghijklmnopqrstuvwxyz|postgres:\/\/user/.test(redacted), false, 'common secret forms are redacted')

    const conversation = await readAssistantConversation(root)
    const persisted = await readFile(assistantConversationPath(root), 'utf8')
    assert.equal(persisted.includes('sk_test_very_secret_value'), false, 'conversation never stores source text')
    assert.ok(conversation.toolCalls.length > 0, 'safe tool summaries are persisted')
    const audit = await readAssistantAudit(root)
    const auditText = JSON.stringify(audit)
    assert.equal(auditText.includes('Which files are causing this?'), false, 'audit never stores raw questions')
    assert.equal(auditText.includes('sk_test_very_secret_value'), false, 'audit never stores source text')
    assert.ok(audit.entries.length > 0, 'local assistant audit is recorded')

    await writeFile(assistantConversationPath(root), JSON.stringify({ version: 1, id: 'legacy', projectRoot: root, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [], toolCalls: [] }), 'utf8')
    assert.equal((await readAssistantConversation(root)).version, 2, 'v1 conversation normalizes to v2')
    console.log(JSON.stringify({ questions: questions.length, sourceConsent: true, redaction: true, refusal: true, auditPrivacy: true, migration: true }))
  } finally {
    if (priorProvider === undefined) delete process.env.VERION_AI_PROVIDER
    else process.env.VERION_AI_PROVIDER = priorProvider
    await rm(root, { recursive: true, force: true })
  }
}

async function writeFixture(root: string) {
  await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'assistant-check', dependencies: { react: '18.3.1', stripe: '14.0.0' } }), 'utf8')
  await writeFile(join(root, 'src', '.keep'), '', 'utf8').catch(async () => {
    const { mkdir } = await import('node:fs/promises')
    await mkdir(join(root, 'src'), { recursive: true })
    await writeFile(join(root, 'src', '.keep'), '', 'utf8')
  })
  await writeFile(join(root, 'src', 'billing.ts'), 'export const charge = () => true\n', 'utf8')
  await writeFile(join(root, 'src', 'App.tsx'), "import { charge } from './billing'\nexport function App() { return <button onClick={charge}>Pay</button> }\n", 'utf8')
}

function completedReview() {
  return {
    evidence: [],
    capsule: { evidence: [], relevantFiles: [], reproductionContext: [] },
    report: {
      recommendation: 'needs_attention' as const,
      confidence: 'moderate' as const,
      headline: 'Billing needs another look',
      rootCause: 'The last release review found a billing concern.',
      reasons: ['Billing is part of this release.'],
      evidenceIds: [],
      nextAction: 'Verify the billing path again.'
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
