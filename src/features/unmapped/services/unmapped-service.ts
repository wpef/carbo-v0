// 016-unmapped-fields-detection — Service (v4)
// Bridges the DB layer to the pure computeUnmappedFields() core.

import { prisma } from '@/lib/prisma'
import { computeUnmappedFields } from '../lib/compute-unmapped'
import type { UnmappedFieldsReport, FieldExclusionInput } from '../lib/compute-unmapped'
import type { ConnectorField } from '@/lib/types/connector'

export type { UnmappedFieldsReport }

// ─── Errors ────────────────────────────────────────────────────────────────────

export class ObjectMappingNotFoundError extends Error {
  constructor(id: string) {
    super(`ObjectMapping not found: ${id}`)
    this.name = 'ObjectMappingNotFoundError'
  }
}

// ─── Internal: resolve CURRENT snapshot object ─────────────────────────────────

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

function dbFieldToConnectorField(f: {
  apiName: string
  label: string
  dataType: string
  isRequired: boolean
  isReadOnly: boolean
  isUnique: boolean
  referenceTo: string | null
  relationshipType: string | null
}): ConnectorField {
  return {
    apiName: f.apiName,
    label: f.label,
    dataType: f.dataType,
    isRequired: f.isRequired,
    isReadOnly: f.isReadOnly,
    isUnique: f.isUnique,
    referenceTo: f.referenceTo ?? undefined,
  }
}

// ─── getUnmappedFieldsForMapping ──────────────────────────────────────────────

/**
 * Compute the unmapped-fields report for a single object mapping.
 * Resolves fields against the CURRENT snapshot (anti-stale-FK, 017 spec).
 */
export async function getUnmappedFieldsForMapping(
  planId: string,
  objectMappingId: string,
): Promise<UnmappedFieldsReport> {
  const objectMapping = await prisma.objectMapping.findUnique({
    where: { id: objectMappingId },
    include: {
      fieldMappings: { select: { sourceFieldName: true, destinationFieldName: true } },
      exclusions: { select: { id: true, sourceFieldName: true, reason: true } },
    },
  })
  if (!objectMapping || objectMapping.planId !== planId) {
    throw new ObjectMappingNotFoundError(objectMappingId)
  }

  const [sourceObj, destObj] = await Promise.all([
    resolveCurrentObject(planId, 'SOURCE', objectMapping.sourceObjectName),
    resolveCurrentObject(planId, 'DESTINATION', objectMapping.destinationObjectName),
  ])

  const [sourceFields, destFields] = await Promise.all([
    sourceObj ? prisma.objectField.findMany({ where: { objectId: sourceObj.id } }) : Promise.resolve([]),
    destObj ? prisma.objectField.findMany({ where: { objectId: destObj.id } }) : Promise.resolve([]),
  ])

  const exclusions: FieldExclusionInput[] = objectMapping.exclusions.map((e) => ({
    id: e.id,
    sourceFieldName: e.sourceFieldName,
    reason: e.reason,
    createdAt: new Date().toISOString(), // FieldExclusion has no createdAt in v4 schema
  }))

  return computeUnmappedFields(
    sourceFields.map(dbFieldToConnectorField),
    destFields.map(dbFieldToConnectorField),
    objectMapping.fieldMappings,
    exclusions,
  )
}

// ─── getUnmappedFieldsForPlan (plan-level aggregate) ─────────────────────────

export interface PlanUnmappedFieldsReport {
  objectMappings: Array<{
    objectMappingId: string
    sourceObjectName: string
    destinationObjectName: string
    report: UnmappedFieldsReport
  }>
  summary: {
    totalUnmappedSource: number
    totalUnmappedRequiredDest: number
    totalRequiredSourceUnmapped: number
    isComplete: boolean
  }
}

/**
 * Compute unmapped-fields reports for all object mappings within a plan.
 * Batch-fetches data for efficiency.
 */
