---
project: Verion
register: product
aesthetic_direction: technical / utilitarian
color_strategy: restrained
design_system: native semantic HTML controls
design_variance: 5
motion_intensity: 2
visual_density: 6
---

## Design Read

Quietly technical and decisively calm. Verion should feel like a trusted local instrument, not a generic SaaS dashboard.

## Signature

The **evidence rail**: a thin, continuous vertical rule that connects project connection, agent activity, and release judgment. It makes the verification path legible without decorative cards or fake telemetry.

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
| Info | oklch(0.48 0.08 235) | #27637D | Agent activity |

Dark mode is re-derived through the same blue-green tint, with #142123 background, #1B2B2D surface, and #E4EEEE text. All text and active-control pairs retain WCAG AA contrast.

## Type (locked)

| Role | Family | Use | Notes |
| --- | --- | --- | --- |
| Display | ui-rounded, "Avenir Next", sans-serif | One report title per view | Humanist texture, restrained size |
| Body | system-ui, sans-serif | Form and explanation copy | 65ch maximum measure |
| Utility | ui-monospace, "SFMono-Regular", monospace | Paths, timestamps, Evidence IDs | 12–13px only |

## Scales (locked)

- Spacing: 0, 4, 8, 12, 16, 24, 32, 48, 64, 80px.
- Radius: 4, 8, 12, 16px, and full.
- Motion: 140ms / 280ms / 420ms with `cubic-bezier(0.16, 1, 0.3, 1)`. Motion only clarifies a changed run state. Honor `prefers-reduced-motion`.
- Icon family: inline SVG line icons only.

## Voice

Plain, confident, and specific. Action vocabulary is `Connect project`, `Verify now`, `Watching`, `Review report`. Never claim a problem was found unless report Evidence supports it.

Every screen must read as the same product if placed side by side.
