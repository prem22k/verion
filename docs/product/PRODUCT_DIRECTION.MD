# Verion — Product and AI Experience Direction

We are locking the next major product direction for Verion.

Read this carefully and treat it as the source of truth for upcoming product and UI work.

Do not immediately implement everything. First inspect the existing implementation, identify what can be reused, update the relevant product/design documents, and propose an implementation sequence that preserves the existing verification architecture.

---

# 1. What Verion Is

Verion is a local-first AI teammate for developers building software with agentic coding tools such as Codex, Claude Code, Cursor, and similar tools.

The problem:

AI coding agents can generate and modify software extremely quickly, but developers are left with a new bottleneck:

"What did the AI break, and can I safely ship this?"

Verion sits between AI-generated code and shipping.

The core experience is:

Developer uses an AI coding agent
→
AI modifies the application
→
Verion understands what changed
→
Verion reviews the application
→
Verion finds functional and technical issues
→
Verion explains what matters
→
Verion can help repair the issues
→
Verion verifies again
→
Developer gets a clear release decision

The product should feel like an experienced AI teammate that understands the application and continuously reviews the work produced by coding agents.

It must not feel like:

* A generic testing dashboard
* A scanner collection
* DevTools
* A Playwright wrapper
* A security dashboard
* A collection of AI features

The internal architecture can remain sophisticated, but the user experience must remain simple.

---

# 2. Local-First Experience

The developer starts Verion from their project:

```
cd my-project
verion
```

Verion should:

1. Start the local Verion agent.
2. Open the Verion dashboard automatically.
3. Discover the project's technology stack.
4. Analyze the repository structure.
5. Build and maintain internal project understanding.
6. Create or update persistent local project memory.
7. Detect important application areas and likely user journeys.
8. Remember previous reviews and project understanding.
9. Watch relevant project changes while Verion is running.

The developer should quickly feel:

"Verion understands the application I'm building."

Do not expose implementation concepts such as repository graphs, Evidence Producers, Context Capsules, AST parsing, or internal scanners in the primary UI.

Translate those capabilities into human product language.

---

# 3. AI Architecture

Verion must NOT be permanently tied to one LLM provider.

Implement a provider-independent AI layer.

Conceptually:

Verion
→
AI Provider Layer
→
Selected Model

The product should eventually support two modes.

## Mode A — Verion AI

This is the zero-configuration experience.

Users can immediately try Verion using an AI provider configured and operated by Verion.

IMPORTANT:

Never expose or distribute the Verion-owned provider API key.

The key must never exist in:

* Browser frontend code
* The distributed CLI/package
* LocalStorage
* Public environment files
* The user's `.verion` directory

Requests using Verion AI must eventually go through a controlled Verion backend/proxy with:

* Rate limits
* Usage limits
* Spending limits
* Abuse protection

For the hackathon/demo, this should provide the easiest possible first-run experience.

## Mode B — Bring Your Own Model

Developers should be able to connect their own AI provider and API credentials.

The architecture should be designed to support providers such as:

* Google Gemini
* OpenAI
* Anthropic
* Groq
* OpenRouter
* Mistral
* OpenAI-compatible endpoints
* Future providers

Do NOT implement every provider separately during the hackathon.

Prioritize an extensible provider abstraction.

Initial practical support can focus on:

1. Verion AI
2. Gemini
3. OpenRouter
4. OpenAI-compatible custom endpoint

Provider credentials must remain local when using BYOM.

Do not expose raw API keys to the dashboard frontend.

Use secure local credential storage or OS credential storage where practical.

---

# 4. Model Capabilities

Do not assume every model can perform every Verion capability.

Models may support different capabilities:

* Large context
* Structured output
* Tool calling
* Reasoning
* Vision
* Code generation
* Code editing

Verion should understand provider/model capabilities.

For example:

A model without tool calling may still:

* Understand findings
* Explain problems
* Generate fix instructions

But it may not support Verion's native autonomous repair workflow.

The product should degrade gracefully instead of failing.

---

# 5. AI-Independent Verification

Verion's core verification capabilities must not depend entirely on an LLM.

The following can operate deterministically:

