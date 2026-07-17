# Decisions

Use this file as Verion's engineering journal. Record major product decisions when they change direction, scope, workflow, or user experience.

## 2026-07-17 — Optional Deep Security Review

### Decision

Integrate the supplied local security service only as an optional, loopback-only Evidence Producer named internally as Deep security review. It receives an explicitly configured GitHub repository identity, not arbitrary browser input or project data, and its eligible findings feed Verion's existing one-release-decision flow.

### Why

Critical, trustworthy security concerns can materially affect whether a developer should ship, but a separate scanning product would dilute Verion's focused release experience and widen the data boundary unnecessarily.

### Alternatives Considered

- Build a security dashboard, findings table, or attack graph in Verion.
- Send the current app URL, local source, project memory, browser artifacts, or credentials to the service.
- Include every severity and raw finding in a supplementary report.
- Omit security review completely.

### Consequences

The adapter sends only local requester and pre-approved repository fields to a loopback URL. It accepts only critical findings with an authoritative identifier or a narrowly trusted critical source, then redacts and normalizes them before they reach orchestration, GPT, memory, or the browser. A configured review that cannot complete produces an Inconclusive release call rather than a false clean result. The dashboard adds one short review stage only while that review runs; it never exposes the service, raw findings, endpoints, IDs, credentials, counts, or a second report.

## 2026-07-17 — Built-In Local Security Engine

### Decision

Ship the security review implementation under `services/security/` as an internal Verion workspace.

### Why

The developer explicitly requested a self-contained Verion clone: one repository, one root installation, and no separately cloned security product. Keeping the engine as a workspace retains a clear operational boundary while making it part of the product.

### Alternatives Considered

- Keep the security engine in an external checkout.
- Merge the service routes and scanning implementation directly into Verion's dashboard or local agent.
- Copy raw findings into a separate browser surface.

### Consequences

The root workspace installs the engine with Verion. When an authorized review is configured, the local agent starts the loopback-only engine automatically; its package manifest, runtime, database configuration, and credentials remain isolated. It is excluded from Verion's browser contract and is still accessed only through the bounded Deep security review producer. Shipping source does not authorize arbitrary targets, credentials, scanner output, or a second release report.

## 2026-07-14

### Decision

Verion will focus the MVP on one non-negotiable loop: generate code, verify behavior, find meaningful issues, group by likely root cause, prepare context for Codex, fix, verify again, and ship.

### Why

The strongest product promise is shipping confidence after AI-generated code. Everything else is secondary until that loop works and feels clear.

### Alternatives Considered

- Build a broad QA dashboard.
- Build a multi-agent development environment.
- Build a general testing platform.
- Build collaboration and account features first.

### Tradeoffs

This narrows the product sharply and delays many useful features. The benefit is a clearer demo, a stronger product identity, and less risk of building around the core instead of proving it.

## 2026-07-15

### Decision

Begin the Phase 1 vertical slice with a Vite/React TypeScript dashboard and a separate TypeScript local-agent module. Both use one shared verification-result contract.

### Why

The repository contains no application scaffold. This is the smallest maintainable web foundation for a polished dashboard while preserving the decided local-agent and web-dashboard architecture.

### Alternatives Considered

- A static mockup with no verification state.
- A single tightly coupled application process.
- A more feature-rich framework or multi-package setup.

### Tradeoffs

The initial dashboard will use an isolated demo adapter until browser automation is connected. That adapter is temporary and must not be presented as the final evidence source; the real browser-backed agent remains a Phase 1 requirement.

## 2026-07-15 — Demo Target

### Decision

Use a small workspace-creation companion application for the Build Week demo. Verion will discover that the template selected by a user is silently replaced by the default template when the workspace is created.

### Why

This is a realistic user-visible state-loss bug that an AI-generated product flow can introduce. It is more meaningful than a generic error, easy to reproduce through browser exploration, and supports one focused root-cause diagnosis.

### Alternatives Considered

- A checkout or payment flow.
- An invitation flow with an ignored permission role.
- A generic form submission failure.

### Tradeoffs

