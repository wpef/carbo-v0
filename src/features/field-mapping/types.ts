// 012-field-mapping — Shared TypeScript types for field mapping (v4)

import type { LinkStatus } from './lib/link-status'
import type { CompatibilityStatus } from './lib/type-compatibility'

export type { LinkStatus, CompatibilityStatus }

// ─── DTO returned by listFieldMappings / createFieldMapping ──────────────────

export interface FieldMappingDTO {
  id: string
  objectMappingId: string
  // Source field
  sourceFieldName: string
  sourceFieldLabel: string
  sourceFieldType: string
  // Destination field
  destinationFieldName: string
  destFieldLabel: string
  destFieldType: string
  // Status
  compatibilityStatus: 'COMPATIBLE' | 'WARNING' | 'INCOMPATIBLE'
  linkStatus: LinkStatus
  statusDetail?: string
  // Related logic
  migrationLogic: {
    id: string
    status: string
    sectionType: string
    valueEquivalences: { sourceValue: string; destinationValue: string }[]
  } | null
  autoCreated: boolean
}

// ─── Input for createFieldMapping ─────────────────────────────────────────────

export interface CreateFieldMappingInput {
  sourceFieldName: string
  destinationFieldName: string
  sourceFieldType?: string
  destFieldType?: string
}

// ─── Fields returned by getUnmappedSourceFields ───────────────────────────────

export interface UnmappedSourceField {
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
  isReadOnly: boolean
}

// ─── Fields returned by getAvailableDestFields ────────────────────────────────

export interface AvailableDestField {
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
  isReadOnly: boolean
}
