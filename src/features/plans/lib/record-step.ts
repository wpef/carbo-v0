import type { PlanStepValue } from './steps'

/**
 * Record forward progress to `targetStep` so the plan's `currentStep` tracks the guided
 * journey. The integrity service only marks a plan READY once currentStep reaches DOCUMENTS,
 * so the "Continue" buttons at step boundaries call this before navigating.
 *
 * Server-side advanceStep is forward-only and returns 422 when the plan is already at/past
 * the target step (e.g. the user revisits an earlier step). That is benign here, so any
 * failure is swallowed and the caller navigates regardless.
 */
export async function recordStep(planId: string, targetStep: PlanStepValue): Promise<void> {
  try {
    await fetch(`/api/plans/${planId}/step`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetStep }),
    })
  } catch {
    /* network error — navigation proceeds regardless */
  }
}
