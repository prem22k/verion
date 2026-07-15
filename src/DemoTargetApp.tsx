import { useState } from 'react'

const templates = [
  { id: 'blank', name: 'Blank workspace', description: 'Start with an empty project space.' },
  { id: 'marketing', name: 'Marketing launch', description: 'Plan a campaign, assets, and launch timeline.' },
  { id: 'product', name: 'Product roadmap', description: 'Track discovery, priorities, and delivery.' }
]

export function DemoTargetApp() {
  const [workspaceName, setWorkspaceName] = useState('Northstar')
  const [selectedTemplate, setSelectedTemplate] = useState('blank')
  const [createdTemplate, setCreatedTemplate] = useState<string | null>(null)

  const createWorkspace = () => {
    // Intentional demo defect: the selected template is lost at confirmation.
    setCreatedTemplate('blank')
  }

  if (createdTemplate) {
    const template = templates.find((item) => item.id === createdTemplate)!
    return <main className="target-shell">
      <section className="target-success" aria-live="polite">
        <span className="target-success__mark">✓</span>
        <p className="target-kicker">Workspace created</p>
        <h1>{workspaceName} is ready.</h1>
        <p>Your new workspace was created from the <strong>{template.name}</strong>.</p>
        <button onClick={() => setCreatedTemplate(null)}>Create another workspace</button>
      </section>
    </main>
  }

  return <main className="target-shell">
    <header className="target-nav"><strong>atlas</strong><span>New workspace</span></header>
    <section className="target-content">
      <p className="target-kicker">Get started</p>
      <h1>Create a workspace that fits the way you work.</h1>
      <label className="target-label" htmlFor="workspace-name">Workspace name</label>
      <input id="workspace-name" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
      <fieldset>
        <legend>Choose a starting point</legend>
        <div className="template-grid">
          {templates.map((template) => <button className={`template-card ${selectedTemplate === template.id ? 'template-card--selected' : ''}`} key={template.id} type="button" onClick={() => setSelectedTemplate(template.id)}>
            <strong>{template.name}</strong><span>{template.description}</span>
          </button>)}
        </div>
      </fieldset>
      <button className="target-primary" onClick={createWorkspace}>Create workspace</button>
    </section>
  </main>
}
