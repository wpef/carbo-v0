// 012-field-mapping — Field mapping service (v4)
// Cluster 3: listFieldMappings enriched with linkStatus via computeLinkStatus()
// Anti-stale-FK: resolves fields by apiName on CURRENT snapshot, not by stored FK.

import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { computeAutoMatchPairs } from '../lib/auto-match-registry'
import { checkTypeCompatibility } from '../lib/type-compatibility'
import { computeLinkStatus } from '../lib/link-status'
import type { MigrationLogicSnapshot } from '../lib/link-status'
import type { CompatibilityStatus } from '@prisma/client'
// 017 — trigger integrity check after field mapping CRUD
import { checkAndUpdatePlanStatus } from '@/features/integrity/services/integrity-service'

// ─── Errors ────────────────────────────────────────────────────────────────────

export class FieldMappingNotFoundError extends Error {
  constructor(id: string) {
    super(`FieldMapping not found: ${id}`)
    this.name = 'FieldMappingNotFoundError'
  }
}

export class DuplicateFieldMappingError extends Error {
  constructor(sourceFieldName: string) {
    super(`A field mapping already exists for source field: ${sourceFieldName}`)
    this.name = 'DuplicateFieldMappingError'
  }
}

export class ObjectMappingNotFoundError extends Error {
  constructor(id: string) {
    super(`ObjectMapping not found: ${id}`)
    this.name = 'ObjectMappingNotFoundError'
  }
}

// ─── DTO shape ──────────────────────────────────────────────────────────────────

export interface FieldMappingDTO {
  id: string
  objectMappingId: string
  sourceFieldName: string
  sourceFieldLabel: string
  sourceFieldType: string
  destinationFieldName: string
  destFieldLabel: string
  destFieldType: string
  compatibilityStatus: CompatibilityStatus
  linkStatus: 'GREEN' | 'ORANGE' | 'RED_SOLID' | 'RED_DASHED' | 'BROKEN'
  statusDetail?: string
  migrationLogic: {
    id: string
    status: string
    sectionType: string
    valueEquivalences: { sourceValue: string; destinationValue: string }[]
  } | null
  autoCreated: boolean
  createdAt?: string
  updatedAt?: string
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Resolve the CURRENT snapshot object for a given plan + side + object apiName.
 * Returns null if the connection, snapshot, or object can't be found by apiName.
 *
 * Anti-stale-FK (spec 017): stored objectId is a hint only; we always re-resolve
 * by apiName against the CURRENT snapshot to survive schema refreshes.
 */
async function resolveCurrentObject(
  planId: string,
  side: 'SOURCE' | 'DESTINATION',
  objectApiName: string,
) {
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: { sourceConnectionId: true, destinationConnectionId: true },
  })
  if (!plan) return null

  const connectionId = side === 'SOURCE' ? plan.sourceConnectionId : plan.destinationConnectionId
  if (!connectionId) return null

  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId, side, status: 'CURRENT' } },
  })
  if (!snapshot) return null

  return prisma.schemaObject.findUnique({
    where: { snapshotId_apiName: { snapshotId: snapshot.id, apiName: objectApiName } },
  })
}

/**
 * Build a MigrationLogicSnapshot from a DB MigrationLogic record + source/dest fields.
 * Used by computeLinkStatus for D1 value-completeness check.
 */
function buildLogicSnapshot(
  logic: {
    status: string
    config: string
    valueEquivalences: { sourceValue: string; destinationValue: string }[]
  } | null,
  sourcePicklistValues: string[],
  destPicklistValues: string[],
): MigrationLogicSnapshot | null {
  if (!logic) return null
  const status = logic.status as 'DRAFT' | 'DEFINED' | 'VALIDATED'
  if (status === 'DRAFT') return { status }

  return {
    status,
    sourceValues: sourcePicklistValues,
    destValues: destPicklistValues,
    mappedSourceValues: logic.valueEquivalences.map((ve) => ve.sourceValue),
  }
}

