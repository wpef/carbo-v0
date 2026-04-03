// 012-field-mapping — Field mapping service

import { prisma } from '@/lib/db/prisma'
import { logAction } from './audit-service'
import { checkTypeCompatibility } from './type-compatibility'
import { getFieldAutoMatchPairs } from './field-auto-match-registry'
import type {
  FieldMappingDTO,
  CreateFieldMappingInput,
  TypeCompatibility,
  LinkStatus,
  UnmappedSourceField,
  AvailableDestField,
  FieldAutoMatchResult,
} from '@/lib/types/field-mapping'

// --- Errors ---

export class FieldMappingNotFoundError extends Error {
  constructor(mappingId: string) {
    super(`FieldMapping not found: ${mappingId}`)
    this.name = 'FieldMappingNotFoundError'
  }
}

export class DuplicateFieldMappingError extends Error {
  constructor(sourceFieldApiName: string) {
    super(`A field mapping already exists for source field: ${sourceFieldApiName}`)
    this.name = 'DuplicateFieldMappingError'
  }
}

export class ObjectMappingNotFoundError extends Error {
  constructor(mappingId: string) {
    super(`ObjectMapping not found: ${mappingId}`)
    this.name = 'ObjectMappingNotFoundError'
  }
}

// --- Helpers ---

/**
 * Derives LinkStatus from TypeCompatibility.
 * GREEN = COMPATIBLE, ORANGE = WARNING, RED_SOLID = INCOMPATIBLE.
 * RED_DASHED is reserved for future use (e.g., broken migration logic).
 */
export function getLinkStatus(typeCompatibility: TypeCompatibility): LinkStatus {
  switch (typeCompatibility) {
    case 'COMPATIBLE':
      return 'GREEN'
    case 'WARNING':
      return 'ORANGE'
    case 'INCOMPATIBLE':
      return 'RED_SOLID'
    default:
      return 'GREEN'
  }
}

function toDTO(
  mapping: {
    id: string
    objectMappingId: string
    sourceFieldId: string
    sourceFieldApiName: string
    destFieldId: string
    destFieldApiName: string
    typeCompatibility: string
    createdAt: Date
    updatedAt: Date
  },
  sourceField: { label: string; dataType: string } | null,
  destField: { label: string; dataType: string } | null,
): FieldMappingDTO {
  const compatibility = mapping.typeCompatibility as TypeCompatibility
  return {
    id: mapping.id,
    objectMappingId: mapping.objectMappingId,
    sourceFieldId: mapping.sourceFieldId,
    sourceFieldApiName: mapping.sourceFieldApiName,
    sourceFieldLabel: sourceField?.label ?? mapping.sourceFieldApiName,
    sourceFieldType: sourceField?.dataType ?? 'unknown',
    destFieldId: mapping.destFieldId,
    destFieldApiName: mapping.destFieldApiName,
    destFieldLabel: destField?.label ?? mapping.destFieldApiName,
    destFieldType: destField?.dataType ?? 'unknown',
    typeCompatibility: compatibility,
    linkStatus: getLinkStatus(compatibility),
    createdAt: mapping.createdAt.toISOString(),
    updatedAt: mapping.updatedAt.toISOString(),
  }
}

// --- Service functions ---

/**
 * List all field mappings for an object mapping, enriched with field labels and types.
 */
export async function listFieldMappings(objectMappingId: string): Promise<FieldMappingDTO[]> {
  const mappings = await prisma.fieldMapping.findMany({
    where: { objectMappingId },
    orderBy: { createdAt: 'asc' },
  })

  if (mappings.length === 0) return []

  const sourceFieldIds = mappings.map((m) => m.sourceFieldId)
  const destFieldIds = mappings.map((m) => m.destFieldId)

  const [sourceFields, destFields] = await Promise.all([
    prisma.objectField.findMany({ where: { id: { in: sourceFieldIds } } }),
    prisma.objectField.findMany({ where: { id: { in: destFieldIds } } }),
  ])

  const sourceById = new Map(sourceFields.map((f) => [f.id, f]))
  const destById = new Map(destFields.map((f) => [f.id, f]))

  return mappings.map((m) => toDTO(m, sourceById.get(m.sourceFieldId) ?? null, destById.get(m.destFieldId) ?? null))
}

