---
feature: app-shell-and-assistant
register: product
design_system: Apple HIG-inspired native semantic controls
binds_to: DESIGN.md
---

# Two-page Shell and Persistent Teammate

Every screen must read as the same product if placed side by side.

## Design read

Verion is a local command center with one continuous teammate, not two dashboards plus a chat widget. The shell must preserve the developer's project context while aggressively prioritizing the next release decision.

## Layout contract

Desktop uses a compact header, a main reading region, and a persistent teammate panel. The teammate panel occupies roughly one third of available width without obscuring Home or Security content. Mobile keeps the same conversation in an explicit drawer or assistant mode.

Primary navigation contains only `Home` and `Security`. Provider/model setup is secondary and never competes with the primary release path.

### Home hierarchy

1. Project control strip: project understanding, current change state, compact facts, and `Verify this change`.
2. Latest release decision and likely impact.
3. Recent changes and important user journeys.
4. Local Memory and history as compact supporting detail.

### Security hierarchy

1. Security review availability, estimated duration, and start/progress state.
2. Critical findings.
3. High findings.
4. Affected file/line, explanation, suggested action, and repair actions.

## Flow: Ask the project teammate

**Goal:** Let a developer get a grounded answer about the current project without re-explaining context.

**Trigger:** The developer opens Home or Security, selects a starter question, or enters a question.

```text
[Home or Security]
  -> [Persistent teammate sees current project context]
  -> [Developer asks a project question]
  -> [Grounded response with citations]
       -> [Open cited detail]
       -> [Copy Fix Prompt when the issue is actionable]
```

### States

| State | Treatment |
| --- | --- |
| No provider | Keep project context visible. Explain that deterministic project understanding and review are still available. Do not show an empty chat shell. |
| Ready | Show three context-sensitive suggested questions and a concise input. |
| Responding | Preserve prior messages, show one interrupt control, and announce progress. |
| Interrupted | Keep the partial answer clearly marked and offer Retry. |
| Cited response | Render compact fact/finding citations that open the relevant detail. |
| Provider unavailable | Preserve the conversation and show a factual retry state. |
| Security finding selected | Suggested questions shift to impact, affected code, and repair preparation. |

## Component briefs

### `AppShell`

Purpose: retain project, page, model, and conversation state across Home and Security.

Variants: desktop split view; mobile content plus assistant drawer.

Behavior: switching pages updates the teammate's available context but does not reset its conversation. Browser back/forward preserves page selection. The page heading remains the main landmark; the teammate is an `aside` with an accessible label.

Accessibility: `Home` and `Security` are links with `aria-current="page"`. Tab order is header, primary page actions/content, then teammate. On mobile, opening the teammate moves focus into the drawer and Escape returns focus to its trigger.

### `ProjectControlStrip`

Purpose: establish what Verion knows and the next release action before secondary detail.

Data: project name, thesis, technologies, counts, latest change state, last decision, and local-memory freshness.

Behavior: `Verify this change` is the only primary Home control. The project brief is a subordinate disclosure. It never includes an oversized product name or generic reassurance copy.

### `TeammatePanel`

Purpose: provide a persistent project-aware conversation surface.

Variants: ready, responding, no-provider, unavailable, interrupted, cited response.

Data: local conversation, selected provider/model metadata, assistant messages, citations, and safe tool activity summaries.

Behavior: answers distinguish discovered facts, review observations, and model inferences. Raw API keys, internal execution traces, and unredacted secrets are never shown. Tool activity uses human labels such as `Reading the latest review`, not internal tool names.

### `SecurityFindingRow`

Purpose: make one security concern understandable and repairable without turning Security into a scanner console.

Behavior: critical and high findings expose a file/line reference, explanation, suggested action, `Copy Fix Prompt`, and a capability-gated native repair action. A finding contributes to the shared release decision.

## Repair approval contract

- A native repair begins only from an identified issue or finding.
- Verion must show affected files, proposed changes, and a verification plan before writing.
- The developer explicitly approves or declines the proposal.
- Verion may write only approved files inside the project root.
- After writing, Verion runs the scoped verification plan and shows the result.
- `Copy Fix Prompt` is always available for actionable issues, regardless of provider capability.

## Pre-flight

- [x] The locked technical/utilitarian language is retained across Home, Security, and the teammate panel.
- [x] There are exactly two primary navigation destinations and one primary action per page.
- [x] The teammate is a persistent contextual workspace, not a floating generic chat pattern.
- [x] Home, Security, no-provider, unavailable, responding, interrupted, cited, security, repair, keyboard, and mobile states are specified.
- [x] No hero, equal three-card row, nested card, gradient, fake metric, scanner term, or decorative status theater is introduced.
- [x] Focus, landmark, live-region, Escape, and mobile-drawer behavior are specified.
- [x] Self-critique: distinctiveness 3; hierarchy 4; consistency 4; accessibility 4; state coverage 4; copy 4; restraint 4; motion motivation 4. Total 31/32.

## Build handoff

**Target:** React/Vite SPA engineering.

Implement exactly this spec. Theme the existing native semantic controls with the locked tokens; do not redesign or re-implement its components.

Acceptance criteria:

- Home and Security share one shell and one uninterrupted local conversation.
- The first Home view establishes project context and the next release action without a landing-page hero.
- Security findings use the same language and release-decision model as Home.
- The teammate stays grounded in project context and never exposes credentials or internal implementation names.
