---
feature: first-run-provider-and-local-review
register: product
design_system: Apple HIG-inspired native semantic controls
binds_to: DESIGN.md
---

# First Run, AI Setup, and Local Review

Every screen must read as the same product if placed side by side.

## Design Read

**A local release desk that wakes up before it asks for anything.** The first sixty seconds must prove that Verion understands the project. Provider setup stays available but subordinate, and a review remains meaningful when no model is connected.

## Aesthetic direction

Technical / utilitarian. The signature remains the project control strip plus the quiet Verion Presence. The distinctive first-run moment is an ordered discovery ledger, not a splash screen, progress wheel, chatbot, or three-card onboarding funnel.

Counterfactual check: this composition is specific to a local teammate that turns files into a trustworthy project picture. It is not a generic SaaS setup wizard.

## Flow: First local learning

**Goal:** A developer runs `verion` and sees real discoveries appear before a compact, persistent project brief.

```text
verion
  -> dashboard opens immediately
  -> Learning ledger presents only supported facts as they arrive
  -> Project Understanding settles with one plain-language thesis
  -> "Ready to review" action establishes the baseline
```

### States

| State | Screen response | Action |
| --- | --- | --- |
| Starting | Header says `Learning this project`; ledger has no invented percentages. | None. |
| Discovery | Up to five facts arrive in source order: framework, data layer, authentication, billing, product areas. | `Skip animation` is never needed. |
| Understood | The existing project control strip replaces the ledger with summary, stack, counts, and one thesis. | `Verify this change`. |
| Partial | Facts that could be proven appear; unknown areas are absent. | `Verify this change` remains available. |
| Failed | Keep the supported facts and say which local step could not finish. | `Try learning again`. |
| Reduced motion | Render final facts in order, with no animated arrivals. | Same actions. |

The dashboard is served before learning completes. Learning events carry only safe discovered facts, never source text, file contents, credentials, paths outside the project, or model output. Completing the settled project brief marks onboarding complete.

## Flow: AI setup

**Goal:** A developer can choose how Verion reasons without treating model configuration as the product.

**Entry:** the compact `AI setup` control in the application header. It opens a right-side sheet on desktop and a full-height dialog on compact screens. It is not a third primary page.

```text
AI setup
  -> Choose Verion local mode, a local model, or a BYOM provider
  -> Choose a model and review its capabilities
  -> Add a local credential or choose an environment variable
  -> Validate locally
  -> Save and return to the same Home or Security state
```

### Provider groups

1. **Local and free**: Ollama-compatible local models. No API key. The sheet detects the local runtime and offers an install command only when it is absent.
2. **Bring your own key**: OpenAI, Gemini, OpenRouter, and a compatible endpoint. The form collects provider, model, endpoint only when needed, and a credential method.
3. **Verion AI**: reserved for the hosted service. Until the authenticated proxy exists it is visibly unavailable, never represented as a free working choice.

OpenRouter free models may be selected only after Verion receives a live provider model list or an explicit developer-supplied model id. Do not hard-code an expiring catalogue or imply that a provider account is unnecessary.

### Credential handling

- Preferred: operating-system credential storage. The UI says where the key is stored and offers Remove.
- Fallback: a local project `.env` entry only after explicit confirmation. It is not placed in `.verion`, browser storage, reports, logs, or conversation data.
- Existing environment variable: the developer chooses its name; Verion never asks to display its value.
- Key fields use uncontrolled inputs, clear immediately after submission, are never rendered from app state, and never appear in a response payload.

### Setup states

| State | Sheet copy | Primary action |
| --- | --- | --- |
| No model | `Local project review is active. Add a model for deeper explanations.` | `Set up AI`. |
| Configured and ready | `Connected for explanations and review reasoning.` | `Change setup`. |
| Credential missing | State the exact environment variable or credential-store action needed. | `Save setup`. |
| Validation failed | Show the provider-safe error and preserve non-secret form selections. | `Try again`. |
| Local runtime absent | `Install a local runtime to use a free local model.` | `Copy install command`. |
| Hosted mode unavailable | `Verion AI is not available in this build.` | Secondary explanation only. |

Capability display uses human terms: `Explains reviews`, `Understands larger context`, `Prepares repair proposals`. The dashboard never renders a provider name or a model identifier. Model capabilities do not claim file editing unless the adapter supports a bounded proposal and approval flow.

## Flow: Verify and Deep Security Review

**Goal:** Every project can run a useful local review without an AI key, external repository identity, MongoDB, or GitHub token.

```text
Verify this change or Start Deep Security Review
  -> local discovery and change comparison
  -> relevant product checks and local security review
  -> deterministic decision if no model is available or a request fails
  -> optional model explanation enriches, never replaces, the decision
```

