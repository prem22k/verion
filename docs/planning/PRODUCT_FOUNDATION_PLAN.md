# Product Foundation Plan

The existing companion application and dashboard proof establish that Verion's local-agent architecture can work. They are not the product implementation path.

## Current Objective

Build a target-agnostic local agent for arbitrary React, Next.js, and Vite projects.

## Delivery Order

1. **Project discovery** — inspect the directory from which the local agent was launched, identify its framework, package manager, scripts, entry points, and candidate routes without hardcoded application knowledge.
2. **Repository graph** — represent files, relative imports, route ownership, and framework entry points in one inspectable graph.
3. **Local agent** — expose discovery and graph creation through a local CLI with structured output.
4. **Context Capsules** — turn a selected verification finding plus graph neighborhood into focused, source-backed repair context.
5. **Verification orchestration** — connect project discovery, browser evidence, graph reasoning, and capsules into a target-agnostic verification run.

## Initial Local-Agent Contract

```text
verion
verion discover --project <absolute-or-relative-path>
```

`verion` is the normal product start command: its current directory becomes the approved project scope. The explicit `discover --project` command remains a CLI inspection tool. Both emit structured project metadata and a repository graph without a running target URL, credentials, a demo fixture, or application-specific selectors.

## Product Constraints

- The developer's launch directory is the approved project scope. Verion detects a conventional loopback application URL when available; `--url` is an advanced override.
- The agent discovers framework conventions; it does not assume a route, feature, component, or defect.
- Browser exploration begins only after discovery supplies route and entry-point candidates.
- The graph and capsules are evidence products, not generic IDE indexes or raw scanner output.
- The existing demo target remains a regression fixture only.

## Evidence-First Architecture

Every Verion subsystem is an Evidence Producer or an Evidence Consumer. Discovery, graphing, browser observation, console logs, network logs, screenshots, security integrations, performance checks, and accessibility checks all emit the same `Evidence` shape.

The verification orchestrator accepts only `EvidenceProducer` implementations. It has no knowledge of Playwright, the security engine, Semgrep, or any other tool. The Context Capsule consumes Evidence only. Any GPT integration receives a completed Context Capsule only and never calls a browser, scanner, or graph builder directly.

## Current Implementation Boundary

The first complete local-agent slice is: discovery, repository graph, browser observation, normalized Evidence, Context Capsule, GPT diagnosis, and a structured release report. The dashboard opens already connected to the project from which the localhost agent was started. Security, performance, and accessibility remain outside this milestone.

## Local Project Connection

The local agent retains an approved connection only while it runs. When change watching is enabled, it debounces source changes and reruns the existing Evidence-first verification path. The dashboard receives local agent events and surfaces a new needs-attention state without turning routine activity into a notification stream.
