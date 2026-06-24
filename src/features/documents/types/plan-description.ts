// 018-rule-description-engine — Public-facing types for plan description aggregation (v4)
//
// Ported from v3 src/lib/types/rule-description.ts, adapted to v4 models:
//   - typeCompatibility carries the FieldMapping.compatibilityStatus enum value
//     (COMPATIBLE | WARNING | INCOMPATIBLE).

/**
 * Human-readable description of a single field mapping (migration logic + filters).
 */
export interface RuleDescription {
  fieldMappingId: string
  sourceField: string
  destField: string
  /** Human-readable description of the migration logic */
  migrationDescription: string
  /** Human-readable descriptions of active filters that touch this field */
  filterDescriptions: string[]
  /** Mirrors FieldMapping.compatibilityStatus — COMPATIBLE | WARNING | INCOMPATIBLE */
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
  /** One-line summary of active filters on this object mapping */
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
