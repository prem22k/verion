---
project: Verion
feature: Phase 6 repair workflows
register: product
design_system: Apple HIG-inspired native semantic controls
binds_to: .ulpi/design/DESIGN.md
---

# Phase 6: Repair Workflows

## Design Read

Repair is a small, accountable continuation of a release review. A developer should see exactly what Verion wants to change, why it is in scope, and how the result will be checked before a file changes. The important product feeling is calm control, not autonomous coding theatre.

The locked technical / utilitarian language remains unchanged. The existing project control strip and persistent teammate continue to frame the work. Repair uses a focused modal reading desk and direct ruled lists rather than a third page, an IDE clone, or a generic agent chat.

**Identity lock:** Every screen must read as the same product if placed side by side.

## Product boundary

- The canonical **repair brief** is local, deterministic, and shared by `Copy Fix Prompt`, `Fix with Codex`, and native Verion repair. It contains only a selected review-backed issue, discovered project context, redacted relevant source context, bounded affected locations, expected behavior, and verification instructions.
- A developer must select an explicit repair action before Verion reads source for a native proposal or transmits redacted source to a selected provider. The browser never receives provider credentials.
- A native proposal is read-only. It produces a changed-file list, readable diff, and verification plan. No file changes before a separate exact approval confirmation.
- Applying a proposal only modifies approved relative files beneath the connected project root, only when the current source still matches the proposal's guarded original snippets. Model-provided commands, paths, tests, patches, and shell text are never executed directly.
- After a successful apply, Verion runs only an allowlisted project check and the normal release review. It records the result in the existing release history and repair audit. A failed check, failed verification, refresh, cancellation, or stale source never silently reverts a decision or hides the local diff.
- If the current model cannot make a safe repair proposal, show no native action. `Copy Fix Prompt` and the confirmed Codex handoff remain complete alternatives.

## Canonical repair brief

Create one server-owned `RepairBrief` contract. It is the source for every repair surface and packet. It may be generated for a current `needs_attention` release report or an actionable normalized security finding.

```ts
interface RepairBrief {
  id: string
  source: 'release_report' | 'security_finding'
  issueId: string
  title: string
  severity: 'critical' | 'high' | 'attention'
  summary: string
  rootCause: string
  expectedBehavior: string
  evidence: string[]
  affectedFiles: Array<{ path: string; startLine?: number; endLine?: number; reason: string }>
  codeContext: Array<{ path: string; startLine: number; endLine: number; text: string }>
  verificationPlan: string[]
  createdAt: string
}
```

The local process validates all fields, caps issue text, paths, source files, lines, evidence, and excerpts, redacts secrets before persistence or provider use, and omits empty source context. It never includes absolute paths, `.env`, `.verion`, dependencies, binary content, credentials, raw review payloads, model responses, scanner names, or shell commands. A copied brief is not persisted merely because it was copied.

The prompt form is plain text with the headings `Issue`, `Why it matters`, `Affected files`, `Relevant code context`, `Expected behavior`, and `Verify`. It tells an external agent to make the smallest safe repair, show a diff, wait for developer approval, and re-run the stated checks. It does not say that code may be changed autonomously.

## Flows

### Flow: Copy a repair brief

**Goal:** Give any external coding agent a safe, complete, review-backed repair request without needing an AI provider.

```text
[Actionable release or finding]
  -> [Copy Fix Prompt]
  -> [Local canonical brief]
  -> [Clipboard success or visible fallback]
```

- `Copy Fix Prompt` appears beside every actionable latest release and every actionable security finding.
- The browser requests the brief from the local server by source and id. It receives a sanitized prompt only after server-side revalidation against current local memory.
- On success announce `Fix prompt copied.` without moving focus. On clipboard failure reveal a labelled, selectable read-only prompt region with `Try copy again`.
- A missing, resolved, stale, or unreviewed source returns concise local copy and does not fabricate a brief.

### Flow: Fix with Codex

**Goal:** Start the existing external-agent repair path with exactly the same repair brief.

```text
[Actionable latest review]
  -> [Fix with Codex]
  -> [Existing explicit confirmation]
  -> [Write local canonical brief and open Codex]
  -> [Developer reviews Codex diff]
  -> [Verify this change]
```

