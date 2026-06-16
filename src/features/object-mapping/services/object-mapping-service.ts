// 011-object-mapping — service layer
// Implements: listObjectMappings, createObjectMapping, deleteObjectMapping,
//             autoLinkObjects (one-shot, Principle IX gate), getMappingStats.

import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { computeAutoLinkPairs, getAutoLinkPairs } from '../lib/auto-link-registry'

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listObjectMappings(planId: string) {
  return prisma.objectMapping.findMany({
    where: { planId },
    orderBy: { sourceObjectName: 'asc' },
  })
}

// ─── Create (manual) ──────────────────────────────────────────────────────────

export async function createObjectMapping(
  planId: string,
  sourceObjectName: string,
  destinationObjectName: string,
): Promise<{ mapping: Awaited<ReturnType<typeof prisma.objectMapping.create>>; warnings: string[] }> {
  const mapping = await prisma.objectMapping.create({
    data: { planId, sourceObjectName, destinationObjectName, autoCreated: false },
  })

  // Fan-in detection (spec FR-007): another source maps to the same destination
  const fanIn = await prisma.objectMapping.count({
    where: {
      planId,
      destinationObjectName,
      id: { not: mapping.id },
    },
  })
  const warnings: string[] = fanIn > 0
    ? [`Fan-in : '${destinationObjectName}' est déjà lié à un autre objet source — des conflits d'enregistrements sont possibles.`]
    : []

  await logAuditEvent({
    planId,
    action: 'OBJECT_MAPPING_CREATED',
    entity: 'ObjectMapping',
    entityId: mapping.id,
    details: { sourceObjectName, destinationObjectName, manual: true },
  })

  return { mapping, warnings }
}

// ─── Delete (cascade via Prisma onDelete: Cascade) ────────────────────────────

export async function deleteObjectMapping(
  planId: string,
  mappingId: string,
): Promise<{ fieldMappingsCount: number; filtersCount: number }> {
  // Count children before cascade delete
  const [fieldMappingsCount, filtersCount] = await Promise.all([
    prisma.fieldMapping.count({ where: { objectMappingId: mappingId } }),
    prisma.migrationFilter.count({ where: { objectMappingId: mappingId } }),
  ])

  await prisma.objectMapping.delete({ where: { id: mappingId } })

  await logAuditEvent({
    planId,
    action: 'OBJECT_MAPPING_DELETED',
    entity: 'ObjectMapping',
    entityId: mappingId,
    details: { cascadedFieldMappings: fieldMappingsCount, cascadedFilters: filtersCount },
  })

  return { fieldMappingsCount, filtersCount }
}

// ─── Auto-link (one-shot, Principle IX) ──────────────────────────────────────

export interface AutoLinkResult {
  /** Mappings created in this run */
  createdMappings: Array<{
    id: string
    sourceObjectName: string
    destinationObjectName: string
    autoCreated: boolean
  }>
  skippedPairs: { source: string; dest: string; reason: string }[]
  /** Non-null if auto-link had already run (no-op return) */
  alreadyLinkedAt: string | null
  /** Convenience count — used by integration tests */
  created: number
}

