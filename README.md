# Verion

An AI teammate that permanently learns your application locally and reviews every AI-generated change before you ship.

Run `verion` in a project directory. It opens a local Mission Control, learns the application, remembers that picture in the project's `.verion/` directory, and uses that context for later reviews. Verification, Deep Security Review, and Fix with Codex are capabilities of the same local teammate, not separate products.

## Install once, run anywhere

From this repository, install the local package globally once:

```bash
npm install -g .
```

Then move to any application directory and run:

```bash
cd /path/to/your-application
verion
```

Verion learns the directory you are in, opens the local dashboard, and stores its project memory only in that project's `.verion/` directory. It chooses the first available local port from `5173` through `5192`, then looks for a running local app automatically. It prioritizes ports declared in the project's own scripts before trying common development ports. You can use an advanced override only when automatic detection cannot find the app:

```bash
verion --url http://127.0.0.1:3000
verion --port 5300
```

Use `verion --help` to see the advanced discovery, capsule, and direct-verification commands. When this package is published to a registry, install it with `npm install -g verion` instead.

### Local data and BYOM

Project understanding, review history, teammate conversation, and repair records stay in the target project's Git-ignored `.verion/` directory. API keys never go there: use **AI setup** in the dashboard to select a provider/model and either reference an existing environment variable or, after an explicit confirmation, add it to the project `.env`. Verion works without a provider; OpenAI-compatible, Gemini, OpenRouter, and local Ollama reasoning are optional.

For the exact data locations, reset/forget behavior, provider boundary, and BYOM variables, see [Local data, reset, and BYOM](docs/product/LOCAL_DATA_AND_BYOM.md). Browser review needs Playwright's Chromium runtime once:

```bash
npx playwright install chromium
```

## Develop Verion locally

```bash
npm install
npx playwright install chromium
cp .env.example .env
npm run dev
```

For packaged use, run `verion` from the root of the application you want to verify. The launch directory is the approved project scope; the dashboard never asks you to paste a filesystem path. Verion automatically looks for a conventional localhost development server. If it cannot find one, use the advanced fallback: `verion --url http://127.0.0.1:3000`.

When developing Verion itself, `npm run dev` starts the agent against the current directory and opens the local project briefing. Verion works without a model: deterministic project understanding and verification remain available. To add model reasoning, open **AI setup** in the dashboard and choose OpenAI-compatible, Gemini, OpenRouter, or local Ollama. The existing `OPENAI_API_KEY` and optional `VERION_OPENAI_MODEL` setup still works as an OpenAI-compatible Responses configuration, but Verion never silently chooses a model for it. See [`.env.example`](./.env.example) for headless/CI variables. Project understanding sends only a bounded outline of framework, dependency names, route names, filenames, and local inferences; source files, secrets, browser material, credentials, and raw local memory stay out of that request. Release reasoning receives only the Context Capsule.

### Deep Security Review

Deep Security Review is a built-in local capability, not a separate service to configure. Open **Security** and press **Start Deep Security Review** when a release needs that deliberate check; ordinary **Verify this change** never starts it in the background. It reviews bounded local code and configuration, checks a detected loopback app when one is running, and on npm projects with `package-lock.json` checks the production dependency graph for known vulnerabilities. Its findings contribute to the same release decision as Verify. It never needs a MongoDB instance, GitHub token, repository ID, or a scanner account.

To inspect deterministic discovery without AI release reasoning:

```bash
npm run discover -- --project /absolute/path/to/project
```

## Documentation

- [Documentation guide](docs/README.md)
- [Hackathon operating guide](HACKATHON.md)
- [Current execution](EXECUTION.md)
- [Shipping sprint](SPRINT.md)
