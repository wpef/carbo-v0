// 004-source-object-selection — Object selection service
// Adapted from v3 for v4 schema: ObjectSelection has (connectionId, snapshotId, objectApiName)
// unique key — no objectId FK. migrateSelection + initDefaultSelection ported.

import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ObjectWithSelection {
  id: string
  snapshotId: string
  apiName: string
  label: string
  description: string | null
  isCustom: boolean
  isSelected: boolean
  /** 'custom' | 'business' | 'system' — computed from isCustom + adapter metadata */
  category: 'custom' | 'business' | 'system'
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
  snapshotId: string
  connectionId: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function categorise(
  apiName: string,
  isCustom: boolean,
  commonBusinessObjects: string[],
  systemPrefixes: string[],
  systemSuffixes: string[] = [],
): 'custom' | 'business' | 'system' {
  if (isCustom) return 'custom'
  // Known business objects win over the system heuristics (e.g. "Campaign" must stay business).
  if (commonBusinessObjects.includes(apiName)) return 'business'
  if (systemPrefixes.some((p) => apiName.startsWith(p))) return 'system'
  // Real SF internal objects are mostly identified by suffix (AccountFeed, AccountHistory, …).
  if (systemSuffixes.some((s) => apiName.endsWith(s))) return 'system'
  return 'business'
}

/** Sort order: custom < business < system; within each group alphabetical by label. */
function categoryOrder(cat: 'custom' | 'business' | 'system'): number {
  if (cat === 'custom') return 0
  if (cat === 'business') return 1
  return 2
}

// ---------------------------------------------------------------------------
// initDefaultSelection
// Creates ObjectSelection rows for every object in the snapshot that doesn't
// already have one. isSelected=true when isCustom OR apiName in commonBusinessObjects.
// Idempotent.
// ---------------------------------------------------------------------------

export async function initDefaultSelection(
  connectionId: string,
  snapshotId: string,
  commonBusinessObjects: string[],
  planId?: string,
): Promise<{ selectedCount: number; totalCount: number }> {
  const objects = await prisma.schemaObject.findMany({ where: { snapshotId } })

  const existing = await prisma.objectSelection.findMany({
    where: { connectionId, snapshotId },
    select: { objectApiName: true },
  })
  const existingSet = new Set(existing.map((s) => s.objectApiName))

  const toCreate = objects
    .filter((obj) => !existingSet.has(obj.apiName))
    .map((obj) => {
      const isSelected = obj.isCustom || commonBusinessObjects.includes(obj.apiName)
      return { connectionId, snapshotId, objectApiName: obj.apiName, isSelected }
    })

  if (toCreate.length > 0) {
    await prisma.objectSelection.createMany({ data: toCreate })
  }

  const allSelections = await prisma.objectSelection.findMany({
    where: { connectionId, snapshotId },
    select: { isSelected: true },
  })
  const selectedCount = allSelections.filter((s) => s.isSelected).length

  await logAuditEvent({
    planId,
    action: 'OBJECT_SELECTION_INITIALIZED',
    entity: 'ObjectSelection',
    details: {
      connectionId,
      snapshotId,
      selectedCount,
      totalCount: objects.length,
      method: toCreate.length > 0 ? 'defaults' : 'noop',
    },
  })

  return { selectedCount, totalCount: objects.length }
}

// ---------------------------------------------------------------------------
// migrateSelection
// Copy selection state from old snapshot to new snapshot by apiName.
// Objects not present in the new snapshot are silently dropped (orphans).
// ---------------------------------------------------------------------------

export async function migrateSelection(
  connectionId: string,
  oldSnapshotId: string,
  newSnapshotId: string,
  planId?: string,
): Promise<{ migrated: number; orphans: number }> {
  const oldSelections = await prisma.objectSelection.findMany({
    where: { connectionId, snapshotId: oldSnapshotId },
  })
  if (oldSelections.length === 0) return { migrated: 0, orphans: 0 }

  const newObjects = await prisma.schemaObject.findMany({ where: { snapshotId: newSnapshotId } })
  const newApiNames = new Set(newObjects.map((o) => o.apiName))

  const toCreate = oldSelections
    .filter((sel) => newApiNames.has(sel.objectApiName))
    .map((sel) => ({
      connectionId,
      snapshotId: newSnapshotId,
      objectApiName: sel.objectApiName,
      isSelected: sel.isSelected,
    }))

  const orphans = oldSelections.length - toCreate.length

  if (toCreate.length > 0) {
    await prisma.objectSelection.createMany({ data: toCreate, skipDuplicates: true })
  }

  await logAuditEvent({
    planId,
    action: 'OBJECT_SELECTION_INITIALIZED',
    entity: 'ObjectSelection',
    details: {
      connectionId,
      oldSnapshotId,
      newSnapshotId,
      migrated: toCreate.length,
      orphans,
      method: 'migrated',
    },
  })

  return { migrated: toCreate.length, orphans }
}

// ---------------------------------------------------------------------------
// getObjectsWithSelection
// Returns all objects in the snapshot with their selection state + summary.
// If no selection rows exist, runs initDefaultSelection first.
// ---------------------------------------------------------------------------

export async function getObjectsWithSelection(
  connectionId: string,
  snapshotId: string,
  commonBusinessObjects: string[] = [],
  systemPrefixes: string[] = [],
  systemSuffixes: string[] = [],
  planId?: string,
): Promise<ObjectsWithSelectionResult> {
  const objects = await prisma.schemaObject.findMany({
    where: { snapshotId },
    orderBy: { apiName: 'asc' },
  })

  // Bootstrap selections on first access
  const existingCount = await prisma.objectSelection.count({ where: { connectionId, snapshotId } })
  if (existingCount === 0 && objects.length > 0) {
    await initDefaultSelection(connectionId, snapshotId, commonBusinessObjects, planId)
  }

  const selections = await prisma.objectSelection.findMany({
    where: { connectionId, snapshotId },
  })
  const selMap = new Map(selections.map((s) => [s.objectApiName, s.isSelected]))

  const enriched = objects.map((obj) => {
    const isSelected = selMap.get(obj.apiName) ?? true
    const category = categorise(obj.apiName, obj.isCustom, commonBusinessObjects, systemPrefixes, systemSuffixes)
    return { ...obj, isSelected, category }
  })

  // Sort: custom < business < system, then alphabetical
  enriched.sort((a, b) => {
    const co = categoryOrder(a.category) - categoryOrder(b.category)
    if (co !== 0) return co
    return a.label.localeCompare(b.label)
  })

  const total = enriched.length
  const selected = enriched.filter((o) => o.isSelected).length
  const system = enriched.filter((o) => o.category === 'system').length
  const custom = enriched.filter((o) => o.category === 'custom').length

  return {
    objects: enriched,
    summary: { total, selected, system, custom },
    snapshotId,
    connectionId,
  }
}

// ---------------------------------------------------------------------------
// saveSelections
// Bulk upsert selection rows and return updated summary.
// ---------------------------------------------------------------------------

export async function saveSelections(
  planId: string,
  connectionId: string,
  snapshotId: string,
  selections: { objectApiName: string; isSelected: boolean }[],
): Promise<SelectionSummary> {
  for (const sel of selections) {
    await prisma.objectSelection.upsert({
      where: { connectionId_snapshotId_objectApiName: { connectionId, snapshotId, objectApiName: sel.objectApiName } },
      create: { connectionId, snapshotId, objectApiName: sel.objectApiName, isSelected: sel.isSelected },
      update: { isSelected: sel.isSelected },
    })
  }

  await logAuditEvent({
    planId,
    action: 'OBJECT_SELECTION_CHANGED',
    entity: 'ObjectSelection',
    details: {
      connectionId,
      snapshotId,
      changes: selections,
      trigger: selections.length === 1 ? 'manual' : 'bulk',
    },
  })

  const all = await prisma.objectSelection.findMany({ where: { connectionId, snapshotId }, select: { isSelected: true } })
  const totalObjects = await prisma.schemaObject.count({ where: { snapshotId } })
  const selected = all.filter((s) => s.isSelected).length

  return { total: totalObjects, selected, system: 0, custom: 0 }
}

// ---------------------------------------------------------------------------
// getSelectedObjectNames
// Returns the apiNames of all selected objects in the current snapshot.
// ---------------------------------------------------------------------------

export async function getSelectedObjectNames(connectionId: string, snapshotId: string): Promise<string[]> {
  const objects = await prisma.schemaObject.findMany({
    where: { snapshotId },
    select: { apiName: true },
  })

  const deselected = await prisma.objectSelection.findMany({
    where: { connectionId, snapshotId, isSelected: false },
    select: { objectApiName: true },
  })
  const deselectedSet = new Set(deselected.map((s) => s.objectApiName))

  return objects.filter((o) => !deselectedSet.has(o.apiName)).map((o) => o.apiName)
}
