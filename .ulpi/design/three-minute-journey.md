---
feature: three-minute-journey
register: product
design_system: native semantic HTML controls
binds_to: DESIGN.md
---

# Three-Minute Product Journey

Every screen must read as the same product if placed side by side.

## Design read

The demo should feel like one confident review becoming a decision, then a repair loop. The interface never resets into a dashboard between those moments. The briefing rule and the small Verion presence are the continuity cue.

## Scope

Polish the existing Run → Understand → Review → Explain → Fix → Verify Again → Ready to Ship flow. Do not add routes, metrics, panels, setup choices, technical detail, synthetic activity, or a new capability.

## Flow: release confidence in one sitting

```text
[Verion opens]
      ↓
[I understand this project]
      ↓ Continue
[Before you ship. Verify]
      ↓ Verify
[Reviewing the latest version]
      ↓ actual observations
[What Verion found]
      ↓ Needs attention only
[Fix with Codex]
      ↓ saved repair
[Verifying the repair]
      ↓
[Ready to ship]
```

### Understand

First run shows only a brief introduction, discovered project facts, one plain-English summary, and `Continue`. Completion moves directly to the pre-review briefing. Returning projects begin at that briefing and say `I remember this project.` once.

### Review

`Verify` remains in the same visual position and becomes `Reviewing` while disabled. The live view has one focal statement: the current product action being reviewed. Completed steps are quiet. The newest observation appears beneath the current step. Show at most four review steps and six observations. The view must never look like a terminal, scanner feed, checklist factory, timer, or activity log.

### Explain

When a report arrives, the live review resolves into the selected release decision automatically. The report heading changes from the archival `Release confidence` to `What Verion found` for a blocking recommendation, while the final recommendation remains the largest item. The developer sees one root cause, at most three reasons, and one next action. A ready outcome uses `Ready to ship` as the focal line.

### Fix

For Needs attention, `Fix with Codex` is the only primary action. After success, the action settles into the sentence: `Codex has the repair brief. I’ll verify the repair when it is saved.` Do not add an animation, countdown, terminal, or second action.

### Verify again

When the watcher begins the post-repair verification, the live heading is `Verifying the repair.` The compact context line says `Checking the same release path after the repair.` The review path and actual observations remain the same familiar pattern.

### Ready to ship

On a Ready to ship result, the selected decision opens immediately. It leads with `Ready to ship`, then one precise basis, reasons if present, and the next practical action. The existing presence becomes still. No confetti, streak, percentage, or fake celebration.

## Component changes

### `JourneyRail`

Purpose: a quiet horizontal orientation line above Mission Control and Live Review.

- Segments: Understand, Review, Explain, Fix, Ship.
- Current segment uses the locked accent and a short rule. Completed segments use text only. Future segments use the locked subtle token.
- `Fix` is visible only after a Needs attention result. `Ship` becomes the active segment for Ready to ship.
- It is orientation, not a clickable wizard or a progress percentage.
- On mobile, show only the active phase and its predecessor, for example `Review → Explain`.

### `MissionMasthead`

- Pre-review lead: `Before you ship.`
- Returning-memory line: `I remember this project and the release paths that matter.`
- One primary action: `Verify` or `Verify now`.
- Remove visual competition from secondary status copy.

### `LiveReview`

- Standard heading: `Reviewing the latest version.`
- Repair heading: `Verifying the repair.` when the previous report was Needs attention and a repair watch is active.
- The active step title is the only high-emphasis line in the trail.
- Keep current pause and reconnect recovery states, with the primary recovery action in place.

### `ReleaseConfidenceBrief`

- Automatically select the new report as today.
- Add a purpose label: `What Verion found` for Needs attention, `Release decision` for Ready to ship and Inconclusive.
- The recommendation heading is the first focus target after review completion.
- Needs attention continues to expose only `Fix with Codex` as the primary action.

## State coverage

| State | Copy and behavior |
| --- | --- |
| First run | Learn facts, state local memory, one `Continue` action. |
| Returning, no changes | `Before you ship.` and `Verify`. |
| Changes waiting | `Today’s changes probably affect…` and `Verify now`. |
| Review running | `Reviewing the latest version.` and actual current review step. |
| Repair verification | `Verifying the repair.` and same-path confirmation copy. |
| Needs attention | One root cause, Fix with Codex. |
| Ready to ship | Ready to ship is focal, no repair action. |
| Inconclusive | Explain the missing basis and offer Verify again. |
| Agent unavailable | Preserve context, show reconnect only. |

## Accessibility and motion

- `JourneyRail` is a semantic ordered list with a concise current-phase `aria-current="step"` marker. It is never an interactive tab list.
- Live review and final recommendation updates use existing polite live announcements. Avoid repeating past steps.
- Focus moves to the final recommendation after a completed review, as it does now.
- Buttons retain 48px minimum targets, visible focus, native keyboard activation, and one primary action per state.
- The rail advances once using the locked 280ms rule transition. The Verion presence changes state once. Reduced-motion users receive immediate state changes.

## Design pre-flight

- [x] Uses only the locked technical/utilitarian briefing identity, palette, type, radius, motion, and native controls.
- [x] No new screen, card grid, dashboard section, metric, percentage, timer, terminal, or raw implementation copy.
- [x] One primary action per phase: Continue, Verify, Fix with Codex, or Verify again.
- [x] Covers first run, return, changed project, running review, repair review, each decision, and recovery.
- [x] Covers semantic sequence, live updates, focus handoff, keyboard operation, mobile simplification, and reduced motion.
- [x] Self-critique: distinctiveness 3; hierarchy 4; consistency 4; accessibility 4; state coverage 4; copy 4; restraint 4; motion motivation 4. Total 31/32. No axis is below 3.

## Build handoff

**Target:** `react-vite-tailwind-engineer` equivalent. This is a Vite React SPA using native semantic controls and the locked CSS system.

Implement exactly this spec. Theme the existing interface with the locked tokens; do not redesign or re-implement its components.

Acceptance criteria:

- The user can describe the interface in the sequence Run, Understand, Review, Explain, Fix, Verify Again, Ready to Ship.
- A quiet non-interactive Journey Rail makes the active phase clear without claiming false progress.
- Existing first run, review, report, repair-watch, reconnect, and release states retain their actual backend behavior.
- Customer-facing copy contains no internal architecture or tool terminology.
- No new feature or backend endpoint is introduced.
- Light, dark, responsive, keyboard, screen-reader, and reduced-motion behavior remain aligned with DESIGN.md.
