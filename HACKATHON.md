# Hackathon

> Historical delivery reference. As of 2026-07-15, this file does not drive product or engineering decisions. Verion is now being built as a target-agnostic product; use `EXECUTION.md`, `SPRINT.md`, and `docs/planning/PRODUCT_FOUNDATION_PLAN.md` for current direction.

## Win Condition

Judges should leave with one clear thought: **"I never want to manually verify AI-generated software again."**

## Judging Criteria

Organizer criteria: **Pending — add the official judging rubric when available.**

Until confirmed, optimize for the criteria implied by the product and Build Week brief:

- A problem judges immediately recognize: AI-written software looks ready before it is verified.
- A focused, differentiated product insight: verification and release confidence after code generation.
- A working end-to-end loop, not a collection of mockups or scanners.
- Clear product craft: calm, concise, trustworthy, and visually coherent.
- A credible demonstration of OpenAI/Codex as the repair collaborator.

## Three-Minute Demo Script

### 0:00–0:20 — Hook

"AI can generate code in seconds. The hard part is knowing whether you can ship it. Verion is the verification layer for AI-built software."

### 0:20–0:45 — Set up the doubt

Show Codex creating or changing one small product flow. Click the obvious happy path once. State that it looks ready, but important interactions have not been checked.

### 0:45–1:25 — Verify

Open Verion and press **Verify**. Show the local agent exploring the app and collecting clear evidence. Emphasize that the developer did not write a checklist or test script.

### 1:25–1:55 — Diagnose

Show one user-visible failure. Present one grouped likely root cause, its evidence, and why it blocks release. Do not show a noisy list of warnings.

### 1:55–2:25 — Repair with Codex

Open the focused Verion fix brief and send it to Codex. Codex makes the narrow repair. The handoff must feel like a continuation of verification, not a separate tool.

### 2:25–2:50 — Verify again

Run Verion again. Show that the original broken path now holds and the earlier issue no longer appears.

### 2:50–3:00 — Release decision

Show **Ready to Ship**. Close: "AI writes the code. Verion gives you the confidence to ship it."

## Required Submission Artifacts

Official submission requirements: **Pending — confirm from the organizer.**

Prepare these artifacts unless the official rules say otherwise:

- A reliable live demo path and a backup recording.
- A concise project description explaining the problem, product insight, and verification loop.
- A repository with clear setup instructions and the current project state.
- A demo video or presentation link, if required by the organizer.
- Any required OpenAI Build Week submission metadata, links, or forms.

## Daily Checklist

- [ ] Read this file, `EXECUTION.md`, and `SPRINT.md` before starting work.
- [ ] Confirm today's work directly improves the three-minute demo.
- [ ] Reject or defer scope outside the MVP to `docs/planning/NOT_BUILDING.md` or `docs/planning/IDEAS.md`.
- [ ] Keep one full demo path runnable after changes.
- [ ] Test the Verify → diagnose → Codex → verify-again loop.
- [ ] Update `EXECUTION.md`, `SPRINT.md`, and `docs/planning/DECISIONS.md` or `docs/planning/QUESTIONS.md` as appropriate.
- [ ] Record a short demo rehearsal result and its highest-risk failure.

## Remaining Days

**Pending — the hackathon deadline has not been provided.**

Once known, record the deadline, the number of calendar days remaining, and the final day reserved for rehearsal, recording, and submission.

## Risks

- Chromium must be installed before the demo machine runs the local agent.
- The live Codex repair and source-file reset must be rehearsed so the deliberate defect is restored before each new run.
- A live Codex or network dependency can fail during judging; the copyable Verion brief and a prepared repair prompt are the fallback.
- The dashboard screenshot artifact is generated during verification; run Verify before opening the evidence view.
- Unknown submission rules or deadline can cause avoidable disqualification or rushed delivery.

## Rehearsal Log

### 2026-07-15 — Verification Loop

- Result: The Playwright agent detected the workspace-template state loss and returned **Needs Attention** with screenshot evidence. After the actual one-line repair, it returned **Ready to Ship**.
- Highest remaining risk: the live Codex repair transition needs a timed dashboard rehearsal before judging.

### 2026-07-15 — Dashboard Review

- Result: Captured the real dashboard diagnosis after a live Verify action. The grouped issue, source-backed evidence, screenshot, and next action are readable in one view.
- Highest remaining risk: perform the complete sequence with the live Codex repair inside the three-minute time limit.

### 2026-07-15 — Verify Timing

- Result: The live Verify action reached the full evidence-backed diagnosis in 1.4 seconds in Chromium.
- Highest remaining risk: the narrated Codex handoff and repair must be rehearsed within the remaining demo time.

## What Would Lose Us Points?

- A demo that feels like another testing framework, scanner, browser-automation wrapper, or AI coding assistant.
- Showing lots of warnings instead of one understandable, grouped diagnosis.
- A scripted-looking issue without credible exploration evidence.
- Claiming confidence without proving that the fix changed the verification outcome.
- Building breadth—accounts, analytics, integrations, workflows—instead of completing the core loop.
- A cluttered, flashy, or confusing dashboard that creates more anxiety than relief.
- A fragile demo with no fallback, unclear submission materials, or missed organizer requirements.
