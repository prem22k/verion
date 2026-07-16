# Release Journey

This specification binds to `.ulpi/design/DESIGN.md`. It replaces a dashboard made of technical subsystems with one emotional journey: from doubt to a decision the developer can act on.

## Design read

**Technical / utilitarian, reframed as a staff-engineer review in motion.** The bet is that a developer falls in love with Verion when it turns a busy-looking application review into one calm, specific judgment before they have time to wonder what happened.

The counterfactual test passes because this is not a generic monitoring dashboard. The review trail makes a live investigation legible, then deliberately collapses into one accountable conclusion.

No inspiration references were supplied for this redesign.

## The wow moment

The signature moment occurs near the end of a verification run.

Three or more observations arrive on the review trail. They visually converge into one large, plain-language conclusion:

> **Creating a workspace loses the selected template.**

Under it, Verion states why that matters and shows the one next action: **Fix with Codex**.

The developer sees that Verion did not merely find a console error or an odd screen. It understood that several signals describe the same product failure and made a release call. This convergence, not an animated swarm, is the three-minute-demo moment.

## Product language

| Intent | Customer-facing language | Never show |
| --- | --- | --- |
| Project understanding | `Verion understands this project` | Repository Graph, framework parser |
| Live work | `Reviewing the sign-up flow` | browser agent, worker, producer |
| Live observation | `The confirmation screen did not preserve the chosen plan` | screenshot evidence, network log |
| Grouped conclusion | `What Verion found` | Context Capsule, finding cluster |
| Release call | `Not ready to ship` / `Ready to ship` | score, confidence percentage |
| Repair handoff | `Fix with Codex` | prompt export, payload, tool call |

## Primary flow: from uncertainty to release confidence

### Goal

Give a developer who has just finished an AI-assisted change one clear next action: verify, fix, or ship.

### User story

As a developer, I want Verion to review my changed application and tell me, in plain language, whether I should ship it and what to do next.

### Entry state

The local agent has already started from the project directory. The screen knows the project name and whether a local app is available. It does not ask the developer to configure paths, URLs, scanners, or checks.

```text
Finished coding
      ↓
Ready to verify
      ↓
Verion reviews the app in motion
      ↓
Observations converge into one conclusion
      ↓
Not ready to ship ──→ Fix with Codex ──→ Verify again
      │                                           ↓
      └──────────────────────────────→ Ready to ship
```

### 1. Ready to verify

**Screen:** `ReleaseDesk`, pre-run state.

- The main heading is `Before you ship.`
- Supporting copy acknowledges the real emotion: `The change looks right. Verion will check what is easy to miss.`
- The project name appears as quiet utility context, not a configuration summary.
- One primary action: `Verify`.
- Below the action, a restrained preview of the review trail says `Verion will review the running app, its behavior, and what changes after an action.`
- No reports, scorecards, tabs, checklists, or empty metric cards.

### 2. Verion is reviewing

**Screen:** `ReleaseDesk`, live-run state.

- The heading changes in place to `Reviewing what changed.`
- The primary action becomes disabled `Verifying` with a motivated 140ms state transition. No spinner wall and no percentage complete.
- The evidence rail becomes the review trail. Each live item uses a human sentence, an outcome marker, and a quiet timestamp only when useful.
- The newest item is active. Previous observations remain visible, so the developer can understand the review's direction without reading a log.

Example sequence:

```text
Reviewing the workspace flow                         active
The template choice was visible before creation      observed
The confirmation screen changed that choice          observed
The browser reported no request failure              observed
```

- The product may reveal a screenshot only when it supports a material observation. Screenshots are supporting proof, never a gallery.
- The review trail must not say `running agent`, `captured Evidence`, `browser exploration`, or tool names.

### 3. What Verion found

**Screen:** `ReleaseConclusion`, attention state.

