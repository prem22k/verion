# Project Connection and Local Verification

This screen binds to `.ulpi/design/DESIGN.md`. Every screen must read as the same product if placed side by side.

> Status: launch guidance only. The customer-facing verification experience is specified in [`release-journey.md`](release-journey.md). Do not introduce a separate connection screen once Verion has started from the project directory.

## Flow: Start and verify the current local project

**Goal:** Start the local agent from a project root, discover that project automatically, and receive one evidence-backed release decision.

**User Story:** As a developer, I want Verion to understand the project I launch it from so that verification begins without copying paths or URLs into a browser.

**Trigger:** The developer runs `verion` from a project terminal. A second project is selected by starting Verion in that project, not by editing a browser form.

```text
Terminal: `verion` from project root → agent discovers current directory
                                           ↓
                              detects a conventional localhost app when available
                                           ↓
                                  connected + watching → Verify now
                                                         ↓
                                       Evidence → Context Capsule → Release report
                                                         ↓
                                    new attention state? → dashboard notification
```

### States and edge cases

- Agent not started: show one terminal command, `verion`, and state that it must be run from the project root. No browser fields or fake file picker.
- Agent starts from an unsupported directory: show the agent's concise terminal error. The dashboard does not guess at a different folder.
- Local app detected: show its resolved localhost address as observed scope.
- No local app detected: discovery remains available; verification explains that browser observation begins automatically when a conventional localhost app is available. An explicit `verion --url <address>` command is the advanced fallback.
- Verifying: disable duplicate run actions; live region states what the agent is doing.
- GPT unavailable: show collected Evidence and a concise configuration instruction. Never fabricate a report.
- File change: show quiet `Change observed` status. After a 3-second debounce, show `Verifying update`.
- New attention state: show a persistent in-app notification and the release report. Repeated equivalent states do not create another notification.
- Refresh: the page reconnects to the current local-agent process and restores its in-memory connection. If the agent stopped, the page asks to connect again.
- Offline or local agent unavailable: show a retry action and do not imply a run occurred.

## Components

### `AgentLaunchNotice`

Purpose: explain the one terminal action required before the dashboard can exist.

- One short code command: `verion`.
- Copy explains that the agent reads the directory the command was run from and searches conventional localhost development ports. It is not a browser form and has no editable configuration controls.
- Advanced disclosure holds the `verion --url http://127.0.0.1:3000` fallback. It is visually secondary and does not compete with the primary flow.
- Native `code`, `details`, and button controls only. Copy action reports success with a polite live region.

### `ConnectionSummary`

Purpose: confirm approved scope and make the background behavior reviewable.

- Shows project name, framework, resolved project path, detected target URL state, and watcher state.
- `Verify another project` is a subdued text button that returns to the launch instruction. `Verify now` is the sole primary action.
- The evidence rail runs alongside these stages: Connected, Watching, Verifying, Report.

### `ReleaseReport`

Purpose: state one evidence-backed decision without turning into a scanner dashboard.

- Recommendation, headline, diagnosis, next action, selected Evidence summaries, and relevant source excerpts.
- Error and inconclusive states use the same structure; no fabricated success card.
- Screenshot Evidence is available from the current local-agent result only. The browser never exposes a tool surface to GPT.

## Accessibility and responsive behavior

- One H1 per view. Launch instructions and verification progress use polite live regions.
- Focus remains on the action that initiated a run; it is not stolen by streaming status.
- On screens below 768px, the rail becomes a horizontal sequence above content; form and report stack.
- All tokens, controls, and states follow `DESIGN.md`; light and dark system themes are supported.

## Pre-flight

- [x] One accent, one radius scale, one icon family, and one type pairing.
- [x] No banned fonts, purple glow, cream canvas, gradient text, nested cards, fake metrics, or em-dash copy.
- [x] Distinct signature: the evidence rail carries the verification story.
- [x] Empty, connected, loading, error, GPT-unavailable, watcher, and attention states are specified.
- [x] WCAG AA ratios and keyboard/live-region behavior are specified.
- [x] One primary action per state; onboarding has no configuration fields.
- [x] Self-critique: distinctiveness 3, hierarchy 4, consistency 4, accessibility 4, state coverage 4, copy 4, restraint 4, motion 3. Total 30/32.

## Build handoff

Target: `react-vite-tailwind-engineer`.

Implementation uses the existing Vite application and native semantic HTML controls. Apply the locked tokens exactly; do not redesign or re-implement components. Acceptance requires launching the local agent from an arbitrary project root, automatic project connection, localhost target detection or an advanced CLI URL override, manual verification, change watch, and in-app attention notification.