The companion application is intentionally narrow and exists only to prove Verion's verification loop. It is not a second product and must not grow beyond the single creation path.

## 2026-07-15 — Product Foundation

### Decision

Treat the existing companion application and dashboard as an architecture proof. Begin the actual product with a target-agnostic local agent that discovers arbitrary React, Next.js, and Vite projects before any browser verification is attempted.

### Why

Verion must understand a developer's real project rather than depend on a known route, selector, or seeded defect. Project discovery and a repository graph create the evidence base required for reliable exploration and Context Capsules.

### Alternatives Considered

- Extend the hardcoded companion application flow.
- Begin with browser automation against an arbitrary URL without repository context.
- Build a generic scanner dashboard first.

### Tradeoffs

This delays new dashboard polish and security integrations, but creates a reusable local-agent foundation and prevents demo-specific assumptions from becoming product architecture.

## 2026-07-15 — Evidence-First Boundary

### Decision

All Verion subsystems must produce or consume the shared `Evidence` model. The verification orchestrator depends only on `EvidenceProducer` implementations, and Context Capsules are built exclusively from Evidence.

### Why

This keeps repository discovery, browser automation, security scanning, and future quality checks modular and reviewable. It prevents tool-specific reports from leaking into the product experience or into GPT context.

### Alternatives Considered

- Let each subsystem return its own report format.
- Allow GPT to invoke tools directly.
- Couple orchestration to Playwright and individual scanners.

### Tradeoffs

Each producer requires a small normalization adapter, but new tools can be added without changing orchestration or the Context Capsule contract.

## 2026-07-15 — Evidence-First Architecture

### Decision

Evidence is the sole integration boundary inside Verion. Every subsystem must produce or consume normalized Evidence, the verification orchestrator may know only Evidence Producers, and Context Capsules must be composed entirely from Evidence.

### Why

This keeps tool integrations modular, preserves reviewability, and ensures GPT reasons from selected, source-backed context instead of controlling browsers or scanners directly.

### Alternatives Considered

- Allow tool-specific result contracts in the orchestrator.
- Let GPT call Playwright, the security engine, or scanners directly.
- Build separate reports for each verification subsystem.

### Tradeoffs

Producer adapters require upfront normalization work, but adding or replacing a tool no longer changes the orchestration or Context Capsule boundary.

## 2026-07-15 — Capsule-Only GPT Diagnosis

### Decision

GPT diagnosis consumes the completed Context Capsule and returns one structured release report with an evidence-cited recommendation. It has no direct access to browsers, scanners, repository discovery, or graph construction.

### Why

The first vertical slice must prove a developer can move from collected evidence to a concise, reviewable release decision without making GPT an uncontrolled orchestrator.

### Alternatives Considered

- Let GPT invoke verification tools directly.
- Generate an unstructured diagnosis and parse it heuristically.
- Produce a synthetic local diagnosis when GPT credentials are unavailable.

### Consequences

The local agent needs an `OPENAI_API_KEY` to complete diagnosis. Missing credentials and API errors remain explicit so Verion never presents fabricated reasoning as verification.

## 2026-07-15 — Local Runtime Configuration and Bounded GPT Context

**Decision**

Load the local `.env` file with Node's built-in environment loader when the agent starts diagnosis, expose only a key-free GPT readiness status to the dashboard, and send GPT a compact Context Capsule derived from normalized Evidence.

**Reason**

A `.env` file is not automatically available to a Node process. The dashboard must make diagnosis readiness observable without revealing secrets. Arbitrary repositories can also have large graphs and source inventories; a release decision needs the relevant Evidence neighborhood, not an unbounded repository dump.

**Alternatives**

- Require users to source `.env` manually before every command.
- Add a third-party configuration dependency.
- Send complete discovery and graph payloads to GPT.

**Consequences**

`npm run dev` and the CLI now use the configured credential after restart, while externally supplied environment variables still work. GPT receives only a bounded, redacted Capsule: project facts, selected graph neighborhood, observed browser signals, and capped source excerpts. The full Evidence set remains available to the dashboard and report.

## 2026-07-16 — Launch-Directory Project Connection