The existing confirmation remains mandatory. The written packet is a private local file built from `RepairBrief`, not a parallel formatter. It must name the latest review or selected finding, preserve the developer's review-before-write instruction, and never expose a credential or raw context beyond the redacted source excerpt policy. A launch failure retains the brief and tells the developer they can copy it instead. Verion does not watch or apply Codex edits. After the developer reviews the diff, the existing Verify action is the only release decision refresh.

### Flow: Native proposal and repair

**Goal:** Let a capable selected model propose a narrowly scoped repair, then require approval, apply safely, and verify automatically.

```text
[Actionable issue, repair-capable model]
  -> [Fix with Verion]
  -> [Source scope confirmation]
  -> [Proposed repair: diff + verification plan]
  -> [Apply this repair confirmation]
  -> [Scoped write]
  -> [Allowlisted check + normal Verion review]
  -> [Verified / needs attention / recovery guidance]
```

1. Show `Fix with Verion` only when the selected provider is available, supports structured output, code generation, and code editing, and native proposal generation is implemented. Otherwise omit it; never use a disabled promise.
2. Selecting it opens **Prepare a repair** confirmation. State the maximum number of discovered files and redacted excerpts that may be sent to the selected provider, the issue name, and that no file will change. `Cancel` is initial focus. `Prepare repair` is the only primary action.
3. The local process creates a canonical brief, selects only its allowed affected files, reads bounded excerpts, redacts before any provider request, and requests a structured proposal. A model may only return a bounded list of guarded replace operations and a verification plan. It cannot call tools or request extra files.
4. Render **Proposed repair** as a modal reading desk. First show a one-sentence summary, then a direct changed-file list, then one readable diff per file, then the verification plan. Put `Cancel` and `Apply this repair` at the end. The developer must inspect the diff before applying.
5. `Apply this repair` opens a second confirmation that says Verion will change the listed files, run the listed local check, and verify the release again. The local server rejects any apply request unless it receives the exact approval phrase plus the current proposal id.
6. Validate the entire proposal against the current project before writing anything: relative discovered path, explicit allowed file, current-content guard, size limits, no credential-like proposed content, and no overlapping replacements. Make the scoped writes transactionally with recoverable original content held only until apply completes. On any error, restore a partial write and return recovery guidance.
7. Run an allowlisted relevant package script from a fixed set such as `test`, `typecheck`, `lint`, or `build` only when that script was discovered. Do not run provider-supplied commands. Then start the existing normal verification flow and save the new release decision.

## Components

### Repair action row

Use in Latest Review and a Security finding. It is a restrained inline action row, not a card.

- `Copy Fix Prompt` always appears for actionable sources.
- `Fix with Codex` remains the external-agent action on current review-backed release concerns.
- `Fix with Verion` appears only when `nativeRepair.available` is true. It prepares a proposal. The visible verb never implies that a file already changed.
- While a brief, proposal, apply, check, or verification is active, disable duplicate action and use a concise live status.

### Repair proposal dialog

```ts
interface RepairProposalView {
  id: string
  sourceId: string
  title: string
  summary: string
  status: 'draft' | 'applying' | 'verified' | 'failed' | 'cancelled'
  files: Array<{ path: string; summary: string; diff: string }>
  verificationPlan: string[]
  outcome?: { label: string; description: string }
}
```

The dialog is a single white surface with thin rules. It opens at the top, labels its issue source, and has no dashboard chrome. Diffs use the locked data face inside a contained, vertically scrollable region. A diff has no horizontal page overflow; a code region may scroll horizontally only inside itself and is labelled by filename. Do not add syntax-color spectacle, terminal output, or a second sidebar.

States:

| State | Developer sees | Available action |
| --- | --- | --- |
| Preparing | `Preparing a scoped repair proposal.` with no fake progress percentage | Cancel while request has not completed. |
| Draft | Changed files, diffs, plan, source scope | Cancel or `Apply this repair`. |
| Source changed | Clear stale-proposal explanation | Return to issue and prepare again. |
| Apply/check failure | What did not complete, whether files were restored, next safe action | Close, inspect diff, or prepare again. |
| Verified | Shared release decision and verification result | Close and review History. |
| Inconclusive | Applied repair but release review could not decide | Close, inspect local result, or Verify again. |

### Confirmation dialogs

