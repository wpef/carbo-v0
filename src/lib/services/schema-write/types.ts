// 022-schema-write — Types for schema write service

import type { ConnectorObject, ConnectorField } from '@/lib/connectors/types'

// --- Input Types ---

export interface CreateObjectInput {
  apiName: string
  label: string
}

export interface CreateFieldInput {
  objectApiName: string
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
}

// --- Result Types ---

export interface SchemaWriteResult<T = ConnectorObject | ConnectorField> {
  success: boolean
  data?: T
  error?: string
}

export interface SchemaWriteCapability {
  canWriteSchema: boolean
  adapterType: string
}
