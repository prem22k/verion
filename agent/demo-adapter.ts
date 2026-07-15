import type { VerificationRun } from '../src/verification'

export const initialVerificationRun: VerificationRun = {
  id: 'run-001',
  targetLabel: 'Demo application',
  recommendation: 'needs_attention',
  exploredAt: 'Just now',
  steps: [
    { id: 'open-home', action: 'Opened the product home', outcome: 'passed' },
    { id: 'start-flow', action: 'Started the primary user flow', outcome: 'passed' },
    { id: 'confirm-flow', action: 'Confirmed the final action', outcome: 'failed' }
  ],
  issue: {
    title: 'The primary flow fails at confirmation',
    userImpact: 'A user can complete the form but cannot finish the action they came to perform.',
    likelyRootCause: 'The confirmation action is not preserving the selected state before submitting.',
    expectedBehavior: 'The user can confirm their selection and receive a completed state.',
    observedBehavior: 'The final action returns the user to the form without completing the flow.',
    relevantFiles: ['src/DemoTargetApp.tsx — createWorkspace'],
    evidence: [
      {
        id: 'step-failure',
        kind: 'screenshot',
        label: 'Confirmation state',
        detail: 'The selected state disappears immediately after the final action.',
        artifactPath: '/artifacts/workspace-template-mismatch.png'
      },
      {
        id: 'console-failure',
        kind: 'console_error',
        label: 'Browser evidence',
        detail: 'The submitted state is undefined when the confirmation handler runs.'
      }
    ]
  }
}
