# Mission Control

This specification binds to `DESIGN.md`. Every screen must read as the same product if placed side by side.

## Design Read

**A release briefing on a quiet local project, not an engineering dashboard.** Mission Control replaces data density with a clear point of view: Verion knows the project, notices what moved, remembers the important paths, and asks for one decision.

## Aesthetic Direction

Technical / utilitarian, expressed as a **ruled briefing sheet**. The layout is asymmetric but not decorative: the project story occupies the wide column, and the current release state is a narrow, anchored decision column. Divider rules carry hierarchy. Flat surfaces, restrained color, and deliberate space keep it calm.

Counterfactual default test: this is not a generic dashboard grid. The project reads like an evolving release brief, which is specific to Verion's role between generated code and a shipping decision.

## Mission Control Flow

**Goal:** Help a developer understand the current state of one local project and start one confident verification.

**Trigger:** Verion finishes project learning, the developer returns to an existing local project, or a verification completes.

```text
Project opens
    ↓
Mission Control refreshes its local briefing
    ↓
Developer scans understanding, change summary, and important journeys
    ↓
Developer reads the current release state
    ↓
[ Verify ]
    ↓
Review trail and release decision replace the briefing focus
```

Refresh preserves the current scroll position. A local agent interruption leaves the last known briefing visible and adds a quiet retry message. Mission Control does not create an empty technical error screen.

## Screen: Mission Control Home

### Desktop Composition

Use three distinct layout families, in order:

1. **Decision masthead**: an asymmetric two-column header. Project Understanding is wide. Current Status and the single Verify action are a narrow, vertically anchored column.
2. **Ruled briefing columns**: Recent Changes and Known User Journeys sit in unequal columns beneath one continuous horizontal rule. They are lists, never cards or tables.
3. **Report shelf**: Recent Reports is a full-width, compact vertical stack. Each report is one clickable ruled row, not a panel within a panel.

Keep the entire first decision within one desktop viewport whenever content is sparse. At 768px and below, stack the status directly after Project Understanding, then changes, journeys, and reports. Verify remains full-width and at least 48px tall on touch devices.

### Project Understanding

**Purpose:** Establish that Verion recognizes the product, not merely its files.

Copy:

```text
What Verion understands

I think this is a SaaS dashboard with authentication and billing.

Built with Next.js, React Server Components, Clerk Authentication, Stripe, and PostgreSQL.
```

Use the saved project summary as the large sentence. Technologies appear as a single readable sentence or short wrapped inline list with genuine inline icons. Do not render a chip cloud. Product areas appear as brief supporting phrases, such as `Dashboard, billing, and sign-in are important here.`

Partial state: `I understand the main shape of this project. I’ll learn more when I review the running app.`

### Recent Changes

**Purpose:** Make change awareness useful without becoming a diff viewer.

Show at most three recent change groups. Group local paths into human terms:

- Application code changes
- Interface changes
- Project setup changes
- New product areas

Copy example:

```text
Recent changes

Application code changed since the last review.
Interface changes are waiting to be checked.
```

Never show raw file paths, timestamps with seconds, commit hashes, or a scrolling event log. If there are no changes: `No changes since Verion last learned this project.` If there is no prior baseline: `Verion will notice what changes after this first review.`

### Known User Journeys

**Purpose:** Explain the product paths Verion will protect.

Display up to four human labels from local memory as a ruled list. Prefer browser-observed names over generic route names where available. Include one understated source line beneath each label only when it adds clarity: `Seen in the running app` or `Understood from the project.`

Copy examples:

```text
Known user journeys

Home
Dashboard
Billing
Sign in
```

Empty state: `Verion has not seen a running product path yet. The first review will teach it where people begin.`

### Current Status and Verify

**Purpose:** Replace uncertainty with a single release-oriented instruction.

Status wording:

- No prior verification: `Ready for review`
- Last report ready: `Ready to ship`
- Last report needs attention: `Needs attention`
- Last report inconclusive: `Needs a closer look`
- Active review: `Reviewing now`

The status label, one supporting sentence, and `Verify` are a tightly grouped decision unit. Verify is the only filled control in the view. When active, it remains in place as disabled `Verion is reviewing…`; it never turns into a spinner-only control.

No scores, percentages, operational counters, progress bars, or health dashboards.

### Recent Reports

**Purpose:** Give the developer continuity without making them inspect a history tool.

Display the three most recent release decisions. Each ruled row contains the outcome in text, the report headline, and a relative time such as `Today` or `Yesterday`. Selecting a row opens the existing release decision in place, moving focus to its heading.

Empty state:

```text
Recent reports

Your release decisions will live here after the first review.
```

Never show evidence IDs, raw diagnostics, request status, or report JSON in this section.

## States and Recovery

### Initial local learning

The existing first-run experience remains the entry point. It transitions into Mission Control only after the developer continues. Do not show Mission Control while first-run discoveries are still animating.

### Loading local briefing

