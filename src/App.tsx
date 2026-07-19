import { useEffect, useRef, useState } from 'react'
import { siClerk, siNextdotjs, siPostgresql, siPrisma, siReact, siStripe, siTypescript, siVite, type SimpleIcon } from 'simple-icons'

type Technology = { id: string; label: string; kind: 'framework' | 'library' | 'service' | 'database' }
type UnderstandingItem = { id: string; label: string }
type ModelJourney = UnderstandingItem & { reason: string }
type MissionStatus = 'ready_for_review' | 'ready_to_ship' | 'needs_attention' | 'inconclusive' | 'reviewing'
type Route = 'home' | 'security'

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
  observations?: Array<{ tone: 'success' | 'warning'; message: string }>
  paused?: boolean
}

type CurrentChange = {
  state: 'baseline_not_established' | 'no_change' | 'change_detected' | 'reviewing_change'
  label: string
  description: string
  detectedAt?: string
  groups: Array<{ id: string; label: string; description: string }>
  likelyImpact: Array<{ id: string; label: string; reason?: string }>
}

type SecurityFinding = {
  id: string
  severity: 'critical' | 'high'
  headline: string
  explanation: string
  evidence: string
  suggestedAction: string
  status: 'open' | 'accepted_risk' | 'fixing'
  affectedArea?: string
  file?: string
  startLine?: number
  endLine?: number
  nativeFixAvailable: boolean
}

type RepairSource = { source: 'release_report' | 'security_finding'; id: string; title: string }
type RepairProposalView = {
  id: string
  sourceId: string
  title: string
  summary: string
  status: 'draft' | 'applying' | 'verified' | 'failed' | 'cancelled'
  files: Array<{ path: string; summary: string; diff: string }>
  verificationPlan: string[]
  outcome?: { label: string; description: string }
}

type DeepSecurity = {
  status: 'available' | 'reviewing' | 'completed' | 'concern' | 'partial' | 'unavailable' | 'failed'
  label: string
  description: string
  estimatedDuration: string
  canStart: boolean
  canRetry: boolean
  completedAt?: string
  progress?: SecurityReviewProgress
}

type SecurityReviewStationId = 'scope' | 'code' | 'credentials' | 'dependencies' | 'configuration' | 'running_experience' | 'decision'
type SecurityReviewStationState = 'pending' | 'current' | 'completed' | 'skipped' | 'failed'
type SecurityReviewProgress = {
  state: 'ready' | 'reviewing' | 'completed' | 'concern' | 'partial' | 'failed'
  currentMessage?: string
  stations: Array<{
    id: SecurityReviewStationId
    label: string
    state: SecurityReviewStationState
    detail: string
  }>
}

type LearningFact = {
  id: string
  label: string
  detail?: string
  state?: 'pending' | 'arrived' | 'unavailable'
}

type ProjectLearning = {
  state: 'learning' | 'failed'
  projectName: string
  facts: LearningFact[]
  message?: string
}