Reuse the established repair-dialog treatment and locked tokens. Both dialogs have `role="dialog"`, `aria-modal="true"`, labelled title and description, focus trap, Escape before a state-changing confirmation, focus restoration, an assertive error region, visible Action Blue focus, and 44px controls. The application confirmation must not close on backdrop or Escape while a write is in progress.

## Persistence, audit, and server handoff

- Store proposal metadata, safe diff operations, scope, approval state, outcome, timestamps, selected verification name, and rollback status in a versioned local repair ledger separate from raw provider traffic. Add a project-memory migration only if a summary must be presented in project memory. Existing v5 memory must continue to load unchanged or migrate without losing its history.
- The repair audit receives fixed user-safe event kinds for proposal prepared, proposal declined, apply approved, apply result, verification result, and rollback result. It never records source text, diff text, credentials, provider payloads, commands, or test output.
- Provider proposal output is validated locally against a strict JSON schema. Maximum three files, six guarded replacements, bounded summary and plan, source paths only from the brief scope. Unknown fields, an unexpected file, a missing original snippet, a secret-like replacement, malformed diff, or no verification plan rejects the proposal.
- The browser only receives the safe proposal view and release outcome. It never receives provider keys, raw prompt input, repair ledger internals, raw test output, original full files, or filesystem paths outside the connected project.
- Extend the existing assistant and release APIs rather than adding a page. A persistent teammate may explain the proposed repair from saved safe metadata but cannot launch, apply, or approve it.

## Accessibility and responsive behavior

- Preserve global keyboard order. When a dialog opens, focus `Cancel`; Tab cycles inside it. Screen readers hear the current repair state through a polite live region and failures through `role="alert"`.
- At under 720px dialogs use the viewport width minus 24px, action buttons stack under 420px, and every diff stays in its own labelled scroll region. The document itself never gets horizontal overflow.
- Use locked semantic danger only for the final apply confirmation and a real apply failure. All other repair actions use the locked primary or text actions. Motion remains 120ms control feedback only and honors reduced motion.

## Pre-flight

- [x] `DESIGN.md` was re-read. This adds no palette, type, radius, icon, or motion drift.
- [x] The design remains technical / utilitarian. It uses a focused dialog, ruled lists, and contained diffs rather than a generic agent console, dark code workspace, hero, bento cards, glow, status theatre, or a new page.
- [x] No visible em dash, fake metric, buzzword, scanner terminology, raw engine output, or model implementation detail is introduced.
- [x] Copy, Codex confirmation, unavailable model, source-scope consent, preparing, stale source, draft, approval, cancellation, partial apply recovery, check failure, verification failure, and no-provider states are specified.
- [x] Visible focus, dialog semantics, keyboard path, live announcements, reduced motion, 44px targets, contained code overflow, and mobile layout are specified.
- [x] One primary action per repair state is maintained. Source-scope, apply, and external launch are explicit sequential decisions.
- [x] Quality score: distinctiveness 3; hierarchy 4; consistency 4; accessibility 4; state coverage 4; copy quality 3; restraint 4; motion 4. Total 30/32.

## Build handoff

**Target:** `react-vite-tailwind-engineer` equivalent SPA engineering agent.

**Design system:** existing Apple HIG-inspired native semantic controls. Theme existing controls with locked tokens. Do not add a UI kit or redesign the shell.

Implement exactly this spec. Preserve Phase 0 through Phase 5 behavior and unrelated work. Required checks:

1. A direct repair check proves canonical release and security prompts share a redacted brief, Codex packet uses that brief, and copied output excludes credentials and forbidden paths.
2. A fake repair-capable provider proves proposal schema validation, scope enforcement, stale-content rejection, no overlapping edit, and rejection of credential-like content or arbitrary commands.
3. An apply test proves no writes occur before exact approval; allowed replacements apply only inside the project root; a failed write restores originals; only discovered allowlisted checks are selected; post-apply verification refreshes the saved release decision and audit.
4. A no-provider test proves Copy Fix Prompt and confirmed Codex handoff remain usable while native repair is absent.
5. UI/build checks cover action visibility, both dialogs, diff containment, cancel/failure/recovery states, 320px no horizontal overflow, and persistent assistant state.
6. `npm run build`, Phase 4 and Phase 5 direct checks, the new repair check, and `git diff --check` pass.
