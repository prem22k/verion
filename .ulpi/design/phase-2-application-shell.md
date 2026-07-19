---
feature: phase-2-application-shell
register: product
design_system: Apple HIG-inspired native semantic controls
binds_to: DESIGN.md
---

# Phase 2: Shared shell and project teammate

Every screen must read as the same product if placed side by side.

## Design Read

Quiet local mission control. The shell makes project knowledge and the release decision feel continuously available while the teammate occupies a dedicated working column, never a floating chatbot or a product hero.

**Direction:** technical / utilitarian. The developer is reviewing work, so the signature is the project control strip plus a persistent, ruled teammate column. This is intentionally not the generic three-card dashboard or full-glass chat pattern.

## Scope boundary

- Two primary locations only: `#/home` and `#/security`.
- Hash routing is the deep-link contract for the local SPA. Back and forward use the same URL state and never reconnect the project or clear conversation state.
- Provider setup is not a primary destination. Header model state is informational only; settings remains a later secondary surface.
- Phase 2 provides a locally grounded teammate conversation and its states. Provider-driven tools, source reads, and repair execution belong to Phase 4 onward.

## Information architecture

```text
AppShell
  Header: Verion | project | release state | model state | mobile teammate trigger
  Primary navigation: Home | Security
  Main landmark: selected view
  Aside: Verion teammate (desktop)
  Dialog/drawer: same teammate state (mobile)
```

### Home

Home preserves the existing compact project control strip, latest change, likely impact, release decision, and Verify action. It does not acquire a second navigation layer or a visual hero.

### Security

Security uses the same header and teammate. The top content is a narrow review-status strip: availability, expected duration, and one contextual action only when review is ready. Under that, critical concerns, high concerns, and affected code each use a ruled list. When no normalized finding exists, the empty state says that Verion has no critical or high concern recorded for this project yet. It does not imply that the application is secure.

## Data and local endpoints

The shell consumes the existing `/api/connection`, `/api/events`, and `/api/status` data without exposing credentials.

Phase 2 adds a local project-owned conversation store at `.verion/assistant-conversation.json`, using the existing `AssistantConversation` contract. It must contain only developer prompts, Verion replies, safe citations, and safe activity summaries. Provider credentials, source dumps, raw execution output, and repair diffs are forbidden.

| Endpoint | Purpose | Response safety |
| --- | --- | --- |
| `GET /api/assistant/conversation` | Load the one project conversation | Messages, citations, safe provider state only |
| `POST /api/assistant/messages` | Record one developer question and return a bounded local contextual answer | Never accepts a provider key or source path |
| `POST /api/assistant/conversation/clear` | Explicitly clear local conversation | Returns empty conversation only |

The Phase 2 responder supports the starter-question categories with deterministic summaries from mission data: project purpose, current change, likely impact, current release decision, memory, and security state. Any unhandled prompt receives a short, honest limitation and points to a relevant starter question. This keeps the panel useful in no-provider mode without pretending that later controlled tools are present.

## Flow: switch context without losing the teammate

**Goal:** Review Home or Security while retaining the project and the same local conversation.

```text
[Home #/home] -> select Security -> [Security #/security]
     ^                                      |
     +-------- browser back/forward --------+

Conversation, selected-model status, connection, and pending reply remain in memory.
```

Refresh loads the active hash and the persisted local conversation. If the local agent is temporarily unavailable, the shell retains the last safe mission/conversation, shows a reconnect action, and does not fabricate new data.

## Flow: ask the teammate

**Goal:** Get a project-aware answer without explaining the project again.

1. The developer selects a contextual starter or enters a question.
2. The panel immediately records the developer message and enters `responding` state.
3. The local process returns a concise grounded answer and citations, or an unavailable/interrupted state.
4. Citation buttons move focus to the related Home/Security detail or navigate to that view. They never reveal hidden internal data.
5. `Clear conversation` requires a direct click and replaces the saved history with the documented empty state.

### States

