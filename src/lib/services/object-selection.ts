// 004-source-object-selection — Object selection service

import { prisma } from '@/lib/db/prisma'
import { logAction } from './audit-service'
import { getAdapterMetadata } from '@/lib/connectors/registry'
import { getAdapterInstance } from '@/lib/connectors/adapter-factory'

// --- Types ---

export interface ObjectWithSelection {
  id: string
  snapshotId: string
  apiName: string
  label: string
  description: string | null
  isCustom: boolean
  selectionId: string | null
  isSelected: boolean
  selectedAt: Date | null
}

export interface SelectionSummary {
  total: number
  selected: number
  system: number
  custom: number
}

export interface ObjectsWithSelectionResult {
  objects: ObjectWithSelection[]
  summary: SelectionSummary
}

export interface ExpandedObject {
  objectApiName: string
  recordCount: number
  fields: Array<{
    apiName: string
    label: string
    dataType: string
    isRequired: boolean
    isReadOnly: boolean
    isUnique: boolean
    referenceTo?: string
    relationshipType?: string
  }>
  sampleRecords: Array<Record<string, unknown>>
}

// --- Errors ---

export class SnapshotNotFoundError extends Error {
  constructor(snapshotId: string) {
    super(`Snapshot not found: ${snapshotId}`)
    this.name = 'SnapshotNotFoundError'
  }
}

export class ObjectSelectionNotFoundError extends Error {
  constructor(objectId: string) {
    super(`SchemaObject not found: ${objectId}`)
    this.name = 'ObjectSelectionNotFoundError'
  }
}

// --- Helper: is this object a system object? ---

function isSystemObject(apiName: string, systemObjectPrefixes: string[]): boolean {
  if (systemObjectPrefixes.length === 0) return false
  return systemObjectPrefixes.some((prefix) => apiName.startsWith(prefix))
}

// --- Service functions ---

/**
 * Initialize default ObjectSelection rows for every object in a snapshot.
 * isSelected = true when the object isCustom OR its apiName is in commonBusinessObjects.
 * Idempotent: skips objects that already have a selection row.
 */
export async function initDefaultSelection(snapshotId: string, adapterType: string): Promise<void> {
  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { id: snapshotId },
    include: { objects: true },
  })
  if (!snapshot) throw new SnapshotNotFoundError(snapshotId)

  const meta = getAdapterMetadata(adapterType)
  const commonBusinessObjects = meta?.commonBusinessObjects ?? []

  // Find existing selections to avoid duplicates
  const existing = await prisma.objectSelection.findMany({
    where: { snapshotId },
    select: { objectId: true },
  })
  const existingObjectIds = new Set(existing.map((s) => s.objectId))

  const toCreate = snapshot.objects
    .filter((obj) => !existingObjectIds.has(obj.id))
    .map((obj) => {
      const selected = obj.isCustom || commonBusinessObjects.includes(obj.apiName)
      return {
        snapshotId,
        objectId: obj.id,
        objectApiName: obj.apiName,
        isSelected: selected,
        selectedAt: selected ? new Date() : null,
      }
    })

  if (toCreate.length > 0) {
    await prisma.objectSelection.createMany({ data: toCreate })
  }
}

/**
 * Return all objects in a snapshot joined with their selection status.
 * includeSystem=false (default) hides objects whose apiName starts with a system prefix.
 */
export async function getObjectsWithSelection(
  snapshotId: string,
  adapterType: string,
  includeSystem = false,
): Promise<ObjectsWithSelectionResult> {
  const snapshot = await prisma.schemaSnapshot.findUnique({
    where: { id: snapshotId },
    include: {
      objects: {
        include: { selections: true },
      },
    },
  })
  if (!snapshot) throw new SnapshotNotFoundError(snapshotId)

  const meta = getAdapterMetadata(adapterType)
  const systemPrefixes = meta?.systemObjectPrefixes ?? []

  const allObjects = snapshot.objects.map((obj) => {
    const sel = obj.selections[0] ?? null
    return {
      id: obj.id,
      snapshotId: obj.snapshotId,
      apiName: obj.apiName,
      label: obj.label,
      description: obj.description,
      isCustom: obj.isCustom,
      selectionId: sel?.id ?? null,
      isSelected: sel?.isSelected ?? false,
      selectedAt: sel?.selectedAt ?? null,
      _isSystem: isSystemObject(obj.apiName, systemPrefixes),
    }
  })

  const filtered = includeSystem ? allObjects : allObjects.filter((o) => !o._isSystem)

  const objects: ObjectWithSelection[] = filtered.map(({ _isSystem: _s, ...rest }) => rest)

  const total = allObjects.length
  const system = allObjects.filter((o) => o._isSystem).length
  const custom = allObjects.filter((o) => o.isCustom).length
  const selected = filtered.filter((o) => o.isSelected).length

  return {
    objects,
    summary: { total, selected, system, custom },
  }
}

