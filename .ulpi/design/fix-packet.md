---
feature: fix-packet
register: product
design_system: native semantic HTML controls
binds_to: DESIGN.md
---

# Fix Packet

Every screen must read as the same product if placed side by side.

## Design read

The repair handoff should feel like a Staff Engineer has already done the careful framing. The developer makes one decision: invite Codex to repair this specific problem. Verion remains the reviewer, never an unattended code editor.

## Scope

This feature completes the existing `Needs attention → Fix with Codex → automatic review` loop. It adds one locally generated Fix Packet and one focused action within the expanded Release Confidence brief. It does not add a code editor, a packet archive, a report page, a file browser, a terminal pane, approval automation, or a second workflow.

## Flow: Repair a release blocker

**Goal:** Hand Codex the smallest trustworthy repair brief and return the developer to an automatic release review once a repair is saved.

**Trigger:** An expanded `Needs attention` release decision is selected.

```text
[Needs attention]
        |
        v
[Fix with Codex]
        |
        +-- Codex available --> [Codex opens with the local packet]
        |                           |
        |                           v
        |                    [Developer reviews and approves repair]
        |                           |
        |                      source saved
        |                           |
        +---------------------------v
                            [Verion reviews again]
        |
        +-- Codex unavailable --> [One short recovery message]
```

### Primary path

1. The developer opens a `Needs attention` report.
2. They read the existing one-call report. The only new action beneath `What I would do next` is **Fix with Codex**.
3. On activation, Verion creates a local Fix Packet from that completed review and opens an interactive Codex session rooted in the approved project directory.
4. Codex receives the packet with explicit boundaries: inspect and explain the proposed repair first; do not change files until the developer approves.
5. Mission Control replaces the button with a quiet repair-watch note: `I’m watching for the repair. When Codex saves it, I’ll review it again.`
6. The existing local watcher detects supported source edits, refreshes project understanding, and starts the existing automatic verification path. There is no second button and no simulated success.
7. The next release decision is shown through the existing live-review and Release Confidence experience.

## Fix Packet content

The packet is a private local Markdown file for Codex. It is not rendered as a new dashboard surface and is never uploaded. It contains exactly these sections in this order:

1. **Issue** — the report headline and user impact in one concise statement.
2. **Evidence** — the small set of review observations cited by the report, written as concise factual bullets. These can include technical details needed by Codex but must be redacted before writing.
3. **Likely files** — up to five relevant local files with a short reason each. These are suggestions, not proof and not a directive to edit every file.
4. **Root cause** — the report’s single likely root-cause statement.
5. **Repair request** — make the smallest safe repair; preserve unrelated behavior; start by reproducing or inspecting, explain the plan, and wait for developer approval before writing.
6. **Verification plan** — the observed reproduction context plus: run the smallest relevant project check, then save the repair so Verion can verify the same release again.

No raw project-memory JSON, credentials, screenshots, hidden analysis, full source dumps, or arbitrary shell commands are included. If no relevant file is supported, say so rather than guessing. If evidence is unavailable, do not generate a packet.

## Component: `FixWithCodexAction`

**Purpose:** Let a developer hand one completed needs-attention recommendation to an interactive Codex session without making edits automatically.

**Placement:** Immediately after the existing `What I would do next` section of the expanded `Needs attention` report. It is absent from Ready to Ship and Inconclusive reports.

**Default:** A single primary button, `Fix with Codex →`.

**Opening:** On click, show the existing primary-button pending state: `Preparing Codex…`. On success, replace it with a quiet rule-bound note: `Codex has the repair brief. I’m watching for the fix.` The dashboard does not show packet content, terminal commands, paths, evidence identifiers, or system output.

**Unavailable:** Keep the report readable and show one direct message below the button: `Codex could not open here. Install the local Codex CLI, then try again.` Do not claim that a session opened and do not offer a fake copy action.

**Repeated click:** While a request is in flight, the action is disabled. After success, a developer may choose `Open in Codex again` as a quiet text action only; it regenerates the same kind of packet from the currently selected report. Never create a queue of parallel repair sessions.

**Automatic verification:** Once a packet has opened, the repair-watch note remains until the next supported project-source change. The existing watcher is the only trigger. Its normal debounce, review lifecycle, and failure handling remain authoritative. A change that does not qualify for verification must not be presented as a repaired release.

## Local launch contract

The backend owns the local handoff. It must:

