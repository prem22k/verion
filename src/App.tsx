import { useState } from 'react'
import { initialVerificationRun } from '../agent/demo-adapter'
import type { Evidence, VerificationRun } from './verification'

type Screen = 'ready' | 'verifying' | 'attention' | 'brief' | 'ship'

const verificationSteps = [
  'Opening the application',
  'Following the primary user path',
  'Checking the confirmation state'
]

const evidenceIcons: Record<Evidence['kind'], string> = {
  screenshot: '◫',
  console_error: '⌁',
  network_failure: '↗'
}

function recommendationCopy(run: VerificationRun) {
  return run.recommendation === 'ready_to_ship' ? 'Ready to Ship' : 'Needs Attention'
}

export function App() {
  const [screen, setScreen] = useState<Screen>('ready')
  const [activeStep, setActiveStep] = useState(0)
  const [briefCopied, setBriefCopied] = useState(false)
  const [verificationRun, setVerificationRun] = useState<VerificationRun>(initialVerificationRun)
  const run = verificationRun

  const runLiveVerification = async () => {
    setScreen('verifying')
    setActiveStep(0)
    verificationSteps.forEach((_, index) => {
      window.setTimeout(() => setActiveStep(index), index * 900)
    })
    try {
      const response = await fetch('/api/verify', { method: 'POST' })
      if (!response.ok) throw new Error('Verification could not complete.')
      const result = await response.json() as VerificationRun
      setVerificationRun(result)
      setScreen(result.recommendation === 'ready_to_ship' ? 'ship' : 'attention')
    } catch {
      setVerificationRun(initialVerificationRun)
      setScreen('attention')
    }
  }

  const copyBrief = async () => {
    const issue = verificationRun.issue
    if (!issue) return

    const files = issue.relevantFiles?.join(', ') ?? 'No source location identified.'
    const brief = `Verion fix brief\n\nIssue: ${issue.title}\nImpact: ${issue.userImpact}\nLikely root cause: ${issue.likelyRootCause}\nExpected: ${issue.expectedBehavior}\nObserved: ${issue.observedBehavior}\nRelevant source: ${files}\n\nPlease fix the root cause, then rerun the same confirmation path.`
    await navigator.clipboard?.writeText(brief)
    setBriefCopied(true)
  }

  const reverify = () => {
    setBriefCopied(false)
    void runLiveVerification()
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Verion home">
          <span className="brand-mark">V</span>
          <span>verion</span>
        </a>
        <p className="topbar-context">Verification before you ship</p>
        <span className="local-status"><i /> Local agent connected</span>
      </header>

      <section className="hero" id="top">
        <p className="eyebrow">Release confidence</p>
        <h1>{screen === 'ship' ? 'The important path holds.' : 'Know what to ship.'}</h1>
        <p className="hero-copy">
          {screen === 'ready'
            ? 'Verion explores the product, finds what matters, and prepares the next step.'
            : 'A focused verification result, with the evidence needed to make the release decision.'}
        </p>
      </section>

      <section className={`run-card ${screen === 'ship' ? 'run-card--clear' : ''}`} aria-live="polite">
        <div className="run-card__heading">
          <div>
            <p className="eyebrow">{run.targetLabel}</p>
            <h2>{screen === 'ready' ? 'Ready when you are.' : recommendationCopy(run)}</h2>
          </div>
          {screen !== 'ready' && <span className={`recommendation recommendation--${run.recommendation}`}>{recommendationCopy(run)}</span>}
        </div>

        {screen === 'ready' && (
          <div className="ready-state">
            <div className="ready-state__detail">
              <span className="detail-icon">⌘</span>
              <div>
                <strong>One clear action</strong>
                <p>No test plan. No scanner setup. Verion starts by understanding the product.</p>
              </div>
            </div>
            <button className="button button--primary" onClick={() => void runLiveVerification()}>Verify application <span>→</span></button>
          </div>
        )}

        {screen === 'verifying' && (
          <div className="verification-state">
            <div className="verification-pulse"><span /></div>
            <div>
              <p className="verification-label">Verifying the product</p>
              <p className="verification-step">{verificationSteps[activeStep]}</p>
            </div>
            <ol className="step-list">
              {verificationSteps.map((step, index) => <li className={index <= activeStep ? 'step-list__item--active' : ''} key={step}>{step}</li>)}
            </ol>
          </div>
        )}

        {screen === 'attention' && run.issue && (
          <IssueDetail issue={run.issue} onPrepare={() => setScreen('brief')} />
        )}

        {screen === 'brief' && run.issue && (
          <FixBrief issue={run.issue} copied={briefCopied} onCopy={copyBrief} onVerifyAgain={reverify} />
        )}

        {screen === 'ship' && <ShipState run={run} onStartOver={() => setScreen('ready')} />}
      </section>

      {screen !== 'ready' && screen !== 'verifying' && (
        <p className="run-meta">Verification {run.id} · {run.exploredAt} · {run.steps.length} interactions reviewed</p>
      )}
    </main>
  )
}

