# Evidence Architecture

Evidence is Verion's only subsystem integration boundary.

## Rule

Every producer emits `Evidence`. Every consumer reads `Evidence`. No producer exposes a tool-specific report to the orchestration layer, dashboard, or GPT.

## Producer Contract

```ts
interface EvidenceProducer {
  readonly id: string
  produce(context: EvidenceProductionContext): Promise<Evidence[]>
}
```

Each `Evidence` object has a stable identity, producer, kind, timestamp, concise summary, optional location, and structured data.

## Current Producers

- `repository-discovery` → `repository_discovery`
- `repository-graph` → `repository_graph`
- `browser-observation` → `browser_exploration`, `console_log`, `network_log`, and `screenshot`

## Planned Producers

- Browser exploration → browser-action evidence and screenshots.
- Console observer → console-log evidence.
- Network observer → network-log evidence.
- ServX adapter → security-finding evidence.
- Performance analyzer → performance-finding evidence.
- Accessibility analyzer → accessibility-finding evidence.

## Orchestration

The verification orchestrator receives an ordered list of `EvidenceProducer` instances. It does not import, invoke, or reason about Playwright, ServX, Semgrep, or any scanner directly.

## Context Capsules and GPT

Context Capsules are assembled solely from Evidence plus graph-linked source excerpts. GPT receives a Context Capsule only. It never receives direct tool connections, raw scanner APIs, or browser automation controls.

GPT returns one structured release report: recommendation, concise diagnosis, cited Evidence IDs, and next action. If the capsule is insufficient or GPT is unavailable, Verion reports that state explicitly rather than inventing a diagnosis.

## Presentation

The dashboard presents selected Evidence in support of a release decision. It does not present tool dashboards, scanner reports, or raw logs by default.
