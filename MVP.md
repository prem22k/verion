# Non-Negotiable MVP

Verion succeeds if a developer can:

1. Generate code with an AI coding agent.
2. Press Verify.
3. Verion autonomously explores the application.
4. Verion finds meaningful issues.
5. Verion groups issues by likely root cause.
6. Verion prepares context for Codex.
7. Codex fixes issues.
8. Verion verifies again.
9. The developer confidently ships.

Everything else is optional.

## User Journey

A developer uses Codex to build or modify a product experience. The result looks promising, but the developer does not know what edge cases were missed.

They open Verion and press Verify. Verion explores the application, observes behavior, identifies meaningful issues, and groups related failures into a small number of likely root causes.

Instead of handing the developer a long list of warnings, Verion prepares the context Codex needs to make a focused fix. Codex applies the change. Verion verifies again. The developer sees that the issue is resolved and ships with confidence.

## Happy Path

1. The developer finishes an AI-generated change.
2. The developer presses Verify.
3. Verion explores the product without requiring manual test writing.
4. Verion finds a user-visible issue.
5. Verion explains the likely root cause in plain language.
6. Verion prepares a concise fix brief for Codex.
7. Codex fixes the issue.
8. Verion reruns verification.
9. Verion reports that the original issue no longer appears.
10. The developer ships.

## Success Criteria

- A first-time viewer understands the product within thirty seconds.
- The demo shows a real issue discovered by Verion, not a scripted warning.
- Findings are grouped by likely root cause instead of listed as isolated failures.
- The Codex handoff feels obvious and useful.
- The second verification pass clearly increases confidence.
- The product feels smaller, sharper, and more trustworthy than a generic QA tool.

## Demo Story

The developer asks Codex to build a feature quickly. The feature appears to work. Verion runs verification and finds that a key user path breaks under a realistic interaction.

Verion does not overwhelm the developer with every symptom. It groups the symptoms into one likely cause and prepares the context Codex needs. Codex fixes the issue. Verion verifies again and confirms that the path now works.

The audience should remember one thing: AI can write the code, but Verion gives you the confidence to ship it.

## Features Required for MVP

- A clear Verify action.
- Autonomous product exploration.
- Meaningful issue discovery.
- Root cause grouping.
- Concise issue explanation.
- Context preparation for Codex.
- A visible verification rerun.
- A clear ready-to-ship state.

## Features Intentionally Excluded

- Team collaboration.
- User accounts.
- Billing.
- Historical analytics.
- Plugin marketplace.
- Enterprise reporting.
- CI/CD integrations.
- Slack notifications.
- Browser extension.
- Mobile app.
- Custom workflow builders.
- Broad multi-agent orchestration.