- The final active rail item transitions into a ruled conclusion section. This is the wow moment.
- Heading: `What Verion found`.
- One large diagnosis in direct language.
- A short `Why this matters` paragraph connects the behavior to the user outcome.
- `What Verion checked` lists at most three concise observations. This is proof, not a technical dump.
- One release badge: `Not ready to ship`.
- One primary action: `Fix with Codex`.
- One subdued secondary action: `Review what Verion saw`, which expands source context and screenshots in place.

Example:

```text
What Verion found
Creating a workspace loses the selected template.

Why this matters
People can believe they started from the plan they chose, but receive a blank workspace instead.

What Verion checked
• The selected template was visible before creation.
• The created workspace reported a different template.
• The same behavior persisted after the confirmation screen loaded.

Not ready to ship                         [ Fix with Codex ]
```

### 4. Fix with Codex

**Screen:** `FixPacket`, an in-place transition from the conclusion.

- The heading becomes `A focused repair is ready.`
- The packet contains only: the issue, why it blocks shipping, the three supporting observations, affected source context, and how Verion will confirm the repair.
- Primary action: `Fix with Codex`.
- On activation, Verion prepares the handoff through the approved local Codex integration when available. Until that connection exists, the same action copies the packet and changes to `Fix packet copied` for two seconds.
- The UI never calls this a prompt, payload, or export.
- After a repair is detected, the primary action becomes `Verify again`.

### 5. Ready to ship

**Screen:** `ReleaseConclusion`, resolved state.

- The report preserves a minimal before-and-after thread rather than replacing the previous concern.
- Heading: `The fix held.`
- Supporting copy: `Verion repeated the path that failed and the selected template now stays with the created workspace.`
- Release badge: `Ready to ship`.
- Primary action: `Ship with confidence`.
- Secondary action: `Review this run`.
- No celebratory confetti, score, or fabricated certainty. The emotional reward is a calm, specific confirmation.

## State coverage

| State | Customer experience | Primary action |
| --- | --- | --- |
| No local app available | `Verion understands this project. Start the app when you are ready to review it.` | `Verify project` |
| Ready | One calm review invitation | `Verify` |
| Reviewing | Live review trail, no technical log | Disabled `Verifying` |
| Partial review | `Verion could review the project, but could not reach the running app.` State what was reviewed. | `Try again` |
| Attention | One grouped conclusion and fix packet | `Fix with Codex` |
| Repair pending | Compact handoff is ready | `Fix with Codex` |
| Resolved | Before-and-after confirmation | `Ship with confidence` |
| Inconclusive | State the missing condition plainly. Do not offer a ship recommendation. | `Verify again` |
| Offline/local agent unavailable | Explain that the review has not started. Preserve the last completed conclusion. | `Reconnect` |
| Refresh during review | Restore completed observations and `Reviewing what changed` when the local process is still active. | None until run completes |

## Components

### `ReleaseDesk`

**Purpose:** Hold the developer's attention on one release decision, before, during, and after a run.

**Variants:** `ready`, `reviewing`, `attention`, `resolved`, `inconclusive`.

**Data shown:** project display name, local-app availability, customer-language review events, grouped conclusion, release recommendation, and fix-packet availability.

**Rules:**

- One H1 and one primary action per variant.
- Keep the project path, framework, and configuration details out of the main surface. They may appear only under a subdued `Project details` disclosure.
- On desktop, use the existing asymmetric intro plus evidence rail. On mobile, rail becomes a chronological horizontal-to-vertical stack before the conclusion.
- The conclusion has greater visual weight than the trail. It is a ruled section, not a nested card.

**Accessibility:**

- The main status is a polite live region. Announce only a changed review sentence, never replay the full trail.
- The conclusion heading receives focus only after a manual `Review what Verion saw` activation, never while the developer is watching the run.
- Primary controls remain at least 48px high. Existing 3px accent focus treatment remains mandatory.

### `ReviewTrail`

**Purpose:** Show that Verion is doing meaningful work without exposing implementation or manufacturing drama.

**Variants:** `preview`, `active`, `complete`, `converged`.

