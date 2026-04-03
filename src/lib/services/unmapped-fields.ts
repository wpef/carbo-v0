// 016-unmapped-fields-detection — Service for detecting unmapped fields across a plan

import { prisma } from '@/lib/db/prisma'
import type {
  UnmappedFieldsReport,
  ObjectMappingUnmappedReport,
  UnmappedFieldInfo,
} from '@/lib/types/unmapped-fields'

/**
 * Detect unmapped fields for all object mappings within a plan.
 *
 * For each object mapping:
 *   - Unmapped source fields: source fields that have no FieldMapping.
 *   - Unmapped dest fields: required dest fields that have no FieldMapping targeting them.
 *     (Principle III: required source fields unmapped must be flagged as warnings.)
 *
 * Pure computation — no side effects.
 */
export async function detectUnmappedFields(planId: string): Promise<UnmappedFieldsReport> {
  // Load all object mappings for the plan
  const objectMappings = await prisma.objectMapping.findMany({
    where: { planId },
    orderBy: { createdAt: 'asc' },
  })

  if (objectMappings.length === 0) {
    return {
      objectMappings: [],
      summary: { totalUnmappedSource: 0, totalUnmappedDest: 0, totalRequiredUnmapped: 0 },
    }
  }

  const objectMappingIds = objectMappings.map((om) => om.id)
  const sourceObjectIds = objectMappings.map((om) => om.sourceObjectId)
  const destObjectIds = objectMappings.map((om) => om.destObjectId)

  // Batch-load all fields + all field mappings for these object mappings
  const [allSourceFields, allDestFields, allFieldMappings] = await Promise.all([
    prisma.objectField.findMany({ where: { objectId: { in: sourceObjectIds } } }),
    prisma.objectField.findMany({ where: { objectId: { in: destObjectIds } } }),
    prisma.fieldMapping.findMany({ where: { objectMappingId: { in: objectMappingIds } } }),
  ])

  // Index by objectId
  const sourceFieldsByObjectId = new Map<string, typeof allSourceFields>()
  for (const f of allSourceFields) {
    const arr = sourceFieldsByObjectId.get(f.objectId) ?? []
    arr.push(f)
    sourceFieldsByObjectId.set(f.objectId, arr)
  }

  const destFieldsByObjectId = new Map<string, typeof allDestFields>()
  for (const f of allDestFields) {
    const arr = destFieldsByObjectId.get(f.objectId) ?? []
    arr.push(f)
    destFieldsByObjectId.set(f.objectId, arr)
  }

  // Index field mappings by objectMappingId
  const fieldMappingsByObjectMappingId = new Map<string, typeof allFieldMappings>()
  for (const fm of allFieldMappings) {
    const arr = fieldMappingsByObjectMappingId.get(fm.objectMappingId) ?? []
    arr.push(fm)
    fieldMappingsByObjectMappingId.set(fm.objectMappingId, arr)
  }

  let totalUnmappedSource = 0
  let totalUnmappedDest = 0
  let totalRequiredUnmapped = 0

  const reportedObjectMappings: ObjectMappingUnmappedReport[] = objectMappings.map((om) => {
    const sourceFields = sourceFieldsByObjectId.get(om.sourceObjectId) ?? []
    const destFields = destFieldsByObjectId.get(om.destObjectId) ?? []
    const fieldMappings = fieldMappingsByObjectMappingId.get(om.id) ?? []

    const mappedSourceApiNames = new Set(fieldMappings.map((fm) => fm.sourceFieldApiName))
    const mappedDestApiNames = new Set(fieldMappings.map((fm) => fm.destFieldApiName))

    // Unmapped source fields: any source field not in a mapping
    const unmappedSourceFields: UnmappedFieldInfo[] = sourceFields
      .filter((f) => !mappedSourceApiNames.has(f.apiName))
      .map((f) => ({
        apiName: f.apiName,
        label: f.label,
        dataType: f.dataType,
        isRequired: f.isRequired,
      }))

    // Unmapped dest fields: only required dest fields that are not mapped to
    // (Principle III: required fields must be explicitly handled or flagged)
    const unmappedDestFields: UnmappedFieldInfo[] = destFields
      .filter((f) => f.isRequired && !mappedDestApiNames.has(f.apiName))
      .map((f) => ({
        apiName: f.apiName,
        label: f.label,
        dataType: f.dataType,
        isRequired: f.isRequired,
      }))

    const requiredUnmapped = unmappedSourceFields.filter((f) => f.isRequired).length

    totalUnmappedSource += unmappedSourceFields.length
    totalUnmappedDest += unmappedDestFields.length
    totalRequiredUnmapped += requiredUnmapped

    return {
      objectMappingId: om.id,
      sourceObjectApiName: om.sourceObjectApiName,
      destObjectApiName: om.destObjectApiName,
      unmappedSourceFields,
      unmappedDestFields,
      totalSourceFields: sourceFields.length,
      totalDestFields: destFields.length,
      mappedCount: fieldMappings.length,
    }
  })

  return {
    objectMappings: reportedObjectMappings,
    summary: { totalUnmappedSource, totalUnmappedDest, totalRequiredUnmapped },
  }
}
