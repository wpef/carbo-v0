import { prisma } from '@/lib/prisma'
import { logAuditEvent } from '@/lib/audit'

export async function getObjectsWithSelection(connectionId: string, snapshotId: string) {
  const objects = await prisma.schemaObject.findMany({
    where: { snapshotId },
    orderBy: { apiName: 'asc' },
    include: { fields: true },
  })

  const selections = await prisma.objectSelection.findMany({
    where: { connectionId, snapshotId },
  })
  const selMap = new Map(selections.map((s) => [s.objectApiName, s.isSelected]))

  return objects.map((obj) => ({
    ...obj,
    isSelected: selMap.get(obj.apiName) ?? true,
  }))
}

export async function saveSelections(
  planId: string,
  connectionId: string,
  snapshotId: string,
  selections: { objectApiName: string; isSelected: boolean }[],
) {
  for (const sel of selections) {
    await prisma.objectSelection.upsert({
      where: {
        connectionId_snapshotId_objectApiName: {
          connectionId,
          snapshotId,
          objectApiName: sel.objectApiName,
        },
      },
      create: {
        connectionId,
        snapshotId,
        objectApiName: sel.objectApiName,
        isSelected: sel.isSelected,
      },
      update: { isSelected: sel.isSelected },
    })
  }

  const selectedCount = selections.filter((s) => s.isSelected).length
  await logAuditEvent({
    planId,
    action: 'UPDATE_OBJECT_SELECTION',
    entity: 'ObjectSelection',
    details: { selectedCount, totalCount: selections.length },
  })

  return getObjectsWithSelection(connectionId, snapshotId)
}

export async function getSelectedObjectNames(connectionId: string, snapshotId: string): Promise<string[]> {
  const objects = await prisma.schemaObject.findMany({
    where: { snapshotId },
    select: { apiName: true },
  })

  const selections = await prisma.objectSelection.findMany({
    where: { connectionId, snapshotId, isSelected: false },
    select: { objectApiName: true },
  })
  const deselected = new Set(selections.map((s) => s.objectApiName))

  return objects.filter((o) => !deselected.has(o.apiName)).map((o) => o.apiName)
}
