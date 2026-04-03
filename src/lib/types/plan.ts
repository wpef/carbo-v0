export type PlanStatus = 'DRAFT' | 'READY' | 'BROKEN'

export type PlanStep =
  | 'SOURCE_CONNECTION'
  | 'OBJECT_SELECTION'
  | 'DESTINATION_CONNECTION'
  | 'MAPPING'
  | 'DOCUMENTS'
  | 'RUN'

export const PLAN_STEPS = [
  { id: 'SOURCE_CONNECTION' as const, label: 'Source Connection', order: 1 },
  { id: 'OBJECT_SELECTION' as const, label: 'Object Selection', order: 2 },
  { id: 'DESTINATION_CONNECTION' as const, label: 'Destination Connection', order: 3 },
  { id: 'MAPPING' as const, label: 'Object & Field Mapping', order: 4 },
  { id: 'DOCUMENTS' as const, label: 'Documents', order: 5 },
  { id: 'RUN' as const, label: 'Run Migration', order: 6 },
] as const

export interface CreatePlanInput {
  name: string
  description?: string
}
