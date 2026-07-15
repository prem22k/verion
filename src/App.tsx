import { FormEvent, useEffect, useState } from 'react'

type ProjectRoute = { path: string; file: string }

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
  capsule: {
    relevantFiles: Array<{ path: string; reason: string; excerpt: string }>
  }
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
type GptDiagnosisStatus = { configured: boolean; model: string; message?: string }

const initialStatus: Status = { tone: 'quiet', message: 'Connect a local project to begin.' }

export function App() {
  const [connection, setConnection] = useState<Connection | undefined>()
  const [projectPath, setProjectPath] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [watchChanges, setWatchChanges] = useState(true)
  const [result, setResult] = useState<VerificationResult | undefined>()
  const [status, setStatus] = useState<Status>(initialStatus)
  const [error, setError] = useState<string | undefined>()
  const [notice, setNotice] = useState<string | undefined>()
  const [isVerifying, setIsVerifying] = useState(false)
  const [gptDiagnosis, setGptDiagnosis] = useState<GptDiagnosisStatus | undefined>()

  useEffect(() => {
    void loadConnection()
    const events = new EventSource('/api/events')
    events.onmessage = (message) => {
      const event = JSON.parse(message.data) as AgentEvent
      if (event.type === 'connected') {
        setConnection(event.connection)
        setProjectPath(event.connection.projectPath)
        setTargetUrl(event.connection.targetUrl ?? '')
        setWatchChanges(event.connection.watchChanges)
        setStatus({ tone: 'quiet', message: event.connection.watchChanges ? 'Watching approved project changes.' : 'Project connected. Watching is off.' })
      }
      if (event.type === 'disconnected') {
        setConnection(undefined)
        setResult(undefined)
        setStatus(initialStatus)
      }
      if (event.type === 'change_detected') {
        setStatus({ tone: 'working', message: `Change observed in ${event.path}. Verification starts shortly.` })
      }
      if (event.type === 'verification_started') {
        setIsVerifying(true)
        setStatus({ tone: 'working', message: event.trigger === 'change' ? 'Verifying the observed update.' : 'Collecting verification evidence.' })
        setError(undefined)
      }
      if (event.type === 'verification_completed') {
        setIsVerifying(false)
        setResult(event.result)
        setStatus({ tone: event.result.report?.recommendation === 'needs_attention' ? 'danger' : 'quiet', message: event.result.report ? 'Verification report updated.' : 'Evidence is ready. GPT diagnosis needs configuration.' })
      }
      if (event.type === 'attention_required') {
        setNotice(event.report.headline)
      }
      if (event.type === 'watcher_error') {
        setIsVerifying(false)
        setStatus({ tone: 'warning', message: event.message })
      }
    }
    events.onerror = () => setStatus({ tone: 'warning', message: 'Local agent connection was interrupted. Refresh to retry.' })
    return () => events.close()
  }, [])

  async function loadConnection() {
    try {
      const [data, agent] = await Promise.all([
        requestJson<{ connection?: Connection }>('/api/connection'),
        requestJson<{ gptDiagnosis: GptDiagnosisStatus }>('/api/status')
      ])
      setGptDiagnosis(agent.gptDiagnosis)
      if (!agent.gptDiagnosis.configured) setStatus({ tone: 'warning', message: agent.gptDiagnosis.message ?? 'GPT diagnosis needs configuration.' })
      if (!data.connection) return
      setConnection(data.connection)
      setProjectPath(data.connection.projectPath)
      setTargetUrl(data.connection.targetUrl ?? '')
      setWatchChanges(data.connection.watchChanges)
      setStatus(agent.gptDiagnosis.configured
        ? { tone: 'quiet', message: data.connection.watchChanges ? 'Watching approved project changes.' : 'Project connected. Watching is off.' }
        : { tone: 'warning', message: agent.gptDiagnosis.message ?? 'GPT diagnosis needs configuration.' })
    } catch {
      setStatus({ tone: 'warning', message: 'Local agent is unavailable. Start Verion with npm run dev:verion.' })
    }
  }

  async function connectProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(undefined)
    setStatus({ tone: 'working', message: 'Understanding the local project.' })
    try {
      const data = await requestJson<{ connection: Connection }>('/api/projects/connect', {
        method: 'POST',
        body: JSON.stringify({ projectPath, targetUrl: targetUrl || undefined, watchChanges })
      })
      setConnection(data.connection)
      setResult(undefined)
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : 'Project connection could not complete.'
      setError(message)
      setStatus({ tone: 'danger', message: 'Project connection needs attention.' })
    }
  }

  async function verifyNow() {
    if (isVerifying) return
    setIsVerifying(true)
    setError(undefined)
    setStatus({ tone: 'working', message: 'Collecting verification evidence.' })
    try {
      const nextResult = await requestJson<VerificationResult>('/api/verify', { method: 'POST' })
      setResult(nextResult)
      setStatus({ tone: nextResult.report?.recommendation === 'needs_attention' ? 'danger' : 'quiet', message: nextResult.report ? 'Verification report updated.' : 'Evidence is ready. GPT diagnosis needs configuration.' })
    } catch (reason: unknown) {
      const message = reason instanceof Error ? reason.message : 'Verification could not complete.'
      setError(message)
      setStatus({ tone: 'danger', message: 'Verification did not complete.' })
    } finally {
      setIsVerifying(false)
    }
  }

  async function changeProject() {
    try {
      await requestJson<{ connection: null }>('/api/projects/disconnect', { method: 'POST' })
    } catch {
      setConnection(undefined)
      setResult(undefined)
      setError(undefined)
      setStatus(initialStatus)
    }
  }

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="Verion home"><span className="brand-mark">V</span><span>verion</span></a>
      <p>Local verification layer</p>
      <span className={`agent-state agent-state--${status.tone}`}><i /> {connection ? 'Local agent connected' : 'Local agent waiting'}</span>
    </header>

    <section className="intro" id="top">
      <div>
        <p className="section-label">Release confidence</p>
        <h1>{connection ? 'Your project has a careful observer.' : 'Connect the software you want to trust.'}</h1>
      </div>
      <p className="intro-copy">Verion reads approved local context, observes the running product, and returns one evidence-backed release decision.</p>
    </section>

    <div className="agent-status" aria-live="polite"><span className={`status-marker status-marker--${status.tone}`} />{status.message}</div>

    {notice && <aside className="attention-notice" role="alert"><div><strong>Release attention required</strong><p>{notice}</p></div><button type="button" onClick={() => setNotice(undefined)} aria-label="Dismiss notification">×</button></aside>}

    {!connection ? <ConnectionForm
      projectPath={projectPath}
      targetUrl={targetUrl}
      watchChanges={watchChanges}
      error={error}
      onProjectPathChange={setProjectPath}
      onTargetUrlChange={setTargetUrl}
      onWatchChangesChange={setWatchChanges}
      onSubmit={connectProject}
    /> : <>
      <ConnectionSummary connection={connection} gptDiagnosis={gptDiagnosis} isVerifying={isVerifying} onVerify={verifyNow} onChangeProject={() => void changeProject()} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <Report result={result} />
    </>}
  </main>
}

