---
feature: Manual Deep Security Review
register: product
design_system: Apple HIG-inspired native semantic controls
binds_to: DESIGN.md
---

## Design Read

A developer-requested security sweep should feel like Verion has sealed the project boundary and is methodically checking the few things that can change a release decision.

**Direction:** technical / utilitarian. The distinctive bet is the Security transit line, not a dark terminal imitation, glowing radar, circular dashboard gauge, or a generic loading card. Before the scan, the equally intentional counterpart is a ruled review-coverage list that turns the developer's single choice into a clear promise. The counterfactual test passes because both surfaces describe Verion's particular release review, not reusable SaaS components.

**AI-slop bans:** no fake percentage animation, looping spinner as the primary feedback, scanner/tool logos, terminal logs, glowing gradients, security-shield stock icon, nested cards, or made-up coverage statistics.

Every screen must read as the same product if placed side by side.

## Product decision

`Verify this change` checks the project and running experience only. It must never begin Deep Security Review in the background. Deep Security Review is started only by the Security-page primary action, then its resulting critical/high findings participate in the same release decision.

The supplied ServX Attack Paths service is not the default path: it requires MongoDB, an encrypted GitHub token, and a GitHub repository identity, so it cannot honestly review any local directory. Verion's manual scan is a bounded local review. It carries forward useful coverage categories: secrets, unsafe code, dependencies, project configuration, and an optional running experience. It must describe these as review areas, never as scanner/tool internals.

## Flow: Start Deep Security Review

### Overview

**Goal:** Start a deliberate local security review and understand exactly what Verion is checking while it happens.

**User story:** As a developer preparing to ship, I want to explicitly start a security review so that I can see which release-critical areas were checked and act on any result.

**Entry:** Security page. The project has finished initial learning.

### Flow diagram

```text
[Security: Ready]
       |
       | Start Deep Security Review
       v
[Scope sealed] -> [Code paths] -> [Dependencies + configuration] -> [Running experience*] -> [Release decision]
       |                 |                     |                          |                         |
       +-----------------+---------------------+--------------------------+-------------------------+
                                             actual events only

* Skipped with an explicit reason when no local app is running.
```

### Steps and event contract

1. **Scope sealed**. Confirm the launch directory and establish the bounded review set. Emit `security_scope_started`, then `security_scope_completed` with reviewed-file count.
2. **Code paths**. Review eligible local source/config files for exposed credentials and risky dynamic execution. Emit `security_code_started`, then `security_code_completed` with normalized finding count only.
3. **Dependencies + configuration**. Review package manifests, lock-free dependency declarations where available, and relevant deployment/configuration files. Emit `security_dependencies_started`, then `security_dependencies_completed`.
4. **Running experience**. When Verion knows a local target URL, review the live product signals allowed by its existing browser boundary. Otherwise emit `security_running_skipped` with “No local app was running.”
5. **Release decision**. Normalize findings, save local history, and recompute the shared release decision. Emit `security_decision_started`, then terminal `security_completed` or `security_failed`.

The server derives every displayed station from these events. It may show completed-station count, never time-based or guessed progress.

### States

| State | Primary content | Primary action | Recovery |
| --- | --- | --- | --- |
| Ready, no saved review | One launch surface with four review areas and one start action | Start Deep Security Review | No stations, findings, code locations, status result, or invented prior review |
| Ready, saved review | Latest saved decision with Start again | Start Deep Security Review again | Show queues only for the saved review |
| Preparing | First station current, button becomes disabled “Review in progress” | None | Preserve state on refresh via server mission state |
| Reviewing | Transit line with completed/current/pending/skipped stations and current factual message | None | The user can leave the page; no duplicate start |
| Clean | All applicable stations complete, concise “No critical or high concern found in this review” | Start again | Clarify this is not a guarantee |
| Findings | Completed line and finding queues ordered critical then high | Fix / Copy Fix Prompt | Keep same shared release decision visible |
| Partial | Completed/skipped stations, exact non-sensitive limitation | Review again | Never present partial coverage as clean |
| Failed | Failed current station, factual error text | Retry Deep Security Review | Preserve completed stations only if saved by server |
| No local app | Running-experience station is visibly skipped, not failed | Continue scan | Explain repository review still completed |