type MissionControl = {
  project: {
    id: string
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
  currentChange: CurrentChange
  hasChangeBaseline: boolean
  likelyImpact: UnderstandingItem[]
  recentChanges: Array<{ id: string; label: string; description: string }>
  knownUserJourneys: Array<{ id: string; label: string; source: 'project' | 'browser' }>
  localMemory: { firstLearnedAt: string; lastLearnedAt: string; lastVerifiedAt?: string; knownJourneyCount: number; reviewCount: number; knownIssueCount: number }
  deepSecurity: DeepSecurity
  securityFindings: SecurityFinding[]
  nativeRepairAvailable: boolean
  currentStatus: { kind: MissionStatus; label: string; description: string }
  recentReports: MissionReport[]
  review?: MissionReview
}

type AgentEvent =
  | { type: 'connected'; mission: MissionControl }
  | { type: 'learning_started' | 'learning_progress' | 'learning_failed'; learning: ProjectLearning }
  | { type: 'disconnected' }
  | { type: 'change_detected'; mission: MissionControl }
  | { type: 'verification_started'; trigger: 'manual' | 'change'; mission: MissionControl }
  | { type: 'review_progress'; trigger: 'manual' | 'change'; mission: MissionControl }
  | { type: 'verification_completed'; trigger: 'manual' | 'change'; mission: MissionControl; report?: MissionReport }
  | { type: 'verification_paused'; trigger: 'manual' | 'change'; mission: MissionControl }
  | { type: 'attention_required'; report: MissionReport }
  | { type: 'security_review_started' | 'security_review_progress' | 'security_review_completed' | 'security_review_failed'; mission: MissionControl }
  | { type: 'watcher_error' }

type AIStatus = {
  configured: boolean
  available: boolean
  mode: 'none' | 'byom' | 'verion_ai'
  provider?: { id: string; kind: string; label: string; model: string; capabilities: { structuredOutput: boolean; largeContext: boolean; toolCalling: boolean; reasoning: boolean; vision: boolean; codeGeneration: boolean; codeEditing: boolean } }
  message?: string
}

type AISetupRequest = {
  provider: 'openai_compatible' | 'gemini' | 'openrouter' | 'ollama'
  model: string
  endpoint?: string
  apiStyle?: 'responses' | 'chat_completions'
  credentialMethod: 'none' | 'environment' | 'project_env'
  credentialReference?: string
  apiKey?: string
}

type AssistantCitation = { id: string; kind: 'project_understanding' | 'project_memory' | 'change' | 'release_report' | 'security_finding' | 'source_file'; label: string; sourceId?: string; file?: string; startLine?: number; endLine?: number }
type AssistantMessage = { id: string; role: 'developer' | 'verion'; content: string; createdAt: string; status: 'complete' | 'interrupted' | 'failed'; citations: AssistantCitation[]; basis?: 'discovered_fact' | 'review_observation' | 'model_inference'; uncertainty?: string }
type AssistantConversation = { version: 2; id: string; createdAt: string; updatedAt: string; messages: AssistantMessage[] }
type AssistantState = 'loading' | 'ready' | 'responding' | 'interrupted' | 'unavailable'

export function App() {
  const [mission, setMission] = useState<MissionControl | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSecurityReviewing, setIsSecurityReviewing] = useState(false)
  const [isAgentUnavailable, setIsAgentUnavailable] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [repairWatchReportId, setRepairWatchReportId] = useState<string | undefined>()
  const [route, setRoute] = useState<Route>(routeFromHash())
  const [aiStatus, setAiStatus] = useState<AIStatus | undefined>()
  const [learning, setLearning] = useState<ProjectLearning | undefined>()
  const [aiSetupOpen, setAiSetupOpen] = useState(false)
  const [conversation, setConversation] = useState<AssistantConversation | undefined>()
  const [assistantState, setAssistantState] = useState<AssistantState>('loading')
  const [assistantError, setAssistantError] = useState<string | undefined>()
  const [lastAssistantQuestion, setLastAssistantQuestion] = useState<string | undefined>()
  const [announcement, setAnnouncement] = useState('')
  const [mobileTeammateOpen, setMobileTeammateOpen] = useState(false)
  const [pendingSourceQuestion, setPendingSourceQuestion] = useState<string | undefined>()
  const [repairConfirmationReportId, setRepairConfirmationReportId] = useState<string | undefined>()
  const [repairPrepareSource, setRepairPrepareSource] = useState<RepairSource | undefined>()
  const [repairProposal, setRepairProposal] = useState<RepairProposalView | undefined>()
  const mobileTrigger = useRef<HTMLButtonElement>(null)
  const aiSetupTrigger = useRef<HTMLButtonElement>(null)
  const repairTrigger = useRef<HTMLButtonElement>(null)
  const loadedConversationProject = useRef<string | undefined>(undefined)
  const completedOnboardingProject = useRef<string | undefined>(undefined)

  const acceptMission = (nextMission: MissionControl) => {
    setMission(nextMission)
    setIsAgentUnavailable(false)
  }

  useEffect(() => {
    const updateRoute = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', updateRoute)
    if (!window.location.hash || routeFromHash() !== hashRoute(window.location.hash)) window.history.replaceState(null, '', '#/home')
    updateRoute()
    return () => window.removeEventListener('hashchange', updateRoute)
  }, [])

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
      if (event.type === 'connected' || event.type === 'change_detected' || event.type === 'review_progress' || event.type === 'security_review_started' || event.type === 'security_review_progress' || event.type === 'security_review_completed' || event.type === 'security_review_failed') acceptMission(event.mission)
      if (event.type === 'connected') setLearning(undefined)
      if (event.type === 'learning_started' || event.type === 'learning_progress' || event.type === 'learning_failed') { setLearning(event.learning); setAnnouncement(event.learning.message ?? 'Verion learned another part of this project.') }
      if (event.type === 'change_detected') setAnnouncement(event.mission.currentChange.label)
      if (event.type === 'verification_started') { acceptMission(event.mission); setIsVerifying(true); setError(undefined); setAnnouncement('Verion started reviewing the latest change.') }
      if (event.type === 'verification_completed') { acceptMission(event.mission); setIsVerifying(false); setRepairWatchReportId(undefined); setAnnouncement(event.mission.currentStatus.label) }
      if (event.type === 'verification_paused') { acceptMission(event.mission); setIsVerifying(false); setAnnouncement('Review incomplete. Verify again when the project is ready.') }
      if (event.type === 'security_review_started') { setIsSecurityReviewing(true); setError(undefined); setAnnouncement(event.mission.deepSecurity.progress?.currentMessage ?? 'Deep Security Review started.') }
      if (event.type === 'security_review_progress') { setIsSecurityReviewing(true); setAnnouncement(event.mission.deepSecurity.progress?.currentMessage ?? event.mission.deepSecurity.description) }
      if (event.type === 'security_review_completed') { setIsSecurityReviewing(false); setAnnouncement(event.mission.deepSecurity.label) }
      if (event.type === 'security_review_failed') { setIsSecurityReviewing(false); setAnnouncement(event.mission.deepSecurity.description) }
      if (event.type === 'disconnected') {
        setMission(undefined); setIsVerifying(false); setIsSecurityReviewing(false); setRepairWatchReportId(undefined)
        setConversation(undefined); setLearning(undefined); loadedConversationProject.current = undefined
      }
      if (event.type === 'watcher_error') setError('Verion could not finish the latest review. Check the project, then try again.')
    }
    void reconnect()
    return () => { active = false; events?.close(); if (retryTimer !== undefined) window.clearTimeout(retryTimer) }
  }, [])

  useEffect(() => { void loadAiStatus() }, [mission?.project.id])

  useEffect(() => {
    if (!mission?.onboardingRequired || completedOnboardingProject.current === mission.project.id) return
    completedOnboardingProject.current = mission.project.id
    const timer = window.setTimeout(() => { void completeOnboarding() }, 420)
    return () => window.clearTimeout(timer)
  }, [mission?.onboardingRequired, mission?.project.id])

  useEffect(() => {
    if (!mission?.project.id || loadedConversationProject.current === mission.project.id) return
    loadedConversationProject.current = mission.project.id
    setConversation(undefined)
    setAssistantError(undefined)
    setAssistantState('loading')
    void loadConversation()
  }, [mission?.project.id])

  useEffect(() => {
    if (!mobileTeammateOpen) return
    const drawer = document.getElementById('teammate-drawer')
    const focusable = () => drawer ? Array.from(drawer.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), [href]')).filter((element) => !element.hasAttribute('hidden')) : []
    const first = focusable()[0]
    first?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMobileTeammateOpen(false)
        window.setTimeout(() => mobileTrigger.current?.focus(), 0)
      }
      if (event.key !== 'Tab') return
      const targets = focusable()
      if (targets.length === 0) return
      const start = targets[0]
      const end = targets.at(-1)!
      if (event.shiftKey && document.activeElement === start) { event.preventDefault(); end.focus() }
      if (!event.shiftKey && document.activeElement === end) { event.preventDefault(); start.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [mobileTeammateOpen])

  async function loadMission(): Promise<boolean> {
    try {
      setError(undefined)
      const data = await requestJson<{ mission?: MissionControl; learning?: ProjectLearning }>('/api/connection')
      if (data.mission) { acceptMission(data.mission); setLearning(undefined) }
      if (data.learning) setLearning(data.learning)
      setIsAgentUnavailable(false)
      return true
    } catch {
      setIsAgentUnavailable(true)
      return false
    } finally { setIsLoading(false) }
  }

  async function loadAiStatus() {
    try {
      const data = await requestJson<{ ai: AIStatus }>('/api/ai/status')
      setAiStatus(data.ai)
    } catch {
      // Keep compatibility with an already-running local agent while the dedicated
      // setup endpoint is introduced. The setup UI itself only uses /api/ai/*.
      try {
        const data = await requestJson<{ ai: AIStatus }>('/api/status')
        setAiStatus(data.ai)
      } catch { setAiStatus(undefined) }
    }
  }

  async function validateAiSetup(): Promise<AIStatus | undefined> {
    const data = await requestJson<{ ai?: AIStatus }>('/api/ai/validate', { method: 'POST' })
    if (data.ai) setAiStatus(data.ai)
    return data.ai
  }

  async function saveAiSetup(setup: AISetupRequest): Promise<AIStatus | undefined> {
    const data = await requestJson<{ ai?: AIStatus }>('/api/ai/setup', { method: 'POST', body: JSON.stringify(setup) })
    if (data.ai) setAiStatus(data.ai)
    else await loadAiStatus()
    return data.ai
  }

  async function loadConversation() {
    try {
      const data = await requestJson<{ conversation: AssistantConversation; ai?: AIStatus }>('/api/assistant/conversation')
      setConversation(data.conversation)
      if (data.ai) setAiStatus(data.ai)
      setAssistantState('ready')
    } catch {
      setAssistantState('unavailable')
      setAssistantError('The teammate is temporarily unavailable. Your project view is still here.')
    }
  }

  async function completeOnboarding(): Promise<boolean> {
    try {
      const data = await requestJson<{ mission: MissionControl }>('/api/projects/onboarding-complete', { method: 'POST' })
      acceptMission(data.mission)
      return true
    } catch {
      completedOnboardingProject.current = undefined
      setError('Verion could not save this project memory. Please try again.')
      return false
    }
  }

  async function verifyNow() {
    if (isVerifying) return
    setIsVerifying(true); setError(undefined)
    try {
      const data = await requestJson<{ mission: MissionControl }>('/api/verify', { method: 'POST' })
      acceptMission(data.mission)
    } catch {
      setError('Verion could not finish that review. Check the running project, then try again.')
      void loadMission()
    } finally { setIsVerifying(false) }
  }

  async function reviewSecurity() {
    if (isSecurityReviewing) return
    setIsSecurityReviewing(true); setError(undefined); setAnnouncement('Deep Security Review is preparing the local project boundary.')
    try {
      const data = await requestJson<{ mission: MissionControl }>('/api/security/review', { method: 'POST' })
      acceptMission(data.mission)
      setAnnouncement(data.mission.deepSecurity.progress?.currentMessage ?? data.mission.deepSecurity.description)
    } catch {
      setError('Deep Security Review could not start. Check the local project, then retry.')
      void loadMission()
    } finally { setIsSecurityReviewing(false) }
  }

  async function forgetMemory() {
    const data = await requestJson<{ mission: MissionControl; conversation: AssistantConversation; ai?: AIStatus }>('/api/projects/forget-memory', {
      method: 'POST',
      body: JSON.stringify({ confirmation: 'Forget this project memory' })
    })
    acceptMission(data.mission)
    setConversation(data.conversation)
    if (data.ai) setAiStatus(data.ai)
    setAssistantState('ready')
    setAssistantError(undefined)
    setLastAssistantQuestion(undefined)
    setRepairWatchReportId(undefined)
    setAnnouncement('Project memory forgotten. Verion has learned the current project again and needs a first review to create a new baseline.')
  }

  function requestFixWithCodex(reportId: string, trigger: HTMLButtonElement) {
    repairTrigger.current = trigger
    setRepairConfirmationReportId(reportId)
  }

  async function confirmFixWithCodex(reportId: string): Promise<'opened' | 'unavailable' | 'needs_review'> {
    try {
      const data = await requestJson<{ status: 'opened' | 'unavailable' | 'needs_review' }>('/api/reports/fix', { method: 'POST', body: JSON.stringify({ reportId, confirmation: 'Launch Codex with this review brief' }) })
      if (data.status === 'opened') setRepairWatchReportId(reportId)
      setAnnouncement(data.status === 'opened' ? 'Codex has the review brief. Review its diff, then verify this change again.' : data.status === 'needs_review' ? 'A current review is needed before Verion can prepare a repair.' : 'Codex could not open here. Check the local Codex CLI, then try again.')
      return data.status
    } catch { return 'unavailable' }
  }

  function requestNativeRepair(source: RepairSource, trigger: HTMLButtonElement) {
    repairTrigger.current = trigger
    setRepairPrepareSource(source)
  }

  async function prepareNativeRepair(source: RepairSource): Promise<RepairProposalView | undefined> {
    const data = await requestJson<{ proposal: RepairProposalView }>('/api/repairs/proposals', { method: 'POST', body: JSON.stringify({ source: source.source, id: source.id, confirmation: 'Prepare this repair' }) })
    setRepairProposal(data.proposal)
    setRepairPrepareSource(undefined)
    setAnnouncement('Verion prepared a scoped repair proposal. No project file has changed.')
    return data.proposal
  }

  async function applyNativeRepair(proposalId: string): Promise<RepairProposalView | undefined> {
    const data = await requestJson<{ proposal: RepairProposalView; mission?: MissionControl }>('/api/repairs/apply', { method: 'POST', body: JSON.stringify({ proposalId, confirmation: 'Apply this repair' }) })
    setRepairProposal(data.proposal)
    if (data.mission) acceptMission(data.mission)
    setAnnouncement(data.proposal.outcome?.label ?? 'Verion completed the repair review.')
    return data.proposal
  }

  async function askTeammate(question: string, sourceConsent?: boolean) {
    const clean = question.trim()
    if (!clean || assistantState === 'responding') return
    if (sourceConsent === undefined) setPendingSourceQuestion(undefined)
    setLastAssistantQuestion(clean)
    setAssistantState('responding')
    setAssistantError(undefined)
    const optimistic: AssistantMessage = { id: `pending:${Date.now()}`, role: 'developer', content: clean, createdAt: new Date().toISOString(), status: 'complete', citations: [] }
    setConversation((current) => current ? { ...current, messages: [...current.messages, optimistic] } : current)
    try {
      const data = await requestJson<{ conversation: AssistantConversation; ai?: AIStatus; sourceConsentRequired?: { fileCount: number; excerptCount: number } }>('/api/assistant/messages', { method: 'POST', body: JSON.stringify({ question: clean, ...(sourceConsent === undefined ? {} : { sourceConsent }) }) })
      setConversation(data.conversation)
      if (data.ai) setAiStatus(data.ai)
      setAssistantState('ready')
      if (data.sourceConsentRequired) {
        setPendingSourceQuestion(clean)
        setAnnouncement('Verion needs your permission before using local code context for this answer.')
      } else {
        setPendingSourceQuestion(undefined)
      }
    } catch (requestError: unknown) {
      setAssistantState('interrupted')
      setAssistantError(requestError instanceof Error ? requestError.message : 'The teammate could not finish that answer.')
    }
  }

  async function clearConversation() {
    if (!conversation?.messages.length) return
    try {
      const data = await requestJson<{ conversation: AssistantConversation }>('/api/assistant/conversation/clear', { method: 'POST' })
      setConversation(data.conversation)
      setAssistantState('ready')
      setAssistantError(undefined)
      setLastAssistantQuestion(undefined)
    } catch { setAssistantError('Verion could not clear this local conversation. Try again.') }
  }

  const navigate = (next: Route) => { window.location.hash = `#/${next}` }
  const teammate = <TeammatePanel route={route} securityFindings={mission?.securityFindings} conversation={conversation} state={assistantState} aiStatus={aiStatus} error={assistantError} retryQuestion={lastAssistantQuestion} pendingSourceQuestion={pendingSourceQuestion} onAsk={askTeammate} onUseCodeContext={() => pendingSourceQuestion && void askTeammate(pendingSourceQuestion, true)} onAnswerWithoutCode={() => pendingSourceQuestion && void askTeammate(pendingSourceQuestion, false)} onRetry={() => lastAssistantQuestion && void askTeammate(lastAssistantQuestion)} onClear={() => void clearConversation()} onCitation={(citation) => focusCitation(citation, navigate)} />

  return <div className="app-shell">
    <AppHeader mission={mission} route={route} aiStatus={aiStatus} isWorking={isVerifying || isSecurityReviewing} unavailable={isAgentUnavailable} onOpenAiSetup={() => setAiSetupOpen(true)} onOpenTeammate={() => setMobileTeammateOpen(true)} aiSetupTrigger={aiSetupTrigger} mobileTrigger={mobileTrigger} />
    <div className="app-shell__body">
      <main className="app-main" id="main-content" tabIndex={-1}>
        <span className="sr-only" aria-live="polite">{announcement || (isSecurityReviewing ? 'Deep Security Review is in progress.' : isVerifying ? 'Verion is reviewing the latest change.' : mission?.currentStatus.label)}</span>
        {isLoading && !mission ? <LearningLedger learning={learning} /> : learning ? <LearningLedger learning={learning} onRetry={() => void loadMission()} /> : mission?.onboardingRequired ? <LearningLedger mission={mission} onRetry={() => void loadMission()} /> : mission ? route === 'security'
          ? <SecurityView mission={mission} isReviewing={isSecurityReviewing} error={error} onReview={() => void reviewSecurity()} onAsk={askTeammate} onPrepareNative={requestNativeRepair} />
          : <HomeView mission={mission} isVerifying={isVerifying} isAgentUnavailable={isAgentUnavailable} repairWatchReportId={repairWatchReportId} error={error} onVerify={() => void verifyNow()} onReconnect={() => void loadMission()} onForgetMemory={forgetMemory} onFixWithCodex={requestFixWithCodex} onPrepareNative={requestNativeRepair} />
          : <LaunchNotice unavailable={isAgentUnavailable} />}
      </main>
      <aside className="teammate-aside" aria-label="Verion teammate">{teammate}</aside>
    </div>
    {mobileTeammateOpen && <div className="teammate-drawer-layer"><button className="teammate-drawer-layer__backdrop" type="button" aria-label="Close Verion teammate" onClick={() => setMobileTeammateOpen(false)} /><section className="teammate-drawer" id="teammate-drawer" role="dialog" aria-modal="true" aria-label="Verion teammate">{teammate}</section></div>}
    {repairConfirmationReportId && <RepairLaunchDialog reportId={repairConfirmationReportId} triggerRef={repairTrigger} onClose={() => setRepairConfirmationReportId(undefined)} onConfirm={confirmFixWithCodex} />}
    {repairPrepareSource && <RepairPrepareDialog source={repairPrepareSource} triggerRef={repairTrigger} onClose={() => setRepairPrepareSource(undefined)} onPrepare={prepareNativeRepair} />}
    {repairProposal && <RepairProposalDialog proposal={repairProposal} onClose={() => setRepairProposal(undefined)} onApply={applyNativeRepair} />}
    {aiSetupOpen && <AISetupSheet triggerRef={aiSetupTrigger} currentStatus={aiStatus} onClose={() => setAiSetupOpen(false)} onRefresh={loadAiStatus} onValidate={validateAiSetup} onSave={saveAiSetup} />}
  </div>
}

