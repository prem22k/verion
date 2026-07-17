---
feature: verion-presence
register: product
design_system: native semantic HTML controls
binds_to: DESIGN.md
---

# Verion Presence

Every screen must read as the same product if placed side by side.

## Design read

**Quiet verification intelligence.** Verion should feel as attentive as a great coding environment, but its attention is directed at whether the product is safe to ship. It is not a chatbot waiting to be spoken to and not a mascot demanding attention. It is a small, legible signal that makes real product state feel present.

## Identity decision

Call the element the **Verion Presence** in design and implementation. Customer-facing copy never needs to name it.

Its fixed form has three parts:

1. **Aperture** — a rounded, incomplete outer enclosure. It suggests a careful point of view, not a face, eye, robot head, or orb.
2. **V core** — the existing abstract V geometry, centered and quiet. It is the only durable brand mark.
3. **Review line** — one thin horizontal trace that can move only when Verion genuinely advances its understanding or review.

There are no eyes, speech bubbles, limbs, emoji expressions, typing dots, chat bubbles, audio-wave forms, particles, floating cards, 3D rendering, or decorative status dots. The Presence communicates state through geometry, color, and one motivated motion only.

## Visual construction

- Use the existing inline SVG approach, never a bitmap, canvas, WebGL scene, or animation dependency.
- Keep the outer aperture as a 2px line with rounded joins, proportionally similar to the current 180 × 180 viewbox.
- Keep the V core as an open geometric mark, not a filled badge.
- Add the review line as a 44–56px horizontal stroke that crosses the lower third of the aperture. It is part of the object, not a progress bar.
- At desktop, the Presence is 72–96px in a masthead and 56–72px beside a live review. On compact screens it is 48–64px. It never dominates a recommendation or competes with the Verify button.
- Use only locked semantic colors from `DESIGN.md`. The neutral form uses Text at 20–30% opacity, active review uses Accent or Info, Concerned uses Danger only as a single settled segment, and Ready uses Success only as a single settled segment.
- No glow, blur, gradient, glass surface, drop shadow, or radial halo. The signature is the aperture and line, not visual effects.

## State model

Every state must come from actual local product state. Do not expose a Presence state just to make the page feel animated.

| State | Real trigger | Visual | Motion | Adjacent product copy |
| --- | --- | --- | --- | --- |
| **Learning** | First learning pass or source-change refresh is collecting supported project facts. | Aperture resolves from its lower-left gap; V core is Accent; review line is short and low. | The line advances once for each surfaced discovery, capped at four moves. 280ms per move. | `Learning how this project fits together.` |
| **Watching** | Verion is connected, has no review running, and is waiting on an explicit Verify or a watched project change. | Neutral aperture, muted V core, review line rests at the lower third. | Still. On entering this state only, one 140ms line-settle. | `Ready for review.` or existing current-status copy. |
| **Thinking** | Verion has completed observation and is forming the release recommendation. | Aperture is fully legible; core shifts to Info; review line sits through the center. | One deliberate center sweep every 2.8 seconds only while the real decision stage remains active. It stops immediately when that stage ends. | `Making a release decision.` |
| **Reviewing** | Verion is reviewing changes or checking the running product. | Accent aperture; V core remains steady; review line extends toward the active edge. | The line travels once at each lifecycle boundary or meaningful observation. Never use a timer-driven loop. | `Reviewing the latest version.` |
| **Concerned** | A completed release report says Needs Attention. | Aperture stays open at one small point; V core is Text; a short lower segment uses Danger. | No looping motion. The concerned segment arrives once over 140ms and settles. | `Needs attention.` |
| **Ready** | A completed release report says Ready to Ship. | Aperture closes cleanly; V core remains Text; lower segment uses Success. | One 280ms closure and line-settle, then still. | `Ready to ship.` |

### Inconclusive and paused review

`Inconclusive` is not Concerned and must not borrow the danger state. Keep the Presence in **Watching** with the locked Warning color on the review line only, then use the existing copy that explains why a clear decision was not possible. A paused review keeps its most recently completed visual state, with no motion, until the developer chooses the next action.

