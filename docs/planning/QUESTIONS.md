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

Why it matters: the supplied service can add credible security evidence, but it requires GitHub credentials, MongoDB, external tools, and stronger target-scan safety controls than Verion currently has.

Possible solutions:

- **Option A:** Keep it out of the current functional demo and complete the core loop first. This best protects reliability and the non-negotiable MVP.
- **Option B:** Run the isolated Stage 0 compatibility and safety spike after the timed demo rehearsal. Integrate only one high-confidence security finding if the result materially strengthens the demo.
- **Option C:** Integrate its full scanner suite and reporting UI now. This is not recommended because it creates scope creep and conflicts with Verion's selective release-decision experience.

Decision needed: approve Option A or Option B. See `SECURITY_INTEGRATION_PLAN.md` for the staged plan and mandatory safeguards.

**Resolved 2026-07-17:** The explicit product request approves a narrow Stage 1 adapter. Verion may run an optional Deep security review only when a loopback-only local service and an explicitly configured GitHub repository identity are present. It sends neither a target URL nor credentials, source, local memory, or browser material; it admits only critical high-confidence concerns into the existing release decision. A real authorized-service validation remains required before relying on this review for a release.
