import { useEffect, useRef, useState } from 'react'

type Technology = { id: string; label: string; kind: 'framework' | 'library' | 'service' | 'database' }
type UnderstandingItem = { id: string; label: string }
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
  steps: Array<{
    title: string
    description: string
    state: 'completed' | 'current' | 'next' | 'paused'
  }>
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
      applicationType?: string
      authentication?: string
      payments?: string
      database?: string
      framework?: string
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
  const [notice, setNotice] = useState<string | undefined>()
  const [selectedReportId, setSelectedReportId] = useState<string | undefined>()
  const [repairWatchReportId, setRepairWatchReportId] = useState<string | undefined>()

  const acceptMission = (nextMission: MissionControl) => {
    setMission(nextMission)
    setIsAgentUnavailable(false)
  }

  useEffect(() => {
    void loadMission()
    const events = new EventSource('/api/events')
    events.onopen = () => setIsAgentUnavailable(false)
    events.onmessage = (message) => {
      const event = JSON.parse(message.data) as AgentEvent
      if (event.type === 'connected') acceptMission(event.mission)
      if (event.type === 'disconnected') {
        setMission(undefined)
        setSelectedReportId(undefined)
        setIsVerifying(false)
        setRepairWatchReportId(undefined)
      }
      if (event.type === 'change_detected') {
        acceptMission(event.mission)
        setNotice(undefined)
      }
      if (event.type === 'verification_started') {
        acceptMission(event.mission)
        setIsVerifying(true)
        setError(undefined)
      }
      if (event.type === 'review_progress') {
        acceptMission(event.mission)
        setIsVerifying(true)
      }
      if (event.type === 'verification_completed') {
        acceptMission(event.mission)
        setIsVerifying(false)
        setRepairWatchReportId(undefined)
        if (event.report) setSelectedReportId(event.report.id)
      }
      if (event.type === 'verification_paused') {
        acceptMission(event.mission)
        setIsVerifying(false)
        setError(undefined)
      }
      if (event.type === 'attention_required') setNotice(event.report.headline)
      if (event.type === 'watcher_error') {
        setIsVerifying(false)
        setError('Verion could not finish that review. You can try again when the project is ready.')
      }
    }
    events.onerror = () => setIsAgentUnavailable(true)
    return () => events.close()
  }, [])

  async function loadMission() {
    try {
      setError(undefined)
      const data = await requestJson<{ mission?: MissionControl }>('/api/connection')
      if (data.mission) acceptMission(data.mission)
      setIsAgentUnavailable(false)
    } catch {
      setIsAgentUnavailable(true)
    } finally {
      setIsLoading(false)
    }
  }

  async function completeOnboarding() {
    try {
      const data = await requestJson<{ mission: MissionControl }>('/api/projects/onboarding-complete', { method: 'POST' })
      acceptMission(data.mission)
    } catch {
      setError('I could not save what I learned about this project. Please try again.')
    }
  }

  async function verifyNow() {
    if (isVerifying) return
    setIsVerifying(true)
    setError(undefined)
    try {
      const data = await requestJson<{ mission: MissionControl; report?: MissionReport }>('/api/verify', { method: 'POST' })
      acceptMission(data.mission)
      if (data.report) setSelectedReportId(data.report.id)
    } catch {
      setError('Verion could not finish that review. Please check the running project, then try again.')
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

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Verion home"><span className="brand-mark">V</span><span>verion</span></a>
      <p>Release confidence, kept local.</p>
      <span className={`agent-state agent-state--${isAgentUnavailable ? 'warning' : isVerifying ? 'working' : 'quiet'}`}><i /> {isAgentUnavailable ? 'Not connected' : mission ? 'Verion is here' : 'Waiting for a project'}</span>
    </header>

    <div className="screen-reader-announcement" aria-live="polite">{isVerifying ? 'Verion is reviewing the project.' : mission?.currentStatus.label}</div>

    {isLoading && !mission ? <MissionLoading /> : mission?.onboardingRequired ? <FirstRunOnboarding mission={mission} error={error} onComplete={() => void completeOnboarding()} /> : mission ? <>
      <MissionControlHome
        mission={mission}
        isVerifying={isVerifying}
        isAgentUnavailable={isAgentUnavailable}
        selectedReportId={selectedReportId}
        onVerify={() => void verifyNow()}
        onReconnect={() => void loadMission()}
        onSelectReport={setSelectedReportId}
        repairWatchReportId={repairWatchReportId}
        onFixWithCodex={fixWithCodex}
      />
      {notice && <aside className="quiet-notice" role="status"><p>{notice}</p><button type="button" onClick={() => setNotice(undefined)} aria-label="Dismiss message">×</button></aside>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </> : <AgentLaunchNotice unavailable={isAgentUnavailable} />}
  </main>
}

function MissionControlHome({ mission, isVerifying, isAgentUnavailable, selectedReportId, onVerify, onReconnect, onSelectReport, repairWatchReportId, onFixWithCodex }: {
  mission: MissionControl
  isVerifying: boolean
  isAgentUnavailable: boolean
  selectedReportId?: string
  onVerify: () => void
  onReconnect: () => void
  onSelectReport: (id: string | undefined) => void
  repairWatchReportId?: string
  onFixWithCodex: (reportId: string) => Promise<'opened' | 'unavailable' | 'needs_review'>
}) {
  if (mission.review) {
    return <section className="mission-control" id="top" aria-label={`${mission.project.name} release review`}>
      <JourneyRail
        phase="review"
        showFix={Boolean(repairWatchReportId)}
        completedPhases={repairWatchReportId ? ['understand', 'explain', 'fix'] : ['understand']}
      />
      <LiveReview
        mission={mission}
        review={mission.review}
        isAgentUnavailable={isAgentUnavailable}
        isRepairReview={Boolean(repairWatchReportId)}
        onVerify={onVerify}
        onReconnect={onReconnect}
      />
    </section>
  }

  const selectedReport = mission.recentReports.find((report) => report.id === selectedReportId)
  const isWatchingRepair = Boolean(selectedReport && repairWatchReportId === selectedReport.id)
  const journeyPhase = selectedReport?.outcome === 'ready_to_ship'
    ? 'ship'
    : selectedReport?.outcome === 'needs_attention' && isWatchingRepair
      ? 'fix'
      : selectedReport?.outcome === 'needs_attention' || selectedReport?.outcome === 'inconclusive'
        ? 'explain'
        : 'review'
  const completedPhases: JourneyPhase[] = isWatchingRepair
    ? ['understand', 'review', 'explain']
    : []

  return <section className="mission-control" id="top" aria-label={`${mission.project.name} mission control`}>
    <JourneyRail phase={journeyPhase} showFix={selectedReport?.outcome === 'needs_attention'} completedPhases={completedPhases} />
    {selectedReport && <DecisionFirst report={selectedReport} repairWatchReportId={repairWatchReportId} onFixWithCodex={onFixWithCodex} />}
    <MissionMasthead mission={mission} isVerifying={isVerifying} onVerify={onVerify} />
    {mission.likelyImpact.length > 0 && <LikelyImpactBrief impacts={mission.likelyImpact} />}
    {isAgentUnavailable && <aside className="connection-recovery" role="status"><p>Verion is not connected to this project right now.</p><button className="text-button" type="button" onClick={onReconnect}>Reconnect</button></aside>}
    <div className="briefing-columns">
      <BriefingList
        title="Recent changes"
        items={mission.recentChanges}
        empty={mission.hasChangeBaseline ? 'No changes since Verion last learned this project.' : 'Verion will notice what changes after this first review.'}
        renderItem={(change) => <><strong>{change.label}</strong><span>{change.description}</span></>}
      />
      <BriefingList
        title="Known user journeys"
        items={mission.knownUserJourneys}
        empty="Verion has not seen a running product path yet. The first review will teach it where people begin."
        renderItem={(journey) => <><strong>{journey.label}</strong><span>{journey.source === 'browser' ? 'Seen in the running app' : 'Understood from the project.'}</span></>}
      />
    </div>
    <ReportShelf reports={mission.recentReports} selectedReportId={selectedReportId} onSelect={onSelectReport} />
  </section>
}

function LiveReview({ mission, review, isAgentUnavailable, isRepairReview, onVerify, onReconnect }: {
  mission: MissionControl
  review: MissionReview
  isAgentUnavailable: boolean
  isRepairReview: boolean
  onVerify: () => void
  onReconnect: () => void
}) {
  const paused = Boolean(review.paused || isAgentUnavailable)
  const currentStep = review.steps.find((step) => step.state === 'current' || step.state === 'paused') ?? review.steps.at(-1)
  const announcement = paused
    ? isAgentUnavailable ? 'Verion lost touch with this project before the review finished.' : review.message
    : currentStep ? `Finished the earlier review steps. Now ${currentStep.title.toLowerCase()}.` : 'Verion is reviewing the latest version.'

  return <section className="live-review" aria-labelledby="live-review-title">
    <span className="screen-reader-announcement" aria-live="polite">{announcement}</span>
    <header className="mission-masthead live-review__masthead">
      <div>
        <p className="section-label">Review</p>
        <h1 id="live-review-title">{isRepairReview ? 'Verifying the repair.' : 'Reviewing the latest version.'}</h1>
        <p className="live-review__lead">{isRepairReview ? 'Checking the same release path after the repair.' : `Verion is following the parts of ${mission.project.name} that matter before making one release recommendation.`}</p>
      </div>
      <aside className="release-status release-status--reviewing" aria-live="polite">
        <VerionPresence state="learning" />
        <div>
          <p className="section-label">Current review</p>
          <h2>{paused ? 'Paused' : 'Checking now'}</h2>
          <p>{paused ? (isAgentUnavailable ? 'Verion lost touch with this project before the review finished.' : review.message) : currentStep?.description}</p>
        </div>
        {isAgentUnavailable ? <button className="button button--primary" type="button" onClick={onReconnect}>Reconnect <span>→</span></button> : paused ? <button className="button button--primary" type="button" onClick={onVerify}>Verify again <span>→</span></button> : <button className="button button--primary" type="button" disabled>Reviewing</button>}
      </aside>
    </header>
    <ol className="review-path" aria-label="Release review progress">
      {review.steps.slice(0, 4).map((step) => {
        const state = paused && step.state === 'current' ? 'paused' : step.state
        return <li className={`review-path__step review-path__step--${state}`} key={step.title}>
          <span className="review-path__mark" aria-hidden="true">{state === 'completed' ? '✓' : state === 'current' ? '·' : state === 'paused' ? '!' : ''}</span>
          <div>
            <h2>{step.title}</h2>
            <p>{step.description}</p>
            {state === 'current' && <span className="review-path__state">Checking now</span>}
            {state === 'paused' && <span className="review-path__state">Paused</span>}
            {state === 'current' && <ChangeBrief changes={review.changes} />}
            {(state === 'current' || state === 'paused') && review.hasRunningExperience && <ObservationBrief observations={(review.observations ?? []).slice(-6)} />}
          </div>
        </li>
      })}
    </ol>
  </section>
}

function ChangeBrief({ changes }: { changes: string[] }) {
  return <aside className="change-brief" aria-label="What changed">
    <p className="section-label">What changed</p>
    {changes.length > 0 ? <ul>{changes.slice(0, 3).map((change) => <li key={change}>{change}</li>)}</ul> : <p>Reviewing the current version against what Verion already knows.</p>}
  </aside>
}

function ObservationBrief({ observations }: { observations: NonNullable<MissionReview['observations']> }) {
  const newest = observations.at(-1)
  return <aside className="observation-brief" aria-labelledby="what-verion-noticed-title">
    <p className="section-label" id="what-verion-noticed-title">What Verion noticed</p>
    {newest && <span className="screen-reader-announcement" aria-live="polite">{newest.message}</span>}
    {observations.length === 0 ? <p>Watching the running experience for anything that could affect people.</p> : <ul>
      {observations.slice(-6).map((observation) => <li className={`observation-brief__item observation-brief__item--${observation.tone}`} key={`${observation.tone}:${observation.message}`}>
        <span className="observation-brief__mark" aria-hidden="true">{observation.tone === 'success' ? '✓' : '!'}</span>
        <span className="screen-reader-announcement">{observation.tone === 'success' ? 'Confirmed: ' : 'Needs attention: '}</span>
        <span>{observation.message}</span>
      </li>)}
    </ul>}
  </aside>
}

function MissionMasthead({ mission, isVerifying, onVerify }: { mission: MissionControl; isVerifying: boolean; onVerify: () => void }) {
  const { understanding } = mission.project
  return <header className="mission-masthead">
    <div className="project-understanding">
      <p className="section-label">Release briefing</p>
      <h1>Before you ship.</h1>
      <p className="masthead-memory">I remember this project and the release paths that matter.</p>
      <p className="masthead-summary">{understanding.summary}</p>
      {understanding.technologies.length > 0 && <p className="technology-sentence">Built with {technologySentence(understanding.technologies)}.</p>}
      {understanding.productAreas.length > 0 && <p className="area-sentence">{areaSentence(understanding.productAreas)}</p>}
      <ProjectMatters understanding={understanding} />
    </div>
    <aside className={`release-status release-status--${isVerifying ? 'reviewing' : mission.currentStatus.kind}`} aria-live="polite">
      <VerionPresence state={isVerifying ? 'learning' : mission.currentStatus.kind === 'ready_to_ship' ? 'ready' : 'hello'} />
      <div>
        <p className="section-label">Current status</p>
        <h2>{isVerifying ? 'Reviewing' : mission.currentStatus.label}</h2>
        <p>{isVerifying ? 'Verion is looking through the latest version.' : mission.currentStatus.description}</p>
      </div>
      <button className="button button--primary" type="button" onClick={onVerify} disabled={isVerifying}>{isVerifying ? 'Verion is reviewing…' : mission.likelyImpact.length > 0 ? 'Verify now' : 'Verify'} {!isVerifying && <span>→</span>}</button>
    </aside>
  </header>
}

type JourneyPhase = 'understand' | 'review' | 'explain' | 'fix' | 'ship'

function JourneyRail({ phase, showFix = false, completedPhases = [] }: { phase: JourneyPhase; showFix?: boolean; completedPhases?: JourneyPhase[] }) {
  const phases: Array<{ id: JourneyPhase; label: string }> = [
    { id: 'understand', label: 'Understand' },
    { id: 'review', label: 'Review' },
    { id: 'explain', label: 'Explain' },
    ...(showFix ? [{ id: 'fix' as JourneyPhase, label: 'Fix' }] : []),
    { id: 'ship', label: 'Ship' }
  ]
  const activeIndex = phases.findIndex((item) => item.id === phase)

  return <ol className="journey-rail" aria-label="Release journey">
    {phases.map((item, index) => {
      const state = completedPhases.includes(item.id) || (index < activeIndex && item.id !== phase)
        ? 'completed'
        : index === activeIndex
          ? 'current'
          : 'future'
      return <li className={`journey-rail__step journey-rail__step--${state}`} key={item.id} aria-current={state === 'current' ? 'step' : undefined}>
        <span>{item.label}</span>
      </li>
    })}
  </ol>
}

function LikelyImpactBrief({ impacts }: { impacts: UnderstandingItem[] }) {
  const labels = impacts.map((impact) => impact.label)
  const announcement = `Verion noticed changes that may affect ${joinWords(labels)}.`

  return <section className="likely-impact" aria-labelledby="likely-impact-title">
    <span className="screen-reader-announcement" aria-live="polite">{announcement}</span>
    <p className="section-label" id="likely-impact-title">Likely impact</p>
    <p>Today’s changes probably affect</p>
    <strong>{labels.join(' · ')}</strong>
  </section>
}

function ProjectMatters({ understanding }: { understanding: MissionControl['project']['understanding'] }) {
  const groups = [
    { title: 'User journeys', items: understanding.userJourneys },
    { title: 'Critical flows', items: understanding.criticalBusinessFlows },
    { title: 'Important pages', items: understanding.importantPages },
    { title: 'Important APIs', items: understanding.importantApis }
  ].filter((group) => group.items.length > 0)
  const statements = understandingStatements(understanding)

  if (statements.length === 0 && groups.length === 0) {
    return <p className="project-matters__partial">I understand the main shape of this project. I’ll learn more when I review the running app.</p>
  }

  return <section className="project-matters" aria-labelledby="what-matters-title">
    <h2 id="what-matters-title">What matters here</h2>
    {statements.length > 0 && <div className="project-matters__statements">{statements.map((statement) => <p key={statement}>{statement}</p>)}</div>}
    {groups.length > 0 && <div className="project-matters__groups">{groups.map((group) => <UnderstandingGroup key={group.title} title={group.title} items={group.items} />)}</div>}
  </section>
}

function UnderstandingGroup({ title, items }: { title: string; items: UnderstandingItem[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, 3)
  const listId = `understanding-${title.toLowerCase().replaceAll(' ', '-')}`
  return <section className="understanding-group" aria-labelledby={`${listId}-title`}>
    <h3 id={`${listId}-title`}>{title}</h3>
    <ul id={listId}>{visible.map((item) => <li key={item.id}>{item.label}</li>)}</ul>
    {items.length > 3 && <button className="text-button understanding-group__disclosure" type="button" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded((value) => !value)}>{expanded ? 'Show less' : 'Show all'}</button>}
  </section>
}

function BriefingList<T extends { id: string }>({ title, items, empty, renderItem }: { title: string; items: T[]; empty: string; renderItem: (item: T) => React.ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, 4)
  const listId = title.toLowerCase().replaceAll(' ', '-')
  return <section className="briefing-list" aria-labelledby={`${listId}-title`}>
    <h2 id={`${listId}-title`}>{title}</h2>
    {items.length === 0 ? <p className="briefing-empty">{empty}</p> : <>
      <ul id={listId}>{visible.map((item) => <li key={item.id}>{renderItem(item)}</li>)}</ul>
      {items.length > 4 && <button className="text-button briefing-disclosure" type="button" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded((value) => !value)}>{expanded ? 'Show less' : 'Show all'}</button>}
    </>}
  </section>
}

function DecisionFirst({ report, repairWatchReportId, onFixWithCodex }: {
  report: MissionReport
  repairWatchReportId?: string
  onFixWithCodex: (reportId: string) => Promise<'opened' | 'unavailable' | 'needs_review'>
}) {
  return <section className="decision-first" aria-label="Current release decision">
    <ReportDetail report={report} repairWatchReportId={repairWatchReportId} onFixWithCodex={onFixWithCodex} autoFocus />
  </section>
}

function ReportShelf({ reports, selectedReportId, onSelect }: {
  reports: MissionReport[]
  selectedReportId?: string
  onSelect: (id: string | undefined) => void
}) {
  const selected = reports.find((report) => report.id === selectedReportId)
  const shelfTitle = selected ? 'Recent reports' : 'Release confidence'

  return <section className="report-shelf" aria-labelledby="release-confidence-title">
    <h2 id="release-confidence-title">{shelfTitle}</h2>
    {reports.length === 0 ? <p className="briefing-empty">Your release decisions will live here after the first review.</p> : <div className="report-rows">
      {reports.map((report) => <div className="report-row" key={report.id}>
        <button type="button" aria-current={selected?.id === report.id ? 'true' : undefined} onClick={() => onSelect(selected?.id === report.id ? undefined : report.id)}>
          <span className={`report-outcome report-outcome--${report.outcome}`}>{statusLabel(report.outcome)}</span>
          <strong>{report.headline}</strong>
          <time dateTime={report.completedAt}>{relativeDate(report.completedAt)}</time>
        </button>
      </div>)}
    </div>}
  </section>
}

function ReportDetail({ report, repairWatchReportId, onFixWithCodex, autoFocus = false }: {
  report: MissionReport
  repairWatchReportId?: string
  onFixWithCodex: (reportId: string) => Promise<'opened' | 'unavailable' | 'needs_review'>
  autoFocus?: boolean
}) {
  const detailHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (autoFocus) detailHeading.current?.focus()
  }, [autoFocus, report.id])

  return <article className={`report-detail report-detail--${report.outcome}`} aria-labelledby={`release-call-${report.id}`}>
    <p className="section-label">{report.outcome === 'needs_attention' ? 'What Verion found' : 'Release decision'}</p>
    <p className="report-confidence">{confidenceLabel(report.confidence)}</p>
    <h3 id={`release-call-${report.id}`} ref={detailHeading} tabIndex={-1}>{statusLabel(report.outcome)}</h3>
    <section className="report-detail__section">
      <h4>The likely root cause</h4>
      <p>{report.rootCause}</p>
    </section>
    {report.reasons.length > 0 && <section className="report-detail__section">
      <h4>Why I reached this call</h4>
      <ul>{report.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}</ul>
    </section>}
    <section className="report-detail__section">
      <h4>What I would do next</h4>
      <p>{report.nextAction}</p>
    </section>
    {report.outcome === 'needs_attention' && <FixWithCodexAction reportId={report.id} watching={repairWatchReportId === report.id} onOpen={onFixWithCodex} />}
  </article>
}

