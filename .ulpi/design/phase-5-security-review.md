# Phase 5 — Deep Security Review

## Locked intent

Security is a capability of the same local release teammate, not a separate
scanner product. The Security route is a compact reading desk for one question:
what does this review mean for the release decision? It inherits the Home
shell, type scale, ruled dividers, narrow status language, persistent teammate,
and restrained state colors from `DESIGN.md`.

Do not expose security-engine history, source-system labels, scanner brands,
raw job states, raw identifiers, or debug payloads in the browser. Say
**Deep Security Review** and describe the developer-facing review result.

## Information hierarchy

1. A single review strip: availability/state, expected duration, and the same
   release decision shown on Home.
2. Critical concerns, then high concerns, as ruled queues.
3. One finding expands into only the useful record: location, why it matters,
   concise evidence, and the next safe action.
4. A small repair action row: `Copy Fix Prompt` always; `Fix with Verion` only
   when an actually available native repair capability is reported. It never
   writes files from this page.

No summary hero, score gauge, severity chart, scanner matrix, decorative
shield, ambient gradients, or large marketing headline.

## States and flows

| State | Strip copy and action | Queue behavior |
| --- | --- | --- |
| Available | "Ready" / "Usually a few minutes" / Start Deep Security Review | Explain that no saved concern exists yet; this is not a security guarantee. |
| Reviewing | Current review step and progress language; action disabled | Existing saved findings remain readable. |
| Completed | "Reviewed" and completed time | Empty states state that no critical/high concern was recorded in that review. |
| Concern | "Needs attention" and the shared release decision | Critical then high records are visible. |
| Unavailable | "Unavailable" with a plain local setup limitation | No fake result; no start control. |
| Failed | "Review incomplete" with Retry Deep Security Review | Preserve prior saved findings and call the release decision inconclusive unless a critical current finding already blocks it. |

Starting or retrying the review runs the normal release review flow and feeds its
outcome into the same Home decision. A critical active finding must make that
decision `Needs attention`, even without an AI provider.

## Finding record

- Severity is text plus a quiet semantic dot/chip; never colour alone.
- Order active critical findings first, then high; resolved history does not
  crowd the primary queues.
- Location is a short relative file path and line range only when safely known.
- Evidence is curated review language, never raw logs or payloads.
- `Copy Fix Prompt` copies a bounded, credential-redacted repair brief made from
  the finding plus the learned product context; it works without AI.
- Finding-specific teammate prompts name the safe finding title and focus the
  resulting citation back to the corresponding record.
- `Fix with Verion` is capability-gated. If no native edit capability is truly
  available, it is absent rather than a disabled promise.

## Accessibility and responsive rules

- The status strip is labelled and announces review progress via the existing
  live region. Retry/start remains a native button.
- Finding headings, location, evidence, and action labels remain distinct text
  for screen readers.
- A copied prompt reports success/failure with a polite status, without moving
  focus.
- At narrow widths the status facts and action stack; each finding becomes one
  single-column ruled record. Long paths wrap rather than create horizontal
  scrolling.

## Engineering handoff

- Persist normalized `SecurityFinding` records and a compact last-review state
  in local project memory. Migrate v1–v4 without losing reports, journeys, or
  existing issue history.
- Normalize only bounded, safe fields from review evidence. Never serialize
  raw engine response data to the dashboard.
- Keep generic release reporting and the finding contract synchronized so a
  critical concern cannot be displayed as ready to ship.
- Give the teammate specific security-finding citations and deterministic
  answers when no provider is configured.
- Add a direct Node check for migration, sorting, redaction, copy-prompt
  construction, and critical-decision integration.

## Preflight

- [ ] Home and Security show the same release decision for a critical finding.
- [ ] No primary UI or mission payload contains a scanner brand, raw job state,
  engine history, external URL, or raw finding ID.
- [ ] Critical/high queues, location, evidence, suggested action, and copy
  action work without an AI provider.
- [ ] Empty, unavailable, reviewing, failed/retry, and completed states have
  deliberate copy and an action only where it is truthful.
- [ ] `npm run build`, the Phase 5 direct check, and `git diff --check` pass.
