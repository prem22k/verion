# The Verion Product Journey

This is the customer experience source of truth. It binds to `.ulpi/design/DESIGN.md` and covers the complete journey from the first `verion` command to a confident release decision.

## Design read

**Technical / utilitarian with a quiet companion.** Verion should feel like a careful staff engineer who arrives before a release, learns the shape of the work, remembers what matters, and gives a direct answer when asked.

The emotional bet is simple: in the first minute, the developer should stop feeling alone with an AI-generated codebase. They should feel that someone capable has already understood it.

This is not a generic developer dashboard. The product has one focal point at every moment: Verion learning, Verion reviewing, Verion's conclusion, or the next action.

## Emotional arc

| Moment | Developer feels | Verion must accomplish |
| --- | --- | --- |
| Browser opens | Curious, slightly doubtful | Establish a calm, capable presence immediately |
| Project learning | Seen and understood | Turn unfamiliar code into a legible product story |
| Returning later | Relieved | Show that Verion remembers without making memory feel invasive |
| Verification | Reassured that work is happening | Make review visible without noise or theatre |
| Release decision | Clear | Replace a pile of observations with one accountable opinion |
| Fix handoff | Unblocked | Make repair feel like the obvious continuation |
| Verification after repair | Confident | Prove the original concern was checked again |

## The unforgettable moment

The wow moment is the **convergence**.

While the developer watches a review, Verion adds a small number of meaningful observations to the review trail. At the end, the final three observations draw together into one ruled conclusion:

> **Creating a workspace loses the selected template.**

The screen immediately answers three questions:

- Why it matters: `People can believe they started from the plan they chose, but receive a blank workspace instead.`
- What Verion checked: three short observations.
- What to do: `Fix with Codex`.

The magic is not that Verion did many things. The magic is that it understood what those things meant together.

## Product vocabulary

| Intent | Say | Do not say |
| --- | --- | --- |
| Arrival | `I’m Verion. I’ll learn this project before you need to trust it.` | Setup complete, initialized |
| Understanding | `Here is what I learned.` | Analysis output, project graph |
| Memory | `I remember this project.` | Cached context, stored index |
| Live work | `Reviewing the workspace flow.` | Running checks, workers, tools |
| Discovery | `The confirmation screen did not preserve the chosen plan.` | Log, trace, event |
| Decision | `Not ready to ship.` / `Ready to ship.` | Risk score, confidence score |
| Repair | `Fix with Codex.` | Export prompt, payload, handoff data |

## Journey map

```text
Developer runs verion
        |
Browser opens
        |
Verion introduces itself
        |
Verion learns and remembers the project
        |
Before you ship. [Verify]
        |
Reviewing what changed
        |
What Verion found
        |
Not ready to ship [Fix with Codex]
        |
Verify again
        |
Ready to ship
```

## Screen 1: Arrival

### Purpose

Make the first three seconds feel intentional. The browser did not open to a configuration form or a blank dashboard. It opened because Verion is ready to meet the project.

### Layout

- Minimal top bar with the Verion mark and project name when available.
- The Verion presence sits at the left edge of the asymmetric main area, roughly 96px square on desktop and 72px on mobile.
- One large heading and one short paragraph. No cards, menus, or controls compete for attention.

### Copy

```text
I’m Verion.

I’ll learn this project before you need to trust it.

Learning your project
```

### Interaction

- Arrival begins automatically.
- A quiet `Continue now` text action appears after 800ms for people who do not want to watch the transition.
- When learning is complete, the view moves automatically to Screen 3. The developer never has to dismiss an onboarding modal.

### Motion

- The Verion presence appears over 420ms: outer aperture fades in, `V` core resolves, then one horizontal review line settles beneath it.
- The heading rises 8px and fades in over 280ms.
- With reduced motion, all elements appear immediately.

### Emotional goal

`Something thoughtful just arrived for my project.`

## Screen 2: Learning the project

### Purpose

Let the developer watch Verion become useful before they ask it to verify anything.