function AppHeader({ mission, route, aiStatus, isWorking, unavailable, onOpenAiSetup, onOpenTeammate, aiSetupTrigger, mobileTrigger }: { mission?: MissionControl; route: Route; aiStatus?: AIStatus; isWorking: boolean; unavailable: boolean; onOpenAiSetup: () => void; onOpenTeammate: () => void; aiSetupTrigger: React.RefObject<HTMLButtonElement | null>; mobileTrigger: React.RefObject<HTMLButtonElement | null> }) {
  const release = unavailable ? 'Reconnect needed' : isWorking ? 'Reviewing now' : mission?.currentStatus.label ?? 'Local project'
  return <header className="app-header">
    <a className="wordmark" href="#/home" aria-label="Verion home"><span aria-hidden="true">V</span>verion</a>
    {mission && <p className="app-header__project" title={displayProjectName(mission.project.name)}>{displayProjectName(mission.project.name)}</p>}
    <nav className="primary-nav" aria-label="Primary"><a href="#/home" aria-current={route === 'home' ? 'page' : undefined}>Home</a><a href="#/security" aria-current={route === 'security' ? 'page' : undefined}>Security</a></nav>
    <p className={`header-state header-state--${unavailable ? 'warning' : isWorking ? 'working' : mission?.currentStatus.kind ?? 'ready_for_review'}`}>{release}</p>
    <button className="ai-setup-trigger" ref={aiSetupTrigger} type="button" onClick={onOpenAiSetup} aria-label={`AI setup. ${aiSetupLabel(aiStatus)}`}>AI setup</button>
    <button className="mobile-teammate-trigger" ref={mobileTrigger} type="button" onClick={onOpenTeammate} aria-label="Open Verion teammate">Ask Verion</button>
  </header>
}

function HomeView({ mission, isVerifying, isAgentUnavailable, repairWatchReportId, error, onVerify, onReconnect, onForgetMemory, onFixWithCodex, onPrepareNative }: {
  mission: MissionControl; isVerifying: boolean; isAgentUnavailable: boolean; repairWatchReportId?: string; error?: string; onVerify: () => void; onReconnect: () => void; onForgetMemory: () => Promise<void>; onFixWithCodex: (reportId: string, trigger: HTMLButtonElement) => void; onPrepareNative: (source: RepairSource, trigger: HTMLButtonElement) => void
}) {
  return <section className="mission" aria-label={`${mission.project.name} mission control`}>
    <ProjectControlStrip mission={mission} isVerifying={isVerifying} unavailable={isAgentUnavailable} onVerify={onVerify} onReconnect={onReconnect} />
    <ReleaseLedger mission={mission} isVerifying={isVerifying} unavailable={isAgentUnavailable} repairWatchReportId={repairWatchReportId} onVerify={onVerify} onReconnect={onReconnect} onFixWithCodex={onFixWithCodex} onPrepareNative={onPrepareNative} />
    <details className="project-details" aria-label="Project details">
      <summary><span>Project details</span><span>Local Memory and History</span></summary>
      <section className="supporting-details">
        <JourneyList journeys={mission.knownUserJourneys} />
        <LocalMemoryModule memory={mission.localMemory} onForgetMemory={onForgetMemory} />
        <HistoryModule reports={mission.recentReports} />
      </section>
    </details>
    {error && <p className="inline-error" role="alert">{error}</p>}
  </section>
}