/**
 * Create a new field mapping. Validates uniqueness and checks type compatibility.
 */
export async function createFieldMapping(
  objectMappingId: string,
  input: CreateFieldMappingInput,
): Promise<FieldMappingDTO> {
  // Verify object mapping exists
  const objectMapping = await prisma.objectMapping.findUnique({ where: { id: objectMappingId } })
  if (!objectMapping) throw new ObjectMappingNotFoundError(objectMappingId)

  // One-to-one: check source field not already mapped
  const existing = await prisma.fieldMapping.findUnique({
    where: {
      objectMappingId_sourceFieldApiName: {
        objectMappingId,
        sourceFieldApiName: input.sourceFieldApiName,
      },
    },
  })
  if (existing) throw new DuplicateFieldMappingError(input.sourceFieldApiName)

  // Fetch field details for type compatibility check
  const [sourceField, destField] = await Promise.all([
    prisma.objectField.findUnique({ where: { id: input.sourceFieldId } }),
    prisma.objectField.findUnique({ where: { id: input.destFieldId } }),
  ])

  const compatibility = checkTypeCompatibility(sourceField?.dataType ?? 'text', destField?.dataType ?? 'text')

  const mapping = await prisma.fieldMapping.create({
    data: {
      objectMappingId,
      sourceFieldId: input.sourceFieldId,
      sourceFieldApiName: input.sourceFieldApiName,
      destFieldId: input.destFieldId,
      destFieldApiName: input.destFieldApiName,
      typeCompatibility: compatibility,
    },
  })

  await logAction(objectMapping.planId, 'FIELD_MAPPING_CREATED', {
    fieldMappingId: mapping.id,
    objectMappingId,
    sourceFieldApiName: input.sourceFieldApiName,
    destFieldApiName: input.destFieldApiName,
    typeCompatibility: compatibility,
  })

  return toDTO(mapping, sourceField, destField)
}

/**
 * Delete a field mapping by ID.
 */
export async function deleteFieldMapping(fieldMappingId: string): Promise<void> {
  const mapping = await prisma.fieldMapping.findUnique({
    where: { id: fieldMappingId },
    include: { objectMapping: true },
  })
  if (!mapping) throw new FieldMappingNotFoundError(fieldMappingId)

  await prisma.fieldMapping.delete({ where: { id: fieldMappingId } })

  await logAction(mapping.objectMapping.planId, 'FIELD_MAPPING_DELETED', {
    fieldMappingId,
    objectMappingId: mapping.objectMappingId,
    sourceFieldApiName: mapping.sourceFieldApiName,
    destFieldApiName: mapping.destFieldApiName,
  })
}

/**
 * Return source fields for the object mapping that don't have a field mapping yet.
 */
export async function getUnmappedSourceFields(objectMappingId: string): Promise<UnmappedSourceField[]> {
  const objectMapping = await prisma.objectMapping.findUnique({ where: { id: objectMappingId } })
  if (!objectMapping) return []

  // Get all fields for the source object
  const sourceFields = await prisma.objectField.findMany({
    where: { objectId: objectMapping.sourceObjectId },
    orderBy: { apiName: 'asc' },
  })

  // Get already-mapped source field API names
  const existingMappings = await prisma.fieldMapping.findMany({
    where: { objectMappingId },
    select: { sourceFieldApiName: true },
  })
  const mappedApiNames = new Set(existingMappings.map((m) => m.sourceFieldApiName))

  return sourceFields
    .filter((f) => !mappedApiNames.has(f.apiName))
    .map((f) => ({
      id: f.id,
      apiName: f.apiName,
      label: f.label,
      dataType: f.dataType,
      isRequired: f.isRequired,
      isReadOnly: f.isReadOnly,
    }))
}