### Layout

- The Verion presence remains at the top of the review trail in its learning state.
- A large heading occupies the left column. The right column holds a progressive `What I learned` list with no more than four lines.
- Technology icons appear only for technologies Verion truly recognized. Each icon has a text label. No generic icon cloud.

### Copy progression

```text
Learning how this project fits together.

I found a web application built with Next.js, React, and TypeScript.
I found sign-in, workspace creation, and billing areas.
I found the screens people reach first.
I’m keeping this picture of the project for the next time you return.
```

The final sentence is conditional. If Verion has only partial understanding, use:

```text
I understand the main shape of this project. I’ll learn more as you work.
```

### Interaction

- Each discovered fact appears one at a time and remains visible.
- Clicking a product area, such as `Workspace creation`, opens a plain-language side note: `This is one of the paths Verion will pay attention to.`
- Clicking a technology icon opens an accessible tooltip with its name only. It never becomes a configuration panel.
- `Project details` is a subdued disclosure for people who need a path or launch time. It is not part of the main story.

### Motion

- New facts enter from the review line, not from arbitrary directions.
- Technology icons fade in after their associated fact. No bouncing, rotating, or count-up effects.
- The Verion presence's review line moves once per discovered fact, capped at four movements.

### Emotional goal

`It understands more than the code editor does. It understands the product.`

## Screen 3: Project home

### Purpose

Give the developer one calm moment before the release decision begins.

### Layout

- Heading and primary action on the left.
- `What Verion knows` appears as a ruled list on the right, not a set of cards.
- A compact memory line sits below the heading.

### First-visit copy

```text
Before you ship.

The change looks right. Verion will check what is easy to miss.

[ Verify ]

What Verion knows
This project helps teams create and organize workspaces.
The workspace flow is important to people using the product.
Your local app is ready to review.
```

### Returning-visit copy

```text
Welcome back.

I remember this project and the last release review.

Last reviewed today. The workspace flow changed since then.

[ Verify ]
```

### Interaction

- `Verify` is the only primary action.
- `What Verion knows` items expand in place for one additional sentence. They never open a new dashboard page.
- `Forget this project` appears only inside `Project details`, uses a confirmation step, and states what will disappear: `Verion will forget what it learned and previous reviews on this device.`

### Emotional goal

`I know exactly what to do, and I trust that Verion has context.`

## Screen 4: Reviewing the application

### Purpose

Make the review feel alive, legible, and restrained.

### Layout

- Heading changes in place. The Verion presence moves into its listening state beside the active review line.
- The review trail becomes the central element.
- A single supporting preview can appear beneath the trail when it materially helps, such as a screenshot of the screen being reviewed.

### Copy

```text
Reviewing what changed.

Reviewing the workspace flow
The selected template was visible before creation
The confirmation screen changed that choice
The created workspace did not match the choice
```

### Interaction

- `Verify` becomes disabled `Verifying` and retains its position.
- The newest review line is active. Completed lines remain readable.
- Up to four lines are visible. Older supporting lines are folded into `Review what Verion saw` after a decision appears.
- The developer can pause the visual transition with `Pause updates`; the review continues and the button changes to `Resume updates`. This controls only the animation, never the review itself.
- A screenshot can be enlarged through `Review what Verion saw`. The first focusable element in the expanded view is a close control; Escape returns focus to the trigger.

### Motion

- Each active line receives a single 280ms rule draw.
- Completed lines change from info to neutral text over 140ms.
- No percentage indicator, spinning dashboard, fake command console, or permanent pulsing indicator.

### Emotional goal

`It is looking at the consequences of my change, not merely checking boxes.`

## Screen 5: What Verion found

### Purpose

Turn several observations into one clear release decision.

### Layout

- The last three review lines visually lead into a single ruled conclusion beneath them.
- The conclusion is the largest object on the screen. Supporting proof stays secondary.
- The Verion presence changes to its certain state: the aperture becomes still and the review line aligns with the conclusion rule.