/**
 * Toggle the selection state of a single object.
 */
export async function updateSelection(
  objectId: string,
  isSelected: boolean,
  planId?: string,
): Promise<ObjectWithSelection> {
  const obj = await prisma.schemaObject.findUnique({
    where: { id: objectId },
    include: { selections: true },
  })
  if (!obj) throw new ObjectSelectionNotFoundError(objectId)

  const now = new Date()
  let sel = obj.selections[0]

  if (sel) {
    sel = await prisma.objectSelection.update({
      where: { id: sel.id },
      data: {
        isSelected,
        selectedAt: isSelected ? now : null,
      },
    })
  } else {
    sel = await prisma.objectSelection.create({
      data: {
        snapshotId: obj.snapshotId,
        objectId: obj.id,
        objectApiName: obj.apiName,
        isSelected,
        selectedAt: isSelected ? now : null,
      },
    })
  }

  await logAction(planId ?? null, 'OBJECT_SELECTION_UPDATED', {
    objectId,
    objectApiName: obj.apiName,
    isSelected,
  })

  return {
    id: obj.id,
    snapshotId: obj.snapshotId,
    apiName: obj.apiName,
    label: obj.label,
    description: obj.description,
    isCustom: obj.isCustom,
    selectionId: sel.id,
    isSelected: sel.isSelected,
    selectedAt: sel.selectedAt,
  }
}

/**
 * Bulk update selection state for multiple objects.
 */
export async function bulkUpdateSelection(
  selections: Array<{ objectId: string; isSelected: boolean }>,
  planId?: string,
): Promise<void> {
  const now = new Date()

  await Promise.all(
    selections.map(async ({ objectId, isSelected }) => {
      const existing = await prisma.objectSelection.findFirst({ where: { objectId } })
      if (existing) {
        await prisma.objectSelection.update({
          where: { id: existing.id },
          data: { isSelected, selectedAt: isSelected ? now : null },
        })
      } else {
        const obj = await prisma.schemaObject.findUnique({ where: { id: objectId } })
        if (obj) {
          await prisma.objectSelection.create({
            data: {
              snapshotId: obj.snapshotId,
              objectId: obj.id,
              objectApiName: obj.apiName,
              isSelected,
              selectedAt: isSelected ? now : null,
            },
          })
        }
      }
    }),
  )

  await logAction(planId ?? null, 'OBJECT_SELECTION_BULK_UPDATED', {
    count: selections.length,
    selectedCount: selections.filter((s) => s.isSelected).length,
  })
}

/**
 * Copy selection state from an old snapshot to a new snapshot, matching by apiName.
 */
export async function migrateSelection(oldSnapshotId: string, newSnapshotId: string): Promise<void> {
  const oldSelections = await prisma.objectSelection.findMany({
    where: { snapshotId: oldSnapshotId },
  })
  if (oldSelections.length === 0) return

  const newObjects = await prisma.schemaObject.findMany({
    where: { snapshotId: newSnapshotId },
  })

  const newObjectsByApiName = new Map(newObjects.map((o) => [o.apiName, o]))
  const now = new Date()

  const toCreate = oldSelections
    .map((sel) => {
      const newObj = newObjectsByApiName.get(sel.objectApiName)
      if (!newObj) return null
      return {
        snapshotId: newSnapshotId,
        objectId: newObj.id,
        objectApiName: sel.objectApiName,
        isSelected: sel.isSelected,
        selectedAt: sel.isSelected ? now : null,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  if (toCreate.length > 0) {
    await prisma.objectSelection.createMany({ data: toCreate })
  }
}

/**
 * Expand an object: retrieve record count, fields, and sample records in parallel.
 */
export async function expandObject(connectionId: string, objectApiName: string): Promise<ExpandedObject> {
  // Resolve connection to find adapter type
  const sourceConn = await prisma.sourceConnection.findUnique({ where: { id: connectionId } })
  const destConn = sourceConn ? null : await prisma.destinationConnection.findUnique({ where: { id: connectionId } })
  const conn = sourceConn ?? destConn
  if (!conn) throw new Error(`Connection not found: ${connectionId}`)

  const adapter = getAdapterInstance(conn.adapterType)

  const [recordCount, fields, paginated] = await Promise.all([
    adapter.getRecordCount(connectionId, objectApiName),
    adapter.getFields(connectionId, objectApiName),
    adapter.getRecords(connectionId, objectApiName, 1, 5),
  ])

  return {
    objectApiName,
    recordCount,
    fields,
    sampleRecords: paginated.records,
  }
}