function IssueDetail({ issue, onPrepare }: { issue: NonNullable<VerificationRun['issue']>; onPrepare: () => void }) {
  return <div className="issue-layout">
    <div>
      <p className="issue-kicker">One issue needs your attention</p>
      <h3>{issue.title}</h3>
      <p className="issue-impact">{issue.userImpact}</p>
      <dl className="diagnosis">
        <div><dt>Likely cause</dt><dd>{issue.likelyRootCause}</dd></div>
        <div><dt>Expected</dt><dd>{issue.expectedBehavior}</dd></div>
        <div><dt>Observed</dt><dd>{issue.observedBehavior}</dd></div>
      </dl>
      <button className="button button--primary" onClick={onPrepare}>Prepare fix brief <span>→</span></button>
    </div>
    <EvidenceList evidence={issue.evidence} />
  </div>
}

function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  return <aside className="evidence" aria-label="Evidence">
    <p className="eyebrow">Evidence</p>
    {evidence.map((item) => <div className="evidence__item" key={item.id}>
      <span>{evidenceIcons[item.kind]}</span>
      <div><strong>{item.label}</strong><p>{item.detail}</p>{item.artifactPath && <img src={item.artifactPath} alt="Verification screenshot" />}</div>
    </div>)}
  </aside>
}

function FixBrief({ issue, copied, onCopy, onVerifyAgain }: { issue: NonNullable<VerificationRun['issue']>; copied: boolean; onCopy: () => void; onVerifyAgain: () => void }) {
  return <div className="brief-layout">
    <div>
      <p className="issue-kicker">Prepared for Codex</p>
      <h3>Fix the cause, then verify the outcome.</h3>
      <p className="issue-impact">Verion has kept only the context needed for a focused repair.</p>
      <div className="brief-content">
        <p><strong>Issue</strong>{issue.title}</p>
        <p><strong>Likely cause</strong>{issue.likelyRootCause}</p>
        {issue.relevantFiles && <p><strong>Relevant source</strong>{issue.relevantFiles.join(', ')}</p>}
        <p><strong>Verify after fixing</strong>{issue.expectedBehavior}</p>
      </div>
    </div>
    <div className="brief-actions">
      <button className="button button--secondary" onClick={onCopy}>{copied ? 'Brief copied' : 'Copy fix brief'}</button>
      <button className="button button--primary" onClick={onVerifyAgain}>Verify again <span>→</span></button>
    </div>
  </div>
}

function ShipState({ run, onStartOver }: { run: VerificationRun; onStartOver: () => void }) {
  return <div className="ship-state">
    <div className="ship-check">✓</div>
    <p className="issue-kicker">Verification complete</p>
    <h3>Ready to Ship</h3>
    <p className="issue-impact">The original issue no longer appears. The confirmation path now completes successfully.</p>
    <div className="ship-proof"><span>✓</span> {run.steps.length} interactions completed as expected</div>
    <button className="button button--secondary" onClick={onStartOver}>Start a new verification</button>
  </div>
}
