# Demo Runbook

Use this runbook to rehearse the single Phase 1 verification loop. Keep the intentional defect in place until the Codex repair segment.

## Start

```bash
npm run dev:verion
```

Open `http://127.0.0.1:5173`.

## First Verification

1. Open the companion application at `/demo-target`.
2. Select **Marketing launch** and create the workspace. The visible confirmation says **Blank workspace**.
3. Return to Verion and select **Verify application**.
4. Show the grouped **Needs Attention** diagnosis, the screenshot, and the relevant source location.
5. Select **Prepare fix brief**, then copy the brief into Codex.

## Codex Repair Prompt

Use Verion's copied brief. The expected narrow correction is in `src/DemoTargetApp.tsx`:

```ts
setCreatedTemplate(selectedTemplate)
```

This replaces the defective hard-coded default value in `createWorkspace`.

## Verification Again

1. After Codex applies the correction, return to Verion.
2. Select **Verify again**.
3. The local agent selects **Marketing launch**, creates the workspace, and confirms that the created workspace reports **Marketing launch**.
4. Show the resulting **Ready to Ship** state.

## Reset for Another Rehearsal

Restore the intentional defect in `createWorkspace`:

```ts
setCreatedTemplate('blank')
```

Never leave the defect in a version intended to demonstrate the successful rerun.
