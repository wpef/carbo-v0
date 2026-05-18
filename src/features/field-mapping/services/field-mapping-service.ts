import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import type { CompatibilityStatus } from '@prisma/client'

const TYPE_COMPATIBILITY: Record<string, Record<string, CompatibilityStatus>> = {
  string: { string: 'COMPATIBLE', email: 'COMPATIBLE', phone: 'COMPATIBLE', url: 'COMPATIBLE', picklist: 'WARNING', id: 'WARNING', int: 'INCOMPATIBLE', currency: 'INCOMPATIBLE', percent: 'INCOMPATIBLE', date: 'INCOMPATIBLE', datetime: 'INCOMPATIBLE', boolean: 'INCOMPATIBLE' },
  email: { string: 'COMPATIBLE', email: 'COMPATIBLE' },
  phone: { string: 'COMPATIBLE', phone: 'COMPATIBLE' },
  url: { string: 'COMPATIBLE', url: 'COMPATIBLE' },
  picklist: { string: 'COMPATIBLE', picklist: 'COMPATIBLE' },
  id: { string: 'COMPATIBLE', id: 'COMPATIBLE' },
  int: { int: 'COMPATIBLE', currency: 'WARNING', percent: 'WARNING', string: 'WARNING' },
  currency: { currency: 'COMPATIBLE', int: 'WARNING', percent: 'WARNING', string: 'WARNING' },
  percent: { percent: 'COMPATIBLE', int: 'WARNING', currency: 'WARNING', string: 'WARNING' },
  date: { date: 'COMPATIBLE', datetime: 'WARNING', string: 'WARNING' },
  datetime: { datetime: 'COMPATIBLE', date: 'WARNING', string: 'WARNING' },
  boolean: { boolean: 'COMPATIBLE', string: 'WARNING' },
  reference: { reference: 'COMPATIBLE', string: 'WARNING' },
}

export function checkTypeCompatibility(sourceType: string, destType: string): CompatibilityStatus {
  return TYPE_COMPATIBILITY[sourceType]?.[destType] ?? 'INCOMPATIBLE'
}

export async function listFieldMappings(objectMappingId: string) {
  return prisma.fieldMapping.findMany({
    where: { objectMappingId },
    include: { migrationLogic: { include: { valueEquivalences: true } } },
    orderBy: { sourceFieldName: 'asc' },
  })
}

export async function createFieldMapping(
  planId: string,
  objectMappingId: string,
  sourceFieldName: string,
  destinationFieldName: string,
  sourceType: string,
  destType: string,
) {
  const compatibility = checkTypeCompatibility(sourceType, destType)

  const mapping = await prisma.fieldMapping.create({
    data: {
      objectMappingId,
      sourceFieldName,
      destinationFieldName,
      compatibilityStatus: compatibility,
    },
  })

  await logAuditEvent({
    planId,
    action: 'CREATE_FIELD_MAPPING',
    entity: 'FieldMapping',
    entityId: mapping.id,
    details: { sourceFieldName, destinationFieldName, compatibility },
  })

  return mapping
}

export async function deleteFieldMapping(planId: string, fieldMappingId: string) {
  await prisma.fieldMapping.delete({ where: { id: fieldMappingId } })

  await logAuditEvent({
    planId,
    action: 'DELETE_FIELD_MAPPING',
    entity: 'FieldMapping',
    entityId: fieldMappingId,
  })
}

