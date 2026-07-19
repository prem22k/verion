# Local data, reset, and BYOM

Verion is local-first. It learns one application at a time and keeps that application's data in the application root, not in a hosted Verion account.

## Local data locations

Every project started with `verion` gets a Git-ignored `.verion/` directory.

| Path | Purpose | Contains credentials? |
| --- | --- | --- |
| `.verion/project-memory.json` | Project understanding, remembered journeys, change baseline, bounded review history, release decisions, and normalized security findings. | No |
| `.verion/assistant-conversation.json` | Local teammate conversation and safe citation/tool summaries. | No source excerpts or credentials |
| `.verion/assistant-audit.json` | A short local audit trail of assistant, review, and repair actions. | No questions, source, commands, diffs, or credentials |
| `.verion/verion-config.json` | Local preferences and provider selection. | Only environment-variable names; never key values |
| `.verion/fix-packets/` | Redacted repair briefs prepared for a confirmed Codex handoff. | No credentials; may contain approved, redacted code context |
| `.verion/repair-ledger.json` | Native-repair proposal and outcome history. | No credentials; may contain the visible, developer-approved replacement text |

Project memory, local config, packets, and repair records use owner-only file modes where the operating system supports them. Keep `.verion/` ignored; Verion adds it to this repository's `.gitignore` for its own project.

Verion never sends its memory file, browser state, credentials, or unrestricted project source to a provider. Before source excerpts can be used for one assistant answer or a native repair proposal, Verion asks for a separate confirmation and redacts secret-like values first.

## Forgetting and full removal

In Home, open **Local Memory** → **Manage local memory** → **Forget this project memory**. The confirmation replaces project understanding, remembered journeys, change baseline, review and issue history, and the teammate conversation with a fresh local learning pass. Provider preferences are deliberately retained so forgetting a project never destroys setup.

The action does not remove safe operational records such as the assistant audit, prior repair ledger, or a previously created Codex repair brief. To completely erase all Verion data for a project, stop Verion and delete that project's `.verion/` directory yourself. This is irreversible; it does not change your source files, Git history, or provider environment variables.

## Bring your own model

Verion works without a model. Project understanding, local memory, deterministic teammate answers, verification, and repair briefs still work locally.

For local model reasoning, open **AI setup** from the dashboard. It can remember the selected provider, model, endpoint, and credential method in `.verion/verion-config.json`; that file never stores the key value. Choose either an existing terminal/environment-variable key or explicitly confirm writing a key to the project `.env`. The key input is not kept in browser state, and the local server never returns it to the dashboard. The `.env` fallback is for local development convenience; OS credential-store support remains future work.

For headless or CI use, place provider settings in the `.env` file of the project where you run `verion`, or export them in that terminal. Restart Verion after changing environment variables.

Choose one provider in `.env`:

```bash
# OpenAI-compatible API
VERION_AI_PROVIDER=openai_compatible
VERION_OPENAI_COMPATIBLE_API_KEY=...
VERION_OPENAI_COMPATIBLE_MODEL=...
VERION_OPENAI_COMPATIBLE_API_STYLE=responses

# Or Gemini
# VERION_AI_PROVIDER=gemini
# VERION_GEMINI_API_KEY=...
# VERION_GEMINI_MODEL=...

# Or OpenRouter
# VERION_AI_PROVIDER=openrouter
# VERION_OPENROUTER_API_KEY=...
# VERION_OPENROUTER_MODEL=...

# Or a locally running Ollama model (no API key)
# VERION_AI_PROVIDER=ollama
# VERION_OLLAMA_MODEL=qwen3:8b
# VERION_OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
```

Existing `OPENAI_API_KEY` and optional `VERION_OPENAI_MODEL` are also supported as an OpenAI-compatible Responses setup. See [`.env.example`](../../.env.example) for optional endpoint overrides and the full variable list.

Ollama is the current no-key local option. OpenRouter may expose models labelled free by its service, but Verion does not promise a hosted free model or silently select one: enter a model identifier your account can use.

## Deep Security Review

Deep Security Review is available without provider setup or a separate security service. A developer starts it explicitly from Security; ordinary Verify does not run it in the background. It keeps findings local and folds credible concerns into the same release decision as Verify. It does not require MongoDB, GitHub credentials, a repository ID, or a scanner account.

The review builds one explicit local boundary: it includes eligible source, tests, configuration, workflows, manifests, lockfiles, and infrastructure files across the project. It excludes installed dependency folders, `public`, build output, caches, VCS internals, and runtime `.env` files. It does not read `.env` values; it may inspect Git index metadata only to warn that an environment file is tracked. Templates such as `.env.example` remain reviewable.

When the local capabilities are available, Verion combines code-pattern review, credential review, deployment/configuration review, and cross-ecosystem dependency matching. The primary dependency path is OSV Scanner; `npm audit --json --omit=dev --ignore-scripts` is a fixed, non-mutating npm fallback. Neither command installs packages nor runs project scripts. Dependency intelligence may contact its vulnerability source, but Verion never sends project memory, browser data, provider credentials, or raw source files for that lookup.

If a specialist local capability is unavailable or errors, Verion marks the Deep Security Review **incomplete** and makes an inconclusive release call. It never presents missing coverage as a clean result.

When a provider is available, Verion sends the smallest useful bounded context: a project outline for project understanding, curated review context for release reasoning, and only explicitly approved redacted source excerpts for a single assistant or repair request. It does not transmit raw local memory, credentials, browser material, or unrestricted repository contents.

## Browser review setup

The package includes Playwright, but Playwright installs Chromium separately. Before reviewing a running application, install the local browser runtime once:

```bash
npx playwright install chromium
```

If it is missing, Verion pauses only browser review and shows this command as the next step. Local understanding and the rest of the dashboard remain available.
