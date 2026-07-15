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

Phase 1 vertical slice in progress: a local Playwright agent verifies the companion workspace-creation flow and returns a grouped, evidence-backed release decision.

## Run Locally

```bash
npm install
npx playwright install chromium
npm run dev:verion
```

Open `http://127.0.0.1:5173` and select **Verify application**. The local agent explores the companion application at `/demo-target` and returns the verification result to the dashboard.

To run the local agent directly:

```bash
npm run verify:demo
```

## Documentation

- [Documentation guide](docs/README.md)
- [Hackathon operating guide](HACKATHON.md)
- [Current execution](EXECUTION.md)
- [Shipping sprint](SPRINT.md)
