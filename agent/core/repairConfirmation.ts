/** Exact local-process confirmation required before Verion creates a review brief or opens Codex. */
export const repairLaunchConfirmation = 'Launch Codex with this review brief'

export function hasConfirmedRepairLaunch(body: Record<string, unknown>): boolean {
  return Object.keys(body).length === 2 && typeof body.reportId === 'string' && body.reportId.trim().length > 0 && body.confirmation === repairLaunchConfirmation
}