**Decision**

Verion is launched from the project it verifies. The local agent treats its current working directory as the approved project scope, connects it before the dashboard opens, and attempts to detect a conventional loopback development server. Project paths and URLs are removed from the normal dashboard flow; `--url` remains an advanced CLI override.

**Reason**

A browser cannot select a real local project path for a local agent without awkward or misleading configuration. The developer's terminal location is the clearest explicit scope decision and makes the product feel like a verification layer rather than a configuration form.

**Alternatives**

- Keep browser text fields for filesystem paths and URLs.
- Build a browser file-picker integration that cannot pass a trusted native path to the local agent.
- Probe arbitrary network addresses or require every developer to supply a URL.

**Consequences**

The normal start command is `verion` in the application root. Verion observes a small set of loopback-only conventional development ports and excludes its own dashboard port. A user who needs a non-standard address uses `verion --url <address>`. To verify a different project, start Verion from that project instead of modifying browser state.

## 2026-07-16 — Customer-Facing Release Journey

**Decision**

Keep the Evidence-first architecture internal. The dashboard is organized around one emotional journey: uncertainty, live review, grouped conclusion, release recommendation, Fix Packet for Codex, and verification after repair.

**Reason**

Developers should experience Verion as an experienced staff engineer making a clear release call, not as an orchestration engine, a scanner console, or a collection of internal subsystems. The moment when several observations converge into one diagnosis is the product's primary demo moment.

**Alternatives**

- Surface Evidence Producers, repository graphs, Context Capsules, and individual tools as first-class dashboard concepts.
- Build a generic multi-agent activity visualizer.
- Show many ungrouped warnings and leave the developer to decide whether to ship.

**Consequences**

Internal contracts remain unchanged. Future UI and event work must translate internal data into plain-language review events and one grouped conclusion. The dashboard may reveal supporting proof, but never implementation vocabulary.

## 2026-07-16 — Verion as a Product Relationship

**Decision**

Design the first-use and returning-user experience as one continuous relationship: Verion arrives, introduces itself, learns the project aloud, remembers what it learned, reviews on request, gives one release decision, prepares a focused repair with Codex, and proves the repair through a second review.

**Reason**

The product must earn affection before it earns trust. A developer should feel within the first minute that Verion understands their application and is reducing uncertainty, rather than presenting a technical tool that must be operated or configured.

**Alternatives**

- Open directly into a generic dashboard or technical project summary.
- Treat project learning as invisible setup.
- Use a heavy decorative 3D mascot or animated agent swarm to simulate intelligence.

## 2026-07-16 — Local Project Memory and First-Run Understanding

**Decision**

On the first `verion` launch from a project root, Verion creates `.verion/project-memory.json`. The file stores the discovered project, internal dependency map, a source-change signature, and a plain-language project understanding. The dashboard never displays the internal map or technical implementation terms.

**Reason**

The product must feel as though it has genuinely learned the developer's software before asking them to trust a release decision. Keeping memory next to the project makes that understanding durable, local, inspectable, and independent of a hosted account.

**Alternatives**

- Rebuild project understanding on every launch without persisting it.
- Store project memory in a global Verion configuration directory.
- Expose the repository graph as the primary first-run dashboard output.

**Consequences**

Unchanged projects return immediately with their saved understanding; source changes cause it to be refreshed before the next verification. `.verion` is excluded from discovery and Git by default. First-run UI describes detected technologies, product areas, and route/API counts in human language, then marks onboarding complete only after the developer sees it.

## 2026-07-16 — Project-Owned Learning Record

**Decision**

Extend `.verion/project-memory.json` into the project’s durable local learning record. It stores a profile, technologies, routes, inferred and observed user journeys, learned product understanding, recent file-path changes, bounded verification history, release reports, and known issue state.

**Reason**

Verion should become more useful as it reviews a project without turning project knowledge into a cloud service or an opaque global cache. A project-owned record keeps the history inspectable, portable with the working directory, and separate from Verion’s GPT diagnosis boundary.

**Alternatives**

