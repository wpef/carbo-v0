import type { PlanStepValue } from './lib/steps'

export interface PlanListItem {
  id: string
  name: string
  description: string | null
  status: string
  currentStep: PlanStepValue
  createdAt: string
  updatedAt: string
}

export interface PlanDetail extends PlanListItem {
  sourceConnectionId: string | null
  destinationConnectionId: string | null
}