function ConnectionForm({ projectPath, targetUrl, watchChanges, error, onProjectPathChange, onTargetUrlChange, onWatchChangesChange, onSubmit }: {
  projectPath: string
  targetUrl: string
  watchChanges: boolean
  error?: string
  onProjectPathChange: (value: string) => void
  onTargetUrlChange: (value: string) => void
  onWatchChangesChange: (value: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return <section className="workspace connection-workspace" aria-labelledby="connection-title">
    <div className="evidence-rail" aria-hidden="true"><span>Connect</span><i /><span>Observe</span><i /><span>Decide</span></div>
    <form className="connection-form" onSubmit={onSubmit} noValidate>
      <div className="form-heading"><p className="section-label">Project scope</p><h2 id="connection-title">Start with the local project.</h2><p>Verion only reads the directory and visits the URL you approve here.</p></div>
      <label>Project directory<input value={projectPath} onChange={(event) => onProjectPathChange(event.target.value)} placeholder="~/projects/app" required aria-invalid={Boolean(error)} aria-describedby="project-path-help connection-error" /><small id="project-path-help">Use the full local path or `~/…`. The browser cannot choose a folder for the local agent.</small></label>
      <label>Running app URL <span>optional</span><input type="url" value={targetUrl} onChange={(event) => onTargetUrlChange(event.target.value)} placeholder="http://127.0.0.1:3000" /></label>
      <label className="watch-option"><input type="checkbox" checked={watchChanges} onChange={(event) => onWatchChangesChange(event.target.checked)} /><span><strong>Watch this project</strong><small>After a short pause, Verion verifies observed source changes in the background.</small></span></label>
      {error && <p className="form-error" id="connection-error" role="alert">{error}</p>}
      <button className="button button--primary" type="submit">Connect project <span>→</span></button>
    </form>
  </section>
}

function ConnectionSummary({ connection, gptDiagnosis, isVerifying, onVerify, onChangeProject }: { connection: Connection; gptDiagnosis?: GptDiagnosisStatus; isVerifying: boolean; onVerify: () => void; onChangeProject: () => void }) {
  const projectName = connection.discovery.packageName ?? connection.projectPath.split('/').filter(Boolean).pop() ?? 'Connected project'
  return <section className="workspace project-summary" aria-labelledby="project-title">
    <div className="evidence-rail evidence-rail--active" aria-hidden="true"><span>Connected</span><i /><span>{connection.watchChanges ? 'Watching' : 'Paused'}</span><i /><span>Report</span></div>
    <div className="project-main"><p className="section-label">Approved local scope</p><h2 id="project-title">{projectName}</h2><code>{connection.projectPath}</code><dl><div><dt>Framework</dt><dd>{connection.discovery.framework}</dd></div><div><dt>Target</dt><dd>{connection.targetUrl ?? 'Repository only'}</dd></div><div><dt>Watcher</dt><dd>{connection.watchChanges ? 'Watching changes' : 'Off'}</dd></div><div><dt>Diagnosis</dt><dd>{gptDiagnosis?.configured ? `GPT ready · ${gptDiagnosis.model}` : 'GPT needs setup'}</dd></div></dl></div>
    <div className="project-actions"><button className="button button--primary" type="button" onClick={onVerify} disabled={isVerifying}>{isVerifying ? 'Verifying…' : 'Verify now'} <span>→</span></button><button className="text-button" type="button" onClick={onChangeProject} disabled={isVerifying}>Change project</button></div>
  </section>
}

function Report({ result }: { result?: VerificationResult }) {
  if (!result) return <section className="report-empty"><p className="section-label">Next action</p><h2>Run the first verification.</h2><p>The agent will assemble Evidence from the approved project and optional running application.</p></section>
  if (!result.report) return <section className="report report--inconclusive"><p className="section-label">Evidence collected</p><h2>Diagnosis is not configured yet.</h2><p>{result.diagnosisUnavailable ?? 'GPT diagnosis could not complete.'}</p><EvidenceSummary evidence={result.evidence} /></section>

  const citedEvidence = result.evidence.filter((item) => result.report!.evidenceIds.includes(item.id))
  return <section className={`report report--${result.report.recommendation}`} aria-labelledby="report-title">
    <div className="report-heading"><div><p className="section-label">Release report</p><h2 id="report-title">{result.report.headline}</h2></div><span className="recommendation">{recommendationLabel(result.report.recommendation)}</span></div>
    <p className="report-diagnosis">{result.report.diagnosis}</p>
    <div className="report-grid"><div><p className="detail-label">Next action</p><p>{result.report.nextAction}</p></div><div><p className="detail-label">Evidence cited</p><EvidenceSummary evidence={citedEvidence} /></div></div>
    {result.capsule.relevantFiles.length > 0 && <div className="source-context"><p className="detail-label">Relevant source context</p>{result.capsule.relevantFiles.slice(0, 3).map((file) => <details key={file.path}><summary><code>{file.path}</code><span>{file.reason}</span></summary><pre>{file.excerpt}</pre></details>)}</div>}
  </section>
}

function EvidenceSummary({ evidence }: { evidence: Evidence[] }) {
  if (evidence.length === 0) return <p className="muted">No selected Evidence is available.</p>
  return <ul className="evidence-list">{evidence.map((item) => <li key={item.id}><span>{evidenceIcon(item.kind)}</span><div><strong>{item.summary}</strong><code>{item.location?.file ?? item.location?.url ?? item.kind}</code>{item.kind === 'screenshot' && <img src={`/api/evidence/${encodeURIComponent(item.id)}`} alt="Captured verification evidence" />}</div></li>)}</ul>
}

function recommendationLabel(recommendation: NonNullable<VerificationResult['report']>['recommendation']) {
  return recommendation === 'ready_to_ship' ? 'Ready to ship' : recommendation === 'needs_attention' ? 'Needs attention' : 'Inconclusive'
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
    throw new Error('The local agent did not return a valid response. Start Verion with npm run dev, then reload this page.')
  }
  if (!response.ok) throw new Error(data?.error ?? 'The local agent endpoint is unavailable. Start Verion with npm run dev, then retry.')
  if (!data) throw new Error('The local agent returned an empty response. Start Verion with npm run dev, then reload this page.')
  return data
}
