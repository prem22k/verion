import { useEffect, useState } from 'react'

type ProjectRoute = { path: string; file: string }
type Technology = { id: string; label: string; kind: 'framework' | 'library' | 'service' | 'database' }

type Connection = {
  projectPath: string
  targetUrl?: string
  watchChanges: boolean
  connectedAt: string
  discovery: {
    framework: string
    packageManager: string
    packageName?: string
    entryPoints: string[]
    routes: ProjectRoute[]
  }
  understanding: {
    summary: string
    technologies: Technology[]
    productAreas: string[]
    routeCount: number
    apiCount: number
  }
  memory: {
    onboardingRequired: boolean
    learnedAt: string
    state: 'first_run' | 'remembered' | 'updated'
  }
}

type Evidence = {
  id: string
  kind: string
  summary: string
  capturedAt: string
  location?: { file?: string; url?: string; route?: string }
}

type VerificationResult = {
  evidence: Evidence[]
  capsule: { relevantFiles: Array<{ path: string; reason: string; excerpt: string }> }
  report?: {
    recommendation: 'ready_to_ship' | 'needs_attention' | 'inconclusive'
    headline: string
    diagnosis: string
    evidenceIds: string[]
    nextAction: string
  }
  diagnosisUnavailable?: string
}

type AgentEvent =
  | { type: 'connected'; connection: Connection }
  | { type: 'disconnected' }
  | { type: 'change_detected'; path: string }
  | { type: 'verification_started'; trigger: 'manual' | 'change' }
  | { type: 'verification_completed'; trigger: 'manual' | 'change'; result: VerificationResult }
  | { type: 'attention_required'; report: NonNullable<VerificationResult['report']> }
  | { type: 'watcher_error'; message: string }

type Status = { tone: 'quiet' | 'working' | 'warning' | 'danger'; message: string }

const initialStatus: Status = { tone: 'quiet', message: 'Start Verion from a project to begin.' }

