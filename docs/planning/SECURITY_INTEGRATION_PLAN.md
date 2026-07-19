# Built-In Security Review Plan

## Product Boundary

Deep Security Review is a bounded local Verion capability. It is not a separate dashboard, repository, service, or developer configuration workflow.

Verion remains responsible for the release decision. The local reviewer may contribute high-confidence critical or high concerns when they materially change whether the developer should ship.

## What the Engine Does

The local reviewer inventories every eligible project artifact, then combines purpose-built local code, credential, dependency, and deployment/configuration checks. Tests stay inside the code boundary; only explicitly synthetic credentials are suppressed. It keeps findings local; the dashboard receives only normalized, product-level concerns through Verion’s normal Evidence boundary.

## Local Operation

Deep Security Review is available whenever `verion` runs, but begins only after the developer presses **Start Deep Security Review** on Security. It does not require MongoDB, GitHub credentials, a repository identity, a scanner account, or a separate process. Optional future review sources must meet the same bounded local-data contract before becoming part of the default release path.

No developer needs to clone, wire, or open another product. The normal product workflow remains:

```text
verion → understand the project → verify → one release decision
```

## Required Security Controls

- Project scope is the directory in which the developer ran `verion`; no arbitrary repository or URL target is accepted.
- Every eligible source, test, configuration, workflow, manifest, lockfile, and infrastructure file is inventoried. Exclude only runtime `.env` files, public assets, installed dependencies, VCS internals, generated output, caches, and non-reviewable binaries. Do not silently cap the file count.
- No browser material, project memory, credentials, or raw source payload leaves Verion for the built-in local scan. A review may create a temporary local mirror of only the eligible files for local tools and removes it after the run. Dependency vulnerability matching may contact its vulnerability service only after the developer explicitly starts the review; it never sends source, memory, browser material, or provider credentials.
- Never read runtime `.env` values. Git index metadata may be used to identify a tracked environment file without reading its contents.
- Secret redaction before persistence, logs, dashboard display, and Codex handoff.
- No arbitrary command execution from review input.
- An Inconclusive decision when a started local review cannot complete or any required specialist local check is unavailable. Missing coverage is never presented as a pass.

## Explicit Non-Goals

- Do not expose raw scanner logs, graphs, endpoints, or dozens of findings in the dashboard.
- Do not add a security dashboard or a second release report.
- Do not accept arbitrary public or private URLs for scanning.
- Do not let GPT access the engine, its data, or any scanner directly.
