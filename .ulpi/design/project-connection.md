# Project Connection and Local Verification

This screen binds to `.ulpi/design/DESIGN.md`. Every screen must read as the same product if placed side by side.

## Flow: Connect and verify a local project

**Goal:** Connect an approved local project to the local agent and receive one evidence-backed release decision.

**User Story:** As a developer, I want to connect my project directory and local app URL so that Verion can verify changes without a test script.

**Trigger:** The dashboard opens with no connected project, or the developer selects `Change project`.

```text
Connect project → validate directory and URL → connected + watching
                                              ↓
                                         Verify now
                                              ↓
                              Evidence → Context Capsule → Release report
                                              ↓
                           new attention state? → dashboard notification
```

### States and edge cases

- Empty: show two fields, project directory required and running URL optional, with one primary `Connect project` action.
- Invalid directory or URL: retain values, show inline error, move focus to the error summary.
- Connected with no URL: discovery is available; the UI explains browser observation needs a running URL.
- Verifying: disable duplicate run actions; live region states what the agent is doing.
- GPT unavailable: show collected Evidence and a concise configuration instruction. Never fabricate a report.
- File change: show quiet `Change observed` status. After a 3-second debounce, show `Verifying update`.
- New attention state: show a persistent in-app notification and the release report. Repeated equivalent states do not create another notification.
- Refresh: the page reconnects to the current local-agent process and restores its in-memory connection. If the agent stopped, the page asks to connect again.
- Offline or local agent unavailable: show a retry action and do not imply a run occurred.

## Components

### `ProjectConnectionForm`

Purpose: collect explicit local scope before the agent reads or visits anything.

- Fields: `Project directory` (required text path), `Running app URL` (optional URL), `Watch changes` (checked by default).
- Primary: `Connect project`.
- Secondary: none. The form is the focal action.
- Native label, input, checkbox, and button controls. Error text uses `aria-describedby`; status uses `aria-live="polite"`.
- Keyboard: normal tab order, Enter submits, visible 3px accent focus ring.
- Mobile: full-width controls and 48px minimum action target.

### `ConnectionSummary`

Purpose: confirm approved scope and make the background behavior reviewable.

- Shows project name, framework, resolved project path, target URL state, and watcher state.
- `Change project` is a subdued text button. `Verify now` is the sole primary action.
- The evidence rail runs alongside these stages: Connected, Watching, Verifying, Report.

### `ReleaseReport`

Purpose: state one evidence-backed decision without turning into a scanner dashboard.

- Recommendation, headline, diagnosis, next action, selected Evidence summaries, and relevant source excerpts.
- Error and inconclusive states use the same structure; no fabricated success card.
- Screenshot Evidence is available from the current local-agent result only. The browser never exposes a tool surface to GPT.

## Accessibility and responsive behavior

- One H1 per view. Form errors are announced. Verification progress and watcher events use polite live regions.
- Focus remains on the action that initiated a run; it is not stolen by streaming status.
- On screens below 768px, the rail becomes a horizontal sequence above content; form and report stack.
- All tokens, controls, and states follow `DESIGN.md`; light and dark system themes are supported.

## Pre-flight

- [x] One accent, one radius scale, one icon family, and one type pairing.
- [x] No banned fonts, purple glow, cream canvas, gradient text, nested cards, fake metrics, or em-dash copy.
- [x] Distinct signature: the evidence rail carries the verification story.
- [x] Empty, connected, loading, error, GPT-unavailable, watcher, and attention states are specified.
- [x] WCAG AA ratios and keyboard/live-region behavior are specified.
- [x] One primary action per state; form has three controls.
- [x] Self-critique: distinctiveness 3, hierarchy 4, consistency 4, accessibility 4, state coverage 4, copy 4, restraint 4, motion 3. Total 30/32.

## Build handoff

Target: `react-vite-tailwind-engineer`.

Implementation uses the existing Vite application and native semantic HTML controls to avoid adding a component-library dependency for a three-control local form. Apply the locked tokens exactly; do not redesign or re-implement components. Acceptance requires a live local-agent connection, manual verification, change watch, and in-app attention notification.
