# Local Project Memory

Every project Verion learns owns a local `.verion/project-memory.json` file. It is a project record, not a hosted profile and not a cache shared across projects.

## What It Keeps

- **Project profile**: project name, local root, framework, package manager, first/last learning times, and last verification time.
- **Known technologies and routes**: the verified technology list and current route inventory.
- **Known user journeys**: routes inferred from the project plus pages actually observed during browser review.
- **Learned application understanding**: the concise product summary and identified product areas.
- **Recent changes**: bounded added, modified, and removed project-file paths between learning passes. It stores metadata only, never source contents.
- **Verification history**: a bounded record of when a review completed, what initiated it, its outcome, and evidence counts.
- **Previous release reports**: the bounded structured release decisions Verion returned.
- **Known issues**: recurring needs-attention reports, their first/last observation, occurrence count, and open/resolved status.

The internal project map remains part of the same local file because it is needed to refresh understanding after source changes.

## Learning Lifecycle

1. `verion` learns the project and writes the first local record.
2. An unchanged project reuses that record immediately.
3. A changed project refreshes its structure, understanding, routes, technologies, and recent-change journal.
4. Every completed verification adds local history, release outcome, observed journey details, and issue state.

Histories are intentionally capped (30 verification/report/change records and 50 issues) so local memory remains useful rather than becoming an unbounded archive.

## Privacy Boundary

`.verion/` is Git-ignored, excluded from project discovery and change watching, and written with owner-only file permissions. Verion never uploads the memory file, exposes it through a dashboard endpoint, or includes it in a GPT request. The file contains no copied source code, screenshots, browser-session data, or credentials.