function FixWithCodexAction({ reportId, watching, onOpen }: {
  reportId: string
  watching: boolean
  onOpen: (reportId: string) => Promise<'opened' | 'unavailable' | 'needs_review'>
}) {
  const [state, setState] = useState<'idle' | 'preparing' | 'unavailable' | 'needs_review'>('idle')
  const message = watching
    ? 'Codex has the repair brief. I’ll verify the repair when it is saved.'
    : state === 'preparing'
      ? 'Preparing a repair brief for Codex.'
      : state === 'unavailable'
        ? 'Codex could not open here. Install the local Codex CLI, then try again.'
        : state === 'needs_review'
          ? 'I need another review before I can prepare a repair.'
          : undefined

  async function open() {
    setState('preparing')
    const result = await onOpen(reportId)
    if (result === 'opened') return
    setState(result)
  }

  return <section className="fix-action" aria-label="Repair with Codex">
    {watching
      ? null
      : <button className="button button--primary" type="button" disabled={state === 'preparing'} aria-busy={state === 'preparing'} onClick={() => void open()}>{state === 'preparing' ? 'Preparing Codex…' : <>Fix with Codex <span>→</span></>}</button>}
    {message && <p className="fix-action__message" aria-live="polite">{message}</p>}
  </section>
}

function FirstRunOnboarding({ mission, error, onComplete }: { mission: MissionControl; error?: string; onComplete: () => void }) {
  const [phase, setPhase] = useState<'hello' | 'learning'>('hello')
  const facts = projectFacts(mission)
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
      {phase === 'hello' ? <><p className="section-label">Hello</p><h1>I’m Verion.</h1><p className="first-run__lead">I’ll learn this project before you need to trust it.</p></> : <>
        <p className="section-label">Getting to know your project</p>
        <h1>{complete ? 'I understand the shape of this.' : 'Learning how this project fits together.'}</h1>
        <p className="first-run__lead">{complete ? mission.project.understanding.summary : 'I’m looking through the product, its important flows, and the services it relies on.'}</p>
        <ul className="learning-facts" aria-label="What Verion discovered">{facts.slice(0, visibleFacts).map((fact) => <li key={fact.label}><span className="fact-check">✓</span>{fact.technology && <TechnologyIcon technology={fact.technology} />}<span>{fact.label}</span></li>)}</ul>
        {complete && <div className="first-run__finish"><p>I’ll keep this picture of the project on this device, so I can notice what changes next.</p><button className="button button--primary" type="button" onClick={onComplete}>Continue to your project <span>→</span></button></div>}
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  </section>
}

function MissionLoading() {
  return <section className="mission-loading" aria-label="Loading your project briefing"><span className="screen-reader-announcement" aria-live="polite">Loading your project briefing</span><div /><div /><div /></section>
}

function VerionPresence({ state }: { state: 'hello' | 'learning' | 'ready' }) {
  return <div className={`verion-presence verion-presence--${state}`} aria-hidden="true"><svg viewBox="0 0 180 180" role="presentation"><path className="verion-presence__orbit" d="M28 91c0-35 28-63 63-63s63 28 63 63-28 63-63 63-63-28-63-63Z" /><path className="verion-presence__core" d="m61 59 29 64 29-64-29 18-29-18Z" /><circle className="verion-presence__spark" cx="127" cy="54" r="5" /></svg></div>
}

function TechnologyIcon({ technology }: { technology: Technology }) {
  return <svg className={`technology-icon technology-icon--${technology.kind}`} viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d={technology.kind === 'service' ? 'M8 12h8M12 8v8' : technology.kind === 'database' ? 'M7.5 9.5c0 1.5 9 1.5 9 0m-9 0v5c0 1.5 9 1.5 9 0v-5' : 'm8 15 4-7 4 7'} /></svg>
}

function projectFacts(mission: MissionControl): Array<{ label: string; technology?: Technology }> {
  const technologies = mission.project.understanding.technologies.map((technology) => ({ label: `${technology.label} detected`, technology }))
  const areas = mission.project.understanding.productAreas.map((area) => ({ label: `${area} identified` }))
  return [...technologies, ...areas]
}

function technologySentence(technologies: Technology[]) {
  const labels = technologies.map((technology) => <span className="technology-inline" key={technology.id}><TechnologyIcon technology={technology} />{technology.label}</span>)
  return joinInline(labels)
}

function areaSentence(areas: string[]) {
  if (areas.length === 1) return `${areas[0]} is important here.`
  return `${joinWords(areas.map((area) => area.toLowerCase()))} are important here.`
}

function understandingStatements(understanding: MissionControl['project']['understanding']): string[] {
  const statements: string[] = []
  if (understanding.applicationType) {
    const applicationType = understanding.applicationType === 'SaaS dashboard' ? understanding.applicationType : lowercaseFirst(understanding.applicationType)
    statements.push(`This is a ${applicationType}.`)
  }
  if (understanding.authentication) statements.push(understanding.authentication === 'Sign-in flows' ? 'People can sign in here.' : `People sign in with ${understanding.authentication}.`)
  if (understanding.payments && understanding.database) {
    const payment = understanding.payments === 'Billing flows' ? 'Billing is an important part of this product' : `Billing runs through ${understanding.payments}`
    statements.push(`${payment}. App data lives in ${understanding.database}.`)
  } else if (understanding.payments) {
    statements.push(understanding.payments === 'Billing flows' ? 'Billing is an important part of this product.' : `Billing runs through ${understanding.payments}.`)
  } else if (understanding.database) {
    statements.push(`App data lives in ${understanding.database}.`)
  }
  if (understanding.framework) {
    const serverComponents = understanding.technologies.find((technology) => technology.label === 'React Server Components')
    statements.push(serverComponents ? `It is built with ${understanding.framework} and ${serverComponents.label}.` : `It is built with ${understanding.framework}.`)
  }
  return [...new Set(statements)]
}

function lowercaseFirst(value: string) {
  return `${value.slice(0, 1).toLowerCase()}${value.slice(1)}`
}

function joinInline(items: React.ReactNode[]) {
  return items.flatMap((item, index) => index === items.length - 1 ? [item] : index === items.length - 2 ? [item, ' and '] : [item, ', '])
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

function relativeDate(value: string) {
  const date = new Date(value)
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const difference = Math.floor((startOfToday - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86_400_000)
  if (difference === 0) return 'Today'
  if (difference === 1) return 'Yesterday'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function AgentLaunchNotice({ unavailable }: { unavailable: boolean }) {
  return <section className="launch-notice" id="top" aria-labelledby="launch-title">
    <p className="section-label">Local project</p>
    <h1 id="launch-title">Start where the code lives.</h1>
    <p>Open a terminal in the project’s root and run:</p>
    <code className="launch-command">verion</code>
    <p className="launch-copy">Verion learns that project, remembers what matters, and opens this briefing for you.</p>
    {unavailable && <p className="launch-copy">When Verion is running, refresh this page to reconnect.</p>}
  </section>
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