export async function getUnmappedFieldsForPlan(planId: string): Promise<PlanUnmappedFieldsReport> {
  const objectMappings = await prisma.objectMapping.findMany({
    where: { planId },
    include: {
      fieldMappings: { select: { sourceFieldName: true, destinationFieldName: true } },
      exclusions: { select: { id: true, sourceFieldName: true, reason: true } },
    },
    orderBy: { sourceObjectName: 'asc' },
  })

  if (objectMappings.length === 0) {
    return {
      objectMappings: [],
      summary: { totalUnmappedSource: 0, totalUnmappedRequiredDest: 0, totalRequiredSourceUnmapped: 0, isComplete: true },
    }
  }

  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    select: { sourceConnectionId: true, destinationConnectionId: true },
  })

  // Find CURRENT snapshots
  const [srcSnapshot, dstSnapshot] = await Promise.all([
    plan?.sourceConnectionId
      ? prisma.schemaSnapshot.findUnique({
          where: { connectionId_side_status: { connectionId: plan.sourceConnectionId, side: 'SOURCE', status: 'CURRENT' } },
        })
      : null,
    plan?.destinationConnectionId
      ? prisma.schemaSnapshot.findUnique({
          where: { connectionId_side_status: { connectionId: plan.destinationConnectionId, side: 'DESTINATION', status: 'CURRENT' } },
        })
      : null,
  ])

  // Batch-load all objects from both snapshots
  const [srcObjects, dstObjects] = await Promise.all([
    srcSnapshot ? prisma.schemaObject.findMany({ where: { snapshotId: srcSnapshot.id } }) : Promise.resolve([]),
    dstSnapshot ? prisma.schemaObject.findMany({ where: { snapshotId: dstSnapshot.id } }) : Promise.resolve([]),
  ])

  const srcObjByApiName = new Map(srcObjects.map((o) => [o.apiName, o]))
  const dstObjByApiName = new Map(dstObjects.map((o) => [o.apiName, o]))

  // Batch-load all fields
  const srcObjectIds = srcObjects.map((o) => o.id)
  const dstObjectIds = dstObjects.map((o) => o.id)
  const [allSrcFields, allDstFields] = await Promise.all([
    srcObjectIds.length > 0 ? prisma.objectField.findMany({ where: { objectId: { in: srcObjectIds } } }) : Promise.resolve([]),
    dstObjectIds.length > 0 ? prisma.objectField.findMany({ where: { objectId: { in: dstObjectIds } } }) : Promise.resolve([]),
  ])

  const srcFieldsByObjectId = new Map<string, typeof allSrcFields>()
  for (const f of allSrcFields) {
    const arr = srcFieldsByObjectId.get(f.objectId) ?? []
    arr.push(f)
    srcFieldsByObjectId.set(f.objectId, arr)
  }
  const dstFieldsByObjectId = new Map<string, typeof allDstFields>()
  for (const f of allDstFields) {
    const arr = dstFieldsByObjectId.get(f.objectId) ?? []
    arr.push(f)
    dstFieldsByObjectId.set(f.objectId, arr)
  }

  let totalUnmappedSource = 0
  let totalUnmappedRequiredDest = 0
  let totalRequiredSourceUnmapped = 0

  const reports = objectMappings.map((om) => {
    const srcObj = srcObjByApiName.get(om.sourceObjectName)
    const dstObj = dstObjByApiName.get(om.destinationObjectName)

    const sourceFields = (srcObj ? srcFieldsByObjectId.get(srcObj.id) ?? [] : []).map(dbFieldToConnectorField)
    const destFields = (dstObj ? dstFieldsByObjectId.get(dstObj.id) ?? [] : []).map(dbFieldToConnectorField)

    const exclusions: FieldExclusionInput[] = om.exclusions.map((e) => ({
      id: e.id,
      sourceFieldName: e.sourceFieldName,
      reason: e.reason,
      createdAt: new Date().toISOString(),
    }))

    const report = computeUnmappedFields(sourceFields, destFields, om.fieldMappings, exclusions)
    totalUnmappedSource += report.unmappedSourceFields.length
    totalUnmappedRequiredDest += report.unmappedRequiredDestFields.length
    totalRequiredSourceUnmapped += report.unmappedSourceFields.filter((f) => f.isRequired).length

    return {
      objectMappingId: om.id,
      sourceObjectName: om.sourceObjectName,
      destinationObjectName: om.destinationObjectName,
      report,
    }
  })

  return {
    objectMappings: reports,
    summary: {
      totalUnmappedSource,
      totalUnmappedRequiredDest,
      totalRequiredSourceUnmapped,
      isComplete: reports.every((r) => r.report.isComplete),
    },
  }
}

// ─── FieldExclusion CRUD ──────────────────────────────────────────────────────

export interface FieldExclusionDTO {
  id: string
  objectMappingId: string
  sourceFieldName: string
  reason: string | null
}

export async function createExclusion(
  planId: string,
  objectMappingId: string,
  sourceFieldName: string,
  reason?: string,
): Promise<FieldExclusionDTO> {
  const om = await prisma.objectMapping.findUnique({ where: { id: objectMappingId } })
  if (!om || om.planId !== planId) throw new ObjectMappingNotFoundError(objectMappingId)

  const exclusion = await prisma.fieldExclusion.upsert({
    where: { objectMappingId_sourceFieldName: { objectMappingId, sourceFieldName } },
    create: { objectMappingId, sourceFieldName, reason: reason ?? null },
    update: { reason: reason ?? null },
  })

  return {
    id: exclusion.id,
    objectMappingId: exclusion.objectMappingId,
    sourceFieldName: exclusion.sourceFieldName,
    reason: exclusion.reason,
  }
}

export async function deleteExclusion(
  planId: string,
  objectMappingId: string,
  exclusionId: string,
): Promise<void> {
  const om = await prisma.objectMapping.findUnique({ where: { id: objectMappingId } })
  if (!om || om.planId !== planId) throw new ObjectMappingNotFoundError(objectMappingId)

  await prisma.fieldExclusion.deleteMany({
    where: { id: exclusionId, objectMappingId },
  })
}

export async function listExclusions(objectMappingId: string): Promise<FieldExclusionDTO[]> {
  const exclusions = await prisma.fieldExclusion.findMany({
    where: { objectMappingId },
    orderBy: { sourceFieldName: 'asc' },
  })
  return exclusions.map((e) => ({
    id: e.id,
    objectMappingId: e.objectMappingId,
    sourceFieldName: e.sourceFieldName,
    reason: e.reason,
  }))
}
