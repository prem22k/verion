# Verion Product Direction — Implementation TODO

Source of truth: [PRODUCT_DIRECTION.MD](./PRODUCT_DIRECTION.MD)

This is an implementation plan only. It deliberately preserves the existing deterministic discovery, verification, local-memory, security, and Codex handoff architecture while changing how those capabilities are composed and presented.

## Product guardrails

- [x] Keep Verion local-first: project understanding, memory, evidence, history, and BYOM credentials stay local by default.
- [x] Keep deterministic discovery and verification useful when no AI provider is configured.
- [x] Do not expose repository graphs, evidence producers, capsules, AST terminology, browser automation, or scanner brands in primary UI.
- [x] Do not ship or embed a Verion-owned provider API key in the CLI, browser, `.env.example`, project memory, or local storage.
- [x] Keep exactly two primary MVP pages: Home and Security.
- [x] Keep one persistent assistant state across both pages.
- [x] Keep repairs bounded, reviewable, and followed by verification.
- [x] Preserve existing `.verion/project-memory.json` data through versioned migrations.

## Phase 0 — Product contracts and documentation

### Product and design documents

- [x] Update the product architecture document with the provider-independent AI boundary.
- [x] Update the design specification for a two-page shell with a persistent assistant panel.
- [x] Define the compact Home information hierarchy: project understanding, latest change, likely impact, latest decision, and Verify in the first view.
- [x] Define Security page hierarchy: review state, estimated duration, critical findings, high findings, affected code, and repair actions.
- [x] Define assistant voice, suggested questions, source/citation behavior, empty state, unavailable-provider state, and error state.
- [x] Define native-repair approval rules and the Copy Fix Prompt format.

### Data contracts

- [x] Version a local configuration model separate from project memory.
- [x] Define `AIProviderConfig` without storing raw credentials in the browser or project memory.
- [x] Define `ModelDescriptor` and `ModelCapabilities`.
- [x] Define a provider-neutral structured-response contract.
- [x] Define assistant conversation, message, citation, tool-call, and tool-result records.
- [x] Define a normalized security finding contract with severity, file, line range, explanation, evidence, suggested action, and fix status.
- [x] Define a repair proposal contract: scope, relevant files, proposed diff, verification plan, approval status, and outcome.
- [x] Define migration paths for existing project-memory versions.

### Acceptance

- [x] Documentation names no implementation detail in the primary product language.
- [x] Every new persisted record has ownership, retention, and secret-handling rules.
- [x] Existing project memory can be read and migrated without losing reviews or understanding.

## Phase 1 — Provider-independent AI layer

### Core abstraction

- [x] Introduce an `AIProvider` interface for structured generation, assistant chat, and optional repair proposals.
- [x] Add a provider registry and selected-model resolution.
- [x] Add capability evaluation before each AI task.
- [x] Add a deterministic/no-provider implementation path.
- [x] Move existing OpenAI project-understanding and release-diagnosis calls behind the provider interface.
- [x] Preserve the current bounded project-outline policy: no project source, secrets, browser material, credentials, or raw local memory sent for project understanding.
- [x] Add provider-independent diagnostics and user-safe failure messages.

### Initial providers

- [x] Implement OpenAI-compatible BYOM support: base URL, model, API key, structured output where supported.
- [x] Implement Gemini BYOM support.
- [x] Implement OpenRouter BYOM support.
- [x] Keep the existing OpenAI path as an OpenAI-compatible configuration, not a special architecture.
- [x] Add provider/model selection and capability display in settings, not the primary dashboard.
- [x] Add connection validation that never returns a credential to the browser.

### Local credential handling

- [ ] Prefer OS credential storage for saved BYOM credentials.
- [x] Support environment-variable configuration for headless and CI use.
- [x] Define a secure local fallback only if OS credential storage is unavailable.
- [x] Ensure raw keys never enter browser state, local storage, `.verion` memory, logs, diagnostics, or repair packets.

### Verion AI mode

- [x] Design the hosted Verion AI proxy API and authentication/session flow.
- [x] Define anonymous demo, account, rate-limit, usage-limit, spend-limit, and abuse-protection requirements.
- [ ] Ensure the distributed CLI sends only authenticated requests to the proxy and never receives the upstream key.
- [x] Add a clear capability-limited demo fallback if the hosted proxy is unavailable.

### Acceptance