Refresh during a review restores the server's current station and completed station list. A second tab receives the same state and cannot start a duplicate review. Route changes do not cancel a review. Browser close does not cancel a local server-side review.

## Screen composition

1. Compact `Security` heading and one-sentence shared-release-decision explanation.
2. **First scan launch surface.** When no manual security review is saved, this is the only Security module. Its title is `Ready for a deeper review`; supporting copy says the review starts only when the developer chooses. A single ruled list names exactly four review areas: `Credentials and secrets`, `Unsafe code paths`, `Dependencies and configuration`, and `Running local app`. Each has one plain-language scope sentence. These are review areas, not scanner/tool labels. The surface ends with the one filled `Start Deep Security Review` action and the factual note `No project files are changed.`
3. `Security transit line` becomes the focal surface only after the developer starts a review or when displaying its saved outcome. It has a short plain-language status sentence, five horizontally arranged stations on desktop and a vertical ruled line on narrow screens. Each station contains only a 16px state marker, station name, and one-line actual status. This is one surface, not five cards.
4. Beneath the active/saved transit line, one narrow facts row: `Scope`, `Release decision`, `Last reviewed`. It never appears before the first scan. Expected time is shown only before start as “Usually a few minutes”; remove it during review rather than invent an ETA.
5. Critical queue, high queue, then affected code remain as today. They appear only after a saved review, not as empty decorative blocks above the transit line.

## Finding quality contract

Deep Security Review must be a functioning local vulnerability review, not a pattern-demo surface.

- Scan bounded eligible project code and configuration for high-signal credential exposure, dynamic code execution, HTML injection sinks, disabled TLS validation, unsafe container configuration, and public-storage configuration.
- For npm projects with a `package-lock.json`, run the fixed non-mutating dependency audit only after the developer chooses Start. Normalize high and critical known-vulnerability results into the same finding model.
- Examine the detected loopback app only after Start. Record a cross-origin concern only when the response combines wildcard origin access with credential allowance; a missing local app is a skipped review area, never an error.
- Do not turn test fixtures, test harnesses, generated examples, or Verion's archived repository-service experiment into release findings. Ignore conventional test/fixture paths and content that is clearly a test harness. Never show raw matched secret values.
- Tests must prove one real positive finding, a known-vulnerability audit parser result, and rejection of test/fixture false positives. A security result may only be saved after the manual review endpoint completes.

## Component: SecurityTransitLine

### Purpose

Show an intentional manual review moving through real, understandable release-check stations.

### Data contract

```ts
type SecurityReviewStationId = 'scope' | 'code' | 'dependencies' | 'running_experience' | 'decision'
type SecurityReviewStationState = 'pending' | 'current' | 'completed' | 'skipped' | 'failed'

interface SecurityReviewProgress {
  state: 'ready' | 'reviewing' | 'completed' | 'concern' | 'partial' | 'failed'
  currentMessage?: string
  stations: Array<{
    id: SecurityReviewStationId
    label: string
    state: SecurityReviewStationState
    detail: string
  }>
}
```

### Visual and interaction rules

- Use the locked Canvas, Surface, Border, Text, Muted, Accent, Success, Warning, and Danger tokens only. Accent is reserved for the current marker. Success marks completed, Warning marks skipped/partial, Danger marks failed/findings. Text on Canvas and Surface retains the recorded 15.8:1 / 4.7:1 contrast; state controls meet 3:1.
- The live marker is a solid 16px Accent disc. At most once per real station transition it uses a 280ms opacity/transform settle. The joining rule fills only on a completed event. It never loops and respects `prefers-reduced-motion`.
- Markers have non-color meaning: completed `✓`, current `•`, skipped `–`, failed `!`, pending empty. Do not rely on color alone.
- `Start Deep Security Review` is the only filled action. It moves into the footer of the transit surface on desktop and remains full-width on mobile. While running, it is disabled and reads `Security review in progress`.
- Do not add Cancel until the backend safely supports cancellation. Leaving the page is safe and does not imply cancellation.

### Accessibility

