// 017-mapping-integrity-check — TypeScript types for mapping integrity check

export interface BrokenObjectMapping {
  mappingId: string
  sourceObjectApiName: string
  destObjectApiName: string
  reason: string
}

export interface BrokenFieldMapping {
  mappingId: string
  fieldMappingId: string
  reason: string
}

export interface TypeChange {
  fieldMappingId: string
  field: string
  oldType: string
  newType: string
}

export interface IntegrityReport {
  brokenObjectMappings: BrokenObjectMapping[]
  brokenFieldMappings: BrokenFieldMapping[]
  typeChanges: TypeChange[]
  isHealthy: boolean
  checkedAt: string
}

export interface RepairResult {
  deletedObjectMappings: number
  deletedFieldMappings: number
  planStatus: string
}
