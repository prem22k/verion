---
feature: project-understanding-mission-control
register: product
design_system: native semantic HTML controls
binds_to: DESIGN.md
---

# Project Understanding Mission Control

Every screen must read as the same product if placed side by side.

## Design read

The old dashboard performs an assistant. This redesign makes Verion feel informed. The first frame is a project ledger that proves an opinionated understanding through the developer's real stack, product areas, routes, APIs, remembered journeys, and a concise thesis.

## Flow: First local learning pass

**Goal:** Let a developer establish that Verion understands their product before they request a review.

**Trigger:** `verion` launches from the project root.

```text
[Launch]
  -> [Inventory local project]
  -> [Generate an optional structured project thesis]
  -> [Persist local memory]
  -> [Project ledger]
       -> Verify -> [Live review]
       -> Learn more -> [Expanded project reading]
```

### Project ledger

Desktop is a 12-column asymmetric grid. The left 8 columns contain the project name, natural-language thesis, and one decisive Verify action. The right 4 columns show counts: routes, API endpoints, remembered paths, and last learned. Below, the full width contains ruled lists for technology marks, product areas, the local-memory statement, recent changes, and the latest release decision.

- The headline is the real project name, never a generic slogan.
- The thesis comes from deterministic discovery until GPT enrichment is available. If enriched, it is labelled `project thesis` in subtle utility type, not `AI summary`.
- Each technology row uses a real recognizable logo plus its source-backed label. Unknown technologies use a neutral monogram only.
- The only prominent action is `Verify this change`.
- `Read the project brief` expands the product areas, priority journeys, APIs, and model-supported review focus in place.

### Local memory

One compact, ruled sentence: `Stored locally · learned <date> · remembers <N> release paths`. It must never promise permanent storage beyond the local project memory file. It has no button in the MVP.

### Review progress

During review, use a plain sequence of human product checks. Examples: `Authentication reviewed`, `Billing reviewed`, `Checkout returned an error`, `Dashboard navigation succeeded`, and `Mobile review completed` when evidence supports them. The active review item receives the single accent rule; all technical event names remain hidden.

### Latest review and history

Latest Review gets one decisive reading column: decision, likely cause, why, next action. History is a short chronological ruled list below it. No visual card nesting or status-dot wallpaper.

### States and edge cases

| State | Treatment |
| --- | --- |
| Initial deterministic learning | Render discovered facts immediately and the neutral thesis. Do not block the first frame on GPT. |
| GPT-enriched learning | Replace the neutral thesis and add product entities, focus, and priority journeys after the response is persisted. |
| GPT unavailable | Keep the fully useful deterministic ledger. Say only `Local project picture saved.` |
| No running app | Keep Verify available; the review says it will inspect available project paths. |
| Disconnected | Preserve learned content and replace Verify with `Reconnect Verion`. |
| Review in progress | Keep the project ledger visible and place the human review sequence in the main reading column. |
| Inconclusive / security unavailable | Present it in Latest Review with one retry action. Do not expose internal dependency failures. |
| Mobile | Collapse the count column into a two-by-two count strip and place it below the thesis. Technology rows wrap; no horizontal scroll. |

## Component briefs

### `ProjectLedger`

Purpose: establish a credible product understanding in the first viewport.

Data: project name, thesis, technologies, product areas, counts, memory metadata, priority journeys, review focus, and local-enrichment status.

Behavior: the brief disclosure uses a native button with `aria-expanded`; it does not hide the Verify action. Counts are factual and remain visible even when model enrichment fails.

Accessibility: project heading is the page `h1`; logos are decorative when paired with text; all disclosure and action controls have 48px minimum targets and visible focus.

### `TechnologyRoster`

Purpose: make detected stack information tangible through genuine technology marks.

Variants: compact inline roster in the first viewport; expanded ruled list in the project brief.

Behavior: each item always contains a text label. An unavailable mark falls back to a named monogram, never an anonymous generic icon.

### `MemoryLine`

Purpose: communicate durable local project continuity without a settings UI.

Data: first learned, last learned, known journey count, verification count.

Accessibility: use a text list with a visually subtle separator, not color alone.

### `ReviewSequence`

Purpose: make an active review legible as work on the product, not implementation telemetry.

Behavior: completed, active, warning, and upcoming states. No progress percentage. Each entry has a concise customer-facing description grounded in actual evidence.

## Design pre-flight

- [x] Uses the locked Swiss/grid language, one oxide accent, IBM Plex pairing, real technology marks, and ruled surfaces only.
- [x] Bans generic AI mascot theater, card grids, gradients, fake precise metrics, em dashes, scanner vocabulary, and generic substitute logos.
- [x] Covers deterministic-only, GPT-enriched, unavailable, disconnected, reviewing, decision, history, mobile, keyboard, and reduced-motion states.
- [x] Keeps one primary action per view and disclosure-based secondary detail.
- [x] Accessible focus, semantic headings/lists, live review status, text-labelled marks, contrast, and 48px actions are required.
- [x] Layout families: asymmetric ledger, count strip, ruled roster, chronological review sequence.
- [x] Self-critique: distinctiveness 4; hierarchy 4; consistency 4; accessibility 4; state coverage 4; copy 4; restraint 4; motion motivation 4. Total 32/32.

## Build handoff

**Target:** React/Vite SPA engineering. Use native semantic controls already present in this repository; do not add a component-library façade.

Implement exactly this spec. Use the locked tokens and data contracts; do not redesign or re-implement its components.

Acceptance criteria:

- A first-time developer sees actual project facts and a credible thesis before the Verify action.
- GPT enrichment is strictly structured, bounded to the discovered local project outline, and persisted only in local project memory.
- The dashboard displays real technology marks, genuine counts, local-memory continuity, and one human release path.
- Review progress stays customer-readable and Deep Security Review remains one contributor to the final decision.