function ProjectControlStrip({ mission, isVerifying, unavailable, onVerify, onReconnect }: { mission: MissionControl; isVerifying: boolean; unavailable: boolean; onVerify: () => void; onReconnect: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const understanding = mission.project.understanding
  return <section className="project-control-strip" id="project-understanding" tabIndex={-1} aria-labelledby="project-title"><div className="project-control-strip__main"><p className="index-label">Project Understanding</p><h1 id="project-title">{displayProjectName(mission.project.name)}</h1><p className="project-control-strip__thesis">{thesisFor(understanding)}</p><div className="project-control-strip__actions">{unavailable ? <button className="primary-action" type="button" onClick={onReconnect}>Reconnect Verion</button> : <button className="primary-action" type="button" disabled={isVerifying} onClick={onVerify}>{isVerifying ? 'Reviewing…' : 'Verify this change'}</button>}<button className="text-action" type="button" aria-expanded={expanded} aria-controls="project-brief" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Close project brief' : 'Read the project brief'}</button></div></div><ProjectFacts mission={mission} /><div id="project-brief" className="project-brief" hidden={!expanded}><ProjectBrief understanding={understanding} /></div><TechnologyRoster technologies={understanding.technologies} /></section>
}

function ModuleTitle({ label, title, id }: { label: string; title: string; id: string }) { return <div className="dashboard-module__title"><p className="index-label">{label}</p><h2 id={id}>{title}</h2></div> }

function ProjectFacts({ mission }: { mission: MissionControl }) {
  const { understanding } = mission.project
  const facts = [{ value: String(understanding.routeCount), label: understanding.routeCount === 1 ? 'route mapped' : 'routes mapped' }, { value: String(understanding.apiCount), label: understanding.apiCount === 1 ? 'API endpoint' : 'API endpoints' }, { value: String(mission.localMemory.knownJourneyCount), label: mission.localMemory.knownJourneyCount === 1 ? 'path remembered' : 'paths remembered' }, { value: formatShortDate(mission.localMemory.lastLearnedAt), label: 'last learned' }]
  return <aside className="project-facts" aria-label="Project facts"><dl>{facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl></aside>
}

function TechnologyRoster({ technologies }: { technologies: Technology[] }) { return <div className="technology-roster" aria-label="Technology detected"><p className="index-label">Detected stack</p><ul>{technologies.length ? technologies.map((technology) => <li key={technology.id}><TechnologyMark technology={technology} /><span>{technology.label}</span></li>) : <li><span>Project technology is still being learned.</span></li>}</ul></div> }

function ProjectBrief({ understanding }: { understanding: MissionControl['project']['understanding'] }) {
  const entities = understanding.model?.keyEntities ?? []
  const journeys = understanding.model?.priorityJourneys ?? understanding.criticalBusinessFlows.map((item) => ({ ...item, reason: 'This is one of the paths Verion will keep in view.' }))
  return <div className="brief-grid"><BriefColumn title="What matters" items={[...understanding.productAreas.map((label, index) => ({ id: `area-${index}`, label })), ...entities]} /><BriefColumn title="Priority paths" items={journeys.map((journey) => ({ id: journey.id, label: journey.label, detail: journey.reason }))} /><BriefColumn title="Next review focus" items={[{ id: 'focus', label: understanding.model?.reviewFocus ?? fallbackReviewFocus(understanding) }]} />{understanding.importantApis.length > 0 && <BriefColumn title="Important APIs" items={understanding.importantApis} />}</div>
}

function BriefColumn({ title, items }: { title: string; items: Array<UnderstandingItem & { detail?: string }> }) { return <section className="brief-column"><h2>{title}</h2>{items.length ? <ul>{items.slice(0, 5).map((item) => <li key={item.id}><strong>{item.label}</strong>{item.detail && <span>{item.detail}</span>}</li>)}</ul> : <p>Verion will add detail as it sees more of the product.</p>}</section> }

function ReleaseLedger({ mission, isVerifying, unavailable, repairWatchReportId, onVerify, onReconnect, onFixWithCodex, onPrepareNative }: { mission: MissionControl; isVerifying: boolean; unavailable: boolean; repairWatchReportId?: string; onVerify: () => void; onReconnect: () => void; onFixWithCodex: (reportId: string, trigger: HTMLButtonElement) => void; onPrepareNative: (source: RepairSource, trigger: HTMLButtonElement) => void }) {
  return <section className="release-ledger" id="release-ledger" tabIndex={-1} aria-labelledby="release-ledger-title"><div className="release-ledger__heading"><p className="index-label">Release ledger</p><h2 id="release-ledger-title">Current release context</h2></div><LedgerRow label="Current change" state={mission.currentChange.label} stateKind={mission.currentChange.state}><p>{mission.currentChange.description}</p>{mission.currentChange.detectedAt && <time dateTime={mission.currentChange.detectedAt}>Detected {formatDate(mission.currentChange.detectedAt)}</time>}{mission.currentChange.groups.length > 0 && <ul className="ledger-reading-list">{mission.currentChange.groups.slice(0, 3).map((group) => <li key={group.id}><strong>{group.label}</strong><span>{group.description}</span></li>)}</ul>}{mission.review && <InlineReviewProgress review={mission.review} />}</LedgerRow><LedgerRow label="Likely impact" state={impactStateLabel(mission.currentChange)} stateKind={mission.currentChange.state}>{mission.currentChange.likelyImpact.length > 0 ? <ul className="ledger-reading-list">{mission.currentChange.likelyImpact.slice(0, 3).map((impact) => <li key={impact.id}><strong>{impact.label}</strong>{impact.reason && <span>{impact.reason}</span>}</li>)}</ul> : <p>{impactEmptyCopy(mission.currentChange.state)}</p>}</LedgerRow><LedgerRow label="Latest decision" state={unavailable ? 'Reconnect needed' : mission.currentStatus.label} stateKind={unavailable ? 'inconclusive' : mission.currentStatus.kind}><DecisionDetail mission={mission} isVerifying={isVerifying} unavailable={unavailable} repairWatchReportId={repairWatchReportId} onVerify={onVerify} onReconnect={onReconnect} onFixWithCodex={onFixWithCodex} onPrepareNative={onPrepareNative} /></LedgerRow></section>
}

function LedgerRow({ label, state, stateKind, children }: { label: string; state: string; stateKind: string; children: React.ReactNode }) { return <section className="release-ledger__row"><div className="release-ledger__label"><p>{label}</p><span className={`ledger-state ledger-state--${stateKind}`}>{state}</span></div><div className="release-ledger__reading">{children}</div></section> }

function InlineReviewProgress({ review }: { review: MissionReview }) { return <ol className="inline-review-progress" aria-label="Review progress">{review.steps.map((step) => <li className={`inline-review-progress__item inline-review-progress__item--${step.state}`} key={step.title}><span aria-hidden="true">{step.state === 'completed' ? '✓' : step.state === 'paused' ? '!' : '•'}</span><div><strong>{humanReviewTitle(step.title)}</strong><p>{step.description}</p></div></li>)}</ol> }

function DecisionDetail({ mission, isVerifying, unavailable, repairWatchReportId, onVerify, onReconnect, onFixWithCodex, onPrepareNative }: { mission: MissionControl; isVerifying: boolean; unavailable: boolean; repairWatchReportId?: string; onVerify: () => void; onReconnect: () => void; onFixWithCodex: (reportId: string, trigger: HTMLButtonElement) => void; onPrepareNative: (source: RepairSource, trigger: HTMLButtonElement) => void }) {
  const [fixState, setFixState] = useState<'idle' | 'awaiting_confirmation'>('idle')
  const report = mission.recentReports[0]
  const prepareFix = (trigger: HTMLButtonElement) => {
    if (!report) return
    setFixState('awaiting_confirmation')
    onFixWithCodex(report.id, trigger)
  }
  if (unavailable) return <><p>The local Verion service is not connected. Reconnect before making a release decision.</p><button className="text-action" type="button" onClick={onReconnect}>Reconnect Verion</button></>
  if (mission.review && !mission.review.paused) return <p>{mission.currentStatus.description}</p>
  if (mission.review?.paused) return <><p>{mission.currentStatus.description}</p><button className="text-action" type="button" disabled={isVerifying} onClick={onVerify}>{isVerifying ? 'Reviewing…' : 'Verify again'}</button></>
  if (!report) return <p>No release decision yet. The first review will create the comparison point and a clear next step.</p>
  const fixMessage = repairWatchReportId === report.id ? 'Codex has the repair brief. Review its diff, then verify this change again.' : fixState === 'awaiting_confirmation' ? 'Confirm the next step before Verion creates a review brief or opens Codex.' : undefined
  return <><div className="decision-detail"><strong>{report.headline}</strong><p>{report.rootCause}</p>{report.reasons.length > 0 && <ul>{report.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}</ul>}<p><span>Next safe step</span>{report.nextAction}</p><time dateTime={report.completedAt}>Reviewed {formatDate(report.completedAt)}</time></div>{report.outcome === 'needs_attention' && <div className="decision-detail__action"><CopyFixPrompt source={{ source: 'release_report', id: report.id, title: report.headline }} /><button className="text-action" type="button" onClick={(event) => prepareFix(event.currentTarget)}>Fix with Codex</button>{mission.nativeRepairAvailable && <button className="text-action" type="button" onClick={(event) => onPrepareNative({ source: 'release_report', id: report.id, title: report.headline }, event.currentTarget)}>Fix with Verion</button>}{fixMessage && <p>{fixMessage}</p>}</div>}{report.outcome === 'inconclusive' && <button className="text-action" type="button" disabled={isVerifying} onClick={onVerify}>{isVerifying ? 'Reviewing…' : 'Verify again'}</button>}</>
}

function JourneyList({ journeys }: { journeys: MissionControl['knownUserJourneys'] }) { return <section className="supporting-module" id="important-journeys" tabIndex={-1} aria-labelledby="journeys-title"><ModuleTitle label="Project paths" title="Important journeys" id="journeys-title" />{journeys.length ? <ul className="supporting-ruled-list">{journeys.slice(0, 6).map((journey) => <li key={journey.id}><strong>{journey.label}</strong>{journey.source === 'browser' && <span>Observed in the app</span>}</li>)}</ul> : <p className="empty-reading">Verion has not learned a named journey for this project yet.</p>}</section> }

function LocalMemoryModule({ memory, onForgetMemory }: { memory: MissionControl['localMemory']; onForgetMemory: () => Promise<void> }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  return <><section className="supporting-module" id="local-memory" tabIndex={-1} aria-labelledby="memory-title"><ModuleTitle label="Remembered locally" title="Local Memory" id="memory-title" /><dl className="memory-facts"><div><dt>First learned</dt><dd>{formatDate(memory.firstLearnedAt)}</dd></div><div><dt>Last learned</dt><dd>{formatDate(memory.lastLearnedAt)}</dd></div><div><dt>Last reviewed</dt><dd>{memory.lastVerifiedAt ? formatDate(memory.lastVerifiedAt) : 'Not yet'}</dd></div><div><dt>Known paths</dt><dd>{memory.knownJourneyCount}</dd></div><div><dt>Reviews</dt><dd>{memory.reviewCount}</dd></div><div><dt>Open issues</dt><dd>{memory.knownIssueCount}</dd></div></dl><button className="text-action" ref={triggerRef} type="button" onClick={() => setDialogOpen(true)}>Manage local memory</button></section>{dialogOpen && <ForgetMemoryDialog triggerRef={triggerRef} onClose={() => setDialogOpen(false)} onForget={onForgetMemory} />}</>
}

function ForgetMemoryDialog({ triggerRef, onClose, onForget }: { triggerRef: React.RefObject<HTMLButtonElement | null>; onClose: () => void; onForget: () => Promise<void> }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const [isForgetting, setIsForgetting] = useState(false)
  const isForgettingRef = useRef(false)
  const [error, setError] = useState<string | undefined>()
  isForgettingRef.current = isForgetting
  useEffect(() => {
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 0)
    const dialog = dialogRef.current
    const focusable = () => dialog ? Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled])')).filter((element) => !element.hasAttribute('hidden')) : []
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isForgettingRef.current) { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const targets = focusable()
      if (targets.length === 0) return
      const first = targets[0]
      const last = targets.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', handleKey); window.setTimeout(() => triggerRef.current?.focus(), 0) }
  }, [onClose, triggerRef])
  const forget = async () => {
    setIsForgetting(true)
    setError(undefined)
    try { await onForget(); onClose() } catch (resetError: unknown) { setError(resetError instanceof Error ? resetError.message : 'Verion could not forget this project memory. Try again.'); setIsForgetting(false) }
  }
  return <div className="memory-dialog-layer"><button className="memory-dialog-layer__backdrop" type="button" disabled={isForgetting} aria-label="Cancel forgetting project memory" onClick={onClose} /><section className="memory-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="forget-memory-title" aria-describedby="forget-memory-description"><p className="index-label">Manage local memory</p><h2 id="forget-memory-title">Forget this project memory?</h2><p id="forget-memory-description">Verion will forget this project understanding, remembered journeys, change baseline, review history, issue history, and teammate conversation. Your provider preferences stay separate and are preserved.</p>{error && <p className="memory-dialog__error" role="alert">{error}</p>}<div className="memory-dialog__actions"><button className="text-action" ref={cancelRef} type="button" disabled={isForgetting} onClick={onClose}>Cancel</button><button className="danger-action" type="button" disabled={isForgetting} onClick={() => void forget()}>{isForgetting ? 'Forgetting…' : 'Forget this project memory'}</button></div></section></div>
}

function RepairLaunchDialog({ reportId, triggerRef, onClose, onConfirm }: { reportId: string; triggerRef: React.RefObject<HTMLButtonElement | null>; onClose: () => void; onConfirm: (reportId: string) => Promise<'opened' | 'unavailable' | 'needs_review'> }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const [isLaunching, setIsLaunching] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const isLaunchingRef = useRef(false)
  isLaunchingRef.current = isLaunching
  useEffect(() => {
    const timer = window.setTimeout(() => cancelRef.current?.focus(), 0)
    const dialog = dialogRef.current
    const focusable = () => dialog ? Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled])')).filter((element) => !element.hasAttribute('hidden')) : []
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLaunchingRef.current) { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const targets = focusable()
      if (!targets.length) return
      const first = targets[0]
      const last = targets.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', handleKey); window.setTimeout(() => triggerRef.current?.focus(), 0) }
  }, [onClose, triggerRef])
  const launch = async () => {
    setIsLaunching(true)
    setError(undefined)
    const result = await onConfirm(reportId)
    if (result === 'opened') { onClose(); return }
    setError(result === 'needs_review' ? 'Verion needs a current supported review before it can prepare a repair.' : 'Codex could not open here. Check the local Codex CLI, then try again.')
    setIsLaunching(false)
  }
  return <div className="memory-dialog-layer"><button className="memory-dialog-layer__backdrop" type="button" disabled={isLaunching} aria-label="Cancel opening Codex" onClick={onClose} /><section className="memory-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="repair-launch-title" aria-describedby="repair-launch-description"><p className="index-label">Fix with Codex</p><h2 id="repair-launch-title">Open Codex with this review brief?</h2><p id="repair-launch-description">Verion will create a review brief and open Codex. This step does not modify project files. Review any Codex diff before accepting it, then let Verion verify the saved change again.</p>{error && <p className="memory-dialog__error" role="alert">{error}</p>}<div className="memory-dialog__actions"><button className="text-action" ref={cancelRef} type="button" disabled={isLaunching} onClick={onClose}>Cancel</button><button className="primary-action" type="button" disabled={isLaunching} onClick={() => void launch()}>{isLaunching ? 'Opening Codex…' : 'Open Codex with review brief'}</button></div></section></div>
}

