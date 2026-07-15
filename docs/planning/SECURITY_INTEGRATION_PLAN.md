# ServX Attack Paths Integration Plan

## Recommendation

Treat `/home/premsaik/Desktop/Projects/servx-attackpaths` as an **optional security-evidence service**, not as a Verion subsystem and not as a second dashboard.

Verion remains responsible for the release decision. ServX Attack Paths may contribute one high-confidence security finding and its evidence when that finding materially changes whether the developer should ship.

## What the Service Provides

The service exposes `POST /api/v1/jobs`, job polling, and SSE progress. It can aggregate repository and deployment evidence from:

- Secret scanning.
- SAST patterns and optional Semgrep.
- Dependency vulnerabilities via OSV and GitHub advisories.
- IaC/container checks and optional Trivy.
- Live deployment secret-leak checks through Puppeteer.
- Optional scanners including gitleaks, nuclei, syft, and CloudSploit.

It persists jobs in MongoDB, materializes repositories from GitHub, and expects encrypted GitHub token data for repository analysis.

## Why It Is Not a Direct Phase 1 Dependency

- It scans GitHub repositories, not a supplied local project directory.
- It requires MongoDB, GitHub credentials, network access, and optional local CLI tools.
- Its raw output is broad and can overwhelm the single release decision Verion must present.
- Its live-target scanning accepts a URL; without additional controls, this creates SSRF and internal-network scanning risk.
- It runs external tools and materializes source code, so it needs a deliberately isolated execution boundary.

## Staged Plan

### Stage 0 — Compatibility and Safety Spike

Run ServX Attack Paths independently of Verion against an authorized, disposable repository and target. Confirm:

1. MongoDB and GitHub authentication work in the intended environment.
2. Available scanner tools, their versions, timeouts, and cleanup behavior are known.
3. The result schema contains the evidence Verion needs: severity, source, file or URL, explanation, and remediation context.
4. The target URL is explicitly authorized and cannot resolve to private or link-local network ranges.
5. Raw logs and artifacts do not expose secrets to the Verion dashboard.

Exit criterion: one high-confidence finding can be obtained and normalized without exposing credentials or adding a generic scanner UI.

### Stage 1 — Narrow Verion Adapter

Add a separate local adapter, not a direct dashboard dependency:

1. Verion starts an attack-path job only for an authorized repository and target.
2. The adapter consumes job status through polling or SSE.
3. It converts only high-confidence, release-relevant findings into Verion’s existing issue-group contract.
4. The dashboard shows a concise security evidence card within the same diagnosis—not a tool list, graph, or OWASP report.
5. The Codex brief includes only the finding, evidence, affected location, expected mitigation, and verification step.

Example Verion language:

> Needs Attention — a repository secret is reachable in the shipped build path. Rotate it and remove it from source before release.

### Stage 2 — One Demo-Quality Security Story

Only after the core functional loop remains reliable, choose one intentionally seeded and safely demonstrable security defect. The security evidence must strengthen the same shipping decision and still leave the audience with one clear diagnosis.

Do not show a broad security report, attack graph, or OWASP scorecard in the three-minute demo.

## Required Security Controls Before Any Integration

- Explicit authorization for every target URL and repository.
- Authentication between Verion and the service; do not rely on its current permissive CORS setup.
- SSRF protection: block loopback, private, link-local, and metadata-service address ranges unless an explicit local-development exception is enabled.
- Per-job sandboxing, CPU/time limits, artifact retention limits, and cleanup.
- Secret redaction before persistence, logs, dashboard display, and Codex handoff.
- Allowlisted scanners and pinned versions; no arbitrary command execution from request input.
- Clear user-facing disclosure that a security scan accesses repository/deployment data.

## Explicit Non-Goals

- Do not copy ServX source code into Verion.
- Do not make security scanning a required step for the current functional demo loop.
- Do not expose raw scanner logs, attack graphs, or dozens of findings in the dashboard.
- Do not accept arbitrary public or private URLs for scanning.

## Approval Gate

Before Stage 0, confirm that using this service and an authorized repository/target is in scope for the hackathon. Before Stage 1, approve the security controls and the single security story to demonstrate.