* Repository discovery
* Project mapping
* Browser verification
* Console monitoring
* Network failure detection
* Security scanning
* Static analysis
* Existing deterministic tooling

The AI layer adds intelligence:

* Project understanding
* Correlation
* Root-cause reasoning
* Prioritization
* Explanation
* Repair planning
* Code repair

Without an AI provider, Verion should still be useful.

With an AI provider, Verion becomes significantly more intelligent.

---

# 6. Persistent AI Assistant

The dashboard will contain a persistent AI assistant panel.

Think of the interaction model of Codex or Claude Code, but focused specifically on the current project and Verion's knowledge.

The assistant remains visible and consistent across the entire product.

It should NOT be a generic chatbot.

It is the conversational interface to Verion's project intelligence.

The assistant should have access, through controlled internal tools, to relevant Verion capabilities such as:

* Project understanding
* Local project memory
* Current changes
* Verification results
* Security findings
* Relevant source files
* Repository relationships
* Previous reviews

The user should be able to ask questions such as:

"Why shouldn't I ship this?"

"What changed since my last review?"

"Explain this vulnerability."

"Which files are causing this?"

"Fix the critical issues."

"What parts of the app are affected by my latest changes?"

"Prepare this for Codex."

The assistant should use the same configured AI provider selected by the user.

It should feel context-aware from the first message.

Do not make the developer repeatedly explain their project to it.

---

# 7. Fixing Issues

Verion should support two repair paths.

## Native Verion Repair

When the configured model supports the required capabilities, Verion can prepare and execute a bounded repair workflow.

The model should operate through controlled tools such as:

* Read relevant file
* Search code
* Inspect related files
* Propose patch
* Apply patch
* Run verification
* Run tests

Do not give the model unrestricted filesystem control.

Repairs must be scoped to the identified problem.

After changes:

Verion should automatically verify the affected functionality again.

The user must be able to see what changed.

## External AI Agent

Some developers will prefer Codex, Claude Code, Cursor, or another coding agent.

Every actionable issue or group of issues should therefore support:

"Copy Fix Prompt"

Verion generates a complete self-contained repair brief containing:

* Project context
* Issue
* Severity
* Affected files
* Relevant code context
* Evidence
* Root-cause reasoning
* Expected behavior
* Verification instructions

The developer can paste this directly into their preferred coding agent.

Verion does not compete with coding agents.

Verion gives coding agents better context about what needs to be fixed.

---

# 8. Application Structure

The dashboard should have exactly TWO primary pages for the MVP.

## Page 1 — Home

This is the primary Verion experience.

It should communicate:

* Project understanding
* What Verion learned
* Technology stack
* Important application areas
* Known user journeys
* Recent changes
* Likely impact of changes
* Current verification status
* Latest release decision
* Primary Verify action

The user should understand the state of their application without scrolling through large reports.

The page should prioritize information aggressively.

This is not an analytics dashboard.

It is mission control.

## Page 2 — Security

This contains the Deep Security Review experience.

The developer starts it explicitly from Security. `Verify this change` must not silently begin a security review.

Do not expose the historical name of the security engine or individual internal scanner brands in the primary product UI.

The experience should show:

* Security review status
* Estimated review duration before starting
* Review progress based on actual local review stages, never a timer-led percentage
* Critical findings first
* High-severity findings next
* Affected file
* Relevant lines
* Clear explanation
* Suggested action
* Fix with Verion
* Copy Fix Prompt

The security page should not feel like a completely separate application.

It must share the same visual language and AI assistant.

Security findings can contribute to the overall release decision.

---

# 9. Persistent Assistant Layout

The AI assistant should remain present when navigating between:

Home
and
Security

Navigating pages must not reset:

* Conversation
* Context
* Current model
* Project understanding
* Assistant state

Conceptually:

┌─────────────────────────────────────────────────────────┐
│ Verion        Home        Security        Project       │
├────────────────────────────────────┬────────────────────┤
│                                    │                    │
│                                    │                    │
│         Current Page               │    Verion AI       │
│                                    │    Assistant       │
│                                    │                    │
│                                    │                    │
│                                    │                    │
├────────────────────────────────────┴────────────────────┤
│                  Persistent App Shell                   │
└─────────────────────────────────────────────────────────┘

