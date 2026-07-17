---
feature: pre-review-reset
register: product
design_system: native semantic HTML controls
binds_to: DESIGN.md
---

# Pre-Review Reset

Every screen must read as the same product if placed side by side.

## Design read

Before the first review, Verion should feel like a calm colleague who has already read the project and is ready to answer one question. The page should not feel like a project dashboard asking the developer to read their own code back to them.

## Scope

Replace the verbose Mission Control pre-review hierarchy with one decision surface. Preserve all current data and interactions, but make the default view use only the project summary, up to three plain product facts, the likely-impact line when present, and one primary Verify action.

## Layout

```text
[Understand · Review · Explain · Ship]

      Verion presence
      Project understood
      Ready to verify <project name>.
      One grounded sentence about what Verion will review.
      [ Verify now ]
      I will review the running experience and give one release call.

      What I understand                    [show]
      <three facts only when expanded>

      Recent reports and details below the fold
```

### Default content

- Do not show `What matters here`, full technologies, full product areas, recent changes, known journeys, and an empty report shelf as equal-weight sections above the fold.
- Show no more than three facts in the supporting sentence. Prefer application type, the most relevant user journey, and the framework only when it clarifies the review.
- When likely impact is present, it replaces the generic supporting sentence with `Today’s changes probably affect…`.
- The primary action says `Verify now` if likely impact exists, otherwise `Verify`.

### Disclosure

`What I understand` is a native text button. It expands the existing project facts, technologies, journeys, and important areas in place below the primary action. It is closed by default and is not required to start a review.

### Lower context

Recent changes, known journeys, and report history remain available after the compact opening surface. They move below the disclosure and use smaller visual weight. Do not render an empty `Release confidence` shelf in the main reading flow before any report exists.

### States

- **Disconnected:** Replace Verify with `Reconnect Verion`; do not allow a dead Verify click.
- **Diagnosis unavailable:** Show the existing Inconclusive decision. Never leave the view in a ready state with no result.
- **Report selected:** Preserve the existing Decision First layout. This compact opening is only for the no-selected-report state.
- **Mobile:** Keep the presence, project name, promise, and action in one reading flow. The disclosure remains below the action.

## Accessibility and motion

- Keep native buttons, visible focus, 48px action targets, polite announcements, dark mode, and reduced-motion behavior.
- The disclosure controls `aria-expanded` and an associated content region.
- The existing presence may make one state transition only. Do not add spinners, progress percentages, cards, gradients, or decorative movement.

## Design pre-flight

- [x] Uses only locked technical/utilitarian tokens and the existing briefing rule.
- [x] One primary action and one optional text disclosure in the default state.
- [x] No endpoint, data-model, report, scanner, or agent change.
- [x] Covers ready, changed, disconnected, selected-report, empty-history, mobile, keyboard, and reduced-motion states.
- [x] Self-critique: distinctiveness 3; hierarchy 4; consistency 4; accessibility 4; state coverage 4; copy 4; restraint 4; motion motivation 4. Total 31/32. No axis is below 3.

## Build handoff

**Target:** `react-vite-tailwind-engineer` equivalent. This is a Vite React SPA with native semantic controls and the locked CSS system.

Implement exactly this spec. Theme the existing interface with locked tokens; do not redesign or re-implement components.

Acceptance criteria:

- The initial dashboard view is understandable in five seconds and has one working Verify action.
- Project detail is available but not required before Verify.
- Existing report-first, review, repair, and accessibility behavior remains intact.
- No backend or architecture changes are introduced by this UI pass.
