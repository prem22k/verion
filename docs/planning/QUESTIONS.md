# Questions

This file captures material ambiguities that should be resolved before implementation. No major implementation choice should be inferred from silence.

## Q1 — What application will Verion verify in the Build Week demo?

Why it matters: autonomous exploration, the meaningful issue, and the credibility of the demo all depend on a concrete target.

Possible solutions:

- **Option A:** Build a deliberately small companion application with one realistic broken user flow. This gives the most reliable live demo and keeps scope controlled.
- **Option B:** Verify an existing application supplied by the team. This is more authentic, but may add setup and reliability risk.
- **Option C:** Support both. This is not recommended for Phase 1 because it expands the integration surface before the core loop is proven.

Decision needed: choose the target application and identify the specific user-visible failure Verion must discover.

**Resolved 2026-07-15:** Use the workspace-creation companion application. Verion must discover that the selected template is silently replaced by the default template at confirmation.

## Q2 — What technology/runtime should host the local agent and web dashboard?

Why it matters: the repository currently contains no application code, package manifest, design system, or runtime convention.

Possible solutions:

- **Option A:** Use a TypeScript local agent and TypeScript web dashboard, sharing result types. This is a small, maintainable default for browser automation and a polished web demo.
- **Option B:** Adopt an existing team stack, if one exists outside this repository. This preserves consistency but must be provided before implementation.
- **Option C:** Build only a static dashboard prototype. This is insufficient because the MVP requires a credible verification rerun.

Decision needed: confirm the expected stack or approve Option A.

## Q3 — How should the Codex handoff work in the demo?

Why it matters: the product promise requires Verion to prepare focused repair context, but the documents do not prescribe whether Codex is invoked, copied to a clipboard, or demonstrated manually.

Possible solutions:

- **Option A:** Display a concise, copyable fix brief that is pasted into Codex during the live demo. This is reliable and keeps Verion complementary to Codex.
- **Option B:** Invoke a local Codex CLI workflow from Verion. This feels seamless but introduces permission, environment, and demo-failure risk.
- **Option C:** Simulate the handoff. This is least credible and conflicts with the goal of showing a real issue and verified fix.

Decision needed: choose the handoff mechanism.

## Q4 — Which verification dimensions are required in Phase 1 beyond the one demo flow?

Why it matters: the product vision names functional, visual, security, accessibility, and performance awareness, while the MVP requires only meaningful issue discovery within one complete loop.

Possible solutions:

- **Option A:** Prioritize functional exploration plus evidence capture, with one visible user-impacting failure and a concise diagnosis. This best supports the non-negotiable MVP.
- **Option B:** Add one lightweight secondary signal, such as a console error or accessibility evidence, only if it strengthens the same diagnosis.
- **Option C:** Build dedicated scanners for every dimension. This is explicitly out of scope for Phase 1.

Decision needed: approve Option A, optionally with one supporting signal from Option B.

## Q5 — What are the official judging criteria and submission deadline?

Why it matters: `HACKATHON.md` must guide daily tradeoffs against the actual rubric, submission requirements, and remaining time.

Possible solutions:

- **Option A:** Provide the official Build Week rubric, submission requirements, and deadline. This is the only way to calculate remaining days and align the demo precisely.
- **Option B:** Authorize the provisional criteria in `HACKATHON.md` until official information is available. This keeps work aligned, but does not replace the organizer's rules.

Decision needed: provide the official details or approve the provisional operating assumptions.

## Q6 — Should Deep Security Review be used in the hackathon demo?

Why it matters: security must be credible without turning a local-first teammate into a hosted repository service.

Possible solutions:

- **Option A:** Keep security as an explicit, bounded local review after the first project understanding moment.
- **Option B:** Include a non-mutating npm dependency-vulnerability lookup when an npm lockfile is present.
- **Option C:** Add a separate hosted repository scanner and security dashboard. This conflicts with the local-first product boundary.

Decision needed: choose the bounded local path and preserve one shared release decision. See `SECURITY_INTEGRATION_PLAN.md` for the safeguards.

**Resolved 2026-07-19:** Deep Security Review runs against the directory that launched Verion. It never requires GitHub credentials, MongoDB, a repository identity, or a separate local service. Local code, credential, configuration, and dependency checks start only after the developer presses the Security action; normalized critical and high concerns feed the existing release decision. Missing specialist coverage is shown as an incomplete review, never a clean pass.