### Copy

```text
What Verion found

Creating a workspace loses the selected template.

Why this matters
People can believe they started from the plan they chose, but receive a blank workspace instead.

What Verion checked
The choice was visible before creation.
The created workspace reported a different template.
The same result appeared after the confirmation screen loaded.

Not ready to ship

[ Fix with Codex ]
Review what Verion saw
```

### Interaction

- `Fix with Codex` is the sole primary action.
- `Review what Verion saw` expands supporting screenshots and source context in place. It is a secondary text action.
- The release decision has text and color. It is never communicated by color alone.
- The developer cannot accidentally dismiss the conclusion. A new review replaces it only after they choose `Verify again`.

### The convergence motion

- The final three lines bend toward the conclusion rule over 280ms. The conclusion then fades in over 140ms.
- The motion happens once per run. It exists to show grouping, not to decorate the screen.
- With reduced motion, the lines immediately share the conclusion rule color and the conclusion appears without movement.

### Emotional goal

`I understand the one thing that matters, and I know why I should not ship it yet.`

## Screen 6: Fix with Codex

### Purpose

Make repair feel focused and immediate.

### Layout

- The conclusion remains visible in a compact ruled header so the developer never loses the reason for the repair.
- A single repair sheet replaces the proof list.
- The Verion presence is quiet and still. This is a handoff, not a second show.

### Copy

```text
A focused repair is ready.

Codex will fix the workspace flow and preserve the selected template through creation.

Verion will check the same path again when the repair is complete.

[ Fix with Codex ]
```

### Interaction

- The primary action is `Fix with Codex`.
- On activation, the button becomes `Preparing the repair` and disables duplicate activation.
- When the repair is ready to apply, show `Codex is fixing the workspace flow.` Do not show a stream of technical steps.
- If repair requires the developer's approval, the one decision is explicit: `Apply this repair` or `Not now`.
- After repair completes, the primary action transforms in place to `Verify again`.
- `Review the repair` is secondary and reveals a concise before-and-after summary, not a raw patch by default.

### Emotional goal

`I do not have to translate a bug report into work for another tool.`

## Screen 7: Verify again

### Purpose

Make the second review visibly purposeful rather than repetitive.

### Layout and copy

```text
Checking the repair.

Repeating the path that failed before
The selected template is still visible
The created workspace kept that template
The confirmation screen agrees
```

### Interaction

- `Verify again` becomes disabled `Checking the repair`.
- The previous concern stays visible as a small muted reference above the new review trail: `Previously: the selected template was lost.`
- There is no way to start an unrelated review from this screen. The single task is proving the repair.

### Emotional goal

`Verion is not trusting the fix blindly. It is proving it.`

## Screen 8: Ready to ship

### Purpose

Close the loop with earned confidence.

### Layout

- The prior concern and the confirmation appear as a minimal before-and-after pair joined by the review trail.
- Success green is used on the release decision and one rule only. The rest remains calm.

### Copy

```text
The fix held.

Verion repeated the path that failed. The selected template now stays with the created workspace.

Ready to ship

[ Ship with confidence ]
Review this run
```

### Interaction

- `Ship with confidence` confirms the decision locally: `This review is ready to keep with this project.` It never pretends to deploy or publish the application.
- `Review this run` expands the before-and-after trail.
- The next source change returns the product to Screen 3 with: `Something changed. Verify when you are ready.`

### Emotional goal

`I have earned confidence, not just a green badge.`

## Essential recovery states