Show a static masthead placeholder and three short ruled placeholders. Do not use shimmer, fake counters, or an activity feed. Announce `Loading your project briefing` through a polite live region.

### Local agent unavailable

Keep the last rendered briefing if present. Below the masthead show: `Verion is not connected to this project right now.` Offer one secondary `Reconnect` action. If no briefing exists, retain the existing terminal launch instruction.

### Partial memory

Render every section with the information available. Missing changes, journeys, or reports use their individual empty states. Never block Verify because a section is empty.

### Verification in progress

Current Status becomes `Reviewing now`. Verify is disabled. The rest of the briefing remains visible until the review trail takes focus. Screen readers receive one polite announcement when review starts and one assertive announcement only if the final release decision needs attention.

## Component Briefs

### MissionMasthead

Purpose: Holds Project Understanding and the Current Status decision unit.

- Uses the wide/narrow asymmetric grid on desktop and one column on mobile.
- The project summary is the only display-size text.
- Technologies use the locked inline SVG icon family and text labels.
- Verify is keyboard reachable immediately after the status explanation.
- `aria-live="polite"` announces status changes; do not repeat unchanged project understanding.

### BriefingList

Purpose: Presents changes or journeys as a small ruled list.

- Maximum four visible items, then a text disclosure: `Show all`.
- Disclosure uses `aria-expanded` and retains focus when collapsed.
- Long labels wrap. There is no horizontal scrolling.
- Empty content is explanatory and contains no decorative placeholder icon.

### ReleaseStatus

Purpose: Communicates the current recommendation in text and color.

- `ready`, `attention`, `closer-look`, and `reviewing` variants use locked semantic colors.
- Color never carries the outcome alone.
- The active state has one 280ms rule draw. Reduced motion renders it immediately.

### ReportShelf

Purpose: Provides compact continuity across completed release decisions.

- Each row is a button with outcome, headline, and relative date.
- Enter and Space expand one report. Escape collapses and returns focus to the row.
- The selected report appears inline below its row, using existing release-decision copy and proof disclosure.

## Accessibility

- Text uses locked `Text` and `Muted` colors on locked surfaces. Accent, semantic status rules, and focus indicators retain at least 3:1 contrast. Body text remains above 4.5:1.
- Visible focus uses the locked accent outline. Every interactive row and disclosure is operable by keyboard.
- Status changes use a polite live region. A needs-attention outcome uses `role="alert"` once when it appears.
- Touch targets are at least 48px high.
- All motion honors `prefers-reduced-motion`; it clarifies a state transition and never loops without purpose.

## Build Handoff

**Target agent:** `react-vite-tailwind-engineer`

**Design system:** Native semantic HTML controls, already chosen in `DESIGN.md`. Do not add a component library or restyle generic dashboard primitives.

**Data requirement:** The local agent must provide a curated Mission Control summary from the project-owned `.verion` memory through the loopback dashboard connection. It must contain only the user-facing profile, understanding, recent change groups, known journeys, current release state, and recent reports. It must never contain raw source, screenshots, paths, evidence IDs, credentials, or implementation vocabulary. The data remains on the local machine.

Implement exactly this spec. Theme the design system with the locked tokens; do not redesign or re-implement its components.

### Acceptance Criteria

- [ ] Mission Control includes Project Understanding, Recent Changes, Known User Journeys, Current Status, Verify, and Recent Reports.
- [ ] The home has one primary action, no tables, no logs, no raw paths, and no internal architecture terms.
- [ ] Every populated and empty state has the copy and interaction behavior above.
- [ ] The layout uses a masthead, ruled briefing columns, and report shelf rather than repeated cards.
- [ ] Light, dark, keyboard, screen-reader, reduced-motion, and mobile behavior follow `DESIGN.md`.
- [ ] Mission data remains local and excludes raw implementation data.

## Design Pre-Flight

- [x] Every value binds to `DESIGN.md`; off-system values: 0.
- [x] One accent, radius scale, icon family, and type pairing.
- [x] Identity lock holds. Every screen must read as the same product if placed side by side.
- [x] No banned fonts, gradients, cards, centered dark hero, fake telemetry, buzzwords, fake numbers, or visible em dashes.
- [x] The slop and counterfactual tests pass. The briefing rule is the signature element.
- [x] Loading, empty, partial, unavailable, and active review states are specified.
- [x] Keyboard, screen-reader, contrast, touch, and reduced-motion behavior are specified.
- [x] Three layout families are used: masthead, briefing columns, report shelf.
- [x] One primary action appears in the view.

Scores: distinctiveness 3, hierarchy and focus 4, consistency 4, accessibility 4, state coverage 4, copy quality 3, restraint 4, motion motivation 3. Total: 29/32. No axis is below 3.

Revise and justify: reduced visual density from 6 to 4 and replaced the dashboard rail emphasis with one briefing rule, because Mission Control must feel like a calm release brief rather than an engineering instrument.