| State | Visible treatment | Recovery |
| --- | --- | --- |
| Empty | Three grounded prompts and a short statement that the teammate knows this local project | Ask a starter or type a question |
| Ready | Prior messages, citations, and compact input | Send a question |
| Responding | Keep previous messages, disable duplicate send, show `Thinking through this project…` in a live region | Interrupt or wait |
| Interrupted | Preserve the prompt and partial/safe result, labeled `Interrupted` | Retry the same question |
| No provider | Keep local project answers and label the model state `Local context` | Continue locally; provider setup comes later |
| Provider unavailable | Preserve history, explain that local context remains available | Retry after reconnecting |
| Security context | Prompts shift to impact, affected code, and repair preparation | Navigate or ask directly |

## Component briefs

### `AppShell`

- `desktop` at ≥1024px: 48–52px header; content column and persistent 340–400px teammate aside separated by one border. Main content owns vertical scrolling; page and app shell never create horizontal scroll.
- `mobile` below 1024px: header retains Home/Security and a 44px teammate trigger. The same `TeammatePanel` opens in a modal drawer with focus trap and safe-area padding.
- Semantics: `header`, `nav aria-label="Primary"`, `main`, and `aside aria-label="Verion teammate"`. The active nav uses `aria-current="page"`.
- Keyboard: tab order is header, nav, primary content action, content, then aside. Escape closes mobile drawer and returns focus to its trigger. Browser Back/Forward maps to hash state.

### `TeammatePanel`

- Header: `Verion teammate`, safe model label, and explicit `Clear conversation` text action only if history exists.
- Message anatomy: role label, concise content, source kind chips such as `Project understanding`, `Latest review`, or `Security review`. Never call these evidence, tools, or logs.
- Input: `textarea` with a visible `Ask Verion` button, 44px minimum hit target. Enter sends; Shift+Enter adds a newline.
- Live region: state is announced politely; failed/unavailable send is announced assertively without repeating history.
- Starter prompts are context-derived and never fake. Home: `What does this project do?`, `What changed?`, `What should I review next?`. Security: `What does the security review cover?`, `What would block shipping?`, `Prepare this for Codex`.

### `SecurityView`

- One primary action only: `Start Deep Security Review` when it is available and not already running. Do not show it when this capability is not configured.
- Critical then high severity lists use dense ruled rows with severity, explanation, affected area, and safe action. An empty list is a plain empty state, not a success celebration.
- `Copy Fix Prompt` is a text action and remains present for actionable findings. Native repair is shown only as unavailable/future state until the bounded repair capability exists.

## Accessibility and responsive constraints

- Use only tokens in `DESIGN.md`: Canvas, Surface, Elevated, Text, Muted, Border, Accent, Success, Warning, Danger; 4/8/12/16/20/24/32px spacing; 8/12/16px radius; 120ms control motion.
- Text and controls meet the locked contrast values. All controls use visible Accent focus rings and 44px touch targets.
- No horizontal scrolling at 320px. Long messages and paths wrap; chips can wrap but never create a horizontal carousel.
- Reduced-motion users see no drawer or state animation beyond an immediate change.

## Pre-flight

- [x] `DESIGN.md` was re-read and the locked technical/utilitarian identity is retained.
- [x] One accent, one radius scale, one icon family, and one compact product type system are retained.
- [x] No hero, three-equal-card layout, nested cards, purple glow, gradient text, fake metrics, fake names, or scanner language is specified.
- [x] The project-control strip plus teammate column remains the single signature.
- [x] Empty, ready, responding, interrupted, unavailable, refresh, reconnect, mobile drawer, and clear-history states are covered.
- [x] Navigation, focus, live regions, Escape, 44px targets, reduced motion, and no-horizontal-overflow are specified.
- [x] One primary action is specified for each view.
- [x] Self-critique: distinctiveness 3; hierarchy 4; consistency 4; accessibility 4; state coverage 4; copy 4; restraint 4; motion motivation 4. Total 31/32.

## Build handoff

**Target:** React/Vite SPA engineering.

Implement exactly this spec. Theme the existing native semantic controls with the locked tokens; do not redesign or re-implement its components.

Acceptance criteria:

- `#/home` and `#/security` retain one project connection, model status, and conversation without reset.
- Desktop exposes a persistent contextual teammate; mobile exposes the same state in an accessible drawer.
- Local conversation persists per project and can only be removed with an explicit clear action.
- The assistant cites project facts/review state and never presents a generic empty chatbot or provider credential.
- Shell and all modules have no horizontal overflow and are completely keyboard accessible.