- Store only the latest discovery result and discard all verification history.
- Keep an unbounded raw evidence archive inside the project.
- Upload a central project-memory profile for each developer.

**Consequences**

Memory is bounded, contains no copied source, screenshots, credentials, or browser-session data, and is never sent to GPT. A completed verification records only durable outcome data and can reopen, increment, or resolve known issue records. See `LOCAL_MEMORY.md` for the complete schema and lifecycle.

## 2026-07-17 — Mission Control as a Curated Local Briefing

**Decision**

The returning-project dashboard is Mission Control: a release briefing that presents Project Understanding, Recent Changes, Known User Journeys, Current Status, one Verify action, and Recent Reports. The local dashboard receives a curated Mission Control summary from `.verion` rather than the full memory file or verification internals.

**Reason**

Developers need a clear release-oriented point of view, not an engineering console. The product can remember a great deal while showing only the information that helps a developer decide what to verify and whether to ship.

**Alternatives**

- Expose the full local-memory JSON in the browser.
- Keep the previous technical project summary and evidence-oriented report layout.
- Add separate dashboard pages for every memory category.

**Consequences**

The loopback browser payload is limited to plain-language understanding, grouped change summaries, journey labels, release status, and recent report copy. Raw source, paths, screenshots, evidence IDs, credentials, and internal vocabulary remain server-side. Mission Control uses ruled briefing lists rather than cards, tables, logs, or telemetry aesthetics.

## 2026-07-17 — Conservative Product Understanding

**Decision**

Extend the project-owned learning record with plain-language application type, authentication, payments, database, framework, user journeys, critical flows, important pages, and important APIs. Infer each fact only from a recognized dependency, framework convention, Prisma provider, or clearly named local route/file signal.

**Reason**

Verion needs to establish that it understands what the application is for before the developer asks it to verify a release. Unsupported product claims would undermine that trust more than an incomplete briefing.

**Alternatives**

- Present route and dependency inventories without product interpretation.
- Use an LLM to guess product purpose from all project source during local learning.
- Show generic empty categories for every project.

**Consequences**

Project Understanding improves locally whenever the project changes, but it omits any fact that does not have support. The dashboard receives human labels only; route syntax, source paths, parser details, and the underlying project map remain local implementation details.

## 2026-07-17 — Observable Review Lifecycle

**Decision**

Present verification as one calm, four-step review path: understanding the project, reviewing what changed, checking the product, and making a release decision. Advance each step only when the corresponding local verification boundary occurs, and retain a paused review snapshot when the run cannot finish.

**Reason**

A developer needs to see thoughtful progress without being handed a technical feed. Lifecycle-backed progress is trustworthy; a timer or generic loading state is not.

**Alternatives**

- Keep the single passive `Reviewing now` state.
- Stream tool output, counters, identifiers, or logs into the dashboard.
- Simulate review progress with client-side timers.

**Consequences**

The server curates a small loopback-only review payload with plain-language steps and change groups. The dashboard can recover that snapshot on refresh, preserve completed steps on a paused review, and return directly to the expanded release decision when it completes. Tool names, paths, evidence, and implementation data remain outside the browser contract.

**Consequences**

The product experience is specified in `.ulpi/design/release-journey.md`. The lightweight Verion presence and review trail communicate attention and judgment. Every visible screen must preserve the emotional sequence and use product language only.

## 2026-07-17 — Curated Live Review Observations

**Decision**

During the running-product portion of a verification, retain normalized findings internally and stream only a bounded, server-curated observation brief to Mission Control. Each line is a deduplicated `{ tone, message }` outcome grounded in a real local finding.

**Reason**

Developers need to see that Verion is noticing meaningful outcomes while it reviews the product, without being asked to interpret a browser, network, or logging feed.

**Alternatives**

- Stream raw findings directly to the browser.
- Wait until the release decision to reveal every observation.
- Simulate reassuring product activity with timed copy.

**Consequences**

The review payload carries at most six current observations and only while a running product is available. The server maps supported outcomes to short human language such as a loaded app, an incomplete app action, an HTTP failure, or a console error. It never exposes URLs, endpoints, error contents, stack traces, identifiers, source paths, or producer information, and the temporary brief is not persisted as project memory.