function RepairPrepareDialog({ source, triggerRef, onClose, onPrepare }: { source: RepairSource; triggerRef: React.RefObject<HTMLButtonElement | null>; onClose: () => void; onPrepare: (source: RepairSource) => Promise<RepairProposalView | undefined> }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | undefined>()
  useModalKeyboard(dialogRef, cancelRef, onClose, pending)
  useEffect(() => { return () => { window.setTimeout(() => triggerRef.current?.focus(), 0) } }, [triggerRef])
  const prepare = async () => { setPending(true); setError(undefined); try { await onPrepare(source) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Verion could not prepare this repair.'); setPending(false) } }
  return <div className="memory-dialog-layer"><button className="memory-dialog-layer__backdrop" type="button" disabled={pending} aria-label="Cancel preparing repair" onClick={onClose} /><section className="memory-dialog repair-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="repair-prepare-title" aria-describedby="repair-prepare-description"><p className="index-label">Fix with Verion</p><h2 id="repair-prepare-title">Prepare a repair?</h2><p id="repair-prepare-description">{`Verion may send up to three redacted excerpts from discovered affected files to the selected provider for “${source.title}.” No project file will change while it prepares a proposal.`}</p>{error && <p className="memory-dialog__error" role="alert">{error}</p>}<div className="memory-dialog__actions"><button className="text-action" ref={cancelRef} type="button" disabled={pending} onClick={onClose}>Cancel</button><button className="primary-action" type="button" disabled={pending} onClick={() => void prepare()}>{pending ? 'Preparing repair…' : 'Prepare repair'}</button></div></section></div>
}

function RepairProposalDialog({ proposal, onClose, onApply }: { proposal: RepairProposalView; onClose: () => void; onApply: (proposalId: string) => Promise<RepairProposalView | undefined> }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const [applyOpen, setApplyOpen] = useState(false)
  const active = proposal.status === 'draft'
  useModalKeyboard(dialogRef, cancelRef, onClose, proposal.status === 'applying')
  return <div className="memory-dialog-layer"><button className="memory-dialog-layer__backdrop" type="button" disabled={proposal.status === 'applying'} aria-label="Close proposed repair" onClick={onClose} /><section className="memory-dialog repair-proposal-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="repair-proposal-title"><p className="index-label">Proposed repair</p><h2 id="repair-proposal-title">{proposal.title}</h2><p>{proposal.summary}</p>{proposal.outcome && <p className={proposal.status === 'failed' ? 'memory-dialog__error' : 'repair-proposal__outcome'} role={proposal.status === 'failed' ? 'alert' : 'status'}><strong>{proposal.outcome.label}</strong> {proposal.outcome.description}</p>}<div className="repair-proposal__files"><span>Changed files</span>{proposal.files.map((file) => <section key={file.path}><h3>{file.path}</h3><p>{file.summary}</p><pre aria-label={`Proposed diff for ${file.path}`} tabIndex={0}>{file.diff}</pre></section>)}</div><div className="repair-proposal__plan"><span>Verification plan</span><ol>{proposal.verificationPlan.map((item) => <li key={item}>{item}</li>)}</ol></div><div className="memory-dialog__actions"><button className="text-action" ref={cancelRef} type="button" disabled={proposal.status === 'applying'} onClick={onClose}>{active ? 'Cancel' : 'Close'}</button>{active && <button className="primary-action" type="button" onClick={() => setApplyOpen(true)}>Apply this repair</button>}</div></section>{applyOpen && <RepairApplyDialog proposal={proposal} onClose={() => setApplyOpen(false)} onApply={onApply} />}</div>
}

function RepairApplyDialog({ proposal, onClose, onApply }: { proposal: RepairProposalView; onClose: () => void; onApply: (proposalId: string) => Promise<RepairProposalView | undefined> }) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | undefined>()
  useModalKeyboard(dialogRef, cancelRef, onClose, applying)
  const apply = async () => { setApplying(true); setError(undefined); try { await onApply(proposal.id); onClose() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Verion could not apply this repair.'); setApplying(false) } }
  return <div className="repair-apply-layer"><section className="memory-dialog repair-apply-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="repair-apply-title" aria-describedby="repair-apply-description"><p className="index-label">Apply repair</p><h2 id="repair-apply-title">Apply this repair?</h2><p id="repair-apply-description">Verion will change the listed files, run the relevant discovered local check when available, and review this release again. It will reject stale source and restore a partial write if it can.</p>{error && <p className="memory-dialog__error" role="alert">{error}</p>}<div className="memory-dialog__actions"><button className="text-action" ref={cancelRef} type="button" disabled={applying} onClick={onClose}>Cancel</button><button className="danger-action" type="button" disabled={applying} onClick={() => void apply()}>{applying ? 'Applying repair…' : 'Apply this repair'}</button></div></section></div>
}

function useModalKeyboard(dialogRef: React.RefObject<HTMLElement | null>, initialFocus: React.RefObject<HTMLButtonElement | null>, onClose: () => void, locked: boolean) {
  useEffect(() => {
    const timer = window.setTimeout(() => initialFocus.current?.focus(), 0)
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !locked) { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const dialog = dialogRef.current
      const targets = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled]), [tabindex="0"]')).filter((item) => !item.hasAttribute('hidden')) : []
      if (!targets.length) return
      const first = targets[0]; const last = targets.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', handleKey) }
  }, [dialogRef, initialFocus, locked, onClose])
}

function HistoryModule({ reports }: { reports: MissionReport[] }) { return <section className="supporting-module supporting-module--history" id="history" tabIndex={-1} aria-labelledby="history-title"><ModuleTitle label="Remembered reviews" title="History" id="history-title" /><HistoryList reports={reports} /></section> }

function LatestReview({ report, watching, isVerifying, onVerify, onFixWithCodex }: { report: MissionReport; watching: boolean; isVerifying: boolean; onVerify: () => void; onFixWithCodex: (reportId: string) => Promise<'opened' | 'unavailable' | 'needs_review'> }) {
  const [fixState, setFixState] = useState<'idle' | 'preparing' | 'unavailable' | 'needs_review'>('idle')
  const fix = async () => { setFixState('preparing'); const result = await onFixWithCodex(report.id); if (result !== 'opened') setFixState(result) }
  const fixMessage = watching ? 'Codex has the repair brief. Verion will review the saved repair.' : fixState === 'unavailable' ? 'Codex could not open here. Install the local Codex CLI, then try again.' : fixState === 'needs_review' ? 'Verion needs a current review before it can prepare a repair.' : undefined
  return <article className={`latest-review latest-review--${report.outcome}`}><div className="latest-review__decision"><p>{statusLabel(report.outcome)} · {confidenceLabel(report.confidence)}</p><h3>{report.headline}</h3></div><div className="latest-review__reading"><div><span>What Verion found</span><p>{report.rootCause}</p></div>{report.reasons.length > 0 && <div><span>Why this matters</span><ul>{report.reasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}</ul></div>}<div><span>Next step</span><p>{report.nextAction}</p></div></div>{report.outcome === 'needs_attention' && <div className="codex-action"><button className="text-action" type="button" disabled={fixState === 'preparing'} onClick={() => void fix()}>{fixState === 'preparing' ? 'Preparing Codex…' : 'Fix with Codex'}</button>{fixMessage && <p>{fixMessage}</p>}</div>}{report.outcome === 'inconclusive' && <button className="text-action" type="button" disabled={isVerifying} onClick={onVerify}>{isVerifying ? 'Reviewing…' : 'Verify again'}</button>}</article>
}

function HistoryList({ reports }: { reports: MissionReport[] }) { return reports.length ? <ol className="history-list">{reports.map((report) => <li key={report.id}><span className={`history-list__status history-list__status--${report.outcome}`}>{statusLabel(report.outcome)}</span><strong>{report.headline}</strong><time dateTime={report.completedAt}>{formatDate(report.completedAt)}</time></li>)}</ol> : <p className="empty-reading">The next release decision will begin this local history.</p> }

function ReviewProgress({ review }: { review: MissionReview }) { return <section className="review-progress" aria-labelledby="review-progress-title"><ModuleTitle label="Reviewing the latest change" title="Review progress" id="review-progress-title" /><ol className="review-sequence">{review.steps.map((step) => <li className={`review-sequence__item review-sequence__item--${review.paused && step.state === 'current' ? 'paused' : step.state}`} key={step.title}><span aria-hidden="true">{step.state === 'completed' ? '✓' : step.state === 'paused' ? '!' : ''}</span><div><h3>{humanReviewTitle(step.title)}</h3><p>{step.description}</p></div></li>)}</ol>{review.observations && <ul className="review-observations">{review.observations.map((observation) => <li className={`review-observations__item review-observations__item--${observation.tone}`} key={observation.message}>{observation.message}</li>)}</ul>}</section> }

function SecurityView({ mission, isReviewing, error, onReview, onAsk, onPrepareNative }: { mission: MissionControl; isReviewing: boolean; error?: string; onReview: () => void; onAsk: (question: string) => void; onPrepareNative: (source: RepairSource, trigger: HTMLButtonElement) => void }) {
  const review = mission.deepSecurity
  const critical = mission.securityFindings.filter((finding) => finding.severity === 'critical')
  const high = mission.securityFindings.filter((finding) => finding.severity === 'high')
  const actionLabel = review.canRetry
    ? 'Retry Deep Security Review'
    : review.status === 'completed' || review.status === 'concern'
      ? 'Start Deep Security Review again'
      : 'Start Deep Security Review'
  const isRunning = review.status === 'reviewing' || isReviewing
  const progress = securityReviewProgress(review)
  const currentStation = progress.stations.find((station) => station.state === 'current')
  const scopeStation = progress.stations.find((station) => station.id === 'scope')
  const actionRef = useRef<HTMLButtonElement>(null)
  const previousStatus = useRef(review.status)
  useEffect(() => {
    const failedAfterReview = previousStatus.current === 'reviewing' && review.status === 'failed'
    previousStatus.current = review.status
    if (failedAfterReview) window.setTimeout(() => actionRef.current?.focus(), 0)
  }, [review.status])
  const hasSavedReview = review.status === 'completed' || review.status === 'concern' || review.status === 'partial' || Boolean(review.completedAt)
  const showLaunchSurface = review.status === 'available' && !isRunning && !hasSavedReview
  return <section className="security-view" aria-labelledby="security-title">
    <div className="security-view__heading"><p className="index-label">Release confidence</p><h1 id="security-title" tabIndex={-1}>Security</h1><p>Deep Security Review contributes to the same release decision as the rest of Verion’s review.</p></div>
    {showLaunchSurface
      ? <SecurityReviewLaunch actionRef={actionRef} error={error} onReview={onReview} />
      : <section className={`security-transit security-transit--${progress.state}`} aria-labelledby="security-transit-title">
        <header className="security-transit__heading"><div><p className="index-label">Deep Security Review</p><h2 id="security-transit-title">{review.label}</h2></div><p role="status" aria-live="polite" aria-atomic="true">{progress.currentMessage ?? currentStation?.detail ?? review.description}</p></header>
        <ol className="security-transit__line" aria-label="Deep Security Review stations">
          {progress.stations.map((station) => <li className={`security-transit__station security-transit__station--${station.state}`} key={station.id} aria-current={station.state === 'current' ? 'step' : undefined}>
            <span className="security-transit__marker" aria-hidden="true">{securityStationMarker(station.state)}</span>
            <div><strong>{station.label}</strong><p>{station.detail}</p></div>
          </li>)}
        </ol>
        <dl className="security-transit__facts"><div><dt>Scope</dt><dd>{scopeStation?.state === 'completed' ? scopeStation.detail : 'Local project'}</dd></div><div><dt>Release decision</dt><dd>{mission.currentStatus.label}</dd></div><div><dt>Last reviewed</dt><dd>{review.completedAt ? formatShortDate(review.completedAt) : 'Not yet'}</dd></div></dl>
        <footer className="security-transit__footer">
          {isRunning && <p>Security review in progress. You can leave this page without interrupting it.</p>}
          {error && <p className="security-transit__error" role="alert">{error}</p>}
          {(review.canStart || review.canRetry || review.status === 'failed') && <button className="primary-action" ref={actionRef} type="button" disabled={isRunning} onClick={onReview}>{isRunning ? 'Security review in progress' : actionLabel}</button>}
        </footer>
      </section>}
    {hasSavedReview && <><SecurityFindingQueue severity="critical" findings={critical} onAsk={onAsk} onPrepareNative={onPrepareNative} />
      <SecurityFindingQueue severity="high" findings={high} onAsk={onAsk} onPrepareNative={onPrepareNative} />
      <AffectedCodeLedger findings={mission.securityFindings} /></>}
  </section>
}

const securityReviewAreas = [
  { title: 'Unsafe code paths', detail: 'Reviews eligible source code for injection, unsafe execution, and unsafe HTML paths.' },
  { title: 'Credentials and secrets', detail: 'Checks eligible files for exposed credentials without saving or displaying their values.' },
  { title: 'Dependencies', detail: 'Matches dependency lockfiles against known vulnerability information.' },
  { title: 'Deployment configuration', detail: 'Reviews infrastructure, workflows, containers, and configuration for unsafe defaults.' },
  { title: 'Running local app', detail: 'Reviews the local app Verion can detect without asking you for a port.' }
]

function SecurityReviewLaunch({ actionRef, error, onReview }: { actionRef: React.RefObject<HTMLButtonElement | null>; error?: string; onReview: () => void }) {
  return <section className="security-launch" aria-labelledby="security-launch-title">
    <header><p className="index-label">Deep Security Review</p><h2 id="security-launch-title">Ready when you are</h2><p>Verion will review the code and configuration that matter to shipping, entirely from this local project.</p></header>
    <ul className="security-launch__areas" aria-label="Review areas">
      {securityReviewAreas.map((area) => <li key={area.title}><strong>{area.title}</strong><p>{area.detail}</p></li>)}
    </ul>
    <footer><div><p>Usually a few minutes</p><p>No project files are changed. Runtime environment files, installed dependency folders, public assets, and build output stay outside the review boundary.</p></div>{error && <p className="security-launch__error" role="alert">{error}</p>}<button className="primary-action" ref={actionRef} type="button" onClick={onReview}>Start Deep Security Review</button></footer>
  </section>
}

const securityStationDefinitions: Array<Pick<SecurityReviewProgress['stations'][number], 'id' | 'label'>> = [
  { id: 'scope', label: 'Scope sealed' },
  { id: 'code', label: 'Code paths' },
  { id: 'credentials', label: 'Credentials' },
  { id: 'dependencies', label: 'Dependencies' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'running_experience', label: 'Running experience' },
  { id: 'decision', label: 'Release decision' }
]

function securityReviewProgress(review: DeepSecurity): SecurityReviewProgress {
  if (review.progress?.stations?.length) return review.progress
  const terminalState = review.status === 'completed' || review.status === 'concern' ? 'completed' : review.status === 'partial' ? 'skipped' : undefined
  return {
    state: review.status === 'available' ? 'ready' : review.status === 'reviewing' ? 'reviewing' : review.status === 'concern' ? 'concern' : review.status === 'partial' ? 'partial' : review.status === 'failed' ? 'failed' : 'completed',
    currentMessage: review.status === 'reviewing' ? review.description : undefined,
    stations: securityStationDefinitions.map((station, index) => ({
      ...station,
      state: review.status === 'failed' ? (index === 0 ? 'failed' : 'pending') : terminalState ?? (review.status === 'reviewing' && index === 0 ? 'current' : 'pending'),
      detail: review.status === 'available'
        ? 'Starts when you begin this review.'
        : review.status === 'reviewing' && index === 0
          ? review.description
          : review.status === 'failed' && index === 0
            ? review.description
            : terminalState
              ? 'Completed in the saved review.'
              : 'Waiting for this review to begin.'
    }))
  }
}

function securityStationMarker(state: SecurityReviewStationState) {
  return state === 'completed' ? '✓' : state === 'current' ? '•' : state === 'skipped' ? '–' : state === 'failed' ? '!' : ''
}

function AffectedCodeLedger({ findings }: { findings: SecurityFinding[] }) {
  const locations = [...new Map(findings.filter((finding) => finding.file).map((finding) => [finding.file!, { file: finding.file!, startLine: finding.startLine, endLine: finding.endLine, headline: finding.headline }])).values()]
  return <section className="affected-code-ledger" id="affected-code" tabIndex={-1} aria-labelledby="affected-code-title"><header><div><p className="index-label">Review locations</p><h2 id="affected-code-title">Affected code</h2></div><span>{locations.length}</span></header>{locations.length ? <ul>{locations.map((location) => <li key={location.file}><code>{location.file}{location.startLine ? `:${location.startLine}${location.endLine && location.endLine !== location.startLine ? `–${location.endLine}` : ''}` : ''}</code><p>{location.headline}</p></li>)}</ul> : <p>No affected code location is recorded yet. Verion will add one only when the review can safely connect a concern to an application file.</p>}</section>
}

function SecurityFindingQueue({ severity, findings, onAsk, onPrepareNative }: { severity: SecurityFinding['severity']; findings: SecurityFinding[]; onAsk: (question: string) => void; onPrepareNative: (source: RepairSource, trigger: HTMLButtonElement) => void }) {
  const title = severity === 'critical' ? 'Critical concerns' : 'High concerns'
  const description = severity === 'critical'
    ? 'No critical concern is recorded in the current local security memory. This is not a guarantee that the application is secure.'
    : 'No high concern is recorded in the current local security memory. This is not a guarantee that the application is secure.'
  return <section className="security-queue" id={toId(title)} tabIndex={-1} aria-labelledby={`${toId(title)}-title`}><header><div><p className="index-label">{severity === 'critical' ? 'Release blockers' : 'Important follow-up'}</p><h2 id={`${toId(title)}-title`}>{title}</h2></div><span className={`security-queue__count security-queue__count--${severity}`}>{findings.length}</span></header>{findings.length ? <ol className="security-findings">{findings.map((finding) => <SecurityFindingRecord key={finding.id} finding={finding} onAsk={onAsk} onPrepareNative={onPrepareNative} />)}</ol> : <p className="security-queue__empty">{description}</p>}</section>
}

function SecurityFindingRecord({ finding, onAsk, onPrepareNative }: { finding: SecurityFinding; onAsk: (question: string) => void; onPrepareNative: (source: RepairSource, trigger: HTMLButtonElement) => void }) {
  const location = finding.file ? `${finding.file}${finding.startLine ? `:${finding.startLine}${finding.endLine && finding.endLine !== finding.startLine ? `–${finding.endLine}` : ''}` : ''}` : undefined
  return <li className={`security-finding security-finding--${finding.severity}`} id={`security-finding-${finding.id}`} tabIndex={-1}>
    <div className="security-finding__label"><span className={`severity-chip severity-chip--${finding.severity}`}>{finding.severity === 'critical' ? 'Critical' : 'High'}</span>{finding.affectedArea && <span>{finding.affectedArea}</span>}</div>
    <div className="security-finding__reading"><h3>{finding.headline}</h3><p>{finding.explanation}</p>{location && <p className="security-finding__location"><span>Affected code</span><code>{location}</code></p>}<div className="security-finding__evidence"><span>Evidence</span><p>{finding.evidence}</p></div><div className="security-finding__action"><span>Suggested action</span><p>{finding.suggestedAction}</p></div></div>
    <div className="security-finding__controls"><CopyFixPrompt source={{ source: 'security_finding', id: finding.id, title: finding.headline }} /><button className="text-action" type="button" onClick={() => onAsk(`Explain the security finding “${finding.headline}” and why it affects this release.`)}>Ask Verion</button>{finding.nativeFixAvailable && <button className="text-action" type="button" onClick={(event) => onPrepareNative({ source: 'security_finding', id: finding.id, title: finding.headline }, event.currentTarget)}>Fix with Verion</button>}</div>
  </li>
}

function CopyFixPrompt({ source }: { source: RepairSource }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [fallback, setFallback] = useState<string | undefined>()
  const copy = async () => {
    try {
      const data = await requestJson<{ prompt: string }>('/api/repair-brief', { method: 'POST', body: JSON.stringify({ source: source.source, id: source.id }) })
      try { await navigator.clipboard.writeText(data.prompt); setState('copied'); setFallback(undefined); window.setTimeout(() => setState('idle'), 2_500) } catch { setState('failed'); setFallback(data.prompt) }
    } catch { setState('failed') }
  }
  return <div className="copy-fix-prompt"><button className="text-action" type="button" onClick={() => void copy()}>{state === 'copied' ? 'Fix prompt copied' : 'Copy Fix Prompt'}</button>{state === 'failed' && (fallback ? <div><p role="status">Select this prompt and try copying again.</p><textarea readOnly aria-label={`Fix prompt for ${source.title}`} value={fallback} rows={6} /><button className="text-action" type="button" onClick={() => void copy()}>Try copy again</button></div> : <p role="status">Verion could not prepare this prompt. Refresh the current review and try again.</p>)}</div>
}

function TeammatePanel({ route, securityFindings = [], conversation, state, aiStatus, error, retryQuestion, pendingSourceQuestion, onAsk, onUseCodeContext, onAnswerWithoutCode, onRetry, onClear, onCitation }: { route: Route; securityFindings?: SecurityFinding[]; conversation?: AssistantConversation; state: AssistantState; aiStatus?: AIStatus; error?: string; retryQuestion?: string; pendingSourceQuestion?: string; onAsk: (question: string) => void; onUseCodeContext: () => void; onAnswerWithoutCode: () => void; onRetry: () => void; onClear: () => void; onCitation: (citation: AssistantCitation) => void }) {
  const [draft, setDraft] = useState('')
  const starters = route === 'security'
    ? securityFindings.length ? [`Explain “${securityFindings[0].headline}”.`, `Why does “${securityFindings[0].headline}” affect shipping?`, 'Prepare this concern for Codex.'] : ['What did Deep Security Review cover?', 'Why shouldn’t I ship this?', 'What would block shipping?']
    : ['What changed since my last review?', 'What parts of the app are affected?', 'Which files are causing this?']
  const sending = state === 'responding'
  const send = (question = draft) => { if (!question.trim() || sending) return; setDraft(''); onAsk(question) }
  return <section className="teammate-panel"><header className="teammate-panel__header"><div><p className="index-label">Local project teammate</p><h2>Verion teammate</h2></div><div><span className="model-chip">{assistantContextLabel(aiStatus)}</span>{conversation?.messages.length ? <button className="clear-action" type="button" onClick={onClear}>Clear conversation</button> : null}</div></header><p className="teammate-panel__context">{route === 'security' ? 'Security context is active.' : 'I know this local project and its current release context.'}</p><div className="teammate-panel__messages" aria-label="Conversation">{!conversation?.messages.length && state !== 'loading' && <div className="teammate-empty"><p>Ask about this project without explaining it again.</p><div>{starters.map((prompt) => <button key={prompt} className="starter-prompt" type="button" disabled={sending} onClick={() => send(prompt)}>{prompt}</button>)}</div></div>}{conversation?.messages.map((message) => <article className={`assistant-message assistant-message--${message.role}`} key={message.id}><p className="assistant-message__role">{message.role === 'developer' ? 'You' : 'Verion'}</p>{message.role === 'verion' && message.basis && <p className="assistant-message__basis">{basisLabel(message.basis)}</p>}<p>{message.content}</p>{message.uncertainty && <p className="assistant-message__uncertainty">{message.uncertainty}</p>}{message.citations.length > 0 && <div className="citation-list">{message.citations.map((citation) => <button className="citation-chip" type="button" key={citation.id} onClick={() => onCitation(citation)}>{citation.label}</button>)}</div>}</article>)}{sending && <p className="assistant-thinking" role="status" aria-live="polite">Preparing a grounded answer.</p>}{state === 'loading' && <p className="assistant-thinking" role="status" aria-live="polite">Loading this local conversation…</p>}{state === 'unavailable' && <p className="assistant-error" role="alert">{error ?? 'The teammate is unavailable. Local project context remains available.'}</p>}{state === 'interrupted' && <div className="assistant-error" role="alert"><p><strong>Interrupted.</strong> {error ?? 'The teammate could not finish that answer.'}</p>{retryQuestion && <button className="text-action" type="button" onClick={onRetry}>Retry question</button>}</div>}</div>{pendingSourceQuestion && <section className="source-consent-rail" aria-labelledby="source-consent-title"><h3 id="source-consent-title">Use local code context for this answer?</h3><p>Verion can use up to three redacted excerpts from discovered project files and send them only to the selected provider for this question. No project files will change.</p><div><button className="primary-action" type="button" disabled={sending} onClick={onUseCodeContext}>Use code context</button><button className="text-action" type="button" disabled={sending} onClick={onAnswerWithoutCode}>Answer without code</button></div>{error && state === 'interrupted' && <p className="assistant-error" role="alert">{error}</p>}</section>}<form className="teammate-composer" onSubmit={(event) => { event.preventDefault(); send() }}><label className="sr-only" htmlFor="ask-verion">Ask Verion</label><textarea id="ask-verion" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() } }} placeholder="Ask Verion" rows={2} disabled={sending} /><button className="primary-action" type="submit" disabled={!draft.trim() || sending}>Ask Verion</button></form></section>
}

