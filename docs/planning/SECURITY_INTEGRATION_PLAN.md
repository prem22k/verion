# Built-In Security Review Plan

## Product Boundary

Verion ships a local security review engine under `services/security/`. It is an internal capability of the same product—not a separate dashboard, repository, or developer workflow.

Verion remains responsible for the release decision. The engine may contribute one high-confidence critical concern when it materially changes whether the developer should ship.

## What the Engine Does

The engine can review an explicitly authorized repository for secret exposure, dependency vulnerabilities, unsafe application patterns, and infrastructure concerns. It keeps its job data and operational details local; the dashboard receives only curated, eligible critical concerns through Verion’s normal Evidence boundary.

## Local Operation

The root workspace installs the engine with `npm install`. When an authorized deep review is configured, `verion` starts the loopback-only engine automatically. It keeps its own local database and credential configuration in `services/security/.env`.

No developer needs to clone, wire, or open another product. The normal product workflow remains:

```text
verion → understand the project → verify → one release decision
```

## Required Security Controls

- Explicit authorization for every repository and target.
- Loopback-only communication between the local agent and engine.
- No arbitrary source paths, browser material, project memory, or credentials sent from Verion to the engine.
- Per-job sandboxing, CPU/time limits, artifact retention limits, and cleanup before broad availability.
- Secret redaction before persistence, logs, dashboard display, and Codex handoff.
- Allowlisted scanners and pinned versions; no arbitrary command execution from request input.
- An Inconclusive decision when a configured security review cannot complete.

## Explicit Non-Goals

- Do not expose raw scanner logs, graphs, endpoints, or dozens of findings in the dashboard.
- Do not add a security dashboard or a second release report.
- Do not accept arbitrary public or private URLs for scanning.
- Do not let GPT access the engine, its data, or any scanner directly.