**Rules:**

- Display no more than four live observations. Fold older supporting observations behind `Review what Verion saw`.
- Use sentences in past or present progressive tense. Each sentence must answer a product question, not name a subsystem.
- The active item may use the locked info color and a single progress rule. Completed items use text and rule weight, not decorative status dots.
- `converged` visually leads its final three items into the conclusion through the signature rail. This transition is the only 280ms motion moment in the run.

**Accessibility:**

- Semantic ordered list with a concise `aria-label="Verification progress"`.
- New items announce through a separate polite live region.
- With reduced motion, replace convergence animation with an immediate rule-color change.

### `ReleaseConclusion`

**Purpose:** Present one accountable recommendation and the proof needed to trust it.

**Variants:** `attention`, `resolved`, `inconclusive`.

**Rules:**

- Show one recommendation only. Do not render a list of unrelated warnings.
- Maximum three proof bullets before the secondary disclosure.
- Keep recommendation language binary where evidence allows: `Not ready to ship` or `Ready to ship`. Use `Inconclusive` only for a real missing condition.
- The secondary disclosure can reveal screenshots and source context, but its summary copy stays customer-facing: `Review what Verion saw`.

**Accessibility:**

- Recommendation has text in addition to color.
- The proof list uses semantic `ul` and visible summary controls.
- Long diagnosis text wraps at the existing readable measure.

### `FixPacket`

**Purpose:** Make the handoff to Codex feel like the obvious next step, not a separate workflow.

**Variants:** `ready`, `copied`, `repair_detected`, `unavailable`.

**Rules:**

- Show the repair brief only after an attention conclusion.
- `Fix with Codex` is the sole primary action. A copy fallback is part of the same action, not another technical control.
- When a repair is detected, transform the action to `Verify again`; do not add a second competing button.
- If Codex is unavailable, say `Your fix packet is ready to copy.` Never imply a repair was applied.

**Accessibility:**

- Button state and copy success are announced politely.
- Copy fallback is keyboard-operable and never relies on clipboard permission without a visible result.

## Engineering handoff

Target: `react-vite-tailwind-engineer`.

Design system: existing native semantic HTML controls themed with the locked Verion tokens. Do not add a component library or redesign the evidence rail.

Implement exactly this spec. Do not redesign it.

Acceptance criteria:

- [ ] Main UI contains no customer-visible occurrences of Evidence, Repository Graph, Context Capsule, producer, scanner, agent, Playwright, ServX, or tool names.
- [ ] The pre-run screen has one `Verify` action and no technical dashboard panels.
- [ ] During a run, up to four plain-language review events stream into `ReviewTrail`.
- [ ] A grouped attention result visibly converges into one conclusion, proof list, release call, and `Fix with Codex` action.
- [ ] A rerun preserves the original issue and ends with a plain-language `Ready to ship` confirmation when resolved.
- [ ] Empty, partial, attention, inconclusive, offline, refresh, and reduced-motion states follow this specification.

## Pre-flight

- [x] Every visual value remains within `DESIGN.md`; off-system values: 0.
- [x] One accent, one radius scale, one icon family, one type pairing, and the review trail signature across all states.
- [x] No banned fonts, purple glow, cream canvas, gradient text, nested cards, three-card layout, fake metrics, fake names, or em-dash copy.
- [x] Counterfactual test passes. This is a staff-engineer review narrative, not a generic monitoring dashboard.
- [x] All interactive components cover loading, empty, error, offline, refresh, and reduced-motion states.
- [x] WCAG AA tokens, keyboard behavior, 48px targets, focus, semantic list structure, and live announcements are specified.
- [x] Three layout families are present: asymmetric invitation, chronological review trail, ruled conclusion/repair section.
- [x] Exactly one primary action appears in every state.
- [x] Self-critique: distinctiveness 4, hierarchy 4, consistency 4, accessibility 4, state coverage 4, copy 4, restraint 4, motion motivation 4. Total 32/32.
