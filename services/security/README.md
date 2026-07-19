# Archived repository-service experiment

This directory contains an earlier prototype that queued GitHub repositories through MongoDB. It is **not part of Verion's package, startup path, dashboard, or Deep Security Review**.

Verion now reviews the local project directory from which the developer ran `verion`. The supported product path needs no database, GitHub token, repository ID, second terminal, or separate security service. The active implementation lives in `agent/evidence/localDeepSecurityReviewProducer.ts` and starts only when the developer presses **Start Deep Security Review**.

Keep this code only as historical reference while it is being retired. Do not configure or run it for normal Verion use.