export function App() {
  const [connection, setConnection] = useState<Connection | undefined>()
  const [result, setResult] = useState<VerificationResult | undefined>()
  const [status, setStatus] = useState<Status>(initialStatus)
  const [error, setError] = useState<string | undefined>()
  const [notice, setNotice] = useState<string | undefined>()
  const [isVerifying, setIsVerifying] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const acceptConnection = (nextConnection: Connection) => {
    setConnection(nextConnection)
    setShowOnboarding((isShowing) => nextConnection.memory.onboardingRequired ? true : isShowing ? false : false)
  }

  useEffect(() => {
    void loadConnection()
    const events = new EventSource('/api/events')
    events.onmessage = (message) => {
      const event = JSON.parse(message.data) as AgentEvent
      if (event.type === 'connected') {
        acceptConnection(event.connection)
        setStatus({ tone: 'quiet', message: event.connection.watchChanges ? 'Keeping an eye on this project.' : 'This project is connected.' })
      }
      if (event.type === 'disconnected') {
        setConnection(undefined)
        setResult(undefined)
        setShowOnboarding(false)
        setStatus(initialStatus)
      }
      if (event.type === 'change_detected') setStatus({ tone: 'working', message: `I noticed a change in ${event.path}. I’ll review it shortly.` })
      if (event.type === 'verification_started') {
        setIsVerifying(true)
        setStatus({ tone: 'working', message: event.trigger === 'change' ? 'Reviewing the latest update.' : 'Reviewing your project.' })
        setError(undefined)
      }
      if (event.type === 'verification_completed') {
        setIsVerifying(false)
        setResult(event.result)
        setStatus({ tone: event.result.report?.recommendation === 'needs_attention' ? 'danger' : 'quiet', message: event.result.report ? 'Your release recommendation is ready.' : 'The review is ready for a release decision.' })
      }
      if (event.type === 'attention_required') setNotice(event.report.headline)
      if (event.type === 'watcher_error') {
        setIsVerifying(false)
        setStatus({ tone: 'warning', message: event.message })
      }
    }
    events.onerror = () => setStatus({ tone: 'warning', message: 'Verion lost touch with the local project. Refresh to reconnect.' })
    return () => events.close()
  }, [])

  async function loadConnection() {
    try {
      const data = await requestJson<{ connection?: Connection }>('/api/connection')
      if (!data.connection) return
      acceptConnection(data.connection)
      setStatus({ tone: 'quiet', message: data.connection.watchChanges ? 'Keeping an eye on this project.' : 'This project is connected.' })
    } catch {
      setStatus({ tone: 'warning', message: 'Verion is not running here. Start it from your project terminal, then reload this page.' })
    }
  }

  async function completeOnboarding() {
    try {
      const data = await requestJson<{ connection: Connection }>('/api/projects/onboarding-complete', { method: 'POST' })
      setConnection(data.connection)
      setShowOnboarding(false)
      setStatus({ tone: 'quiet', message: 'I understand this project and will remember it here.' })
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'I could not save what I learned about this project.')
    }
  }

  async function verifyNow() {
    if (isVerifying) return
    setIsVerifying(true)
    setError(undefined)
    setStatus({ tone: 'working', message: 'Reviewing your project.' })
    try {
      const nextResult = await requestJson<VerificationResult>('/api/verify', { method: 'POST' })
      setResult(nextResult)
      setStatus({ tone: nextResult.report?.recommendation === 'needs_attention' ? 'danger' : 'quiet', message: nextResult.report ? 'Your release recommendation is ready.' : 'The review is ready for a release decision.' })
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : 'Verification could not complete.'
      setError(message)
      setStatus({ tone: 'danger', message: 'The review did not complete.' })
    } finally {
      setIsVerifying(false)
    }
  }

  async function verifyAnotherProject() {
    try {
      await requestJson<{ connection: null }>('/api/projects/disconnect', { method: 'POST' })
    } finally {
      setConnection(undefined)
      setResult(undefined)
      setError(undefined)
      setShowOnboarding(false)
      setStatus({ tone: 'quiet', message: 'Start Verion from the other project directory.' })
    }
  }

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Verion home"><span className="brand-mark">V</span><span>verion</span></a>
      <p>Local verification layer</p>
      <span className={`agent-state agent-state--${status.tone}`}><i /> {connection ? 'Verion is here' : 'Local agent waiting'}</span>
    </header>

    {connection && showOnboarding ? <FirstRunOnboarding connection={connection} error={error} onComplete={() => void completeOnboarding()} /> : <>
      <section className="intro" id="top">
        <div>
          <p className="section-label">Release confidence</p>
          <h1>{connection ? 'Before you ship.' : 'Verification starts in your project.'}</h1>
        </div>
        <p className="intro-copy">Verion learns your approved local project, reviews the running product, and gives you one clear release decision.</p>
      </section>

      <div className="agent-status" aria-live="polite"><span className={`status-marker status-marker--${status.tone}`} />{status.message}</div>
      {notice && <aside className="attention-notice" role="alert"><div><strong>Release attention required</strong><p>{notice}</p></div><button type="button" onClick={() => setNotice(undefined)} aria-label="Dismiss notification">×</button></aside>}
      {!connection ? <AgentLaunchNotice error={error} /> : <>
        <ProjectHome connection={connection} isVerifying={isVerifying} onVerify={verifyNow} onVerifyAnotherProject={() => void verifyAnotherProject()} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <Report result={result} />
      </>}
    </>}
  </main>
}

function FirstRunOnboarding({ connection, error, onComplete }: { connection: Connection; error?: string; onComplete: () => void }) {
  const [phase, setPhase] = useState<'hello' | 'learning'>('hello')
  const facts = projectFacts(connection)
  const [visibleFacts, setVisibleFacts] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setPhase('learning'), 900)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (phase !== 'learning' || visibleFacts >= facts.length) return
    const timer = window.setTimeout(() => setVisibleFacts((count) => Math.min(count + 1, facts.length)), 240)
    return () => window.clearTimeout(timer)
  }, [facts.length, phase, visibleFacts])

  const complete = phase === 'learning' && visibleFacts === facts.length
  return <section className="first-run" id="top" aria-live="polite">
    <div className="first-run__presence"><VerionPresence state={phase === 'hello' ? 'hello' : complete ? 'ready' : 'learning'} /></div>
    <div className="first-run__content">
      {phase === 'hello' ? <>
        <p className="section-label">Hello</p>
        <h1>I’m Verion.</h1>
        <p className="first-run__lead">I’ll learn this project before you need to trust it.</p>
      </> : <>
        <p className="section-label">Getting to know your project</p>
        <h1>{complete ? 'I understand the shape of this.' : 'Learning how this project fits together.'}</h1>
        <p className="first-run__lead">{complete ? connection.understanding.summary : 'I’m looking through the product, its important flows, and the services it relies on.'}</p>
        <ul className="learning-facts" aria-label="What Verion discovered">
          {facts.slice(0, visibleFacts).map((fact) => <li key={fact.label}><span className="fact-check">✓</span>{fact.technology && <TechnologyIcon technology={fact.technology} />}<span>{fact.label}</span></li>)}
        </ul>
        {complete && <div className="first-run__finish"><p>I’ll keep this picture of the project on this device, so I can notice what changes next.</p><button className="button button--primary" type="button" onClick={onComplete}>Continue to your project <span>→</span></button></div>}
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </section>
}

