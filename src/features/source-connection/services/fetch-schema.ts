import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { getAdapter } from '@/lib/adapters/registry'

export async function fetchSourceSchema(planId: string) {
  const plan = await prisma.migrationPlan.findUniqueOrThrow({
    where: { id: planId },
    include: { sourceConnection: true },
  })

  if (!plan.sourceConnection) throw new Error('No source connection')
  const { sourceConnection } = plan
  const adapter = getAdapter(sourceConnection.adapterType)

  console.log(`[SourceSchema] Fetching schema for connection ${sourceConnection.id}`)
  const schema = await adapter.getSchema(sourceConnection.id)

  // Rotate: mark any existing CURRENT snapshot as PREVIOUS
  await prisma.schemaSnapshot.updateMany({
    where: { connectionId: sourceConnection.id, side: 'SOURCE', status: 'CURRENT' },
    data: { status: 'PREVIOUS' },
  })

  // Delete old PREVIOUS snapshots (keep only one rotation)
  const oldPrevious = await prisma.schemaSnapshot.findMany({
    where: { connectionId: sourceConnection.id, side: 'SOURCE', status: 'PREVIOUS' },
    orderBy: { fetchedAt: 'desc' },
    skip: 1,
  })
  for (const old of oldPrevious) {
    await prisma.schemaSnapshot.delete({ where: { id: old.id } })
  }

  // Create new snapshot with objects
  const snapshot = await prisma.schemaSnapshot.create({
    data: {
      connectionId: sourceConnection.id,
      side: 'SOURCE',
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
    action: 'FETCH_SOURCE_SCHEMA',
    entity: 'SchemaSnapshot',
    entityId: snapshot.id,
    details: { objectCount: schema.objects.length },
  })

  console.log(`[SourceSchema] Stored ${schema.objects.length} objects in snapshot ${snapshot.id}`)
  return snapshot
}
