---
feature: likely-impact
register: product
design_system: native semantic HTML controls
binds_to: DESIGN.md
---

# Likely Impact

Every screen must read as the same product if placed side by side.

## Design read

Changed code should feel like a concrete product question, not a noisy inventory. Verion translates a local source change into the few customer-facing areas that deserve another look.

## Flow: Understand the likely impact of a source change

**Goal:** Help a developer decide whether to review the latest change without reading a file count or diff summary.

**Trigger:** The local project watcher notices an approved source change and refreshes its local understanding.

```text
[Source changes locally]
        |
        v
[Verion refreshes local understanding]
        |
        +-- supported product-area match --> [Likely impact brief + Verify now]
        |
        +-- no supported match ----------> [No impact claim]
        |
        v
[Verify now] --> [Live review]
```

## Mission Control state

When Verion has a supported impact inference, add one ruled `Likely impact` brief immediately below the masthead and before the existing briefing columns:

```text
Likely impact

Today’s changes probably affect

Billing · Dashboard · Settings
```

The labels are plain product areas, not file names or technical categories. Show at most three. The line must be backed by a local path or known-product signal. If no area can be supported, omit the entire brief. Never substitute `31 files changed`, a diff count, a route, a filename, or a generic `Application code` label.

The ordinary one primary action changes from `Verify` to `Verify now` while the brief is present. Do not add a second competing button. If a review starts, the brief recedes with the rest of Mission Control and the live review path takes over.

The existing Recent Changes area may retain its quiet history language, but it must never lead with a number of changed files. The likely impact brief is the decision-making summary.

### Inference rules

Infer only conservative labels supported by the latest local changed paths and existing Project Understanding. Examples:

- payment, checkout, billing, subscription, invoice, or Stripe signals → `Billing`
- auth, sign-in, login, session, Clerk, or account signals → `Authentication`
- dashboard signals → `Dashboard`
- settings, preferences, or profile signals → `Settings`
- a recognized learned product area or journey whose human label has a matching local signal → that same human label

Deduplicate labels, preserve the most specific supported label, and cap the result at three. Do not use an LLM, source excerpts, file contents, or raw paths. The impact is a local, provisional cue, not a release verdict.

### States and edge cases

- **No changed sources:** Omit the brief. Standard `Verify` remains.
- **Changed sources with no supported area:** Omit the brief rather than fabricate relevance.
- **Multiple edits in quick succession:** Refresh the same brief with the newest bounded local change set. Do not stack notices.
- **Background review starts:** Replace this state with the existing live review path; do not leave a stale `Verify now` action.
- **Watcher unavailable:** Preserve the last local briefing and use the existing quiet reconnect state. Do not claim a change was noticed.
- **Refresh:** The loopback Mission Control payload restores the currently inferred labels from the local record.

## Component: `LikelyImpactBrief`

**Purpose:** Turn local source changes into one concise product-level review cue.

**Data:** A server-curated array of up to three opaque `{ id, label }` values. The browser receives no source path, file count, changed-file metadata, matching rule, or internal score.

**Visual:** A full-width ruled brief, using the existing Mission Control prose/list vocabulary. No card, chips, counter, heat map, percentage, progress meter, or new icon family. The labels may be separated by centered dots in reading order.

**Accessibility:** The brief is a labelled section. On arrival, announce `Verion noticed changes that may affect Billing and Dashboard.` through a polite live region once. The labels remain ordinary text, not controls. The primary action remains the existing full-size `Verify now` button, with its existing keyboard and focus behavior.

**Responsive:** At every size the brief is a single reading column. Labels wrap naturally without truncation. The action stays in the current-status area, full-width on mobile.

## Copy guardrail

Allowed: `Likely impact`, `Today’s changes probably affect`, `Billing`, `Authentication`, `Dashboard`, `Settings`, `Verify now`.

Never show: file count, changed files, filenames, paths, diff, import, component, route, endpoint, AST, graph, parser, score, confidence percentage, evidence, scanner, agent, producer, tool, or implementation rule.

## Design Pre-Flight

- [x] Uses only the locked technical/utilitarian briefing language, colors, typography, spacing, rule treatment, and existing primary action.
- [x] Adds no card, chip grid, telemetry, fake count, gradient, or new decorative motif.
- [x] Gives a developer exactly one decision: `Verify now`.
- [x] Covers no changes, unsupported change, burst changes, background review, watcher interruption, and refresh.
- [x] Uses a labelled semantic section, polite change announcement, wrapping labels, keyboard-safe existing action, and reduced-motion-safe appearance.
- [x] Self-critique: distinctiveness 3; hierarchy 4; consistency 4; accessibility 4; state coverage 4; copy 4; restraint 4; motion motivation 4. Total 31/32. No axis is below 3.

## Build handoff

**Target:** `react-vite-tailwind-engineer` equivalent. This is a Vite React SPA built with native semantic controls and the locked CSS system. No dependency is required.

Implement exactly this spec. Theme the existing interface with the locked tokens; do not redesign or re-implement its components.

Acceptance criteria:

- On a detected local source change, Verion computes up to three conservative plain-language impact labels from the changed local paths and existing project understanding.
- The dashboard receives only opaque label IDs and labels. It never receives path, count, rule, score, or source content data.
- The Mission Control home shows `Today’s changes probably affect` and uses `Verify now` as its only primary action when labels are available.
- Unsupported changes remain quiet; no impact claim is fabricated.
- The existing live review and background watching behavior remain target-agnostic and free of stale impact state.
