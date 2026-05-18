import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'

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

  const destNames = new Map(destSnapshot.objects.map((o) => [o.apiName.toLowerCase(), o.apiName]))

  let created = 0
  for (const srcObj of sourceSnapshot.objects) {
    const destMatch = destNames.get(srcObj.apiName.toLowerCase())
    if (!destMatch) continue

    const existing = await prisma.objectMapping.findUnique({
      where: {
        planId_sourceObjectName_destinationObjectName: {
          planId,
          sourceObjectName: srcObj.apiName,
          destinationObjectName: destMatch,
        },
      },
    })
    if (existing) continue

    await prisma.objectMapping.create({
      data: { planId, sourceObjectName: srcObj.apiName, destinationObjectName: destMatch },
    })
    created++
  }

  await prisma.migrationPlan.update({
    where: { id: planId },
    data: { objectAutoLinkedAt: new Date() },
  })

  await logAuditEvent({
    planId,
    action: 'AUTO_LINK_OBJECTS',
    entity: 'ObjectMapping',
    details: { created },
  })

  console.log(`[ObjectMapping] Auto-linked ${created} pairs for plan ${planId}`)
  return { created }
}
