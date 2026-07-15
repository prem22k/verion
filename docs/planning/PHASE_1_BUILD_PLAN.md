# Phase 1 Build Plan

## Today’s Objective

Make the non-negotiable MVP build-ready by defining one complete vertical slice. Do not add application code until the proposed defaults below are approved.

## The Slice We Are Shipping

Verion receives a local application URL, explores one realistic user journey, records evidence, presents one grouped release-blocking diagnosis, prepares a focused Codex brief, and shows a second verification run after the repair.

The product ends each run with one clear recommendation:

- **Needs Attention** when the verified user path fails.
- **Ready to Ship** when the same path holds after the repair.

## Proposed Defaults Awaiting Approval

- **Demo target:** a deliberately small companion application with one realistic, user-visible broken path.
- **Runtime:** a TypeScript local agent and TypeScript web dashboard sharing one result contract.
- **Verification focus:** functional exploration plus evidence capture; an optional console or accessibility signal may support the same diagnosis but is not a separate scanner.
- **Codex handoff:** a concise copyable fix brief used in the live demo.

These defaults correspond to Options A in Questions 1–4 and minimize Build Week reliability risk.

## Vertical-Slice Contract

### 1. Start Verification

The dashboard provides one primary **Verify** action. Starting a run requires only the target application URL. It does not ask the developer to write a test plan or choose scanners.

### 2. Explore and Collect Evidence

The local agent records a small, reviewable trail:

- Current step and plain-language action.
- Page URL and outcome.
- Screenshot at meaningful moments.
- Browser console errors and failed network requests when present.
- The observed failed user outcome.

The initial exploration should be intentionally narrow and reliable: one user journey plus one realistic edge interaction that exposes the issue.

### 3. Produce One Diagnosis

The result contains one issue group—not a list of raw findings:

- A concise user-impact title.
- Release recommendation: **Needs Attention**.
- Likely root cause in plain language.
- Connected symptoms and supporting evidence.
- Expected behavior and the failed behavior.

### 4. Prepare the Codex Brief

The dashboard presents a copyable brief containing only what helps Codex repair the issue:

- User impact and reproduction steps.
- Likely root cause and evidence.
- Relevant source locations when the agent can identify them.
- Expected behavior and verification requirement.

Verion prepares the context; Codex remains the repair collaborator.

### 5. Verify Again

The second run replays the original verification path. The dashboard compares the result to the first run in plain language:

- The original issue no longer appears.
- The repaired path completes successfully.
- The release recommendation changes to **Ready to Ship**.

## Dashboard States

1. **Ready to verify** — one target, one action, no configuration wall.
2. **Verifying** — calm progress with current exploration step and captured evidence.
3. **Needs Attention** — one diagnosis, evidence, and the next action: prepare or copy the Codex brief.
4. **Ready to verify again** — the repair has been applied; the original path is ready for confirmation.
5. **Ready to Ship** — the second run confirms the original issue is resolved.

## Acceptance Criteria

- A first-time viewer understands the product within thirty seconds.
- The local agent visibly performs exploration rather than replaying a generic warning.
- One meaningful issue is shown with evidence and a grouped likely cause.
- The Codex brief is focused enough to repair the issue without a separate investigation.
- The second run visibly changes the release decision based on observed behavior.
- No dashboard surface implies accounts, team workflows, analytics, generic test management, or broad scanning.

## Explicitly Out of Scope

- Multiple applications or configurable verification policies.
- Broad security, performance, visual, or accessibility scanning.
- Direct automated code modification by Verion.
- Historical runs, user accounts, collaboration, notifications, CI/CD, or integrations.

## Approval Gate

Before application code begins, approve the proposed defaults above or resolve the corresponding questions in [`QUESTIONS.md`](QUESTIONS.md). After approval, the first implementation task is the shared run-result contract and the dashboard’s five states.
