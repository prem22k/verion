import { useEffect, useState } from 'react'
import { siClerk, siNextdotjs, siPostgresql, siPrisma, siReact, siStripe, siTypescript, siVite, type SimpleIcon } from 'simple-icons'

type Technology = { id: string; label: string; kind: 'framework' | 'library' | 'service' | 'database' }
type UnderstandingItem = { id: string; label: string }
type ModelJourney = UnderstandingItem & { reason: string }
type MissionStatus = 'ready_for_review' | 'ready_to_ship' | 'needs_attention' | 'inconclusive' | 'reviewing'

type MissionReport = {
  id: string
  outcome: Exclude<MissionStatus, 'ready_for_review' | 'reviewing'>
  confidence: 'high' | 'moderate' | 'limited'
  headline: string
  rootCause: string
  reasons: string[]
  nextAction: string
  completedAt: string
}

type MissionReview = {
  steps: Array<{ title: string; description: string; state: 'completed' | 'current' | 'next' | 'paused' }>
  changes: string[]
  hasRunningExperience: boolean
  observations?: Array<{ tone: 'success' | 'warning'; message: string }>
  paused?: boolean
  message?: string
}

type MissionControl = {
  project: {
    name: string
    understanding: {
      summary: string
      technologies: Technology[]
      productAreas: string[]
      routeCount: number
      apiCount: number
      applicationType?: string
      authentication?: string
      payments?: string
      database?: string
      framework?: string
      model?: {
        thesis: string
        keyEntities: UnderstandingItem[]
        priorityJourneys: ModelJourney[]
        reviewFocus: string
        updatedAt: string
      }
      userJourneys: UnderstandingItem[]
      criticalBusinessFlows: UnderstandingItem[]
      importantPages: UnderstandingItem[]
      importantApis: UnderstandingItem[]
    }
  }
  onboardingRequired: boolean
  hasChangeBaseline: boolean
  likelyImpact: UnderstandingItem[]
  recentChanges: Array<{ id: string; label: string; description: string }>
  knownUserJourneys: Array<{ id: string; label: string; source: 'project' | 'browser' }>
  localMemory: {
    firstLearnedAt: string
    lastLearnedAt: string
    lastVerifiedAt?: string
    knownJourneyCount: number
    reviewCount: number
  }
  deepSecurity: {
    status: 'not_configured' | 'reviewing' | 'completed' | 'concern' | 'unavailable'
    label: string
    description: string
  }
  currentStatus: { kind: MissionStatus; label: string; description: string }
  recentReports: MissionReport[]
  review?: MissionReview
}

type AgentEvent =
  | { type: 'connected'; mission: MissionControl }
  | { type: 'disconnected' }
  | { type: 'change_detected'; mission: MissionControl }
  | { type: 'verification_started'; trigger: 'manual' | 'change'; mission: MissionControl }
  | { type: 'review_progress'; trigger: 'manual' | 'change'; mission: MissionControl }
  | { type: 'verification_completed'; trigger: 'manual' | 'change'; mission: MissionControl; report?: MissionReport }
  | { type: 'verification_paused'; trigger: 'manual' | 'change'; mission: MissionControl }
  | { type: 'attention_required'; report: MissionReport }
  | { type: 'watcher_error' }

