import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { getAdapter } from '@/lib/adapters/registry'

export async function connectSource(planId: string, adapterType: string, config: Record<string, unknown>) {
  const adapter = getAdapter(adapterType)
  console.log(`[SourceConnection] Connecting ${adapterType} for plan ${planId}`)

  const connResult = await adapter.connect(config)

  const connection = await prisma.connectorConnection.create({
    data: {
      adapterType,
      name: connResult.name,
      status: 'CONNECTED',
      config: JSON.stringify(config),
    },
  })

  await prisma.migrationPlan.update({
    where: { id: planId },
    data: { sourceConnectionId: connection.id },
  })

  await logAuditEvent({
    planId,
    action: 'CONNECT_SOURCE',
    entity: 'ConnectorConnection',
    entityId: connection.id,
    details: { adapterType, name: connResult.name },
  })

  console.log(`[SourceConnection] Connected: ${connection.id}`)
  return connection
}

export async function disconnectSource(planId: string) {
  const plan = await prisma.migrationPlan.findUniqueOrThrow({
    where: { id: planId },
    select: { sourceConnectionId: true },
  })

  if (!plan.sourceConnectionId) throw new Error('No source connection to disconnect')

  await prisma.migrationPlan.update({
    where: { id: planId },
    data: { sourceConnectionId: null },
  })

  await prisma.connectorConnection.delete({
    where: { id: plan.sourceConnectionId },
  })

  await logAuditEvent({
    planId,
    action: 'DISCONNECT_SOURCE',
    entity: 'ConnectorConnection',
    entityId: plan.sourceConnectionId,
  })

  console.log(`[SourceConnection] Disconnected source for plan ${planId}`)
}

export async function getSourceConnection(planId: string) {
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    include: { sourceConnection: true },
  })
  return plan?.sourceConnection ?? null
}
