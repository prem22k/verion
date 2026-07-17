# Local Project Memory

Every project Verion learns owns a local `.verion/project-memory.json` file. It is a project record, not a hosted profile and not a cache shared across projects.

When a completed Needs Attention review has enough current supporting context, Verion may also create a private `.verion/fix-packets/` Markdown brief for an interactive Codex session. Packets are owner-only, are not dashboard content, and are not part of the learning record or a hosted service.

## What It Keeps

- **Project profile**: project name, local root, framework, package manager, first/last learning times, and last verification time.
- **Known technologies and routes**: the verified technology list and current route inventory.
- **Known user journeys**: routes inferred from the project plus pages actually observed during browser review.
- **Learned application understanding**: a concise product summary plus the supported application type, authentication, payments, database, framework, user journeys, critical flows, important pages, and important APIs. These are stored as plain-language labels, never copied source or parser output.
- **Recent changes**: bounded added, modified, and removed project-file paths between learning passes. It stores metadata only, never source contents.
- **Verification history**: a bounded record of when a review completed, what initiated it, its outcome, and evidence counts.
- **Previous release reports**: bounded Staff Engineer-style release decisions: one recommendation, confidence label, likely root cause, no more than three reasons, and one next action. Older saved reports are normalized locally into this shape before Mission Control reads them.
- **Known issues**: recurring needs-attention reports, their first/last observation, occurrence count, and open/resolved status.

The internal project map remains part of the same local file because it is needed to refresh understanding after source changes.

## Learning Lifecycle

1. `verion` learns the project and writes the first local record.
2. An unchanged project reuses that record immediately.
3. A changed project refreshes its structure, understanding, routes, technologies, product briefing, and recent-change journal.
4. Every completed verification adds local history, release outcome, observed journey details, and issue state.

Histories are intentionally capped (30 verification/report/change records and 50 issues) so local memory remains useful rather than becoming an unbounded archive.

## Privacy Boundary

`.verion/` is Git-ignored, excluded from project discovery and change watching, and written with owner-only file permissions. Verion never uploads the memory file or includes it in a GPT request. The loopback dashboard receives only a curated local Mission Control briefing: plain-language product understanding, grouped change summaries, up to three provisional likely-impact labels, journey labels, release state, a bounded release-confidence brief, current review step, and up to six temporary human-readable observations while a running product is being checked. Likely impact is recomputed server-side from the latest local change record and learned product labels; it is not a stored verdict. These observation briefs are not stored in project memory. The dashboard never receives raw source code, screenshots, packet contents or paths, file paths, changed-file counts, matching rules, evidence identifiers, browser-session data, credentials, or the memory file itself.
