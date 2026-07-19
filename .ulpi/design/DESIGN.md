---
project: Verion
register: product
aesthetic_direction: technical / utilitarian
color_strategy: restrained
design_system: Apple HIG-inspired native semantic controls
design_variance: 4
motion_intensity: 3
visual_density: 8
---

## Design Read

A compact local release desk. Verion should feel like an experienced teammate's working screen: immediate project context, a clear release action, and dense but calm evidence. It is a dashboard, never a landing page.

## Signature

The **project control strip plus persistent teammate panel** anchors every view. The strip pairs project understanding, the next release action, and factual counts. The persistent panel gives the developer one continuous place to ask why something matters. Together they prove what Verion knows without spending a viewport on branding or creating a generic chatbot.

## Inspiration

`/DESIGN.md` provides Apple-derived precision: system type, quiet neutrals, thin dividers, Action Blue, and restrained translucent chrome. Rejected: homepage-scale typography, product marketing pacing, and decorative full-bleed presentation.

## Experience mandate

The MVP has exactly two primary pages: Home and Security. A shared application shell keeps the project identity and one persistent Verion teammate panel intact while the developer moves between them. Primary navigation has only those two destinations. AI provider configuration is a secondary sheet, never a dashboard header label.

Home leads with Project Understanding, the latest change, likely impact, latest release decision, and `Verify this change` in the first working view. Local Memory and History are supporting detail. Before its first developer-started review, Security is a quiet launch surface: what Verion will review and one `Start Deep Security Review` action. It shows no fabricated stations, release call, empty concern queues, or code locations. During and after a review, Security leads with review state, then any critical/high findings, affected code, and repair actions. Security remains one contributor to the same release decision, never a separate product.

The teammate panel is contextual rather than conversational decoration. It has grounded starter questions, cites project facts and findings, and never asks the developer to explain the project again. It never receives or displays raw provider credentials. There is no hero, mascot, oversized project name, decorative status theater, or generic glass applied to every surface.

One primary action is visible per page: `Verify this change` on Home and `Start Deep Security Review` when Security is available. Security review is developer-started: Home verification never silently begins it. `Read the project brief`, `Copy Fix Prompt`, and repair actions are subordinate and issue-scoped.

The Security page signature is a **security transit line**: five factual review stations joined by a thin rule. A single live marker advances only when a local review stage actually starts or completes. It is the one expressive moment on the page, making a long-running review legible without fake percentages, scanner names, or decorative status theater.

## Color (locked)

| Role | OKLCH | Hex | Use |
| --- | --- | --- | --- |
| Canvas | oklch(0.967 0.003 270) | #F5F5F7 | App background |
| Surface | oklch(1 0 0) | #FFFFFF | Dashboard modules |
| Elevated | oklch(0.932 0.004 270) | #E8E8ED | Quiet labels and inactive states |
| Text | oklch(0.205 0 0) | #1D1D1F | Primary text, 15.8:1 on Canvas |
| Muted | oklch(0.544 0 0) | #6E6E73 | Supporting text, 4.7:1 on Surface |
| Border | oklch(0.865 0.002 270) | #D2D2D7 | Dividers and module edges |
| Accent | oklch(0.52 0.19 254) | #0071E3 | Primary action and active state |
| Success | oklch(0.72 0.18 145) | #34C759 | Completed state |
| Warning | oklch(0.75 0.16 75) | #FF9F0A | Incomplete review |
| Danger | oklch(0.55 0.22 25) | #D70015 | Release blocker |

## Type (locked)

| Role | Family | Use | Notes |
| --- | --- | --- | --- |
| Product | -apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, sans-serif | All product UI | 13–16px is the working range; names max 32px |
| Data | SFMono-Regular, ui-monospace, Menlo, monospace | Dates and code only | 11–12px; never body copy |

## Scales (locked)

- Spacing: 4, 8, 12, 16, 20, 24, 32px. Use 40px only for view separation. Do not use 80px or 100px marketing whitespace in a dashboard.
- Radius: 8, 12, 16px. Modules get one surface, lists live directly within that module.
- Motion: 120ms for controls, 280ms for state transitions, and 420ms only for the first learning arrival. Use `cubic-bezier(0.16, 1, 0.3, 1)`. Honor `prefers-reduced-motion`; no decorative motion or timer-led fake progress.
- Icon family: Simple Icons for detected technology. Otherwise, compact system line icons.

## Voice

Plain, factual, and release-oriented. Use `Project Understanding`, `Local Memory`, `Verify this change`, `Latest Review`, and `Ready to ship`. Visible copy never uses scanner, pipeline, evidence, graph, capsule, or implementation-event terminology.

Every screen must read as the same product if placed side by side.