The Security page describes only `Deep Security Review`. Its default local implementation evaluates bounded repository material and package metadata. Optional authorized remote enrichment stays hidden unless the developer explicitly enables it. A service failure becomes `Review incomplete` with the safe reason and retry action, never a disabled unexplained button.

## Flow: Observing a change

**Goal:** A developer trusts that source changes are noticed, understood, and queued safely.

- File events debounce once, then create a content-aware local snapshot.
- Home announces `Change observed` and names affected product areas.
- Automatic review is an explicit project preference. Default behavior is `Watch changes, ask before review` to prevent surprise cost or browser work.
- When automatic review is enabled, the exact next action and debounce state appear in the Local Memory details. A manual review always works.
- The first completed review records a baseline. A repeated same-size edit is still detected because snapshots include a bounded content digest.

## Component briefs

### `LearningLedger`

Purpose: make real project understanding visible during the first run.

- Renders a single ruled list, not cards. At most five discovery rows plus a plain-language conclusion.
- Every row has `pending`, `arrived`, and `unavailable` state. Unknown product concepts do not get placeholders.
- Keyboard: no focusable rows. Announce an arriving fact through a polite live region.
- Motion: row opacity and rule extension, 280ms. Arrival is driven by a server event only.

### `AISetupSheet`

Purpose: keep provider, model, credential method, and capability information coherent and secondary.

- Native dialog semantics, labelled title, description, Escape close, trapped focus, restored trigger focus.
- Maximum four visible controls per setup step. Endpoint stays inside an advanced disclosure.
- Saving disables duplicate submission. A local validation result is announced in a polite live region.
- The dialog is a sheet at desktop width and full-height at small widths. It owns its own vertical scroll only when content cannot fit; Home and Security do not expand behind it.

### `ReviewAvailability`

Purpose: explain why a security review can start, is working, or cannot complete.

- `Ready`: show the single `Start Deep Security Review` action.
- `Reviewing`: show human review steps and prevent a duplicate launch.
- `Incomplete`: show an exact safe cause and `Try again`.
- No `Unavailable` state for the default local reviewer. Optional remote enrichment may be unavailable without disabling the local review.

### `ChangeSignal`

Purpose: make source observation legible without triggering surprising work.

- Shows baseline status, observed change, affected area labels, and review preference in a progressive disclosure.
- Uses a text label and shape, not color alone. Announces observed changes politely.
- Motion: one 120ms rule settle when a real new snapshot arrives.

## Accessibility and layout

- Home and Security fit the working viewport. Details move to existing disclosures, dialogs, and the assistant conversation instead of making a long report column.
- All controls retain visible focus, 44px targets, and keyboard reachability.
- The learning ledger, setup validation, and review progress use polite live regions. Errors use assertive alerts only after a failed action.
- Reduced motion renders all arrival and state transitions immediately.

## Design Pre-Flight

- [x] Uses only the locked Apple-inspired semantic control system, palette, typography, radius, spacing, and updated motion scale.
- [x] Keeps one accent, one icon family, and the existing project-control-strip plus Presence signature.
- [x] Uses no generic hero, three-card setup flow, nested cards, fake model catalogue, glow, gradient text, or decorative status dots.
- [x] Covers first learning, partial discovery, failure, no provider, validation failure, unavailable hosted mode, local runtime absence, local security failure, watcher preference, refresh, and reduced motion.
- [x] Preserves keyboard dialog behavior, live-region announcements, focus restoration, 44px targets, and AA contrast from `DESIGN.md`.
- [x] Limits each view to one primary action and each setup step to four controls.
- [x] Self-critique: distinctiveness 3; hierarchy 4; consistency 4; accessibility 4; state coverage 4; copy 4; restraint 4; motion motivation 3. Total 30/32.

## Build handoff

**Target:** `react-vite-tailwind-engineer` equivalent. This is a Vite React SPA. Theme native semantic HTML controls with the locked tokens. Do not add a component library or redesign the existing shell.

Implement exactly this specification. The engineering work must provide server events for first-run discovery, secondary provider-setup endpoints that never serialize a raw key, an always-available local Deep Security Review, content-aware change snapshots, and a user-controlled auto-review preference.

Acceptance criteria:

- `verion` opens the dashboard before project learning is complete, visibly settles proven discoveries, then persists completed onboarding.
- The header has no provider/model label; AI setup is secondary and supports local free and BYOM paths without misleading hosted-free claims.
- Verification produces a deterministic, evidence-backed release result when a provider is missing or rejects a request.
- Deep Security Review can start for a normal local project without MongoDB, GitHub credentials, or repository environment variables.
- Same-size source edits are detected; watch behavior is understandable and opt-in for automatic review.