## 2026-07-17 — Likely Impact Is a Product Cue, Not a Change Log

**Decision**

When the local watcher notices a supported source change, refresh the project-owned memory before the background review begins and curate at most three likely product-impact labels for Mission Control. The primary action becomes `Verify now` while the cue is present.

**Reason**

Developers need to know what deserves another look, not how many files changed. A short product-area cue creates a useful moment of agency without turning Mission Control into a diff viewer or making a release claim.

**Alternatives**

- Show a changed-file count or the changed path list.
- Infer broad relevance for every local code edit.
- Wait until the release decision to mention the change.

**Consequences**

Inference is server-only and deterministic. It can use only the latest local changed paths plus existing learned product labels, and it emits only strong supported names such as Billing, Authentication, Dashboard, Settings, or a matching learned area. The dashboard gets opaque IDs and labels only: no paths, counts, source, matching rule, score, or source content. Unsupported changes stay quiet and the cue disappears after the latest change has been reviewed.

## 2026-07-17 — Release Confidence Is a Bounded Decision Brief

**Decision**

Persist and present each release report as one recommendation, one confidence label, one likely root cause, at most three distinct reasons, and one next action. Mission Control curates only those customer-facing fields; screenshots remain hidden until a future report can explicitly establish that one is needed to understand the root cause.

**Reason**

A release call should feel like advice from a Staff Engineer: clear enough to act on immediately, but grounded enough to trust. Showing a broad diagnosis or raw verification material makes the developer do the synthesis that Verion is meant to provide.

**Alternatives**

- Preserve the previous headline-and-diagnosis report layout.
- Expose every finding and screenshot beside each release call.
- Replace historical reports that do not match the new structure.

**Consequences**

GPT must choose limited confidence and an inconclusive recommendation when the local capsule cannot justify a call. Saved reports from earlier local-memory versions are normalized safely rather than discarded. Evidence IDs remain internal, and the browser contract excludes evidence, paths, URLs, tool names, logs, screenshots, and internal reasoning artifacts.

## 2026-07-17 — Reviewable Codex Repair Handoff

**Decision**

Only a stored Needs Attention decision with current supporting review context may create a private Fix Packet for Codex. Verion opens Codex as an interactive local session and never edits source files, grants approvals, bypasses sandboxing, or starts a second verification mechanism itself.

**Reason**

Verion’s role is to frame and verify a repair, not silently make one. A bounded packet gives Codex the relevant issue, supporting observations, likely files, root cause, repair boundary, and follow-up plan while keeping the developer in control of every change.

**Alternatives**

- Send a raw report or entire project memory to Codex.
- Let Verion invoke a non-interactive repair command.
- Add a separate repair polling loop or dashboard terminal.

**Consequences**

Packets live only under the project’s ignored `.verion/fix-packets/` directory with owner-only permissions. The loopback dashboard receives only an opened, unavailable, or needs-another-review state. The existing source watcher remains the sole trigger for the post-repair verification.

## 2026-07-15 — Explicit Local Project Connection and Quiet Watch (Superseded)

### Decision

This initial dashboard-form approach was superseded on 2026-07-16 by **Launch-Directory Project Connection**. The agent still holds the connection in memory, debounces filesystem changes, reruns the existing Evidence-first path, and notifies the dashboard only when a new needs-attention state appears.

### Why

This creates a target-agnostic product path without granting a browser dashboard filesystem access or silently inspecting an unapproved target. It matches the intended experience of a quiet reviewer that interrupts only when a release decision changes.

### Alternatives Considered

- Keep the proof-only dashboard and require CLI use.
- Let the browser inspect arbitrary filesystem paths directly.
- Add persistent registrations, cloud synchronization, or operating-system notifications now.

### Consequences

The first connection is local and process-scoped. Restarting the agent requires reconnecting the project; persistent registrations and operating-system notifications are deferred until the verification loop proves reliable.

## Template

### Date


### Decision


### Why


### Alternatives Considered


### Tradeoffs
