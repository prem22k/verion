---
feature: release-confidence
register: product
design_system: native semantic HTML controls
binds_to: DESIGN.md
---

# Release Confidence

Every screen must read as the same product if placed side by side.

## Design read

The final report is a Staff Engineer’s release call. It narrows the developer’s attention to the one decision, why it was reached, and the next responsible move.

## Scope

This redesign replaces the expanded Recent Report detail. It does not add an evidence browser, technical report page, metrics, severity table, or new navigation. Verion keeps richer local material internally but presents only the conclusion required to decide whether to ship.

## Flow: Receive a release recommendation

**Goal:** Give a developer one legible release call immediately after a review completes.

**Trigger:** A completed verification returns a structured release report.

```text
[Live review completes]
        |
        v
[Release confidence]
        |
        +-- Ready to ship ------> one clear release recommendation
        +-- Needs attention ----> one root cause and what to do next
        +-- Inconclusive -------> explain what prevents a confident call
```

## Expanded report

An expanded Recent Report becomes a restrained ruled decision brief:

```text
Release confidence

High confidence
Needs attention

The likely root cause
Checkout can reach the server without a required subscription record.

Why I reached this call
• The checkout request returned HTTP 500.
• The affected billing path was changed in this release.

What I would do next
Create the subscription record before the checkout path runs, then verify again.
```

### Required content hierarchy

1. **Release confidence**
   - One plain confidence label: `High confidence`, `Moderate confidence`, or `Limited confidence`.
2. **One recommendation**
   - Exactly one: `Ready to ship`, `Needs attention`, or `Inconclusive`.
   - This is the visual and verbal focal point.
3. **The likely root cause**
   - Exactly one concise statement. For an inconclusive review, say what prevents a root cause from being identified. For a ready-to-ship review, state the narrow basis for no current release blocker.
4. **Why I reached this call**
   - Zero to three short reasons. Never show a fourth reason, nested evidence list, or duplicate paraphrase.
5. **What I would do next**
   - One practical sentence from the existing next action.

The collapsed report row remains a quiet archive entry, but the report shelf heading changes to `Release confidence`. It still expands the newest returned report automatically and retains keyboard focus behavior.

### Screenshot rule

Screenshots are omitted by default. Show a single captured view only when the structured report explicitly identifies it as necessary to understand the root cause. It appears after the reasons, before the next action, with an accessible descriptive caption. Never show a gallery, raw screenshot evidence ID, captured URL, or an image merely because one exists.

The current review does not have a supported relevance judgement for screenshots, so it must keep them hidden rather than show one speculatively.

### States and edge cases

- **Ready to ship:** Confidence may be high or moderate. Keep the report calm and specific. Do not invent a root-cause issue.
- **Needs attention:** The recommendation uses the locked danger color, but reasons do not become a long error list.
- **Inconclusive:** Use the locked warning color. Explain the missing basis for a decision and one next action. Do not imply the release is safe.
- **Legacy local report:** Normalize its existing diagnosis into one root-cause statement and one reason, then retain the old recommendation. Never fail to render saved local history.
- **No report:** Keep the existing empty state. Do not display placeholder confidence.
- **Long copy:** Root cause, reasons, and next action wrap at the existing readable measure. Do not truncate a release call.

## Report contract

The local diagnosis contract must produce:

```ts
type ReleaseConfidence = 'high' | 'moderate' | 'limited'

type ReleaseReport = {
  recommendation: 'ready_to_ship' | 'needs_attention' | 'inconclusive'
  confidence: ReleaseConfidence
  headline: string
  rootCause: string
  reasons: string[] // 0–3 only
  nextAction: string
  evidenceIds: string[] // internal only
}
```

The structured-diagnosis prompt must ask for only one root cause and a maximum of three distinct reasons grounded in the local Context Capsule. It must prefer `inconclusive` and `limited` confidence when the supplied material cannot justify a release call. The server curates only the customer-facing fields for the browser; evidence IDs remain internal.

## Component: `ReleaseConfidenceBrief`

**Purpose:** Present a completed release decision without overwhelming the developer.

**Data:** Recommendation, confidence, rootCause, up to three reasons, nextAction, and only an optional server-approved screenshot descriptor. No evidence IDs, source paths, URLs, tool names, raw logs, or technical internal terms.

**Visual:** Use one left decision rule in the semantic recommendation color. The confidence label is quiet utility type. The recommendation is the only large title. Reasons are a compact ruled list, not cards or accordions. Keep the existing report-row trigger and focus handoff.

**Accessibility:** The expanded report is an `article` with a focusable recommendation heading. Screen readers announce the recommendation and confidence when it opens. Reasons use a semantic list. A screenshot, when supported later, has meaningful alt text and visible caption.

**Responsive:** The brief remains a one-column reading flow. The recommendation and confidence never compete in a grid. Reason text wraps, and touch targets for report rows remain at least 48px.

## Copy guardrail

Allowed: `Release confidence`, `High confidence`, `Moderate confidence`, `Limited confidence`, `Ready to ship`, `Needs attention`, `Inconclusive`, `The likely root cause`, `Why I reached this call`, `What I would do next`.

Never show: evidence ID, source file, URL, endpoint, tool, scanner, producer, log, stack trace, list of warnings, severity matrix, confidence percentage, more than three reasons, or more than one root cause.

## Design Pre-Flight

- [x] Uses only the locked ruled briefing identity, semantic colors, typography, spacing, and existing report shelf.
- [x] Keeps one focal recommendation and one continuous decision rule rather than cards, tables, metrics, or generic report widgets.
- [x] Limits working memory to one recommendation, one cause, and at most three reasons.
- [x] Covers every recommendation, legacy history, empty state, long content, and screenshot omission/relevance.
- [x] Specifies semantic article/list structure, focus handoff, screen-reader announcement, readable mobile flow, and no unnecessary motion.
- [x] Self-critique: distinctiveness 3; hierarchy 4; consistency 4; accessibility 4; state coverage 4; copy 4; restraint 4; motion motivation 4. Total 31/32. No axis is below 3.

## Build handoff

**Target:** `react-vite-tailwind-engineer` equivalent. This is a Vite React SPA with native semantic controls and the locked CSS system. No dependency is required.

Implement exactly this spec. Theme the existing interface with the locked tokens; do not redesign or re-implement its components.

Acceptance criteria:

- A newly diagnosed report contains one recommendation, confidence, one root cause, at most three reasons, and one next action.
- The server never supplies evidence IDs or technical internals in the Mission Control report payload.
- Release confidence expands as the calm one-column Staff Engineer brief and the newest report opens after review completion.
- Screenshots remain hidden unless a future supported relevance signal explicitly selects one.
- Existing local reports remain readable through safe normalization.