export async function autoLinkObjects(planId: string): Promise<AutoLinkResult> {
  const plan = await prisma.migrationPlan.findUniqueOrThrow({
    where: { id: planId },
    select: {
      objectAutoLinkedAt: true,
      sourceConnectionId: true,
      destinationConnectionId: true,
    },
  })

  if (plan.objectAutoLinkedAt) {
    return {
      createdMappings: [],
      skippedPairs: [],
      alreadyLinkedAt: plan.objectAutoLinkedAt.toISOString(),
      created: 0,
    }
  }

  if (!plan.sourceConnectionId || !plan.destinationConnectionId) {
    throw new Error('Both connections required for auto-link')
  }

  const [sourceSnapshot, destSnapshot] = await Promise.all([
    prisma.schemaSnapshot.findUnique({
      where: { connectionId_side_status: { connectionId: plan.sourceConnectionId, side: 'SOURCE', status: 'CURRENT' } },
      include: { objects: true },
    }),
    prisma.schemaSnapshot.findUnique({
      where: { connectionId_side_status: { connectionId: plan.destinationConnectionId, side: 'DESTINATION', status: 'CURRENT' } },
      include: { objects: true },
    }),
  ])

  if (!sourceSnapshot || !destSnapshot) throw new Error('Schema snapshots required')

  const [sourceConn, destConn] = await Promise.all([
    prisma.connectorConnection.findUnique({ where: { id: plan.sourceConnectionId }, select: { adapterType: true } }),
    prisma.connectorConnection.findUnique({ where: { id: plan.destinationConnectionId }, select: { adapterType: true } }),
  ])
  if (!sourceConn || !destConn) throw new Error('Connections not found')

  const existing = await prisma.objectMapping.findMany({
    where: { planId },
    select: { sourceObjectName: true },
  })

  const sourceApiNames = sourceSnapshot.objects.map((o) => o.apiName)
  const destApiNames = destSnapshot.objects.map((o) => o.apiName)
  const alreadyMapped = existing.map((m) => m.sourceObjectName)

  const pairs = computeAutoLinkPairs(
    sourceConn.adapterType,
    destConn.adapterType,
    sourceApiNames,
    destApiNames,
    alreadyMapped,
  )

  // Skipped pairs: in registry but missing from current snapshot
  const registryPairs = getAutoLinkPairs(sourceConn.adapterType, destConn.adapterType)
  const sourceSet = new Set(sourceApiNames)
  const destSet = new Set(destApiNames)
  const skippedPairs = registryPairs
    .filter((p) => !sourceSet.has(p.sourceApiName) || !destSet.has(p.destApiName))
    .map((p) => ({
      source: p.sourceApiName,
      dest: p.destApiName,
      reason: !sourceSet.has(p.sourceApiName)
        ? `Source object '${p.sourceApiName}' not in snapshot`
        : `Destination object '${p.destApiName}' not in snapshot`,
    }))

  // Create all pairs in a transaction to ensure atomicity with objectAutoLinkedAt update
  const createdMappings = await prisma.$transaction(async (tx) => {
    const created = []
    for (const pair of pairs) {
      const m = await tx.objectMapping.create({
        data: {
          planId,
          sourceObjectName: pair.sourceObjectName,
          destinationObjectName: pair.destinationObjectName,
          autoCreated: true,
        },
      })
      created.push(m)
    }
    await tx.migrationPlan.update({
      where: { id: planId },
      data: { objectAutoLinkedAt: new Date() },
    })
    return created
  })

  await logAuditEvent({
    planId,
    action: 'AUTO_LINK_OBJECTS',
    entity: 'MigrationPlan',
    entityId: planId,
    details: { createdCount: createdMappings.length, skippedCount: skippedPairs.length },
  })

  console.log(`[ObjectMapping] Auto-linked ${createdMappings.length} pairs for plan ${planId}`)

  return {
    createdMappings,
    skippedPairs,
    alreadyLinkedAt: null,
    created: createdMappings.length,
  }
}

// ─── Stats for detail modal ────────────────────────────────────────────────────

export interface ObjectMappingWithStats {
  id: string
  sourceObjectName: string
  destinationObjectName: string
  autoCreated: boolean
  totalSourceFields: number
  mappedFieldCount: number
  validatedFieldCount: number
  filterCount: number
  sourceRecordCount: number | null
  destRecordCount: number | null
}

export async function getMappingStats(
  _planId: string,
  mappingId: string,
): Promise<ObjectMappingWithStats> {
  const mapping = await prisma.objectMapping.findUniqueOrThrow({
    where: { id: mappingId },
    include: {
      fieldMappings: { include: { migrationLogic: true } },
      filters: true,
    },
  })

  const mappedFieldCount = mapping.fieldMappings.length
  const validatedFieldCount = mapping.fieldMappings.filter(
    (f) => f.migrationLogic?.status === 'VALIDATED',
  ).length
  const filterCount = mapping.filters.length

  // Total source fields: look up from the snapshot via the plan
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: mapping.planId },
    select: { sourceConnectionId: true },
  })
  let totalSourceFields = 0
  if (plan?.sourceConnectionId) {
    const snapshot = await prisma.schemaSnapshot.findUnique({
      where: { connectionId_side_status: { connectionId: plan.sourceConnectionId, side: 'SOURCE', status: 'CURRENT' } },
    })
    if (snapshot) {
      const obj = await prisma.schemaObject.findUnique({
        where: { snapshotId_apiName: { snapshotId: snapshot.id, apiName: mapping.sourceObjectName } },
        include: { fields: true },
      })
      totalSourceFields = obj?.fields.length ?? 0
    }
  }

  return {
    id: mapping.id,
    sourceObjectName: mapping.sourceObjectName,
    destinationObjectName: mapping.destinationObjectName,
    autoCreated: mapping.autoCreated,
    totalSourceFields,
    mappedFieldCount,
    validatedFieldCount,
    filterCount,
    // Record counts are not fetched here (connector call is expensive / async).
    // The UI passes recordCount=null while a separate hook could fetch on demand.
    sourceRecordCount: null,
    destRecordCount: null,
  }
}
