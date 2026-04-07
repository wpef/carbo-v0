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

// --- Type normalization (shared with migration-logic route) ---

function normaliseType(dataType: string): string {
  const t = dataType.toLowerCase().trim()
  if (['string', 'text', 'email', 'url', 'phone', 'textarea', 'richtext', 'id'].includes(t)) return 'text'
  if (['number', 'integer', 'int', 'float', 'double', 'decimal', 'currency', 'percent'].includes(t)) return 'number'
  if (['date', 'datetime', 'time'].includes(t)) return 'date'
  if (['picklist', 'multipicklist', 'enum', 'enumeration', 'select'].includes(t)) return 'picklist'
  if (['boolean', 'bool', 'checkbox'].includes(t)) return 'boolean'
  return 'text'
}

/** Derive the section type from source/dest field types (same as migration-logic route) */
function deriveSectionFromTypes(sourceType: string, destType: string): string {
  const src = normaliseType(sourceType)
  const dst = normaliseType(destType)
  if (src === 'picklist' && (dst === 'picklist' || dst === 'boolean')) return 'VALUE_EQUIVALENCE'
  if (src === 'boolean' && dst === 'picklist') return 'VALUE_EQUIVALENCE'
  if (dst === 'picklist') return 'PROMPT'
  if (src === dst) return 'INFORMATIONAL'
  if (src === 'picklist' && dst === 'text') return 'INFORMATIONAL'
  if (src === 'boolean' && (dst === 'text' || dst === 'number' || dst === 'boolean')) return 'INFORMATIONAL'
  if (src === 'number' && dst === 'text') return 'INFORMATIONAL'
  if (src === 'date' && dst === 'text') return 'INFORMATIONAL'
  return 'ERROR'
}

// --- Helpers ---

/**
 * Derives LinkStatus from TypeCompatibility + migration logic status.
 * - INCOMPATIBLE type → RED_DASHED (types can't be linked)
 * - No migration logic → RED_SOLID (needs configuration)
 * - Logic DEFINED → ORANGE (needs validation)
 * - Logic VALIDATED → GREEN (ready)
 */
export function getLinkStatus(
  typeCompatibility: TypeCompatibility,
  migrationLogicStatus?: string | null,
  sectionType?: string | null,
): LinkStatus {
  // D3 (ERROR) / INCOMPATIBLE → always red dashed
  if (typeCompatibility === 'INCOMPATIBLE' || sectionType === 'ERROR') return 'RED_DASHED'
  // D4 (INFORMATIONAL) → auto-validated, no user action needed
  if (sectionType === 'INFORMATIONAL') return 'GREEN'
  // D1/D2: check migration logic status
  if (!migrationLogicStatus || migrationLogicStatus === 'DRAFT') return 'RED_SOLID'
  if (migrationLogicStatus === 'DEFINED') return 'ORANGE'
  if (migrationLogicStatus === 'VALIDATED') return 'GREEN'
  return 'RED_SOLID'
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
  migrationLogicStatus?: string | null,
  sectionType?: string | null,
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
    linkStatus: getLinkStatus(compatibility, migrationLogicStatus, sectionType),
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
    include: { migrationLogic: { select: { status: true, sectionType: true } } },
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

  return mappings.map((m) => {
    const sourceField = sourceById.get(m.sourceFieldId) ?? null
    const destField = destById.get(m.destFieldId) ?? null
    // Derive sectionType from migration logic or from type compatibility
    const sectionType = m.migrationLogic?.sectionType ?? deriveSectionFromTypes(
      sourceField?.dataType ?? 'text',
      destField?.dataType ?? 'text',
    )
    return toDTO(
      m,
      sourceField,
      destField,
      m.migrationLogic?.status ?? null,
      sectionType,
    )
  })
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

  const sectionType = deriveSectionFromTypes(
    sourceField?.dataType ?? 'text',
    destField?.dataType ?? 'text',
  )
  return toDTO(mapping, sourceField, destField, null, sectionType)
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

  // Load source and dest fields by apiName
  const [sourceFields, destFields] = await Promise.all([
    prisma.objectField.findMany({ where: { objectId: objectMapping.sourceObjectId } }),
    prisma.objectField.findMany({ where: { objectId: objectMapping.destObjectId } }),
  ])

  const sourceByApiName = new Map(sourceFields.map((f) => [f.apiName, f]))
  const sourceByLowerApiName = new Map(sourceFields.map((f) => [f.apiName.toLowerCase(), f]))
  const destByApiName = new Map(destFields.map((f) => [f.apiName, f]))
  const destByLowerApiName = new Map(destFields.map((f) => [f.apiName.toLowerCase(), f]))

  // Registry-based pairs
  const registryPairs = getFieldAutoMatchPairs(
    sourceConn.adapterType,
    destConn.adapterType,
    objectMapping.sourceObjectApiName,
    objectMapping.destObjectApiName,
  )

  // Name-based matching (case-insensitive) for fields not covered by registry
  const registrySourceNames = new Set(registryPairs.map((p) => p.sourceFieldApiName.toLowerCase()))
  const destByLowerName = new Map(destFields.map((f) => [f.apiName.toLowerCase(), f.apiName]))
  const namePairs = sourceFields
    .filter((sf) => !registrySourceNames.has(sf.apiName.toLowerCase()) && destByLowerName.has(sf.apiName.toLowerCase()))
    .map((sf) => ({
      sourceFieldApiName: sf.apiName,
      destFieldApiName: destByLowerName.get(sf.apiName.toLowerCase())!,
    }))

  // Combine: registry first, then name-based for the rest
  const pairs = [...registryPairs, ...namePairs]

  // Get already-mapped source field API names
  const existingMappings = await prisma.fieldMapping.findMany({
    where: { objectMappingId },
    select: { sourceFieldApiName: true },
  })
  const alreadyMapped = new Set(existingMappings.map((m) => m.sourceFieldApiName))

  const result: FieldAutoMatchResult = { created: 0, skipped: 0, pairs: [] }

  for (const pair of pairs) {
    // Case-insensitive lookup with exact-match fallback
    const sourceField = sourceByApiName.get(pair.sourceFieldApiName) ?? sourceByLowerApiName.get(pair.sourceFieldApiName.toLowerCase())
    const destField = destByApiName.get(pair.destFieldApiName) ?? destByLowerApiName.get(pair.destFieldApiName.toLowerCase())

    if (!sourceField || !destField) continue

    if (alreadyMapped.has(sourceField.apiName)) {
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
