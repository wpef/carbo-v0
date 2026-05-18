import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { getAdapter } from '@/lib/adapters/registry'
import type { SnapshotSide } from '@prisma/client'
import type { SchemaDiffResult } from '@/lib/types/connector'

export async function getSchemaSnapshot(connectionId: string, side: SnapshotSide) {
  return prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId, side, status: 'CURRENT' } },
    include: { objects: { include: { fields: true }, orderBy: { apiName: 'asc' } } },
  })
}

export async function fetchAndStoreSchema(planId: string, connectionId: string, adapterType: string, side: SnapshotSide) {
  const adapter = getAdapter(adapterType)
  console.log(`[Schema] Fetching ${side} schema for connection ${connectionId}`)

  const schema = await adapter.getSchema(connectionId)

  await prisma.schemaSnapshot.updateMany({
    where: { connectionId, side, status: 'CURRENT' },
    data: { status: 'PREVIOUS' },
  })

  const oldPrevious = await prisma.schemaSnapshot.findMany({
    where: { connectionId, side, status: 'PREVIOUS' },
    orderBy: { fetchedAt: 'desc' },
    skip: 1,
  })
  for (const old of oldPrevious) {
    await prisma.schemaSnapshot.delete({ where: { id: old.id } })
  }

  const snapshot = await prisma.schemaSnapshot.create({
    data: {
      connectionId,
      side,
      status: 'CURRENT',
      objects: {
        create: schema.objects.map((obj) => ({
          apiName: obj.apiName,
          label: obj.label,
          description: obj.description,
          isCustom: obj.isCustom,
        })),
      },
    },
    include: { objects: { include: { fields: true }, orderBy: { apiName: 'asc' } } },
  })

  await logAuditEvent({
    planId,
    action: `FETCH_${side}_SCHEMA`,
    entity: 'SchemaSnapshot',
    entityId: snapshot.id,
    details: { objectCount: schema.objects.length },
  })

  console.log(`[Schema] Stored ${schema.objects.length} ${side} objects in snapshot ${snapshot.id}`)
  return snapshot
}

export function computeSchemaDiff(
  currentObjects: { apiName: string; fields: { apiName: string; dataType: string }[] }[],
  previousObjects: { apiName: string; fields: { apiName: string; dataType: string }[] }[],
): SchemaDiffResult {
  const currentNames = new Set(currentObjects.map((o) => o.apiName))
  const previousNames = new Set(previousObjects.map((o) => o.apiName))

  const addedObjects = [...currentNames].filter((n) => !previousNames.has(n))
  const removedObjects = [...previousNames].filter((n) => !currentNames.has(n))

  const modifiedObjects: SchemaDiffResult['modifiedObjects'] = []
  for (const name of currentNames) {
    if (!previousNames.has(name)) continue
    const curr = currentObjects.find((o) => o.apiName === name)!
    const prev = previousObjects.find((o) => o.apiName === name)!

    const currFields = new Map(curr.fields.map((f) => [f.apiName, f]))
    const prevFields = new Map(prev.fields.map((f) => [f.apiName, f]))

    const addedFields = [...currFields.keys()].filter((k) => !prevFields.has(k))
    const removedFields = [...prevFields.keys()].filter((k) => !currFields.has(k))
    const modifiedFields: SchemaDiffResult['modifiedObjects'][0]['modifiedFields'] = []

    for (const [fName, currField] of currFields) {
      const prevField = prevFields.get(fName)
      if (!prevField) continue
      if (currField.dataType !== prevField.dataType) {
        modifiedFields.push({
          apiName: fName,
          changes: { dataType: { before: prevField.dataType, after: currField.dataType } },
        })
      }
    }

    if (addedFields.length || removedFields.length || modifiedFields.length) {
      modifiedObjects.push({ apiName: name, addedFields, removedFields, modifiedFields })
    }
  }

  return { addedObjects, removedObjects, modifiedObjects }
}