- The transit line is an ordered list with each item exposing `aria-current="step"` for the current station; status text stays visible.
- A concise `role="status" aria-live="polite"` message announces only station changes, terminal state, or a user-initiated retry. No repeated polling announcements.
- Start/retry is a native button, reachable by Tab/Enter/Space. Disabled state uses both `disabled` and explanatory text.
- Focus remains on the Start button after transition to reviewing; on completion, focus is not stolen. On failure caused by the user action, move focus to the retry button once.
- Touch targets are at least 44px. On mobile, station details wrap; no horizontal scrolling.

### Responsive behavior

| Width | Transit layout |
| --- | --- |
| ≥1024px | Five equal ruled stations in one surface; data row aligns at right |
| 640–1023px | Transit line wraps to a two-row grid while retaining order and joins |
| <640px | Single vertical ruled list, full-width action, one-column facts row |

## Backend requirements

- Split project verification from security review. `POST /api/verify` must exclude Deep Security Review.
- `POST /api/security/review` must run the manual local review only, with an exclusive `securityReviewRunning` guard.
- Emit named security-progress events over the existing local event stream. Persist enough current progress in server memory to restore after dashboard refresh.
- Make the local reviewer emit stages around actual bounded work. It must not invoke the ServX GitHub/Mongo service, any external scanner process, or arbitrary network target.
- Normalize critical and high findings into the existing shared decision/history contract. Preserve the existing Repair/Codex workflows.
- Add a test fixture with one deliberate high-signal finding and assert: Security begins `Ready`; no scan begins before the endpoint is called; progress receives real stations; the final security finding alters the shared release decision.

## Design Pre-Flight

- [x] Uses only locked tokens, SF/system product type, 4/8/12/16/20/24/32 spacing, 8/12/16 radius, and locked motion.
- [x] One accent, radius scale, icon family, and product voice. Every screen must read as the same product if placed side by side.
- [x] No banned fonts, gradient/glow, terminal treatment, generic shields, three-card pattern, fake stats, buzzwords, or em dash copy.
- [x] The slop and counterfactual tests pass. The transit line is tied to Verion's concrete station contract.
- [x] Ready-without-review, ready-with-saved-review, preparing, reviewing, clean, findings, partial, failed, skipped-app, refresh, duplicate-start, route-change, and offline/error states are covered.
- [x] Keyboard, live announcement, semantic-list, non-color, reduced-motion, 44px target, and mobile behavior are specified.
- [x] Security page has three layout families: heading, transit surface, ruled finding lists. One focal action only.
- [x] Cognitive load stays under four simultaneous decisions: understand current station, wait, inspect a result, or retry.

Self-critique: distinctiveness 3, hierarchy 4, consistency 4, accessibility 4, state coverage 4, copy quality 4, restraint 4, motion motivation 4. **Total 31/32.** Revision: removed the idle transit line and empty finding queues because they implied work had already occurred. The new launch surface shows review coverage and one developer decision; the transit line appears only for real activity or a saved result.

## Build handoff

**Target agent:** `react-vite-tailwind-engineer` equivalent for this Vite/React SPA. No additional component library is necessary; retain the existing Apple HIG-inspired semantic control system and theme it with the locked tokens. Implement exactly this spec. Do not redesign or re-implement its components.

**Files:** `src/App.tsx`, `src/styles.css`, `server.ts`, the local Deep Security Review producer, and focused reliability/browser tests.

**Acceptance criteria:**

- [ ] A developer must press `Start Deep Security Review`; normal Verify never starts it.
- [ ] Before a first manual review, Security shows only the launch surface and its four review areas; it shows no empty queues, code locations, status result, or transit line.
- [ ] The UI shows the five factual review stations and advances only on real server events.
- [ ] Refresh and route changes preserve running state; double-start is prevented.
- [ ] No external ServX, MongoDB, GitHub repository token, scanner tool, or hidden network request is required.
- [ ] Clean, concern, skipped, partial, and failure states explain coverage honestly.
- [ ] Findings still affect the shared release decision and retain their existing repair actions.
- [ ] Test fixtures and the archived prototype never become live-release findings; an intentional vulnerable source file and high/critical npm audit data do.
- [ ] Build, reliability, browser, security, and package checks pass.
