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
- Validated discovery and graph construction against Verion and the unrelated ServX Attack Paths TypeScript service.
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
- Validated automatic discovery from both Verion and the unrelated ServX Attack Paths project.
- Redesigned the full customer-facing product journey in `.ulpi/design/release-journey.md`, from Verion's browser arrival through local memory, review, repair, rerun, and ready-to-ship confirmation; implementation remains intentionally deferred.

## In-Progress Work

- Awaiting approval to implement the redesigned customer-facing release journey before adding backend architecture.

## Blockers

- The configured OpenAI credential and request path were verified; the follow-up live diagnosis was rate-limited before a report could be returned. Retry after the provider limit clears.

## Next Steps

1. Implement the approved release-journey UI and translate existing verification events into customer-language review events.
2. Validate the dashboard report against a running target with `OPENAI_API_KEY` configured.
3. Verify watcher behavior against an external project target and release recommendation changes.

## Important Decisions

- The repository documents are the source of truth; the MVP remains intentionally narrow.
- The existing demo target is a regression fixture only; future product code must not depend on it.
- The approved initial stack is Vite/React TypeScript for the dashboard and TypeScript for the local agent.
