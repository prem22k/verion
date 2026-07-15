# Verion

AI software verification before you ship.

## Mission

Verion helps developers move from AI-generated code to shipping confidence.

## Problem

AI coding agents can create working-looking software quickly, but developers are still left wondering what broke, what was missed, and whether the result is safe to ship.

## Solution

Verion verifies the application like a careful product reviewer, finds meaningful issues, groups them by likely root cause, and prepares the context needed for Codex to fix them.

## Core Verification Loop

Generate. Verify. Diagnose. Fix. Verify again. Ship with confidence.

## Why It Matters

The future of software creation is faster, but speed without confidence creates anxiety. Verion exists to make AI-assisted development feel trustworthy.

## Current Status

The local-agent vertical slice is in progress: Verion discovers a local project, maps its repository, observes an optional running application, builds a Context Capsule from normalized Evidence, and produces a structured release report.

## Run Locally

```bash
npm install
npx playwright install chromium
cp .env.example .env
set -a && source .env && set +a
npm run verify -- --project /absolute/path/to/project --url http://127.0.0.1:3000
```

Set `OPENAI_API_KEY` in `.env` before running the command. `VERION_OPENAI_MODEL` is optional. `--url` is optional while Verion is limited to repository analysis; with a running URL, the agent also captures browser exploration, console, network, and screenshot Evidence. The command emits `{ evidence, capsule, report }`; GPT receives only the Context Capsule.

To inspect discovery without GPT diagnosis:

```bash
npm run discover -- --project /absolute/path/to/project
```

## Documentation

- [Documentation guide](docs/README.md)
- [Hackathon operating guide](HACKATHON.md)
- [Current execution](EXECUTION.md)
- [Shipping sprint](SPRINT.md)
