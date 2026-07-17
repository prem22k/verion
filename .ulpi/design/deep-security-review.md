---
feature: deep-security-review
register: product
design_system: native semantic HTML controls
binds_to: DESIGN.md
---

# Deep Security Review

Every screen must read as the same product if placed side by side.

## Design read

Security belongs inside Verion’s release judgment, not beside it as a second product. A developer should experience one deeper moment of care in an ordinary review, then receive the same single release recommendation they already trust.

## Scope

This feature adds an optional **Deep security review** step to the existing live-review path when an authorized local security service is configured for the project’s repository. It contributes only high-confidence critical concerns to Verion’s existing review material and release decision.

It does not add a scanner page, a security dashboard, a findings table, a severity filter, an attack graph, a report download, a second Verify button, a target-URL field, or a security-product brand in Mission Control.

## Flow: Review critical security concerns

**Goal:** Let Verion consider credible critical security concerns before its one release call without making the developer operate another product.

**Trigger:** A normal verification begins and a local, repository-authorized Deep security review is available.

```text
[Checking the product]
        |
        v
[Deep security review · usually a few minutes]
        |
        +-- no critical concern --> [Making a release decision]
        |
        +-- critical concern ----> [Making one release decision]
        |
        +-- cannot complete -----> [Inconclusive release decision]
```

## Live review step

Insert `Deep security review` between `Checking the product` and `Making a release decision` only when the review is actually configured and has started.

```text
Deep security review
Looking for critical concerns in this repository.
Usually a few minutes.
```

The duration is deliberately approximate. Do not show a countdown, percentage, phase name, tool availability, job identifier, or animated timer. The normal review line and Verion Presence communicate that this is part of the same review.

### Completion copy

- **No eligible concern:** `Deep security review complete. No critical concerns appeared in this review.`
- **One or more eligible concerns:** `Deep security review found a critical concern.`
- **Could not complete:** `Deep security review could not finish. Verion cannot make a complete release call yet.`

The final recommendation remains the only conclusion. Do not add a security badge or a separate second conclusion.

## Release decision behavior

- Eligible critical concerns become supporting material for the existing one recommendation, one root cause, no-more-than-three-reasons report.
- If the concern explains the release decision, the existing root cause and reasons use plain language such as `A critical credential appears reachable in the reviewed repository.` They do not mention a service, scanner, CVE feed, rule, or security framework.
- When a configured Deep security review cannot complete, Verion must prefer `Inconclusive` rather than imply that the release is safe.
- A completed review with no eligible concerns is supporting context only. It must not turn a weak functional review into `Ready to ship` by itself.

## Eligibility and trust boundary

Only a concern that meets both rules can be included:

1. **Critical:** the local service marks it critical.
2. **High confidence:** it has a stable authoritative identifier or comes from a trusted critical source defined by the adapter.

All lower-severity, ambiguous, low-confidence, duplicate, raw, or unactionable material remains outside Verion. It does not become a warning, count, muted notification, history item, or hidden list in the browser.

The local agent talks only to a loopback-only configured service and sends a pre-approved GitHub repository identity. It never sends the running app URL, credentials, local source files, raw project memory, or browser artifacts. The service owns any repository access credential; Verion never accepts or forwards one.

## States and edge cases

- **Not configured:** Do not render the step. Do not use security language or imply reduced coverage.
- **Configured and queued:** Show the step and its approximate duration after checking the running product.
- **Completed with no eligible concern:** Mark the step complete with the no-concern copy. Do not show a green security score.
- **Completed with eligible concerns:** Mark the step complete, then continue immediately to Making a release decision. Do not list concerns during review.
- **Unavailable, timed out, malformed, or unauthorized response:** Mark the step paused with the cannot-complete copy and return an inconclusive release outcome. Do not show service errors, URLs, tokens, command output, or retry controls.
- **No repository identity:** Treat as not configured. Do not inspect or infer arbitrary remotes in the browser.
- **Source changes during the deep review:** Existing verification queue behavior owns the rerun. Do not start parallel deep reviews.
- **Saved reports:** The report remains the existing bounded Staff Engineer brief. No security-specific historical surface is added.

## Accessibility and motion

- The step is a semantic item in the existing ordered review path with the written duration and state description.
- It uses existing completion/current/paused semantics, keyboard reading order, and polite announcements.
- The estimated duration is text, never color or a timer-only cue.
- No new loading animation. The existing active rule may move only at real lifecycle boundaries and honors reduced motion.
- On small screens, the duration wraps below the description without changing the review order.

## Copy guardrail

Allowed: `Deep security review`, `Looking for critical concerns in this repository.`, `Usually a few minutes.`, `No critical concerns appeared in this review.`, `Verion cannot make a complete release call yet.`

Never show: ServX, scanner, scan, CVE, CVSS, OWASP, attack path, raw finding, severity count, tool name, job ID, URL, endpoint, repository identifier, credential, log, graph, report export, or a security score.

## Design Pre-Flight

- [x] Uses the locked ruled briefing identity, existing review path, semantic colors, and one-action Mission Control hierarchy.
- [x] Adds a real lifecycle-backed review step, not a security dashboard or a second product surface.
- [x] Shows only one approximate duration and no timer, percentage, count, tool list, or raw finding material.
- [x] Covers unavailable configuration, completion, critical concerns, unsupported inputs, queued reruns, persisted reports, and narrow screens.
- [x] Specifies semantic review-path behavior, live announcements, written state descriptions, and reduced-motion handling.
- [x] Self-critique: distinctiveness 3; hierarchy 4; consistency 4; accessibility 4; state coverage 4; copy 4; restraint 4; motion motivation 4. Total 31/32. No axis is below 3.

## Build handoff

**Target:** `react-vite-tailwind-engineer` equivalent. This Vite React SPA and local TypeScript agent must preserve the Evidence-only integration boundary. No dependency is required in Verion.

Implement exactly this specification. The local adapter must be an optional Evidence Producer, configured only with a loopback service URL and approved repository identity. Theme the existing review path with the locked tokens; do not add a security page, scanner vocabulary, configuration UI, second report, or a second verification flow.

Acceptance criteria:

- A configured local Deep security review runs as one real stage of the existing verification lifecycle and shows `Usually a few minutes.` without a timer or technical details.
- The adapter emits normalized review-status and eligible critical security evidence only; lower-confidence or lower-severity material is discarded before orchestration, GPT, memory, and browser presentation.
- The service call is loopback-only, repository-only, has bounded polling/timeouts, sends no target URL or credentials, and accepts no browser-supplied service or repository values.
- Completion feeds the existing Context Capsule and one release report. Failure becomes an honest Inconclusive outcome rather than a false clean result.
- The browser never receives the local service’s name, raw findings, IDs, paths, URLs, credentials, logs, tool output, or a new security surface.