## Placement rules

- **First run:** Learning sits beside the introduction. It supports the sentence `I’m Verion.` but never talks or responds to the developer.
- **Mission Control:** Watching or the current completed decision state sits inside the existing current-status briefing. It remains secondary to the recommendation and Verify action.
- **Live review:** Reviewing or Thinking sits next to the active review step. It never appears beside every observation, which would make the review look like a control room.
- **Release confidence:** Concerned or Ready may appear once beside the main recommendation. It does not appear in every historical report row.
- **Fix with Codex:** Keep the last completed Concerned state still. Opening Codex does not change the Presence to a new fictional “repairing” state; Verion is waiting for a real source change.

## Motion rules

- Use the locked durations: 140ms for a state settle, 280ms for an understanding or review transition, 420ms only for first arrival.
- Use the locked `cubic-bezier(0.16, 1, 0.3, 1)` curve. No bounce, spring, rotation, pulse, shimmer, orbiting particle, or perpetual idle animation.
- Motion must correspond to a real lifecycle event from the local server. CSS timers must not simulate progress.
- `prefers-reduced-motion: reduce` replaces all movement with the final state immediately. Color and geometry still communicate the same state.
- If browser rendering is constrained, render the static state. The Presence must never delay Mission Control, block a button, or require a GPU.

## Accessibility

- The SVG is decorative (`aria-hidden="true"`). The adjacent status heading and sentence carry all meaning.
- Do not use color as the only state signal. Aperture closure/opening and the nearby written recommendation distinguish Ready, Concerned, and Watching.
- Do not place focusable controls inside the Presence.
- Respect text scaling and narrow layouts by allowing the Presence to shrink before any release copy is truncated.

## Copy guardrail

The Presence does not speak. It never produces chat language such as `How can I help?`, `I’m thinking…`, `I found something!`, or a typing indicator.

Use the existing factual copy around it: `Learning how this project fits together.`, `Reviewing the latest version.`, `Making a release decision.`, `Needs attention.`, and `Ready to ship.`

## Design Pre-Flight

- [x] Binds exactly to the locked technical/utilitarian identity, palette, type, scale, inline SVG icon family, and motion curve.
- [x] Commits to one brief-specific signature: aperture + V core + review line. It does not use a generic AI orb, chatbot, robot, assistant face, dark glow, or 3D mascot.
- [x] Maps all six requested states to actual product lifecycle conditions and defines Inconclusive and paused-review behavior without inventing a seventh emotional state.
- [x] Gives every motion a real trigger and removes idle theatre, timers, and decorative loops.
- [x] Covers first run, Mission Control, live review, decision, repair handoff, constrained rendering, reduced motion, and narrow screens.
- [x] Specifies decorative SVG semantics, adjacent text, no color-only meaning, no focus trap, and reduced-motion behavior.
- [x] Self-critique: distinctiveness 4; hierarchy 4; consistency 4; accessibility 4; state coverage 4; copy 4; restraint 4; motion motivation 4. Total 32/32.

## Build handoff

**Target:** `react-vite-tailwind-engineer` equivalent. This is a Vite React SPA with existing native semantic controls and CSS. No dependency is required.

Implement exactly this specification only after approval. Theme the existing `VerionPresence` SVG with the locked tokens; do not add a chatbot surface, 3D asset, animation library, new server state, or timer-generated progress. Map existing lifecycle and release states to the six Presence states, and keep all status wording in adjacent plain-language copy.

Acceptance criteria:

- One lightweight SVG Presence renders Learning, Watching, Thinking, Reviewing, Concerned, and Ready using only supported lifecycle conditions.
- It never becomes a chatbot, mascot, autonomous character, or visual progress simulator.
- Motion is limited to the specified, real-event-triggered transitions and honors reduced motion.
- It remains decorative and never replaces written release status, recommendation, or action copy.
- The layout remains calm, responsive, and no heavier than the current inline SVG implementation.