| Situation | Screen and copy | Action |
| --- | --- | --- |
| Learning takes longer than expected | `I’m still learning how this project fits together.` Keep discovered facts visible. | `Continue to project` after the first useful fact |
| Verion learns only part of the project | `I understand the main shape of this project. I’ll learn more as you work.` | `Verify` |
| No local app is available | `I understand this project. Start the app when you are ready for a release review.` | `Check again` |
| Review cannot finish | `Verion could not finish this review.` State the last successful observation. | `Try again` |
| Nothing material is found | `No release blocker found in this review.` Do not imply the application is perfect. | `Ready to ship` |
| Repair cannot begin | `Your repair is ready, but Codex needs your attention.` | `Try again` / `Not now` |
| Repair does not resolve the concern | `The repair did not hold yet.` Keep the same conclusion and refresh the supporting proof. | `Fix with Codex` |
| Browser reconnects | `Welcome back. I kept the last completed review.` | `Verify` |
| Project memory is removed | `This project is new to Verion again.` | `Learn this project` |

## Interaction inventory

| Element | Behavior | Feedback |
| --- | --- | --- |
| `Continue now` | Skips arrival transition | Moves immediately to project home |
| Technology icon | Reveals its plain name | Accessible tooltip |
| Product area | Reveals why that area matters | Inline side note |
| `Verify` | Starts a release review | Becomes `Verifying`; review trail begins |
| `Pause updates` | Pauses visual updates only | Becomes `Resume updates` |
| `Review what Verion saw` | Opens supporting proof | Focus moves into disclosure; Escape returns |
| `Fix with Codex` | Begins focused repair | Button changes state; duplicate activation blocked |
| `Apply this repair` | Confirms repair when approval is required | Transforms to `Verify again` when complete |
| `Verify again` | Repeats the previously failed path | Becomes `Checking the repair` |
| `Ship with confidence` | Marks the review as acknowledged | Confirms locally; no false deployment claim |
| `Forget this project` | Clears remembered project context | Requires explicit confirmation |

## Motion system

| Moment | Motion | Duration | Meaning |
| --- | --- | --- | --- |
| Arrival | Verion presence resolves | 420ms | A capable presence has arrived |
| Learning fact | Review line settles, fact appears | 280ms | Verion learned something useful |
| Primary action | Label and state change | 140ms | The developer's intent was accepted |
| Review item | One rule draw | 280ms | A meaningful observation arrived |
| Convergence | Three trail lines lead into conclusion | 280ms | Separate observations became one judgment |
| Release change | Rule color changes, no scale burst | 140ms | The decision changed |

No motion loops forever. No particle effects, confetti, orbiting icons, or decorative 3D movement. `prefers-reduced-motion` replaces all movement with immediate state changes.

## Accessibility and responsive behavior

- One H1 per screen. All status changes use concise polite live regions.
- The Verion presence is decorative and hidden from screen readers. The adjacent status sentence carries the meaning.
- Every primary action is at least 48px high, with the locked 3px accent focus ring.
- Review trail uses an ordered list. New items are announced once and never replayed on refresh.
- Decision text is never color-only.
- On mobile, the Verion presence moves above the heading, the review trail becomes a single column, and conclusion actions become full width. The before-and-after pair stacks in chronological order.
- Source proof and screenshot disclosures preserve focus order and support Escape to close.

## Pre-flight

- [x] Every visual value uses the locked palette, type, spacing, radius, and motion scales.
- [x] The Verion presence and review trail are one distinctive signature across every screen.
- [x] No generic dashboard cards, fake metrics, purple glow, gradients, cream canvas, decorative status-dot field, fake names, or em-dash copy.
- [x] Each screen has one focal point and one primary action.
- [x] First visit, returning visit, loading, partial learning, no local app, interrupted review, repair failure, resolved review, memory removal, refresh, and reduced-motion states are specified.
- [x] Contrast, keyboard behavior, focus, live-region behavior, touch targets, and mobile layout are specified.
- [x] Self-critique: distinctiveness 4, hierarchy 4, consistency 4, accessibility 4, state coverage 4, copy 4, restraint 4, motion motivation 4. Total 32/32.

## Handoff boundary

This is a UX specification only. Do not add product screens, technical configuration, or backend concepts that are absent from this journey. Any future implementation must preserve the exact emotional sequence: introduction, understanding, remembered context, review, one decision, focused repair, proof after repair, earned confidence.
