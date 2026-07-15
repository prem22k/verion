# Decisions

Use this file as Verion's engineering journal. Record major product decisions when they change direction, scope, workflow, or user experience.

## 2026-07-14

### Decision

Verion will focus the MVP on one non-negotiable loop: generate code, verify behavior, find meaningful issues, group by likely root cause, prepare context for Codex, fix, verify again, and ship.

### Why

The strongest product promise is shipping confidence after AI-generated code. Everything else is secondary until that loop works and feels clear.

### Alternatives Considered

- Build a broad QA dashboard.
- Build a multi-agent development environment.
- Build a general testing platform.
- Build collaboration and account features first.

### Tradeoffs

This narrows the product sharply and delays many useful features. The benefit is a clearer demo, a stronger product identity, and less risk of building around the core instead of proving it.

## 2026-07-15

### Decision

Begin the Phase 1 vertical slice with a Vite/React TypeScript dashboard and a separate TypeScript local-agent module. Both use one shared verification-result contract.

### Why

The repository contains no application scaffold. This is the smallest maintainable web foundation for a polished dashboard while preserving the decided local-agent and web-dashboard architecture.

### Alternatives Considered

- A static mockup with no verification state.
- A single tightly coupled application process.
- A more feature-rich framework or multi-package setup.

### Tradeoffs

The initial dashboard will use an isolated demo adapter until browser automation is connected. That adapter is temporary and must not be presented as the final evidence source; the real browser-backed agent remains a Phase 1 requirement.

## 2026-07-15 — Demo Target

### Decision

Use a small workspace-creation companion application for the Build Week demo. Verion will discover that the template selected by a user is silently replaced by the default template when the workspace is created.

### Why

This is a realistic user-visible state-loss bug that an AI-generated product flow can introduce. It is more meaningful than a generic error, easy to reproduce through browser exploration, and supports one focused root-cause diagnosis.

### Alternatives Considered

- A checkout or payment flow.
- An invitation flow with an ignored permission role.
- A generic form submission failure.

### Tradeoffs

The companion application is intentionally narrow and exists only to prove Verion's verification loop. It is not a second product and must not grow beyond the single creation path.

## 2026-07-15 — Product Foundation

### Decision

Treat the existing companion application and dashboard as an architecture proof. Begin the actual product with a target-agnostic local agent that discovers arbitrary React, Next.js, and Vite projects before any browser verification is attempted.

### Why

Verion must understand a developer's real project rather than depend on a known route, selector, or seeded defect. Project discovery and a repository graph create the evidence base required for reliable exploration and Context Capsules.

### Alternatives Considered

- Extend the hardcoded companion application flow.
- Begin with browser automation against an arbitrary URL without repository context.
- Build a generic scanner dashboard first.

### Tradeoffs

This delays new dashboard polish and security integrations, but creates a reusable local-agent foundation and prevents demo-specific assumptions from becoming product architecture.

## 2026-07-15 — Evidence-First Boundary

### Decision

All Verion subsystems must produce or consume the shared `Evidence` model. The verification orchestrator depends only on `EvidenceProducer` implementations, and Context Capsules are built exclusively from Evidence.

### Why

This keeps repository discovery, browser automation, security scanning, and future quality checks modular and reviewable. It prevents tool-specific reports from leaking into the product experience or into GPT context.

### Alternatives Considered

- Let each subsystem return its own report format.
- Allow GPT to invoke tools directly.
- Couple orchestration to Playwright and individual scanners.

### Tradeoffs

Each producer requires a small normalization adapter, but new tools can be added without changing orchestration or the Context Capsule contract.

## 2026-07-15 — Evidence-First Architecture

### Decision

Evidence is the sole integration boundary inside Verion. Every subsystem must produce or consume normalized Evidence, the verification orchestrator may know only Evidence Producers, and Context Capsules must be composed entirely from Evidence.

### Why

This keeps tool integrations modular, preserves reviewability, and ensures GPT reasons from selected, source-backed context instead of controlling browsers or scanners directly.

### Alternatives Considered

- Allow tool-specific result contracts in the orchestrator.
- Let GPT call Playwright, ServX, or scanners directly.
- Build separate reports for each verification subsystem.

### Tradeoffs

Producer adapters require upfront normalization work, but adding or replacing a tool no longer changes the orchestration or Context Capsule boundary.

## 2026-07-15 — Capsule-Only GPT Diagnosis

### Decision

GPT diagnosis consumes the completed Context Capsule and returns one structured release report with an evidence-cited recommendation. It has no direct access to browsers, scanners, repository discovery, or graph construction.

### Why

The first vertical slice must prove a developer can move from collected evidence to a concise, reviewable release decision without making GPT an uncontrolled orchestrator.

### Alternatives Considered

- Let GPT invoke verification tools directly.
- Generate an unstructured diagnosis and parse it heuristically.
- Produce a synthetic local diagnosis when GPT credentials are unavailable.

### Consequences

The local agent needs an `OPENAI_API_KEY` to complete diagnosis. Missing credentials and API errors remain explicit so Verion never presents fabricated reasoning as verification.

## Template

### Date


### Decision


### Why


### Alternatives Considered


### Tradeoffs