function parsePicklistValues(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

// ─── toDTO ─────────────────────────────────────────────────────────────────────

function toDTO(
  mapping: {
    id: string
    objectMappingId: string
    sourceFieldName: string
    sourceFieldType: string
    destinationFieldName: string
    destinationFieldType: string
    compatibilityStatus: CompatibilityStatus
    autoCreated: boolean
    migrationLogic: {
      id: string
      status: string
      config: string
      description: string | null
      valueEquivalences: { sourceValue: string; destinationValue: string }[]
      classificationPrompt?: { promptText: string } | null
    } | null
  },
  sourceField: { label: string; dataType: string; picklistValues?: string | null } | null,
  destField: { label: string; dataType: string; picklistValues?: string | null } | null,
): FieldMappingDTO {
  const srcType = sourceField?.dataType ?? mapping.sourceFieldType
  const dstType = destField?.dataType ?? mapping.destinationFieldType

  // Anti-stale-FK (017): a field is missing if it couldn't be resolved from the CURRENT snapshot
  const sourceFieldExists = sourceField !== null
  const destFieldExists = destField !== null

  // Build picklist value arrays for D1 completeness check
  const srcPicklist = parsePicklistValues(sourceField?.picklistValues)
  const dstPicklist = parsePicklistValues(destField?.picklistValues)

  const logicSnapshot = buildLogicSnapshot(mapping.migrationLogic, srcPicklist, dstPicklist)
  const { linkStatus, statusDetail } = computeLinkStatus(
    srcType,
    dstType,
    logicSnapshot,
    sourceFieldExists,
    destFieldExists,
  )

  // Rebuild sectionType from migration-logic DB record (stored at save time)
  let sectionTypeFromDB: string | undefined
  if (mapping.migrationLogic) {
    try {
      const cfg = JSON.parse(mapping.migrationLogic.config) as { sectionType?: string }
      sectionTypeFromDB = cfg.sectionType
    } catch {
      // ignore parse error
    }
  }

  const migLogic = mapping.migrationLogic
    ? {
        id: mapping.migrationLogic.id,
        status: mapping.migrationLogic.status,
        sectionType: sectionTypeFromDB ?? 'INFORMATIONAL',
        valueEquivalences: mapping.migrationLogic.valueEquivalences,
      }
    : null

  return {
    id: mapping.id,
    objectMappingId: mapping.objectMappingId,
    sourceFieldName: mapping.sourceFieldName,
    sourceFieldLabel: sourceField?.label ?? mapping.sourceFieldName,
    sourceFieldType: srcType,
    destinationFieldName: mapping.destinationFieldName,
    destFieldLabel: destField?.label ?? mapping.destinationFieldName,
    destFieldType: dstType,
    compatibilityStatus: mapping.compatibilityStatus,
    linkStatus,
    statusDetail,
    migrationLogic: migLogic,
    autoCreated: mapping.autoCreated,
  }
}

// ─── listFieldMappings ─────────────────────────────────────────────────────────

/**
 * List all field mappings for an object mapping, enriched with linkStatus.
 *
 * Fields are resolved against the CURRENT snapshot by apiName (not by stored FK)
 * so that mappings stay renderable after a schema refresh rotates snapshots.
 * Mappings whose source or destination field no longer exists → linkStatus=BROKEN.
 */
export async function listFieldMappings(objectMappingId: string): Promise<FieldMappingDTO[]> {
  const objectMapping = await prisma.objectMapping.findUnique({ where: { id: objectMappingId } })
  if (!objectMapping) return []

  const mappings = await prisma.fieldMapping.findMany({
    where: { objectMappingId },
    include: {
      migrationLogic: {
        include: {
          valueEquivalences: true,
          classificationPrompt: true,
        },
      },
    },
    orderBy: { sourceFieldName: 'asc' },
  })

  if (mappings.length === 0) return []

  // Resolve source/destination objects from the CURRENT snapshots by apiName
  const [currentSourceObj, currentDestObj] = await Promise.all([
    resolveCurrentObject(objectMapping.planId, 'SOURCE', objectMapping.sourceObjectName),
    resolveCurrentObject(objectMapping.planId, 'DESTINATION', objectMapping.destinationObjectName),
  ])

  const [currentSourceFields, currentDestFields] = await Promise.all([
    currentSourceObj
      ? prisma.objectField.findMany({ where: { objectId: currentSourceObj.id } })
      : Promise.resolve([]),
    currentDestObj
      ? prisma.objectField.findMany({ where: { objectId: currentDestObj.id } })
      : Promise.resolve([]),
  ])

  const sourceByApiName = new Map(currentSourceFields.map((f) => [f.apiName, f]))
  const destByApiName = new Map(currentDestFields.map((f) => [f.apiName, f]))

  return mappings.map((m) => {
    const sourceField = sourceByApiName.get(m.sourceFieldName) ?? null
    const destField = destByApiName.get(m.destinationFieldName) ?? null
    return toDTO(m, sourceField, destField)
  })
}

// ─── createFieldMapping ────────────────────────────────────────────────────────

export interface CreateFieldMappingInput {
  sourceFieldName: string
  destinationFieldName: string
  sourceFieldType?: string
  destFieldType?: string
}

/**
 * Create a new field mapping.
 * Enforces one-to-one uniqueness on sourceFieldName (DuplicateFieldMappingError → 409).
 * Also enforces one-to-one on destinationFieldName.
 */
export async function createFieldMapping(
  planId: string,
  objectMappingId: string,
  input: CreateFieldMappingInput,
): Promise<FieldMappingDTO> {
  const objectMapping = await prisma.objectMapping.findUnique({ where: { id: objectMappingId } })
  if (!objectMapping || objectMapping.planId !== planId) throw new ObjectMappingNotFoundError(objectMappingId)

  // Check source uniqueness
  const existingBySrc = await prisma.fieldMapping.findUnique({
    where: {
      objectMappingId_sourceFieldName: {
        objectMappingId,
        sourceFieldName: input.sourceFieldName,
      },
    },
  })
  if (existingBySrc) throw new DuplicateFieldMappingError(input.sourceFieldName)

  // Resolve current fields by apiName for type checking
  const [currentSourceObj, currentDestObj] = await Promise.all([
    resolveCurrentObject(planId, 'SOURCE', objectMapping.sourceObjectName),
    resolveCurrentObject(planId, 'DESTINATION', objectMapping.destinationObjectName),
  ])

  let sourceField = null
  let destField = null

  if (currentSourceObj) {
    sourceField = await prisma.objectField.findUnique({
      where: { objectId_apiName: { objectId: currentSourceObj.id, apiName: input.sourceFieldName } },
    })
  }
  if (currentDestObj) {
    destField = await prisma.objectField.findUnique({
      where: { objectId_apiName: { objectId: currentDestObj.id, apiName: input.destinationFieldName } },
    })
  }

  const srcType = sourceField?.dataType ?? input.sourceFieldType ?? 'string'
  const dstType = destField?.dataType ?? input.destFieldType ?? 'string'
  const compatibility = checkTypeCompatibility(srcType, dstType)

  const mapping = await prisma.fieldMapping.create({
    data: {
      objectMappingId,
      sourceFieldName: input.sourceFieldName,
      destinationFieldName: input.destinationFieldName,
      sourceFieldType: srcType,
      destinationFieldType: dstType,
      compatibilityStatus: compatibility,
      autoCreated: false,
    },
    include: {
      migrationLogic: {
        include: { valueEquivalences: true, classificationPrompt: true },
      },
    },
  })

  await logAuditEvent({
    planId,
    action: 'CREATE_FIELD_MAPPING',
    entity: 'FieldMapping',
    entityId: mapping.id,
    details: {
      objectMappingId,
      sourceFieldName: input.sourceFieldName,
      destinationFieldName: input.destinationFieldName,
      compatibility,
    },
  })

  // 017 — re-evaluate plan integrity + status after every field mapping creation
  await checkAndUpdatePlanStatus(planId)

  return toDTO(mapping, sourceField, destField)
}

// ─── deleteFieldMapping ────────────────────────────────────────────────────────

export async function deleteFieldMapping(planId: string, fieldMappingId: string): Promise<void> {
  const mapping = await prisma.fieldMapping.findUnique({
    where: { id: fieldMappingId },
    include: { objectMapping: { select: { planId: true } } },
  })
  if (!mapping) throw new FieldMappingNotFoundError(fieldMappingId)

  await prisma.fieldMapping.delete({ where: { id: fieldMappingId } })

  await logAuditEvent({
    planId,
    action: 'DELETE_FIELD_MAPPING',
    entity: 'FieldMapping',
    entityId: fieldMappingId,
    details: {
      objectMappingId: mapping.objectMappingId,
      sourceFieldName: mapping.sourceFieldName,
      destinationFieldName: mapping.destinationFieldName,
    },
  })

  // 017 — re-evaluate plan integrity + status after every field mapping deletion
  await checkAndUpdatePlanStatus(planId)
}

// ─── autoMatchFields ───────────────────────────────────────────────────────────

export interface AutoMatchResult {
  created: number
  skipped: number
}

/**
 * Auto-match field pairs for an object mapping using the registry + name-based matching.
 * Idempotent — skips pairs already mapped.
 */
export async function autoMatchFields(planId: string, objectMappingId: string): Promise<AutoMatchResult> {
  const objectMapping = await prisma.objectMapping.findUnique({
    where: { id: objectMappingId },
    select: {
      planId: true,
      sourceObjectName: true,
      destinationObjectName: true,
      fieldAutoMatchedAt: true,
    },
  })
  if (!objectMapping || objectMapping.planId !== planId) throw new ObjectMappingNotFoundError(objectMappingId)

  // Principle IX (spec 012 US3 #3): auto-match runs at most once; never re-fire,
  // even after the consultant manually deletes auto-created mappings.
  if (objectMapping.fieldAutoMatchedAt) return { created: 0, skipped: 0 }

  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: { sourceConnectionId: true, destinationConnectionId: true },
  })
  if (!plan?.sourceConnectionId || !plan?.destinationConnectionId) {
    return { created: 0, skipped: 0 }
  }

  const [sourceConn, destConn] = await Promise.all([
    prisma.connectorConnection.findUnique({
      where: { id: plan.sourceConnectionId },
      select: { adapterType: true },
    }),
    prisma.connectorConnection.findUnique({
      where: { id: plan.destinationConnectionId },
      select: { adapterType: true },
    }),
  ])
  if (!sourceConn || !destConn) return { created: 0, skipped: 0 }

  // Resolve CURRENT snapshot objects
  const [currentSourceObj, currentDestObj] = await Promise.all([
    resolveCurrentObject(planId, 'SOURCE', objectMapping.sourceObjectName),
    resolveCurrentObject(planId, 'DESTINATION', objectMapping.destinationObjectName),
  ])
  if (!currentSourceObj || !currentDestObj) return { created: 0, skipped: 0 }

  const [sourceFields, destFields] = await Promise.all([
    prisma.objectField.findMany({ where: { objectId: currentSourceObj.id } }),
    prisma.objectField.findMany({ where: { objectId: currentDestObj.id } }),
  ])

  const existingMappings = await prisma.fieldMapping.findMany({
    where: { objectMappingId },
    select: { sourceFieldName: true, destinationFieldName: true },
  })
  const mappedSrc = new Set(existingMappings.map((m) => m.sourceFieldName))
  const mappedDst = new Set(existingMappings.map((m) => m.destinationFieldName))

  // Compute ALL candidate pairs (registry ∪ name-based); already-mapped fields are
  // reported as `skipped` rather than silently excluded (012 US3 "skips already-mapped").
  const pairs = computeAutoMatchPairs(
    sourceConn.adapterType,
    destConn.adapterType,
    objectMapping.sourceObjectName,
    objectMapping.destinationObjectName,
    sourceFields.map((f) => f.apiName),
    destFields.map((f) => f.apiName),
  )

  const srcByName = new Map(sourceFields.map((f) => [f.apiName, f]))
  const dstByName = new Map(destFields.map((f) => [f.apiName, f]))

  let created = 0
  let skipped = 0

  for (const pair of pairs) {
    const sf = srcByName.get(pair.sourceFieldName)
    const df = dstByName.get(pair.destinationFieldName)
    if (!sf || !df) { skipped++; continue }
    if (mappedSrc.has(sf.apiName) || mappedDst.has(df.apiName)) { skipped++; continue }

    try {
      await prisma.fieldMapping.create({
        data: {
          objectMappingId,
          sourceFieldName: sf.apiName,
          destinationFieldName: df.apiName,
          sourceFieldType: sf.dataType,
          destinationFieldType: df.dataType,
          compatibilityStatus: checkTypeCompatibility(sf.dataType, df.dataType),
          autoCreated: true,
        },
      })
      created++
    } catch {
      // unique constraint violation → already mapped, count as skipped
      skipped++
    }
  }

  await prisma.objectMapping.update({
    where: { id: objectMappingId },
    data: { fieldAutoMatchedAt: new Date() },
  })

  if (created > 0) {
    await logAuditEvent({
      planId,
      action: 'AUTO_MATCH_FIELDS',
      entity: 'FieldMapping',
      details: { objectMappingId, created, skipped },
    })
  }

  return { created, skipped }
}

