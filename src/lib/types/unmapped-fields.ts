// 016-unmapped-fields-detection — TypeScript types for unmapped fields detection

export interface UnmappedFieldInfo {
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
}

export interface ObjectMappingUnmappedReport {
  objectMappingId: string
  sourceObjectApiName: string
  destObjectApiName: string
  unmappedSourceFields: UnmappedFieldInfo[]
  unmappedDestFields: UnmappedFieldInfo[]
  totalSourceFields: number
  totalDestFields: number
  mappedCount: number
}

export interface UnmappedFieldsSummary {
  totalUnmappedSource: number
  totalUnmappedDest: number
  totalRequiredUnmapped: number
}

export interface UnmappedFieldsReport {
  objectMappings: ObjectMappingUnmappedReport[]
  summary: UnmappedFieldsSummary
}
