---
project: Verion
feature: Phase 4 assistant orchestration and safe tools
register: product
design_system: Apple HIG-inspired native semantic controls
binds_to: .ulpi/design/DESIGN.md
---

# Phase 4: Assistant Orchestration and Safe Tools

## Design Read

The teammate becomes a compact research desk: it names what it knows, asks before sharing redacted code with a configured model, and never pretends it has unrestricted access.

**Direction:** retain Verion's locked technical / utilitarian direction. The assistant must feel like a careful colleague's notebook beside the release ledger, not a generic chat product. The counterfactual test passes because source permission, provenance, and a fixed local scope are specific to a release teammate rather than a general-purpose assistant.

No new inspiration is introduced. This feature reuses the locked Apple-derived precision, dense ruled reading, system type, quiet neutrals, and one Action Blue from `DESIGN.md`.

**Identity lock:** Every screen must read as the same product if placed side by side.

## Product boundary

The local Verion process, not the browser or model, chooses the smallest read-only context needed for a question. It has a fixed allowlist of local abilities:

- project understanding
- local memory
- current change and likely impact
- release reports and known issues
- normalized security findings
- remembered journeys
- scoped project-file search and redacted relevant-file reads
- repository relationships, translated to ordinary language

The assistant receives no shell, network, environment, credential, arbitrary path, process, write-file, or patch tool. A selected model may explain the already assembled context, but it does not choose local actions. Models without tool calling work through the same server-side context assembly. Without an available model, Verion returns deterministic local answers from the same bounded context.

Source is exceptional. Metadata such as a discovered relative filename can be used locally. Before Verion sends a redacted source excerpt to a configured provider, the developer must explicitly choose `Use code context` for that single question. The assistant must not carry consent to a later question. Declining returns the best local answer without source transmission.

`Prepare this for Codex` only prepares guidance. It must never open Codex, generate a patch, write project files, or change a release decision. Opening Codex remains a separate, confirmed repair action.

## Flows and states

### Flow: Ask about the project

**Goal:** Get a grounded answer without re-explaining the application.

**Trigger:** A starter prompt or a submitted question in the persistent teammate panel.

```text
[Question]
  -> [Local intent and minimum context plan]
  -> [Source needed?]
     -> no: [local answer or configured-model explanation]
     -> yes + provider available: [one-question source permission]
        -> allow: [read redacted bounded excerpts, then answer]
        -> decline: [answer without source]
  -> [grounded response, citations, safe local audit]
```

1. The browser submits only `question` and an optional one-question `sourceConsent` boolean to the local process.
2. The process classifies the intent and calls only the relevant controlled readers. It creates a local audit entry with user-safe summaries such as `Looked at current changes and the latest review`.
3. When a source excerpt could be sent to a provider and consent is absent, return `sourceConsentRequired` without reading or transmitting source. The panel shows the consent gate.
4. With consent, local readers select a maximum of three discovered source files and bounded redacted excerpts. The provider receives a compact structured context. It cannot call tools or request more files.
5. The response states its basis in compact plain language: `Discovered fact`, `Review observation`, or `Model inference`. It cites only records or redacted source locations that were actually included.
6. The persisted local conversation stores the answer, citations, tool-call summaries, and audit identifiers. It never stores raw source excerpts, provider credentials, shell commands, or provider request/response bodies.

### Source consent states

| State | Panel behavior | Developer action | Result |
| --- | --- | --- | --- |
| Not needed | Normal answer | None | No source is read or transmitted. |
| Needed, no provider | Normal local answer with file citations when locally available | None | Source remains local. |
| Needed, provider available, undecided | Inline consent rail | `Use code context` or `Answer without code` | One-question choice. |
| Accepted | Compact pending copy | None | Redacted excerpts only are sent with this question. |
| Declined | Normal answer | None | Provider receives metadata only. |
| Read failure or redaction leaves no useful text | Plain uncertainty copy | Retry or ask a narrower question | No fabricated source claim. |

### Flow: Prepare a repair with Codex

**Goal:** Explain the bounded next step without starting a repair accidentally.

