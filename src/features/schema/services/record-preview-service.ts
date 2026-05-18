import { prisma } from '@/lib/prisma'
import { getAdapter } from '@/lib/adapters/registry'
import type { SnapshotSide } from '@prisma/client'

async function getConnectionForSide(planId: string, side: SnapshotSide) {
  const plan = await prisma.migrationPlan.findUniqueOrThrow({
    where: { id: planId },
    include: { sourceConnection: true, destinationConnection: true },
  })

  const connection = side === 'SOURCE' ? plan.sourceConnection : plan.destinationConnection
  if (!connection) throw new Error(`No ${side.toLowerCase()} connection`)
  return connection
}

export async function fetchRecordPage(
  planId: string,
  side: SnapshotSide,
  objectApiName: string,
  page: number,
  pageSize: number,
) {
  const connection = await getConnectionForSide(planId, side)
  const adapter = getAdapter(connection.adapterType)
  return adapter.getRecords(connection.id, objectApiName, page, pageSize)
}

export async function fetchRecordCount(planId: string, side: SnapshotSide, objectApiName: string) {
  const connection = await getConnectionForSide(planId, side)
  const adapter = getAdapter(connection.adapterType)
  return adapter.getRecordCount(connection.id, objectApiName)
}

export async function fetchFieldStats(
  planId: string,
  side: SnapshotSide,
  objectApiName: string,
  fieldApiNames: string[],
) {
  const connection = await getConnectionForSide(planId, side)
  const adapter = getAdapter(connection.adapterType)
  return adapter.getFieldStats(connection.id, objectApiName, fieldApiNames)
}