function VerionPresence({ state }: { state: 'hello' | 'learning' | 'ready' }) {
  return <div className={`verion-presence verion-presence--${state}`} aria-hidden="true">
    <svg viewBox="0 0 180 180" role="presentation"><path className="verion-presence__orbit" d="M28 91c0-35 28-63 63-63s63 28 63 63-28 63-63 63-63-28-63-63Z" /><path className="verion-presence__core" d="m61 59 29 64 29-64-29 18-29-18Z" /><circle className="verion-presence__spark" cx="127" cy="54" r="5" /></svg>
  </div>
}

function projectFacts(connection: Connection): Array<{ label: string; technology?: Technology }> {
  const technologies = connection.understanding.technologies.map((technology) => ({ label: `${technology.label} detected`, technology }))
  const areas = connection.understanding.productAreas.map((area) => ({ label: `${area} identified` }))
  const counts = [
    { label: `${connection.understanding.routeCount} ${connection.understanding.routeCount === 1 ? 'route' : 'routes'}` },
    ...(connection.understanding.apiCount > 0 ? [{ label: `${connection.understanding.apiCount} ${connection.understanding.apiCount === 1 ? 'API' : 'APIs'}` }] : [])
  ]
  return [...technologies, ...areas, ...counts]
}

function TechnologyIcon({ technology }: { technology: Technology }) {
  return <span className={`technology-icon technology-icon--${technology.kind}`} aria-hidden="true">{technologyGlyph(technology.id)}</span>
}

function technologyGlyph(id: string) {
  if (id === 'nextjs') return 'N'
  if (id === 'react') return 'R'
  if (id === 'vite') return 'V'
  if (id === 'stripe') return 'S'
  if (id === 'clerk') return 'C'
  if (id === 'postgresql') return 'P'
  if (id === 'prisma') return '◆'
  if (id === 'typescript') return 'TS'
  return '·'
}

function AgentLaunchNotice({ error }: { error?: string }) {
  return <section className="workspace connection-workspace" aria-labelledby="connection-title">
    <div className="evidence-rail" aria-hidden="true"><span>Start</span><i /><span>Learn</span><i /><span>Verify</span></div>
    <div className="connection-form launch-notice">
      <div className="form-heading"><p className="section-label">Local project</p><h2 id="connection-title">Start where the code lives.</h2><p>Open a terminal in the project’s root and run:</p></div>
      <code className="launch-command">verion</code>
      <p className="launch-copy">Verion learns that directory, keeps an eye on its source changes, and looks for a running local app. Nothing needs to be copied into this browser.</p>
      <details className="launch-advanced"><summary>Local app was not detected?</summary><p>Start with an explicit address only when needed: <code>verion --url http://127.0.0.1:3000</code></p></details>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </section>
}

