// 011-object-mapping — Object mapping service

import { prisma } from '@/lib/db/prisma'
import { logAction } from './audit-service'
import { getAutoLinkPairs } from './auto-link-registry'
import { checkAndUpdatePlanStatus } from './mapping-integrity'
import type {
  ObjectMappingDTO,
  UnmappedSourceObject,
  AvailableDestObject,
  AutoLinkResult,
} from '@/lib/types/mapping'

// --- Errors ---

export class ObjectMappingNotFoundError extends Error {
  constructor(mappingId: string) {
    super(`ObjectMapping not found: ${mappingId}`)
    this.name = 'ObjectMappingNotFoundError'
  }
}

export class DuplicateMappingError extends Error {
  constructor(sourceApiName: string) {
    super(`A mapping already exists for source object: ${sourceApiName}`)
    this.name = 'DuplicateMappingError'
  }
}

export class PlanConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlanConfigError'
  }
}

// --- Helpers ---

function toDTO(
  mapping: {
    id: string
    planId: string
    sourceObjectId: string
    sourceObjectApiName: string
    destObjectId: string
    destObjectApiName: string
    status: string
    createdAt: Date
    updatedAt: Date
  },
  sourceLabel: string,
  destLabel: string,
): ObjectMappingDTO {
  return {
    id: mapping.id,
    planId: mapping.planId,
    sourceObjectId: mapping.sourceObjectId,
    sourceObjectApiName: mapping.sourceObjectApiName,
    sourceObjectLabel: sourceLabel,
    destObjectId: mapping.destObjectId,
    destObjectApiName: mapping.destObjectApiName,
    destObjectLabel: destLabel,
    status: mapping.status as 'ACTIVE' | 'BROKEN',
    createdAt: mapping.createdAt.toISOString(),
    updatedAt: mapping.updatedAt.toISOString(),
  }
}

// --- Service functions ---

/**
 * List all object mappings for a plan, enriched with source/dest labels.
 *
 * Labels are resolved against the CURRENT snapshot by apiName (017 Design
 * Decisions, 2026-05-12). Stored FK (sourceObjectId/destObjectId) may point
 * at a now-deleted SchemaObject after snapshot rotation — we don't trust it.
 * If the apiName lookup also fails, we fall back to the apiName itself as
 * the label (the consultant will see the mapping flagged BROKEN at the
 * field level once they open it).
 */
export async function listObjectMappings(planId: string): Promise<ObjectMappingDTO[]> {
  const mappings = await prisma.objectMapping.findMany({
    where: { planId },
    orderBy: { createdAt: 'asc' },
  })

  if (mappings.length === 0) return []

  // Resolve current snapshots once, then build apiName→object maps
  const [sourceConn, destConn] = await Promise.all([
    prisma.sourceConnection.findUnique({ where: { planId } }),
    prisma.destinationConnection.findUnique({ where: { planId } }),
  ])

  const [sourceSnapshot, destSnapshot] = await Promise.all([
    sourceConn
      ? prisma.schemaSnapshot.findFirst({
          where: { connectionId: sourceConn.id, role: 'source', status: 'CURRENT' },
          include: { objects: true },
        })
      : Promise.resolve(null),
    destConn
      ? prisma.schemaSnapshot.findFirst({
          where: { connectionId: destConn.id, role: 'destination', status: 'CURRENT' },
          include: { objects: true },
        })
      : Promise.resolve(null),
  ])

  const sourceByApiName = new Map((sourceSnapshot?.objects ?? []).map((o) => [o.apiName, o]))
  const destByApiName = new Map((destSnapshot?.objects ?? []).map((o) => [o.apiName, o]))

  return mappings.map((m) =>
    toDTO(
      m,
      sourceByApiName.get(m.sourceObjectApiName)?.label ?? m.sourceObjectApiName,
      destByApiName.get(m.destObjectApiName)?.label ?? m.destObjectApiName,
    ),
  )
}

