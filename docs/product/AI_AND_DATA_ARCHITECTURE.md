# Verion AI and Local Data Architecture

Source of truth: [PRODUCT_DIRECTION.MD](./PRODUCT_DIRECTION.MD)

This document defines the provider-independent boundary for AI, local data, assistant context, security findings, and repairs. Phase 4 adds a server-controlled read-only assistant layer: it chooses bounded local context, asks before a selected provider receives redacted source excerpts, and keeps a separate local operator trace. It does not introduce a hosted Verion AI service, uncontrolled source access, or file-changing repair behavior.

## Product boundary

Verion is a local-first teammate. Deterministic project discovery, local memory, browser review, console/network observations, security review, and release history remain useful when no AI provider is configured.

AI adds project reasoning, explanation, prioritization, repair planning, and eventually bounded code repair. AI does not replace deterministic verification.

```text
Verion product
  -> local deterministic capabilities
  -> provider-independent AI boundary
  -> selected model or no-provider fallback
```

The browser communicates only with the local Verion process. Provider credentials never cross into browser state.

## Provider modes

### Verion AI

Verion AI is a future hosted proxy mode. The CLI sends an authenticated request to a Verion-controlled backend. The backend owns upstream provider credentials, rate limits, usage limits, spend limits, and abuse protection.

The upstream provider key must never exist in the distributed CLI, browser frontend, project `.env`, `.verion` directory, local storage, logs, or repair packets.

#### Hosted proxy contract (design)

The local process may eventually exchange a device/session credential with a hosted Verion API. It never accepts an upstream-model key from the CLI.

```text
local Verion
  -> POST /v1/sessions (anonymous demo or signed-in account)
  <- short-lived, scoped session token
  -> POST /v1/structured-jobs (task, bounded payload, model preference)
  <- structured result, provider-safe usage status, request id
```

The proxy must authenticate every structured job, bind the token to a project-local pseudonymous installation identifier, enforce task and payload-size allowlists, and redact telemetry. It must not accept arbitrary URLs, shell instructions, source archives, browser recordings, local-memory files, or repair writes.

Anonymous demo sessions need a short expiry, a small per-device/per-IP request allowance, no persistent project retention, and an obvious upgrade path. Signed-in accounts need account-level usage and spend ceilings, rate limits, abuse detection, revocation, and transparent provider/model availability. The response must expose only a product-safe state such as `available`, `limit_reached`, `temporarily_unavailable`, or `not_authorized`; it must never expose upstream credentials, provider error bodies, or hidden routing details.

Until that service exists, the `verion_ai` adapter is deliberately capability-limited and falls back to deterministic local understanding and review with a clear explanation.

### Bring your own model

BYOM credentials stay local. The local runtime resolves a credential from an environment variable and passes it only to the selected provider adapter. The dashboard can save a credential-free provider/model selection and, only after explicit confirmation, write a supplied key to the project's owner-only `.env`; it never returns the key to the browser or persists it in `.verion`.

Initial adapter targets are Verion AI, Gemini, OpenRouter, OpenAI-compatible endpoints, and local Ollama. In Phase 1, OpenAI-compatible, Gemini, OpenRouter, and Ollama adapters are local integrations. A project can select a provider through credential-free `.verion/verion-config.json` metadata or environment variables; the local process resolves the credential at execution time. Existing `OPENAI_API_KEY` setups are treated as OpenAI-compatible Responses configurations, but require an explicitly selected model. Ollama is keyless and local; it is Verion's current free/local option.

The provider capability check runs before each AI task. If no provider, credential, model, or structured-output capability is available, Verion keeps its deterministic result and returns a concise explanation rather than attempting a provider call. Connection validation is local-process-only and returns provider/model status without a credential.

## Capability contract

Each selected model publishes these capabilities:

- Structured output
- Large context
- Tool calling
- Reasoning
- Vision
- Code generation
- Code editing

The product must degrade safely:

- No provider: deterministic understanding and review remain available.
- Explanation-only model: answer questions and generate a Copy Fix Prompt.
- Tool-capable model: perform controlled read-only investigation.
- Repair-capable model: prepare a bounded repair proposal. It still requires developer approval before any write.

## Local storage contract

| Location | Version | Owner | Contains | Must not contain | Retention |
| --- | --- | --- | --- | --- | --- |
| `.verion/project-memory.json` | v5 | Project understanding and review history | discovery, local understanding, routes, journeys, release history, issue history, content-aware change snapshots | provider credentials, assistant messages, source excerpts, repair diffs | until developer resets project memory |
| `.verion/verion-config.json` | v1 | Local product preferences | selected provider/model references, endpoint metadata, credential source/reference, assistant preference | API keys, bearer tokens, passwords, source excerpts, assistant messages, repair diffs | until developer resets local Verion settings |
| Project `.env` (explicit fallback) | developer-owned | BYOM credential | raw BYOM credential only after confirmation | project source, memory, assistant history | until developer removes it |
| Future OS credential store | not yet shipped | BYOM credential | raw BYOM credential only | project source, memory, assistant history | until developer removes connection |
| `.verion/assistant-conversation.json` | v2 | Local conversation | messages, provenance, validated citations (including discovered relative file/line references), safe read summaries, audit identifiers | raw credentials, source excerpts, provider request/response bodies, commands, unrestricted output, repair diffs | user-controlled local retention |
| `.verion/assistant-audit.json` | v1 | Local assistant and repair operator trace | safe action summaries, outcome, timestamp, record identifiers | raw questions, source text, credentials, provider payloads, command arguments, patch bodies | bounded local history until project memory is forgotten |
| Future repair proposal store | v1 | Explicit repair workflow | scope, diff, approval, verification result | provider credentials | per repair and user-controlled cleanup |

