// 005-source-field-retrieval — Field retrieval service (connection-agnostic)

import { prisma } from '@/lib/db/prisma'
import { logAction } from './audit-service'
import { DemoSourceAdapter } from '@/lib/connectors/adapters/demo-source'
import { DemoDestinationAdapter } from '@/lib/connectors/adapters/demo-destination'
import type { ConnectorAdapter } from '@/lib/connectors/types'
import type {
  FieldRetrievalResult,
  FieldsByObjectResult,
  ObjectFieldResult,
  ObjectWithFields,
} from '@/lib/types/field'

// --- Errors ---

export class FieldRetrievalConnectionNotFoundError extends Error {
  constructor(connectionId: string) {
    super(`No connection found with id: ${connectionId}`)
    this.name = 'FieldRetrievalConnectionNotFoundError'
  }
}

export class FieldRetrievalSnapshotNotFoundError extends Error {
  constructor(snapshotId: string) {
    super(`No snapshot found with id: ${snapshotId}`)
    this.name = 'FieldRetrievalSnapshotNotFoundError'
  }
}

export class FieldRetrievalObjectNotFoundError extends Error {
  constructor(objectId: string) {
    super(`No object found with id: ${objectId}`)
    this.name = 'FieldRetrievalObjectNotFoundError'
  }
}

// --- Adapter factory ---

function getAdapterInstance(adapterType: string): ConnectorAdapter {
  switch (adapterType) {
    case 'demo':
      return new DemoSourceAdapter()
    case 'demo-destination':
      return new DemoDestinationAdapter()
    default:
      throw new Error(`No adapter instance available for type: ${adapterType}`)
  }
}

// --- Helpers ---

async function findConnectionRecord(connectionId: string) {
  const source = await prisma.sourceConnection.findUnique({ where: { id: connectionId } })
  if (source) return { record: source, role: 'source' as const }
  const dest = await prisma.destinationConnection.findUnique({ where: { id: connectionId } })
  if (dest) return { record: dest, role: 'destination' as const }
  return null
}

// --- Service functions ---

/**
 * Retrieve fields for all relevant objects in a snapshot.
 * For source: only selected objects (ObjectSelection.isSelected = true).
 * For destination: all objects in the snapshot (no selection step).
 * Connection-agnostic — works for both source and destination.
 */
export async function retrieveFields(
  connectionId: string,
  snapshotId: string,
  role: 'source' | 'destination',
): Promise<FieldRetrievalResult> {
  const start = Date.now()

  // Resolve connection
  const found = await findConnectionRecord(connectionId)
  if (!found) throw new FieldRetrievalConnectionNotFoundError(connectionId)
  const { record: connectionRecord } = found

  // Resolve snapshot
  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { id: snapshotId },
    include: { objects: true },
  })
  if (!snapshot) throw new FieldRetrievalSnapshotNotFoundError(snapshotId)

  // Determine which objects to retrieve fields for
  let targetObjects: Array<{ id: string; apiName: string }>

  if (role === 'source') {
    // Only selected objects
    const selections = await prisma.objectSelection.findMany({
      where: { snapshotId, isSelected: true },
      select: { objectId: true, objectApiName: true },
    })
    targetObjects = selections.map((s) => ({ id: s.objectId, apiName: s.objectApiName }))
  } else {
    // All objects for destination (no selection step)
    targetObjects = snapshot.objects.map((o) => ({ id: o.id, apiName: o.apiName }))
  }

  const adapter = getAdapterInstance(connectionRecord.adapterType)

  const succeeded: FieldRetrievalResult['succeeded'] = []
  const failed: FieldRetrievalResult['failed'] = []
  let totalFields = 0

  // Retrieve fields per object sequentially; errors are per-object (don't abort batch)
  for (const obj of targetObjects) {
    try {
      const fields = await adapter.getFields(connectionId, obj.apiName)

      // Upsert each field by objectId+apiName
      for (const field of fields) {
        await prisma.objectField.upsert({
          where: { objectId_apiName: { objectId: obj.id, apiName: field.apiName } },
          create: {
            objectId: obj.id,
            snapshotId,
            apiName: field.apiName,
            label: field.label,
            dataType: field.dataType,
            isRequired: field.isRequired,
            isReadOnly: field.isReadOnly,
            isUnique: field.isUnique,
            isAccessible: true, // ConnectorField always accessible when returned
            referenceTo: field.referenceTo ?? null,
            relationshipType: field.relationshipType ?? null,
          },
          update: {
            label: field.label,
            dataType: field.dataType,
            isRequired: field.isRequired,
            isReadOnly: field.isReadOnly,
            isUnique: field.isUnique,
            isAccessible: true,
            referenceTo: field.referenceTo ?? null,
            relationshipType: field.relationshipType ?? null,
          },
        })
      }

      succeeded.push({ objectApiName: obj.apiName, fieldCount: fields.length })
      totalFields += fields.length
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      failed.push({ objectApiName: obj.apiName, error: message })
      console.error(`[field-retrieval] Error retrieving fields for ${obj.apiName}:`, err)
    }
  }

  const duration = Date.now() - start

  await logAction(connectionRecord.planId, 'FIELDS_RETRIEVED', {
    connectionId,
    snapshotId,
    role,
    succeeded: succeeded.length,
    failed: failed.length,
    totalFields,
    duration,
  })

  return { succeeded, failed, totalFields, duration }
}