function LaunchNotice({ unavailable }: { unavailable: boolean }) { return <section className="launch-notice"><p className="index-label">Local project teammate</p><h1>Start where the code lives.</h1><p>Open a terminal in the project root and run <code>verion</code>. Verion will learn that application, remember it locally, and open its project view.</p>{unavailable && <p className="inline-error">When Verion is running, refresh this page to reconnect.</p>}</section> }
function LearningLedger({ mission, learning, onRetry }: { mission?: MissionControl; learning?: ProjectLearning; onRetry?: () => void }) {
  const status = learning?.state ?? (mission ? 'settled' : 'starting')
  const facts = learning?.facts?.slice(0, 5) ?? (mission ? discoveredLearningFacts(mission) : [])
  const isLive = status === 'starting' || status === 'learning'
  const isFailed = status === 'failed'
  const conclusion = mission ? thesisFor(mission.project.understanding) : undefined
  return <section className="learning-ledger" aria-labelledby="learning-ledger-title">
    <header><p className="index-label">Verion</p><h1 id="learning-ledger-title">{isLive ? 'Learning this project' : isFailed ? 'Project learning needs attention' : 'Project Understanding'}</h1><p>{isFailed ? learning?.message ?? 'Verion could not finish learning this project.' : isLive ? learning?.message ?? 'Looking at the local application structure.' : 'Verion has saved this local project brief.'}</p></header>
    <div className="learning-ledger__rows" aria-live="polite" aria-relevant="additions text">
      {facts.map((fact) => <div className={`learning-ledger__row learning-ledger__row--${fact.state ?? 'arrived'}`} key={fact.id}><span aria-hidden="true">{fact.state === 'unavailable' ? '!' : fact.state === 'pending' ? '·' : '✓'}</span><div><strong>{fact.label}</strong>{fact.detail && <p>{fact.detail}</p>}</div></div>)}
    </div>
    {conclusion && !isLive && !isFailed && <p className="learning-ledger__conclusion">{conclusion}</p>}
    {isFailed && onRetry && <button className="primary-action" type="button" onClick={onRetry}>Try learning again</button>}
  </section>
}