- Generate the packet under the project’s ignored `.verion/fix-packets/` directory with owner-only permissions.
- Start a **new interactive** Codex session in the approved project root, passing a prompt that tells Codex to read that packet and wait for developer approval before editing.
- Never call `codex exec`, never pass any auto-approve or sandbox-bypass option, and never write source files itself.
- Use a small platform adapter for a visible terminal/session. On systems where a visible local Codex session cannot be opened, return the unavailable state rather than silently launching a detached process.
- Keep the action loopback-only and accept only a report ID already in the project’s locally loaded release history.

The product copy may say `Fix with Codex`; implementation-specific launch mechanics remain invisible.

## States and edge cases

- **Needs attention, packet ready:** Show the action.
- **Ready to ship / Inconclusive:** No repair action. Inconclusive needs more review, not a speculative patch.
- **Opening:** Disable only this action and announce `Preparing a repair brief for Codex.`
- **Codex is unavailable:** Keep the recommendation and show the single recovery message. No copied prompt or automated edit fallback.
- **Packet material is incomplete:** Do not open Codex. Return a short message that Verion needs another review before it can prepare a repair.
- **Source changes before the launch returns:** Let the normal watcher own the follow-up review; do not start a duplicate run.
- **Codex is opened but no source changes follow:** Stay calm in the repair-watch state. Do not add timers, reminders, or notifications.
- **Refresh/reconnect:** The temporary repair-watch state may reset; the watcher and any saved source change remain the source of truth. No false claim of an open Codex session after a server restart.

## Accessibility and motion

- Button is native `<button>` with an explicit `aria-busy` pending state and minimum 48px target.
- Use an `aria-live="polite"` sentence for preparing, opened, unavailable, and waiting states.
- Keyboard: Tab focuses the action; Enter/Space activates; focus stays on the action after a successful opening.
- The repair-watch note is text plus the locked briefing rule, not a spinner or a new panel.
- Opening and status change use the locked 140–280ms transition only. Under reduced motion, update state without animated movement.
- On small screens, the button is full width but remains beneath the next-action section in the single reading flow.

## Copy guardrail

Allowed: `Fix with Codex`, `Preparing Codex…`, `Codex has the repair brief. I’m watching for the fix.`, `Open in Codex again`, `Codex could not open here. Install the local Codex CLI, then try again.`, `I need another review before I can prepare a repair.`

Never show: packet path, file paths, source excerpts, evidence identifiers, implementation logs, terminal command, process state, permissions, tool names, automation claims, or an edit-confirmation message. Never say Codex fixed anything until a new Verion release decision supports it.

## Design Pre-Flight

- [x] Uses only the locked ruled briefing identity, semantic colors, spacing, native controls, and one action vocabulary.
- [x] Adds one decision point to the existing release report, not a new report page, modal, editor, table, or technical tool surface.
- [x] Keeps exactly one primary action in the needs-attention brief and none for a ready or inconclusive decision.
- [x] Covers opening, unavailable Codex, incomplete review, duplicate activation, watcher-driven changes, refresh, and no-change waiting.
- [x] Specifies semantic button behavior, busy and live announcements, keyboard use, reduced motion, and mobile placement.
- [x] Self-critique: distinctiveness 3; hierarchy 4; consistency 4; accessibility 4; state coverage 4; copy 4; restraint 4; motion motivation 4. Total 31/32. No axis is below 3.

## Build handoff

**Target:** `react-vite-tailwind-engineer` equivalent. This is a Vite React SPA plus its loopback local-agent server. Use the existing native semantic controls and locked CSS system. No dependency is required.

Implement exactly this spec. Theme the existing interface with the locked tokens; do not redesign or re-implement its components.

Acceptance criteria:

- A selected Needs Attention report generates one private local Fix Packet with Issue, Evidence, Likely files, Root cause, Repair request, and Verification plan.
- The browser invokes one loopback-only launch endpoint with an existing report ID; it receives no raw packet, source, path, evidence ID, or process details.
- The local launcher starts an interactive, reviewable Codex session only. It never invokes non-interactive execution, auto-approval, sandbox bypass, or direct source edits.
- The UI has one `Fix with Codex` action, honest pending/success/unavailable states, and no new technical dashboard surface.
- Existing source watching automatically starts the current verification path after Codex saves qualifying project changes. No duplicate or simulated rerun is introduced.
- The feature is unit-testable through an injected launcher or pure packet generation and passes `git diff --check`, `npm run build`, and a local endpoint validation.
