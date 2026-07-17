# Execution

## Current Milestone

Complete the first target-agnostic vertical slice: discovery → graph → browser evidence → Context Capsule → GPT diagnosis → release report.

## Completed Work

- Read and reconciled every repository Markdown document on 2026-07-15.
- Confirmed the non-negotiable loop: generate, verify, diagnose, fix with Codex, verify again, ship.
- Established this execution tracker and the companion sprint, question, and hackathon trackers.
- Organized durable product and planning documents under `docs/` with a documentation guide.
- Defined the proposed Phase 1 vertical slice and its approval gate in `docs/planning/PHASE_1_BUILD_PLAN.md`.
- Created the Vite/React TypeScript dashboard foundation, shared verification-result contract, and all five Phase 1 dashboard states.
- Installed the dashboard dependencies and verified a successful production build with `npm run build`.
- Selected the workspace-creation companion application and its state-loss issue as the single demo target.
- Built the Playwright local agent, which reproduced the real template-loss issue in Chromium and captured a screenshot plus structured evidence.
- Connected the dashboard Verify action to the local verification service endpoint.
- Added the captured screenshot and a relevant source location to the dashboard diagnosis and Codex brief.
- Documented the Codex repair, successful rerun, and reset procedure in `docs/planning/DEMO_RUNBOOK.md`.
- Verified the real release-decision transition: the agent returns **Needs Attention** with the defect present and **Ready to Ship** after the actual repair. The defect is restored for the live demo.
- Captured and visually reviewed the real dashboard diagnosis screen after a live Verify action.
- Measured the live Verify-to-diagnosis transition at 1.4 seconds in Chromium.
- Implemented target-agnostic project discovery for local React, Next.js, and Vite projects.
- Implemented a repository graph with framework entry points, route candidates, and resolved relative imports.
- Validated discovery and graph construction against Verion and an unrelated TypeScript service.
- Implemented target-agnostic Context Capsule generation from a verification finding and repository graph.
- Refactored discovery and graph construction into normalized Evidence Producers behind a tool-agnostic verification orchestrator.
- Refactored Context Capsules to accept Evidence only.
- Added a target-agnostic browser Evidence Producer for page observation, console logs, failed/HTTP-error network responses, and screenshots.
- Verified the Evidence-first orchestrator against an unrelated local project with no target URL.
- Froze the Evidence-first architecture; no additional producers or interfaces are part of this milestone.
- Added a tracked `.env.example` containing the required GPT diagnosis configuration and protected local `.env` files from Git.
- Replaced the proof-only dashboard with a real localhost project-connection flow, local-agent events, Evidence-backed reports, and an opt-in debounced project watcher.
- Validated an explicit local connection, browser Evidence collection, and Context Capsule generation through the dashboard API.
- Made `npm run dev` start the complete local dashboard and agent, rather than a frontend-only Vite server.
- Added clear local-path validation and `~/` expansion to the project-connection flow.
- Made local `.env` configuration load automatically for the local agent and CLI, with a key-free dashboard readiness status.
- Hardened the GPT diagnosis boundary with a timeout, safe provider error classification, structured-output validation, and `store: false` for diagnosis requests.
- Bounded Context Capsules to the relevant Evidence neighborhood and capped source excerpts, while retaining the complete Evidence set for dashboard review.
- Replaced browser project-path and URL configuration with launch-directory project discovery through the `verion` executable.
- Added loopback-only conventional local-app detection with an advanced `verion --url <address>` override.
- Validated automatic discovery from both Verion and an unrelated TypeScript project.
- Redesigned the full customer-facing product journey in `.ulpi/design/release-journey.md`, from Verion's browser arrival through local memory, review, repair, rerun, and ready-to-ship confirmation; implementation remains intentionally deferred.
- Implemented first-run project understanding: `verion` now discovers the launched project, builds its internal project map, derives real framework/service/product-flow facts, and saves the complete local memory in `.verion/project-memory.json`.
- Added the first-run dashboard experience: Verion introduces itself, reveals real project discoveries progressively in plain language, summarizes its understanding, and remembers the project only after the developer continues.
- Added a durable local-memory lifecycle: unchanged projects reuse their saved understanding, source changes rebuild it before verification, and `.verion` is excluded from both discovery and version control.
- Validated the first-run and returning-project API flow against the Verion project: persisted memory, completed onboarding, and a restart that reused the saved understanding.
- Designed and implemented Version 3 of project-owned local memory in `.verion/project-memory.json`: project profile, technologies, routes, user journeys, learned understanding, recent changes, verification history, release reports, and known issues.
- Made every completed verification improve local memory while keeping it bounded and private; the memory file is never sent to GPT, and the dashboard receives only a curated local summary.
- Redesigned the returning-project dashboard as Mission Control: a calm release briefing with Project Understanding, Recent Changes, Known User Journeys, Current Status, one Verify action, and Recent Reports.
- Added a curated loopback-only Mission Control summary. The browser receives user-facing local-memory facts only, never raw memory, file paths, source excerpts, evidence identifiers, screenshots, or credentials.
- Expanded Project Understanding with conservative, persisted inferences for application type, sign-in, billing, database, framework, user journeys, critical flows, important pages, and important APIs. Mission Control presents these as a plain-English local briefing, without routes or parser vocabulary.
- Replaced passive verification loading with a live, customer-language review path. Actual local lifecycle boundaries now update Project Understanding, What Changed, Checking the Product, and Making a Release Decision; the loopback UI receives only the curated review state.
- Added live review observations from real browser outcomes. The local server translates normalized findings into at most six deduplicated, human-readable outcomes while checking a running app; raw observation data never enters the dashboard payload.
- Added conservative Likely Impact briefings for watched source changes. Verion refreshes local memory, maps only supported changes to up to three product areas, and offers one `Verify now` action without exposing paths, counts, or matching rules.
- Redesigned persisted release reports as a bounded Staff Engineer decision brief: one recommendation, confidence label, likely root cause, at most three reasons, and one next action. Legacy local reports normalize safely, while the browser receives only this curated conclusion.
- Implemented the Fix Packet handoff for supported Needs Attention reports. Verion writes a private, owner-only repair brief under `.verion/fix-packets/`, opens an interactive local Codex session without edit automation, and relies on the existing source watcher to review a saved repair.
- Designed the Verion Presence as a lightweight state signal with six lifecycle-backed states: Learning, Watching, Thinking, Reviewing, Concerned, and Ready. Implementation is intentionally deferred until this identity specification is approved.
- Added an optional local Deep security review as a normalized Evidence Producer. It is explicitly repository-authorized, loopback-only, filtered to critical high-confidence concerns before orchestration, and feeds the existing release decision without adding a second product surface.
- Made the security review engine a shipped internal capability under `services/security/`, installed through the root workspace and started automatically for an authorized review while preserving Verion's Evidence-only and single-release-decision boundary.
- Replaced landing-page-only browser observation with repository-guided exploration of a bounded set of known static journeys: sign-in, dashboard, billing, and settings when present. It inspects navigation and forms without clicking arbitrarily, entering data, or submitting mutations.
- Polished the customer journey into one intentional release loop: Understand, Review, Explain, Fix, Verify the repair, and Ready to ship. The dashboard adds only a quiet orientation rail and state-specific copy; no new workflow or backend capability was added.
- Completed a Build Week judge-pass UX review and corrected the largest demo risk: a completed release decision now appears before Mission Control context, with truthful pre-fix, repair-watch, and repair-review phase language.
- Replaced the verbose no-report dashboard with a compact Project understood opening and one working Verify action. A diagnosis failure now produces a persisted Inconclusive decision instead of returning the UI to an unchanged ready state; disconnected dashboards offer Reconnect rather than a dead Verify action.
- Corrected the normal local dashboard runtime so Vite's browser client uses Verion's loopback WebSocket endpoint rather than failing against Vite's unused default port, and added the Verion favicon.
- Made release-reasoning failures explicit and actionable instead of a generic Inconclusive report, collapsed duplicate inconclusive reports, and bounded dashboard reconnection after the local agent stops.
- Simplified the post-review dashboard to one current release decision and its immediate next action. Project details and historical duplicate-report rows no longer compete with an active decision.

## In-Progress Work

- Validate the complete customer-facing verification and release-report flow against arbitrary running projects. Mission Control now includes the live review path, Project Understanding briefing, and bounded release-confidence report.
- Validate Deep security review with an authorized local service and repository identity, including a completed critical concern, a clean completion, and an unavailable-service Inconclusive result.

## Blockers

- The configured OpenAI credential and request path were verified; the follow-up live diagnosis was rate-limited before a report could be returned. Retry after the provider limit clears.

## Next Steps

1. Validate the dashboard review and release decision against a running, arbitrary project with `OPENAI_API_KEY` configured.
2. Verify watcher behavior against an external project target, including Mission Control's local recent-changes and report updates.
3. Validate the complete Fix with Codex → saved repair → watcher-driven verification loop against an arbitrary project with an available local Codex CLI.
4. Implement the approved Verion Presence state language without adding a chatbot, mascot, or simulated progress behavior.
5. Run the optional Deep security review against an authorized repository only after its local service is available and independently validated.

## Important Decisions

- The repository documents are the source of truth; the MVP remains intentionally narrow.
- The existing demo target is a regression fixture only; future product code must not depend on it.
- The approved initial stack is Vite/React TypeScript for the dashboard and TypeScript for the local agent.