export function App() {
  const [mission, setMission] = useState<MissionControl | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isAgentUnavailable, setIsAgentUnavailable] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [repairWatchReportId, setRepairWatchReportId] = useState<string | undefined>()

  const acceptMission = (nextMission: MissionControl) => {
    setMission(nextMission)
    setIsAgentUnavailable(false)
  }

  useEffect(() => {
    let active = true
    let events: EventSource | undefined
    let retryTimer: number | undefined

    const subscribe = () => {
      events?.close()
      events = new EventSource('/api/events')
      events.onopen = () => setIsAgentUnavailable(false)
      events.onmessage = (message) => handleAgentEvent(JSON.parse(message.data) as AgentEvent)
      events.onerror = () => {
        events?.close()
        setIsAgentUnavailable(true)
        if (active) retryTimer = window.setTimeout(() => void reconnect(), 5_000)
      }
    }

    const reconnect = async () => {
      const connected = await loadMission()
      if (active && connected) subscribe()
      if (active && !connected) retryTimer = window.setTimeout(() => void reconnect(), 5_000)
    }

    const handleAgentEvent = (event: AgentEvent) => {
      if (event.type === 'connected' || event.type === 'change_detected' || event.type === 'review_progress') acceptMission(event.mission)
      if (event.type === 'verification_started') {
        acceptMission(event.mission)
        setIsVerifying(true)
        setError(undefined)
      }
      if (event.type === 'verification_completed') {
        acceptMission(event.mission)
        setIsVerifying(false)
        setRepairWatchReportId(undefined)
      }
      if (event.type === 'verification_paused') {
        acceptMission(event.mission)
        setIsVerifying(false)
      }
      if (event.type === 'disconnected') {
        setMission(undefined)
        setIsVerifying(false)
        setRepairWatchReportId(undefined)
      }
      if (event.type === 'watcher_error') setError('Verion could not finish the latest review. Check the project, then try again.')
    }

    void reconnect()
    return () => {
      active = false
      events?.close()
      if (retryTimer !== undefined) window.clearTimeout(retryTimer)
    }
  }, [])

  async function loadMission(): Promise<boolean> {
    try {
      setError(undefined)
      const data = await requestJson<{ mission?: MissionControl }>('/api/connection')
      if (data.mission) acceptMission(data.mission)
      setIsAgentUnavailable(false)
      return true
    } catch {
      setIsAgentUnavailable(true)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  async function completeOnboarding() {
    try {
      const data = await requestJson<{ mission: MissionControl }>('/api/projects/onboarding-complete', { method: 'POST' })
      acceptMission(data.mission)
    } catch {
      setError('Verion could not save this project memory. Please try again.')
    }
  }

  async function verifyNow() {
    if (isVerifying) return
    setIsVerifying(true)
    setError(undefined)
    try {
      const data = await requestJson<{ mission: MissionControl }>('/api/verify', { method: 'POST' })
      acceptMission(data.mission)
    } catch {
      setError('Verion could not finish that review. Check the running project, then try again.')
      void loadMission()
    } finally {
      setIsVerifying(false)
    }
  }

  async function fixWithCodex(reportId: string): Promise<'opened' | 'unavailable' | 'needs_review'> {
    try {
      const data = await requestJson<{ status: 'opened' | 'unavailable' | 'needs_review' }>('/api/reports/fix', {
        method: 'POST',
        body: JSON.stringify({ reportId })
      })
      if (data.status === 'opened') setRepairWatchReportId(reportId)
      return data.status
    } catch {
      return 'unavailable'
    }
  }

  return <main className="verion-app">
    <TopBar mission={mission} isWorking={isVerifying} unavailable={isAgentUnavailable} />
    <span className="sr-only" aria-live="polite">{isVerifying ? 'Verion is reviewing the latest change.' : mission?.currentStatus.label}</span>
    {isLoading && !mission ? <LoadingLedger /> : mission?.onboardingRequired ? <FirstLearning mission={mission} error={error} onContinue={() => void completeOnboarding()} /> : mission ? <>
      {mission.review
        ? <ReviewMission mission={mission} isAgentUnavailable={isAgentUnavailable} onReconnect={() => void loadMission()} onVerify={() => void verifyNow()} />
        : <MissionControlHome mission={mission} isVerifying={isVerifying} isAgentUnavailable={isAgentUnavailable} repairWatchReportId={repairWatchReportId} onVerify={() => void verifyNow()} onReconnect={() => void loadMission()} onFixWithCodex={fixWithCodex} />}
      {error && <p className="inline-error" role="alert">{error}</p>}
    </> : <LaunchNotice unavailable={isAgentUnavailable} />}
  </main>
}

function TopBar({ mission, isWorking, unavailable }: { mission?: MissionControl; isWorking: boolean; unavailable: boolean }) {
  const label = unavailable ? 'Reconnect needed' : isWorking ? 'Review in progress' : mission ? 'Stored locally' : 'Local project teammate'
  return <header className="topbar">
    <a className="wordmark" href="#top" aria-label="Verion home"><span aria-hidden="true">V</span>verion</a>
    {mission && <p className="topbar__project">{displayProjectName(mission.project.name)}</p>}
    <p className={`topbar__state topbar__state--${unavailable ? 'warning' : isWorking ? 'working' : 'ready'}`}>{label}</p>
  </header>
}

function FirstLearning({ mission, error, onContinue }: { mission: MissionControl; error?: string; onContinue: () => void }) {
  const understanding = mission.project.understanding
  return <section className="first-learning" id="top" aria-labelledby="learning-title">
    <p className="index-label">A local project teammate</p>
    <div className="first-learning__grid">
      <div>
        <h1 id="learning-title">I’m Verion.</h1>
        <p className="first-learning__project">I’ve started learning <strong>{displayProjectName(mission.project.name)}.</strong></p>
        <p className="first-learning__thesis">{thesisFor(understanding)}</p>
        <p className="first-learning__promise">I keep this project picture locally, so the next change is reviewed with context instead of from scratch.</p>
        <button className="primary-action" type="button" onClick={onContinue}>Open the project brief <span aria-hidden="true">↗</span></button>
        {error && <p className="inline-error" role="alert">{error}</p>}
      </div>
      <ProjectFacts mission={mission} mode="learning" />
    </div>
  </section>
}

function MissionControlHome({ mission, isVerifying, isAgentUnavailable, repairWatchReportId, onVerify, onReconnect, onFixWithCodex }: {
  mission: MissionControl
  isVerifying: boolean
  isAgentUnavailable: boolean
  repairWatchReportId?: string
  onVerify: () => void
  onReconnect: () => void
  onFixWithCodex: (reportId: string) => Promise<'opened' | 'unavailable' | 'needs_review'>
}) {
  const [expanded, setExpanded] = useState(false)
  const latest = mission.recentReports[0]
  return <section className="mission" id="top" aria-label={`${mission.project.name} mission control`}>
    <ProjectLedger mission={mission} isVerifying={isVerifying} unavailable={isAgentUnavailable} expanded={expanded} onToggle={() => setExpanded((value) => !value)} onVerify={onVerify} onReconnect={onReconnect} />
    <section className="ledger-section ledger-section--memory" aria-labelledby="memory-title">
      <div className="ledger-section__title"><p className="index-label">02</p><h2 id="memory-title">Local Memory</h2></div>
      <MemoryLine memory={mission.localMemory} />
    </section>
    <section className="ledger-section" aria-labelledby="changes-title">
      <div className="ledger-section__title"><p className="index-label">03</p><h2 id="changes-title">Recent Changes</h2></div>
      <ChangeList changes={mission.recentChanges} hasBaseline={mission.hasChangeBaseline} />
    </section>
    <section className="ledger-section ledger-section--verify" aria-labelledby="verify-title">
      <div className="ledger-section__title"><p className="index-label">04</p><h2 id="verify-title">Verify</h2></div>
      <div className="verify-row"><p>{mission.likelyImpact.length > 0 ? <>The latest change is likely to touch <strong>{joinWords(mission.likelyImpact.map((item) => item.label))}.</strong></> : 'Review the current project in the context Verion now remembers.'}</p>
        {isAgentUnavailable ? <button className="primary-action" type="button" onClick={onReconnect}>Reconnect Verion <span aria-hidden="true">↗</span></button> : <button className="primary-action" type="button" disabled={isVerifying} onClick={onVerify}>{isVerifying ? 'Reviewing…' : 'Verify this change'} <span aria-hidden="true">↗</span></button>}
      </div>
    </section>
    <section className="ledger-section" aria-labelledby="latest-review-title">
      <div className="ledger-section__title"><p className="index-label">05</p><h2 id="latest-review-title">Latest Review</h2></div>
      {latest ? <LatestReview report={latest} watching={repairWatchReportId === latest.id} isVerifying={isVerifying} onVerify={onVerify} onFixWithCodex={onFixWithCodex} /> : <p className="empty-reading">No release decision yet. The first review will turn this project picture into a clear next step.</p>}
    </section>
    <section className="ledger-section" aria-labelledby="security-title">
      <div className="ledger-section__title"><p className="index-label">06</p><h2 id="security-title">Deep Security Review</h2></div>
      <div className={`security-line security-line--${mission.deepSecurity.status}`}><span>{mission.deepSecurity.label}</span><p>{mission.deepSecurity.description}</p></div>
    </section>
    <section className="ledger-section ledger-section--history" aria-labelledby="history-title">
      <div className="ledger-section__title"><p className="index-label">07</p><h2 id="history-title">History</h2></div>
      <HistoryList reports={mission.recentReports.slice(1)} />
    </section>
  </section>
}

function ProjectLedger({ mission, isVerifying, unavailable, expanded, onToggle, onVerify, onReconnect }: {
  mission: MissionControl
  isVerifying: boolean
  unavailable: boolean
  expanded: boolean
  onToggle: () => void
  onVerify: () => void
  onReconnect: () => void
}) {
  const understanding = mission.project.understanding
  return <section className="project-ledger" aria-labelledby="project-title">
    <div className="project-ledger__main">
      <p className="index-label">01 &nbsp; Project Understanding</p>
      <h1 id="project-title">{displayProjectName(mission.project.name)}<span>.</span></h1>
      <p className="project-ledger__thesis">{thesisFor(understanding)}</p>
      <div className="project-ledger__actions">
        {unavailable ? <button className="primary-action" type="button" onClick={onReconnect}>Reconnect Verion <span aria-hidden="true">↗</span></button> : <button className="primary-action" type="button" disabled={isVerifying} onClick={onVerify}>{isVerifying ? 'Reviewing…' : 'Verify this change'} <span aria-hidden="true">↗</span></button>}
        <button className="text-action" type="button" aria-expanded={expanded} aria-controls="project-brief" onClick={onToggle}>{expanded ? 'Close project brief' : 'Read the project brief'}</button>
      </div>
    </div>
    <ProjectFacts mission={mission} mode="ledger" />
    <div id="project-brief" className="project-brief" hidden={!expanded}>
      <ProjectBrief understanding={understanding} />
    </div>
    <TechnologyRoster technologies={understanding.technologies} />
  </section>
}

function ProjectFacts({ mission, mode }: { mission: MissionControl; mode: 'learning' | 'ledger' }) {
  const { understanding } = mission.project
  const facts = [
    { value: String(understanding.routeCount), label: understanding.routeCount === 1 ? 'route mapped' : 'routes mapped' },
    { value: String(understanding.apiCount), label: understanding.apiCount === 1 ? 'API endpoint' : 'API endpoints' },
    { value: String(mission.localMemory.knownJourneyCount), label: mission.localMemory.knownJourneyCount === 1 ? 'path remembered' : 'paths remembered' },
    { value: formatShortDate(mission.localMemory.lastLearnedAt), label: 'last learned' }
  ]
  return <aside className={`project-facts project-facts--${mode}`} aria-label="Project facts"><dl>{facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl></aside>
}

function TechnologyRoster({ technologies }: { technologies: Technology[] }) {
  return <div className="technology-roster" aria-label="Technology detected">
    <p className="index-label">Detected stack</p>
    <ul>{technologies.length > 0 ? technologies.map((technology) => <li key={technology.id}><TechnologyMark technology={technology} /><span>{technology.label}</span></li>) : <li><span>Project technology is still being learned.</span></li>}</ul>
  </div>
}

function ProjectBrief({ understanding }: { understanding: MissionControl['project']['understanding'] }) {
  const entities = understanding.model?.keyEntities ?? []
  const journeys = understanding.model?.priorityJourneys ?? understanding.criticalBusinessFlows.map((item) => ({ ...item, reason: 'This is one of the paths Verion will keep in view.' }))
  return <div className="brief-grid">
    <BriefColumn title="What matters" items={[...understanding.productAreas.map((label, index) => ({ id: `area-${index}`, label })), ...entities]} />
    <BriefColumn title="Priority paths" items={journeys.map((journey) => ({ id: journey.id, label: journey.label, detail: journey.reason }))} />
    <BriefColumn title="Next review focus" items={[{ id: 'focus', label: understanding.model?.reviewFocus ?? fallbackReviewFocus(understanding) }]} />
    {understanding.importantApis.length > 0 && <BriefColumn title="Important APIs" items={understanding.importantApis} />}
  </div>
}

function BriefColumn({ title, items }: { title: string; items: Array<UnderstandingItem & { detail?: string }> }) {
  return <section className="brief-column"><h2>{title}</h2>{items.length > 0 ? <ul>{items.slice(0, 5).map((item) => <li key={item.id}><strong>{item.label}</strong>{item.detail && <span>{item.detail}</span>}</li>)}</ul> : <p>Verion will add detail as it sees more of the product.</p>}</section>
}

function MemoryLine({ memory }: { memory: MissionControl['localMemory'] }) {
  return <div className="memory-line"><p><strong>This project stays on this machine.</strong> Verion learned it {formatDate(memory.firstLearnedAt)} and last refreshed its picture {formatDate(memory.lastLearnedAt)}.</p><dl><div><dt>Release reviews</dt><dd>{memory.reviewCount}</dd></div><div><dt>Last verified</dt><dd>{memory.lastVerifiedAt ? formatShortDate(memory.lastVerifiedAt) : 'Not yet'}</dd></div></dl></div>
}

function ChangeList({ changes, hasBaseline }: { changes: MissionControl['recentChanges']; hasBaseline: boolean }) {
  if (changes.length === 0) return <p className="empty-reading">{hasBaseline ? 'No source change since Verion last refreshed this project picture.' : 'The next refresh establishes the change baseline.'}</p>
  return <ul className="ruled-list">{changes.slice(0, 4).map((change) => <li key={change.id}><strong>{change.label}</strong><span>{change.description}</span></li>)}</ul>
}

function LatestReview({ report, watching, isVerifying, onVerify, onFixWithCodex }: { report: MissionReport; watching: boolean; isVerifying: boolean; onVerify: () => void; onFixWithCodex: (reportId: string) => Promise<'opened' | 'unavailable' | 'needs_review'> }) {
  return <article className={`latest-review latest-review--${report.outcome}`}>
    <div className="latest-review__decision"><p>{statusLabel(report.outcome)} · {confidenceLabel(report.confidence)}</p><h3>{report.headline}</h3></div>
    <div className="latest-review__reading"><div><span>What Verion found</span><p>{report.rootCause}</p></div>{report.reasons.length > 0 && <div><span>Why this matters</span><ul>{report.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}<div><span>Next step</span><p>{report.nextAction}</p></div></div>
    {report.outcome === 'needs_attention' && <FixWithCodex reportId={report.id} watching={watching} onFixWithCodex={onFixWithCodex} />}
    {report.outcome === 'inconclusive' && <button className="text-action" type="button" disabled={isVerifying} onClick={onVerify}>{isVerifying ? 'Reviewing…' : 'Verify again'}</button>}
  </article>
}

function FixWithCodex({ reportId, watching, onFixWithCodex }: { reportId: string; watching: boolean; onFixWithCodex: (reportId: string) => Promise<'opened' | 'unavailable' | 'needs_review'> }) {
  const [state, setState] = useState<'idle' | 'preparing' | 'unavailable' | 'needs_review'>('idle')
  const message = watching ? 'Codex has the repair brief. Verion will review the saved repair.' : state === 'unavailable' ? 'Codex could not open here. Install the local Codex CLI, then try again.' : state === 'needs_review' ? 'Verion needs a current review before it can prepare a repair.' : undefined
  async function open() {
    setState('preparing')
    const result = await onFixWithCodex(reportId)
    if (result !== 'opened') setState(result)
  }
  return <div className="codex-action"><button className="primary-action" type="button" disabled={state === 'preparing'} onClick={() => void open()}>{state === 'preparing' ? 'Preparing Codex…' : 'Fix with Codex'} <span aria-hidden="true">↗</span></button>{message && <p>{message}</p>}</div>
}

function HistoryList({ reports }: { reports: MissionReport[] }) {
  if (reports.length === 0) return <p className="empty-reading">The next release decision will begin this local history.</p>
  return <ol className="history-list">{reports.map((report) => <li key={report.id}><span className={`history-list__status history-list__status--${report.outcome}`}>{statusLabel(report.outcome)}</span><strong>{report.headline}</strong><time dateTime={report.completedAt}>{formatDate(report.completedAt)}</time></li>)}</ol>
}

function ReviewMission({ mission, isAgentUnavailable, onReconnect, onVerify }: { mission: MissionControl; isAgentUnavailable: boolean; onReconnect: () => void; onVerify: () => void }) {
  const review = mission.review!
  const paused = Boolean(review.paused || isAgentUnavailable)
  const observations = review.observations ?? []
  return <section className="review-mission" id="top" aria-labelledby="review-title">
    <div className="review-mission__header"><div><p className="index-label">Reviewing the latest change</p><h1 id="review-title">{displayProjectName(mission.project.name)}<span>.</span></h1><p>{paused ? 'The review paused before Verion could make a reliable release call.' : 'Verion is checking the product paths that matter to this application.'}</p></div><ProjectFacts mission={mission} mode="ledger" /></div>
    <ol className="review-sequence" aria-label="Review progress">{review.steps.map((step) => <li className={`review-sequence__item review-sequence__item--${paused && step.state === 'current' ? 'paused' : step.state}`} key={step.title}><span aria-hidden="true">{step.state === 'completed' ? '✓' : step.state === 'paused' ? '!' : ''}</span><div><h2>{humanReviewTitle(step.title)}</h2><p>{step.description}</p>{step.state === 'current' && step.title.includes('Checking') && observations.length > 0 && <ul className="review-observations">{observations.map((observation) => <li className={`review-observations__item review-observations__item--${observation.tone}`} key={observation.message}>{observation.message}</li>)}</ul>}</div></li>)}</ol>
    <div className="review-mission__actions">{isAgentUnavailable ? <button className="primary-action" type="button" onClick={onReconnect}>Reconnect Verion <span aria-hidden="true">↗</span></button> : paused ? <button className="primary-action" type="button" onClick={onVerify}>Verify again <span aria-hidden="true">↗</span></button> : <p>Verion will return with one release recommendation.</p>}</div>
  </section>
}

function LaunchNotice({ unavailable }: { unavailable: boolean }) {
  return <section className="launch-notice" id="top"><p className="index-label">A local project teammate</p><h1>Start where the code lives.</h1><p>Open a terminal in the project root and run <code>verion</code>. Verion will learn that application, remember it locally, and open its project brief.</p>{unavailable && <p className="inline-error">When Verion is running, refresh this page to reconnect.</p>}</section>
}

function LoadingLedger() {
  return <section className="loading-ledger" aria-label="Learning the local project"><p className="index-label">Verion</p><div /><div /><div /></section>
}

function TechnologyMark({ technology }: { technology: Technology }) {
  const icon = technologyIcon(technology.id)
  if (!icon) return <span className="technology-mark technology-mark--fallback" aria-hidden="true">{technology.label.slice(0, 1)}</span>
  return <svg className="technology-mark" viewBox="0 0 24 24" fill={`#${icon.hex}`} aria-hidden="true"><path d={icon.path} /></svg>
}

function technologyIcon(id: string): SimpleIcon | undefined {
  return ({ nextjs: siNextdotjs, react: siReact, vite: siVite, typescript: siTypescript, clerk: siClerk, stripe: siStripe, postgresql: siPostgresql, prisma: siPrisma } as Record<string, SimpleIcon>)[id]
}

function thesisFor(understanding: MissionControl['project']['understanding']) {
  return understanding.model?.thesis ?? understanding.summary
}

function fallbackReviewFocus(understanding: MissionControl['project']['understanding']) {
  const paths = understanding.criticalBusinessFlows.length > 0 ? understanding.criticalBusinessFlows : understanding.userJourneys
  return paths.length > 0 ? `Pay closest attention to ${joinWords(paths.slice(0, 3).map((item) => item.label.toLowerCase()))}.` : 'Pay closest attention to the paths people use most often.'
}

function humanReviewTitle(title: string) {
  if (title === 'Understanding this project') return 'Project understanding refreshed'
  if (title === 'Reviewing what changed') return 'Latest change understood'
  if (title === 'Checking the product') return 'Product paths reviewed'
  if (title === 'Making a release decision') return 'Release recommendation'
  return title
}

function joinWords(items: string[]) {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`
}

function statusLabel(status: MissionReport['outcome']) {
  if (status === 'ready_to_ship') return 'Ready to ship'
  if (status === 'needs_attention') return 'Needs attention'
  return 'Inconclusive'
}

function confidenceLabel(confidence: MissionReport['confidence']) {
  if (confidence === 'high') return 'High confidence'
  if (confidence === 'moderate') return 'Moderate confidence'
  return 'Limited confidence'
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? 'recently' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function formatShortDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? 'Today' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

function displayProjectName(value: string) {
  const normalized = value.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return normalized.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()) || 'This project'
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init })
  const body = await response.text()
  let data: (T & { error?: string }) | undefined
  try { data = body ? JSON.parse(body) as T & { error?: string } : undefined } catch { throw new Error('The local response was not valid.') }
  if (!response.ok) throw new Error(data?.error ?? 'The local service is unavailable.')
  if (!data) throw new Error('The local service returned an empty response.')
  return data
}