/**
 * Create a new object mapping. Validates no duplicate for same source object within the plan.
 */
export async function createObjectMapping(
  planId: string,
  sourceObjectId: string,
  sourceObjectApiName: string,
  destObjectId: string,
  destObjectApiName: string,
): Promise<ObjectMappingDTO> {
  // Check for duplicate
  const existing = await prisma.objectMapping.findUnique({
    where: { planId_sourceObjectApiName: { planId, sourceObjectApiName } },
  })
  if (existing) {
    throw new DuplicateMappingError(sourceObjectApiName)
  }

  // Fetch labels for source and dest objects
  const [sourceObj, destObj] = await Promise.all([
    prisma.schemaObject.findUnique({ where: { id: sourceObjectId } }),
    prisma.schemaObject.findUnique({ where: { id: destObjectId } }),
  ])

  const mapping = await prisma.objectMapping.create({
    data: {
      planId,
      sourceObjectId,
      sourceObjectApiName,
      destObjectId,
      destObjectApiName,
      status: 'ACTIVE',
    },
  })

  await logAction(planId, 'OBJECT_MAPPING_CREATED', {
    mappingId: mapping.id,
    sourceObjectApiName,
    destObjectApiName,
  })

  // T007 — re-check integrity after CRUD so plan.status reflects reality
  await checkAndUpdatePlanStatus(planId).catch((err) =>
    console.warn('[WARN] checkAndUpdatePlanStatus after createObjectMapping failed (non-fatal):', err),
  )

  return toDTO(
    mapping,
    sourceObj?.label ?? sourceObjectApiName,
    destObj?.label ?? destObjectApiName,
  )
}

/**
 * Delete an object mapping by ID.
 */
export async function deleteObjectMapping(planId: string, mappingId: string): Promise<void> {
  const mapping = await prisma.objectMapping.findUnique({ where: { id: mappingId } })
  if (!mapping || mapping.planId !== planId) {
    throw new ObjectMappingNotFoundError(mappingId)
  }

  await prisma.objectMapping.delete({ where: { id: mappingId } })

  await logAction(planId, 'OBJECT_MAPPING_DELETED', {
    mappingId,
    sourceObjectApiName: mapping.sourceObjectApiName,
    destObjectApiName: mapping.destObjectApiName,
  })

  // T007 — re-check integrity after delete: removing a broken mapping may flip
  // the plan back to DRAFT once no broken mappings remain.
  await checkAndUpdatePlanStatus(planId).catch((err) =>
    console.warn('[WARN] checkAndUpdatePlanStatus after deleteObjectMapping failed (non-fatal):', err),
  )
}

/**
 * Return selected source objects that don't have a mapping yet.
 */
export async function getUnmappedSourceObjects(planId: string): Promise<UnmappedSourceObject[]> {
  // Find the source connection and its current snapshot
  const sourceConn = await prisma.sourceConnection.findUnique({ where: { planId } })
  if (!sourceConn) return []

  const snapshot = await prisma.schemaSnapshot.findFirst({
    where: { connectionId: sourceConn.id, role: 'source', status: 'CURRENT' },
  })
  if (!snapshot) return []

  // Get selected objects from the snapshot
  const selections = await prisma.objectSelection.findMany({
    where: { snapshotId: snapshot.id, isSelected: true },
    include: { object: true },
  })

  // Get already-mapped source object API names for this plan
  const existingMappings = await prisma.objectMapping.findMany({
    where: { planId },
    select: { sourceObjectApiName: true },
  })
  const mappedApiNames = new Set(existingMappings.map((m) => m.sourceObjectApiName))

  // Return selected objects not yet mapped
  return selections
    .filter((sel) => !mappedApiNames.has(sel.objectApiName))
    .map((sel) => ({
      id: sel.object.id,
      snapshotId: sel.object.snapshotId,
      apiName: sel.object.apiName,
      label: sel.object.label,
      description: sel.object.description,
      isCustom: sel.object.isCustom,
    }))
}

