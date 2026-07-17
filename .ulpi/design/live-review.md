---
feature: live-review
register: product
design_system: native semantic HTML controls
binds_to: DESIGN.md
---

# Live Review

Every screen must read as the same product if placed side by side.

## Design read

The review is a quiet, observable act of professional judgement. It should feel like an experienced reviewer tracing the release path, never like a terminal, scanner, or staged agent spectacle.

## Scope

This replaces the passive `Reviewing now` state after the developer presses **Verify**. It does not add a new product area, navigation item, or technical inspection surface. Its only job is to answer four questions in the moment: what Verion understands, what changed, what it has completed, and what it is checking now.

## Flow: Verify a release

**Goal:** Let a developer remain calm and informed while Verion reviews the latest project state.

**Trigger:** The developer presses **Verify** from Mission Control, or an approved local change starts a background review.

```text
[Mission Control]
       |
       | Verify
       v
[Live review]
       |
       +-- understand project ------- complete
       +-- review latest changes ---- complete
       +-- check the product -------- current
       +-- make a release decision -- next
       |
       v
[Release decision on Mission Control]
```

### Entry and active state

The ordinary Mission Control lists recede while the masthead becomes the review surface. The page title is `Reviewing the latest version.` The small Verion presence moves on its existing review orbit; there is no spinner, percentage, stopwatch, fake log, or agent count.

Use a single ruled review path, in this order:

1. **Understanding this project**
   - Completed copy: `Verion refreshed its picture of the product and the parts that matter.`
2. **Reviewing what changed**
   - Completed copy when changes exist: use the curated change groups already shown on Mission Control.
   - Completed copy with no saved change context: `Verion compared the current project with what it already knows.`
3. **Checking the product**
   - Current copy when a local app is found: `Looking through the running experience and the paths people rely on.`
   - Current copy otherwise: `Reviewing the project paths Verion can inspect right now.`
4. **Making a release decision**
   - Pending copy: `Verion will bring the observations together into one clear recommendation.`
   - Current copy: `Bringing the review together into one release recommendation.`

Each step has only one of three visual states: completed (a quiet check), current (teal rule and live Verion presence), or next (muted). Completion must come from actual review lifecycle events; never advance the display on a timer.

The `What changed` strip appears directly below the active step. It uses at most three existing plain-language change groups. It says `What changed` and the group labels. If nothing has changed, say `Reviewing the current version against what Verion already knows.` Do not show file names, line counts, route syntax, diff output, or technical categories.

The only action while reviewing is a disabled `Verion is reviewing` button. The developer should not need to steer the work.

### Live observations

While **Checking the product** is current, a small ruled `What Verion noticed` list grows beneath the change brief. It is an observation feed, not a log. It contains at most six latest unique observations and each item is a complete sentence in product language.

Examples of the permitted voice:

```text
✓ Dashboard loaded.
✓ Sign-in completed.
⚠ Checkout returned HTTP 500.
⚠ Console error detected.
```

Only show an observation when the local review actually supports it. The current browser review may not yet exercise sign-in, profile updates, or checkout. In those cases, do not manufacture a success statement. Prefer a specific human outcome when a recognizable product action is present; otherwise use a safe general outcome such as `The running app loaded.` or `An app request returned HTTP 500.`

The stream never includes request URLs, endpoint names, error bodies, stack traces, browser console text, filenames, tool names, counts, timestamps, or IDs. A teal quiet check denotes a confirmed outcome; the locked warning color denotes something that needs attention. The list does not animate as a feed or auto-scroll. New observations use a single 140ms opacity transition only to establish arrival; reduced-motion removes it.

Before the first real observation, show `Watching the running experience for anything that could affect people.` When the project has no available running experience, omit this section rather than implying browser activity.

### Completion

When the decision arrives, retain the completed review path for a brief 500ms handoff, then return to Mission Control with the relevant report expanded. The normal Current Status wording becomes the one release recommendation.

### Error and interrupted states

- **Local agent unavailable:** preserve the last completed steps, stop the active state, say `Verion lost touch with this project before the review finished.` Offer the existing `Reconnect` action.
- **Review cannot finish:** preserve completed steps, mark the current item as `Paused`, and say `Verion could not finish this review. Check that the project is ready, then try again.` The next primary action is `Verify again`.
- **Refresh during review:** recover the review snapshot from the local agent’s current status endpoint. If it cannot be recovered, show the normal Mission Control state and do not claim a review is still in progress.
- **No running app found:** stay in the same review flow with the project-path copy above. Do not manufacture a browser observation.