/**
 * Return destination fields available for the object mapping.
 * Returns all dest object fields (one-to-one is enforced at source side only).
 */
export async function getAvailableDestFields(objectMappingId: string): Promise<AvailableDestField[]> {
  const objectMapping = await prisma.objectMapping.findUnique({ where: { id: objectMappingId } })
  if (!objectMapping) return []

  const destFields = await prisma.objectField.findMany({
    where: { objectId: objectMapping.destObjectId },
    orderBy: { apiName: 'asc' },
  })

  return destFields.map((f) => ({
    id: f.id,
    apiName: f.apiName,
    label: f.label,
    dataType: f.dataType,
    isRequired: f.isRequired,
    isReadOnly: f.isReadOnly,
  }))
}

/**
 * Auto-match: create predictable field mappings for an object mapping.
 * Idempotent — skips pairs already mapped.
 */
export async function autoMatchFields(objectMappingId: string): Promise<FieldAutoMatchResult> {
  const objectMapping = await prisma.objectMapping.findUnique({ where: { id: objectMappingId } })
  if (!objectMapping) throw new ObjectMappingNotFoundError(objectMappingId)

  // Resolve adapter types
  const [sourceConn, destConn] = await Promise.all([
    prisma.sourceConnection.findUnique({ where: { planId: objectMapping.planId } }),
    prisma.destinationConnection.findUnique({ where: { planId: objectMapping.planId } }),
  ])

  if (!sourceConn || !destConn) {
    return { created: 0, skipped: 0, pairs: [] }
  }

  const pairs = getFieldAutoMatchPairs(
    sourceConn.adapterType,
    destConn.adapterType,
    objectMapping.sourceObjectApiName,
    objectMapping.destObjectApiName,
  )

  if (pairs.length === 0) {
    return { created: 0, skipped: 0, pairs: [] }
  }

  // Load source and dest fields by apiName
  const [sourceFields, destFields] = await Promise.all([
    prisma.objectField.findMany({ where: { objectId: objectMapping.sourceObjectId } }),
    prisma.objectField.findMany({ where: { objectId: objectMapping.destObjectId } }),
  ])

  const sourceByApiName = new Map(sourceFields.map((f) => [f.apiName, f]))
  const destByApiName = new Map(destFields.map((f) => [f.apiName, f]))

  // Get already-mapped source field API names
  const existingMappings = await prisma.fieldMapping.findMany({
    where: { objectMappingId },
    select: { sourceFieldApiName: true },
  })
  const alreadyMapped = new Set(existingMappings.map((m) => m.sourceFieldApiName))

  const result: FieldAutoMatchResult = { created: 0, skipped: 0, pairs: [] }

  for (const pair of pairs) {
    const sourceField = sourceByApiName.get(pair.sourceFieldApiName)
    const destField = destByApiName.get(pair.destFieldApiName)

    if (!sourceField || !destField) continue

    if (alreadyMapped.has(pair.sourceFieldApiName)) {
      result.skipped++
      result.pairs.push({
        sourceFieldApiName: pair.sourceFieldApiName,
        destFieldApiName: pair.destFieldApiName,
        status: 'skipped',
      })
      continue
    }

    const compatibility = checkTypeCompatibility(sourceField.dataType, destField.dataType)

    await prisma.fieldMapping.create({
      data: {
        objectMappingId,
        sourceFieldId: sourceField.id,
        sourceFieldApiName: sourceField.apiName,
        destFieldId: destField.id,
        destFieldApiName: destField.apiName,
        typeCompatibility: compatibility,
      },
    })

    result.created++
    result.pairs.push({
      sourceFieldApiName: pair.sourceFieldApiName,
      destFieldApiName: pair.destFieldApiName,
      status: 'created',
    })
  }

  if (result.created > 0) {
    await logAction(objectMapping.planId, 'FIELD_MAPPING_AUTO_MATCHED', {
      objectMappingId,
      created: result.created,
      skipped: result.skipped,
    })
  }

  return result
}
