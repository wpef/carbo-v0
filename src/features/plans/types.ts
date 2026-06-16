import type { PlanStepValue } from './lib/steps'

export interface PlanListItem {
  id: string
  name: string
  description: string | null
  status: 'DRAFT' | 'READY' | 'BROKEN'
  currentStep: PlanStepValue
  createdAt: string
  updatedAt: string
}

export interface ConnectionInfo {
  id: string
  adapterType: string
  status: 'CONNECTED' | 'EXPIRED' | 'ERROR'
}

export interface PlanDetail extends PlanListItem {
  sourceConnectionId: string | null
  destinationConnectionId: string | null
  objectAutoLinkedAt: string | null
  sourceConnection: ConnectionInfo | null
  destinationConnection: ConnectionInfo | null
}