/**
 * Return destination objects from the current destination snapshot.
 */
export async function getAvailableDestObjects(planId: string): Promise<AvailableDestObject[]> {
  const destConn = await prisma.destinationConnection.findUnique({ where: { planId } })
  if (!destConn) return []

  const snapshot = await prisma.schemaSnapshot.findFirst({
    where: { connectionId: destConn.id, role: 'destination', status: 'CURRENT' },
    include: { objects: true },
  })
  if (!snapshot) return []

  return snapshot.objects.map((obj) => ({
    id: obj.id,
    snapshotId: obj.snapshotId,
    apiName: obj.apiName,
    label: obj.label,
    description: obj.description,
    isCustom: obj.isCustom,
  }))
}

/**
 * Auto-link: create predictable mappings between source and destination objects.
 * Idempotent — skips pairs that are already mapped.
 */
export async function autoLink(planId: string): Promise<AutoLinkResult> {
  // Resolve source and destination adapter types
  const [sourceConn, destConn] = await Promise.all([
    prisma.sourceConnection.findUnique({ where: { planId } }),
    prisma.destinationConnection.findUnique({ where: { planId } }),
  ])

  if (!sourceConn || !destConn) {
    throw new PlanConfigError('Both source and destination connections are required for auto-linking.')
  }

  const pairs = getAutoLinkPairs(sourceConn.adapterType, destConn.adapterType)
  if (pairs.length === 0) {
    return { created: 0, skipped: 0, pairs: [] }
  }

  // Resolve snapshots
  const [sourceSnapshot, destSnapshot] = await Promise.all([
    prisma.schemaSnapshot.findFirst({
      where: { connectionId: sourceConn.id, role: 'source', status: 'CURRENT' },
      include: { objects: true },
    }),
    prisma.schemaSnapshot.findFirst({
      where: { connectionId: destConn.id, role: 'destination', status: 'CURRENT' },
      include: { objects: true },
    }),
  ])

  if (!sourceSnapshot || !destSnapshot) {
    throw new PlanConfigError('Schema snapshots are required for auto-linking. Retrieve schemas first.')
  }

  const sourceByApiName = new Map(sourceSnapshot.objects.map((o) => [o.apiName, o]))
  const destByApiName = new Map(destSnapshot.objects.map((o) => [o.apiName, o]))

  // Get existing mappings to skip
  const existingMappings = await prisma.objectMapping.findMany({
    where: { planId },
    select: { sourceObjectApiName: true },
  })
  const alreadyMapped = new Set(existingMappings.map((m) => m.sourceObjectApiName))

  const result: AutoLinkResult = { created: 0, skipped: 0, pairs: [] }

  for (const pair of pairs) {
    const sourceObj = sourceByApiName.get(pair.sourceApiName)
    const destObj = destByApiName.get(pair.destApiName)

    if (!sourceObj || !destObj) {
      // Objects not found in snapshots — skip silently
      continue
    }

    if (alreadyMapped.has(pair.sourceApiName)) {
      result.skipped++
      result.pairs.push({ sourceApiName: pair.sourceApiName, destApiName: pair.destApiName, status: 'skipped' })
      continue
    }

    await prisma.objectMapping.create({
      data: {
        planId,
        sourceObjectId: sourceObj.id,
        sourceObjectApiName: sourceObj.apiName,
        destObjectId: destObj.id,
        destObjectApiName: destObj.apiName,
        status: 'ACTIVE',
      },
    })

    result.created++
    result.pairs.push({ sourceApiName: pair.sourceApiName, destApiName: pair.destApiName, status: 'created' })
  }

  if (result.created > 0) {
    await logAction(planId, 'OBJECT_MAPPING_AUTO_LINKED', {
      created: result.created,
      skipped: result.skipped,
    })
  }

  return result
}