- [x] No-provider mode retains useful project understanding and deterministic verification.
- [x] Existing OpenAI behavior still works through the new abstraction.
- [x] Unsupported model capabilities degrade to explanation or Copy Fix Prompt rather than errors.
- [x] Provider credentials remain local for BYOM.

## Phase 2 — Persistent application shell

### Navigation and state

- [x] Replace the current single long dashboard with a shared application shell.
- [x] Add exactly two primary routes/views: Home and Security.
- [x] Preserve project connection, selected model, assistant conversation, and assistant pending state while switching pages.
- [x] Support deep links to Home and Security without resetting the local project connection.
- [x] Add compact project identity and current release state to the shared header.
- [x] Keep settings/provider configuration secondary to the two primary pages.

### Persistent assistant panel

- [x] Add a persistent right-side assistant panel on desktop.
- [x] Add a mobile assistant drawer or dedicated assistant mode that preserves the same conversation.
- [x] Show context-aware starter prompts derived from current project state.
- [x] Add streaming/pending, empty, unavailable-provider, interrupted, and retry states.
- [x] Persist conversation history locally per project with an explicit clear-history action.
- [x] Make assistant messages cite relevant project facts, reports, findings, or source references when available.

### Accessibility and responsive behavior

- [x] Keep a complete keyboard route through navigation, main content, assistant, and repair actions.
- [x] Use visible focus and semantic landmarks for header, navigation, main content, and assistant.
- [x] Ensure assistant state announcements use appropriate live regions.
- [x] Keep touch targets at least 44px.
- [x] Ensure no page or module has horizontal overflow.

### Acceptance

- [x] Navigation never resets the conversation or selected model.
- [x] The first Home view answers what the project is, what changed, what matters, and what to do next.
- [x] The assistant is visibly part of Verion, not a generic floating chatbot.

## Phase 3 — Home: compact project mission control

### Project control strip

- [x] Show project name, one-sentence understanding, detected stack, core counts, memory freshness, and one primary Verify action.
- [x] Keep the project name compact; do not use a landing-page hero.
- [x] Add an inline disclosure for additional project brief detail.
- [x] Show important application areas and known user journeys with real discovered data.

### Change intelligence

- [x] Build a normalized current-change set from the local baseline.
- [x] Show change groups and affected product areas.
- [x] Improve likely-impact mapping from changed paths, routes, journeys, and prior reviews.
- [x] Distinguish “no change,” “baseline not established,” “change detected,” and “reviewing change” states.
- [x] Keep change watcher behavior explicit and user-safe; avoid surprising expensive reviews.

### Verification and decision

- [x] Present review progress as human product checks, not internal events.
- [x] Keep the latest release decision prominent and concise.
- [x] Link decision reasons to the relevant observations and affected application areas.
- [x] Surface the next safe action: Verify, retry, fix, copy prompt, or reconnect.
- [x] Ensure deterministic results remain visible when AI reasoning is unavailable.

### Local memory

- [x] Show what Verion remembers: first learned, last learned, known paths, recent reviews, and known issues.
- [x] Add a local-memory management entry point without exposing raw storage implementation in the primary view.
- [x] Define clear data reset/forget behavior for a project.

### Acceptance

- [x] Home does not require scrolling through a report to understand release state.
- [x] All visible project claims are backed by local discovery, memory, or a cited review.
- [x] Verify remains understandable without an AI provider.

## Phase 4 — Assistant orchestration and safe tools

### Read-only project intelligence

- [x] Add controlled tools for project understanding, local memory, changes, reports, findings, and known journeys.
- [x] Add scoped code search and relevant-file reads.
- [x] Add repository relationship lookup only as internal assistant context; translate results into human language.
- [x] Add source redaction for secrets, credentials, private keys, and environment values before provider requests.
- [x] Add retrieval limits, file-size limits, and context budgets.
- [x] Record assistant tool use locally for transparency and debugging without exposing raw internal names in the UI.

### Assistant questions

- [x] Support “Why shouldn’t I ship this?”
- [x] Support “What changed since my last review?”
- [x] Support “What parts of the app are affected?”
- [x] Support “Explain this vulnerability.”
- [x] Support “Which files are causing this?”
- [x] Support “Prepare this for Codex.”
- [x] Make responses grounded, concise, and explicit about uncertainty.

### Safety