The exact proportions should be determined through design exploration.

The assistant should feel integrated into the application rather than bolted onto it.

Consider allowing the assistant panel to collapse or subtly resize without disrupting the main experience.

---

# 10. No-Scroll Product Philosophy

The two primary pages should be designed around the available viewport.

Avoid long vertical dashboard pages.

The user should not need to scroll through the main product experience.

Instead use:

* Clear hierarchy
* Progressive disclosure
* Expandable details
* Drawers
* Modals where appropriate
* Focused panels
* Contextual transitions

Do not cram everything onto the screen just to avoid scrolling.

Prioritize.

Show the most important information first.

Reveal details on interaction.

---

# 11. Visual Direction

Verion should feel like a premium modern desktop application running in the browser.

Visual inspiration:

* macOS
* Apple product interfaces
* Modern native desktop applications
* Calm AI products

Do NOT blindly clone Apple.

Translate the principles:

* Excellent typography
* Strong visual hierarchy
* Generous spacing
* Restrained use of color
* Soft depth
* Subtle translucency where appropriate
* High-quality iconography
* Clear focus states
* Consistent radii
* Intentional empty space

Avoid:

* Generic SaaS dashboards
* Huge card grids
* Excessive gradients
* Neon AI aesthetics
* Overuse of glassmorphism
* Dense tables
* Cybersecurity dashboard aesthetics
* Terminal aesthetics everywhere

Verion should feel sophisticated and calm.

---

# 12. Motion and Micro-Interactions

Motion should communicate state.

Use smooth, subtle animations for:

* Verion learning the project
* Technology detection
* Project understanding appearing
* Verification starting
* Review progress
* Findings appearing
* Findings being correlated
* Release decision transitions
* Security scan progress
* Assistant thinking
* Navigation
* Panel expansion
* Successful repair
* Re-verification
* Ready-to-ship state

Animations should be subtle and fast.

Never make the developer wait for decorative animations.

Avoid theatrical agent animations.

Motion exists to make Verion feel alive and intelligent.

---

# 13. Verion's Visual Presence

Explore a lightweight visual identity for Verion.

This may be:

* A lightweight 3D object
* A carefully designed animated symbol
* A subtle character
* An abstract intelligent presence

Do not add a heavy 3D model simply for visual spectacle.

Its purpose is to communicate Verion's state:

* Learning
* Understanding
* Watching
* Reviewing
* Thinking
* Concerned
* Ready

It should become recognizable as Verion's presence throughout the product.

Performance is non-negotiable.

If 3D hurts performance or distracts from the product, use a lightweight animated visual instead.

---

# 14. The Emotional Experience

The first minute matters enormously.

The ideal first-run experience:

Developer runs:

```
verion
```

Dashboard opens.

Verion wakes up.

It begins understanding the project.

The developer watches:

Next.js detected
PostgreSQL detected
Authentication detected
Billing detected
Dashboard detected

Then Verion says something like:

"I think this is a multi-tenant SaaS application with authentication, subscriptions, and collaborative workspaces."

Then:

"I'm ready to review it."

The developer should think:

"This already understands my application."

That is the first wow moment.

The second wow moment is:

Verion finds several symptoms and explains that they share one root cause.

The third wow moment is:

Verion fixes or prepares a precise repair, verifies again, and changes the release decision to:

Ready to Ship.

---

# 15. Implementation Instruction

Do NOT immediately rewrite the application.

First:

1. Audit the existing UI and backend against this direction.
2. Identify which existing components and flows can be preserved.
3. Identify what needs to change.
4. Identify missing backend capabilities required by this UX.
5. Propose a sequenced implementation plan.
6. Update the relevant design and product source-of-truth documents.
7. Do not add unnecessary architecture.
8. Do not expand beyond the two-page MVP.

The existing Evidence-first architecture, repository understanding, local memory, verification orchestration, and security engine should be preserved where useful.

The next objective is to turn those capabilities into one cohesive, polished product.

The product should ultimately feel like:

"I turn Verion on inside my project. It learns my application, remembers it, reviews what my coding agent changed, catches what the agent missed, helps fix the important problems, and tells me when I can ship."