**Trigger:** `Prepare this for Codex` starter prompt or equivalent question.

The assistant uses the latest grounded release context and answers with a concise preparation status and citations. If no current review supports a repair, it says so. It does not call the Codex launcher.

The existing `Fix with Codex` action is changed to a confirmation dialog before it writes a repair brief or launches a local process. The dialog says that Verion will create a review brief and open Codex, that no files are modified by this step, and that Codex changes require the developer's review. The local process rejects a repair-launch request unless the browser supplies the exact approved confirmation. Audit the approval and launch result with no command arguments or source content.

### Failure and edge behavior

- A refresh while a source-consent rail is visible drops the pending choice. No source is transmitted until the developer asks again.
- A provider timeout, malformed answer, or missing capability falls back to a deterministic local answer when possible. It explains the limit without exposing provider internals.
- A question containing credential-like text is rejected before persistence, planning, or provider use.
- An explicit path outside discovered project files, a hidden credential file, a binary, a file above the size limit, or a traversal attempt is rejected and audited as a safety refusal.
- When the project changes after planning but before reading, discard the plan and answer from refreshed safe metadata or request a retry. Never read a stale unrestricted target.
- All errors retain the prior conversation. Only a completed question is appended.

## Component handoff

### Teammate answer provenance

Add a compact provenance line to each Verion response when available. It uses body-sized text and a semantic label, not a status badge wall:

- `Discovered fact` for deterministic discovery or memory.
- `Review observation` for a saved release or security observation.
- `Model inference` only when the selected provider interpreted the bounded context.

Citation chips stay as the existing compact local links. A source citation may show a discovered relative file and line range; activating it retains the current safe navigation behavior until a dedicated source reader exists. Never render a raw excerpt in persisted chat history.

### Source permission rail

Render immediately above the composer only when `sourceConsentRequired` is returned. It is a ruled inline section, not a modal or card.

- Heading: `Use local code context for this answer?`
- Body: state the maximum file/excerpt scope in plain terms, that excerpts are redacted, that they are sent only to the currently selected provider for this question, and that no project files will change.
- Primary action: `Use code context`.
- Secondary action: `Answer without code`.
- While submitting, disable both actions and announce `Preparing a grounded answer.`
- On error, retain both actions and show one concise inline error.

At under 720px it remains in normal panel flow above the composer. Buttons stack below 420px and remain at least 44px tall. It must not create a horizontal scroll region.

### Repair launch confirmation

Reuse the existing dialog language and locked dialog treatment. It receives focus on `Cancel`, traps tab focus, closes on Escape before launch, restores focus to `Fix with Codex`, and uses an assertive error region on failure. The confirmation action is Danger only if it starts an external process; otherwise it uses the existing primary action styling. No generic warning icon, no animated status theatre.

## Server and persistence handoff

### Controlled reader contract

Create a server-only assistant tool module. Each tool has a hard input/output schema, a maximum result count, and a user-safe audit summary. Tool names remain internal and never appear as raw UI copy.

| Internal ability | Inputs | Hard boundary | Product-facing summary |
| --- | --- | --- | --- |
| Project understanding | current local memory | no source | `Project understanding` |
| Local memory | current local memory | counts and dates only | `Local memory` |
| Change and impact | baseline-aware memory | maximum 3 groups / 3 areas | `Latest change` |
| Reports, issues, findings | current memory and saved reports | maximum 3 items, no raw evidence payload | `Latest review` / `Security review` |
| Journeys | current memory | maximum 6 labels | `Important journeys` |
| File search | discovered project source paths only | maximum 12 path matches; no hidden, binary, generated, dependency, or `.verion` paths | `Related project files` |
| Relevant-file read | allowlisted discovered source path | maximum 3 files, 32 KiB each, 120 lines / 2,400 characters after redaction | `Related code context` |
| Relationship lookup | current repository graph | maximum two hops / eight nodes | ordinary-language relation such as `This page imports the billing helper` |

