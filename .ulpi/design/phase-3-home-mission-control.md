---
feature: phase-3-home-mission-control
register: product
design_system: Apple HIG-inspired native semantic controls
binds_to: DESIGN.md
---

# Phase 3: Home Mission Control

Every screen must read as the same product if placed side by side.

## Design Read

Release desk, not report stack. Home should let a developer scan one compact control strip and one ruled decision ledger to understand the application, the current change, affected areas, and next safe move without discovering another dashboard section.

**Direction:** technical / utilitarian. The project control strip and persistent teammate remain the signature. Phase 3 adds a single release ledger beneath the strip, not a second hero or three matching KPI cards. The counterfactual test passes because this organization is specific to a project-aware release teammate: the data has a temporal sequence, not generic metrics.

## Home hierarchy

```text
Project control strip
  project name + one-sentence understanding + detected stack + compact facts
  primary action: Verify this change
  subordinate: Read project brief

Release ledger
  Current change -> Likely impact -> Latest decision
  contextual safe action in the decision row only

Supporting ruled details
  important journeys + Local Memory + History
```

The first working view must answer, in this order:

1. What this application is.
2. Whether Verion has a current change to review.
3. What parts of the product may be affected.
4. The current release decision and next safe action.

## Data contract

`MissionControl` gains a normalized `currentChange` payload. It is derived from the latest local snapshot and last verification rather than presenting stale history as a current change.

```ts
type CurrentChange = {
  state: 'baseline_not_established' | 'no_change' | 'change_detected' | 'reviewing_change'
  label: string
  description: string
  detectedAt?: string
  groups: Array<{ id: string; label: string; description: string }>
  likelyImpact: Array<{ id: string; label: string; reason?: string }>
}
```

Rules:

- `baseline_not_established`: no completed local review establishes a comparison point. Do not claim that there is no change.
- `no_change`: a baseline exists and the latest snapshot is not newer than the last verification.
- `change_detected`: a later local snapshot exists. Show only human area/group labels.
- `reviewing_change`: a review is active. Preserve its groups/impact and replace the action copy with review progress.
- Likely impact combines current changed-area groups, known user journeys, project areas, and route signals. It never exposes raw source paths in the primary view.

The local-memory payload adds safe counts and facts: first learned, last learned, last verified, known journeys, review count, known issue count, and a `forget` action state. No raw storage path is returned to the browser.

## Flow: decide what to do next

**Goal:** Decide whether to verify, retry, fix, or make no action without scanning a report.

```text
[Project control strip]
    -> [Current change state]
    -> [Likely impact]
    -> [Latest decision]
        -> Verify this change | Verify again | Fix with Codex | no action
```

| State | Current change row | Impact row | Decision row |
| --- | --- | --- | --- |
| Baseline not established | Explain first review creates the comparison point | State that impact is learned from project context, not a current diff | `Verify this change` |
| No change | `No change since last review` | `No new impact to review` | Last decision/history with a subordinate Verify option |
| Change detected | Named change groups and detection time | Named likely product areas and short rationale | Current latest decision with Verify as the primary action in the control strip |
| Reviewing | `Reviewing latest change` with current human progress | Preserve current areas | `Reviewing…`, no duplicate action |
| Inconclusive/failed | Preserve known change/impact | Preserve known areas | `Verify again` or reconnect / repair action as appropriate |

## Flow: manage local memory

**Goal:** Inspect and intentionally reset what Verion remembers for this project.

1. Developer opens `Manage local memory` from the supporting Local Memory module.
2. The disclosure describes what will be forgotten in product language: project understanding, remembered journeys, change baseline, review history, issue history, and teammate conversation.
3. Provider preferences/credentials are explicitly preserved; they are separate local settings.
4. A destructive confirmation requires the exact visible action `Forget this project memory`.
5. On success, Verion immediately relearns the current project and returns Home to `baseline_not_established`.

If the reset fails, preserve the existing view and show a concise retry message. It must not partially report a reset.

## Component briefs

### `ProjectControlStrip`

- Retains the compact existing surface. Project name stays at 26–32px maximum; no hero treatment.
- Facts: detected stack, routes, API endpoints, known journeys, memory freshness.
- Only primary action: `Verify this change`. The action changes to `Reviewing…` only while active.
- Project brief remains an inline disclosure.

### `ReleaseLedger`

- One bordered surface with three ruled rows, never three equal cards.
- Each row uses a compact 120px label column and a flexible reading column. The state chip is semantic, not decorative.
- `Current change` lists at most three named groups; overflow is summarized, not horizontally scrollable.
- `Likely impact` lists at most three product areas and supports a short reason. Empty/baseline states use plain copy rather than fake zero metrics.
- `Latest decision` keeps the existing release headline, concise reason, and next action. Action remains secondary here because the control strip owns Home’s primary Verify control.

### `LocalMemoryModule`

- Supporting module, below the release ledger. Shows real first learned / last learned / last reviewed facts and known journeys, reviews, issues counts.
- `Manage local memory` opens a native dialog. Dialog has an explicit cancel and destructive confirm; Escape and backdrop/cancel retain memory.
- Do not show `.verion`, filenames, database vocabulary, or provider credential details.

### `JourneyList`

- Supporting ruled list of real known user journeys, annotated only as `Observed in the app` when that source exists. No fake flow health or coverage score.

## Accessibility and responsive behavior

- Use only the locked tokens and 120ms control motion from `DESIGN.md`.
- Desktop uses a two-column asymmetry inside the release ledger; mobile turns each row into a stacked label/detail sequence. It does not create a horizontal table.
- The forget-memory dialog uses `role="dialog"`, `aria-modal`, initial focus on Cancel, Escape to close, and focus return to its trigger.
- All ledger state changes and reset success/failure are announced through a polite/alert live region. Every action is at least 44px.
- At 320px, all chips, journey labels, and report reading wrap with `overflow-wrap:anywhere`; page, main pane, and modules have no horizontal overflow.

## Pre-flight

- [x] Re-read `DESIGN.md`; all values use its locked technical/utilitarian language.
- [x] Signature remains project control strip plus persistent teammate; Phase 3 adds a ruled release ledger only.
- [x] No banned fonts, purple glow, gradient text, hero, three-equal-card row, nested card, fake metrics, fake names, or scanner language.
- [x] Baseline, no-change, detected-change, reviewing, inconclusive, reset, error, reconnect, and mobile states are specified.
- [x] Keyboard, focus, dialog, live-region, reduced-motion, 44px target, and wrapping constraints are specified.
- [x] Exactly one Home primary action remains `Verify this change`.
- [x] Self-critique: distinctiveness 3; hierarchy 4; consistency 4; accessibility 4; state coverage 4; copy 4; restraint 4; motion motivation 4. Total 31/32.

## Build handoff

**Target:** React/Vite SPA engineering.

Implement exactly this spec. Theme the existing native semantic controls with the locked tokens; do not redesign or re-implement its components.

Acceptance criteria:

- Home’s first working view communicates application understanding, current change state, likely impact, and next safe action without report scrolling.
- Current changes are derived against the verified baseline, never stale history.
- All visible claims use real discovery, memory, change, or review data.
- Local memory can be intentionally forgotten with a confirmed, atomic reset that preserves provider preferences.
- The persistent teammate and Security page state are not reset by any Home action.
