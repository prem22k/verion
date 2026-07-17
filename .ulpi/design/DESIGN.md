---
project: Verion
register: product
aesthetic_direction: Swiss / grid
color_strategy: restrained
design_system: native semantic HTML controls
design_variance: 7
motion_intensity: 1
visual_density: 6
---

## Design Read

An exacting local instrument with the editorial confidence of a technical briefing: Verion earns trust by showing a sharp picture of the developer's actual application, not by acting like an AI character.

## Signature

The **project ledger** is Verion's signature. A large, asymmetric project title is paired with a compact column of discovered counts and a ruled stack of real technologies. It is a living brief, not a dashboard card, and makes the product's intelligence visible before the user asks it to do anything.

## Experience mandate

The first minute is a learning moment. The primary screen answers: what application did Verion learn, what matters inside it, what will be remembered locally, and what should be reviewed next.

Use the project itself as the visual content. Counts, technologies, product areas, remembered journeys, and a specific natural-language thesis replace generic reassurance, decorative mascot states, or fake telemetry. There is no card grid, activity feed, scanner console, or animated agent theater.

The same surface presents Project Understanding, Local Memory, Recent Changes, Verify, Latest Review, Deep Security Review, and History in that order. Deep Security Review is one row in the release briefing, never a separate product or a list of tools.

## Color (locked)

| Role | OKLCH | Hex | Use |
| --- | --- | --- | --- |
| Background | oklch(0.952 0.012 155) | #E8EFEB | App canvas |
| Surface | oklch(0.988 0.006 155) | #F6FAF7 | Main reading surface |
| Elevated | oklch(0.914 0.016 155) | #DCE7E0 | Quiet metadata bands |
| Text | oklch(0.205 0.022 155) | #13221B | Primary text, 15.2:1 on surface |
| Muted | oklch(0.43 0.024 155) | #50645A | Supporting text, 5.9:1 on surface |
| Subtle | oklch(0.60 0.018 155) | #899A91 | Non-interactive metadata |
| Border | oklch(0.77 0.018 155) | #B7C8BE | Rules and controls |
| Accent | oklch(0.47 0.105 36) | #A7492E | The single decisive action and active index, 5.3:1 on surface |
| Success | oklch(0.49 0.105 150) | #167A50 | Successful checks |
| Warning | oklch(0.64 0.12 75) | #A36B08 | Incomplete review |
| Danger | oklch(0.51 0.16 28) | #AE3324 | Release blocker |
| Info | oklch(0.46 0.08 245) | #25608B | Informational review state |

Dark mode is re-derived as #101A15 background, #15231C surface, and #E8F0EA text. The accent becomes #F08A64. All foreground/control combinations retain WCAG AA contrast.

## Type (locked)

| Role | Family | Use | Notes |
| --- | --- | --- | --- |
| Display and body | IBM Plex Sans Variable, sans-serif | Project title, briefing prose, controls | Tight but human, `-0.045em` display tracking, 68ch prose measure |
| Utility | IBM Plex Mono, monospace | Counts, timestamps, state labels | 11–13px only; never paragraph copy |

## Scales (locked)

- Spacing: 0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96px.
- Radius: 0, 2, 4, 8px, and full. The project ledger relies on rules, not rounded surfaces.
- Motion: 120ms / 240ms / 420ms with `cubic-bezier(0.16, 1, 0.3, 1)`. Only status changes may move. Honor `prefers-reduced-motion`.
- Icon family: real Simple Icons marks for detected technologies; otherwise compact inline SVG line icons. No generic geometric technology substitutes.

## Voice

Plain, considered, and materially specific. Verion says `I learned`, `I remember`, `I will review`, `Verify`, `Latest review`, and `Ready to ship`.

Visible copy never uses AI, agent, pipeline, scanner, graph, evidence, capsule, producer, or tool terminology. It names the customer's product areas and release paths instead. Do not add empty praise, theatrical loading messages, fake precision, or em dashes.

Every screen must read as the same product if placed side by side.
