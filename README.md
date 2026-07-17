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
npm run dev
```

For packaged use, run `verion` from the root of the application you want to verify. The launch directory is the approved project scope; the dashboard never asks you to paste a filesystem path. Verion automatically looks for a conventional localhost development server. If it cannot find one, use the advanced fallback: `verion --url http://127.0.0.1:3000`.

When developing Verion itself, `npm run dev` starts the agent against the current directory. Set `OPENAI_API_KEY` in `.env` before running the command. Verion loads `.env` when its local agent or CLI starts, so restart it after changing the file. `VERION_OPENAI_MODEL` is optional. The command emits `{ evidence, capsule, report }`; GPT receives only the Context Capsule.

### Built-in security review

Security review ships inside this repository as an internal Verion capability. The root `npm install` installs its workspace dependencies along with the dashboard and local agent; there is no second repository to clone or wire together.

When an authorized repository review is configured, its local credentials and database settings remain in `services/security/.env`. The dashboard never receives raw security output. Verion uses only eligible critical concerns as part of its existing release decision.

To inspect discovery without GPT diagnosis:

```bash
npm run discover -- --project /absolute/path/to/project
```

## Documentation

- [Documentation guide](docs/README.md)
- [Hackathon operating guide](HACKATHON.md)
- [Current execution](EXECUTION.md)
- [Shipping sprint](SPRINT.md)