## Components

### `LiveReview`

**Purpose:** The customer-facing active verification surface.

**Data:** `review` payload with a small ordered list of customer-language steps, an optional curated change summary, whether a local running product is available, and a current step ID. It must not contain evidence, file paths, endpoints, identifiers, tool names, or implementation metadata.

**Responsive behavior:** Two columns remain on desktop only when the release status has enough room. On mobile, the status and review path stack in the existing Mission Control order.

**Accessibility:** `aria-live="polite"` announces only transitions, for example `Finished understanding this project. Now checking the product.` The ordered review path uses a semantic list. The current list item includes visible text `Checking now`; color alone never carries state. Existing reduced-motion rules stop the orbit motion.

### `ReviewPath`

**Purpose:** Make the review legible without turning it into telemetry.

**Interaction:** Read-only. Completed steps remain visible; current content is replaced only when a real lifecycle event arrives. It has no disclosure, counters, or controls.

**Visual rule:** It is the page’s signature continuous rule. Use the locked border, accent, muted, success, spacing, and motion tokens. Never use cards, progress rings, spinners, logs, tables, or timestamps.

### `ChangeBrief`

**Purpose:** Explain the current review’s context in human terms.

**States:** existing changes, no detected changes, unavailable. Do not show an empty panel.

### `ObservationBrief`

**Purpose:** Translate live, normalized local findings into a bounded human-readable account of what Verion has noticed while checking the product.

**Data:** An ordered, curated list of `{ tone: success | warning, message }`. Its inputs are local verification observations only. It must be generated server-side from normalized findings and must never pass raw finding fields into the browser.

**States:** waiting (one quiet sentence), observations (up to six unique lines), no running experience (omitted), paused (preserve prior observations without adding new ones). A warning is not a release verdict; it is an observation to be considered in the eventual decision.

**Accessibility:** Use a semantic list. Announce only the newest observation through one polite live sentence; do not re-announce the entire list on every update. The warning marker must have text equivalent such as `Needs attention`, not color alone.

## Copy and terminology guardrail

Allowed customer language: `understanding`, `review`, `checking`, `what changed`, `release decision`, `recommendation`, `product`, `running experience`.

Never expose: evidence, producer, browser automation, Playwright, repository graph, AST, parser, Context Capsule, scanner, GPT, model, raw request or endpoint detail, raw console text, network detail, screenshot ID, file path, route path, or internal agent terminology. `Console error detected.` is permitted because it is a concise product-relevant warning, not raw console output.

## Design Pre-Flight

- [x] Binds to the existing locked technical/utilitarian identity, palette, typography, spacing, radius, icon treatment, and motion.
- [x] Keeps one motivated signature: the continuous ruled review path and Verion presence.
- [x] Uses no banned cards, gradient, generic spinner, fake telemetry, em dash, buzzword, or artificial metric.
- [x] Covers active, no-change, no-running-app, interrupted, error, refresh, and completed states.
- [x] Covers waiting, successful, warning, paused, and absent observation states without inventing actions that the review did not perform.
- [x] Provides one primary action, visible status text, semantic list structure, polite announcements, keyboard-safe controls, and reduced motion.
- [x] Uses Mission Control masthead, ruled path, and briefing strip layout families rather than a new visual system.
- [x] Self-critique: distinctiveness 3; hierarchy 4; consistency 4; accessibility 4; state coverage 4; copy 4; restraint 4; motion motivation 4. Total 31/32. No axis is below 3.

## Build handoff

**Target:** `react-vite-tailwind-engineer` equivalent. This is a Vite React SPA; use the project’s native semantic controls and locked CSS tokens. Do not add a component library or dependency.

Implement exactly this spec. Theme the existing interface with the locked tokens; do not redesign or re-implement its components.

Acceptance criteria:

- Pressing Verify replaces the passive loading label with the live customer-language review path.
- Progress is emitted from actual lifecycle boundaries, not a front-end timer.
- Meaningful observations stream from actual normalized findings and are converted server-side into bounded product language.
- Every active and completed step, plus change context, is plain English and target-agnostic.
- The browser payload and UI contain no prohibited technical terms or raw implementation data.
- Completion returns to the expanded release decision; error and reconnect states preserve clear context.
- Light, dark, mobile, keyboard, screen-reader, and reduced-motion behavior remain aligned with `DESIGN.md`.