/**
 * Return fields grouped by object for all selected objects in a snapshot.
 * For source role, only selected objects are included.
 */
export async function getFieldsByObject(snapshotId: string): Promise<FieldsByObjectResult> {
  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { id: snapshotId },
  })
  if (!snapshot) throw new FieldRetrievalSnapshotNotFoundError(snapshotId)

  // For source: get selected object IDs via ObjectSelection
  let targetObjectIds: string[]

  if (snapshot.role === 'source') {
    const selections = await prisma.objectSelection.findMany({
      where: { snapshotId, isSelected: true },
      select: { objectId: true },
    })
    targetObjectIds = selections.map((s) => s.objectId)
  } else {
    const objects = await prisma.schemaObject.findMany({
      where: { snapshotId },
      select: { id: true },
    })
    targetObjectIds = objects.map((o) => o.id)
  }

  // Fetch objects with their fields
  const objects = await prisma.schemaObject.findMany({
    where: { id: { in: targetObjectIds } },
    include: {
      fields: {
        orderBy: { apiName: 'asc' },
      },
    },
    orderBy: { apiName: 'asc' },
  })

  let totalFields = 0
  let inaccessibleFields = 0

  const objectsWithFields: ObjectWithFields[] = objects.map((obj) => {
    const fields: ObjectFieldResult[] = obj.fields.map((f) => ({
      id: f.id,
      objectId: f.objectId,
      snapshotId: f.snapshotId,
      apiName: f.apiName,
      label: f.label,
      dataType: f.dataType,
      isRequired: f.isRequired,
      isReadOnly: f.isReadOnly,
      isUnique: f.isUnique,
      isAccessible: f.isAccessible,
      referenceTo: f.referenceTo,
      relationshipType: f.relationshipType,
      createdAt: f.createdAt.toISOString(),
    }))

    totalFields += fields.length
    inaccessibleFields += fields.filter((f) => !f.isAccessible).length

    return {
      objectId: obj.id,
      objectApiName: obj.apiName,
      objectLabel: obj.label,
      fields,
      fieldCount: fields.length,
    }
  })

  return {
    snapshotId,
    objects: objectsWithFields,
    summary: {
      objectCount: objectsWithFields.length,
      totalFields,
      inaccessibleFields,
    },
  }
}

/**
 * Return all fields for a single object.
 */
export async function getFieldsForObject(objectId: string): Promise<ObjectFieldResult[]> {
  const obj = await prisma.schemaObject.findUnique({
    where: { id: objectId },
    include: {
      fields: { orderBy: { apiName: 'asc' } },
    },
  })
  if (!obj) throw new FieldRetrievalObjectNotFoundError(objectId)

  return obj.fields.map((f) => ({
    id: f.id,
    objectId: f.objectId,
    snapshotId: f.snapshotId,
    apiName: f.apiName,
    label: f.label,
    dataType: f.dataType,
    isRequired: f.isRequired,
    isReadOnly: f.isReadOnly,
    isUnique: f.isUnique,
    isAccessible: f.isAccessible,
    referenceTo: f.referenceTo,
    relationshipType: f.relationshipType,
    createdAt: f.createdAt.toISOString(),
  }))
}

/**
 * Delete fields for objects that are no longer selected in a snapshot.
 * Called when object selection changes.
 */
export async function cleanupFieldsForDeselected(snapshotId: string): Promise<number> {
  // Find deselected object IDs
  const deselected = await prisma.objectSelection.findMany({
    where: { snapshotId, isSelected: false },
    select: { objectId: true },
  })

  if (deselected.length === 0) return 0

  const deselectedIds = deselected.map((s) => s.objectId)

  const result = await prisma.objectField.deleteMany({
    where: { objectId: { in: deselectedIds }, snapshotId },
  })

  console.log(`[field-retrieval] Cleaned up ${result.count} fields for ${deselectedIds.length} deselected objects in snapshot ${snapshotId}`)

  return result.count
}
