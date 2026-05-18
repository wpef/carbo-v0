import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { getAdapter } from '@/lib/adapters/registry'

export async function fetchDestinationSchema(planId: string) {
  const plan = await prisma.migrationPlan.findUniqueOrThrow({
    where: { id: planId },
    include: { destinationConnection: true },
  })

  if (!plan.destinationConnection) throw new Error('No destination connection')
  const { destinationConnection } = plan
  const adapter = getAdapter(destinationConnection.adapterType)

  console.log(`[DestSchema] Fetching schema for connection ${destinationConnection.id}`)
  const schema = await adapter.getSchema(destinationConnection.id)

  await prisma.schemaSnapshot.updateMany({
    where: { connectionId: destinationConnection.id, side: 'DESTINATION', status: 'CURRENT' },
    data: { status: 'PREVIOUS' },
  })

  const oldPrevious = await prisma.schemaSnapshot.findMany({
    where: { connectionId: destinationConnection.id, side: 'DESTINATION', status: 'PREVIOUS' },
    orderBy: { fetchedAt: 'desc' },
    skip: 1,
  })
  for (const old of oldPrevious) {
    await prisma.schemaSnapshot.delete({ where: { id: old.id } })
  }

  const snapshot = await prisma.schemaSnapshot.create({
    data: {
      connectionId: destinationConnection.id,
      side: 'DESTINATION',
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
    include: { objects: true },
  })

  await logAuditEvent({
    planId,
    action: 'FETCH_DESTINATION_SCHEMA',
    entity: 'SchemaSnapshot',
    entityId: snapshot.id,
    details: { objectCount: schema.objects.length },
  })

  console.log(`[DestSchema] Stored ${schema.objects.length} objects in snapshot ${snapshot.id}`)
  return snapshot
}