function AISetupSheet({ triggerRef, currentStatus, onClose, onRefresh, onValidate, onSave }: {
  triggerRef: React.RefObject<HTMLButtonElement | null>
  currentStatus?: AIStatus
  onClose: () => void
  onRefresh: () => Promise<void>
  onValidate: () => Promise<AIStatus | undefined>
  onSave: (setup: AISetupRequest) => Promise<AIStatus | undefined>
}) {
  const [mode, setMode] = useState<'local' | 'byom'>('local')
  const [provider, setProvider] = useState<AISetupRequest['provider']>('openai_compatible')
  const [model, setModel] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [credentialMethod, setCredentialMethod] = useState<AISetupRequest['credentialMethod']>('environment')
  const [credentialReference, setCredentialReference] = useState('')
  const [projectEnvConfirmed, setProjectEnvConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<string | undefined>()
  const [error, setError] = useState<string | undefined>()
  const sheetRef = useRef<HTMLElement>(null)
  const keyInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const selected = currentStatus?.provider
    if (!selected) return
    if (selected.kind === 'ollama') {
      setMode('local')
      setCredentialMethod('none')
    } else if (selected.kind === 'openai_compatible' || selected.kind === 'gemini' || selected.kind === 'openrouter') {
      setMode('byom')
      setProvider(selected.kind)
      setCredentialMethod('environment')
    }
    setModel(selected.model === 'No model selected' ? '' : selected.model)
  }, [currentStatus?.provider?.id, currentStatus?.provider?.kind, currentStatus?.provider?.model])

  useEffect(() => {
    const timer = window.setTimeout(() => sheetRef.current?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])')?.focus(), 0)
    const focusable = () => sheetRef.current ? Array.from(sheetRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [href]')).filter((element) => !element.hasAttribute('hidden')) : []
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab') return
      const targets = focusable()
      if (!targets.length) return
      const first = targets[0]
      const last = targets.at(-1)!
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => { window.clearTimeout(timer); document.removeEventListener('keydown', handleKey); window.setTimeout(() => triggerRef.current?.focus(), 0) }
  }, [isSubmitting, onClose, triggerRef])

  const usingKeyInput = mode === 'byom' && credentialMethod === 'project_env'
  const selectedProvider = mode === 'local' ? 'ollama' : provider
  const setupRequest = (): AISetupRequest => ({
    provider: selectedProvider,
    model: model.trim(),
    ...((mode === 'local' || selectedProvider === 'openai_compatible') && endpoint.trim() ? { endpoint: endpoint.trim() } : {}),
    credentialMethod: mode === 'local' ? 'none' : credentialMethod,
    ...(mode === 'byom' && credentialMethod === 'environment' && credentialReference.trim() ? { credentialReference: credentialReference.trim() } : {}),
    ...(usingKeyInput && keyInputRef.current?.value.trim() ? { apiKey: keyInputRef.current.value.trim() } : {})
  })
  const submit = async (action: 'validate' | 'save') => {
    setError(undefined)
    setResult(undefined)
    if (mode === 'byom' && credentialMethod === 'project_env' && !projectEnvConfirmed) {
      setError('Confirm the local .env fallback before saving a key there.')
      return
    }
    setIsSubmitting(true)
    try {
      const request = action === 'save' ? setupRequest() : undefined
      if (request && keyInputRef.current) keyInputRef.current.value = ''
      const status = action === 'validate' ? await onValidate() : await onSave(request!)
      setResult(status?.available ? 'Connected for explanations and review reasoning.' : status?.message ?? (action === 'validate' ? 'Validation finished. Review the local connection state above.' : 'AI setup saved locally.'))
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'Verion could not update AI setup locally.')
    } finally { setIsSubmitting(false) }
  }

  const refresh = async () => {
    setError(undefined)
    setResult(undefined)
    try { await onRefresh(); setResult('Connection status refreshed.') } catch (requestError: unknown) { setError(requestError instanceof Error ? requestError.message : 'Verion could not refresh AI setup.') }
  }

  return <div className="ai-setup-layer"><button className="ai-setup-layer__backdrop" type="button" disabled={isSubmitting} aria-label="Close AI setup" onClick={onClose} /><section className="ai-setup-sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="ai-setup-title" aria-describedby="ai-setup-description">
    <header className="ai-setup-sheet__header"><div><p className="index-label">Local reasoning</p><h2 id="ai-setup-title">AI setup</h2><p id="ai-setup-description">Project learning and local review work without a model. Connect one only for deeper explanations and review reasoning.</p></div><button className="text-action" type="button" disabled={isSubmitting} onClick={onClose}>Done</button></header>
    <section className="ai-setup-status" aria-label="Current AI setup"><span>{aiSetupLabel(currentStatus)}</span><p>{currentStatus?.message ?? (currentStatus?.available ? 'Connected for explanations and review reasoning.' : 'No model is required for local project review.')}</p>{currentStatus?.provider && <CapabilityList capabilities={currentStatus.provider.capabilities} />}<button className="text-action" type="button" disabled={isSubmitting} onClick={() => void refresh()}>Refresh status</button></section>
    <form className="ai-setup-form" onSubmit={(event) => { event.preventDefault(); void submit('save') }}>
      <fieldset><legend>Choose how Verion reasons</legend><div className="ai-mode-grid"><button className={mode === 'local' ? 'ai-mode ai-mode--selected' : 'ai-mode'} type="button" aria-pressed={mode === 'local'} disabled={isSubmitting} onClick={() => setMode('local')}><strong>Local and free</strong><span>Use an Ollama-compatible local model. No API key.</span></button><button className={mode === 'byom' ? 'ai-mode ai-mode--selected' : 'ai-mode'} type="button" aria-pressed={mode === 'byom'} disabled={isSubmitting} onClick={() => setMode('byom')}><strong>Bring your own key</strong><span>Connect a provider account that you control.</span></button></div><p className="ai-unavailable"><strong>Verion AI</strong> is not available in this build.</p></fieldset>
      {mode === 'byom' && <label className="ai-field">Provider<select value={provider} disabled={isSubmitting} onChange={(event) => setProvider(event.target.value as AISetupRequest['provider'])}><option value="openai_compatible">OpenAI-compatible</option><option value="gemini">Gemini</option><option value="openrouter">OpenRouter</option></select></label>}
      <label className="ai-field">Model identifier<input value={model} disabled={isSubmitting} onChange={(event) => setModel(event.target.value)} placeholder={mode === 'local' ? 'Your local model name' : 'Model available to your account'} autoComplete="off" /></label>
      {mode === 'byom' && <label className="ai-field">Credential method<select value={credentialMethod} disabled={isSubmitting} onChange={(event) => setCredentialMethod(event.target.value as AISetupRequest['credentialMethod'])}><option value="environment">Existing environment variable</option><option value="project_env">Project .env fallback</option></select><span>Operating-system credential storage is not available in this build.</span></label>}
      {mode === 'byom' && credentialMethod === 'environment' && <label className="ai-field">Environment variable name<input value={credentialReference} disabled={isSubmitting} onChange={(event) => setCredentialReference(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} placeholder={environmentHint(provider)} autoCapitalize="characters" autoComplete="off" /><span>Verion reads the value locally and never displays it here.</span></label>}
      {usingKeyInput && <label className="ai-field">API key<input ref={keyInputRef} type="password" disabled={isSubmitting} placeholder="Paste once to store locally" autoComplete="new-password" /><span>Saved to this project’s .env only after your confirmation; never in .verion or browser storage.</span></label>}
      {mode === 'byom' && credentialMethod === 'project_env' && <label className="ai-confirm"><input type="checkbox" checked={projectEnvConfirmed} disabled={isSubmitting} onChange={(event) => setProjectEnvConfirmed(event.target.checked)} />I understand this writes a local .env entry and should remain uncommitted.</label>}
      {(mode === 'local' || selectedProvider === 'openai_compatible') && <details className="ai-advanced"><summary>Advanced connection</summary><label className="ai-field">Endpoint<input value={endpoint} disabled={isSubmitting} onChange={(event) => setEndpoint(event.target.value)} placeholder={mode === 'local' ? 'http://127.0.0.1:11434/v1' : 'https://provider.example/v1'} autoComplete="url" /></label></details>}
      {provider === 'openrouter' && mode === 'byom' && <p className="ai-provider-note">For an OpenRouter free model, enter a model identifier that your account currently exposes. Verion does not maintain a hard-coded free-model catalogue.</p>}
      {error && <p className="ai-setup-error" role="alert">{error}</p>}{result && <p className="ai-setup-result" role="status" aria-live="polite">{result}</p>}
      <footer><button className="text-action" type="button" disabled={isSubmitting} onClick={() => void submit('validate')}>{isSubmitting ? 'Working…' : 'Validate locally'}</button><button className="primary-action" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save setup'}</button></footer>
    </form>
  </section></div>
}

