import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { computeAutoLinkPairs } from '../lib/auto-link-registry'

export async function listObjectMappings(planId: string) {
  return prisma.objectMapping.findMany({
    where: { planId },
    include: {
      fieldMappings: { include: { migrationLogic: true } },
      filters: true,
      exclusions: true,
    },
    orderBy: { sourceObjectName: 'asc' },
  })
}

export async function createObjectMapping(planId: string, sourceObjectName: string, destinationObjectName: string) {
  const mapping = await prisma.objectMapping.create({
    data: { planId, sourceObjectName, destinationObjectName },
  })

  await logAuditEvent({
    planId,
    action: 'CREATE_OBJECT_MAPPING',
    entity: 'ObjectMapping',
    entityId: mapping.id,
    details: { sourceObjectName, destinationObjectName },
  })

  return mapping
}

export async function deleteObjectMapping(planId: string, mappingId: string) {
  await prisma.objectMapping.delete({ where: { id: mappingId } })

  await logAuditEvent({
    planId,
    action: 'DELETE_OBJECT_MAPPING',
    entity: 'ObjectMapping',
    entityId: mappingId,
  })
}

export async function autoLinkObjects(planId: string) {
  const plan = await prisma.migrationPlan.findUniqueOrThrow({
    where: { id: planId },
    select: {
      objectAutoLinkedAt: true,
      sourceConnectionId: true,
      destinationConnectionId: true,
    },
  })

  if (plan.objectAutoLinkedAt) {
    return { created: 0, message: 'Auto-link already performed' }
  }

  if (!plan.sourceConnectionId || !plan.destinationConnectionId) {
    throw new Error('Both connections required for auto-link')
  }

  const sourceSnapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId: plan.sourceConnectionId, side: 'SOURCE', status: 'CURRENT' } },
    include: { objects: true },
  })
  const destSnapshot = await prisma.schemaSnapshot.findUnique({
    where: { connectionId_side_status: { connectionId: plan.destinationConnectionId, side: 'DESTINATION', status: 'CURRENT' } },
    include: { objects: true },
  })

  if (!sourceSnapshot || !destSnapshot) throw new Error('Schema snapshots required')

  // Resolve adapter types so the predictable-pair registry can be keyed (011 US2).
  const [sourceConn, destConn] = await Promise.all([
    prisma.connectorConnection.findUnique({ where: { id: plan.sourceConnectionId }, select: { adapterType: true } }),
    prisma.connectorConnection.findUnique({ where: { id: plan.destinationConnectionId }, select: { adapterType: true } }),
  ])
  if (!sourceConn || !destConn) throw new Error('Connections not found')

  const existing = await prisma.objectMapping.findMany({
    where: { planId },
    select: { sourceObjectName: true },
  })

  // Registry-driven resolution (replaces the naive case-folded equality that missed
  // every Salesforce→HubSpot rename, e.g. Account→companies, Contact→contacts).
  const pairs = computeAutoLinkPairs(
    sourceConn.adapterType,
    destConn.adapterType,
    sourceSnapshot.objects.map((o) => o.apiName),
    destSnapshot.objects.map((o) => o.apiName),
    existing.map((m) => m.sourceObjectName),
  )

  for (const pair of pairs) {
    await prisma.objectMapping.create({
      data: {
        planId,
        sourceObjectName: pair.sourceObjectName,
        destinationObjectName: pair.destinationObjectName,
        autoCreated: true,
      },
    })
  }

  await prisma.migrationPlan.update({
    where: { id: planId },
    data: { objectAutoLinkedAt: new Date() },
  })

  await logAuditEvent({
    planId,
    action: 'AUTO_LINK_OBJECTS',
    entity: 'ObjectMapping',
    details: { created: pairs.length },
  })

  console.log(`[ObjectMapping] Auto-linked ${pairs.length} pairs for plan ${planId}`)
  return { created: pairs.length }
}
