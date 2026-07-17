---
project: Verion
register: product
aesthetic_direction: technical / utilitarian
color_strategy: restrained
design_system: native semantic HTML controls
design_variance: 5
motion_intensity: 2
visual_density: 4
---

## Design Read

Quietly technical and decisively calm. Verion should feel like a trusted local instrument that delivers a release briefing, not a generic SaaS dashboard or a developer console.

## Signature

The **Verion presence and briefing rule**: a small, lightweight geometric companion appears when Verion is learning or reviewing. A thin, continuous rule connects project understanding, the current release state, and the next decision. Together they make Verion feel present without becoming a mascot, a control-room simulation, or fake telemetry.

## Experience mandate

The product is a calm review, not a control panel. Its home is Mission Control: a legible briefing of what Verion understands, what changed, which journeys matter, the current release state, and one next action.

The briefing rule shows only plain-language observations and the point at which they become a conclusion. It must never resemble a scanner feed, an agent swarm, a progress console, a table, or a stream of logs.

The Verion presence is not a heavy 3D scene. It is a fast inline SVG form: a rounded teal aperture around a small `V` core with one moving review line. It has three legible states: listening, learning, and certain. Its job is to give a first-time user a feeling of thoughtful attention, not entertainment.

## Color (locked)

| Role | OKLCH | Hex | Use |
| --- | --- | --- | --- |
| Background | oklch(0.975 0.006 220) | #F3F7F7 | App canvas |
| Surface | oklch(0.995 0.003 220) | #FCFDFD | Forms and report panels |
| Elevated | oklch(0.94 0.010 220) | #E9EFEF | Supporting surfaces |
| Text | oklch(0.26 0.025 220) | #1F3031 | Primary text, 12.4:1 on surface |
| Muted | oklch(0.47 0.020 220) | #5B6D6F | Supporting text, 5.1:1 on surface |
| Subtle | oklch(0.62 0.015 220) | #8C9A9B | Metadata |
| Border | oklch(0.82 0.015 220) | #C5D0D0 | Rules and controls |
| Accent | oklch(0.47 0.095 190) | #0C6B72 | Primary action and active rail, 5.8:1 on surface |
| Success | oklch(0.48 0.10 150) | #14734C | Ready state |
| Warning | oklch(0.60 0.12 75) | #9A5A00 | Inconclusive state |
| Danger | oklch(0.50 0.14 28) | #A13E2A | Needs-attention state |
| Info | oklch(0.48 0.08 235) | #27637D | Active learning and review |

Dark mode is re-derived through the same blue-green tint, with #142123 background, #1B2B2D surface, and #E4EEEE text. All text and active-control pairs retain WCAG AA contrast.

## Type (locked)

| Role | Family | Use | Notes |
| --- | --- | --- | --- |
| Display | ui-rounded, "Avenir Next", sans-serif | One report title per view | Humanist texture, restrained size |
| Body | system-ui, sans-serif | Form and explanation copy | 65ch maximum measure |
| Utility | ui-monospace, "SFMono-Regular", monospace | Paths and timestamps in secondary details | 12–13px only |

## Scales (locked)

- Spacing: 0, 4, 8, 12, 16, 24, 32, 48, 64, 80px.
- Radius: 4, 8, 12, 16px, and full.
- Motion: 140ms / 280ms / 420ms with `cubic-bezier(0.16, 1, 0.3, 1)`. Motion only clarifies a changed run state. Honor `prefers-reduced-motion`.
- Icon family: inline SVG line icons only.

## Voice

Plain, confident, and specific. Action vocabulary is `Verify`, `Reviewing`, `What Verion found`, `Fix with Codex`, `Verify again`, `Ready to ship`.

Verion speaks in first person only when it introduces itself or recalls the project: `I’m Verion.` and `I remember this project.` During review it uses factual language, never theatrical narration.

Never expose `Evidence`, `Repository Graph`, `Context Capsule`, `producer`, `scanner`, `agent`, or tool names in customer-facing copy. Those are implementation terms. Say what Verion understands, what it is checking, what it found, and whether the developer should ship. Never claim a problem was found unless the underlying review supports it.

Every screen must read as the same product if placed side by side.
