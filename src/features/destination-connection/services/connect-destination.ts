import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'
import { getAdapter } from '@/lib/adapters/registry'

export async function connectDestination(planId: string, adapterType: string, config: Record<string, unknown>) {
  const adapter = getAdapter(adapterType)
  console.log(`[DestConnection] Connecting ${adapterType} for plan ${planId}`)

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
    data: { destinationConnectionId: connection.id },
  })

  await logAuditEvent({
    planId,
    action: 'CONNECT_DESTINATION',
    entity: 'ConnectorConnection',
    entityId: connection.id,
    details: { adapterType, name: connResult.name },
  })

  console.log(`[DestConnection] Connected: ${connection.id}`)
  return connection
}

export async function disconnectDestination(planId: string) {
  const plan = await prisma.migrationPlan.findUniqueOrThrow({
    where: { id: planId },
    select: { destinationConnectionId: true },
  })

  if (!plan.destinationConnectionId) throw new Error('No destination connection to disconnect')

  await prisma.migrationPlan.update({
    where: { id: planId },
    data: { destinationConnectionId: null },
  })

  await prisma.connectorConnection.delete({
    where: { id: plan.destinationConnectionId },
  })

  await logAuditEvent({
    planId,
    action: 'DISCONNECT_DESTINATION',
    entity: 'ConnectorConnection',
    entityId: plan.destinationConnectionId,
  })

  console.log(`[DestConnection] Disconnected destination for plan ${planId}`)
}

export async function getDestinationConnection(planId: string) {
  const plan = await prisma.migrationPlan.findUnique({
    where: { id: planId },
    include: { destinationConnection: true },
  })
  return plan?.destinationConnection ?? null
}
