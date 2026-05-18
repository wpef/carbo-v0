export const PLAN_STEPS = ['SOURCE', 'DESTINATION', 'OBJECT_MAPPING', 'FIELD_MAPPING', 'DOCUMENTS'] as const
export type PlanStepValue = (typeof PLAN_STEPS)[number]

export const STEP_LABELS: Record<PlanStepValue, string> = {
  SOURCE: 'Source Connection',
  DESTINATION: 'Destination Connection',
  OBJECT_MAPPING: 'Object Mapping',
  FIELD_MAPPING: 'Field Mapping',
  DOCUMENTS: 'Documents',
}

export const STEP_PATHS: Record<PlanStepValue, string> = {
  SOURCE: 'source',
  DESTINATION: 'destination',
  OBJECT_MAPPING: 'object-mapping',
  FIELD_MAPPING: 'field-mapping',
  DOCUMENTS: 'documents',
}

export function getStepIndex(step: PlanStepValue): number {
  return PLAN_STEPS.indexOf(step)
}

export function isForwardStep(current: PlanStepValue, target: PlanStepValue): boolean {
  return getStepIndex(target) > getStepIndex(current)
}

export function getNextStep(current: PlanStepValue): PlanStepValue | null {
  const idx = getStepIndex(current)
  return idx < PLAN_STEPS.length - 1 ? PLAN_STEPS[idx + 1] : null
}