function ProjectHome({ connection, isVerifying, onVerify, onVerifyAnotherProject }: { connection: Connection; isVerifying: boolean; onVerify: () => void; onVerifyAnotherProject: () => void }) {
  const projectName = connection.discovery.packageName ?? connection.projectPath.split('/').filter(Boolean).pop() ?? 'Connected project'
  const highlights = [...connection.understanding.productAreas, `${connection.understanding.routeCount} routes`, ...(connection.understanding.apiCount > 0 ? [`${connection.understanding.apiCount} APIs`] : [])]
  return <section className="workspace project-summary" aria-labelledby="project-title">
    <div className="evidence-rail evidence-rail--active" aria-hidden="true"><span>Understand</span><i /><span>Review</span><i /><span>Decide</span></div>
    <div className="project-main"><p className="section-label">{projectName}</p><h2 id="project-title">I know this project.</h2><p className="project-summary__copy">{connection.understanding.summary}</p><div className="project-highlights">{highlights.map((highlight) => <span key={highlight}>{highlight}</span>)}</div><p className="project-memory">Remembered locally · updated when the project changes</p></div>
    <div className="project-actions"><button className="button button--primary" type="button" onClick={onVerify} disabled={isVerifying}>{isVerifying ? 'Verion is reviewing…' : 'Verify'} <span>→</span></button><button className="text-button" type="button" onClick={onVerifyAnotherProject} disabled={isVerifying}>Verify another project</button></div>
  </section>
}

function Report({ result }: { result?: VerificationResult }) {
  if (!result) return <section className="report-empty"><p className="section-label">Your next move</p><h2>Ask Verion to review this change.</h2><p>I’ll look through the project and its running app, then give you one release recommendation.</p></section>
  if (!result.report) return <section className="report report--inconclusive"><p className="section-label">Review complete</p><h2>I need one more step before I can decide.</h2><p>{result.diagnosisUnavailable ?? 'Verion could not make a release recommendation.'}</p><EvidenceSummary evidence={result.evidence} /></section>

  const citedEvidence = result.evidence.filter((item) => result.report!.evidenceIds.includes(item.id))
  return <section className={`report report--${result.report.recommendation}`} aria-labelledby="report-title">
    <div className="report-heading"><div><p className="section-label">Release decision</p><h2 id="report-title">{result.report.headline}</h2></div><span className="recommendation">{recommendationLabel(result.report.recommendation)}</span></div>
    <p className="report-diagnosis">{result.report.diagnosis}</p>
    <div className="report-grid"><div><p className="detail-label">What to do next</p><p>{result.report.nextAction}</p></div><div><p className="detail-label">What I found</p><EvidenceSummary evidence={citedEvidence} /></div></div>
    {result.capsule.relevantFiles.length > 0 && <div className="source-context"><p className="detail-label">Relevant code</p>{result.capsule.relevantFiles.slice(0, 3).map((file) => <details key={file.path}><summary><code>{file.path}</code><span>{file.reason}</span></summary><pre>{file.excerpt}</pre></details>)}</div>}
  </section>
}

function EvidenceSummary({ evidence }: { evidence: Evidence[] }) {
  if (evidence.length === 0) return <p className="muted">Nothing more needs your attention right now.</p>
  return <ul className="evidence-list">{evidence.map((item) => <li key={item.id}><span>{evidenceIcon(item.kind)}</span><div><strong>{item.summary}</strong><code>{item.location?.file ?? item.location?.url ?? evidenceLocationLabel(item.kind)}</code>{item.kind === 'screenshot' && <img src={`/api/evidence/${encodeURIComponent(item.id)}`} alt="Captured product view" />}</div></li>)}</ul>
}

function recommendationLabel(recommendation: NonNullable<VerificationResult['report']>['recommendation']) {
  return recommendation === 'ready_to_ship' ? 'Ready to ship' : recommendation === 'needs_attention' ? 'Needs attention' : 'Inconclusive'
}

function evidenceLocationLabel(kind: string) {
  if (kind === 'browser_exploration') return 'Running application'
  if (kind === 'console_log') return 'Browser console'
  if (kind === 'network_log') return 'Network activity'
  if (kind === 'repository_discovery') return 'Project structure'
  return 'Project review'
}

function evidenceIcon(kind: string) {
  if (kind === 'screenshot') return '◫'
  if (kind === 'console_log') return '⌁'
  if (kind === 'network_log') return '↗'
  return '·'
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
  const body = await response.text()
  let data: (T & { error?: string }) | undefined
  try {
    data = body ? JSON.parse(body) as T & { error?: string } : undefined
  } catch {
    throw new Error('The local agent did not return a valid response. Restart Verion from the project terminal, then reload this page.')
  }
  if (!response.ok) throw new Error(data?.error ?? 'The local agent endpoint is unavailable. Restart Verion from the project terminal, then retry.')
  if (!data) throw new Error('The local agent returned an empty response. Restart Verion from the project terminal, then reload this page.')
  return data
}
