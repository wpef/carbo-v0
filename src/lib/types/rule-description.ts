// 018-rule-description-engine — Public-facing types for plan description aggregation

/**
 * Human-readable description of a single field mapping (migration logic + filters).
 */
export interface RuleDescription {
  fieldMappingId: string
  sourceField: string
  destField: string
  /** Human-readable description of the migration logic */
  migrationDescription: string
  /** Human-readable descriptions of active filters */
  filterDescriptions: string[]
  typeCompatibility: string
}

/**
 * Human-readable description of one object mapping (all its field descriptions + filters).
 */
export interface ObjectMappingDescription {
  objectMappingId: string
  sourceObject: string
  destObject: string
  fieldDescriptions: RuleDescription[]
  filterSummary: string
  unmappedSourceCount: number
  unmappedDestCount: number
}

/**
 * Complete plan description: all object mappings aggregated.
 */
export interface PlanDescription {
  planId: string
  planName: string
  objectMappings: ObjectMappingDescription[]
  generatedAt: string
}
