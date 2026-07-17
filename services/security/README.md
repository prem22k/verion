# Verion Security Engine

This workspace is an internal Verion capability. It performs deeper local security review when an authorized repository is configured; it is not a separate product, dashboard, or user workflow.

## How it runs

The root workspace installs this package with the rest of Verion:

```bash
npm install
```

When Deep Security Review is enabled in Verion’s root `.env`, `verion` starts this local engine automatically. It listens only on loopback and its raw job data never reaches the dashboard. Verion converts only eligible critical concerns into the existing release decision.

## Local configuration

Copy `.env.example` to `.env` in this directory only when running an authorized repository review. Its database and GitHub credentials stay local and must never be committed or placed in Verion’s root `.env`.

```bash
cp services/security/.env.example services/security/.env
```

The engine needs local MongoDB plus authorized GitHub credentials to complete a repository review. Without them, Verion reports the security part of a requested review as inconclusive rather than claiming the project is clean.

## Development

Use `npm run dev:security` only when developing this internal workspace directly. Normal Verion use does not require a second terminal or repository.
