export const PLAN_STEPS = ['SOURCE', 'DESTINATION', 'OBJECT_MAPPING', 'FIELD_MAPPING', 'DOCUMENTS'] as const
export type PlanStepValue = (typeof PLAN_STEPS)[number]

export const STEP_LABELS: Record<PlanStepValue, string> = {
  SOURCE: 'Source',
  DESTINATION: 'Destination',
  OBJECT_MAPPING: 'Objets',
  FIELD_MAPPING: 'Champs',
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

/** Maps legacy DB step values to current PlanStepValue. */
const LEGACY_STEP_MAP: Record<string, PlanStepValue> = {
  SOURCE_CONNECTION: 'SOURCE',
  OBJECT_SELECTION: 'SOURCE',
  DESTINATION_CONNECTION: 'DESTINATION',
  MAPPING: 'OBJECT_MAPPING',
  RUN: 'DOCUMENTS',
}

export function normalizeStep(raw: string): PlanStepValue {
  return (LEGACY_STEP_MAP[raw] ?? raw) as PlanStepValue
}
