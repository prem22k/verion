---
feature: project-understanding-mission-control
register: product
design_system: Apple HIG-inspired native semantic controls
binds_to: DESIGN.md
---

# Compact Mission Control

Every screen must read as the same product if placed side by side.

## Design read

This is a working release desk, not an introduction to Verion. The first viewport must let a developer read their project, see what changed, and start a review without scrolling through branding.

## Layout contract

- A 12-column desktop grid with 16px gaps; mobile is one column.
- `Project control strip` spans all 12 columns. It contains the project name at 30–40px maximum, a one-sentence understanding, the single Verify action, compact facts, and the detected stack.
- `Local Memory`, `Verify`, and `Deep Security Review` occupy four-column supporting modules.
- `Recent Changes`, `Latest Review`, and `History` occupy eight-column reading modules. Latest Review receives the richest prose area.
- Each module is one surface. Lists and review content render directly inside it with dividers. No nested cards, hero bands, full-bleed section backgrounds, oversized headings, or numbered kickers.
- The app owns the viewport. Native browser scrollbars are suppressed, while its content remains reachable via wheel, touch, and keyboard scrolling.

## Flow: Read project and begin a review

**Goal:** Let a developer assess the current project picture and begin a context-aware release review.

**User story:** As a developer, I want to see what Verion learned and what changed so I can decide whether to verify the current change.

**Trigger:** `verion` opens its local dashboard.

```text
[Local project memory]
  -> [Compact project control strip]
       -> Verify this change -> [Human review progress] -> [Latest Review]
       -> Read the project brief -> [Inline project detail]
```

### States

| State | Treatment |
| --- | --- |
| Initial learning | Render deterministic project facts immediately in the control strip. |
| Enriched understanding | Replace the fallback thesis and populate the inline project brief. |
| GPT unavailable | Retain the useful deterministic picture. Do not add an error module. |
| Disconnected | Preserve all modules and replace Verify with `Reconnect Verion`. |
| Reviewing | Keep the compact control strip, then show customer-readable review steps. |
| No release decision | Keep Latest Review as a small empty reading state. |
| Security unavailable | Show one factual Deep Security Review state, never scanner terminology. |

## Component briefs

### ProjectControlStrip

Purpose: establish real project context in a single dashboard module.

Data: project name, thesis, detected technologies, route count, API count, remembered paths, last learned time, current connection status.

Behavior: `Verify this change` is the one primary action. `Read the project brief` is a native disclosure button with `aria-expanded`. Project facts are always visible, including when enrichment is unavailable.

Responsive: desktop uses main reading area plus a fixed fact panel; mobile stacks the fact panel below the action row. Project name remains at or below 32px on mobile.

Accessibility: project name is the page `h1`; focus is always visible; technology logos are decorative when paired with a text label; action targets are at least 44px.

### DashboardModule

Purpose: provide a small, stable reading area for a single release concern.

Variants: `supporting` (four columns), `reading` (eight columns), `verify` (dark, one primary action).

Behavior: prose wraps; lists use dividers inside the same module; no module may create horizontal overflow. Empty and unavailable states use text, not placeholder charts or decorative status dots.

Responsive: every variant becomes one full-width module under 768px.

Accessibility: headings identify each region. Status is always conveyed in text in addition to color. Keyboard users can move through the same linear document order as visual users.

### LatestReview

Purpose: give the release decision the largest reading surface without imitating a report page.

States: ready to ship, needs attention, inconclusive, and empty. `Fix with Codex` appears only for an actionable needs-attention decision. `Verify again` appears only for inconclusive reviews.

## Pre-flight

- [x] The design uses the locked compact technical/utilitarian product language and no homepage-scale typography.
- [x] One primary action is visible; supporting actions are subordinate disclosures or decision-specific repairs.
- [x] No equal three-card row, nested cards, decorative hero, fake metrics, gradient, mascot, or scanner vocabulary is introduced.
- [x] Deterministic, enriched, unavailable, disconnected, reviewing, empty, decision, history, mobile, keyboard, and reduced-motion states are covered.
- [x] Desktop and mobile preserve one linear keyboard order; controls retain visible focus and 44px targets.
- [x] Browser-level horizontal and vertical overflow is absent; the viewport app shell has no horizontal overflow.
- [x] Self-critique: distinctiveness 3; hierarchy 4; consistency 4; accessibility 4; state coverage 4; copy 4; restraint 4; motion motivation 4. Total 31/32.

## Build handoff

**Target:** React/Vite SPA engineering.

Implement exactly this spec. Theme native semantic controls with the locked product tokens; do not redesign or re-implement its components.

Acceptance criteria:

- The dashboard first frame shows project context and Verify without an oversized brand or project hero.
- Project Understanding, Local Memory, Recent Changes, Verify, Latest Review, Deep Security Review, and History are compact modules with clear task hierarchy.
- No module or viewport has horizontal overflow. Browser-level scrollbars remain absent while all content remains keyboard, wheel, and touch reachable.
- Technology marks, project counts, local-memory wording, and human review progress use real data only.
