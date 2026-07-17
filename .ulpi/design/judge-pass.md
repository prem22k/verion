---
feature: judge-pass
register: product
design_system: native semantic HTML controls
binds_to: DESIGN.md
---

# Build Week Judge Pass

Every screen must read as the same product if placed side by side.

## Design read

Keep the technical/utilitarian briefing identity. The winning moment is a genuine product decision arriving immediately after a live review, not a dashboard tour or an animated story about the architecture.

## Brutal critique

### Confusing interactions

- A Needs attention report can select the `Fix` rail phase before the developer pressed Fix with Codex. That makes the UI claim progress the developer did not make.
- After a review completes, the expanded decision lives below the project briefing and lists. A judge may need to scroll to see the answer to the only question that matters: should I ship?
- The full project briefing remains visible after a decision has arrived, competing with the recommendation rather than supporting it.

### Weak moments

- The present home is composed well, but the live review resolving back into Mission Control can feel like returning to a dashboard rather than reaching a conclusion.
- `What Verion found` is stronger than `Release confidence`, but it has not consistently been the first visual object after a blocking review.
- The repair state is honest, but the phase language needs to distinguish “a repair is available” from “a repair has been handed to Codex.”

### Missed opportunities

- The app has a real full loop. The UI should let the release call itself be the hero, with the project understanding acting as quiet proof below it.
- The transition from observations to recommendation is the memorable moment. It deserves immediate focus, not a secondary position after operational context.

### Demo risks

- A judge can mistake Mission Control for an attractive project dashboard before they see the actual release decision.
- A phase rail can read as polished theater if its state is not exactly truthful.
- Showing the product understanding, recent changes, user journeys, and historical reports before a newly returned recommendation spreads attention across too many ideas.

### Feature creep and unnecessary complexity to avoid

- Do not add a separate report screen, modal, result animation, score, percentage, evidence drawer, comparison view, or demo mode.
- Do not add another primary action, replay control, timer, or synthetic review step.
- Do not change report data, agent behavior, endpoints, or verification architecture.

## UX-only correction

### Flow: review becomes a decision

```text
[Live review]
      ↓ actual completion
[Journey rail: Explain]
      ↓ focus moves here
[What Verion found / Release decision]
      ↓
[Fix with Codex] or [Verify again] or [Ready to ship]
      ↓
[Project understanding remains available below the decision]
```

### `DecisionFirst` layout

When a report is selected, render the existing Release Confidence brief immediately beneath the Journey Rail and before Mission Masthead, recent changes, known journeys, and archive rows. Do not duplicate the report. The rest of Mission Control remains below as supporting context.

When no report is selected, retain the existing briefing-first layout and one Verify action.

### Truthful rail state

- Needs attention selected, Codex not opened: active `Explain`; `Fix` is a future phase.
- Codex opened and repair watch active: active `Fix`.
- Watcher-triggered repair review: show the same rail with `Fix` completed and `Review` current. Use existing `Verifying the repair.` copy.
- Ready to ship: active `Ship`.
- Inconclusive: active `Explain`; only `Verify again` may be primary.

### Accessibility and state

- The report recommendation heading remains the first focus target after a review completes.
- The rail is a non-interactive ordered list and uses `aria-current="step"` only for a truthful active phase.
- Preserve existing native button targets, live announcements, dark mode, mobile behavior, and reduced-motion behavior.
- On mobile, the decision remains first in reading order. The compact rail remains orientation only.

## Design pre-flight

- [x] Uses existing locked tokens, typography, rule motif, native controls, and motion durations only.
- [x] Adds no screen, route, endpoint, data model, score, percentage, timer, technical copy, or additional workflow.
- [x] One primary action remains visible per state.
- [x] Covers no report, selected report, Needs attention before and after Codex handoff, repair review, Ready to ship, Inconclusive, mobile, focus, and reduced motion.
- [x] The slop test passes: no dashboard card expansion, generic AI progress theater, or visual celebration was added.
- [x] Self-critique: distinctiveness 3; hierarchy 4; consistency 4; accessibility 4; state coverage 4; copy 4; restraint 4; motion motivation 4. Total 31/32. No axis is below 3.

## Build handoff

**Target:** `react-vite-tailwind-engineer` equivalent. This is a Vite React SPA using existing native semantic controls and the locked CSS system.

Implement exactly this spec. Theme the existing interface with the locked tokens; do not redesign or re-implement its components.

Acceptance criteria:

- A newly selected report is the first substantial content below the rail.
- The report is rendered only once and remains the existing focus target.
- The rail is truthful before fix, during repair watch, and during repair verification.
- No backend contract, route, data model, dependency, or new feature is introduced.
- `npm run build` and `git diff --check` pass.
