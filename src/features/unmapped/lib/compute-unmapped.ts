// 016-unmapped-fields-detection — Pure computation of the unmapped fields report.
// No DB access, no React, no network calls.

import type { ConnectorField } from '@/lib/types/connector'

// ---------------------------------------------------------------------------
// Public interfaces (spec data-model.md § Computed State: Unmapped Fields Report)
// ---------------------------------------------------------------------------

export interface FieldInfo {
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
}

export interface FieldExclusionInfo {
  id: string
  sourceFieldName: string
  reason: string | null
  createdAt: string
}

export interface UnmappedFieldsReport {
  // Source side
  unmappedSourceFields: FieldInfo[]            // allSourceFields - mappedSourceFields - excludedSourceFields
  excludedSourceFields: FieldExclusionInfo[]   // FieldExclusion records (pass-through from input)
  sourceCoverage: number                       // (mapped + excluded) / total * 100, rounded

  // Destination side
  unmappedRequiredDestFields: FieldInfo[]      // requiredDestFields - mappedDestFields
  destinationRequiredCoverage: number          // mappedRequiredDest / totalRequiredDest * 100, rounded

  // Summary counters
  totalSourceFields: number
  mappedSourceFields: number
  totalRequiredDestFields: number
  mappedRequiredDestFields: number
  fieldsRemainingToValidate: number            // unmappedSource.length + unmappedRequiredDest.length
  isComplete: boolean                          // sourceCoverage === 100 && destinationRequiredCoverage === 100
}

// ---------------------------------------------------------------------------
// Input shape for exclusions (minimal, avoids Prisma import)
// ---------------------------------------------------------------------------

export interface FieldExclusionInput {
  id: string
  sourceFieldName: string
  reason: string | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// computeUnmappedFields
// ---------------------------------------------------------------------------

/**
 * Compute the unmapped-fields report for a single object mapping.
 *
 * @param sourceFields  - All connector fields for the source object.
 * @param destFields    - All connector fields for the destination object.
 * @param fieldMappings - Existing field mappings (sourceFieldName → destinationFieldName).
 * @param exclusions    - Fields intentionally excluded from the source (with optional reason).
 *
 * Precedence rules (spec § Computation Logic):
 *   - A source field is "handled" when it appears in fieldMappings OR in exclusions.
 *   - sourceCoverage = (mappedSource + excluded) / totalSource * 100
 *   - Only *required* destination fields count toward destinationRequiredCoverage.
 *   - isComplete iff both coverages reach 100 (before rounding — matches spec).
 */
export function computeUnmappedFields(
  sourceFields: ConnectorField[],
  destFields: ConnectorField[],
  fieldMappings: { sourceFieldName: string; destinationFieldName: string }[],
  exclusions: FieldExclusionInput[],
): UnmappedFieldsReport {
  const mappedSourceNames = new Set(fieldMappings.map((fm) => fm.sourceFieldName))
  const mappedDestNames = new Set(fieldMappings.map((fm) => fm.destinationFieldName))
  const excludedSourceNames = new Set(exclusions.map((e) => e.sourceFieldName))

  // --- Source side ---
  const unmappedSourceFields: FieldInfo[] = sourceFields
    .filter((f) => !mappedSourceNames.has(f.apiName) && !excludedSourceNames.has(f.apiName))
    .map(toFieldInfo)

  const mappedSourceCount = sourceFields.filter((f) => mappedSourceNames.has(f.apiName)).length
  const excludedCount = sourceFields.filter((f) => excludedSourceNames.has(f.apiName)).length

  const sourceCoverageRaw = sourceFields.length > 0
    ? ((mappedSourceCount + excludedCount) / sourceFields.length) * 100
    : 100

  // --- Destination side (required fields only) ---
  const requiredDestFields = destFields.filter((f) => f.isRequired)
  const unmappedRequiredDestFields: FieldInfo[] = requiredDestFields
    .filter((f) => !mappedDestNames.has(f.apiName))
    .map(toFieldInfo)

  const mappedRequiredDestCount = requiredDestFields.filter((f) => mappedDestNames.has(f.apiName)).length

  const destRequiredCoverageRaw = requiredDestFields.length > 0
    ? (mappedRequiredDestCount / requiredDestFields.length) * 100
    : 100

  // isComplete is evaluated on raw (un-rounded) values to avoid 99.9 → 100 artefacts.
  const isComplete = sourceCoverageRaw === 100 && destRequiredCoverageRaw === 100

  // Pass exclusions through as FieldExclusionInfo (shape is already compatible).
  const excludedSourceFields: FieldExclusionInfo[] = exclusions.map((e) => ({
    id: e.id,
    sourceFieldName: e.sourceFieldName,
    reason: e.reason,
    createdAt: e.createdAt,
  }))

  return {
    unmappedSourceFields,
    excludedSourceFields,
    sourceCoverage: Math.round(sourceCoverageRaw),
    unmappedRequiredDestFields,
    destinationRequiredCoverage: Math.round(destRequiredCoverageRaw),
    totalSourceFields: sourceFields.length,
    mappedSourceFields: mappedSourceCount,
    totalRequiredDestFields: requiredDestFields.length,
    mappedRequiredDestFields: mappedRequiredDestCount,
    fieldsRemainingToValidate: unmappedSourceFields.length + unmappedRequiredDestFields.length,
    isComplete,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toFieldInfo(f: ConnectorField): FieldInfo {
  return {
    apiName: f.apiName,
    label: f.label,
    dataType: f.dataType,
    isRequired: f.isRequired,
  }
}