function CapabilityList({ capabilities }: { capabilities: NonNullable<AIStatus['provider']>['capabilities'] }) {
  const items = [
    { label: 'Explains reviews', available: capabilities.structuredOutput },
    { label: 'Understands larger context', available: capabilities.largeContext },
    { label: 'Prepares repair proposals', available: capabilities.codeGeneration && capabilities.codeEditing }
  ]
  return <ul className="ai-capabilities" aria-label="Selected model capabilities">{items.map((item) => <li className={item.available ? 'ai-capabilities__item--available' : undefined} key={item.label}><span aria-hidden="true">{item.available ? '✓' : '–'}</span>{item.label}{!item.available && <small>Not available</small>}</li>)}</ul>
}

function TechnologyMark({ technology }: { technology: Technology }) { const icon = technologyIcon(technology.id); return icon ? <svg className="technology-mark" viewBox="0 0 24 24" fill={`#${icon.hex}`} aria-hidden="true"><path d={icon.path} /></svg> : <span className="technology-mark technology-mark--fallback" aria-hidden="true">{technology.label.slice(0, 1)}</span> }
function technologyIcon(id: string): SimpleIcon | undefined { return ({ nextjs: siNextdotjs, react: siReact, vite: siVite, typescript: siTypescript, clerk: siClerk, stripe: siStripe, postgresql: siPostgresql, prisma: siPrisma } as Record<string, SimpleIcon>)[id] }
function thesisFor(understanding: MissionControl['project']['understanding']) { return understanding.model?.thesis ?? understanding.summary }
function fallbackReviewFocus(understanding: MissionControl['project']['understanding']) { const paths = understanding.criticalBusinessFlows.length ? understanding.criticalBusinessFlows : understanding.userJourneys; return paths.length ? `Pay closest attention to ${joinWords(paths.slice(0, 3).map((item) => item.label.toLowerCase()))}.` : 'Pay closest attention to the paths people use most often.' }
function humanReviewTitle(title: string) { return ({ 'Understanding this project': 'Project understanding refreshed', 'Reviewing what changed': 'Latest change understood', 'Checking the product': 'Product paths reviewed', 'Making a release decision': 'Release recommendation' } as Record<string, string>)[title] ?? title }
function joinWords(items: string[]) { if (items.length <= 1) return items[0] ?? ''; if (items.length === 2) return `${items[0]} and ${items[1]}`; return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}` }
function impactStateLabel(change: CurrentChange) { if (change.state === 'baseline_not_established') return 'Context only'; if (change.state === 'no_change') return 'No new impact'; if (change.state === 'reviewing_change') return 'Reviewing impact'; return change.likelyImpact.length ? 'Areas to review' : 'No specific area yet' }
function impactEmptyCopy(state: CurrentChange['state']) { if (state === 'baseline_not_established') return 'Impact is learned from the project context. The first review will establish the comparison point.'; if (state === 'no_change') return 'No new impact to review since the last completed review.'; if (state === 'reviewing_change') return 'Verion is carrying the available project context through this review.'; return 'Verion has not mapped this change to a specific product area yet.' }
function statusLabel(status: MissionReport['outcome']) { return status === 'ready_to_ship' ? 'Ready to ship' : status === 'needs_attention' ? 'Needs attention' : 'Inconclusive' }
function confidenceLabel(confidence: MissionReport['confidence']) { return confidence === 'high' ? 'High confidence' : confidence === 'moderate' ? 'Moderate confidence' : 'Limited confidence' }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? 'recently' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date) }
function formatShortDate(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? 'Today' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date) }
function displayProjectName(value: string) { const normalized = value.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim(); return normalized.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()) || 'This project' }
function routeFromHash(): Route { return window.location.hash === '#/security' ? 'security' : 'home' }
function hashRoute(hash: string): Route { return hash === '#/security' ? 'security' : 'home' }
function discoveredLearningFacts(mission: MissionControl): LearningFact[] {
  const understanding = mission.project.understanding
  const facts: LearningFact[] = []
  const framework = understanding.framework ?? understanding.technologies.find((technology) => technology.kind === 'framework')?.label
  if (framework) facts.push({ id: 'framework', label: framework, detail: 'Framework detected' })
  if (understanding.database) facts.push({ id: 'database', label: understanding.database, detail: 'Data layer detected' })
  if (understanding.authentication) facts.push({ id: 'authentication', label: understanding.authentication, detail: 'Authentication detected' })
  if (understanding.payments) facts.push({ id: 'payments', label: understanding.payments, detail: 'Billing detected' })
  if (understanding.productAreas.length) facts.push({ id: 'areas', label: joinWords(understanding.productAreas.slice(0, 3)), detail: 'Product areas mapped' })
  return facts
}
function aiSetupLabel(status?: AIStatus): string { return status?.available ? 'AI ready' : status?.configured ? 'AI needs attention' : 'Local review active' }
function assistantContextLabel(status?: AIStatus): string { return status?.available ? 'AI ready' : 'Local review' }
function environmentHint(provider: AISetupRequest['provider']) { return provider === 'gemini' ? 'VERION_GEMINI_API_KEY' : provider === 'openrouter' ? 'VERION_OPENROUTER_API_KEY' : 'VERION_OPENAI_COMPATIBLE_API_KEY' }
function basisLabel(basis: NonNullable<AssistantMessage['basis']>) { return basis === 'discovered_fact' ? 'Discovered fact' : basis === 'review_observation' ? 'Review observation' : 'Model inference' }
function toId(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '-') }
function focusCitation(citation: AssistantCitation, navigate: (route: Route) => void) { if (citation.kind === 'security_finding') { navigate('security'); window.setTimeout(() => document.getElementById(citation.sourceId ? `security-finding-${citation.sourceId}` : 'security-title')?.focus(), 0); return } const target = citation.kind === 'project_understanding' ? 'project-understanding' : citation.kind === 'project_memory' ? 'local-memory' : 'release-ledger'; if (window.location.hash !== '#/home') navigate('home'); window.setTimeout(() => document.getElementById(target)?.focus(), 0) }
async function requestJson<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...init }); const body = await response.text(); let data: (T & { error?: string }) | undefined; try { data = body ? JSON.parse(body) as T & { error?: string } : undefined } catch { throw new Error('The local response was not valid.') } if (!response.ok) throw new Error(data?.error ?? 'The local service is unavailable.'); if (!data) throw new Error('The local service returned an empty response.'); return data }