- [x] Do not grant unrestricted filesystem access.
- [x] Do not grant arbitrary shell execution.
- [x] Require explicit user intent before transmitting source code beyond the existing bounded understanding outline.
- [x] Require confirmation before any state-changing repair action.
- [x] Add audit records for repair-launch commands, verification runs, and approvals; patch auditing remains part of the later patch workflow.

### Acceptance

- [x] The first assistant response uses project context without asking the developer to restate it.
- [x] Assistant answers distinguish discovered facts, review observations, and model inference.
- [x] Read-only assistant use works for models without tool-calling support through server-side context assembly.

## Phase 5 — Security page

### Security review workflow

- [x] Move Deep Security Review into the Security primary page.
- [x] Show review availability, estimated duration, start state, progress, completed state, unavailable state, and failure/retry state.
- [x] Keep security findings connected to the project’s overall release decision.
- [x] Never expose security engine history or individual scanner brands in the primary UI.

### Findings experience

- [x] Normalize existing critical and high findings into the security finding contract.
- [x] Sort critical findings first, then high severity.
- [x] Show affected file, relevant lines, explanation, evidence, and suggested action.
- [x] Add finding-specific assistant prompts.
- [x] Add `Fix with Verion` when capabilities support it.
- [x] Add `Copy Fix Prompt` for every actionable finding.

### Acceptance

- [x] Security shares the Home visual language and persistent assistant.
- [x] A critical finding can block or downgrade the same final release decision shown on Home.
- [x] Findings remain useful even when no AI provider is configured.

## Phase 6 — Repair workflows

### Universal external-agent path

- [x] Add `Copy Fix Prompt` to actionable release and security findings.
- [x] Include project context, issue, severity, affected files, relevant code context, evidence, root cause, expected behavior, and verification instructions.
- [x] Keep prompt contents scoped and secret-redacted.
- [x] Extend the existing Codex repair packet to use the same canonical repair-brief contract.
- [x] Preserve the existing “launch Codex, review diff, verify again” flow.

### Native Verion repair

- [x] Gate native repair behind model capabilities and explicit user approval.
- [x] Gather only relevant files and code context for a selected issue.
- [x] Require a proposed patch and verification plan before a write is possible.
- [x] Present a readable diff and changed-file list.
- [x] Enforce scoped writes only within the approved project root and relevant paths.
- [x] Run allowlisted relevant tests/verification after the patch.
- [x] Record repair outcome and refresh the release decision.
- [x] Provide cancellation, failure recovery, and rollback guidance.

### Acceptance

- [x] No native repair writes files without explicit approval.
- [x] Every repair produces a visible diff and post-repair verification result.
- [x] Models without repair capability still get a complete Copy Fix Prompt path.

## Phase 7 — Reliability, packaging, and privacy

- [x] Add migration tests for existing `.verion` memory versions.
- [x] Add provider adapter contract tests and no-provider fallback tests.
- [x] Add credential-leak tests for frontend payloads, logs, persisted memory, and repair packets.
- [x] Add assistant tool-policy tests for path scope, secret redaction, and confirmation requirements.
- [x] Add Home/Security/assistant persistence browser tests.
- [x] Add security finding ordering and release-decision integration tests.
- [x] Add repair proposal, approval, diff, and re-verification tests.
- [x] Add end-to-end package tests: install package, run `verion` from an unrelated directory, open dashboard, write local memory, and stop cleanly.
- [x] Add browser-runtime setup detection and clear guidance when a browser executable is unavailable.
- [x] Document local data locations, provider credential behavior, reset/forget behavior, and BYOM setup.

## Delivery order

1. [x] Phase 0: contracts and docs
2. [x] Phase 1: provider layer and no-provider fallback
3. [x] Phase 2: two-page shell and persistent assistant layout
4. [x] Phase 3: compact Home and change intelligence
5. [x] Phase 4: read-only assistant and controlled tools
6. [x] Phase 5: Security page and normalized findings
7. [x] Phase 6: Copy Fix Prompt, Codex handoff, then native repair
8. [x] Phase 7: reliability, privacy, packaging, and end-to-end validation

## Explicit non-goals for the first implementation pass

- [ ] Do not implement every provider before the provider abstraction is proven.
- [ ] Do not promise Verion AI until the hosted proxy, quotas, and key isolation exist.
- [ ] Do not add unrestricted autonomous code editing or shell access.
- [ ] Do not turn Home into a generic analytics dashboard or a large report.
- [ ] Do not create a separate security product or expose internal scanner terminology.
