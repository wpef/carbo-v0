// 012-field-mapping — TypeScript types for field mapping

export type TypeCompatibility = 'COMPATIBLE' | 'WARNING' | 'INCOMPATIBLE'

export type LinkStatus = 'GREEN' | 'ORANGE' | 'RED_SOLID' | 'RED_DASHED'

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
