export type PlanStatus = 'DRAFT' | 'READY' | 'BROKEN'

export type PlanStep =
  | 'SOURCE'
  | 'DESTINATION'
  | 'MAPPING'
  | 'FIELD_MAPPING'
  | 'DOCUMENTS'

export const PLAN_STEPS = [
  { id: 'SOURCE' as const, label: 'Source', order: 1 },
  { id: 'DESTINATION' as const, label: 'Destination', order: 2 },
  { id: 'MAPPING' as const, label: 'Object Mapping', order: 3 },
  { id: 'FIELD_MAPPING' as const, label: 'Field Mapping', order: 4 },
  { id: 'DOCUMENTS' as const, label: 'Documents', order: 5 },
] as const

/** Map legacy step values to current step names */
const LEGACY_STEP_MAP: Record<string, PlanStep> = {
  SOURCE_CONNECTION: 'SOURCE',
  OBJECT_SELECTION: 'SOURCE',
  DESTINATION_CONNECTION: 'DESTINATION',
  RUN: 'DOCUMENTS',
}

export function normalizeStep(step: string): PlanStep {
  return LEGACY_STEP_MAP[step] ?? (step as PlanStep)
}

export interface CreatePlanInput {
  name: string
  description?: string
}
