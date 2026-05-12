// 012-field-mapping — TypeScript types for field mapping

export type TypeCompatibility = 'COMPATIBLE' | 'WARNING' | 'INCOMPATIBLE'

// 017 — BROKEN added 2026-05-12: source or destination field no longer exists in current snapshot
// (Constitution Principle IX — broken mappings are marked, never auto-resolved)
export type LinkStatus = 'GREEN' | 'GREEN_PARTIAL' | 'RED_SOLID' | 'RED_DASHED' | 'BROKEN'

export interface FieldMappingDTO {
  id: string
  objectMappingId: string
  sourceFieldId: string
  sourceFieldApiName: string
  sourceFieldLabel: string
  sourceFieldType: string
  destFieldId: string
  destFieldApiName: string
  destFieldLabel: string
  destFieldType: string
  typeCompatibility: TypeCompatibility
  linkStatus: LinkStatus
  /** Human-readable detail for partial status (e.g. "2 valeurs source non liées") */
  statusDetail?: string
  createdAt: string
  updatedAt: string
}

export interface CreateFieldMappingInput {
  sourceFieldId: string
  sourceFieldApiName: string
  destFieldId: string
  destFieldApiName: string
}

export interface UnmappedSourceField {
  id: string
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
  isReadOnly: boolean
}

export interface AvailableDestField {
  id: string
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
  isReadOnly: boolean
}

export interface FieldAutoMatchResult {
  created: number
  skipped: number
  pairs: Array<{
    sourceFieldApiName: string
    destFieldApiName: string
    status: 'created' | 'skipped'
  }>
}

export enum FieldLinkState {
  IDLE = 'IDLE',
  SOURCE_SELECTED = 'SOURCE_SELECTED',
}