export async function autoMatchFields(planId: string, objectMappingId: string) {
  const mapping = await prisma.objectMapping.findUniqueOrThrow({
    where: { id: objectMappingId },
    select: {
      fieldAutoMatchedAt: true,
      sourceObjectName: true,
      destinationObjectName: true,
      plan: {
        select: {
          sourceConnectionId: true,
          destinationConnectionId: true,
        },
      },
    },
  })

  if (mapping.fieldAutoMatchedAt) {
    return { created: 0, message: 'Auto-match already performed' }
  }
  if (!mapping.plan.sourceConnectionId || !mapping.plan.destinationConnectionId) {
    throw new Error('Both connections required')
  }

  const sourceSnapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId: mapping.plan.sourceConnectionId, side: 'SOURCE', status: 'CURRENT' } },
    include: { objects: { include: { fields: true } } },
  })
  const destSnapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId: mapping.plan.destinationConnectionId, side: 'DESTINATION', status: 'CURRENT' } },
    include: { objects: { include: { fields: true } } },
  })

  const sourceObj = sourceSnapshot?.objects.find((o) => o.apiName === mapping.sourceObjectName)
  const destObj = destSnapshot?.objects.find((o) => o.apiName === mapping.destinationObjectName)
  if (!sourceObj || !destObj) throw new Error('Objects not found in snapshots')

  const destFieldMap = new Map(destObj.fields.map((f) => [f.apiName.toLowerCase(), f]))

  const existingMappings = await prisma.fieldMapping.findMany({
    where: { objectMappingId },
    select: { sourceFieldName: true, destinationFieldName: true },
  })
  const mappedSource = new Set(existingMappings.map((m) => m.sourceFieldName))
  const mappedDest = new Set(existingMappings.map((m) => m.destinationFieldName))

  let created = 0
  for (const srcField of sourceObj.fields) {
    if (mappedSource.has(srcField.apiName)) continue
    const destField = destFieldMap.get(srcField.apiName.toLowerCase())
    if (!destField || mappedDest.has(destField.apiName)) continue

    const compatibility = checkTypeCompatibility(srcField.dataType, destField.dataType)
    await prisma.fieldMapping.create({
      data: {
        objectMappingId,
        sourceFieldName: srcField.apiName,
        destinationFieldName: destField.apiName,
        compatibilityStatus: compatibility,
      },
    })
    mappedDest.add(destField.apiName)
    created++
  }

  await prisma.objectMapping.update({
    where: { id: objectMappingId },
    data: { fieldAutoMatchedAt: new Date() },
  })

  await logAuditEvent({
    planId,
    action: 'AUTO_MATCH_FIELDS',
    entity: 'FieldMapping',
    details: { objectMappingId, created },
  })

  console.log(`[FieldMapping] Auto-matched ${created} fields for mapping ${objectMappingId}`)
  return { created }
}

export async function getUnmappedFields(objectMappingId: string) {
  const mapping = await prisma.objectMapping.findUniqueOrThrow({
    where: { id: objectMappingId },
    include: {
      fieldMappings: { select: { sourceFieldName: true, destinationFieldName: true } },
      exclusions: { select: { sourceFieldName: true } },
      plan: {
        select: { sourceConnectionId: true, destinationConnectionId: true },
      },
    },
  })

  if (!mapping.plan.sourceConnectionId || !mapping.plan.destinationConnectionId) {
    return { unmappedSource: [], unmappedDest: [], excluded: [] }
  }

  const sourceSnapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId: mapping.plan.sourceConnectionId, side: 'SOURCE', status: 'CURRENT' } },
    include: { objects: { include: { fields: true } } },
  })
  const destSnapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId: mapping.plan.destinationConnectionId, side: 'DESTINATION', status: 'CURRENT' } },
    include: { objects: { include: { fields: true } } },
  })

  const sourceObj = sourceSnapshot?.objects.find((o) => o.apiName === mapping.sourceObjectName)
  const destObj = destSnapshot?.objects.find((o) => o.apiName === mapping.destinationObjectName)

  const mappedSrc = new Set(mapping.fieldMappings.map((m) => m.sourceFieldName))
  const mappedDst = new Set(mapping.fieldMappings.map((m) => m.destinationFieldName))
  const excludedSrc = new Set(mapping.exclusions.map((e) => e.sourceFieldName))

  const unmappedSource = (sourceObj?.fields ?? [])
    .filter((f) => !mappedSrc.has(f.apiName) && !excludedSrc.has(f.apiName))
  const unmappedDest = (destObj?.fields ?? [])
    .filter((f) => !mappedDst.has(f.apiName))

  return {
    unmappedSource,
    unmappedDest,
    excluded: mapping.exclusions,
    sourceCoverage: sourceObj ? Math.round(((mappedSrc.size + excludedSrc.size) / sourceObj.fields.length) * 100) : 0,
    destRequiredCoverage: destObj
      ? Math.round((destObj.fields.filter((f) => f.isRequired && mappedDst.has(f.apiName)).length / Math.max(destObj.fields.filter((f) => f.isRequired).length, 1)) * 100)
      : 0,
  }
}