The local configuration file is optional. Absence means default local behavior with no configured provider. It is intentionally separate from project memory so AI settings can be reset without deleting the project picture.

### Credential fallback policy

Saved BYOM credentials should eventually use the operating-system credential store. Until a native, cross-platform integration is shipped, the local fallback is a provider-specific environment variable, including a project `.env` that the developer edits themselves or Verion updates only after an explicit confirmation. The configuration file can reference an environment-variable name but cannot contain its value. A key must never enter browser state, local storage, project memory, logs, diagnostics, repair packets, or provider-status responses.

## Migration policy

- Project memory versions 1 through 4 migrate to v5 using the existing migration path; v5 adds content digests to change snapshots.
- A missing local configuration file is treated as an unconfigured default, not an error.
- Local configuration v1 is validated strictly and rejected if it contains a credential-like field.
- Future migrations must be explicit, idempotent, atomic, and write only after successful validation.
- A failed migration must leave the existing file intact and fall back to deterministic local behavior.

## Assistant context and citation policy

The assistant receives context through controlled local capabilities, not a broad project dump.

The local Verion process selects this context deterministically from a fixed allowlist. A model receives an already-built compact JSON context; it has no tool, shell, network, filesystem, process, or write access and cannot request more files. This works equally for models without tool calling and for deterministic no-provider answers.

Allowed local conversation categories:

- Project understanding and local-memory facts
- Current changes and likely impact
- Release reports and known issues
- Normalized security findings
- Relevant discovered-file references, bounded relationship explanations, and limited redacted source context after one-question consent

The reader boundary searches only discovered, non-hidden project files (at most 12 matches), reads at most three allowlisted text files (32 KiB each), and clips each redacted excerpt to 120 lines / 2,400 characters. The complete provider context is capped at 12,000 characters. Traversal, absolute paths, hidden credential files, binary files, oversized files, and shell requests are refused. Redaction happens before counting or provider transmission and covers API keys, bearer tokens, private keys, connection strings, cookies/session values, password assignments, cloud keys, and environment-style values.

Metadata such as a discovered relative filename can be used locally. Before a configured provider receives a source excerpt, the browser must choose `Use code context` for that single question. Declining produces the best local answer without source transmission; refreshes and later questions require a new choice. Raw excerpts never enter conversation or audit persistence.

Every assistant answer identifies whether a statement is a discovered fact, review observation, or model inference. Citations may reference a project fact, change, release report, security finding, or discovered relative source file/line that was included in context. Provider answers are validated to cite only supplied records; failures fall back to the deterministic answer. Neither may expose provider credentials or hidden internal execution names.

## Tool and repair policy

Later assistant tools may read project understanding, local memory, current changes, release reports, security findings, and relevant files. They may not receive unrestricted filesystem access or arbitrary shell execution.

Native repair is a future, bounded workflow:

```text
Selected issue
  -> scoped context
  -> proposed patch and verification plan
  -> visible diff
  -> explicit approval
  -> scoped write
  -> verification
  -> updated release decision
```

`Prepare this for Codex` is assistant guidance only: it does not write files, create a repair brief, change a release decision, or open Codex. The separate `Fix with Codex` action requires an exact browser and server confirmation before Verion creates a review brief and opens Codex. The assistant audit records verification requests/results and repair approvals/results without command arguments or patch bodies.

`Copy Fix Prompt` is the provider-independent repair path. It must include the project context, issue, severity, affected files, relevant redacted context, evidence, likely cause, expected behavior, and verification instructions.

## Security finding contract

A normalized security finding records severity, explanation, affected area, optional file/line range, evidence references, suggested action, and fix state. The primary product shows critical then high findings. It never shows security engine or scanner brand names.

Security findings contribute to the same release decision as functional review results. Deep Security Review is developer-started from Security, so ordinary verification remains quick and does not silently trigger a separate security review.

## Phase 0 acceptance

- The provider, model, assistant, security-finding, repair, and local-preference contracts are typed without embedding provider credentials.
- Existing project memory remains readable and follows its current migration path.
- New local configuration is credential-free, validated, and atomically written.
- Assistant conversation v1 records normalize safely to v2; v2 and the v1 operator trace use atomic local writes and never persist raw source excerpts.
- The product/design documentation defines Home, Security, persistent assistant behavior, repair approval, and Copy Fix Prompt before UI work begins.