Reader selection must be deterministic from the question. A provider receives a compact JSON context with a 12,000-character total budget, never a filesystem path outside discovery, a credential value, raw environment file, terminal output, or full memory file. Redaction must cover API keys, bearer tokens, private-key blocks, connection strings, cookie/session values, password assignments, common cloud keys, and `.env`-style values. Redaction happens before token counting and before any provider request.

### Provider response contract

Use the selected provider only through the existing provider-independent structured boundary. Do not depend on model tool calling. Require a bounded structured answer with:

- `basis`: `discovered_fact`, `review_observation`, or `model_inference`
- `answer`: concise plain-language text, maximum 1,800 characters
- `citationIds`: a subset of context citations supplied by the local process
- `uncertainty`: optional plain-language caveat, maximum 320 characters

Validate and normalize the response locally. If it is unavailable or invalid, use deterministic local composition and record a safe failed tool audit. Do not include provider error bodies in the conversation or browser response.

### Conversation and audit persistence

Keep assistant conversation versioned and local. Extend its safe normalization to permit validated tool-call summaries and source-file citations, but never source text. Every tool entry stores only its id, status, timestamps, user-safe input/output summary, and citation ids.

Add a separate versioned local audit record for assistant reads, source-consent decisions, repair-launch approvals, repair-launch results, and verification requests/results. It has an append limit and atomic writes. It stores no raw questions, source text, credentials, command arguments, provider payloads, or patch body. Existing verification history remains the release record; this audit is the operator trace. Phase 4 does not apply patches. A later repair phase must use the same audit store for patch proposal, approval, apply, and re-verification events.

## Accessibility and quality gate

- The existing keyboard order remains header, page, teammate conversation, permission rail, composer.
- Source permission and repair confirmation changes are announced by existing live regions. The permission rail uses a labelled `region`; dialogs use `role="dialog"`, `aria-modal`, labelled description, focus trap, Escape dismissal, and focus restoration.
- All interactive actions have a 44px target and visible Action Blue focus ring. Text, muted text, Action Blue, and semantic states use only locked tokens and meet the ratios recorded in `DESIGN.md`.
- No new color, type, radius, gradient, glass surface, equal-card row, hero, invented metric, status-dot decoration, or raw internal terminology is introduced.
- Motion remains control-only at 120ms and respects `prefers-reduced-motion`.

### Pre-flight

- [x] `DESIGN.md` was re-read. No visual token or identity change is needed.
- [x] One technical/utilitarian direction, no banned font, color cliché, hero, equal-card row, buzzword, fake metric, or em dash in visible copy.
- [x] The persistent teammate signature remains present and source consent is a ruled inline reading element rather than a new dashboard system.
- [x] Loading, empty, local-only, consent accepted, consent declined, source refusal, provider failure, repair confirmation, and repair-launch failure are specified.
- [x] Keyboard, focus, live announcements, mobile treatment, touch targets, and reduced motion are specified.
- [x] One primary action remains per page. Consent and repair actions are situational and subordinate.
- [x] Quality score: distinctiveness 3; hierarchy 4; consistency 4; accessibility 4; state coverage 4; copy 3; restraint 4; motion 4. Total 30/32.

## Build handoff

**Target:** `react-vite-tailwind-engineer` equivalent SPA engineering agent.

**Design system:** existing Apple HIG-inspired native semantic controls. Do not add or recreate a second UI kit. Theme the existing controls with the locked tokens. Do not redesign or re-implement their components.

Implement exactly this spec. Preserve Phase 0 through Phase 3 behavior and unrelated work. Required checks:

1. Controlled tool tests prove traversal, `.env`, binary, over-budget, secret-bearing, and arbitrary-shell attempts are refused; permitted source is redacted before a fake provider receives it.
2. Tests prove each required question is grounded with citations and the no-provider path works.
3. Tests prove a provider without tool calling can use server-assembled context; no raw provider credential or source appears in browser responses or persisted conversation/audit records.
4. Tests prove source consent is one-question-only and the repair endpoint rejects unconfirmed launches while auditing a confirmed launch.
5. Build, type check, whitespace diff check, keyboard dialog check, and 320px no-horizontal-overflow check pass.