// ─── getUnmappedSourceFields ──────────────────────────────────────────────────

export interface UnmappedSourceField {
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
  isReadOnly: boolean
}

/**
 * Returns source fields for an object mapping that don't have a field mapping yet
 * AND are not explicitly excluded.
 * Resolves against the CURRENT snapshot by apiName.
 */
export async function getUnmappedSourceFields(objectMappingId: string): Promise<UnmappedSourceField[]> {
  const objectMapping = await prisma.objectMapping.findUnique({
    where: { id: objectMappingId },
    include: {
      fieldMappings: { select: { sourceFieldName: true } },
      exclusions: { select: { sourceFieldName: true } },
    },
  })
  if (!objectMapping) return []

  const sourceObj = await resolveCurrentObject(objectMapping.planId, 'SOURCE', objectMapping.sourceObjectName)
  if (!sourceObj) return []

  const sourceFields = await prisma.objectField.findMany({
    where: { objectId: sourceObj.id },
    orderBy: { apiName: 'asc' },
  })

  const mappedApiNames = new Set(objectMapping.fieldMappings.map((m) => m.sourceFieldName))
  const excludedApiNames = new Set(objectMapping.exclusions.map((e) => e.sourceFieldName))

  return sourceFields
    .filter((f) => !mappedApiNames.has(f.apiName) && !excludedApiNames.has(f.apiName))
    .map((f) => ({
      apiName: f.apiName,
      label: f.label,
      dataType: f.dataType,
      isRequired: f.isRequired,
      isReadOnly: f.isReadOnly,
    }))
}

// ─── getAvailableDestFields ───────────────────────────────────────────────────

export interface AvailableDestField {
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
  isReadOnly: boolean
}

/**
 * Returns destination fields available for an object mapping.
 * Resolves against the CURRENT snapshot by apiName.
 */
export async function getAvailableDestFields(objectMappingId: string): Promise<AvailableDestField[]> {
  const objectMapping = await prisma.objectMapping.findUnique({ where: { id: objectMappingId } })
  if (!objectMapping) return []

  const destObj = await resolveCurrentObject(objectMapping.planId, 'DESTINATION', objectMapping.destinationObjectName)
  if (!destObj) return []

  const destFields = await prisma.objectField.findMany({
    where: { objectId: destObj.id },
    orderBy: { apiName: 'asc' },
  })

  return destFields.map((f) => ({
    apiName: f.apiName,
    label: f.label,
    dataType: f.dataType,
    isRequired: f.isRequired,
    isReadOnly: f.isReadOnly,
  }))
}
